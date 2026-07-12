import { initDatabase, getDatabase } from '../database';
import { SinkingFund, SinkingFundContribution, calculateMonthlyContribution } from './SinkingFundEngine';

const ensureDb = async () => { await initDatabase(); return getDatabase(); };

export const getSinkingFunds = async (): Promise<SinkingFund[]> => {
  const db = await ensureDb();
  return await db.getAllAsync<SinkingFund>("SELECT * FROM sinking_funds WHERE status != 'completed' ORDER BY target_date ASC");
};

export const getAllSinkingFunds = async (): Promise<SinkingFund[]> => {
  const db = await ensureDb();
  return await db.getAllAsync<SinkingFund>('SELECT * FROM sinking_funds ORDER BY target_date ASC');
};

export const getSinkingFundById = async (id: number): Promise<SinkingFund | null> => {
  const db = await ensureDb();
  return await db.getFirstAsync<SinkingFund>('SELECT * FROM sinking_funds WHERE id = ?', [id]) || null;
};

export const addSinkingFund = async (fund: Omit<SinkingFund, 'id' | 'created_at' | 'updated_at'>): Promise<number> => {
  const db = await ensureDb();
  const monthly = calculateMonthlyContribution(fund.target_amount, fund.start_date, fund.target_date);
  const result = await db.runAsync(
    `INSERT INTO sinking_funds (name, target_amount, target_date, category_id, start_date, monthly_contribution, current_saved, linked_account_id, status, is_recurring_annual, notes)
     VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
    [fund.name, fund.target_amount, fund.target_date, fund.category_id || null, fund.start_date,
     monthly, 0, fund.linked_account_id || null, 'active', fund.is_recurring_annual || 0, fund.notes || null]
  );
  return result.lastInsertRowId;
};

export const updateSinkingFund = async (id: number, updates: Partial<SinkingFund>): Promise<void> => {
  const db = await ensureDb();
  const fields = Object.keys(updates).filter(k => k !== 'id').map(k => `${k} = ?`).join(', ');
  const values = [...Object.entries(updates).filter(([k]) => k !== 'id').map(([,v]) => v), id];
  await db.runAsync(`UPDATE sinking_funds SET ${fields}, updated_at = datetime('now') WHERE id = ?`, values);
};

export const deleteSinkingFund = async (id: number): Promise<void> => {
  const db = await ensureDb();
  await db.runAsync('DELETE FROM sinking_funds WHERE id = ?', [id]);
};

export const getFundContributions = async (fundId: number): Promise<SinkingFundContribution[]> => {
  const db = await ensureDb();
  return await db.getAllAsync<SinkingFundContribution>('SELECT * FROM sinking_fund_contributions WHERE fund_id = ? ORDER BY contribution_date DESC', [fundId]);
};

export const addContribution = async (contribution: Omit<SinkingFundContribution, 'id' | 'created_at'>): Promise<void> => {
  const db = await ensureDb();
  await db.runAsync(
    `INSERT INTO sinking_fund_contributions (fund_id, amount, contribution_date, account_id, transaction_id, notes) VALUES (?,?,?,?,?,?)`,
    [contribution.fund_id, contribution.amount, contribution.contribution_date,
     contribution.account_id || null, contribution.transaction_id || null, contribution.notes || null]
  );
  // Update current_saved on parent fund
  await db.runAsync('UPDATE sinking_funds SET current_saved = current_saved + ?, updated_at = datetime(\'now\') WHERE id = ?', [contribution.amount, contribution.fund_id]);
};

export const getTotalSaved = async (fundId: number): Promise<number> => {
  const db = await ensureDb();
  const result = await db.getFirstAsync<{ total: number }>('SELECT COALESCE(SUM(amount), 0) as total FROM sinking_fund_contributions WHERE fund_id = ?', [fundId]);
  return result?.total || 0;
};
