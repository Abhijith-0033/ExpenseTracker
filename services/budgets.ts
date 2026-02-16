import { getDatabase, initDatabase } from './database';
import { getCategoryTotals } from './analysis';

export interface Budget {
    id: number;
    category: string;
    amount: number;
    month: string; // YYYY-MM
    created_at: number;
}

export interface BudgetStatus {
    category: string;
    budget: number;
    spent: number;
    remaining: number;
    percentage: number;
}

const ensureDb = async () => {
    const db = getDatabase();
    if (!db) {
        await initDatabase();
        return getDatabase();
    }
    return db;
};

export const setBudget = async (category: string, amount: number, month: string) => {
    const db = await ensureDb();
    const timestamp = Date.now();

    // Upsert logic (insert or replace)
    await db.runAsync(
        `INSERT OR REPLACE INTO category_budgets (category, amount, month, created_at) VALUES (?, ?, ?, ?)`,
        [category, amount, month, timestamp]
    );
};

export const getBudgets = async (month: string): Promise<Budget[]> => {
    const db = await ensureDb();
    return await db.getAllAsync<Budget>(
        `SELECT * FROM category_budgets WHERE month = ?`,
        [month]
    );
};

export const deleteBudget = async (id: number) => {
    const db = await ensureDb();
    await db.runAsync(`DELETE FROM category_budgets WHERE id = ?`, [id]);
};

export const getBudgetStatus = async (month: Date): Promise<BudgetStatus[]> => {
    const monthStr = month.toISOString().slice(0, 7); // YYYY-MM

    const [budgets, expenses] = await Promise.all([
        getBudgets(monthStr),
        getCategoryTotals(month)
    ]);

    // Map expenses for quick lookup
    const expenseMap = new Map<string, number>();
    expenses.forEach(e => expenseMap.set(e.category, e.total));

    // Combine budget and expenses
    // We only care about categories that hav a budget set, as per requirements
    // "If Budget = 0 -> treat as no budget set" implies we list items with budgets.

    return budgets.map(b => {
        const spent = expenseMap.get(b.category) || 0;
        const remaining = b.amount - spent;
        const percentage = b.amount > 0 ? (spent / b.amount) * 100 : 0;

        return {
            category: b.category,
            budget: b.amount,
            spent,
            remaining,
            percentage
        };
    });
};
