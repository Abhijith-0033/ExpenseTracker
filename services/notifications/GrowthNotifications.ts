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

// Helper: check if we should even schedule (e.g. check permission and premium status)
async function shouldSchedule(): Promise<boolean> {
  const enabled = await isGrowthNotifEnabled();
  if (!enabled) return false;

  // If user is premium, skip growth notifications
  try {
    const { getSubscriptionStatus } = await import('../../src/subscription/SubscriptionManager');
    const sub = await getSubscriptionStatus();
    if (sub.isPremium) return false;
  } catch (e) {
    console.warn('Failed to check premium in GrowthNotifications:', e);
  }
  return true;
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

// On install, schedule trial notifications
export async function scheduleTrialJourney(installDateStr?: string): Promise<void> {
  if (!(await shouldSchedule())) return;

  let installDate = new Date();
  if (installDateStr) {
    installDate = new Date(installDateStr);
  } else {
    const cached = await AsyncStorage.getItem(GROWTH_KEYS.GROWTH_INSTALL_DATE);
    if (cached) {
      installDate = new Date(cached);
    } else {
      const nowStr = installDate.toISOString();
      await AsyncStorage.setItem(GROWTH_KEYS.GROWTH_INSTALL_DATE, nowStr);
    }
  }

  // Cancel any existing trial journey scheduling to avoid duplicates
  await cancelAllGrowthNotifications();

  // Day 0: 10 seconds from now (Immediate welcome)
  const day0Trigger = new Date(Date.now() + 10 * 1000);
  await Notifications.scheduleNotificationAsync({
    identifier: GROWTH_IDS.GROWTH_TRIAL_DAY0,
    content: {
      title: "🎉 Your 48-hour Premium trial is live!",
      body: "You now have full access to EMI Tracker, Tax Planner, unlimited accounts, and more. Tap to explore.",
      sound: true,
      data: { screen: '/quick-guide', context: 'trial_start' },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: day0Trigger,
    },
  });

  // Day 1: 24 hours after install
  const day1Trigger = new Date(installDate.getTime() + 24 * 3600 * 1000);
  if (day1Trigger > new Date()) {
    await Notifications.scheduleNotificationAsync({
      identifier: GROWTH_IDS.GROWTH_TRIAL_DAY1,
      content: {
        title: "📊 Did you know? Your data tells a story.",
        body: "You have 24 hours left of Premium. Open the Analytics tab right now — see where your money actually goes.",
        sound: true,
        data: { screen: '/(tabs)/analytics', context: 'trial_day1' },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: day1Trigger,
      },
    });
  }

  // Day 2: 36 hours after install (12h left)
  const day2Trigger = new Date(installDate.getTime() + 36 * 3600 * 1000);
  if (day2Trigger > new Date()) {
    await Notifications.scheduleNotificationAsync({
      identifier: GROWTH_IDS.GROWTH_TRIAL_DAY2,
      content: {
        title: "⏳ 12 hours left on your free trial",
        body: "After that, you'll lose access to EMI Tracker, scheduled expenses, and full history. Lock in Premium now.",
        sound: true,
        data: { screen: '/paywall', context: 'trial_ending_12h' },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: day2Trigger,
      },
    });
  }

  // Final Hour: 47 hours after install (1h left)
  const finalTrigger = new Date(installDate.getTime() + 47 * 3600 * 1000);
  if (finalTrigger > new Date()) {
    await Notifications.scheduleNotificationAsync({
      identifier: GROWTH_IDS.GROWTH_TRIAL_FINAL,
      content: {
        title: "🔔 1 hour until your trial ends",
        body: "Your financial data is safe. But premium features will be locked. ₹799/year = ₹66/month. Worth it?",
        sound: true,
        data: { screen: '/paywall', context: 'trial_ending_1h' },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: finalTrigger,
      },
    });
  }
}

// Background checking/rescheduling for growth notifications (like payday and month-end)
export async function checkAndFireGrowthNotifications(): Promise<void> {
  if (!(await shouldSchedule())) {
    await cancelAllGrowthNotifications();
    return;
  }

  const now = new Date();

  // 1. Month-End notification schedule (fires last day of month at 7 PM)
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0); // last day of current month
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

  // 3. Process Winback stages if trial is expired
  try {
    const { getTrialStatus } = await import('../../src/subscription/SubscriptionManager');
    const trial = await getTrialStatus();
    if (!trial.isActive && trial.hoursRemaining === 0) {
      await checkAndScheduleWinbackStages();
    }
  } catch (e) {
    console.warn('Failed to check trial status in checkAndFireGrowthNotifications:', e);
  }
}

// Helper to schedule salary day nudge (monthly recurring at 11 AM)
export async function scheduleSalaryDayNudge(salaryDay: number): Promise<void> {
  if (!(await shouldSchedule())) return;

  const now = new Date();
  let triggerDate = new Date(now.getFullYear(), now.getMonth(), salaryDay);
  triggerDate = setMinutes(setHours(triggerDate, 11), 0);

  // If already passed this month, schedule for next month
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

    // If day changed or not set before, store it and reschedule
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

  // Prevent spam: only fire once per calendar day
  const todayStr = new Date().toISOString().split('T')[0];
  const lastFired = await AsyncStorage.getItem('growth_high_spend_last_fired');
  if (lastFired === todayStr) return;

  await AsyncStorage.setItem('growth_high_spend_last_fired', todayStr);

  // Fire almost immediately (2s delay)
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

// Check and schedule winback stages
async function checkAndScheduleWinbackStages(): Promise<void> {
  const lastSentStr = await AsyncStorage.getItem(GROWTH_KEYS.GROWTH_WINBACK_LAST_SENT);
  const stageStr = await AsyncStorage.getItem(GROWTH_KEYS.GROWTH_WINBACK_STAGE) || '0';
  const stage = parseInt(stageStr, 10);

  const installDateStr = await AsyncStorage.getItem(GROWTH_KEYS.GROWTH_INSTALL_DATE);
  if (!installDateStr) return;
  const installDate = new Date(installDateStr);
  const trialEndDate = new Date(installDate.getTime() + 48 * 3600 * 1000);
  const now = new Date();

  // Only proceed if trial is indeed over
  if (now < trialEndDate) return;

  const hoursSinceTrialEnd = differenceInHours(now, trialEndDate);

  if (stage === 0 && hoursSinceTrialEnd >= 48) {
    // Stage 1: 48 hours after trial end
    await fireWinbackStage(1, "👋 We noticed you left something behind", "Your transactions, budgets and EMI data are still here. Pick up where you left off — ₹799/year.");
  } else if (stage === 1 && lastSentStr) {
    const lastSent = new Date(lastSentStr);
    if (differenceInHours(now, lastSent) >= 72) {
      // Stage 2: 72 hours after Stage 1
      await fireWinbackStage(2, "💡 One thing most free users don't realize", "Every ₹799 spent on Gastos Premium saves an average user ₹4,200/year by catching missed EMIs and overspending.");
    }
  } else if (stage === 2 && lastSentStr) {
    const lastSent = new Date(lastSentStr);
    if (differenceInHours(now, lastSent) >= 168) {
      // Stage 3: 7 days after Stage 2
      // Load dynamic metrics
      let txCount = 0;
      let catCount = 0;
      try {
        const db = getDatabase();
        if (db) {
          const txRes = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM transactions');
          txCount = txRes?.count ?? 0;
          const catRes = await db.getFirstAsync<{ count: number }>('SELECT COUNT(DISTINCT category) as count FROM transactions');
          catCount = catRes?.count ?? 0;
        }
      } catch (e) {}

      const body = txCount > 0 
        ? `You logged ${txCount} transactions across ${catCount} categories. Don't let it go to waste. ₹66/month to keep it all.`
        : "Your budget goals and expense logs are valuable. Keep tracking seamlessly. ₹66/month to unlock all features.";

      await fireWinbackStage(3, "🎁 Last chance: your data story", body);
    }
  }
}

async function fireWinbackStage(stage: number, title: string, body: string): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    identifier: GROWTH_IDS.GROWTH_WINBACK_PREFIX + stage,
    content: {
      title,
      body,
      sound: true,
      data: { screen: '/paywall', context: `winback_stage_${stage}` },
    },
    trigger: null, // send immediately
  });

  await AsyncStorage.setItem(GROWTH_KEYS.GROWTH_WINBACK_STAGE, String(stage));
  await AsyncStorage.setItem(GROWTH_KEYS.GROWTH_WINBACK_LAST_SENT, new Date().toISOString());
}
