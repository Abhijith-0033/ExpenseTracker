import { getDatabase, initDatabase, Transaction } from './database';

const ensureDb = async () => {
    const db = getDatabase();
    if (!db) {
        await initDatabase();
        return getDatabase();
    }
    return db;
};

export async function checkDuplicate(
    amount: number, 
    category: string, 
    dateISO: string, 
    type: 'expense' | 'income',
    excludeId?: number
): Promise<Transaction | null> {
    const db = await ensureDb();
    if (!db) return null;

    // We only check duplicates for identical amount, category, and same day
    // Created within the last 5 minutes
    const fiveMinsAgo = Date.now() - 5 * 60 * 1000;
    const datePrefix = dateISO.substring(0, 10);

    let query = `
        SELECT * FROM transactions 
        WHERE amount = ? 
        AND category = ? 
        AND substr(date, 1, 10) = ? 
        AND created_at >= ?
    `;
    const params: any[] = [amount, category, datePrefix, fiveMinsAgo];

    if (excludeId) {
        query += ` AND id != ?`;
        params.push(excludeId);
    }

    query += ` ORDER BY created_at DESC LIMIT 1`;

    try {
        const result = await db.getFirstAsync<Transaction>(query, params);
        return result || null;
    } catch (e) {
        console.error("Duplicate check failed:", e);
        return null;
    }
}
