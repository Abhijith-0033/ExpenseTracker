import { getDatabase, initDatabase } from './database';
import { format, addMonths, subMonths, startOfMonth, endOfMonth } from 'date-fns';

export interface ForecastResult {
    nextMonthName: string;
    predictedTotal: number;
    topCategories: { category: string; predicted: number }[];
    confidence: string;
}

export const predictNextMonthExpenses = async (): Promise<ForecastResult> => {
    await initDatabase();
    const db = getDatabase();
    const now = new Date();
    
    // Get past 3 months dates
    const threeMonthsAgo = startOfMonth(subMonths(now, 3)).toISOString();
    const currentMonthEnd = endOfMonth(now).toISOString();

    // Query total expenses for the last 3 months
    const query = `
        SELECT substr(date, 1, 7) as month, SUM(amount) as total
        FROM transactions
        WHERE category != 'Income' AND category != 'Transfer' AND date >= ? AND date <= ?
        GROUP BY substr(date, 1, 7)
    `;
    const results = await db.getAllAsync<{ month: string, total: number }>(query, [threeMonthsAgo, currentMonthEnd]);

    // Calculate moving average
    let sum = 0;
    let count = 0;
    results.forEach(row => {
        sum += row.total;
        count++;
    });
    
    const predictedTotal = count > 0 ? sum / count : 0;
    const confidence = count >= 3 ? "High" : (count > 0 ? "Medium" : "Low");

    // Get top categories for the prediction
    const catQuery = `
        SELECT category, SUM(amount) / ? as predicted
        FROM transactions
        WHERE category != 'Income' AND category != 'Transfer' AND date >= ? AND date <= ?
        GROUP BY category
        ORDER BY predicted DESC
        LIMIT 3
    `;
    const monthsDivisor = Math.max(1, count);
    const topCategories = await db.getAllAsync<{ category: string, predicted: number }>(catQuery, [monthsDivisor, threeMonthsAgo, currentMonthEnd]);

    return {
        nextMonthName: format(addMonths(now, 1), 'MMMM'),
        predictedTotal,
        topCategories,
        confidence
    };
};
