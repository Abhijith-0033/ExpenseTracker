import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getDatabase } from '../database';
import { differenceInDays, differenceInHours, addDays, parseISO, setHours, setMinutes } from 'date-fns';

export const GROWTH_KEYS = {
  GROWTH_NOTIF_ENABLED: 'growth_notif_enabled',
  GROWTH_INSTALL_DATE: 'growth_install_date',
  GROWTH_TRIAL_DAY0_SENT: 'growth_trial_day0_sent',
  GROWTH_TRIAL_DAY1_SENT: 'growth_trial_day1_sent',
  GROWTH_TRIAL_DAY2_SENT: 'growth_trial_day2_sent',
  GROWTH_TRIAL_FINAL_SENT: 'growth_trial_final_sent',
  GROWTH_SALARY_DAY_DETECTED: 'growth_salary_day',
  GROWTH_WINBACK_STAGE: 'growth_winback_stage',
  GROWTH_WINBACK_LAST_SENT: 'growth_winback_last_sent',
};

export const GROWTH_IDS = {
  GROWTH_TRIAL_PREFIX: 'growth_trial_',
  GROWTH_TRIAL_DAY0: 'growth_trial_day0',
  GROWTH_TRIAL_DAY1: 'growth_trial_day1',
  GROWTH_TRIAL_DAY2: 'growth_trial_day2',
  GROWTH_TRIAL_FINAL: 'growth_trial_final',
  GROWTH_SALARY_DAY: 'growth_salary_day',
  GROWTH_HIGH_SPEND: 'growth_high_spend',
  GROWTH_MONTH_END: 'growth_month_end',
  GROWTH_WINBACK_PREFIX: 'growth_win_',
  GROWTH_WINBACK_1: 'growth_win_stage1',
  GROWTH_WINBACK_2: 'growth_win_stage2',
  growth_winback_3: 'growth_win_stage3',
};

// Check if growth notifications are enabled (default to true)
export async function isGrowthNotifEnabled(): Promise<boolean> {
  const val = await AsyncStorage.getItem(GROWTH_KEYS.GROWTH_NOTIF_ENABLED);
  return val !== 'false';
}

// Format currency
const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
};

// Helper: check if growth notifications are enabled
async function shouldSchedule(): Promise<boolean> {
  return await isGrowthNotifEnabled();
}

// Cancel all growth notifications
export async function cancelAllGrowthNotifications(): Promise<void> {
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    for (const notif of scheduled) {
      if (
        notif.identifier.startsWith(GROWTH_IDS.GROWTH_TRIAL_PREFIX) ||
        notif.identifier.startsWith(GROWTH_IDS.GROWTH_WINBACK_PREFIX) ||
        notif.identifier === GROWTH_IDS.GROWTH_SALARY_DAY ||
        notif.identifier === GROWTH_IDS.GROWTH_HIGH_SPEND ||
        notif.identifier === GROWTH_IDS.GROWTH_MONTH_END
      ) {
        await Notifications.cancelScheduledNotificationAsync(notif.identifier);
      }
    }
  } catch (e) {
    console.error('Failed to cancel growth notifications:', e);
  }
}

// Stub out trial journey (no trial or paywall notifications needed)
export async function scheduleTrialJourney(_installDateStr?: string): Promise<void> {
  // No-op for personal app build
}

// Background checking/rescheduling for growth notifications (payday and month-end)
export async function checkAndFireGrowthNotifications(): Promise<void> {
  if (!(await shouldSchedule())) {
    await cancelAllGrowthNotifications();
    return;
  }

  const now = new Date();

  // 1. Month-End notification schedule (fires last day of month at 7 PM)
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const monthEndTrigger = setMinutes(setHours(lastDay, 19), 0);
  
  if (monthEndTrigger > now) {
    await Notifications.cancelScheduledNotificationAsync(GROWTH_IDS.GROWTH_MONTH_END);
    await Notifications.scheduleNotificationAsync({
      identifier: GROWTH_IDS.GROWTH_MONTH_END,
      content: {
        title: "📅 Month-end financial check",
        body: "How did this month go? Review your spending report before the month closes.",
        sound: true,
        data: { screen: '/(tabs)/analytics' },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: monthEndTrigger,
      },
    });
  }

  // 2. Payday notification reschedule if we have a detected salary day
  const detectedDayStr = await AsyncStorage.getItem(GROWTH_KEYS.GROWTH_SALARY_DAY_DETECTED);
  if (detectedDayStr) {
    const day = parseInt(detectedDayStr, 10);
    if (!isNaN(day) && day >= 1 && day <= 31) {
      await scheduleSalaryDayNudge(day);
    }
  }
}

// Helper to schedule salary day nudge (monthly recurring at 11 AM)
export async function scheduleSalaryDayNudge(salaryDay: number): Promise<void> {
  if (!(await shouldSchedule())) return;

  const now = new Date();
  let triggerDate = new Date(now.getFullYear(), now.getMonth(), salaryDay);
  triggerDate = setMinutes(setHours(triggerDate, 11), 0);

  if (triggerDate <= now) {
    triggerDate = new Date(now.getFullYear(), now.getMonth() + 1, salaryDay);
    triggerDate = setMinutes(setHours(triggerDate, 11), 0);
  }

  await Notifications.cancelScheduledNotificationAsync(GROWTH_IDS.GROWTH_SALARY_DAY);
  await Notifications.scheduleNotificationAsync({
    identifier: GROWTH_IDS.GROWTH_SALARY_DAY,
    content: {
      title: "💰 Salary received? Track it now.",
      body: "It's payday! Log your income and set a budget for this month in 30 seconds.",
      sound: true,
      data: { screen: '/add-income' },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: triggerDate,
    },
  });
}

// Triggered when income is added to check/update payday detection
export async function detectAndScheduleSalaryDayNudge(day: number): Promise<void> {
  try {
    const existing = await AsyncStorage.getItem(GROWTH_KEYS.GROWTH_SALARY_DAY_DETECTED);
    const existingDay = existing ? parseInt(existing, 10) : -1;

    if (existingDay !== day) {
      await AsyncStorage.setItem(GROWTH_KEYS.GROWTH_SALARY_DAY_DETECTED, String(day));
      await scheduleSalaryDayNudge(day);
      console.log(`Payday detected on day ${day} of the month! Scheduled reminder.`);
    }
  } catch (e) {
    console.error('Failed to detect/schedule salary day nudge:', e);
  }
}

// Triggered when total daily spend exceeds 3000
export async function fireHighSpendNudge(amount: number, category: string): Promise<void> {
  if (!(await shouldSchedule())) return;

  const todayStr = new Date().toISOString().split('T')[0];
  const lastFired = await AsyncStorage.getItem('growth_high_spend_last_fired');
  if (lastFired === todayStr) return;

  await AsyncStorage.setItem('growth_high_spend_last_fired', todayStr);

  await Notifications.scheduleNotificationAsync({
    identifier: GROWTH_IDS.GROWTH_HIGH_SPEND,
    content: {
      title: `📈 You've spent ${formatCurrency(amount)} today`,
      body: `That's a big day for ${category}. Want to set a budget to keep this in check?`,
      sound: true,
      data: { screen: '/budgets', context: 'high_spend' },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: new Date(Date.now() + 2000),
    },
  });
}

