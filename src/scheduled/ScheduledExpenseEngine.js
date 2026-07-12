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
  
  // Query active scheduled expenses due today
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
    // Check if today is a scheduled day
    let daysArray;
    try {
      daysArray = JSON.parse(se.days_of_week);
    } catch {
      continue;
    }
    if (!daysArray.includes(todayDayOfWeek)) continue;
    
    // Check if already logged/processed today
    const existingLog = await db.getFirstAsync(`
      SELECT id FROM scheduled_expense_log
      WHERE scheduled_expense_id = ? AND scheduled_date = ?
      AND action IN ('auto_created', 'approved', 'rejected', 'pending')
    `, [se.id, todayISO]);
    
    if (existingLog) continue;
    
    if (se.auto_create === 1) {
      await autoCreateExpense(se, todayISO);
    } else {
      await sendApprovalNotification(se, todayISO);
    }
  }
  
  // Mark old pending logs as missed
  await markMissedLogs(db, todayISO);
}

async function autoCreateExpense(se, todayISO) {
  const db = getDatabase();
  
  try {
    // Create transaction using direct function (bypass limits/throttles)
    const txId = await addTransactionDirect({
      amount: se.amount,
      category: se.category_name,
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
    
    if (masterEnabled === 'true' && autoConfirmEnabled === 'true') {
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
  
  if (masterEnabled !== 'true' || approvalEnabled !== 'true') {
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
      body: `₹${se.amount} · ${se.category_name} · ${se.account_name}\nTap to approve or reject`,
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

export async function approveScheduled(logId) {
  await initDatabase();
  const db = getDatabase();
  
  try {
    const log = await db.getFirstAsync(
      'SELECT * FROM scheduled_expense_log WHERE id = ?', [logId]
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
      category: se.category_name,
      subcategory: se.subcategory_name || '',
      account_id: se.account_id,
      date: new Date().toISOString(),
      description: se.description || `Approved: ${se.name}`,
      source: 'scheduled',
    });
    
    // Update log
    await db.runAsync(
      `UPDATE scheduled_expense_log SET action = 'approved', transaction_id = ? WHERE id = ?`,
      [txId, logId]
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
      identifier: `sched_approved_${logId}`,
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

export async function rejectScheduled(logId) {
  await initDatabase();
  const db = getDatabase();
  
  try {
    const log = await db.getFirstAsync(
      'SELECT * FROM scheduled_expense_log WHERE id = ?', [logId]
    );
    if (!log || log.action !== 'pending') return;
    
    await db.runAsync(
      `UPDATE scheduled_expense_log SET action = 'rejected' WHERE id = ?`,
      [logId]
    );
    
    if (log.notification_id) {
      await Notifications.cancelScheduledNotificationAsync(log.notification_id).catch(() => {});
    }
    
    await Notifications.scheduleNotificationAsync({
      identifier: `sched_rejected_${logId}`,
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

async function markMissedLogs(db, todayISO) {
  await db.runAsync(`
    UPDATE scheduled_expense_log
    SET action = 'missed'
    WHERE action = 'pending'
    AND scheduled_date < ?
  `, [todayISO]);
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
        body: `₹${se.amount} scheduled expense is due`,
        sound: true,
        data: { type: 'sched_trigger', schedId: se.id },
        channelId: 'scheduled-expenses',
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
        weekday: day,
        hour,
        minute,
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
