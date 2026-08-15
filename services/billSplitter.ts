
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
    total_spent: number;
    total_share: number;
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

    const spent: Record<number, number> = {};
    const share: Record<number, number> = {};

    // Initialize all members with 0
    members.forEach(m => {
        const id = Number(m.id);
        spent[id] = 0;
        share[id] = 0;
    });

    // Process Expenses
    expenses.forEach(exp => {
        const payerId = Number(exp.paid_by_member_id);
        const expAmount = Number(exp.amount) || 0;

        if (spent[payerId] !== undefined) {
            spent[payerId] += expAmount;
        } else {
            spent[payerId] = expAmount;
        }

        if (Array.isArray(exp.splits)) {
            exp.splits.forEach(split => {
                const sMemberId = Number(split.member_id);
                const sAmount = Number(split.amount) || 0;
                if (share[sMemberId] !== undefined) {
                    share[sMemberId] += sAmount;
                } else {
                    share[sMemberId] = sAmount;
                }
            });
        }
    });

    return members.map(m => {
        const id = Number(m.id);
        const totalSpent = spent[id] || 0;
        const totalShare = share[id] || 0;
        const netAmount = totalSpent - totalShare;

        return {
            member_id: id,
            member_name: m.name,
            total_spent: totalSpent,
            total_share: totalShare,
            amount: Number(netAmount.toFixed(2))
        };
    });
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

export const generateBillGroupShareSummary = async (groupId: number): Promise<string> => {
    const group = await getGroupById(groupId);
    if (!group) return '';

    const expenses = await getGroupExpenses(groupId);
    const balances = await calculateBalances(groupId);
    const settlements = calculateSettlements(balances);

    const totalSpent = expenses.reduce((sum, e) => sum + e.amount, 0);

    let text = `🧾 *Bill Split Summary: ${group.name}*\n`;
    if (group.description) text += `${group.description}\n`;
    text += `─────────────\n`;
    text += `💰 Total Expenses: ₹${totalSpent.toLocaleString('en-IN')}\n\n`;

    text += `📊 *Individual Balances:*\n`;
    balances.forEach(b => {
        const sign = b.amount > 0 ? 'Gets back' : b.amount < 0 ? 'Owes' : 'Settled';
        const amtStr = Math.abs(b.amount) < 0.01 ? '₹0' : `₹${Math.abs(b.amount).toFixed(2)}`;
        text += `• ${b.member_name}: ${sign} ${amtStr} (Spent ₹${b.total_spent.toFixed(0)}, Share ₹${b.total_share.toFixed(0)})\n`;
    });

    if (settlements.length > 0) {
        text += `\n🤝 *Settlement Plan:*\n`;
        settlements.forEach(s => {
            text += `• ${s.from_name} ➔ ${s.to_name}: ₹${s.amount.toLocaleString('en-IN')}\n`;
        });
    } else {
        text += `\n🎉 All settled up!\n`;
    }

    text += `\nShared via ExpenseTracker`;
    return text;
};

export const generateBillGroupPdfHtml = async (groupId: number): Promise<string> => {
    const group = await getGroupById(groupId);
    if (!group) return '';

    const members = await getGroupMembers(groupId);
    const expenses = await getGroupExpenses(groupId);
    const balances = await calculateBalances(groupId);
    const settlements = calculateSettlements(balances);

    const totalSpent = expenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);
    const dateStr = new Date().toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
    });

    // Generate SVG Pie Chart for Spending Breakdown
    const pieColors = ['#4F46E5', '#10B981', '#F59E0B', '#EC4899', '#8B5CF6', '#3B82F6', '#14B8A6', '#F97316'];
    const spendingMembers = balances.filter(b => b.total_spent > 0);
    const totalPieSpent = spendingMembers.reduce((sum, b) => sum + b.total_spent, 0);

    let pieSvg = '';
    let legendHtml = '';

    if (totalPieSpent > 0 && spendingMembers.length > 0) {
        let currentAngle = 0;
        const slices: string[] = [];

        spendingMembers.forEach((b, idx) => {
            const percentage = (b.total_spent / totalPieSpent);
            const sliceAngle = percentage * 360;
            const color = pieColors[idx % pieColors.length];

            if (spendingMembers.length === 1 || sliceAngle >= 359.9) {
                slices.push(`<circle cx="100" cy="100" r="75" fill="${color}" />`);
            } else {
                const startAngle = currentAngle;
                const endAngle = currentAngle + sliceAngle;

                const startRad = (startAngle - 90) * Math.PI / 180;
                const endRad = (endAngle - 90) * Math.PI / 180;

                const x1 = 100 + 75 * Math.cos(startRad);
                const y1 = 100 + 75 * Math.sin(startRad);
                const x2 = 100 + 75 * Math.cos(endRad);
                const y2 = 100 + 75 * Math.sin(endRad);

                const largeArc = sliceAngle > 180 ? 1 : 0;
                const pathData = `M 100 100 L ${x1.toFixed(2)} ${y1.toFixed(2)} A 75 75 0 ${largeArc} 1 ${x2.toFixed(2)} ${y2.toFixed(2)} Z`;
                slices.push(`<path d="${pathData}" fill="${color}" />`);
            }

            currentAngle += sliceAngle;

            const pctStr = (percentage * 100).toFixed(1);
            legendHtml += `
                <div style="display:flex; align-items:center; margin-bottom:8px;">
                    <span style="width:12px; height:12px; border-radius:50%; background-color:${color}; display:inline-block; margin-right:8px;"></span>
                    <span style="flex:1; font-size:13px; color:#374151;"><strong>${b.member_name}</strong></span>
                    <span style="font-size:13px; font-weight:600; color:#111827;">₹${b.total_spent.toLocaleString('en-IN')} (${pctStr}%)</span>
                </div>
            `;
        });

        pieSvg = `
            <svg width="200" height="200" viewBox="0 0 200 200" style="display:block; margin:0 auto;">
                ${slices.join('')}
                <circle cx="100" cy="100" r="42" fill="#FFFFFF" />
            </svg>
        `;
    } else {
        pieSvg = `
            <svg width="200" height="200" viewBox="0 0 200 200" style="display:block; margin:0 auto;">
                <circle cx="100" cy="100" r="75" fill="#E5E7EB" />
                <circle cx="100" cy="100" r="42" fill="#FFFFFF" />
            </svg>
        `;
        legendHtml = `<p style="color:#6B7280; font-size:13px; text-align:center;">No spending data available</p>`;
    }

    // Expenses Table Rows
    const expenseRowsHtml = expenses.map((e, index) => {
        const expDate = new Date(e.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
        const bg = index % 2 === 0 ? '#FFFFFF' : '#F9FAFB';
        return `
            <tr style="background-color:${bg}; border-bottom:1px solid #E5E7EB;">
                <td style="padding:10px 12px; font-size:13px; color:#4B5563;">${expDate}</td>
                <td style="padding:10px 12px; font-size:13px; font-weight:600; color:#111827;">${e.title}</td>
                <td style="padding:10px 12px; font-size:13px; color:#4B5563;">${e.paid_by_name}</td>
                <td style="padding:10px 12px; font-size:13px; font-weight:700; color:#111827; text-align:right;">₹${e.amount.toLocaleString('en-IN')}</td>
            </tr>
        `;
    }).join('');

    // Balances Rows
    const balanceRowsHtml = balances.map((b, index) => {
        const bg = index % 2 === 0 ? '#FFFFFF' : '#F9FAFB';
        const isReceiving = b.amount > 0.01;
        const isOwing = b.amount < -0.01;
        const statusText = isReceiving ? `Gets back ₹${b.amount.toFixed(2)}` : isOwing ? `Owes ₹${Math.abs(b.amount).toFixed(2)}` : 'Settled';
        const statusColor = isReceiving ? '#059669' : isOwing ? '#DC2626' : '#4B5563';
        const badgeBg = isReceiving ? '#D1FAE5' : isOwing ? '#FEE2E2' : '#E5E7EB';

        return `
            <tr style="background-color:${bg}; border-bottom:1px solid #E5E7EB;">
                <td style="padding:10px 12px; font-size:13px; font-weight:600; color:#111827;">${b.member_name}</td>
                <td style="padding:10px 12px; font-size:13px; color:#4B5563; text-align:right;">₹${b.total_spent.toLocaleString('en-IN')}</td>
                <td style="padding:10px 12px; font-size:13px; color:#4B5563; text-align:right;">₹${b.total_share.toLocaleString('en-IN')}</td>
                <td style="padding:10px 12px; font-size:13px; text-align:right;">
                    <span style="background-color:${badgeBg}; color:${statusColor}; padding:4px 8px; border-radius:12px; font-weight:700; font-size:12px;">
                        ${statusText}
                    </span>
                </td>
            </tr>
        `;
    }).join('');

    // Settlements HTML
    let settlementHtml = '';
    if (settlements.length > 0) {
        settlementHtml = settlements.map(s => `
            <div style="display:flex; justify-content:space-between; align-items:center; background-color:#EEF2FF; border:1px solid #C7D2FE; padding:12px 16px; border-radius:8px; margin-bottom:8px;">
                <div style="font-size:14px; font-weight:600; color:#3730A3;">
                    <span>${s.from_name}</span>
                    <span style="color:#6366F1; margin:0 8px;">➔</span>
                    <span>${s.to_name}</span>
                </div>
                <div style="font-size:15px; font-weight:700; color:#4338CA;">
                    ₹${s.amount.toLocaleString('en-IN')}
                </div>
            </div>
        `).join('');
    } else {
        settlementHtml = `
            <div style="text-align:center; padding:16px; background-color:#ECFDF5; border:1px solid #A7F3D0; border-radius:8px; color:#065F46; font-weight:600;">
                🎉 All balances are settled up!
            </div>
        `;
    }

    return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <title>${group.name} - Bill Split Report</title>
            <style>
                body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; margin: 0; padding: 24px; color: #111827; background-color: #FFFFFF; }
                .header { border-bottom: 2px solid #4F46E5; padding-bottom: 16px; margin-bottom: 24px; display: flex; justify-content: space-between; align-items: flex-end; }
                .title { font-size: 24px; font-weight: 800; color: #1E1B4B; margin: 0 0 4px 0; }
                .subtitle { font-size: 14px; color: #6B7280; margin: 0; }
                .meta { font-size: 12px; color: #4B5563; text-align: right; }
                .grid { display: flex; gap: 16px; margin-bottom: 24px; }
                .card { flex: 1; background: #F9FAFB; border: 1px solid #E5E7EB; border-radius: 12px; padding: 14px; text-align: center; }
                .card-val { font-size: 20px; font-weight: 800; color: #4F46E5; }
                .card-lbl { font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: #6B7280; margin-top: 4px; font-weight: 600; }
                .section-title { font-size: 16px; font-weight: 700; color: #111827; margin: 24px 0 12px 0; border-left: 4px solid #4F46E5; padding-left: 10px; }
                table { width: 100%; border-collapse: collapse; margin-bottom: 16px; border-radius: 8px; overflow: hidden; border: 1px solid #E5E7EB; }
                th { background-color: #4F46E5; color: #FFFFFF; text-align: left; padding: 10px 12px; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; }
                .chart-container { display: flex; align-items: center; justify-content: space-around; background-color: #F9FAFB; border: 1px solid #E5E7EB; border-radius: 12px; padding: 16px; margin-bottom: 24px; }
                .footer { margin-top: 40px; border-top: 1px solid #E5E7EB; padding-top: 12px; text-align: center; font-size: 11px; color: #9CA3AF; }
            </style>
        </head>
        <body>
            <div class="header">
                <div>
                    <h1 class="title">${group.name}</h1>
                    <p class="subtitle">${group.description || 'Bill Split & Expense Summary'}</p>
                </div>
                <div class="meta">
                    <div><strong>Date:</strong> ${dateStr}</div>
                    <div><strong>App:</strong> ExpenseTracker</div>
                </div>
            </div>

            <div class="grid">
                <div class="card">
                    <div class="card-val">₹${totalSpent.toLocaleString('en-IN')}</div>
                    <div class="card-lbl">Total Group Spend</div>
                </div>
                <div class="card">
                    <div class="card-val">${expenses.length}</div>
                    <div class="card-lbl">Total Expenses</div>
                </div>
                <div class="card">
                    <div class="card-val">${members.length}</div>
                    <div class="card-lbl">Group Members</div>
                </div>
                <div class="card">
                    <div class="card-val">${settlements.length}</div>
                    <div class="card-lbl">Pending Settlements</div>
                </div>
            </div>

            <div class="section-title">Spending Breakdown by Member</div>
            <div class="chart-container">
                <div style="flex:1;">
                    ${pieSvg}
                </div>
                <div style="flex:1; padding-left:20px;">
                    ${legendHtml}
                </div>
            </div>

            <div class="section-title">Individual Balances & Shares</div>
            <table>
                <thead>
                    <tr>
                        <th>Member</th>
                        <th style="text-align:right;">Spent</th>
                        <th style="text-align:right;">Fair Share</th>
                        <th style="text-align:right;">Net Status</th>
                    </tr>
                </thead>
                <tbody>
                    ${balanceRowsHtml}
                </tbody>
            </table>

            <div class="section-title">Settlement Plan</div>
            ${settlementHtml}

            <div class="section-title">All Group Expenses</div>
            <table>
                <thead>
                    <tr>
                        <th>Date</th>
                        <th>Title</th>
                        <th>Paid By</th>
                        <th style="text-align:right;">Amount</th>
                    </tr>
                </thead>
                <tbody>
                    ${expenses.length > 0 ? expenseRowsHtml : '<tr><td colspan="4" style="text-align:center; padding:16px; color:#9CA3AF;">No expenses recorded yet</td></tr>'}
                </tbody>
            </table>

            <div class="footer">
                Report generated automatically by ExpenseTracker • All monetary values are in INR (₹)
            </div>
        </body>
        </html>
    `;
};

