import { getDatabase, initDatabase, Transaction } from './database';
import { format, subDays } from 'date-fns';

const ensureDb = async () => {
    const db = getDatabase();
    if (!db) {
        await initDatabase();
        return getDatabase();
    }
    return db;
};

export async function getAccountIncomeExpense(accountId: number | null, startDate: Date, endDate: Date) {
    const db = await ensureDb();
    if (!db) return { income: 0, expense: 0 };

    const startISO = startDate.toISOString();
    const endISO = endDate.toISOString();

    let incomeQuery = `SELECT SUM(amount) as total FROM transactions WHERE category = 'Income' AND date BETWEEN ? AND ?`;
    let expenseQuery = `SELECT SUM(amount) as total FROM transactions WHERE category != 'Income' AND category != 'Transfer' AND category != 'Debt/Credit' AND date BETWEEN ? AND ?`;
    
    let incomeParams: any[] = [startISO, endISO];
    let expenseParams: any[] = [startISO, endISO];

    if (accountId !== null) {
        incomeQuery += ` AND account_id = ?`;
        expenseQuery += ` AND account_id = ?`;
        incomeParams.push(accountId);
        expenseParams.push(accountId);
    }

    const [incomeRes, expenseRes] = await Promise.all([
        db.getFirstAsync<{total: number}>(incomeQuery, incomeParams),
        db.getFirstAsync<{total: number}>(expenseQuery, expenseParams)
    ]);

    return {
        income: incomeRes?.total || 0,
        expense: expenseRes?.total || 0
    };
}

export async function getAccountTransactions(accountId: number | null, startDate: Date, endDate: Date): Promise<Transaction[]> {
    const db = await ensureDb();
    if (!db) return [];

    const startISO = startDate.toISOString();
    const endISO = endDate.toISOString();

    let query = `SELECT * FROM transactions WHERE date BETWEEN ? AND ?`;
    let params: any[] = [startISO, endISO];

    if (accountId !== null) {
        query += ` AND account_id = ?`;
        params.push(accountId);
    }

    query += ` ORDER BY date DESC`;

    try {
        return await db.getAllAsync<Transaction>(query, params);
    } catch (e) {
        console.error("Failed to get account transactions", e);
        return [];
    }
}

// Computes a daily balance history curve for a given account.
export async function getAccountBalanceHistory(accountId: number | null, startDate: Date, endDate: Date) {
    const db = await ensureDb();
    if (!db) return [];

    // To compute accurate historical balance, we need the CURRENT balance of the account
    // and then we can roll backwards, or we can just chart the net change over the period.
    // For simplicity and chart scaling, let's chart the cumulative net flow over the period.
    // Daily net flow: Income - Expense - Transfer Out + Transfer In
    // But getting actual balance is tricky without knowing starting balance at `startDate`.
    // We will just do a cumulative net flow chart for the period.

    const transactions = await getAccountTransactions(accountId, startDate, endDate);
    
    // Group by date (YYYY-MM-DD)
    const grouped: Record<string, number> = {};
    
    // Initialize all days in range to 0
    let curr = new Date(startDate);
    while (curr <= endDate) {
        grouped[format(curr, 'yyyy-MM-dd')] = 0;
        curr = subDays(curr, -1); // add 1 day
    }

    transactions.forEach(tx => {
        const day = tx.date.substring(0, 10);
        if (grouped[day] !== undefined) {
            let flow = 0;
            if (tx.category === 'Income') flow = tx.amount;
            else if (tx.category !== 'Transfer' && tx.category !== 'Debt/Credit') flow = -tx.amount;
            // Note: Transfers are tricky without knowing from/to. 
            // If it's a transfer OUT of this account, it's negative.
            // But we don't have from/to linked in a single transaction in this schema (only account_id).
            // Usually, a transfer is recorded as 'Transfer' category on the account it left or entered.
            // Let's ignore transfers for the net flow chart to be safe, or just assume 'Transfer' with account_id means it left this account?
            // Wait, ExpenseTracker usually records Transfers as Expense on from_account and Income on to_account, 
            // but the category is just 'Transfer'. 
            // To be safe, we just chart Income vs Expense net flow.
            grouped[day] += flow;
        }
    });

    const sortedDays = Object.keys(grouped).sort();
    let cumulative = 0;
    const data = sortedDays.map(day => {
        cumulative += grouped[day];
        return {
            value: cumulative,
            label: format(new Date(day), 'dd MMM'),
            date: day,
            dailyNet: grouped[day]
        };
    });

    return data;
}
