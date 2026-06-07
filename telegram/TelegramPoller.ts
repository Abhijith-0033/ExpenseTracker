import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { TELEGRAM_KEYS, fetchPending, markProcessed, sendCommandResponse } from './TelegramService';
import { processPendingTransaction, processCommand, processUndo } from './TelegramProcessor';

// We'll dynamically import background fetch to avoid crashes if not installed
let BackgroundFetch: any = null;
let TaskManager: any = null;

try {
  BackgroundFetch = require('expo-background-fetch');
  TaskManager = require('expo-task-manager');
} catch {
  console.warn('[Telegram] expo-background-fetch / expo-task-manager not available');
}

export const TELEGRAM_BACKGROUND_TASK = 'TELEGRAM_BACKGROUND_POLL';

let intervalRef: ReturnType<typeof setInterval> | null = null;
let onRefreshCallback: (() => void) | null = null;

/**
 * Register a callback to refresh dashboard data after Telegram adds a transaction.
 * Call this from App.js passing the `refreshData` function from AppContext.
 */
export function setRefreshCallback(cb: () => void) {
  onRefreshCallback = cb;
}

/**
 * Fire an immediate local notification.
 */
async function fireNotification(title: string, body: string, id: string) {
  try {
    // Check if NOTIF_TELEGRAM setting is enabled
    const enabled = await AsyncStorage.getItem('notif_telegram');
    if (enabled === 'false') return; // Respect the toggle

    await Notifications.scheduleNotificationAsync({
      identifier: id,
      content: { title, body, sound: true },
      trigger: null, // immediate
    });
  } catch (err) {
    console.warn('[Telegram] Notification failed:', err);
  }
}

/**
 * Core poll function — fetches and processes all pending items.
 * Safe to call from both foreground and background.
 */
export async function pollOnce(): Promise<void> {
  try {
    const [enabled, appUserId] = await Promise.all([
      AsyncStorage.getItem(TELEGRAM_KEYS.ENABLED),
      AsyncStorage.getItem(TELEGRAM_KEYS.APP_USER_ID),
    ]);

    if (enabled !== 'true' || !appUserId) return;

    const pending = await fetchPending(appUserId);
    if (!pending) return; // Server unreachable — fail silently

    if (pending.transactions.length > 0) {
      console.log(`[Telegram] Poll found ${pending.transactions.length} transaction(s) to process`);
    }

    // Process pending transactions
    for (const transaction of pending.transactions) {
      console.log(`[Telegram] Processing tx id=${transaction.id} status=${transaction.status} category=${transaction.category} amount=${transaction.amount}`);

      // Handle undo requests
      if (transaction.status === 'undo_requested') {
        const result = await processUndo(transaction);
        await markProcessed(transaction.id, appUserId, result.success, result.error);
        continue;
      }

      // Process normal transactions
      const result = await processPendingTransaction(transaction);
      console.log(`[Telegram] processPendingTransaction result: success=${result.success} error=${result.error}`);
      await markProcessed(transaction.id, appUserId, result.success, result.error);
      console.log(`[Telegram] markProcessed called for tx id=${transaction.id}`);

      if (result.success) {
        const amount = transaction.amount;
        const category = transaction.category;
        const dateStr = transaction.date.substring(0, 10);
        const noteStr = transaction.note ? ` · ${transaction.note}` : '';

        await fireNotification(
          '✅ Telegram Expense Added',
          `₹${amount.toLocaleString('en-IN')} · ${category} · ${dateStr}${noteStr}`,
          `telegram_added_${Date.now()}`
        );

        // Refresh dashboard
        onRefreshCallback?.();
      } else {
        await fireNotification(
          '❌ Telegram Add Failed',
          `Could not add ₹${transaction.amount} ${transaction.category}. Please add manually.`,
          `telegram_failed_${Date.now()}`
        );
      }
    }

    // Process pending commands
    for (const command of pending.commands) {
      const response = await processCommand(command);
      if (response) {
        await sendCommandResponse(appUserId, command.id, response);
      }
    }

    // Update last poll timestamp
    await AsyncStorage.setItem(TELEGRAM_KEYS.LAST_POLL, new Date().toISOString());
  } catch (err) {
    // Never crash — log silently
    console.warn('[Telegram] pollOnce error (handled gracefully):', err);
  }
}

/**
 * Start foreground polling (every 60 seconds).
 * Call this in App.js after providers are mounted.
 */
export async function startPolling(refreshCallback?: () => void): Promise<void> {
  if (refreshCallback) {
    onRefreshCallback = refreshCallback;
  }

  // Stop any existing interval
  stopPolling();

  const [enabled, appUserId] = await Promise.all([
    AsyncStorage.getItem(TELEGRAM_KEYS.ENABLED),
    AsyncStorage.getItem(TELEGRAM_KEYS.APP_USER_ID),
  ]);

  if (enabled !== 'true' || !appUserId) return;

  // Poll immediately
  pollOnce();

  // Then every 60 seconds
  intervalRef = setInterval(pollOnce, 60 * 1000);
}

/**
 * Stop foreground polling.
 */
export function stopPolling(): void {
  if (intervalRef) {
    clearInterval(intervalRef);
    intervalRef = null;
  }
}

// ── BACKGROUND TASK ───────────────────────────────────────────────────────────

/**
 * Define and register the background fetch task.
 * Call this ONCE during app startup (in _layout.tsx).
 * Safe to call multiple times — will not re-register if already registered.
 */
export async function registerBackgroundTask(): Promise<void> {
  if (!BackgroundFetch || !TaskManager) {
    console.warn('[Telegram] Background fetch not available — skipping task registration');
    return;
  }

  try {
    // Define the task (must be called before registration)
    if (!TaskManager.isTaskDefined(TELEGRAM_BACKGROUND_TASK)) {
      TaskManager.defineTask(TELEGRAM_BACKGROUND_TASK, async () => {
        try {
          await pollOnce();
          return BackgroundFetch.BackgroundFetchResult.NewData;
        } catch {
          return BackgroundFetch.BackgroundFetchResult.Failed;
        }
      });
    }

    // Check if already registered
    const isRegistered = await BackgroundFetch.getStatusAsync();
    if (isRegistered === BackgroundFetch.BackgroundFetchStatus.Restricted ||
        isRegistered === BackgroundFetch.BackgroundFetchStatus.Denied) {
      console.warn('[Telegram] Background fetch not permitted on this device');
      return;
    }

    await BackgroundFetch.registerTaskAsync(TELEGRAM_BACKGROUND_TASK, {
      minimumInterval: 15 * 60, // 15 minutes (minimum allowed by OS)
      stopOnTerminate: false,
      startOnBoot: true,
    });

    console.log('[Telegram] Background task registered');
  } catch (err) {
    // Not fatal — app still works with foreground polling
    console.warn('[Telegram] Background task registration failed:', err);
  }
}

/**
 * Unregister the background task (called on disconnect).
 */
export async function unregisterBackgroundTask(): Promise<void> {
  if (!BackgroundFetch || !TaskManager) return;
  try {
    const isRegistered = await TaskManager.isTaskRegisteredAsync(TELEGRAM_BACKGROUND_TASK);
    if (isRegistered) {
      await BackgroundFetch.unregisterTaskAsync(TELEGRAM_BACKGROUND_TASK);
    }
  } catch (err) {
    console.warn('[Telegram] Failed to unregister background task:', err);
  }
}
