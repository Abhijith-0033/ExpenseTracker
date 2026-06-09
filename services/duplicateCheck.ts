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

export interface SmartSuggestion {
    category: string;
    subcategory: string;
    accountId: number;
    accountName: string;
}

export async function getSmartSuggestions(
    amount: number
): Promise<SmartSuggestion[]> {
    const db = await ensureDb();
    if (!db) return [];

    const query = `
        SELECT t.category, t.subcategory, t.account_id, a.name as accountName
        FROM transactions t
        LEFT JOIN accounts a ON t.account_id = a.id
        WHERE t.amount = ? AND t.category != 'Transfer' AND t.category != 'Income'
        ORDER BY t.created_at DESC
        LIMIT 10
    `;

    try {
        const rows = await db.getAllAsync<{ category: string; subcategory: string; account_id: number; accountName: string }>(query, [amount]);
        
        // Deduplicate suggestions by category + subcategory + account_id
        const seen = new Set<string>();
        const suggestions: SmartSuggestion[] = [];
        for (const row of rows) {
            const key = `${row.category}|${row.subcategory}|${row.account_id}`;
            if (!seen.has(key)) {
                seen.add(key);
                suggestions.push({
                    category: row.category,
                    subcategory: row.subcategory,
                    accountId: row.account_id,
                    accountName: row.accountName || 'Unknown Account'
                });
            }
            if (suggestions.length >= 3) break;
        }
        return suggestions;
    } catch (e) {
        console.error("Failed to fetch smart suggestions:", e);
        return [];
    }
}

export async function getLastUsedForCategory(
    category: string
): Promise<{ subcategory: string; accountId: number; accountName: string } | null> {
    const db = await ensureDb();
    if (!db) return null;

    const query = `
        SELECT t.subcategory, t.account_id, a.name as accountName
        FROM transactions t
        LEFT JOIN accounts a ON t.account_id = a.id
        WHERE t.category = ?
        ORDER BY t.created_at DESC
        LIMIT 1
    `;

    try {
        const row = await db.getFirstAsync<{ subcategory: string; account_id: number; accountName: string }>(query, [category]);
        if (row) {
            return {
                subcategory: row.subcategory,
                accountId: row.account_id,
                accountName: row.accountName || 'Unknown Account'
            };
        }
        return null;
    } catch (e) {
        console.error("Failed to fetch last used for category:", e);
        return null;
    }
}
