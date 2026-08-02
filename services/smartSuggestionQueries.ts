import { initDatabase, getDatabase } from './database';

export interface RecentTx {
  id: number;
  amount: number;
  category: string;
  subcategory?: string;
  account_id: number;
  account_name?: string;
  description?: string;
}

export async function getRecentTransactions(limit = 5): Promise<RecentTx[]> {
  try {
    await initDatabase();
    const db = getDatabase();
    const rows = await db.getAllAsync<RecentTx>(
      `SELECT t.id, t.amount, t.category, t.subcategory, t.account_id, t.description, a.name as account_name
       FROM transactions t
       LEFT JOIN accounts a ON t.account_id = a.id
       WHERE t.type = 'expense' OR t.category NOT IN ('Income', 'Transfer')
       ORDER BY t.created_at DESC
       LIMIT ?`,
      [limit]
    );
    return rows || [];
  } catch (e) {
    console.warn('getRecentTransactions failed:', e);
    return [];
  }
}

export async function getTodayExpenseTotal(): Promise<number> {
  try {
    await initDatabase();
    const db = getDatabase();
    const today = new Date().toISOString().split('T')[0];
    const res = await db.getFirstAsync<{ total: number }>(
      `SELECT COALESCE(SUM(amount), 0) as total
       FROM transactions
       WHERE date = ? AND (type = 'expense' OR (type IS NULL AND category NOT IN ('Income', 'Transfer', 'Debt/Credit')))`,
      [today]
    );
    return res?.total || 0;
  } catch (e) {
    console.warn('getTodayExpenseTotal failed:', e);
    return 0;
  }
}

export async function getMonthIncomeTotal(): Promise<number> {
  try {
    await initDatabase();
    const db = getDatabase();
    const currentMonth = new Date().toISOString().substring(0, 7);
    const res = await db.getFirstAsync<{ total: number }>(
      `SELECT COALESCE(SUM(amount), 0) as total
       FROM transactions
       WHERE date LIKE ? AND (type = 'income' OR category = 'Income')`,
      [`${currentMonth}-%`]
    );
    return res?.total || 0;
  } catch (e) {
    console.warn('getMonthIncomeTotal failed:', e);
    return 0;
  }
}
