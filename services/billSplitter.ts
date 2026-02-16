
import { initDatabase, getDatabase } from './database';

export interface BillGroup {
    id: number;
    name: string;
    description?: string;
    created_at: number;
    last_updated: number;
    is_archived: number; // 0 or 1
}

export interface BillGroupMember {
    id: number;
    group_id: number;
    name: string;
    created_at: number;
}

export interface BillExpense {
    id: number;
    group_id: number;
    title: string;
    amount: number;
    paid_by_member_id: number;
    date: number;
    notes?: string;
    created_at: number;
}

export interface BillExpenseSplit {
    id: number;
    expense_id: number;
    member_id: number;
    amount: number;
    created_at: number;
}

// Full Expense with Splits
export interface BillExpenseDetails extends BillExpense {
    splits: BillExpenseSplit[];
    paid_by_name: string;
}

// Settlement Interfaces
export interface Balance {
    member_id: number;
    member_name: string;
    amount: number; // +ve = receives, -ve = owes
}

export interface SettlementTransaction {
    from_id: number;
    from_name: string;
    to_id: number;
    to_name: string;
    amount: number;
}

// --- Groups ---

export const getGroups = async (includeArchived = false): Promise<BillGroup[]> => {
    await initDatabase();
    const db = getDatabase();
    const query = includeArchived
        ? 'SELECT * FROM bill_groups ORDER BY last_updated DESC'
        : 'SELECT * FROM bill_groups WHERE is_archived = 0 ORDER BY last_updated DESC';
    return await db.getAllAsync<BillGroup>(query);
};

export const getGroupById = async (id: number): Promise<BillGroup | null> => {
    await initDatabase();
    const db = getDatabase();
    return await db.getFirstAsync<BillGroup>('SELECT * FROM bill_groups WHERE id = ?', [id]);
};

export const addGroup = async (name: string, description?: string): Promise<number> => {
    await initDatabase();
    const db = getDatabase();
    const timestamp = Date.now();
    const res = await db.runAsync(
        'INSERT INTO bill_groups (name, description, created_at, last_updated, is_archived) VALUES (?, ?, ?, ?, 0)',
        [name, description || null, timestamp, timestamp]
    );
    return res.lastInsertRowId;
};

export const updateGroup = async (id: number, name: string, description?: string) => {
    await initDatabase();
    const db = getDatabase();
    const timestamp = Date.now();
    await db.runAsync(
        'UPDATE bill_groups SET name = ?, description = ?, last_updated = ? WHERE id = ?',
        [name, description || null, timestamp, id]
    );
};

export const archiveGroup = async (id: number, isArchived: boolean) => {
    await initDatabase();
    const db = getDatabase();
    const timestamp = Date.now();
    await db.runAsync(
        'UPDATE bill_groups SET is_archived = ?, last_updated = ? WHERE id = ?',
        [isArchived ? 1 : 0, timestamp, id]
    );
};

export const deleteGroup = async (id: number) => {
    await initDatabase();
    const db = getDatabase();
    // Cascade delete handles members and expenses
    await db.runAsync('DELETE FROM bill_groups WHERE id = ?', [id]);
};

// --- Members ---

export const getGroupMembers = async (groupId: number): Promise<BillGroupMember[]> => {
    await initDatabase();
    const db = getDatabase();
    return await db.getAllAsync<BillGroupMember>('SELECT * FROM bill_group_members WHERE group_id = ? ORDER BY id ASC', [groupId]);
};

export const addMember = async (groupId: number, name: string) => {
    await initDatabase();
    const db = getDatabase();
    const timestamp = Date.now();
    await db.runAsync(
        'INSERT INTO bill_group_members (group_id, name, created_at) VALUES (?, ?, ?)',
        [groupId, name, timestamp]
    );
    // Update group timestamp
    await db.runAsync('UPDATE bill_groups SET last_updated = ? WHERE id = ?', [timestamp, groupId]);
};

export const updateMemberName = async (id: number, name: string) => {
    await initDatabase();
    const db = getDatabase();
    await db.runAsync('UPDATE bill_group_members SET name = ? WHERE id = ?', [name, id]);
};

export const deleteMember = async (id: number) => {
    await initDatabase();
    const db = getDatabase();
    // Check for expenses first? UI should handle validation, but DB cascade will delete expenses involved?
    // Actually, if a member is deleted, their expenses/splits might become orphaned or deleted.
    // Best to rely on UI preventing deletion if they have balance.
    await db.runAsync('DELETE FROM bill_group_members WHERE id = ?', [id]);
};

// --- Expenses ---

export const getGroupExpenses = async (groupId: number): Promise<BillExpenseDetails[]> => {
    await initDatabase();
    const db = getDatabase();

    const expenses = await db.getAllAsync<BillExpense & { paid_by_name: string }>(`
    SELECT e.*, m.name as paid_by_name 
    FROM bill_expenses e
    JOIN bill_group_members m ON e.paid_by_member_id = m.id
    WHERE e.group_id = ?
    ORDER BY e.date DESC, e.created_at DESC
  `, [groupId]);

    const result: BillExpenseDetails[] = [];

    for (const exp of expenses) {
        const splits = await db.getAllAsync<BillExpenseSplit>(
            'SELECT * FROM bill_expense_splits WHERE expense_id = ?',
            [exp.id]
        );
        result.push({ ...exp, splits });
    }

    return result;
};

export interface CreateExpenseParams {
    groupId: number;
    title: string;
    amount: number;
    paidByMemberId: number;
    date: number;
    notes?: string;
    splits: { memberId: number; amount: number }[];
}

export const addExpense = async (params: CreateExpenseParams) => {
    await initDatabase();
    const db = getDatabase();
    const timestamp = Date.now();

    try {
        await db.withTransactionAsync(async () => {
            // 1. Create Expense
            const res = await db.runAsync(
                'INSERT INTO bill_expenses (group_id, title, amount, paid_by_member_id, date, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
                [params.groupId, params.title, params.amount, params.paidByMemberId, params.date, params.notes || null, timestamp]
            );
            const expenseId = res.lastInsertRowId;

            // 2. Create Splits
            for (const split of params.splits) {
                await db.runAsync(
                    'INSERT INTO bill_expense_splits (expense_id, member_id, amount, created_at) VALUES (?, ?, ?, ?)',
                    [expenseId, split.memberId, split.amount, timestamp]
                );
            }

            // 3. Update Group Timestamp
            await db.runAsync('UPDATE bill_groups SET last_updated = ? WHERE id = ?', [timestamp, params.groupId]);
        });
    } catch (e) {
        console.error("Failed to add expense", e);
        throw e;
    }
};

export const getExpenseById = async (id: number): Promise<BillExpenseDetails | null> => {
    await initDatabase();
    const db = getDatabase();

    const exp = await db.getFirstAsync<BillExpense & { paid_by_name: string }>(`
    SELECT e.*, m.name as paid_by_name 
    FROM bill_expenses e
    JOIN bill_group_members m ON e.paid_by_member_id = m.id
    WHERE e.id = ?
  `, [id]);

    if (!exp) return null;

    const splits = await db.getAllAsync<BillExpenseSplit>(
        'SELECT * FROM bill_expense_splits WHERE expense_id = ?',
        [id]
    );

    return { ...exp, splits };
};

export const updateExpense = async (id: number, params: CreateExpenseParams) => {
    await initDatabase();
    const db = getDatabase();
    const timestamp = Date.now();

    try {
        await db.withTransactionAsync(async () => {
            // 1. Update Expense
            await db.runAsync(
                'UPDATE bill_expenses SET title = ?, amount = ?, paid_by_member_id = ?, date = ?, notes = ? WHERE id = ?',
                [params.title, params.amount, params.paidByMemberId, params.date, params.notes || null, id]
            );

            // 2. Delete Old Splits
            await db.runAsync('DELETE FROM bill_expense_splits WHERE expense_id = ?', [id]);

            // 3. Create New Splits
            for (const split of params.splits) {
                await db.runAsync(
                    'INSERT INTO bill_expense_splits (expense_id, member_id, amount, created_at) VALUES (?, ?, ?, ?)',
                    [id, split.memberId, split.amount, timestamp]
                );
            }

            // 4. Update Group Timestamp
            await db.runAsync('UPDATE bill_groups SET last_updated = ? WHERE id = ?', [timestamp, params.groupId]);
        });
    } catch (e) {
        console.error("Failed to update expense", e);
        throw e;
    }
};

export const deleteExpense = async (id: number) => {
    await initDatabase();
    const db = getDatabase();
    const timestamp = Date.now();

    // Get group ID first to update timestamp
    const exp = await db.getFirstAsync<{ group_id: number }>('SELECT group_id FROM bill_expenses WHERE id = ?', [id]);

    await db.runAsync('DELETE FROM bill_expenses WHERE id = ?', [id]);

    if (exp) {
        await db.runAsync('UPDATE bill_groups SET last_updated = ? WHERE id = ?', [timestamp, exp.group_id]);
    }
};

// --- Settlement Internal Logic ---

export const calculateBalances = async (groupId: number): Promise<Balance[]> => {
    const members = await getGroupMembers(groupId);
    const expenses = await getGroupExpenses(groupId);

    const balances: Record<number, number> = {};
    const memberNames: Record<number, string> = {};

    // Initialize
    members.forEach(m => {
        balances[m.id] = 0;
        memberNames[m.id] = m.name;
    });

    // Process Expenses
    expenses.forEach(exp => {
        // Payer gets positive balance (money owed TO them)
        if (balances[exp.paid_by_member_id] !== undefined) {
            balances[exp.paid_by_member_id] += exp.amount;
        }

        // Splitters get negative balance (money they OWE)
        exp.splits.forEach(split => {
            if (balances[split.member_id] !== undefined) {
                balances[split.member_id] -= split.amount;
            }
        });
    });

    return Object.keys(balances).map(id => ({
        member_id: parseInt(id),
        member_name: memberNames[parseInt(id)],
        amount: balances[parseInt(id)]
    }));
};

// Minimal Transaction Algorithm (Greedy)
export const calculateSettlements = (balances: Balance[]): SettlementTransaction[] => {
    const debtors = balances.filter(b => b.amount < -0.01).sort((a, b) => a.amount - b.amount); // Ascending (most negative first)
    const creditors = balances.filter(b => b.amount > 0.01).sort((a, b) => b.amount - a.amount); // Descending (most positive first)

    const transactions: SettlementTransaction[] = [];

    let i = 0; // debtor index
    let j = 0; // creditor index

    while (i < debtors.length && j < creditors.length) {
        const debtor = debtors[i];
        const creditor = creditors[j];

        // Amount to settle is min of what debtor owes and what creditor is owed
        const amount = Math.min(Math.abs(debtor.amount), creditor.amount);

        transactions.push({
            from_id: debtor.member_id,
            from_name: debtor.member_name,
            to_id: creditor.member_id,
            to_name: creditor.member_name,
            amount: Number(amount.toFixed(2))
        });

        // Update remaining amounts
        debtor.amount += amount;
        creditor.amount -= amount;

        // Move indices if settled
        if (Math.abs(debtor.amount) < 0.01) i++;
        if (creditor.amount < 0.01) j++;
    }

    return transactions;
};
