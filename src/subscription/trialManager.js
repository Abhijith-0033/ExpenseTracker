import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

const TRIAL_START_KEY = 'gastos_trial_start_date';
const TRIAL_NOTIFICATIONS_SCHEDULED_KEY = 'gastos_trial_notifs_scheduled';
const TRIAL_BANNER_DISMISSED_KEY = 'trial_banner_dismissed_until';

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000; // 168 hours in ms

export async function initTrial() {
  try {
    let startStr = await AsyncStorage.getItem(TRIAL_START_KEY);
    if (!startStr) {
      const now = Date.now();
      await AsyncStorage.setItem(TRIAL_START_KEY, now.toString());
      await scheduleTrialNotifications(now);
      return getTrialStatusFromStart(now);
    }
    return getTrialStatusFromStart(parseInt(startStr, 10));
  } catch (e) {
    console.warn('Failed to init trial:', e);
    return { isActive: true, hoursRemaining: 168, daysRemaining: 7 };
  }
}

export async function getTrialStatus() {
  try {
    const startStr = await AsyncStorage.getItem(TRIAL_START_KEY);
    if (!startStr) {
      return await initTrial();
    }
    return getTrialStatusFromStart(parseInt(startStr, 10));
  } catch (e) {
    console.warn('Failed to get trial status:', e);
    return { isActive: true, hoursRemaining: 168, daysRemaining: 7 };
  }
}

function getTrialStatusFromStart(startTimeMs) {
  const now = Date.now();
  const elapsedMs = now - startTimeMs;
  const remainingMs = Math.max(0, SEVEN_DAYS_MS - elapsedMs);
  const isActive = remainingMs > 0;
  const hoursRemaining = Math.max(0, Math.ceil(remainingMs / (1000 * 60 * 60)));
  const daysRemaining = Math.max(0, Math.ceil(remainingMs / (1000 * 60 * 60 * 24)));

  return {
    isActive,
    hoursRemaining,
    daysRemaining,
    startTimeMs,
    endTimeMs: startTimeMs + SEVEN_DAYS_MS,
  };
}

export async function shouldShowTrialBanner() {
  const dismissedUntil = await AsyncStorage.getItem(TRIAL_BANNER_DISMISSED_KEY);
  if (!dismissedUntil) return true;
  return Date.now() > parseInt(dismissedUntil, 10);
}

export async function dismissTrialBannerForOneHour() {
  const oneHour = Date.now() + 3600000;
  await AsyncStorage.setItem(TRIAL_BANNER_DISMISSED_KEY, oneHour.toString());
}

async function scheduleTrialNotifications(startTimeMs) {
  try {
    const alreadyScheduled = await AsyncStorage.getItem(TRIAL_NOTIFICATIONS_SCHEDULED_KEY);
    if (alreadyScheduled === 'true') return;

    // Request permission silently
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') return;

    const notifTriggers = [
      {
        delaySeconds: 10, // Onboarding start
        title: '🎉 7-Day Free Trial Started!',
        body: 'Explore EMI tracker, Debt tracker, and all premium features free for 7 days.',
      },
      {
        delaySeconds: 24 * 3600, // Day 1
        title: '💡 Try the EMI Tracker!',
        body: 'See how much interest you can save with the prepayment calculator.',
      },
      {
        delaySeconds: 72 * 3600, // Day 3
        title: '⏰ 4 Days Left in Trial',
        body: 'Check out the Finance Lab & Financial Freedom score before trial ends.',
      },
      {
        delaySeconds: 144 * 3600, // Day 6
        title: '🔔 1 Day Left in Trial',
        body: 'Your free trial ends tomorrow. Secure lifetime/yearly access now!',
      },
      {
        delaySeconds: 168 * 3600, // Day 7 (Expiry)
        title: '⚠️ Trial Expired',
        body: 'Upgrade to Gastos Premium to keep using all advanced features.',
      },
    ];

    for (const item of notifTriggers) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: item.title,
          body: item.body,
          sound: true,
        },
        trigger: {
          seconds: item.delaySeconds,
        },
      });
    }

    await AsyncStorage.setItem(TRIAL_NOTIFICATIONS_SCHEDULED_KEY, 'true');
  } catch (e) {
    console.warn('Failed to schedule trial notifications:', e);
  }
}
