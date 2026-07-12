import { getDatabase, initDatabase, addTransaction } from './database';
import { schedulePaymentNotifications, cancelPaymentNotifications, reschedulePaymentNotifications } from './paymentNotifications';

export interface UpcomingBill {
  id: number;
  name: string;
  amount: number;
  category: string;
  due_date: string; // YYYY-MM-DD
  recurrence: 'once' | 'weekly' | 'monthly' | 'yearly';
  status: 'pending' | 'paid' | 'snoozed' | 'overdue';
  account_id: number | null;
  notes: string | null;
  transaction_id: number | null;
  icon: string;
  color: string;
  paid_date: string | null;
  created_at?: string;
  updated_at?: string;
}

export const getAllUpcomingBills = async (): Promise<UpcomingBill[]> => {
  await initDatabase();
  const db = getDatabase();
  const todayStr = new Date().toISOString().split('T')[0];

  // First, dynamically update overdue status for pending/snoozed bills where due_date < today
  await db.runAsync(
    `UPDATE upcoming_bills 
     SET status = 'overdue' 
     WHERE (status = 'pending' OR status = 'snoozed') AND due_date < ?`,
    [todayStr]
  );

  return await db.getAllAsync<UpcomingBill>(
    'SELECT * FROM upcoming_bills ORDER BY due_date ASC'
  );
};

export const getBillsDueInDays = async (days: number): Promise<UpcomingBill[]> => {
  await initDatabase();
  const db = getDatabase();
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  
  const futureDate = new Date();
  futureDate.setDate(today.getDate() + days);
  const futureStr = futureDate.toISOString().split('T')[0];

  // Refresh overdue statuses first
  await db.runAsync(
    `UPDATE upcoming_bills 
     SET status = 'overdue' 
     WHERE (status = 'pending' OR status = 'snoozed') AND due_date < ?`,
    [todayStr]
  );

  return await db.getAllAsync<UpcomingBill>(
    `SELECT * FROM upcoming_bills 
     WHERE (status = 'pending' OR status = 'overdue' OR status = 'snoozed') 
       AND due_date <= ? 
     ORDER BY due_date ASC`,
    [futureStr]
  );
};

export const addUpcomingBill = async (
  bill: Omit<UpcomingBill, 'id' | 'status' | 'paid_date' | 'transaction_id'>
): Promise<number> => {
  await initDatabase();
  const db = getDatabase();
  
  const todayStr = new Date().toISOString().split('T')[0];
  const initialStatus = bill.due_date < todayStr ? 'overdue' : 'pending';

  const result = await db.runAsync(
    `INSERT INTO upcoming_bills 
      (name, amount, category, due_date, recurrence, status, account_id, notes, icon, color) 
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      bill.name,
      bill.amount,
      bill.category || 'Bills',
      bill.due_date,
      bill.recurrence || 'once',
      initialStatus,
      bill.account_id,
      bill.notes || null,
      bill.icon || '📄',
      bill.color || '#2563EB'
    ]
  );

  const newId = result.lastInsertRowId;

  // Schedule notification using unified system
  try {
    await schedulePaymentNotifications({
      id: newId,
      type: 'bill',
      name: bill.name,
      amount: bill.amount,
      dueDate: bill.due_date,
      category: bill.category || 'Bills',
      accountId: bill.account_id || undefined,
    });
  } catch (e) {
    console.error('Failed to schedule notifications for new upcoming bill:', e);
  }

  return newId;
};

export const updateUpcomingBill = async (
  id: number,
  updates: Partial<Omit<UpcomingBill, 'id'>>
): Promise<void> => {
  await initDatabase();
  const db = getDatabase();

  const keys = Object.keys(updates).filter(k => k !== 'id');
  if (keys.length === 0) return;

  const sets = keys.map(k => `${k} = ?`).join(', ');
  const values = keys.map(k => (updates as any)[k]);
  values.push(new Date().toISOString(), id);

  await db.runAsync(
    `UPDATE upcoming_bills SET ${sets}, updated_at = ? WHERE id = ?`,
    values
  );

  // If name, amount, due_date, category, or account_id changes, reschedule notifications
  const shouldReschedule = 
    updates.name !== undefined || 
    updates.amount !== undefined || 
    updates.due_date !== undefined || 
    updates.category !== undefined || 
    updates.account_id !== undefined;

  if (shouldReschedule) {
    const current = await db.getFirstAsync<UpcomingBill>(
      'SELECT * FROM upcoming_bills WHERE id = ?',
      [id]
    );
    if (current && (current.status === 'pending' || current.status === 'overdue' || current.status === 'snoozed')) {
      try {
        await reschedulePaymentNotifications({
          id: current.id,
          type: 'bill',
          name: current.name,
          amount: current.amount,
          dueDate: current.due_date,
          category: current.category,
          accountId: current.account_id || undefined,
        });
      } catch (e) {
        console.error('Failed to reschedule notifications for updated bill:', e);
      }
    }
  }
};

export const markBillPaid = async (
  id: number,
  accountId: number
): Promise<number | null> => {
  await initDatabase();
  const db = getDatabase();

  const bill = await db.getFirstAsync<UpcomingBill>(
    'SELECT * FROM upcoming_bills WHERE id = ?',
    [id]
  );
  if (!bill) throw new Error('Bill not found');

  let transactionId: number | null = null;

  await db.withTransactionAsync(async () => {
    // 1. Create transaction in the database (this updates accounts automatically)
    transactionId = await addTransaction({
      amount: bill.amount,
      category: bill.category || 'Bills',
      subcategory: 'Upcoming Bill',
      account_id: accountId,
      date: new Date().toISOString(),
      description: bill.name,
    });

    // 2. Cancel all upcoming notifications
    try {
      await cancelPaymentNotifications(id, 'bill');
    } catch (e) {
      console.warn('Failed to cancel notifications for paid bill:', e);
    }

    // 3. Mark bill status as paid
    const nowStr = new Date().toISOString();
    await db.runAsync(
      `UPDATE upcoming_bills 
       SET status = 'paid', transaction_id = ?, paid_date = ?, updated_at = ? 
       WHERE id = ?`,
      [transactionId, nowStr, nowStr, id]
    );
  });

  return transactionId;
};

export const deleteUpcomingBill = async (id: number): Promise<void> => {
  await initDatabase();
  const db = getDatabase();

  // Cancel notifications
  try {
    await cancelPaymentNotifications(id, 'bill');
  } catch (e) {
    console.warn('Failed to cancel notifications for deleted bill:', e);
  }

  await db.runAsync('DELETE FROM upcoming_bills WHERE id = ?', [id]);
};

export const snoozeUpcomingBill = async (
  id: number,
  newDueDate: string
): Promise<void> => {
  await initDatabase();
  const db = getDatabase();

  const todayStr = new Date().toISOString().split('T')[0];
  const newStatus = newDueDate < todayStr ? 'overdue' : 'snoozed';
  const nowStr = new Date().toISOString();

  await db.runAsync(
    `UPDATE upcoming_bills 
     SET due_date = ?, status = ?, updated_at = ? 
     WHERE id = ?`,
    [newDueDate, newStatus, nowStr, id]
  );

  // Reschedule notifications for the new date
  const bill = await db.getFirstAsync<UpcomingBill>(
    'SELECT * FROM upcoming_bills WHERE id = ?',
    [id]
  );
  if (bill) {
    try {
      await reschedulePaymentNotifications({
        id: bill.id,
        type: 'bill',
        name: bill.name,
        amount: bill.amount,
        dueDate: bill.due_date,
        category: bill.category,
        accountId: bill.account_id || undefined,
      });
    } catch (e) {
      console.error('Failed to reschedule notifications for snoozed bill:', e);
    }
  }
};
