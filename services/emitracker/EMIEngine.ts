import { getDatabase } from '../database';
import { addMonths, parseISO, format, addDays, isAfter } from 'date-fns';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// INTERFACES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export interface EMIRecord {
  id: number;
  name: string;
  lender_name: string | null;
  principal: number;
  total_amount: number;
  emi_amount: number;
  interest_rate: number;
  tenure_months: number;
  start_date: string;
  due_day: number;
  is_autopay: number;
  autopay_account_id: number | null;
  status: string;
  category: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface EMIPayment {
  id: number;
  emi_id: number;
  month_number: number;
  due_date: string;
  paid_date: string | null;
  amount_paid: number | null;
  principal_component: number | null;
  interest_component: number | null;
  outstanding_balance: number | null;
  payment_status: 'pending' | 'paid' | 'overdue' | 'skipped';
  payment_mode: string | null;
  account_id: number | null;
  transaction_id: number | null;
  notes: string | null;
  created_at: string;
}

export interface AmortizationSchedule {
  month_number: number;
  due_date: string;
  emi_amount: number;
  principal_component: number;
  interest_component: number;
  outstanding_balance: number;
  payment_status: 'pending' | 'paid' | 'overdue' | 'skipped';
}

export interface EMICalculationResult {
  emi_amount: number;
  total_amount: number;
  total_interest: number;
  amortization_schedule: AmortizationSchedule[];
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// EMI CALCULATION FUNCTIONS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Calculate EMI using the standard formula
 * EMI = [P x R x (1+R)^N] / [(1+R)^N - 1]
 * where P = Principal, R = Monthly Interest Rate, N = Tenure in months
 */
export const calculateEMI = (
  principal: number,
  annualInterestRate: number,
  tenureMonths: number
): number => {
  if (annualInterestRate === 0 || tenureMonths === 0) {
    return principal / tenureMonths;
  }

  const monthlyRate = annualInterestRate / 12 / 100;
  const numerator = principal * monthlyRate * Math.pow(1 + monthlyRate, tenureMonths);
  const denominator = Math.pow(1 + monthlyRate, tenureMonths) - 1;
  
  return numerator / denominator;
};

/**
 * Generate complete amortization schedule
 */
export const generateAmortizationSchedule = (
  principal: number,
  annualInterestRate: number,
  tenureMonths: number,
  startDate: string,
  dueDay: number
): EMICalculationResult => {
  let emiAmount = calculateEMI(principal, annualInterestRate, tenureMonths);
  const totalAmount = emiAmount * tenureMonths;
  const totalInterest = totalAmount - principal;

  const schedule: AmortizationSchedule[] = [];
  let outstandingBalance = principal;
  let currentDate = parseISO(startDate);

  // Adjust start date to the due day
  if (currentDate.getDate() !== dueDay) {
    currentDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), dueDay);
    if (isAfter(currentDate, parseISO(startDate))) {
      currentDate = addMonths(currentDate, -1);
    }
  }

  for (let month = 1; month <= tenureMonths; month++) {
    let interestComponent = 0;
    let principalComponent = 0;

    if (annualInterestRate > 0) {
      const monthlyRate = annualInterestRate / 12 / 100;
      interestComponent = outstandingBalance * monthlyRate;
      principalComponent = emiAmount - interestComponent;
    } else {
      principalComponent = emiAmount;
    }

    // Adjust for last month
    if (month === tenureMonths) {
      principalComponent = outstandingBalance;
      emiAmount = principalComponent + interestComponent;
    }

    outstandingBalance -= principalComponent;
    if (outstandingBalance < 0) outstandingBalance = 0;

    schedule.push({
      month_number: month,
      due_date: format(currentDate, 'yyyy-MM-dd'),
      emi_amount: Math.round(emiAmount * 100) / 100,
      principal_component: Math.round(principalComponent * 100) / 100,
      interest_component: Math.round(interestComponent * 100) / 100,
      outstanding_balance: Math.round(outstandingBalance * 100) / 100,
      payment_status: 'pending',
    });

    currentDate = addMonths(currentDate, 1);
  }

  return {
    emi_amount: Math.round(emiAmount * 100) / 100,
    total_amount: Math.round(totalAmount * 100) / 100,
    total_interest: Math.round(totalInterest * 100) / 100,
    amortization_schedule: schedule,
  };
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// DATABASE OPERATIONS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Create a new EMI record with its payment schedule
 */
export const createEMIRecord = async (
  record: Omit<EMIRecord, 'id' | 'created_at' | 'updated_at'>
): Promise<number> => {
  const db = getDatabase();
  if (!db) throw new Error('Database not initialized');

  // Generate amortization schedule
  const calculation = generateAmortizationSchedule(
    record.principal,
    record.interest_rate,
    record.tenure_months,
    record.start_date,
    record.due_day
  );

  // Insert EMI record
  const result = await db.runAsync(
    `INSERT INTO emi_records 
    (name, lender_name, principal, total_amount, emi_amount, interest_rate, tenure_months, 
     start_date, due_day, is_autopay, autopay_account_id, status, category, notes, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
    [
      record.name,
      record.lender_name,
      record.principal,
      calculation.total_amount,
      calculation.emi_amount,
      record.interest_rate,
      record.tenure_months,
      record.start_date,
      record.due_day,
      record.is_autopay,
      record.autopay_account_id,
      record.status,
      record.category,
      record.notes,
    ]
  );

  const emiId = result.lastInsertRowId;

  // Insert payment schedule
  for (const payment of calculation.amortization_schedule) {
    await db.runAsync(
      `INSERT INTO emi_payments 
      (emi_id, month_number, due_date, amount_paid, principal_component, interest_component, 
       outstanding_balance, payment_status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
      [
        emiId,
        payment.month_number,
        payment.due_date,
        payment.emi_amount,
        payment.principal_component,
        payment.interest_component,
        payment.outstanding_balance,
        payment.payment_status,
      ]
    );
  }

  return emiId;
};

/**
 * Get all EMI records
 */
export const getEMIRecords = async (): Promise<EMIRecord[]> => {
  const db = getDatabase();
  if (!db) return [];

  return await db.getAllAsync<EMIRecord>(
    'SELECT * FROM emi_records ORDER BY created_at DESC'
  );
};

/**
 * Get a single EMI record by ID
 */
export const getEMIRecord = async (id: number): Promise<EMIRecord | null> => {
  const db = getDatabase();
  if (!db) return null;

  const result = await db.getFirstAsync<EMIRecord>(
    'SELECT * FROM emi_records WHERE id = ?',
    [id]
  );
  return result || null;
};

/**
 * Update an EMI record
 */
export const updateEMIRecord = async (
  id: number,
  updates: Partial<Omit<EMIRecord, 'id' | 'created_at'>>
): Promise<void> => {
  const db = getDatabase();
  if (!db) throw new Error('Database not initialized');

  const fields: string[] = [];
  const values: any[] = [];

  Object.entries(updates).forEach(([key, value]) => {
    if (value !== undefined && key !== 'id' && key !== 'created_at') {
      fields.push(`${key} = ?`);
      values.push(value);
    }
  });

  if (fields.length === 0) return;

  fields.push("updated_at = datetime('now')");
  values.push(id);

  await db.runAsync(
    `UPDATE emi_records SET ${fields.join(', ')} WHERE id = ?`,
    values
  );
};

/**
 * Delete an EMI record (cascades to payments)
 */
export const deleteEMIRecord = async (id: number): Promise<void> => {
  const db = getDatabase();
  if (!db) throw new Error('Database not initialized');

  await db.runAsync('DELETE FROM emi_records WHERE id = ?', [id]);
};

/**
 * Get all payments for an EMI record
 */
export const getEMIPayments = async (emiId: number): Promise<EMIPayment[]> => {
  const db = getDatabase();
  if (!db) return [];

  return await db.getAllAsync<EMIPayment>(
    'SELECT * FROM emi_payments WHERE emi_id = ? ORDER BY month_number ASC',
    [emiId]
  );
};

/**
 * Mark a payment as paid
 */
export const markPaymentAsPaid = async (
  paymentId: number,
  paidDate: string,
  amountPaid: number,
  accountId: number | null,
  transactionId: number | null,
  notes: string | null
): Promise<void> => {
  const db = getDatabase();
  if (!db) throw new Error('Database not initialized');

  await db.withTransactionAsync(async () => {
    // 1. Get payment to check if it's already paid (to avoid double deduction)
    const payment = await db.getFirstAsync<EMIPayment>('SELECT * FROM emi_payments WHERE id = ?', [paymentId]);
    if (!payment || payment.payment_status === 'paid') return;

    // 2. Update payment status
    await db.runAsync(
      `UPDATE emi_payments 
      SET paid_date = ?, amount_paid = ?, payment_status = 'paid', 
          account_id = ?, transaction_id = ?, notes = ?, created_at = datetime('now')
      WHERE id = ?`,
      [paidDate, amountPaid, accountId, transactionId, notes, paymentId]
    );

    // 3. Update account balance (subtract since it's a payment out)
    if (accountId) {
      await db.runAsync('UPDATE accounts SET balance = balance - ? WHERE id = ?', [amountPaid, accountId]);
    }
  });
};

/**
 * Revert a paid payment back to pending
 */
export const revertPaymentStatus = async (paymentId: number): Promise<void> => {
  const db = getDatabase();
  if (!db) throw new Error('Database not initialized');

  await db.withTransactionAsync(async () => {
    // 1. Get payment details
    const payment = await db.getFirstAsync<EMIPayment>('SELECT * FROM emi_payments WHERE id = ?', [paymentId]);
    if (!payment || payment.payment_status !== 'paid') return;

    // 2. Revert account balance if applicable
    if (payment.account_id && payment.amount_paid) {
      await db.runAsync('UPDATE accounts SET balance = balance + ? WHERE id = ?', [payment.amount_paid, payment.account_id]);
    }

    // 3. Reset payment status
    await db.runAsync(
      `UPDATE emi_payments 
       SET paid_date = NULL, amount_paid = NULL, payment_status = 'pending', 
           account_id = NULL, transaction_id = NULL, notes = NULL, created_at = datetime('now')
       WHERE id = ?`,
      [paymentId]
    );
  });
};

/**
 * Update payment status to overdue
 */
export const updatePaymentStatus = async (
  paymentId: number,
  status: 'pending' | 'paid' | 'overdue' | 'skipped'
): Promise<void> => {
  const db = getDatabase();
  if (!db) throw new Error('Database not initialized');

  await db.runAsync(
    'UPDATE emi_payments SET payment_status = ? WHERE id = ?',
    [status, paymentId]
  );
};

/**
 * Get overdue payments for all active EMIs
 */
export const getOverduePayments = async (): Promise<EMIPayment[]> => {
  const db = getDatabase();
  if (!db) return [];

  const today = format(new Date(), 'yyyy-MM-dd');

  return await db.getAllAsync<EMIPayment>(
    `SELECT ep.*, er.name as emi_name, er.lender_name, er.emi_amount
     FROM emi_payments ep
     JOIN emi_records er ON ep.emi_id = er.id
     WHERE er.status = 'active' 
       AND ep.payment_status = 'pending' 
       AND ep.due_date < ?
     ORDER BY ep.due_date ASC`,
    [today]
  );
};

/**
 * Get upcoming payments (next 30 days)
 */
export const getUpcomingPayments = async (): Promise<EMIPayment[]> => {
  const db = getDatabase();
  if (!db) return [];

  const today = format(new Date(), 'yyyy-MM-dd');
  const thirtyDaysLater = format(addDays(new Date(), 30), 'yyyy-MM-dd');

  return await db.getAllAsync<EMIPayment>(
    `SELECT ep.*, er.name as emi_name, er.lender_name, er.emi_amount
     FROM emi_payments ep
     JOIN emi_records er ON ep.emi_id = er.id
     WHERE er.status = 'active' 
       AND ep.payment_status = 'pending' 
       AND ep.due_date >= ? 
       AND ep.due_date <= ?
     ORDER BY ep.due_date ASC`,
    [today, thirtyDaysLater]
  );
};

/**
 * Get EMI summary statistics
 */
export const getEMISummary = async (): Promise<{
  total_active: number;
  total_paid: number;
  total_pending: number;
  total_overdue: number;
  total_emi_amount: number;
  total_paid_amount: number;
}> => {
  const db = getDatabase();
  if (!db) {
    return {
      total_active: 0,
      total_paid: 0,
      total_pending: 0,
      total_overdue: 0,
      total_emi_amount: 0,
      total_paid_amount: 0,
    };
  }

  const activeRecords = await db.getFirstAsync<{ count: number }>(
    "SELECT COUNT(*) as count FROM emi_records WHERE status = 'active'"
  );

  const paidPayments = await db.getFirstAsync<{ count: number; total: number }>(
    `SELECT COUNT(*) as count, COALESCE(SUM(amount_paid), 0) as total 
     FROM emi_payments WHERE payment_status = 'paid'`
  );

  const pendingPayments = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) as count 
     FROM emi_payments ep
     JOIN emi_records er ON ep.emi_id = er.id
     WHERE er.status = 'active' AND ep.payment_status = 'pending'`
  );

  const overduePayments = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) as count 
     FROM emi_payments ep
     JOIN emi_records er ON ep.emi_id = er.id
     WHERE er.status = 'active' AND ep.payment_status = 'pending' AND ep.due_date < date('now')`
  );

  const totalEMIAmount = await db.getFirstAsync<{ total: number }>(
    `SELECT COALESCE(SUM(emi_amount), 0) as total 
     FROM emi_records WHERE status = 'active'`
  );

  return {
    total_active: activeRecords?.count || 0,
    total_paid: paidPayments?.count || 0,
    total_pending: pendingPayments?.count || 0,
    total_overdue: overduePayments?.count || 0,
    total_emi_amount: totalEMIAmount?.total || 0,
    total_paid_amount: paidPayments?.total || 0,
  };
};

/**
 * Update payment statuses based on current date
 * Should be called periodically or on app launch
 */
export const updatePaymentStatuses = async (): Promise<void> => {
  const db = getDatabase();
  if (!db) return;

  const today = format(new Date(), 'yyyy-MM-dd');

  // Mark pending payments as overdue if due date has passed
  await db.runAsync(
    `UPDATE emi_payments 
     SET payment_status = 'overdue'
     WHERE payment_status = 'pending' 
       AND due_date < ?
       AND emi_id IN (SELECT id FROM emi_records WHERE status = 'active')`,
    [today]
  );
};
