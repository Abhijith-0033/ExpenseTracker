import { getDatabase, initDatabase, Transaction } from './database';

const ensureDb = async () => {
    const db = getDatabase();
    if (!db) {
        await initDatabase();
        return getDatabase();
    }
    return db;
};

export async function getIncomeBySource(startDate: Date, endDate: Date) {
    const db = await ensureDb();
    if (!db) return [];

    const query = `
        SELECT subcategory as source, SUM(amount) as total 
        FROM transactions 
        WHERE category = 'Income' AND date BETWEEN ? AND ?
        GROUP BY subcategory
        ORDER BY total DESC
    `;
    try {
        return await db.getAllAsync<{ source: string, total: number }>(query, [startDate.toISOString(), endDate.toISOString()]);
    } catch (e) {
        console.error("Failed to get income by source", e);
        return [];
    }
}

export async function getIncomeMonthlyTrend(startDate: Date, endDate: Date) {
    const db = await ensureDb();
    if (!db) return [];

    const query = `
        SELECT substr(date, 1, 7) as month, SUM(amount) as total 
        FROM transactions 
        WHERE category = 'Income' AND date BETWEEN ? AND ?
        GROUP BY month
        ORDER BY month ASC
    `;
    try {
        return await db.getAllAsync<{ month: string, total: number }>(query, [startDate.toISOString(), endDate.toISOString()]);
    } catch (e) {
        console.error("Failed to get income monthly trend", e);
        return [];
    }
}

export async function getIncomeTransactions(source: string | null, startDate: Date, endDate: Date): Promise<Transaction[]> {
    const db = await ensureDb();
    if (!db) return [];

    let query = `SELECT * FROM transactions WHERE category = 'Income' AND date BETWEEN ? AND ?`;
    let params: any[] = [startDate.toISOString(), endDate.toISOString()];

    if (source) {
        query += ` AND subcategory = ?`;
        params.push(source);
    }

    query += ` ORDER BY date DESC`;

    try {
        return await db.getAllAsync<Transaction>(query, params);
    } catch (e) {
        console.error("Failed to get income transactions", e);
        return [];
    }
}
