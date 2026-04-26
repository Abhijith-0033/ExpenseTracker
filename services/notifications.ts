import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const REMINDER_KEY = 'daily_reminder_enabled';
const NOTIFICATION_ID = 'daily-expense-reminder';

export const initNotifications = async () => {
    try {
        // Configure foreground behavior
        Notifications.setNotificationHandler({
            handleNotification: async () => ({
                shouldShowBanner: true,
                shouldShowList: true,
                shouldPlaySound: true,
                shouldSetBadge: false,
            }),
        });

        // Create channel for Android
        if (Platform.OS === 'android') {
            await Notifications.setNotificationChannelAsync('expense-reminders', {
                name: 'Expense Reminders',
                importance: Notifications.AndroidImportance.HIGH,
                vibrationPattern: [0, 250, 250, 250],
                lightColor: '#2563eb',
            });
        }

        // Restore scheduling if it was enabled but maybe cleared by system or update
        const enabled = await AsyncStorage.getItem(REMINDER_KEY);
        if (enabled === 'true') {
            const scheduled = await Notifications.getAllScheduledNotificationsAsync();
            const exists = scheduled.find(n => n.identifier === NOTIFICATION_ID);
            if (!exists) {
                await scheduleDailyReminder(true);
            }
        }
    } catch (e) {
        // Gracefully handle Expo Go limitations (push notifications unavailable in Expo Go SDK 53+)
        console.warn('Notifications init skipped (likely running in Expo Go):', e);
    }
};

export const scheduleDailyReminder = async (enabled: boolean): Promise<boolean> => {
    try {
        if (enabled) {
            const settings = await Notifications.getPermissionsAsync();
            let granted = settings.granted;

            if (!granted) {
                const { status } = await Notifications.requestPermissionsAsync();
                granted = status === 'granted';
            }

            if (!granted) {
                // Permission denied
                await AsyncStorage.setItem(REMINDER_KEY, 'false');
                return false;
            }

            // Cancel existing to avoid duplicates
            await Notifications.cancelScheduledNotificationAsync(NOTIFICATION_ID);

            // Schedule for 9:00 PM
            await Notifications.scheduleNotificationAsync({
                identifier: NOTIFICATION_ID,
                content: {
                    title: "Expense Reminder",
                    body: "Don't forget to add today's expenses 📒",
                    sound: true,
                    data: { screen: '/(tabs)/add' },
                },
                trigger: {
                    type: Notifications.SchedulableTriggerInputTypes.DAILY,
                    hour: 21,
                    minute: 0,
                },
            });

            await AsyncStorage.setItem(REMINDER_KEY, 'true');
            return true;
        } else {
            // Disable
            await Notifications.cancelScheduledNotificationAsync(NOTIFICATION_ID);
            await AsyncStorage.setItem(REMINDER_KEY, 'false');
            return true;
        }
    } catch (e) {
        console.error("Error scheduling notification", e);
        return false;
    }
};

export const checkReminderStatus = async (): Promise<boolean> => {
    const val = await AsyncStorage.getItem(REMINDER_KEY);
    return val === 'true';
};

export const scheduleRechargeReminder = async (title: string, body: string, date: Date): Promise<string> => {
    try {
        const id = await Notifications.scheduleNotificationAsync({
            content: {
                title,
                body,
                sound: true,
                data: { screen: '/(tabs)/index' }, // Go to dashboard to see upcoming
            },
            trigger: date as any,
        });
        return id;
    } catch (e) {
        console.error("Error scheduling recharge reminder", e);
        return '';
    }
};

export const cancelNotification = async (id: string) => {
    try {
        if (id) {
            await Notifications.cancelScheduledNotificationAsync(id);
        }
    } catch (e) {
        console.error("Error cancelling notification", e);
    }
};
