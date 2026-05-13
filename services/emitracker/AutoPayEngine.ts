import { getDatabase } from '../database';
import { EMIPayment, EMIRecord } from './EMIEngine';
import { format, parseISO, isBefore, isToday } from 'date-fns';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// INTERFACES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export interface AutoPayResult {
  success: boolean;
  paymentId: number | null;
  transactionId: number | null;
  message: string;
  error?: string;
}

export interface AutoPaySummary {
  total_processed: number;
  successful: number;
  failed: number;
  skipped: number;
  results: AutoPayResult[];
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// AUTOPAY FUNCTIONS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Process a single EMI payment via AutoPay
 * This is transactional - if any step fails, it rolls back
 */
export const processAutoPayForPayment = async (
  payment: EMIPayment,
  emiRecord: EMIRecord
): Promise<AutoPayResult> => {
  const db = getDatabase();
  if (!db) {
    return {
      success: false,
      paymentId: null,
      transactionId: null,
      message: 'Database not initialized',
      error: 'Database not initialized',
    };
  }

  // Validate autopay is enabled
  if (!emiRecord.is_autopay || !emiRecord.autopay_account_id) {
    return {
      success: false,
      paymentId: payment.id,
      transactionId: null,
      message: 'AutoPay not enabled for this EMI',
      error: 'AutoPay not enabled',
    };
  }

  // Check if payment is due (today or overdue)
  const today = format(new Date(), 'yyyy-MM-dd');
  const dueDate = payment.due_date;
  const isDueToday = isToday(parseISO(dueDate));
  const isOverdue = isBefore(parseISO(dueDate), new Date());

  if (!isDueToday && !isOverdue) {
    return {
      success: false,
      paymentId: payment.id,
      transactionId: null,
      message: 'Payment not due yet',
      error: 'Not due',
    };
  }

  // Check if already paid
  if (payment.payment_status === 'paid') {
    return {
      success: false,
      paymentId: payment.id,
      transactionId: null,
      message: 'Payment already processed',
      error: 'Already paid',
    };
  }

  // Check account balance
  const account = await db.getFirstAsync<{ id: number; balance: number; name: string }>(
    'SELECT id, balance, name FROM accounts WHERE id = ?',
    [emiRecord.autopay_account_id]
  );

  if (!account) {
    return {
      success: false,
      paymentId: payment.id,
      transactionId: null,
      message: 'AutoPay account not found',
      error: 'Account not found',
    };
  }

  if (account.balance < payment.amount_paid!) {
    return {
      success: false,
      paymentId: payment.id,
      transactionId: null,
      message: 'Insufficient balance in account',
      error: 'Insufficient balance',
    };
  }

  // Begin transaction
  let transactionId: number | null = null;
  try {
    // Step 1: Create expense transaction
    await db.execAsync('BEGIN TRANSACTION');

    const transactionResult = await db.runAsync(
      `INSERT INTO transactions (amount, category, subcategory, account_id, date, description, created_at, type)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        payment.amount_paid,
        emiRecord.category || 'EMI',
        emiRecord.name,
        emiRecord.autopay_account_id,
        today,
        `EMI Payment: ${emiRecord.name}${emiRecord.lender_name ? ` (${emiRecord.lender_name})` : ''}`,
        Date.now(),
        'expense'
      ]
    );

    transactionId = transactionResult.lastInsertRowId;

    // Step 2: Update account balance
    await db.runAsync(
      'UPDATE accounts SET balance = balance - ? WHERE id = ?',
      [payment.amount_paid, emiRecord.autopay_account_id]
    );

    // Step 3: Mark payment as paid
    await db.runAsync(
      `UPDATE emi_payments 
       SET paid_date = ?, amount_paid = ?, payment_status = 'paid', 
           payment_mode = 'autopay', account_id = ?, transaction_id = ?, created_at = datetime('now')
       WHERE id = ?`,
      [today, payment.amount_paid, emiRecord.autopay_account_id, transactionId, payment.id]
    );

    // Commit transaction
    await db.execAsync('COMMIT');

    return {
      success: true,
      paymentId: payment.id,
      transactionId,
      message: `AutoPay successful: ${emiRecord.name}`,
    };
  } catch (error) {
    // Rollback on error
    await db.execAsync('ROLLBACK');
    console.error('AutoPay transaction failed:', error);
    return {
      success: false,
      paymentId: payment.id,
      transactionId: null,
      message: 'AutoPay failed due to error',
      error: error instanceof Error ? error.message : String(error),
    };
  }
};

/**
 * Run AutoPay for all eligible EMIs
 * Should be called on app launch or periodically
 */
export const runAutoPay = async (): Promise<AutoPaySummary> => {
  const db = getDatabase();
  if (!db) {
    return {
      total_processed: 0,
      successful: 0,
      failed: 0,
      skipped: 0,
      results: [],
    };
  }

  const summary: AutoPaySummary = {
    total_processed: 0,
    successful: 0,
    failed: 0,
    skipped: 0,
    results: [],
  };

  try {
    // Get all active EMI records with autopay enabled
    const emiRecords = await db.getAllAsync<EMIRecord>(
      `SELECT * FROM emi_records 
       WHERE status = 'active' AND is_autopay = 1 AND autopay_account_id IS NOT NULL`
    );

    const today = format(new Date(), 'yyyy-MM-dd');

    for (const emiRecord of emiRecords) {
      // Get pending payments that are due today or overdue
      const payments = await db.getAllAsync<EMIPayment>(
        `SELECT * FROM emi_payments 
         WHERE emi_id = ? AND payment_status = 'pending' AND due_date <= ?
         ORDER BY due_date ASC`,
        [emiRecord.id, today]
      );

      for (const payment of payments) {
        summary.total_processed++;
        const result = await processAutoPayForPayment(payment, emiRecord);
        summary.results.push(result);

        if (result.success) {
          summary.successful++;
        } else if (result.error === 'Not due' || result.error === 'Already paid') {
          summary.skipped++;
        } else {
          summary.failed++;
        }
      }
    }
  } catch (error) {
    console.error('AutoPay batch processing failed:', error);
  }

  return summary;
};

/**
 * Rollback an AutoPay transaction
 * Used when a payment needs to be reversed
 */
export const rollbackAutoPay = async (
  paymentId: number
): Promise<boolean> => {
  const db = getDatabase();
  if (!db) return false;

  try {
    await db.execAsync('BEGIN TRANSACTION');

    // Get payment details
    const payment = await db.getFirstAsync<{
      transaction_id: number | null;
      account_id: number | null;
      amount_paid: number | null;
    }>('SELECT transaction_id, account_id, amount_paid FROM emi_payments WHERE id = ?', [paymentId]);

    if (!payment || !payment.transaction_id || !payment.account_id || !payment.amount_paid) {
      await db.execAsync('ROLLBACK');
      return false;
    }

    // Reverse account balance
    await db.runAsync(
      'UPDATE accounts SET balance = balance + ? WHERE id = ?',
      [payment.amount_paid, payment.account_id]
    );

    // Delete transaction
    await db.runAsync('DELETE FROM transactions WHERE id = ?', [payment.transaction_id]);

    // Reset payment status
    await db.runAsync(
      `UPDATE emi_payments 
       SET paid_date = NULL, amount_paid = NULL, payment_status = 'pending', 
           payment_mode = NULL, transaction_id = NULL
       WHERE id = ?`,
      [paymentId]
    );

    await db.execAsync('COMMIT');
    return true;
  } catch (error) {
    await db.execAsync('ROLLBACK');
    console.error('AutoPay rollback failed:', error);
    return false;
  }
};

/**
 * Get AutoPay eligibility status for an EMI record
 */
export const getAutoPayEligibility = async (
  emiId: number
): Promise<{
  eligible: boolean;
  reason?: string;
  accountBalance?: number;
  nextPaymentDate?: string;
  nextPaymentAmount?: number;
}> => {
  const db = getDatabase();
  if (!db) {
    return { eligible: false, reason: 'Database not initialized' };
  }

  const emiRecord = await db.getFirstAsync<EMIRecord>(
    'SELECT * FROM emi_records WHERE id = ?',
    [emiId]
  );

  if (!emiRecord) {
    return { eligible: false, reason: 'EMI record not found' };
  }

  if (!emiRecord.is_autopay || !emiRecord.autopay_account_id) {
    return { eligible: false, reason: 'AutoPay not enabled' };
  }

  if (emiRecord.status !== 'active') {
    return { eligible: false, reason: 'EMI is not active' };
  }

  // Check account balance
  const account = await db.getFirstAsync<{ balance: number }>(
    'SELECT balance FROM accounts WHERE id = ?',
    [emiRecord.autopay_account_id]
  );

  if (!account) {
    return { eligible: false, reason: 'AutoPay account not found' };
  }

  // Get next pending payment
  const nextPayment = await db.getFirstAsync<EMIPayment>(
    `SELECT * FROM emi_payments 
     WHERE emi_id = ? AND payment_status = 'pending' 
     ORDER BY due_date ASC LIMIT 1`,
    [emiId]
  );

  if (!nextPayment) {
    return { eligible: false, reason: 'No pending payments' };
  }

  const today = format(new Date(), 'yyyy-MM-dd');
  const dueDate = nextPayment.due_date;
  const isDueToday = isToday(parseISO(dueDate));
  const isOverdue = isBefore(parseISO(dueDate), new Date());

  if (!isDueToday && !isOverdue) {
    return {
      eligible: false,
      reason: 'Next payment not due yet',
      accountBalance: account.balance,
      nextPaymentDate: dueDate,
      nextPaymentAmount: nextPayment.amount_paid || undefined,
    };
  }

  if (account.balance < (nextPayment.amount_paid || 0)) {
    return {
      eligible: false,
      reason: 'Insufficient balance',
      accountBalance: account.balance,
      nextPaymentDate: dueDate,
      nextPaymentAmount: nextPayment.amount_paid || undefined,
    };
  }

  return {
    eligible: true,
    accountBalance: account.balance,
    nextPaymentDate: dueDate,
    nextPaymentAmount: nextPayment.amount_paid || undefined,
  };
};

/**
 * Enable AutoPay for an EMI record
 */
export const enableAutoPay = async (
  emiId: number,
  accountId: number
): Promise<boolean> => {
  const db = getDatabase();
  if (!db) return false;

  try {
    await db.runAsync(
      `UPDATE emi_records 
       SET is_autopay = 1, autopay_account_id = ?, updated_at = datetime('now')
       WHERE id = ?`,
      [accountId, emiId]
    );
    return true;
  } catch (error) {
    console.error('Failed to enable AutoPay:', error);
    return false;
  }
};

/**
 * Disable AutoPay for an EMI record
 */
export const disableAutoPay = async (emiId: number): Promise<boolean> => {
  const db = getDatabase();
  if (!db) return false;

  try {
    await db.runAsync(
      `UPDATE emi_records 
       SET is_autopay = 0, autopay_account_id = NULL, updated_at = datetime('now')
       WHERE id = ?`,
      [emiId]
    );
    return true;
  } catch (error) {
    console.error('Failed to disable AutoPay:', error);
    return false;
  }
};
