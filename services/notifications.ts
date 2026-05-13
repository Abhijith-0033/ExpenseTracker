// Legacy notification service - now delegates to NotificationManager
import { initializeNotificationManager, scheduleDailyReminder as scheduleDailyReminderFromManager, SETTINGS_KEYS } from './notifications/NotificationManager';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Legacy exports for backward compatibility
export const initNotifications = async () => {
    try {
        await initializeNotificationManager();
    } catch (e) {
        console.warn('Notifications init skipped (likely running in Expo Go):', e);
    }
};

export const scheduleDailyReminder = async (enabled: boolean): Promise<boolean> => {
    try {
        // Update the setting and let NotificationManager handle scheduling
        await AsyncStorage.setItem(SETTINGS_KEYS.NOTIF_DAILY_REMINDER, enabled ? 'true' : 'false');
        await scheduleDailyReminderFromManager();
        return true;
    } catch (e) {
        console.error("Error scheduling daily reminder", e);
        return false;
    }
};

export const checkReminderStatus = async (): Promise<boolean> => {
    const val = await AsyncStorage.getItem(SETTINGS_KEYS.NOTIF_DAILY_REMINDER);
    return val === 'true';
};

export const scheduleRechargeReminder = async (title: string, body: string, date: Date): Promise<string> => {
    // This is now handled by the payment notifications service
    console.warn('scheduleRechargeReminder is deprecated, use paymentNotifications service instead');
    return '';
};

export const cancelNotification = async (id: string) => {
    try {
        if (id) {
            const { cancelByPrefix } = await import('./notifications/NotificationManager');
            await cancelByPrefix(id);
        }
    } catch (e) {
        console.error("Error cancelling notification", e);
    }
};

export const cancelAllNotificationsForPrefix = async (prefix: string) => {
    try {
        const { cancelByPrefix } = await import('./notifications/NotificationManager');
        await cancelByPrefix(prefix);
    } catch (e) {
        console.error("Error cancelling notifications for prefix", e);
    }
};
