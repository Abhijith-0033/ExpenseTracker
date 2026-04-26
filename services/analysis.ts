import { getDatabase, initDatabase } from './database';
import { startOfMonth, endOfMonth, format, startOfDay, endOfDay } from 'date-fns';

export interface CategoryTotal {
    category: string;
    total: number;
}

export interface SubcategoryTotal {
    subcategory: string;
    total: number;
}

export interface DailySpending {
    date: string;
    total: number;
}

export interface ExpenseDistribution {
    range: string;
    count: number;
    min: number;
    max: number;
}

const ensureDb = async () => {
    const db = getDatabase();
    if (!db) {
        await initDatabase();
        return getDatabase();
    }
    return db;
};

export type DateFilter = Date | { start: Date, end: Date } | undefined;

export const getCategoryTotals = async (month?: DateFilter): Promise<CategoryTotal[]> => {
    const db = await ensureDb();
    let query = `SELECT category, SUM(amount) as total FROM transactions WHERE category != 'Income' AND category != 'Transfer'`;
    const params: any[] = [];

    if (month) {
        let start, end;
        if (month instanceof Date) {
            start = startOfMonth(month).toISOString();
            end = endOfMonth(month).toISOString();
        } else {
            start = startOfDay(month.start).toISOString();
            end = endOfDay(month.end).toISOString();
        }
        query += ` AND date >= ? AND date <= ?`;
        params.push(start, end);
    }

    query += ` GROUP BY category ORDER BY total DESC`;

    return await db.getAllAsync<CategoryTotal>(query, params);
};

export const getSubcategoryTotals = async (category: string, month?: Date): Promise<SubcategoryTotal[]> => {
    const db = await ensureDb();
    let query = `SELECT subcategory, SUM(amount) as total FROM transactions WHERE category = ?`;
    const params: any[] = [category];

    if (month) {
        const start = startOfMonth(month).toISOString();
        const end = endOfMonth(month).toISOString();
        query += ` AND date >= ? AND date <= ?`;
        params.push(start, end);
    }

    query += ` GROUP BY subcategory ORDER BY total DESC`;

    return await db.getAllAsync<SubcategoryTotal>(query, params);
};

export const getDailySpendingTrend = async (month: Date): Promise<DailySpending[]> => {
    const db = await ensureDb();
    const start = startOfMonth(month).toISOString();
    const end = endOfMonth(month).toISOString();

    // SQLite substr to get YYYY-MM-DD from ISO string
    const query = `
        SELECT substr(date, 1, 10) as date, SUM(amount) as total 
        FROM transactions 
        WHERE category != 'Income' AND date >= ? AND date <= ?
        GROUP BY substr(date, 1, 10)
        ORDER BY date ASC
    `;

    return await db.getAllAsync<DailySpending>(query, [start, end]);
};

export const getWeeklySpendingTrend = async (month: Date): Promise<{ week: string, total: number }[]> => {
    // Reusing the safe daily query and aggregating in JS to avoid platform-specific SQLite date function issues
    const db = await ensureDb();
    const start = startOfMonth(month).toISOString();
    const end = endOfMonth(month).toISOString();

    const query = `
        SELECT substr(date, 1, 10) as date, SUM(amount) as total 
        FROM transactions 
        WHERE category != 'Income' AND date >= ? AND date <= ?
        GROUP BY substr(date, 1, 10)
        ORDER BY date ASC
    `;

    const dailyData = await db.getAllAsync<DailySpending>(query, [start, end]);

    // Aggregate by week (Simple 7-day blocks relative to start of month for "Week 1, Week 2...")
    const weeklyMap = new Map<string, number>();

    dailyData.forEach(day => {
        const dayOfMonth = parseInt(day.date.substring(8, 10), 10);
        const weekNum = Math.ceil(dayOfMonth / 7);
        // Handle edge case: 5th week usually has few days.
        const weekLabel = `W${weekNum}`;
        const currentTotal = weeklyMap.get(weekLabel) || 0;
        weeklyMap.set(weekLabel, currentTotal + day.total);
    });

    // Ensure we have entries for weeks that might have 0 expense if we want continuous?
    // User requirement: "Week 1, Week 2... "
    // Let's just return what we have, sorted.
    const result: { week: string, total: number }[] = [];
    // Assuming max 5 weeks
    for (let i = 1; i <= 5; i++) {
        const label = `W${i}`;
        if (weeklyMap.has(label)) {
            result.push({ week: label, total: weeklyMap.get(label)! });
        } else if (i <= 4) {
            // Optional: Fill gaps with 0? "Graph specs: X-axis Week labels".
            // It looks better if we fill gaps.
            result.push({ week: label, total: 0 });
        }
    }

    // Filter out Week 5 if empty and it's a short month or just no spend?
    // Actually, simple sorting of map entries is enough, but filling gaps is nicer.
    // Let's stick to the map keys to be safe and accurate to data.

    return result.filter(r => r.total > 0 || r.week !== 'W5');
};

export const getMonthlySpendingTrend = async (year: number): Promise<{ month: string, total: number }[]> => {
    const db = await ensureDb();
    const start = `${year}-01-01`;
    const end = `${year}-12-31`;

    const query = `
        SELECT substr(date, 1, 7) as month, SUM(amount) as total
        FROM transactions
        WHERE category != 'Income' AND date >= ? AND date <= ?
        GROUP BY substr(date, 1, 7)
        ORDER BY month ASC
    `;

    // Note: This returns YYYY-MM
    return await db.getAllAsync<{ month: string, total: number }>(query, [start, end]);
};

export const getExpenseDistribution = async (month?: DateFilter): Promise<ExpenseDistribution[]> => {
    const db = await ensureDb();
    let query = `SELECT amount FROM transactions WHERE category != 'Income' AND category != 'Transfer'`;
    const params: any[] = [];

    if (month) {
        let start, end;
        if (month instanceof Date) {
            start = startOfMonth(month).toISOString();
            end = endOfMonth(month).toISOString();
        } else {
            start = startOfDay(month.start).toISOString();
            end = endOfDay(month.end).toISOString();
        }
        query += ` AND date >= ? AND date <= ?`;
        params.push(start, end);
    }

    const transactions = await db.getAllAsync<{ amount: number }>(query, params);

    // Bucketing logic (done in JS as SQLite doesn't have easy width_bucket without extensions)
    if (transactions.length === 0) return [];

    const amounts = transactions.map(t => t.amount);
    const max = Math.max(...amounts);
    const min = Math.min(...amounts);
    const bucketCount = 5;
    const range = (max - min) || 1; // avoid division by zero
    const step = range / bucketCount;

    const distribution: ExpenseDistribution[] = [];

    for (let i = 0; i < bucketCount; i++) {
        const bucketMin = min + (i * step);
        const bucketMax = min + ((i + 1) * step);
        const count = amounts.filter(a => a >= bucketMin && (i === bucketCount - 1 ? a <= bucketMax : a < bucketMax)).length;

        distribution.push({
            range: `${Math.floor(bucketMin)} - ${Math.floor(bucketMax)}`,
            min: Math.floor(bucketMin),
            max: Math.floor(bucketMax),
            count
        });
    }

    return distribution;
};

export interface MonthlyCategoryTotal {
    month: string;
    category: string;
    total: number;
}

export const getMonthlyCategoryTrend = async (year: number): Promise<MonthlyCategoryTotal[]> => {
    const db = await ensureDb();
    const start = `${year}-01-01`;
    const end = `${year}-12-31`;

    const query = `
        SELECT substr(date, 1, 7) as month, category, SUM(amount) as total
        FROM transactions
        WHERE category != 'Income' AND date >= ? AND date <= ?
        GROUP BY substr(date, 1, 7), category
        ORDER BY month ASC
    `;

    return await db.getAllAsync<MonthlyCategoryTotal>(query, [start, end]);
};

export const getMonthlyTrendInRange = async (startDate: Date, endDate: Date): Promise<{ month: string, total: number }[]> => {
    const db = await ensureDb();
    const start = startDate.toISOString().substr(0, 10);
    const end = endDate.toISOString().substr(0, 10);

    // Query groups by YYYY-MM
    const query = `
        SELECT substr(date, 1, 7) as month, SUM(amount) as total
        FROM transactions
        WHERE category != 'Income' AND date >= ? AND date <= ?
        GROUP BY substr(date, 1, 7)
        ORDER BY month ASC
    `;

    return await db.getAllAsync<{ month: string, total: number }>(query, [start, end]);
};

export interface MonthlyComparison {
    month: string;
    income: number;
    expense: number;
}

export const getMonthlyIncomeVsExpense = async (year: number): Promise<MonthlyComparison[]> => {
    const db = await ensureDb();
    const start = `${year}-01-01`;
    const end = `${year}-12-31`;

    const query = `
        SELECT date, amount, category 
        FROM transactions 
        WHERE date >= ? AND date <= ?
    `;
    const transactions = await db.getAllAsync<{ date: string, amount: number, category: string }>(query, [start, end]);

    const map = new Map<string, { income: number, expense: number }>();

    transactions.forEach(t => {
        const month = t.date.substring(0, 7);
        if (!map.has(month)) map.set(month, { income: 0, expense: 0 });

        const entry = map.get(month)!;
        if (t.category === 'Income') {
            entry.income += t.amount;
        } else {
            entry.expense += t.amount;
        }
    });

    const result: MonthlyComparison[] = [];
    for (let i = 1; i <= 12; i++) {
        const monthStr = `${year}-${i.toString().padStart(2, '0')}`;
        const data = map.get(monthStr) || { income: 0, expense: 0 };
        result.push({
            month: monthStr,
            income: data.income,
            expense: data.expense
        });
    }

    return result;
};

export const getDailyIncomeExpense = async (date: Date): Promise<{ income: number, expense: number }> => {
    const db = await ensureDb();
    const start = startOfDay(date).toISOString();
    const end = endOfDay(date).toISOString();

    const query = `
        SELECT category, SUM(amount) as total
        FROM transactions
        WHERE date >= ? AND date <= ? AND category != 'Transfer'
        GROUP BY CASE WHEN category = 'Income' THEN 'income' ELSE 'expense' END
    `;
    const results = await db.getAllAsync<{ category: string, total: number }>(query, [start, end]);
    let income = 0;
    let expense = 0;
    // Note: The GROUP BY produces 'Income' vs original categories, but actually we grouped by the CASE result.
    // However, SQLite might return the original category column if we select it. 
    // To be safe, let's just do a simpler approach or sum manually from the transactions for accuracy without complex CASE.
    
    const safeQuery = `
        SELECT amount, category FROM transactions
        WHERE date >= ? AND date <= ? AND category != 'Transfer'
    `;
    const safeResults = await db.getAllAsync<{ amount: number, category: string }>(safeQuery, [start, end]);
    safeResults.forEach(r => {
        if (r.category === 'Income') income += r.amount;
        else expense += r.amount;
    });
    return { income, expense };
};

export const getWeeklyIncomeExpense = async (date: Date): Promise<{ income: number, expense: number }> => {
    const db = await ensureDb();
    // Monday to Sunday logic
    const dt = new Date(date);
    const day = dt.getDay();
    const diff = dt.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
    const monday = new Date(dt.setDate(diff));
    const sunday = new Date(dt.setDate(diff + 6));
    
    const start = startOfDay(monday).toISOString();
    const end = endOfDay(sunday).toISOString();

    const safeQuery = `
        SELECT amount, category FROM transactions
        WHERE date >= ? AND date <= ? AND category != 'Transfer'
    `;
    const safeResults = await db.getAllAsync<{ amount: number, category: string }>(safeQuery, [start, end]);
    let income = 0;
    let expense = 0;
    safeResults.forEach(r => {
        if (r.category === 'Income') income += r.amount;
        else expense += r.amount;
    });
    return { income, expense };
};

export const getMonthlyIncomeExpense = async (date: Date): Promise<{ income: number, expense: number }> => {
    const db = await ensureDb();
    const start = startOfMonth(date).toISOString();
    const end = endOfMonth(date).toISOString();

    const safeQuery = `
        SELECT amount, category FROM transactions
        WHERE date >= ? AND date <= ? AND category != 'Transfer'
    `;
    const safeResults = await db.getAllAsync<{ amount: number, category: string }>(safeQuery, [start, end]);
    let income = 0;
    let expense = 0;
    safeResults.forEach(r => {
        if (r.category === 'Income') income += r.amount;
        else expense += r.amount;
    });
    return { income, expense };
};

export const getYearlyIncomeExpense = async (year: number): Promise<{ income: number, expense: number }> => {
    const db = await ensureDb();
    const start = `${year}-01-01T00:00:00.000Z`;
    const end = `${year}-12-31T23:59:59.999Z`;

    const safeQuery = `
        SELECT amount, category FROM transactions
        WHERE date >= ? AND date <= ? AND category != 'Transfer'
    `;
    const safeResults = await db.getAllAsync<{ amount: number, category: string }>(safeQuery, [start, end]);
    let income = 0;
    let expense = 0;
    safeResults.forEach(r => {
        if (r.category === 'Income') income += r.amount;
        else expense += r.amount;
    });
    return { income, expense };
};
