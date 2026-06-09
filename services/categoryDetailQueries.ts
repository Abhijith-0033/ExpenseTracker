import { getDatabase, initDatabase, Transaction } from './database';
import { _startOfMonth, format } from 'date-fns';

const ensureDb = async () => {
    const db = getDatabase();
    if (!db) {
        await initDatabase();
        return getDatabase();
    }
    return db;
};

export async function getCategoryTransactions(category: string, startDate: Date, endDate: Date): Promise<Transaction[]> {
    const db = await ensureDb();
    if (!db) return [];

    let query = `SELECT * FROM transactions WHERE category = ? AND date BETWEEN ? AND ? ORDER BY date DESC`;
    try {
        return await db.getAllAsync<Transaction>(query, [category, startDate.toISOString(), endDate.toISOString()]);
    } catch (e) {
        console.error("Failed to get category transactions", e);
        return [];
    }
}

// Returns monthly totals for a given category in the given date range (e.g. last 6 months)
export async function getCategoryMonthlyTotals(category: string, startDate: Date, endDate: Date) {
    const db = await ensureDb();
    if (!db) return [];

    let query = `
        SELECT substr(date, 1, 7) as month, SUM(amount) as total 
        FROM transactions 
        WHERE category = ? AND date BETWEEN ? AND ?
        GROUP BY month
        ORDER BY month ASC
    `;
    try {
        return await db.getAllAsync<{ month: string, total: number }>(query, [category, startDate.toISOString(), endDate.toISOString()]);
    } catch (e) {
        console.error("Failed to get category monthly totals", e);
        return [];
    }
}

// Returns aggregate statistics for a category
export async function getCategoryStats(category: string) {
    const db = await ensureDb();
    if (!db) {
        return { totalAllTime: 0, totalThisMonth: 0, monthlyAvg: 0, highestMonth: { month: '', total: 0 }, avgPerTx: 0, freqThisMonth: 0 };
    }

    const thisMonthPrefix = format(new Date(), 'yyyy-MM');

    try {
        // All time stats
        const allTimeQuery = `SELECT SUM(amount) as total, COUNT(*) as count FROM transactions WHERE category = ?`;
        const allTimeRes = await db.getFirstAsync<{ total: number, count: number }>(allTimeQuery, [category]);
        const totalAllTime = allTimeRes?.total || 0;
        const countAllTime = allTimeRes?.count || 0;
        const avgPerTx = countAllTime > 0 ? totalAllTime / countAllTime : 0;

        // This month stats
        const thisMonthQuery = `SELECT SUM(amount) as total, COUNT(*) as count FROM transactions WHERE category = ? AND substr(date, 1, 7) = ?`;
        const thisMonthRes = await db.getFirstAsync<{ total: number, count: number }>(thisMonthQuery, [category, thisMonthPrefix]);
        const totalThisMonth = thisMonthRes?.total || 0;
        const freqThisMonth = thisMonthRes?.count || 0;

        // Monthly grouping for Avg and Highest
        const monthlyQuery = `
            SELECT substr(date, 1, 7) as month, SUM(amount) as total 
            FROM transactions 
            WHERE category = ? 
            GROUP BY month
        `;
        const monthlyData = await db.getAllAsync<{ month: string, total: number }>(monthlyQuery, [category]);
        
        let highestMonth = { month: '', total: 0 };
        let sumMonths = 0;
        
        monthlyData.forEach(row => {
            sumMonths += row.total;
            if (row.total > highestMonth.total) {
                highestMonth = row;
            }
        });

        const monthlyAvg = monthlyData.length > 0 ? sumMonths / monthlyData.length : 0;

        return {
            totalAllTime,
            totalThisMonth,
            monthlyAvg,
            highestMonth,
            avgPerTx,
            freqThisMonth
        };
    } catch (e) {
        console.error("Failed to get category stats", e);
        return { totalAllTime: 0, totalThisMonth: 0, monthlyAvg: 0, highestMonth: { month: '', total: 0 }, avgPerTx: 0, freqThisMonth: 0 };
    }
}

export async function getSubcategoryBreakdown(category: string) {
    const db = await ensureDb();
    if (!db) return [];

    const thisMonthPrefix = format(new Date(), 'yyyy-MM');

    const query = `
        SELECT 
            subcategory as name, 
            SUM(amount) as grandTotal,
            SUM(CASE WHEN substr(date, 1, 7) = ? THEN amount ELSE 0 END) as monthlyTotal
        FROM transactions 
        WHERE category = ?
        GROUP BY subcategory
        ORDER BY grandTotal DESC
    `;
    
    try {
        return await db.getAllAsync<{ name: string, grandTotal: number, monthlyTotal: number }>(query, [thisMonthPrefix, category]);
    } catch (e) {
        console.error("Failed to get subcategory breakdown", e);
        return [];
    }
}

