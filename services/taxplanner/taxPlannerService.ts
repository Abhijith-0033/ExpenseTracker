import { initDatabase, getDatabase } from '../database';
import { TaxProfile, TaxDeduction } from './TaxEngine';

const ensureDb = async () => {
  await initDatabase();
  return getDatabase();
};

export const getCurrentFY = (): string => {
  const now = new Date();
  const year = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1; // FY starts April
  return `${year}-${String(year + 1).slice(2)}`;
};

export const getTaxProfile = async (fy: string): Promise<TaxProfile | null> => {
  const db = await ensureDb();
  const result = await db.getFirstAsync<TaxProfile>('SELECT * FROM tax_profile WHERE financial_year = ?', [fy]);
  return result || null;
};

export const saveTaxProfile = async (profile: Omit<TaxProfile, 'id'>): Promise<void> => {
  const db = await ensureDb();
  const existing = await db.getFirstAsync<{ id: number }>('SELECT id FROM tax_profile WHERE financial_year = ?', [profile.financial_year]);
  if (existing) {
    await db.runAsync(
      `UPDATE tax_profile SET annual_income=?, is_salaried=?, tax_regime=?, age_category=?,
       hra_received=?, rent_paid=?, is_metro_city=?, basic_salary=?, updated_at=datetime('now')
       WHERE financial_year=?`,
      [profile.annual_income, profile.is_salaried, profile.tax_regime, profile.age_category,
       profile.hra_received, profile.rent_paid, profile.is_metro_city, profile.basic_salary, profile.financial_year]
    );
  } else {
    await db.runAsync(
      `INSERT INTO tax_profile (financial_year, annual_income, is_salaried, tax_regime, age_category,
       hra_received, rent_paid, is_metro_city, basic_salary) VALUES (?,?,?,?,?,?,?,?,?)`,
      [profile.financial_year, profile.annual_income, profile.is_salaried, profile.tax_regime,
       profile.age_category, profile.hra_received, profile.rent_paid, profile.is_metro_city, profile.basic_salary]
    );
  }
};

export const getTaxDeductions = async (fy: string): Promise<TaxDeduction[]> => {
  const db = await ensureDb();
  return await db.getAllAsync<TaxDeduction>('SELECT * FROM tax_deductions WHERE financial_year = ? ORDER BY date_invested DESC', [fy]);
};

export const addTaxDeduction = async (deduction: Omit<TaxDeduction, 'id'>): Promise<void> => {
  const db = await ensureDb();
  await db.runAsync(
    `INSERT INTO tax_deductions (financial_year, section, instrument_type, amount, date_invested, notes, linked_transaction_id)
     VALUES (?,?,?,?,?,?,?)`,
    [deduction.financial_year, deduction.section, deduction.instrument_type || null, deduction.amount,
     deduction.date_invested, deduction.notes || null, deduction.linked_transaction_id || null]
  );
};

export const updateTaxDeduction = async (id: number, deduction: Partial<TaxDeduction>): Promise<void> => {
  const db = await ensureDb();
  const fields = Object.keys(deduction).filter(k => k !== 'id').map(k => `${k} = ?`).join(', ');
  const values = [...Object.entries(deduction).filter(([k]) => k !== 'id').map(([,v]) => v), id];
  await db.runAsync(`UPDATE tax_deductions SET ${fields} WHERE id = ?`, values);
};

export const deleteTaxDeduction = async (id: number): Promise<void> => {
  const db = await ensureDb();
  await db.runAsync('DELETE FROM tax_deductions WHERE id = ?', [id]);
};
