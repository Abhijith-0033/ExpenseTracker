import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { getDatabase, initDatabase } from '../database';
import { format, addDays, subDays, setHours, setMinutes, isAfter, startOfDay, endOfDay, isToday, isTomorrow, isYesterday, differenceInDays, addMonths, addWeeks, parseISO } from 'date-fns';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// NOTIFICATION ID SYSTEM
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const NOTIFICATION_IDS = {
  DAILY_EXPENSE_REMINDER: 'daily_expense_reminder',
  DAILY_EXPENSE_REPORT: 'daily_expense_report',
  BILL_PREFIX: 'bill_',
  SUBSCRIPTION_PREFIX: 'sub_',
  RECURRING_PREFIX: 'recur_',
  DEBT_OVERDUE_PREFIX: 'debt_',
  DEBT_DUE_SOON_PREFIX: 'debt_',
  DEBT_PAYMENT_REMINDER_PREFIX: 'debt_',
  CHIT_MONTHLY_PREFIX: 'chit_',
  CHIT_WINNING_PREFIX: 'chit_',
  SAVINGS_GOAL_PREFIX: 'goal_',
  BUDGET_ALERT_PREFIX: 'budget_',
  EMI_PREFIX: 'emi_',
  EMI_AUTOPAY_PREFIX: 'emi_autopay_',
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SETTINGS KEYS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const SETTINGS_KEYS = {
  NOTIF_MASTER_ENABLED: 'notif_master_enabled',
  NOTIF_DAILY_REMINDER: 'notif_daily_reminder',
  NOTIF_DAILY_REPORT: 'notif_daily_report',
  NOTIF_DAILY_REMINDER_TIME: 'notif_daily_reminder_time',
  NOTIF_DAILY_REPORT_TIME: 'notif_daily_report_time',
  NOTIF_UPCOMING_BILLS: 'notif_upcoming_bills',
  NOTIF_SUBSCRIPTIONS: 'notif_subscriptions',
  NOTIF_RECURRING: 'notif_recurring',
  NOTIF_DEBT_OVERDUE: 'notif_debt_overdue',
  NOTIF_DEBT_REMINDERS: 'notif_debt_reminders',
  NOTIF_CHIT_MONTHLY: 'notif_chit_monthly',
  NOTIF_CHIT_WINNING: 'notif_chit_winning',
  NOTIF_SAVINGS_GOALS: 'notif_savings_goals',
  NOTIF_BUDGET_ALERTS: 'notif_budget_alerts',
  NOTIF_EMI_REMINDERS: 'notif_emi_reminders',
  NOTIF_EMI_AUTOPAY: 'notif_emi_autopay',
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// PERMISSION HELPER
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const checkAndRequestPermission = async (): Promise<boolean> => {
  try {
    const settings = await Notifications.getPermissionsAsync();
    let granted = settings.granted;

    if (!granted) {
      const { status } = await Notifications.requestPermissionsAsync();
      granted = status === 'granted';
    }

    return granted;
  } catch (error) {
    console.warn('Permission check failed:', error);
    return false;
  }
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CANCEL HELPER
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const cancelByPrefix = async (prefix: string): Promise<void> => {
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    for (const notification of scheduled) {
      if (notification.identifier.startsWith(prefix)) {
        await Notifications.cancelScheduledNotificationAsync(notification.identifier);
      }
    }
  } catch (error) {
    console.error(`Error cancelling notifications with prefix ${prefix}:`, error);
  }
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// NOTIFICATION CHANNELS SETUP
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const setupNotificationChannels = async (): Promise<void> => {
  if (Platform.OS === 'android') {
    try {
      await Notifications.setNotificationChannelAsync('expense-reminders', {
        name: 'Expense Reminders',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#2563eb',
      });

      await Notifications.setNotificationChannelAsync('payment-reminders', {
        name: 'Payment Reminders',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#E91E63',
      });

      await Notifications.setNotificationChannelAsync('daily-reports', {
        name: 'Daily Reports',
        importance: Notifications.AndroidImportance.DEFAULT,
        vibrationPattern: [0, 250],
        lightColor: '#2563eb',
      });

      await Notifications.setNotificationChannelAsync('debt-alerts', {
        name: 'Debt Alerts',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#F44336',
      });

      await Notifications.setNotificationChannelAsync('chit-funds', {
        name: 'Chit Funds',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#4CAF50',
      });

      await Notifications.setNotificationChannelAsync('savings-goals', {
        name: 'Savings Goals',
        importance: Notifications.AndroidImportance.DEFAULT,
        vibrationPattern: [0, 250],
        lightColor: '#FF9800',
      });

      await Notifications.setNotificationChannelAsync('budget-alerts', {
        name: 'Budget Alerts',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF5722',
      });

      await Notifications.setNotificationChannelAsync('emi-reminders', {
        name: 'EMI Reminders',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#9C27B0',
      });

      await Notifications.setNotificationChannelAsync('emi-autopay', {
        name: 'EMI AutoPay',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#673AB7',
      });
    } catch (error) {
      console.warn('Failed to setup notification channels:', error);
    }
  }
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// NOTIFICATION CATEGORIES SETUP
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const setupNotificationCategories = async (): Promise<void> => {
  try {
    // Daily Reminder Actions
    await Notifications.setNotificationCategoryAsync('DAILY_REMINDER_ACTIONS', [
      { identifier: 'ADD_EXPENSE', buttonTitle: '➕ Add Expense', options: { opensAppToForeground: true } },
      { identifier: 'ADD_INCOME', buttonTitle: '💰 Add Income', options: { opensAppToForeground: true } },
      { identifier: 'OPEN_APP', buttonTitle: '📊 Open App', options: { opensAppToForeground: true } },
    ]);

    // Daily Report Actions
    await Notifications.setNotificationCategoryAsync('DAILY_REPORT_ACTIONS', [
      { identifier: 'ADD_MORE', buttonTitle: '➕ Add More', options: { opensAppToForeground: true } },
      { identifier: 'FULL_REPORT', buttonTitle: '📋 Full Report', options: { opensAppToForeground: true } },
      { identifier: 'VIEW_TODAY', buttonTitle: '📅 View Today', options: { opensAppToForeground: true } },
    ]);

    // Debt Payment Actions
    await Notifications.setNotificationCategoryAsync('DEBT_PAYMENT_ACTIONS', [
      { identifier: 'RECORD_PAYMENT', buttonTitle: '💳 Record Payment', options: { opensAppToForeground: true } },
      { identifier: 'REMIND_TOMORROW', buttonTitle: '⏰ Remind Tomorrow', options: { opensAppToForeground: false } },
    ]);

    // Debt Lender Actions
    await Notifications.setNotificationCategoryAsync('DEBT_LENDER_ACTIONS', [
      { identifier: 'SEND_REMINDER', buttonTitle: '📞 Send Reminder', options: { opensAppToForeground: true } },
      { identifier: 'MARK_PAID', buttonTitle: '✅ Mark as Paid', options: { opensAppToForeground: true } },
    ]);

    // Chit Fund Actions
    await Notifications.setNotificationCategoryAsync('CHIT_PAYMENT_ACTIONS', [
      { identifier: 'RECORD_PAYMENT', buttonTitle: '✅ Mark as Paid', options: { opensAppToForeground: true } },
      { identifier: 'REMIND_EVENING', buttonTitle: '⏰ Remind at 7 PM', options: { opensAppToForeground: false } },
    ]);

    // Goal Actions
    await Notifications.setNotificationCategoryAsync('GOAL_ACTIONS', [
      { identifier: 'VIEW_GOAL', buttonTitle: '📊 View Goal', options: { opensAppToForeground: true } },
    ]);

    // Budget Actions
    await Notifications.setNotificationCategoryAsync('BUDGET_ACTIONS', [
      { identifier: 'VIEW_BUDGET', buttonTitle: '📊 View Budget', options: { opensAppToForeground: true } },
    ]);

    // Inline reply for quick add (Android only)
    if (Platform.OS === 'android') {
      try {
        await Notifications.setNotificationCategoryAsync('DAILY_REMINDER_INLINE', [
          { identifier: 'ADD_EXPENSE', buttonTitle: '➕ Add Expense', options: { opensAppToForeground: true } },
          { identifier: 'ADD_INCOME', buttonTitle: '💰 Add Income', options: { opensAppToForeground: true } },
          { identifier: 'QUICK_ADD', buttonTitle: '⚡ Quick Add', textInput: { submitButtonTitle: 'Save', placeholder: 'Amount (e.g. 150 Food)' } },
        ]);
      } catch (e) {
        console.warn('Inline reply not supported, falling back');
      }
    }
  } catch (error) {
    console.warn('Failed to setup notification categories:', error);
  }
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// UTILITY FUNCTIONS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
};

const getTodayString = (): string => {
  return new Date().toISOString().split('T')[0];
};

const getDayOfWeekMessage = (): string => {
  const day = new Date().getDay();
  switch (day) {
    case 1: return "New week, fresh start. Log today's expenses!";
    case 5: return "Week's almost done. Record today's spending!";
    case 0:
    case 6: return "Weekend spending? Don't forget to track it!";
    default: return "Take 30 seconds to log today's expenses.";
  }
};

const parseQuickAdd = async (text: string): Promise<{ amount: number; category: string; valid: boolean }> => {
  try {
    const match = text.match(/^(\d+\.?\d*)\s*(.*)?$/);
    if (!match) return { amount: 0, category: '', valid: false };

    const amount = parseFloat(match[1]);
    const categoryHint = (match[2] || '').trim();

    if (isNaN(amount) || amount <= 0) return { amount: 0, category: '', valid: false };

    // Try to match category against existing categories
    const db = getDatabase();
    if (!db) return { amount, category: 'Other', valid: true };

    const categories = await db.getAllAsync<{ name: string }>('SELECT name FROM categories');
    const matchedCategory = categories.find(cat => 
      cat.name.toLowerCase().includes(categoryHint.toLowerCase()) ||
      categoryHint.toLowerCase().includes(cat.name.toLowerCase())
    );

    return {
      amount,
      category: matchedCategory?.name || 'Other',
      valid: true
    };
  } catch (error) {
    console.error('Error parsing quick add:', error);
    return { amount: 0, category: '', valid: false };
  }
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// DAILY REMINDER & REPORT NOTIFICATIONS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const scheduleDailyReminder = async (): Promise<void> => {
  const hasPermission = await checkAndRequestPermission();
  if (!hasPermission) return;

  const masterEnabled = await AsyncStorage.getItem(SETTINGS_KEYS.NOTIF_MASTER_ENABLED);
  const reminderEnabled = await AsyncStorage.getItem(SETTINGS_KEYS.NOTIF_DAILY_REMINDER);
  
  if (masterEnabled !== 'true' || reminderEnabled !== 'true') {
    await Notifications.cancelScheduledNotificationAsync(NOTIFICATION_IDS.DAILY_EXPENSE_REMINDER);
    return;
  }

  const reminderTime = await AsyncStorage.getItem(SETTINGS_KEYS.NOTIF_DAILY_REMINDER_TIME) || '21:00';
  const [hour, minute] = reminderTime.split(':').map(Number);

  // Cancel existing
  await Notifications.cancelScheduledNotificationAsync(NOTIFICATION_IDS.DAILY_EXPENSE_REMINDER);

  // Schedule new reminder
  await Notifications.scheduleNotificationAsync({
    identifier: NOTIFICATION_IDS.DAILY_EXPENSE_REMINDER,
    content: {
      title: "📝 Don't forget to log today!",
      body: getDayOfWeekMessage(),
      sound: true,
      data: {
        type: 'daily_reminder',
        screen: '/(tabs)/add',
        date: getTodayString(),
      },
      categoryIdentifier: Platform.OS === 'android' ? 'DAILY_REMINDER_INLINE' : 'DAILY_REMINDER_ACTIONS',
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute,
    },
  });
};

export const scheduleDailyReport = async (): Promise<void> => {
  const hasPermission = await checkAndRequestPermission();
  if (!hasPermission) return;

  const masterEnabled = await AsyncStorage.getItem(SETTINGS_KEYS.NOTIF_MASTER_ENABLED);
  const reportEnabled = await AsyncStorage.getItem(SETTINGS_KEYS.NOTIF_DAILY_REPORT);
  
  if (masterEnabled !== 'true' || reportEnabled !== 'true') {
    await Notifications.cancelScheduledNotificationAsync(NOTIFICATION_IDS.DAILY_EXPENSE_REPORT);
    return;
  }

  const reportTime = await AsyncStorage.getItem(SETTINGS_KEYS.NOTIF_DAILY_REPORT_TIME) || '22:00';
  const [hour, minute] = reportTime.split(':').map(Number);

  // Cancel existing
  await Notifications.cancelScheduledNotificationAsync(NOTIFICATION_IDS.DAILY_EXPENSE_REPORT);

  // Schedule new report
  await Notifications.scheduleNotificationAsync({
    identifier: NOTIFICATION_IDS.DAILY_EXPENSE_REPORT,
    content: {
      title: "📊 Today's Financial Summary",
      body: "Checking today's transactions...",
      sound: true,
      data: {
        type: 'daily_report',
        screen: '/(tabs)/analytics',
        date: getTodayString(),
      },
      categoryIdentifier: 'DAILY_REPORT_ACTIONS',
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute,
    },
  });
};

export const updateDailyReportContent = async (): Promise<void> => {
  try {
    const hasPermission = await checkAndRequestPermission();
    if (!hasPermission) return;

    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    const reportNotification = scheduled.find(n => n.identifier === NOTIFICATION_IDS.DAILY_EXPENSE_REPORT);
    
    if (!reportNotification) return;

    const db = getDatabase();
    if (!db) return;

    const today = getTodayString();
    
    // Get today's transactions
    const transactions = await db.getAllAsync<{ amount: number; type: string; category: string }>(
      'SELECT amount, type, category FROM transactions WHERE date = ?',
      [today]
    );

    if (transactions.length === 0) {
      // No transactions today, cancel report
      await Notifications.cancelScheduledNotificationAsync(NOTIFICATION_IDS.DAILY_EXPENSE_REPORT);
      return;
    }

    // Calculate totals
    const totalExpense = transactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
    const totalIncome = transactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
    const transactionCount = transactions.length;

    // Get top category
    const categoryTotals = transactions.reduce((acc, t) => {
      if (t.type === 'expense') {
        acc[t.category] = (acc[t.category] || 0) + t.amount;
      }
      return acc;
    }, {} as Record<string, number>);

    const topCategory = Object.entries(categoryTotals).sort(([,a], [,b]) => b - a)[0];
    const topCategoryAmount = topCategory?.[1] || 0;
    const topCategoryName = topCategory?.[0] || 'None';

    // Get month totals
    const currentMonth = today.substring(0, 7);
    const monthExpenses = await db.getFirstAsync<{ total: number }>(
      'SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE date LIKE ? AND type = ?',
      [`${currentMonth}-%`, 'expense']
    );

    // Get total balance
    const balance = await db.getFirstAsync<{ total: number }>(
      'SELECT COALESCE(SUM(balance), 0) as total FROM accounts'
    );

    // Update notification content
    const shortBody = `Spent ${formatCurrency(totalExpense)} · Earned ${formatCurrency(totalIncome)} · ${transactionCount} transactions`;
    const fullBody = `💸 Expenses Today:   ${formatCurrency(totalExpense)}
💰 Income Today:     ${formatCurrency(totalIncome)}
🏆 Top Spend:        ${topCategoryName} ${formatCurrency(topCategoryAmount)}
📈 Month so far:     ${formatCurrency(monthExpenses?.total || 0)}
💼 Total Balance:    ${formatCurrency(balance?.total || 0)}`;

    // Cancel and reschedule with updated content
    await Notifications.cancelScheduledNotificationAsync(NOTIFICATION_IDS.DAILY_EXPENSE_REPORT);
    
    const reportTime = await AsyncStorage.getItem(SETTINGS_KEYS.NOTIF_DAILY_REPORT_TIME) || '22:00';
    const [hour, minute] = reportTime.split(':').map(Number);
    const now = new Date();
    const scheduledTime = setMinutes(setHours(now, hour), minute);
    
    // If scheduled time has passed, schedule for tomorrow
    const triggerTime = scheduledTime > now ? scheduledTime : setMinutes(setHours(addDays(now, 1), hour), minute);

    await Notifications.scheduleNotificationAsync({
      identifier: NOTIFICATION_IDS.DAILY_EXPENSE_REPORT,
      content: {
        title: "📊 Today's Financial Summary",
        body: Platform.OS === 'android' ? fullBody : shortBody,
        sound: true,
        data: {
          type: 'daily_report',
          screen: '/(tabs)/analytics',
          date: today,
          totalExpense,
          totalIncome,
          transactionCount,
          topCategory: topCategoryName,
          topCategoryAmount,
          monthExpense: monthExpenses?.total || 0,
          totalBalance: balance?.total || 0,
        },
        categoryIdentifier: 'DAILY_REPORT_ACTIONS',
      },
      trigger: triggerTime,
    });
  } catch (error) {
    console.error('Error updating daily report content:', error);
  }
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// DEBT NOTIFICATIONS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const scheduleDebtNotifications = async (debtId: number): Promise<void> => {
  const hasPermission = await checkAndRequestPermission();
  if (!hasPermission) return;

  const masterEnabled = await AsyncStorage.getItem(SETTINGS_KEYS.NOTIF_MASTER_ENABLED);
  const overdueEnabled = await AsyncStorage.getItem(SETTINGS_KEYS.NOTIF_DEBT_OVERDUE);
  const remindersEnabled = await AsyncStorage.getItem(SETTINGS_KEYS.NOTIF_DEBT_REMINDERS);
  
  if (masterEnabled !== 'true') return;

  const db = getDatabase();
  if (!db) return;

  interface DebtRecord {
    id: number;
    name: string;
    principal: number;
    interest_rate: number;
    interest_type: 'none' | 'simple' | 'compound_monthly' | 'compound_quarterly' | 'compound_half_yearly' | 'compound_yearly';
    repayment_freq: 'daily' | 'weekly' | 'monthly' | 'custom';
    custom_freq_days?: number;
    start_date: string;
    expected_end_date?: string;
    status: 'active' | 'completed' | 'written_off';
    direction: 'borrowed' | 'lent';
    created_at: string;
    updated_at: string;
  }

  const debt = await db.getFirstAsync<DebtRecord>('SELECT * FROM debt_records WHERE id = ?', [debtId]);

  if (!debt || debt.status !== 'active') return;

  // Cancel existing debt notifications
  await cancelByPrefix(`${NOTIFICATION_IDS.DEBT_OVERDUE_PREFIX}${debtId}_`);
  await cancelByPrefix(`${NOTIFICATION_IDS.DEBT_DUE_SOON_PREFIX}${debtId}_`);

  // Get current balance and next due date from debt engine
  const { calculateCurrentBalance, calculateNextDueDate } = await import('../debttracker/DebtEngine');
  
  interface DebtRepayment {
    id: number;
    debt_id: number;
    payment_date: string;
    amount: number;
    payment_type: 'principal' | 'interest' | 'both';
    created_at: string;
  }
  
  const repayments = await db.getAllAsync<DebtRepayment>(
    'SELECT * FROM debt_repayments WHERE debt_id = ? ORDER BY payment_date DESC', [debtId]
  );
  
  const balanceResult = calculateCurrentBalance(debt, repayments);
  const currentBalance = balanceResult.currentBalance;
  const nextDueDate = calculateNextDueDate(debt, repayments);

  if (!nextDueDate) return;

  const today = new Date();
  const daysUntilDue = differenceInDays(nextDueDate, today);

  // Overdue notification
  if (daysUntilDue < 0 && overdueEnabled === 'true') {
    const daysOverdue = Math.abs(daysUntilDue);
    const title = debt.direction === 'borrowed' ? "🚨 Overdue Payment" : "🚨 Overdue Payment";
    const body = debt.direction === 'borrowed'
      ? `You owe ${formatCurrency(currentBalance)} to ${debt.name}. Payment was due ${daysOverdue} days ago.`
      : `${debt.name} owes you ${formatCurrency(currentBalance)}. Payment was due ${daysOverdue} days ago.`;

    await Notifications.scheduleNotificationAsync({
        identifier: `${NOTIFICATION_IDS.DEBT_OVERDUE_PREFIX}${debtId}_overdue`,
        content: {
          title,
          body,
          sound: true,
          data: {
            type: 'debt_overdue',
            debtId,
            debtName: debt.name,
            direction: debt.direction,
            amount: currentBalance,
            daysOverdue,
          },
          categoryIdentifier: debt.direction === 'borrowed' ? 'DEBT_PAYMENT_ACTIONS' : 'DEBT_LENDER_ACTIONS',
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
          hour: 9,
          minute: 0,
        },
      });
  }

  // Due soon notifications
  if (remindersEnabled === 'true' && daysUntilDue >= 0) {
    if (daysUntilDue === 7) {
      await Notifications.scheduleNotificationAsync({
        identifier: `${NOTIFICATION_IDS.DEBT_DUE_SOON_PREFIX}${debtId}_due_7`,
        content: {
          title: "📅 Payment Due in 7 Days",
          body: `${formatCurrency(currentBalance)} due to ${debt.name} on ${format(nextDueDate, 'MMM dd')}`,
          sound: true,
          data: {
            type: 'debt_due_soon',
            debtId,
            debtName: debt.name,
            amount: currentBalance,
            dueDate: nextDueDate,
          },
          categoryIdentifier: 'DEBT_PAYMENT_ACTIONS',
        },
        trigger: setMinutes(setHours(nextDueDate, 9), 0),
      });
    } else if (daysUntilDue === 3) {
      await Notifications.scheduleNotificationAsync({
        identifier: `${NOTIFICATION_IDS.DEBT_DUE_SOON_PREFIX}${debtId}_due_3`,
        content: {
          title: "⏰ Payment Due in 3 Days",
          body: `${formatCurrency(currentBalance)} due to ${debt.name} on ${format(nextDueDate, 'MMM dd')}`,
          sound: true,
          data: {
            type: 'debt_due_soon',
            debtId,
            debtName: debt.name,
            amount: currentBalance,
            dueDate: nextDueDate,
          },
          categoryIdentifier: 'DEBT_PAYMENT_ACTIONS',
        },
        trigger: setMinutes(setHours(nextDueDate, 9), 0),
      });
    } else if (daysUntilDue === 1) {
      await Notifications.scheduleNotificationAsync({
        identifier: `${NOTIFICATION_IDS.DEBT_DUE_SOON_PREFIX}${debtId}_due_1`,
        content: {
          title: "⚠️ Payment Due Tomorrow",
          body: `Don't forget: ${formatCurrency(currentBalance)} due to ${debt.name} tomorrow`,
          sound: true,
          data: {
            type: 'debt_due_soon',
            debtId,
            debtName: debt.name,
            amount: currentBalance,
            dueDate: nextDueDate,
          },
          categoryIdentifier: 'DEBT_PAYMENT_ACTIONS',
        },
        trigger: setMinutes(setHours(nextDueDate, 9), 0),
      });
    } else if (daysUntilDue === 0) {
      await Notifications.scheduleNotificationAsync({
        identifier: `${NOTIFICATION_IDS.DEBT_DUE_SOON_PREFIX}${debtId}_due_0`,
        content: {
          title: "❗ Payment Due Today",
          body: `${formatCurrency(currentBalance)} is due today for ${debt.name}`,
          sound: true,
          data: {
            type: 'debt_due_today',
            debtId,
            debtName: debt.name,
            amount: currentBalance,
          },
          categoryIdentifier: 'DEBT_PAYMENT_ACTIONS',
        },
        trigger: setMinutes(setHours(nextDueDate, 9), 0),
      });
    }
  }
};

export const cancelDebtNotifications = async (debtId: number): Promise<void> => {
  await cancelByPrefix(`${NOTIFICATION_IDS.DEBT_OVERDUE_PREFIX}${debtId}_`);
  await cancelByPrefix(`${NOTIFICATION_IDS.DEBT_DUE_SOON_PREFIX}${debtId}_`);
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CHIT FUND NOTIFICATIONS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const scheduleChitNotifications = async (chitId: number): Promise<void> => {
  const hasPermission = await checkAndRequestPermission();
  if (!hasPermission) return;

  const masterEnabled = await AsyncStorage.getItem(SETTINGS_KEYS.NOTIF_MASTER_ENABLED);
  const monthlyEnabled = await AsyncStorage.getItem(SETTINGS_KEYS.NOTIF_CHIT_MONTHLY);
  const winningEnabled = await AsyncStorage.getItem(SETTINGS_KEYS.NOTIF_CHIT_WINNING);
  
  if (masterEnabled !== 'true') return;

  const db = getDatabase();
  if (!db) return;

  interface ChitFund {
    id: number;
    name: string;
    total_members: number;
    monthly_amount: number;
    total_pot: number;
    duration_months: number;
    start_date: string;
    foreman_commission: number;
    status: 'active' | 'completed' | 'cancelled';
    my_turn_month: number | null;
    notes: string | null;
    created_at: string;
  }

  const chitFund = await db.getFirstAsync<ChitFund>('SELECT * FROM chit_funds WHERE id = ?', [chitId]);

  if (!chitFund || chitFund.status !== 'active') return;

  interface ChitMonthlyRecord {
    id: number;
    chit_id: number;
    month_number: number;
    month_date: string;
    amount_paid: number | null;
    payment_date: string | null;
    payment_status: 'pending' | 'paid' | 'missed';
    winner_name: string | null;
    winner_is_me: number;
    bid_amount: number | null;
    pot_amount: number | null;
  }

  const monthlyRecords = await db.getAllAsync<ChitMonthlyRecord>(
    'SELECT month_number, month_date, payment_status FROM chit_monthly_records WHERE chit_id = ?',
    [chitId]
  );

  // Cancel existing chit notifications
  await cancelByPrefix(`${NOTIFICATION_IDS.CHIT_MONTHLY_PREFIX}${chitId}_`);
  await cancelByPrefix(`${NOTIFICATION_IDS.CHIT_WINNING_PREFIX}${chitId}_`);

  // Monthly payment reminders
  if (monthlyEnabled === 'true') {
    for (const record of monthlyRecords) {
      if (record.payment_status === 'paid') continue;

      const monthDate = new Date(record.month_date);
      const today = new Date();
      const daysUntil = differenceInDays(monthDate, today);

      if (daysUntil === 3) {
        await Notifications.scheduleNotificationAsync({
          identifier: `${NOTIFICATION_IDS.CHIT_MONTHLY_PREFIX}${chitId}_month_${record.month_number}_3d`,
          content: {
            title: "🏦 Chit Payment Due in 3 Days",
            body: `${chitFund.name} — Pay ${formatCurrency(chitFund.monthly_amount)} by ${format(monthDate, 'MMM dd')}`,
            sound: true,
            data: {
              type: 'chit_monthly_due',
              chitId,
              chitName: chitFund.name,
              amount: chitFund.monthly_amount,
              monthNumber: record.month_number,
              dueDate: record.month_date,
            },
            categoryIdentifier: 'CHIT_PAYMENT_ACTIONS',
          },
          trigger: setMinutes(setHours(monthDate, 9), 0),
        });
      } else if (daysUntil === 1) {
        await Notifications.scheduleNotificationAsync({
          identifier: `${NOTIFICATION_IDS.CHIT_MONTHLY_PREFIX}${chitId}_month_${record.month_number}_1d`,
          content: {
            title: "⏰ Chit Payment Due Tomorrow",
            body: `${chitFund.name} — ${formatCurrency(chitFund.monthly_amount)} due tomorrow`,
            sound: true,
            data: {
              type: 'chit_monthly_due',
              chitId,
              chitName: chitFund.name,
              amount: chitFund.monthly_amount,
              monthNumber: record.month_number,
              dueDate: record.month_date,
            },
            categoryIdentifier: 'CHIT_PAYMENT_ACTIONS',
          },
          trigger: setMinutes(setHours(monthDate, 9), 0),
        });
      } else if (daysUntil === 0) {
        // Morning reminder
        await Notifications.scheduleNotificationAsync({
          identifier: `${NOTIFICATION_IDS.CHIT_MONTHLY_PREFIX}${chitId}_month_${record.month_number}_0d`,
          content: {
            title: "💰 Chit Payment Due Today",
            body: `${chitFund.name} — Pay ${formatCurrency(chitFund.monthly_amount)} today`,
            sound: true,
            data: {
              type: 'chit_monthly_due',
              chitId,
              chitName: chitFund.name,
              amount: chitFund.monthly_amount,
              monthNumber: record.month_number,
              dueDate: record.month_date,
            },
            categoryIdentifier: 'CHIT_PAYMENT_ACTIONS',
          },
          trigger: setMinutes(setHours(monthDate, 9), 0),
        });

        // Evening reminder
        await Notifications.scheduleNotificationAsync({
          identifier: `${NOTIFICATION_IDS.CHIT_MONTHLY_PREFIX}${chitId}_month_${record.month_number}_eve`,
          content: {
            title: "🔴 Chit Payment Still Pending",
            body: `${chitFund.name} — ${formatCurrency(chitFund.monthly_amount)} not recorded`,
            sound: true,
            data: {
              type: 'chit_monthly_evening',
              chitId,
              chitName: chitFund.name,
              amount: chitFund.monthly_amount,
              monthNumber: record.month_number,
            },
            categoryIdentifier: 'CHIT_PAYMENT_ACTIONS',
          },
          trigger: setMinutes(setHours(monthDate, 19), 0),
        });
      }
    }
  }

  // Winning month notifications
  if (winningEnabled === 'true' && chitFund.my_turn_month) {
    const winningRecord = monthlyRecords.find(r => r.month_number === chitFund.my_turn_month);
    if (winningRecord) {
      const winningDate = new Date(winningRecord.month_date);
      const today = new Date();
      const daysUntil = differenceInDays(winningDate, today);

      // Calculate expected net amount
      const { calculateMonthlyPot, calculateWinnerNetAmount } = await import('../chitfund/ChitEngine');
      const monthlyPotResult = calculateMonthlyPot(chitFund, winningRecord.month_number, winningRecord.bid_amount || 0);
      const netResult = calculateWinnerNetAmount(chitFund, winningRecord.month_number, winningRecord.bid_amount || 0, winningRecord.winner_is_me ? 1 : 0);
      const netReceived = netResult.netReceived;
      const monthlyPot = monthlyPotResult.grossPot;

      if (daysUntil === 30) {
        await Notifications.scheduleNotificationAsync({
          identifier: `${NOTIFICATION_IDS.CHIT_WINNING_PREFIX}${chitId}_win_upcoming`,
          content: {
            title: "🏆 Your Chit Turn is Next Month!",
            body: `${chitFund.name} — You win the pot next month! Expected to receive ${formatCurrency(netReceived)}`,
            sound: true,
            data: {
              type: 'chit_winning_upcoming',
              chitId,
              chitName: chitFund.name,
              netAmount: netReceived,
              monthNumber: chitFund.my_turn_month,
            },
            categoryIdentifier: 'GOAL_ACTIONS',
          },
          trigger: setMinutes(setHours(winningDate, 9), 0),
        });
      } else if (daysUntil === 7) {
        await Notifications.scheduleNotificationAsync({
          identifier: `${NOTIFICATION_IDS.CHIT_WINNING_PREFIX}${chitId}_win_week`,
          content: {
            title: "🎯 Chit Auction Coming Up",
            body: `${chitFund.name} — Your turn in 7 days. Pot value: ${formatCurrency(monthlyPot)}`,
            sound: true,
            data: {
              type: 'chit_winning_week',
              chitId,
              chitName: chitFund.name,
              potAmount: monthlyPot,
              monthNumber: chitFund.my_turn_month,
            },
            categoryIdentifier: 'GOAL_ACTIONS',
          },
          trigger: setMinutes(setHours(winningDate, 9), 0),
        });
      } else if (daysUntil === 0) {
        await Notifications.scheduleNotificationAsync({
          identifier: `${NOTIFICATION_IDS.CHIT_WINNING_PREFIX}${chitId}_win_day`,
          content: {
            title: "🏆 Today is Your Chit Day!",
            body: `${chitFund.name} — Today is your winning month! Expected net: ${formatCurrency(netReceived)}`,
            sound: true,
            data: {
              type: 'chit_winning_day',
              chitId,
              chitName: chitFund.name,
              netAmount: netReceived,
              monthNumber: chitFund.my_turn_month,
            },
            categoryIdentifier: 'GOAL_ACTIONS',
          },
          trigger: setMinutes(setHours(winningDate, 9), 0),
        });
      }
    }
  }
};

export const cancelChitNotifications = async (chitId: number): Promise<void> => {
  await cancelByPrefix(`${NOTIFICATION_IDS.CHIT_MONTHLY_PREFIX}${chitId}_`);
  await cancelByPrefix(`${NOTIFICATION_IDS.CHIT_WINNING_PREFIX}${chitId}_`);
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SAVINGS GOALS NOTIFICATIONS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const checkSavingsGoalMilestones = async (): Promise<void> => {
  const hasPermission = await checkAndRequestPermission();
  if (!hasPermission) return;

  const masterEnabled = await AsyncStorage.getItem(SETTINGS_KEYS.NOTIF_MASTER_ENABLED);
  const goalsEnabled = await AsyncStorage.getItem(SETTINGS_KEYS.NOTIF_SAVINGS_GOALS);
  
  if (masterEnabled !== 'true' || goalsEnabled !== 'true') return;

  const db = getDatabase();
  if (!db) return;

  interface SavingsGoal {
    id: number;
    name: string;
    target_amount: number;
    current_amount: number;
    target_date: string | null;
    status: string;
  }

  const goals = await db.getAllAsync<SavingsGoal>('SELECT * FROM savings_goals WHERE status = "active"');

  for (const goal of goals) {
    const percentage = (goal.current_amount / goal.target_amount) * 100;
    const remaining = goal.target_amount - goal.current_amount;

    // Check milestones
    const milestones = [
      { threshold: 25, suffix: '25', title: '🎯 25% of the Way There!', body: `You've saved ${formatCurrency(goal.current_amount)} toward ${goal.name}. ${formatCurrency(remaining)} to go!` },
      { threshold: 50, suffix: '50', title: '🌟 Halfway to Your Goal!', body: `${goal.name} — 50% complete! ${formatCurrency(remaining)} more to go.` },
      { threshold: 75, suffix: '75', title: '🔥 Almost There — 75%!', body: `${goal.name} — Just ${formatCurrency(remaining)} left!` },
      { threshold: 100, suffix: '100', title: '🎉 Goal Achieved!', body: `You've reached your ${goal.name} goal of ${formatCurrency(goal.target_amount)}! Congratulations!` },
    ];

    for (const milestone of milestones) {
      if (percentage >= milestone.threshold) {
        const milestoneKey = `goal_${goal.id}_milestone_${milestone.suffix}`;
        const alreadyNotified = await AsyncStorage.getItem(milestoneKey);
        
        if (!alreadyNotified) {
          await Notifications.scheduleNotificationAsync({
            identifier: `${NOTIFICATION_IDS.SAVINGS_GOAL_PREFIX}${goal.id}_${milestone.suffix}`,
            content: {
              title: milestone.title,
              body: milestone.body,
              sound: true,
              data: {
                type: 'savings_milestone',
                goalId: goal.id,
                goalName: goal.name,
                milestone: milestone.threshold,
                currentAmount: goal.current_amount,
                targetAmount: goal.target_amount,
              },
              categoryIdentifier: 'GOAL_ACTIONS',
            },
            trigger: null, // Fire immediately
          });

          await AsyncStorage.setItem(milestoneKey, 'true');

          // Trigger celebration for 100% milestone
          if (milestone.threshold === 100) {
            // This would trigger existing celebration system
            console.log('🎉 Goal achieved! Trigger celebration for', goal.name);
          }
        }
      }
    }

    // Deadline reminders
    if (goal.target_date) {
      const targetDate = new Date(goal.target_date);
      const today = new Date();
      const daysUntil = differenceInDays(targetDate, today);

      if (daysUntil === 30) {
        await Notifications.scheduleNotificationAsync({
          identifier: `${NOTIFICATION_IDS.SAVINGS_GOAL_PREFIX}${goal.id}_deadline_30`,
          content: {
            title: "📅 Goal Deadline in 30 Days",
            body: `${goal.name} — You need ${formatCurrency(remaining)} more in 30 days. Save ${formatCurrency(remaining / 30)}/day.`,
            sound: true,
            data: {
              type: 'savings_deadline',
              goalId: goal.id,
              goalName: goal.name,
              remaining,
              daysLeft: 30,
            },
            categoryIdentifier: 'GOAL_ACTIONS',
          },
          trigger: setMinutes(setHours(targetDate, 10), 0),
        });
      } else if (daysUntil === 7) {
        await Notifications.scheduleNotificationAsync({
          identifier: `${NOTIFICATION_IDS.SAVINGS_GOAL_PREFIX}${goal.id}_deadline_7`,
          content: {
            title: "⚠️ Goal Deadline in 7 Days",
            body: `${goal.name} — ${formatCurrency(remaining)} still needed. Save ${formatCurrency(remaining / 7)}/day to make it!`,
            sound: true,
            data: {
              type: 'savings_deadline',
              goalId: goal.id,
              goalName: goal.name,
              remaining,
              daysLeft: 7,
            },
            categoryIdentifier: 'GOAL_ACTIONS',
          },
          trigger: setMinutes(setHours(targetDate, 10), 0),
        });
      } else if (daysUntil === 0) {
        await Notifications.scheduleNotificationAsync({
          identifier: `${NOTIFICATION_IDS.SAVINGS_GOAL_PREFIX}${goal.id}_deadline_0`,
          content: {
            title: "📅 Goal Deadline Today",
            body: `${goal.name} deadline is today. ${formatCurrency(remaining)} still remaining.`,
            sound: true,
            data: {
              type: 'savings_deadline',
              goalId: goal.id,
              goalName: goal.name,
              remaining,
              daysLeft: 0,
            },
            categoryIdentifier: 'GOAL_ACTIONS',
          },
          trigger: setMinutes(setHours(targetDate, 10), 0),
        });
      }
    }
  }
};

export const cancelSavingsGoalNotifications = async (goalId: number): Promise<void> => {
  await cancelByPrefix(`${NOTIFICATION_IDS.SAVINGS_GOAL_PREFIX}${goalId}_`);
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// BUDGET ALERT NOTIFICATIONS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const checkBudgetAlerts = async (): Promise<void> => {
  const hasPermission = await checkAndRequestPermission();
  if (!hasPermission) return;

  const masterEnabled = await AsyncStorage.getItem(SETTINGS_KEYS.NOTIF_MASTER_ENABLED);
  const budgetEnabled = await AsyncStorage.getItem(SETTINGS_KEYS.NOTIF_BUDGET_ALERTS);
  
  if (masterEnabled !== 'true' || budgetEnabled !== 'true') return;

  const db = getDatabase();
  if (!db) return;

  const currentMonth = new Date().toISOString().substring(0, 7);
  
  interface Budget {
    id: number;
    category: string;
    amount: number;
    spent: number;
  }

  const budgets = await db.getAllAsync<Budget>(`
    SELECT 
      cb.id, cb.category, cb.amount, 
      COALESCE(SUM(t.amount), 0) as spent
    FROM category_budgets cb
    LEFT JOIN transactions t ON cb.category = t.category AND t.date LIKE ?
    WHERE cb.is_active = 1
    GROUP BY cb.id, cb.category, cb.amount
  `, [`${currentMonth}-%`]);

  for (const budget of budgets) {
    const percentage = (budget.spent / budget.amount) * 100;
    const remaining = budget.amount - budget.spent;
    const monthKey = `${currentMonth.replace('-', '_')}`;

    // 80% warning
    if (percentage >= 80 && percentage < 90) {
      const key = `budget_${budget.id}_80_${monthKey}`;
      const alreadyNotified = await AsyncStorage.getItem(key);
      
      if (!alreadyNotified) {
        await Notifications.scheduleNotificationAsync({
          identifier: `${NOTIFICATION_IDS.BUDGET_ALERT_PREFIX}${budget.id}_80`,
          content: {
            title: "⚠️ Budget Warning",
            body: `${budget.category} budget is 80% used. ${formatCurrency(remaining)} left for this month.`,
            sound: true,
            data: {
              type: 'budget_warning',
              budgetId: budget.id,
              category: budget.category,
              percentage: 80,
              remaining,
            },
            categoryIdentifier: 'BUDGET_ACTIONS',
          },
          trigger: null, // Fire immediately
        });

        await AsyncStorage.setItem(key, 'true');
      }
    }

    // 90% warning
    if (percentage >= 90 && percentage < 100) {
      const key = `budget_${budget.id}_90_${monthKey}`;
      const alreadyNotified = await AsyncStorage.getItem(key);
      
      if (!alreadyNotified) {
        await Notifications.scheduleNotificationAsync({
          identifier: `${NOTIFICATION_IDS.BUDGET_ALERT_PREFIX}${budget.id}_90`,
          content: {
            title: "🔴 Budget Almost Exhausted",
            body: `${budget.category} — Only ${formatCurrency(remaining)} left in budget!`,
            sound: true,
            data: {
              type: 'budget_critical',
              budgetId: budget.id,
              category: budget.category,
              percentage: 90,
              remaining,
            },
            categoryIdentifier: 'BUDGET_ACTIONS',
          },
          trigger: null, // Fire immediately
        });

        await AsyncStorage.setItem(key, 'true');
      }
    }

    // Exceeded budget
    if (percentage >= 100) {
      const overAmount = budget.spent - budget.amount;
      const tier = Math.floor(overAmount / 500) * 500; // Group by ₹500 increments
      const key = `budget_${budget.id}_exceeded_${tier}`;
      const alreadyNotified = await AsyncStorage.getItem(key);
      
      if (!alreadyNotified) {
        await Notifications.scheduleNotificationAsync({
          identifier: `${NOTIFICATION_IDS.BUDGET_ALERT_PREFIX}${budget.id}_exceeded_${tier}`,
          content: {
            title: "❗ Budget Exceeded",
            body: `You've exceeded your ${budget.category} budget by ${formatCurrency(overAmount)}`,
            sound: true,
            data: {
              type: 'budget_exceeded',
              budgetId: budget.id,
              category: budget.category,
              overAmount,
            },
            categoryIdentifier: 'BUDGET_ACTIONS',
          },
          trigger: null, // Fire immediately
        });

        await AsyncStorage.setItem(key, 'true');
      }
    }
  }
};

export const scheduleMonthlyBudgetReview = async (): Promise<void> => {
  const hasPermission = await checkAndRequestPermission();
  if (!hasPermission) return;

  const masterEnabled = await AsyncStorage.getItem(SETTINGS_KEYS.NOTIF_MASTER_ENABLED);
  const budgetEnabled = await AsyncStorage.getItem(SETTINGS_KEYS.NOTIF_BUDGET_ALERTS);
  
  if (masterEnabled !== 'true' || budgetEnabled !== 'true') return;

  // Schedule for 28th of each month at 10 AM
  await Notifications.scheduleNotificationAsync({
    identifier: 'budget_monthly_review',
    content: {
      title: "📊 Month Ending Soon — Budget Review",
      body: "You have active budgets. Review your spending before month end.",
      sound: true,
      data: {
        type: 'budget_monthly_review',
        screen: '/(tabs)/analytics',
      },
      categoryIdentifier: 'BUDGET_ACTIONS',
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.MONTHLY,
      day: 28,
      hour: 10,
      minute: 0,
    },
  });
};

export const cancelBudgetNotifications = async (budgetId: number): Promise<void> => {
  await cancelByPrefix(`${NOTIFICATION_IDS.BUDGET_ALERT_PREFIX}${budgetId}_`);
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// MIGRATE EXISTING NOTIFICATIONS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const migrateExistingNotifications = async (): Promise<void> => {
  try {
    // Import existing notification services and migrate their functionality
    const { scheduleRenewalReminder } = await import('../subscriptions');
    const { getSubscriptions } = await import('../subscriptions');
    
    const subscriptions = await getSubscriptions();
    for (const sub of subscriptions) {
      await scheduleRenewalReminder(sub);
    }

    // Schedule existing payment notifications
    const { schedulePaymentNotifications } = await import('../paymentNotifications');
    const db = getDatabase();
    if (db) {
      interface Bill {
        id: number;
        name: string;
        amount: number;
        due_date: string;
      }

      const bills = await db.getAllAsync<Bill>(
        'SELECT * FROM bill_groups'
      );
      for (const bill of bills) {
        await schedulePaymentNotifications({
          id: bill.id,
          type: 'bill',
          name: bill.name,
          amount: bill.amount,
          dueDate: bill.due_date,
        });
      }

      // Schedule EMI notifications
      const emiRecords = await db.getAllAsync<{ id: number }>(
        'SELECT id FROM emi_records WHERE status = "active"'
      );
      for (const emi of emiRecords) {
        await scheduleEMINotifications(emi.id);
      }
    }
  } catch (error) {
    console.error('Error migrating existing notifications:', error);
  }
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// RESCHEDULE ALL NOTIFICATIONS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const rescheduleAll = async (): Promise<void> => {
  try {
    console.log('🔄 Rescheduling all notifications...');
    
    // Cancel all existing notifications first
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    for (const notification of scheduled) {
      await Notifications.cancelScheduledNotificationAsync(notification.identifier);
    }

    // Setup channels and categories
    await setupNotificationChannels();
    await setupNotificationCategories();

    // Reschedule daily notifications
    await scheduleDailyReminder();
    await scheduleDailyReport();

    // Reschedule monthly budget review
    await scheduleMonthlyBudgetReview();

    // Reschedule debt notifications
    const db = getDatabase();
    if (db) {
      const debts = await db.getAllAsync<{ id: number }>('SELECT id FROM debt_records WHERE status = "active"');
      for (const debt of debts) {
        await scheduleDebtNotifications(debt.id);
      }

      // Reschedule chit fund notifications
      const chitFunds = await db.getAllAsync<{ id: number }>('SELECT id FROM chit_funds WHERE status = "active"');
      for (const chit of chitFunds) {
        await scheduleChitNotifications(chit.id);
      }

      // Reschedule EMI notifications
      const emiRecords = await db.getAllAsync<{ id: number }>('SELECT id FROM emi_records WHERE status = "active"');
      for (const emi of emiRecords) {
        await scheduleEMINotifications(emi.id);
      }
    }

    // Migrate existing notifications
    await migrateExistingNotifications();

    console.log('✅ All notifications rescheduled successfully');
  } catch (error) {
    console.error('❌ Error rescheduling notifications:', error);
  }
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// EMI NOTIFICATIONS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const scheduleEMINotifications = async (emiId: number): Promise<void> => {
  try {
    const db = getDatabase();
    if (!db) return;

    const masterEnabled = await AsyncStorage.getItem(SETTINGS_KEYS.NOTIF_MASTER_ENABLED);
    const emiRemindersEnabled = await AsyncStorage.getItem(SETTINGS_KEYS.NOTIF_EMI_REMINDERS);

    if (masterEnabled !== 'true' || emiRemindersEnabled !== 'true') {
      return;
    }

    const emiRecord = await db.getFirstAsync<{
      id: number;
      name: string;
      lender_name: string | null;
      emi_amount: number;
      due_day: number;
    }>('SELECT * FROM emi_records WHERE id = ?', [emiId]);

    if (!emiRecord) return;

    const payments = await db.getAllAsync<{
      id: number;
      month_number: number;
      due_date: string;
      payment_status: string;
    }>('SELECT * FROM emi_payments WHERE emi_id = ? AND payment_status = "pending"', [emiId]);

    const today = new Date();

    for (const payment of payments) {
      const dueDate = parseISO(payment.due_date);
      const daysUntilDue = differenceInDays(dueDate, today);

      // Schedule reminders at 7 days, 3 days, and 1 day before due date
      const reminderDays = [7, 3, 1];

      for (const days of reminderDays) {
        if (daysUntilDue === days) {
          const reminderDate = addDays(today, days);
          const notificationId = `${NOTIFICATION_IDS.EMI_PREFIX}${emiId}_${payment.month_number}_${days}d`;

          await Notifications.scheduleNotificationAsync({
            content: {
              title: `EMI Payment Due in ${days} Day${days > 1 ? 's' : ''}`,
              body: `${emiRecord.name}${emiRecord.lender_name ? ` (${emiRecord.lender_name})` : ''} - ${formatCurrency(emiRecord.emi_amount)} due on ${format(dueDate, 'MMM dd')}`,
              data: {
                screen: '/emi-tracker/detail',
                itemId: emiId,
                itemType: 'emi',
                itemAmount: emiRecord.emi_amount,
                itemName: emiRecord.name,
              },
              categoryIdentifier: 'emi-reminders',
            },
            trigger: {
              date: reminderDate,
              channelId: 'emi-reminders',
            },
          });
        }
      }

      // Schedule on due date
      if (daysUntilDue === 0) {
        const notificationId = `${NOTIFICATION_IDS.EMI_PREFIX}${emiId}_${payment.month_number}_0d`;

        await Notifications.scheduleNotificationAsync({
          content: {
            title: `EMI Payment Due Today`,
            body: `${emiRecord.name}${emiRecord.lender_name ? ` (${emiRecord.lender_name})` : ''} - ${formatCurrency(emiRecord.emi_amount)} is due today`,
            data: {
              screen: '/emi-tracker/detail',
              itemId: emiId,
              itemType: 'emi',
              itemAmount: emiRecord.emi_amount,
              itemName: emiRecord.name,
            },
            categoryIdentifier: 'emi-reminders',
          },
          trigger: {
            date: setHours(setMinutes(today, 0), 9),
            channelId: 'emi-reminders',
          },
        });
      }

      // Schedule overdue notification
      if (daysUntilDue < 0 && Math.abs(daysUntilDue) <= 7) {
        const notificationId = `${NOTIFICATION_IDS.EMI_PREFIX}${emiId}_${payment.month_number}_overdue`;

        await Notifications.scheduleNotificationAsync({
          content: {
            title: `EMI Payment Overdue`,
            body: `${emiRecord.name}${emiRecord.lender_name ? ` (${emiRecord.lender_name})` : ''} - ${formatCurrency(emiRecord.emi_amount)} was due on ${format(dueDate, 'MMM dd')}`,
            data: {
              screen: '/emi-tracker/detail',
              itemId: emiId,
              itemType: 'emi',
              itemAmount: emiRecord.emi_amount,
              itemName: emiRecord.name,
            },
            categoryIdentifier: 'emi-reminders',
          },
          trigger: {
            date: setHours(setMinutes(today, 9), 9),
            channelId: 'emi-reminders',
          },
        });
      }
    }
  } catch (error) {
    console.error('Error scheduling EMI notifications:', error);
  }
};

export const cancelEMINotifications = async (emiId: number): Promise<void> => {
  try {
    await cancelByPrefix(`${NOTIFICATION_IDS.EMI_PREFIX}${emiId}_`);
  } catch (error) {
    console.error('Error cancelling EMI notifications:', error);
  }
};

export const scheduleEMIAutoPayNotification = async (
  emiId: number,
  paymentId: number,
  amount: number,
  emiName: string
): Promise<void> => {
  try {
    const masterEnabled = await AsyncStorage.getItem(SETTINGS_KEYS.NOTIF_MASTER_ENABLED);
    const emiAutopayEnabled = await AsyncStorage.getItem(SETTINGS_KEYS.NOTIF_EMI_AUTOPAY);

    if (masterEnabled !== 'true' || emiAutopayEnabled !== 'true') {
      return;
    }

    const notificationId = `${NOTIFICATION_IDS.EMI_AUTOPAY_PREFIX}${emiId}_${paymentId}`;

    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'EMI AutoPay Successful',
        body: `${emiName} - ${formatCurrency(amount)} has been automatically paid`,
        data: {
          screen: '/emi-tracker/detail',
          itemId: emiId,
          itemType: 'emi',
        },
        categoryIdentifier: 'emi-autopay',
      },
      trigger: {
        date: new Date(),
        channelId: 'emi-autopay',
      },
    });
  } catch (error) {
    console.error('Error scheduling EMI AutoPay notification:', error);
  }
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// INITIALIZATION
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const initializeNotificationManager = async (): Promise<void> => {
  try {
    // Configure notification handler
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });

    // Setup channels and categories
    await setupNotificationChannels();
    await setupNotificationCategories();

    // Reschedule all notifications on app start
    await rescheduleAll();

    console.log('🔔 Notification Manager initialized successfully');
  } catch (error) {
    console.warn('⚠️ Notification Manager initialization failed:', error);
  }
};
