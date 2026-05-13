import { initDatabase, getDatabase } from '../database';
import { DebtRecord, DebtRepayment } from './DebtEngine';

// --- DEBT RECORDS ---

export const getDebtRecords = async (status?: DebtRecord['status'], direction?: DebtRecord['direction']): Promise<DebtRecord[]> => {
  await initDatabase();
  const db = getDatabase();
  
  let query = 'SELECT * FROM debt_records';
  const params: any[] = [];
  
  if (status || direction) {
    const conditions: string[] = [];
    if (status) {
      conditions.push('status = ?');
      params.push(status);
    }
    if (direction) {
      conditions.push('direction = ?');
      params.push(direction);
    }
    query += ' WHERE ' + conditions.join(' AND ');
  }
  
  query += ' ORDER BY created_at DESC';
  
  return await db.getAllAsync<DebtRecord>(query, params);
};

export const getDebtRecordById = async (id: number): Promise<DebtRecord | null> => {
  await initDatabase();
  const db = getDatabase();
  return await db.getFirstAsync<DebtRecord>('SELECT * FROM debt_records WHERE id = ?', [id]);
};

export const addDebtRecord = async (debt: Omit<DebtRecord, 'id' | 'created_at' | 'updated_at'>): Promise<number> => {
  await initDatabase();
  const db = getDatabase();
  
  const now = new Date().toISOString();
  
  const result = await db.runAsync(`
    INSERT INTO debt_records (
      name, description, principal, interest_rate, interest_type, 
      repayment_freq, custom_freq_days, start_date, expected_end_date, 
      status, direction, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    debt.name,
    debt.description || null,
    debt.principal,
    debt.interest_rate,
    debt.interest_type,
    debt.repayment_freq,
    debt.custom_freq_days || null,
    debt.start_date,
    debt.expected_end_date || null,
    debt.status,
    debt.direction,
    now,
    now
  ]);
  
  return result.lastInsertRowId;
};

export const updateDebtRecord = async (id: number, debt: Partial<Omit<DebtRecord, 'id' | 'created_at' | 'updated_at'>>): Promise<void> => {
  await initDatabase();
  const db = getDatabase();
  
  const now = new Date().toISOString();
  const fields: string[] = [];
  const params: any[] = [];
  
  // Build dynamic update query
  Object.entries(debt).forEach(([key, value]) => {
    if (value !== undefined) {
      fields.push(`${key} = ?`);
      params.push(value);
    }
  });
  
  if (fields.length === 0) return;
  
  fields.push('updated_at = ?');
  params.push(now);
  params.push(id);
  
  await db.runAsync(`UPDATE debt_records SET ${fields.join(', ')} WHERE id = ?`, params);
};

export const deleteDebtRecord = async (id: number): Promise<void> => {
  await initDatabase();
  const db = getDatabase();
  
  // This will cascade delete the repayments due to foreign key constraint
  await db.runAsync('DELETE FROM debt_records WHERE id = ?', [id]);
};

export const markDebtAsCompleted = async (id: number): Promise<void> => {
  await updateDebtRecord(id, { status: 'completed' });
};

// --- DEBT REPAYMENTS ---

export const getDebtRepayments = async (debtId: number): Promise<DebtRepayment[]> => {
  await initDatabase();
  const db = getDatabase();
  
  return await db.getAllAsync<DebtRepayment>(
    'SELECT * FROM debt_repayments WHERE debt_id = ? ORDER BY payment_date DESC',
    [debtId]
  );
};

export const addDebtRepayment = async (repayment: Omit<DebtRepayment, 'id' | 'created_at'>): Promise<number> => {
  await initDatabase();
  const db = getDatabase();
  
  const now = new Date().toISOString();
  
  const result = await db.runAsync(`
    INSERT INTO debt_repayments (debt_id, amount, payment_date, payment_type, note, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `, [
    repayment.debt_id,
    repayment.amount,
    repayment.payment_date,
    repayment.payment_type,
    repayment.note || null,
    now
  ]);
  
  return result.lastInsertRowId;
};

export const updateDebtRepayment = async (id: number, repayment: Partial<Omit<DebtRepayment, 'id' | 'created_at'>>): Promise<void> => {
  await initDatabase();
  const db = getDatabase();
  
  const fields: string[] = [];
  const params: any[] = [];
  
  Object.entries(repayment).forEach(([key, value]) => {
    if (value !== undefined) {
      fields.push(`${key} = ?`);
      params.push(value);
    }
  });
  
  if (fields.length === 0) return;
  
  params.push(id);
  
  await db.runAsync(`UPDATE debt_repayments SET ${fields.join(', ')} WHERE id = ?`, params);
};

export const deleteDebtRepayment = async (id: number): Promise<void> => {
  await initDatabase();
  const db = getDatabase();
  
  await db.runAsync('DELETE FROM debt_repayments WHERE id = ?', [id]);
};

// --- DEBT SUMMARY ---

export const getDebtSummary = async () => {
  await initDatabase();
  const db = getDatabase();
  
  const debts = await getDebtRecords('active');
  const summary = {
    totalOwed: 0,
    totalOwedToMe: 0,
    overdueCount: 0,
    activeBorrowedCount: 0,
    activeLentCount: 0
  };
  
  for (const debt of debts) {
    const repayments = await getDebtRepayments(debt.id);
    
    // Simple balance calculation for summary
    const totalRepaid = repayments.reduce((sum, r) => sum + r.amount, 0);
    const currentBalance = debt.principal - totalRepaid;
    
    if (debt.direction === 'borrowed') {
      summary.totalOwed += Math.max(0, currentBalance);
      summary.activeBorrowedCount++;
    } else {
      summary.totalOwedToMe += Math.max(0, currentBalance);
      summary.activeLentCount++;
    }
    
    // Check if overdue (simplified check - would need full calculation in real implementation)
    const lastPayment = repayments[0];
    if (lastPayment && debt.repayment_freq === 'monthly') {
      const lastPaymentDate = new Date(lastPayment.payment_date);
      const nextDueDate = new Date(lastPaymentDate);
      nextDueDate.setMonth(nextDueDate.getMonth() + 1);
      
      if (nextDueDate < new Date()) {
        summary.overdueCount++;
      }
    }
  }
  
  return summary;
};
