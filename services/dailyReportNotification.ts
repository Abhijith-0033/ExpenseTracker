import * as Notifications from 'expo-notifications';
import { setHours, setMinutes, startOfDay, endOfDay, format } from 'date-fns';
import { getDatabase } from './database';

const CACHE_TABLE = 'daily_report_cache';

export const scheduleOrUpdateDailyReport = async (): Promise<void> => {
  try {
    const db = getDatabase();
    if (!db) return;

    const today = new Date();
    const dateStr = today.toISOString().split('T')[0];
    const start = startOfDay(today).toISOString();
    const end = endOfDay(today).toISOString();

    // Query today's summary
    const txs = await db.getAllAsync<{ amount: number, category: string }>(
      "SELECT amount, category FROM transactions WHERE date >= ? AND date <= ? AND category != 'Transfer' AND category != 'Debt/Credit'",
      [start, end]
    );

    if (txs.length === 0) {
      await cancelTonightReport();
      return;
    }

    let totalExpense = 0;
    let totalIncome = 0;
    const categories: Record<string, number> = {};

    txs.forEach(t => {
      if (t.category === 'Income') {
        totalIncome += t.amount;
      } else {
        totalExpense += t.amount;
        categories[t.category] = (categories[t.category] || 0) + t.amount;
      }
    });

    let topCategory = '';
    let topAmount = 0;
    for (const cat in categories) {
      if (categories[cat] > topAmount) {
        topAmount = categories[cat];
        topCategory = cat;
      }
    }

    // Get current balance
    const accounts = await db.getAllAsync<{ balance: number }>("SELECT balance FROM accounts WHERE type != 'meta_categories'");
    const currentBalance = accounts.reduce((sum, acc) => sum + acc.balance, 0);

    // Month expense to date
    const monthStart = format(today, 'yyyy-MM') + '-01T00:00:00.000Z';
    const monthExpense = await db.getFirstAsync<{ total: number }>(
      "SELECT SUM(amount) as total FROM transactions WHERE date >= ? AND date <= ? AND category != 'Income' AND category != 'Transfer' AND category != 'Debt/Credit'",
      [monthStart, end]
    );

    const reportData = {
      report_date: dateStr,
      total_expense: totalExpense,
      total_income: totalIncome,
      top_category: topCategory,
      top_category_amount: topAmount,
      transaction_count: txs.length,
      month_expense_to_date: monthExpense?.total || 0,
      current_balance: currentBalance,
      last_updated: Date.now()
    };

    // Upsert cache
    await db.runAsync(
      `INSERT INTO ${CACHE_TABLE} 
       (report_date, total_expense, total_income, top_category, top_category_amount, transaction_count, month_expense_to_date, current_balance, last_updated)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(report_date) DO UPDATE SET
       total_expense=excluded.total_expense, total_income=excluded.total_income, top_category=excluded.top_category,
       top_category_amount=excluded.top_category_amount, transaction_count=excluded.transaction_count,
       month_expense_to_date=excluded.month_expense_to_date, current_balance=excluded.current_balance, last_updated=excluded.last_updated`,
      [dateStr, reportData.total_expense, reportData.total_income, reportData.top_category, reportData.top_category_amount, reportData.transaction_count, reportData.month_expense_to_date, reportData.current_balance, reportData.last_updated]
    );

    // Cancel and reschedule
    const notificationId = `daily-report-${dateStr}`;
    await Notifications.cancelScheduledNotificationAsync(notificationId);

    const triggerTime = setMinutes(setHours(today, 22), 0);
    if (triggerTime > today) {
      const amountStr = (val: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val);
      
      await Notifications.scheduleNotificationAsync({
        identifier: notificationId,
        content: {
          title: "📊 Today's Financial Summary",
          body: `Spent: ${amountStr(totalExpense)} | Earned: ${amountStr(totalIncome)}\n${topCategory ? `${topCategory} was your biggest expense.` : ''}\n${txs.length} transactions recorded today.`,
          sound: true,
          data: { screen: '/(tabs)/analytics', action: 'daily_report' },
          categoryIdentifier: 'DAILY_REPORT_ACTIONS',
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: triggerTime,
        },
      });
    }
  } catch (e) {
    console.error("Error in scheduleOrUpdateDailyReport", e);
  }
};

export const cancelTonightReport = async (): Promise<void> => {
  try {
    const today = new Date().toISOString().split('T')[0];
    await Notifications.cancelScheduledNotificationAsync(`daily-report-${today}`);
  } catch (e) {
    console.error("Error in cancelTonightReport", e);
  }
};
