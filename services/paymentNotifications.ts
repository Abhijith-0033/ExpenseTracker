import * as Notifications from 'expo-notifications';
import { addDays, subDays, setHours, setMinutes, isAfter } from 'date-fns';
import { getDatabase } from './database';
import { checkAndRequestPermission, SETTINGS_KEYS } from './notifications/NotificationManager';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface PaymentItem {
  id: number;
  type: 'subscription' | 'recharge' | 'bill';
  name: string;
  amount: number;
  dueDate: string; // ISO date string YYYY-MM-DD
  category?: string;
  accountId?: number;
}

const SCHEDULE_TABLE = 'notification_schedules';

export const schedulePaymentNotifications = async (item: PaymentItem): Promise<void> => {
  const hasPermission = await checkAndRequestPermission();
  if (!hasPermission) return;

  const masterEnabled = await AsyncStorage.getItem(SETTINGS_KEYS.NOTIF_MASTER_ENABLED);
  if (masterEnabled !== 'true') return;

  // Check specific setting based on item type
  let settingKey = '';
  switch (item.type) {
    case 'subscription':
      settingKey = SETTINGS_KEYS.NOTIF_SUBSCRIPTIONS;
      break;
    case 'bill':
      settingKey = SETTINGS_KEYS.NOTIF_UPCOMING_BILLS;
      break;
    case 'recharge':
      settingKey = SETTINGS_KEYS.NOTIF_RECURRING;
      break;
  }

  const settingEnabled = await AsyncStorage.getItem(settingKey);
  if (settingEnabled !== 'true') return;

  const db = getDatabase();
  if (!db) return;

  const dueDate = new Date(item.dueDate);
  if (isNaN(dueDate.getTime())) {
    console.warn(`Invalid due date provided for ${item.name}: ${item.dueDate}`);
    return;
  }
  const now = new Date();

  const schedules = [
    { type: '7d', date: setMinutes(setHours(subDays(dueDate, 7), 10), 0) },
    { type: '3d', date: setMinutes(setHours(subDays(dueDate, 3), 10), 0) },
    { type: '2d', date: setMinutes(setHours(subDays(dueDate, 2), 10), 0) },
    { type: '1d', date: setMinutes(setHours(subDays(dueDate, 1), 10), 0) },
    { type: '0d', date: setMinutes(setHours(dueDate, 9), 0) },
    { type: '0d_eve', date: setMinutes(setHours(dueDate, 19), 0), category: 'PAYMENT_EVENING_ACTIONS' },
    { type: 'overdue', date: setMinutes(setHours(addDays(dueDate, 1), 10), 0) },
  ];

  // Daily reminders for last 2 days
  for (let i = 2; i >= 0; i--) {
    const d = setMinutes(setHours(subDays(dueDate, i), 10), 0);
    const dateStr = d.toISOString().split('T')[0];
    schedules.push({ type: `daily_${dateStr}`, date: d });
  }

  for (const schedule of schedules) {
    try {
      if (isAfter(schedule.date, now)) {
        const identifier = `${item.type}_${item.id}_${schedule.type}`;
        
        const title = getTitleForType(schedule.type, item.name);
        const body = getBodyForType(schedule.type, item.name, item.amount, item.dueDate);

        await Notifications.scheduleNotificationAsync({
          identifier,
          content: {
            title,
            body,
            sound: true,
            data: {
              screen: '/(tabs)/add',
              action: 'mark_paid',
              itemId: item.id,
              itemType: item.type,
              itemName: item.name,
              itemAmount: item.amount,
              itemCategory: item.category,
              itemAccountId: item.accountId,
            },
            categoryIdentifier: (schedule as any).category || 'PAYMENT_DUE_ACTIONS',
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: schedule.date,
          },
        });

        // Track in database
        await db.runAsync(
          `INSERT INTO ${SCHEDULE_TABLE} (item_type, item_id, notification_id, trigger_type, scheduled_for, created_at) 
           VALUES (?, ?, ?, ?, ?, ?)`,
          [item.type, item.id, identifier, schedule.type, schedule.date.toISOString(), Date.now()]
        );
      }
    } catch (e) {
      console.warn(`Failed to schedule notification ${schedule.type} for ${item.name}`, e);
    }
  }
};

export const cancelPaymentNotifications = async (itemId: number, itemType: string): Promise<void> => {
  const db = getDatabase();
  if (!db) return;

  try {
    const schedules = await db.getAllAsync<{ notification_id: string }>(
      `SELECT notification_id FROM ${SCHEDULE_TABLE} WHERE item_id = ? AND item_type = ?`,
      [itemId, itemType]
    );

    for (const s of schedules) {
      await Notifications.cancelScheduledNotificationAsync(s.notification_id);
    }

    await db.runAsync(
      `DELETE FROM ${SCHEDULE_TABLE} WHERE item_id = ? AND item_type = ?`,
      [itemId, itemType]
    );
  } catch (e) {
    console.error("Error cancelling payment notifications", e);
  }
};

export const reschedulePaymentNotifications = async (item: PaymentItem): Promise<void> => {
  await cancelPaymentNotifications(item.id, item.type);
  await schedulePaymentNotifications(item);
};

export const scheduleSnoozeNotification = async (item: any, originalTitle: string, originalBody: string): Promise<string> => {
  const snoozeTime = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
  const identifier = `snooze_${item.itemType}_${item.itemId}_${Date.now()}`;

  await Notifications.scheduleNotificationAsync({
    identifier,
    content: {
      title: `⏰ Snoozed: ${originalTitle}`,
      body: originalBody,
      sound: true,
      data: item,
      categoryIdentifier: 'PAYMENT_EVENING_ACTIONS',
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: snoozeTime,
    },
  });

  return identifier;
};

function getTitleForType(type: string, name: string): string {
  if (type.startsWith('daily_')) return `💳 Upcoming: ${name}`;
  switch(type) {
    case '7d': return '📅 Payment Due in 7 Days';
    case '3d': return '⏰ Payment Due in 3 Days';
    case '2d': return '⚠️ Payment Due in 2 Days';
    case '1d': return '🔴 Payment Due Tomorrow';
    case '0d': return '❗ Payment Due Today';
    case '0d_eve': return '❗ Payment Still Pending';
    case 'overdue': return '🚨 Overdue Payment';
    default: return `💳 Upcoming: ${name}`;
  }
}

function getBodyForType(type: string, name: string, amount: number, dueDate: string): string {
  const amountStr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);
  
  if (type === 'overdue') return `The payment for ${name} of ${amountStr} was due on ${dueDate}. Please mark it as paid if settled.`;
  if (type === '0d' || type === '0d_eve') return `Your ${name} payment of ${amountStr} is due today!`;
  if (type === '1d') return `Your ${name} payment of ${amountStr} is due tomorrow.`;
  
  return `Reminder: ${name} payment of ${amountStr} is due on ${dueDate}.`;
}
