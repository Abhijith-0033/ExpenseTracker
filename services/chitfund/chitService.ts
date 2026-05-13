import { initDatabase, getDatabase } from '../database';
import { ChitFund, ChitMonthlyRecord, ChitMember } from './ChitEngine';

// --- CHIT FUNDS ---

export const getChitFunds = async (status?: ChitFund['status']): Promise<ChitFund[]> => {
  await initDatabase();
  const db = getDatabase();
  
  let query = 'SELECT * FROM chit_funds';
  const params: any[] = [];
  
  if (status) {
    query += ' WHERE status = ?';
    params.push(status);
  }
  
  query += ' ORDER BY created_at DESC';
  
  return await db.getAllAsync<ChitFund>(query, params);
};

export const getChitFundById = async (id: number): Promise<ChitFund | null> => {
  await initDatabase();
  const db = getDatabase();
  return await db.getFirstAsync<ChitFund>('SELECT * FROM chit_funds WHERE id = ?', [id]);
};

export const addChitFund = async (chitFund: Omit<ChitFund, 'id' | 'created_at'>): Promise<number> => {
  await initDatabase();
  const db = getDatabase();
  
  const now = new Date().toISOString();
  
  const result = await db.runAsync(`
    INSERT INTO chit_funds (
      name, total_members, monthly_amount, total_pot, duration_months,
      start_date, foreman_commission, status, my_turn_month, notes, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    chitFund.name,
    chitFund.total_members,
    chitFund.monthly_amount,
    chitFund.total_pot,
    chitFund.duration_months,
    chitFund.start_date,
    chitFund.foreman_commission,
    chitFund.status,
    chitFund.my_turn_month,
    chitFund.notes || null,
    now
  ]);
  
  return result.lastInsertRowId;
};

export const updateChitFund = async (id: number, chitFund: Partial<Omit<ChitFund, 'id' | 'created_at'>>): Promise<void> => {
  await initDatabase();
  const db = getDatabase();
  
  const fields: string[] = [];
  const params: any[] = [];
  
  Object.entries(chitFund).forEach(([key, value]) => {
    if (value !== undefined) {
      fields.push(`${key} = ?`);
      params.push(value);
    }
  });
  
  if (fields.length === 0) return;
  
  params.push(id);
  
  await db.runAsync(`UPDATE chit_funds SET ${fields.join(', ')} WHERE id = ?`, params);
};

export const deleteChitFund = async (id: number): Promise<void> => {
  await initDatabase();
  const db = getDatabase();
  
  // This will cascade delete the monthly records and members due to foreign key constraints
  await db.runAsync('DELETE FROM chit_funds WHERE id = ?', [id]);
};

// --- CHIT MONTHLY RECORDS ---

export const getChitMonthlyRecords = async (chitId: number): Promise<ChitMonthlyRecord[]> => {
  await initDatabase();
  const db = getDatabase();
  
  return await db.getAllAsync<ChitMonthlyRecord>(
    'SELECT * FROM chit_monthly_records WHERE chit_id = ? ORDER BY month_number ASC',
    [chitId]
  );
};

export const addChitMonthlyRecord = async (record: Omit<ChitMonthlyRecord, 'id' | 'created_at'>): Promise<number> => {
  await initDatabase();
  const db = getDatabase();
  
  const now = new Date().toISOString();
  
  const result = await db.runAsync(`
    INSERT INTO chit_monthly_records (
      chit_id, month_number, month_date, amount_paid, payment_date,
      payment_status, winner_name, winner_is_me, bid_amount, pot_amount,
      commission_deducted, net_received, dividend_received, notes, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    record.chit_id,
    record.month_number,
    record.month_date,
    record.amount_paid || null,
    record.payment_date || null,
    record.payment_status,
    record.winner_name || null,
    record.winner_is_me,
    record.bid_amount || null,
    record.pot_amount || null,
    record.commission_deducted || null,
    record.net_received || null,
    record.dividend_received || null,
    record.notes || null,
    now
  ]);
  
  return result.lastInsertRowId;
};

export const updateChitMonthlyRecord = async (id: number, record: Partial<Omit<ChitMonthlyRecord, 'id' | 'created_at'>>): Promise<void> => {
  await initDatabase();
  const db = getDatabase();
  
  const fields: string[] = [];
  const params: any[] = [];
  
  Object.entries(record).forEach(([key, value]) => {
    if (value !== undefined) {
      fields.push(`${key} = ?`);
      params.push(value);
    }
  });
  
  if (fields.length === 0) return;
  
  params.push(id);
  
  await db.runAsync(`UPDATE chit_monthly_records SET ${fields.join(', ')} WHERE id = ?`, params);
};

export const deleteChitMonthlyRecord = async (id: number): Promise<void> => {
  await initDatabase();
  const db = getDatabase();
  
  await db.runAsync('DELETE FROM chit_monthly_records WHERE id = ?', [id]);
};

export const generateMonthlyRecords = async (chitId: number, startDate: string, durationMonths: number): Promise<void> => {
  await initDatabase();
  const db = getDatabase();
  
  const start = new Date(startDate);
  
  for (let i = 1; i <= durationMonths; i++) {
    const monthDate = new Date(start);
    monthDate.setMonth(start.getMonth() + i - 1);
    const monthDateStr = monthDate.toISOString().split('T')[0];
    
    await db.runAsync(`
      INSERT INTO chit_monthly_records (
        chit_id, month_number, month_date, payment_status, created_at
      ) VALUES (?, ?, ?, 'pending', ?)
    `, [chitId, i, monthDateStr, new Date().toISOString()]);
  }
};

// --- CHIT MEMBERS ---

export const getChitMembers = async (chitId: number): Promise<ChitMember[]> => {
  await initDatabase();
  const db = getDatabase();
  
  return await db.getAllAsync<ChitMember>(
    'SELECT * FROM chit_members WHERE chit_id = ? ORDER BY member_name ASC',
    [chitId]
  );
};

export const addChitMember = async (member: Omit<ChitMember, 'id'>): Promise<number> => {
  await initDatabase();
  const db = getDatabase();
  
  const result = await db.runAsync(`
    INSERT INTO chit_members (chit_id, member_name, member_turn_month, notes)
    VALUES (?, ?, ?, ?)
  `, [
    member.chit_id,
    member.member_name,
    member.member_turn_month || null,
    member.notes || null
  ]);
  
  return result.lastInsertRowId;
};

export const updateChitMember = async (id: number, member: Partial<Omit<ChitMember, 'id'>>): Promise<void> => {
  await initDatabase();
  const db = getDatabase();
  
  const fields: string[] = [];
  const params: any[] = [];
  
  Object.entries(member).forEach(([key, value]) => {
    if (value !== undefined) {
      fields.push(`${key} = ?`);
      params.push(value);
    }
  });
  
  if (fields.length === 0) return;
  
  params.push(id);
  
  await db.runAsync(`UPDATE chit_members SET ${fields.join(', ')} WHERE id = ?`, params);
};

export const deleteChitMember = async (id: number): Promise<void> => {
  await initDatabase();
  const db = getDatabase();
  
  await db.runAsync('DELETE FROM chit_members WHERE id = ?', [id]);
};

// --- CHIT FUND SUMMARY ---

export const getChitFundSummary = async () => {
  await initDatabase();
  const db = getDatabase();
  
  const chitFunds = await getChitFunds('active');
  const summary = {
    totalInvested: 0,
    totalReceived: 0,
    netPosition: 0,
    activeFunds: chitFunds.length,
    upcomingPayments: 0,
    myTurns: 0
  };
  
  for (const chitFund of chitFunds) {
    const monthlyRecords = await getChitMonthlyRecords(chitFund.id);
    
    // Calculate totals for this fund
    const myPaidRecords = monthlyRecords.filter(r => r.amount_paid !== null);
    const totalInvested = myPaidRecords.reduce((sum, r) => sum + (r.amount_paid || 0), 0);
    
    const myWonRecords = monthlyRecords.filter(r => r.winner_is_me === 1 && r.net_received !== null);
    const totalReceived = myWonRecords.reduce((sum, r) => sum + (r.net_received || 0), 0);
    
    summary.totalInvested += totalInvested;
    summary.totalReceived += totalReceived;
    summary.netPosition += (totalReceived - totalInvested);
    
    // Count upcoming payments
    const pendingPayments = monthlyRecords.filter(r => r.payment_status === 'pending');
    summary.upcomingPayments += pendingPayments.length;
    
    // Count my turns
    if (chitFund.my_turn_month !== null) {
      summary.myTurns++;
    }
  }
  
  return summary;
};
