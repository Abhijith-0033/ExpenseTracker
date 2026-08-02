import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';
import { initDatabase, getDatabase, addTransactionDirect } from '../../services/database';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SETTINGS_KEYS } from '../../services/notifications/NotificationManager';

const TASK_NAME = 'SCHEDULED_EXPENSE_CHECK';

TaskManager.defineTask(TASK_NAME, async () => {
  try {
    await checkAndProcessScheduled();
    return BackgroundFetch.BackgroundFetchResult.NewData;
  } catch (e) {
    console.error('Scheduled expense background task failed:', e);
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

export async function registerScheduledExpenseTask() {
  try {
    await BackgroundFetch.registerTaskAsync(TASK_NAME, {
      minimumInterval: 15 * 60, // 15 minutes
      stopOnTerminate: false,
      startOnBoot: true,
    });
  } catch (e) {
    console.warn('Background task registration failed:', e);
  }
}

export async function unregisterScheduledExpenseTask() {
  try {
    await BackgroundFetch.unregisterTaskAsync(TASK_NAME);
  } catch (e) {
    console.warn('Background task unregistration failed:', e);
  }
}

export async function checkAndProcessScheduled() {
  await initDatabase();
  const db = getDatabase();
  const now = new Date();
  const todayDayOfWeek = now.getDay() + 1; // 1=Sun...7=Sat
  const todayISO = now.toISOString().split('T')[0];
  const currentHour = now.getHours().toString().padStart(2, '0');
  const currentMin = now.getMinutes().toString().padStart(2, '0');
  const currentTime = `${currentHour}:${currentMin}`;
  
  // 1. Process today's scheduled expenses
  const schedules = await db.getAllAsync(`
    SELECT se.*, c.name as category_name, a.name as account_name,
           cs.name as subcategory_name
    FROM scheduled_expenses se
    LEFT JOIN categories c ON se.category_id = c.id
    LEFT JOIN accounts a ON se.account_id = a.id
    LEFT JOIN category_subcategories cs ON se.subcategory_id = cs.id
    WHERE se.is_active = 1
    AND se.status = 'active'
    AND se.scheduled_time <= ?
    AND (se.last_created_date IS NULL OR se.last_created_date < ?)
  `, [currentTime, todayISO]);
  
  for (const se of schedules) {
    let daysArray;
    try {
      daysArray = JSON.parse(se.days_of_week);
    } catch {
      continue;
    }
    if (!daysArray.includes(todayDayOfWeek)) continue;
    
    const existingLog = await db.getFirstAsync(`
      SELECT id FROM scheduled_expense_log
      WHERE scheduled_expense_id = ? AND scheduled_date = ?
      AND action IN ('auto_created', 'approved', 'rejected', 'pending', 'missed')
    `, [se.id, todayISO]);
    
    if (existingLog) continue;
    
    if (se.auto_create === 1) {
      await autoCreateExpense(se, todayISO);
    } else {
      await sendApprovalNotification(se, todayISO);
    }
  }

  // 2. 7-day historical catch-up for days the user missed/app wasn't running
  for (let i = 1; i <= 7; i++) {
    const pastDate = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    const pastISO = pastDate.toISOString().split('T')[0];
    const pastDayOfWeek = pastDate.getDay() + 1;

    const pastSchedules = await db.getAllAsync(`
      SELECT se.*, c.name as category_name, a.name as account_name,
             cs.name as subcategory_name
      FROM scheduled_expenses se
      LEFT JOIN categories c ON se.category_id = c.id
      LEFT JOIN accounts a ON se.account_id = a.id
      LEFT JOIN category_subcategories cs ON se.subcategory_id = cs.id
      WHERE se.is_active = 1
      AND se.status = 'active'
      AND date(se.created_at) <= ?
      AND (se.last_created_date IS NULL OR se.last_created_date < ?)
    `, [pastISO, pastISO]);

    for (const se of pastSchedules) {
      let daysArray;
      try {
        daysArray = JSON.parse(se.days_of_week);
      } catch {
        continue;
      }
      if (!daysArray.includes(pastDayOfWeek)) continue;

      const existingLog = await db.getFirstAsync(`
        SELECT id FROM scheduled_expense_log
        WHERE scheduled_expense_id = ? AND scheduled_date = ?
      `, [se.id, pastISO]);

      if (existingLog) continue;

      if (se.auto_create === 1) {
        // Auto-create schedules that are missed are logged as 'missed' to avoid retroactive transactions
        await db.runAsync(`
          INSERT INTO scheduled_expense_log 
            (scheduled_expense_id, scheduled_date, scheduled_time, action, amount)
          VALUES (?, ?, ?, 'missed', ?)
        `, [se.id, pastISO, se.scheduled_time, se.amount]);
      } else {
        // Manual approval schedules remain 'pending' so user can approve them anytime
        await db.runAsync(`
          INSERT INTO scheduled_expense_log 
            (scheduled_expense_id, scheduled_date, scheduled_time, action, amount)
          VALUES (?, ?, ?, 'pending', ?)
        `, [se.id, pastISO, se.scheduled_time, se.amount]);
      }
    }
  }
}

async function autoCreateExpense(se, todayISO) {
  const db = getDatabase();
  
  try {
    // Create transaction using direct function (bypass limits/throttles)
    const txId = await addTransactionDirect({
      amount: se.amount,
      category: se.category_name || 'Other',
      subcategory: se.subcategory_name || '',
      account_id: se.account_id,
      date: new Date().toISOString(),
      description: se.description || `Auto: ${se.name}`,
      source: 'scheduled',
    });
    
    // Update last_created_date
    await db.runAsync(
      'UPDATE scheduled_expenses SET last_created_date = ?, updated_at = datetime(\'now\') WHERE id = ?',
      [todayISO, se.id]
    );
    
    // Log the action
    await db.runAsync(`
      INSERT INTO scheduled_expense_log 
        (scheduled_expense_id, scheduled_date, scheduled_time, action, transaction_id, amount)
      VALUES (?, ?, ?, 'auto_created', ?, ?)
    `, [se.id, todayISO, se.scheduled_time, txId, se.amount]);
    
    // Check setting for auto-create notification
    const masterEnabled = await AsyncStorage.getItem(SETTINGS_KEYS.NOTIF_MASTER_ENABLED);
    const autoConfirmEnabled = await AsyncStorage.getItem(SETTINGS_KEYS.NOTIF_SCHED_AUTO_CONFIRM);
    
    if (masterEnabled !== 'false' && autoConfirmEnabled !== 'false') {
      // Send confirmation notification
      await Notifications.scheduleNotificationAsync({
        identifier: `sched_created_${se.id}_${todayISO}`,
        content: {
          title: '✅ Auto-expense created',
          body: `₹${se.amount} added for ${se.name} (${se.category_name})`,
          sound: true,
          data: { type: 'sched_auto_created', schedId: se.id },
          channelId: 'scheduled-expenses',
        },
        trigger: null,
      });
    }
  } catch (e) {
    console.error('Auto-create expense failed:', e);
  }
}

async function sendApprovalNotification(se, todayISO) {
  const db = getDatabase();
  
  // Check settings for approval notification
  const masterEnabled = await AsyncStorage.getItem(SETTINGS_KEYS.NOTIF_MASTER_ENABLED);
  const approvalEnabled = await AsyncStorage.getItem(SETTINGS_KEYS.NOTIF_SCHED_APPROVAL);
  
  if (masterEnabled === 'false' || approvalEnabled === 'false') {
    return; // User disabled approvals
  }

  const notifId = `sched_pending_${se.id}_${todayISO}`;
  
  // Insert pending log
  const result = await db.runAsync(`
    INSERT INTO scheduled_expense_log 
      (scheduled_expense_id, scheduled_date, scheduled_time, action, amount, notification_id)
    VALUES (?, ?, ?, 'pending', ?, ?)
  `, [se.id, todayISO, se.scheduled_time, se.amount, notifId]);
  
  const logId = result.lastInsertRowId;
  
  // Schedule approval notification with action buttons
  await Notifications.scheduleNotificationAsync({
    identifier: notifId,
    content: {
      title: `💸 Expense Due: ${se.name}`,
      body: `₹${se.amount} · ${se.category_name || 'Other'} · ${se.account_name || 'Account'}\nTap to approve or reject`,
      sound: true,
      data: {
        type: 'sched_approval',
        schedId: se.id,
        logId,
      },
      categoryIdentifier: 'SCHED_APPROVAL_ACTIONS',
      channelId: 'scheduled-expenses',
    },
    trigger: null,
  });
}

/**
 * Approve a scheduled expense.
 * @param {number|null} logId
 * @param {number|null} [schedId=null]
 * @param {string|null} [dateISO=null]
 */
export async function approveScheduled(logId, schedId = null, dateISO = null) {
  await initDatabase();
  const db = getDatabase();
  let resolvedLogId = logId;
  
  try {
    if (!resolvedLogId && schedId && dateISO) {
      const existing = await db.getFirstAsync(
        `SELECT id FROM scheduled_expense_log 
         WHERE scheduled_expense_id = ? AND scheduled_date = ? 
         AND action IN ('pending', 'auto_created', 'approved', 'rejected')`,
        [schedId, dateISO]
      );
      if (existing) {
        resolvedLogId = existing.id;
      } else {
        const se = await db.getFirstAsync(`SELECT * FROM scheduled_expenses WHERE id = ?`, [schedId]);
        const result = await db.runAsync(
          `INSERT INTO scheduled_expense_log (scheduled_expense_id, scheduled_date, scheduled_time, action, amount)
           VALUES (?, ?, ?, 'pending', ?)`,
          [schedId, dateISO, se?.scheduled_time || '00:00', se?.amount || 0]
        );
        resolvedLogId = result.lastInsertRowId;
      }
    }

    if (!resolvedLogId) return;

    const log = await db.getFirstAsync(
      'SELECT * FROM scheduled_expense_log WHERE id = ?', [resolvedLogId]
    );
    if (!log || log.action !== 'pending') return;
    
    const se = await db.getFirstAsync(`
      SELECT se.*, c.name as category_name, cs.name as subcategory_name
      FROM scheduled_expenses se
      LEFT JOIN categories c ON se.category_id = c.id
      LEFT JOIN category_subcategories cs ON se.subcategory_id = cs.id
      WHERE se.id = ?
    `, [log.scheduled_expense_id]);
    if (!se) return;
    
    // Create the transaction
    const txId = await addTransactionDirect({
      amount: log.amount,
      category: se.category_name || 'Other',
      subcategory: se.subcategory_name || '',
      account_id: se.account_id,
      date: new Date().toISOString(),
      description: se.description || `Approved: ${se.name}`,
      source: 'scheduled',
    });
    
    // Update log
    await db.runAsync(
      `UPDATE scheduled_expense_log SET action = 'approved', transaction_id = ? WHERE id = ?`,
      [txId, resolvedLogId]
    );
    
    // Update last_created_date
    await db.runAsync(
      `UPDATE scheduled_expenses SET last_created_date = ?, updated_at = datetime('now') WHERE id = ?`,
      [log.scheduled_date, se.id]
    );
    
    // Cancel pending notification
    if (log.notification_id) {
      await Notifications.cancelScheduledNotificationAsync(log.notification_id).catch(() => {});
    }
    
    // Show brief confirmation
    await Notifications.scheduleNotificationAsync({
      identifier: `sched_approved_${resolvedLogId}`,
      content: {
        title: `✅ ${se.name} expense saved`,
        body: `₹${log.amount} added to your account`,
        sound: true,
        data: { type: 'sched_approved' },
        channelId: 'scheduled-expenses',
      },
      trigger: null,
    });
  } catch (e) {
    console.error('approveScheduled failed:', e);
  }
}

/**
 * Reject a scheduled expense.
 * @param {number|null} logId
 * @param {number|null} [schedId=null]
 * @param {string|null} [dateISO=null]
 */
export async function rejectScheduled(logId, schedId = null, dateISO = null) {
  await initDatabase();
  const db = getDatabase();
  let resolvedLogId = logId;
  
  try {
    if (!resolvedLogId && schedId && dateISO) {
      const existing = await db.getFirstAsync(
        `SELECT id FROM scheduled_expense_log 
         WHERE scheduled_expense_id = ? AND scheduled_date = ? 
         AND action IN ('pending', 'auto_created', 'approved', 'rejected')`,
        [schedId, dateISO]
      );
      if (existing) {
        resolvedLogId = existing.id;
      } else {
        const se = await db.getFirstAsync(`SELECT * FROM scheduled_expenses WHERE id = ?`, [schedId]);
        const result = await db.runAsync(
          `INSERT INTO scheduled_expense_log (scheduled_expense_id, scheduled_date, scheduled_time, action, amount)
           VALUES (?, ?, ?, 'pending', ?)`,
          [schedId, dateISO, se?.scheduled_time || '00:00', se?.amount || 0]
        );
        resolvedLogId = result.lastInsertRowId;
      }
    }

    if (!resolvedLogId) return;

    const log = await db.getFirstAsync(
      'SELECT * FROM scheduled_expense_log WHERE id = ?', [resolvedLogId]
    );
    if (!log || log.action !== 'pending') return;
    
    await db.runAsync(
      `UPDATE scheduled_expense_log SET action = 'rejected' WHERE id = ?`,
      [resolvedLogId]
    );
    
    if (log.notification_id) {
      await Notifications.cancelScheduledNotificationAsync(log.notification_id).catch(() => {});
    }
    
    await Notifications.scheduleNotificationAsync({
      identifier: `sched_rejected_${resolvedLogId}`,
      content: {
        title: '❌ Expense rejected',
        body: `₹${log.amount} scheduled expense was rejected`,
        sound: false,
        data: { type: 'sched_rejected' },
        channelId: 'scheduled-expenses',
      },
      trigger: null,
    });
  } catch (e) {
    console.error('rejectScheduled failed:', e);
  }
}

export async function scheduleNotificationsForExpense(se) {
  // Cancel existing first to prevent duplicates
  await cancelNotificationsForExpense(se.id);

  const daysArray = JSON.parse(se.days_of_week);
  const [hour, minute] = se.scheduled_time.split(':').map(Number);
  
  for (const day of daysArray) {
    // Day: 1=Sun...7=Sat → weekday: 1=Sun...7=Sat in expo-notifications
    await Notifications.scheduleNotificationAsync({
      identifier: `sched_trigger_${se.id}_day${day}`,
      content: {
        title: `💸 Scheduled: ${se.name}`,
        body: se.auto_create === 1
          ? `₹${se.amount} scheduled expense is due`
          : `₹${se.amount} scheduled expense is due. Tap to approve or reject`,
        sound: true,
        data: { type: 'sched_trigger', schedId: se.id },
        categoryIdentifier: se.auto_create === 0 ? 'SCHED_APPROVAL_ACTIONS' : undefined,
        channelId: 'scheduled-expenses',
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
        weekday: day,
        hour,
        minute,
        channelId: 'scheduled-expenses',
      },
    });
  }
}

export async function cancelNotificationsForExpense(schedId) {
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    for (const notif of scheduled) {
      if (notif.identifier.startsWith(`sched_trigger_${schedId}_`) ||
          notif.identifier.startsWith(`sched_pending_${schedId}_`)) {
        await Notifications.cancelScheduledNotificationAsync(notif.identifier).catch(() => {});
      }
    }
  } catch (e) {
    console.warn('cancelNotificationsForExpense failed:', e);
  }
}

export async function setupForegroundScheduledCheck() {
  try {
    await checkAndProcessScheduled();
  } catch (e) {
    console.warn('setupForegroundScheduledCheck failed:', e);
  }
}

