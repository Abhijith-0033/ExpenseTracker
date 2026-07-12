import {  DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts, DMSans_400Regular, DMSans_500Medium, DMSans_700Bold } from '@expo-google-fonts/dm-sans';
import { Stack , useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import LockScreen from './security/lock-screen';
import { isLockEnabled, shouldLockAfterBackground, recordBackground } from '../services/security/AppLockService';
import 'react-native-reanimated';
import { useColorScheme, View, AppState, AppStateStatus } from 'react-native';
import { AppProvider } from '../context/AppContext';
import { SubscriptionProvider } from '../src/subscription/SubscriptionContext';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ErrorBoundary } from 'react-error-boundary';
import { RootErrorFallback } from '../components/ErrorBoundary';
import { initDatabase } from '../services/database';
import { initNotifications } from '../services/notifications';
import { initializeNotificationManager } from '../services/notifications/NotificationManager';
import * as Notifications from 'expo-notifications';
import { runAutoPay } from '../services/emitracker/AutoPayEngine';
import { startPolling, stopPolling, registerBackgroundTask } from '../telegram/TelegramPoller';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { OnboardingTour } from '../components/OnboardingTour';

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();


export default function RootLayout() {
  const _colorScheme = useColorScheme();
  const router = useRouter();

  const [fontsLoaded] = useFonts({
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_700Bold,
  });

  const [isLocked, setIsLocked] = useState(false);
  const [lockChecked, setLockChecked] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const appStateRef = useRef<AppStateStatus>('active');

  // Check lock on mount
  useEffect(() => {
    const checkLock = async () => {
      const enabled = await isLockEnabled();
      if (enabled) {
        setIsLocked(true);
      }
      setLockChecked(true);

      try {
        const complete = await AsyncStorage.getItem('onboarding_complete_v1');
        if (complete !== 'true') {
          setShowOnboarding(true);
        }
      } catch (e) {
        console.warn('Failed to check onboarding:', e);
      }
    };
    checkLock();
  }, []);

  // AppState listener
  useEffect(() => {
    const subscription = AppState.addEventListener('change', async (nextState: AppStateStatus) => {
      const prev = appStateRef.current;
      appStateRef.current = nextState;

      if (nextState === 'background' || nextState === 'inactive') {
        await recordBackground();
      }

      if (nextState === 'active' && (prev === 'background' || prev === 'inactive')) {
        const shouldLock = await shouldLockAfterBackground();
        if (shouldLock) {
          setIsLocked(true);
        }
        
        try {
          const { checkAndProcessScheduled } = await import('../src/scheduled/ScheduledExpenseEngine');
          await checkAndProcessScheduled();
        } catch (e) {
          console.warn('Failed to process scheduled expenses on foreground:', e);
        }
      }
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    async function prepare() {
      try {
        await initDatabase();
        await initNotifications();
        await initializeNotificationManager();
        // Run AutoPay for EMI payments
        await runAutoPay();
        
        // Start Telegram polling (silently fails if not linked)
        startPolling();
        // Register background task (silently fails if package not installed)
        registerBackgroundTask();

        // Register and run scheduled expense check immediately
        try {
          const { registerScheduledExpenseTask, checkAndProcessScheduled } = await import('../src/scheduled/ScheduledExpenseEngine');
          await registerScheduledExpenseTask();
          await checkAndProcessScheduled();
          
          // Foreground polling for scheduled expenses
          setInterval(async () => {
            if (appStateRef.current === 'active') {
              try {
                await checkAndProcessScheduled();
              } catch (e) {}
            }
          }, 60000);
        } catch (e) {
          console.warn('Failed to register scheduled expense task:', e);
        }
      } catch (e) {
        console.warn('Error initializing notifications:', e);
      }
    }

    prepare();

    return () => {
      stopPolling();
    };
  }, []);

  useEffect(() => {
    const prepare = async () => {
      try {
        // Initialize notifications
      } catch (e) {
        console.warn(e);
      } finally {
        // Hide native splash screen and show our custom landing
        if (fontsLoaded) {
          await SplashScreen.hideAsync();
        }
      }
    };

    if (fontsLoaded) {
      prepare();
    }

    // Handle notification click
    const subscription = Notifications.addNotificationResponseReceivedListener(async response => {
      const data = response.notification.request.content.data;
      const actionId = response.actionIdentifier;

      // Handle quick-add inline reply (Android)
      if (actionId === 'QUICK_ADD') {
        const userText = response.userText || '';
        const match = userText.match(/^(\d+\.?\d*)\s*(.*)?$/);
        if (match) {
          const amount = match[1];
          const categoryHint = (match[2] || '').trim();
          router.push({
            pathname: '/(tabs)/add',
            params: { prefill_amount: amount, prefill_description: categoryHint }
          });
        } else {
          router.push('/(tabs)/add');
        }
        return;
      }

      // Handle action buttons
      if (actionId.startsWith('SCHED_APPROVE_') || actionId === 'SCHED_APPROVE') {
        const logId = data.logId || parseInt(actionId.replace('SCHED_APPROVE_', ''));
        try {
          const { approveScheduled } = await import('../src/scheduled/ScheduledExpenseEngine');
          await approveScheduled(logId);
        } catch (e) {
          console.error('Approve scheduled failed:', e);
        }
        return;
      }
      
      if (actionId.startsWith('SCHED_REJECT_') || actionId === 'SCHED_REJECT') {
        const logId = data.logId || parseInt(actionId.replace('SCHED_REJECT_', ''));
        try {
          const { rejectScheduled } = await import('../src/scheduled/ScheduledExpenseEngine');
          await rejectScheduled(logId);
        } catch (e) {
          console.error('Reject scheduled failed:', e);
        }
        return;
      }

      if (actionId.startsWith('SCHED_EDIT_') || actionId === 'SCHED_EDIT') {
        const logId = data.logId || parseInt(actionId.replace('SCHED_EDIT_', ''));
        router.push({
          pathname: '/(tabs)/add',
          params: { sched_log_id: String(logId) }
        });
        return;
      }

      switch (actionId) {
        case 'MARK_PAID':
          router.push({
            pathname: '/(tabs)/add',
            params: {
              prefill_amount: data.itemAmount ? String(data.itemAmount) : '',
              prefill_category: data.itemCategory ? String(data.itemCategory) : 'Other',
              prefill_description: data.itemName ? String(data.itemName) : '',
              prefill_account_id: data.itemAccountId ? String(data.itemAccountId) : '',
              from_notification: 'mark_paid',
              item_id: data.itemId ? String(data.itemId) : '',
              item_type: data.itemType ? String(data.itemType) : '',
            }
          });
          break;

        case 'REMIND_LATER':
        case 'SNOOZE_1H':
          try {
            const { scheduleSnoozeNotification } = await import('../services/paymentNotifications');
            await scheduleSnoozeNotification(
              data,
              response.notification.request.content.title || '',
              response.notification.request.content.body || ''
            );
          } catch (e) {
            console.error("Failed to snooze notification", e);
          }
          break;

        case 'ADD_EXPENSE':
          router.push('/(tabs)/add');
          break;

        case 'ADD_INCOME':
          router.push('/add-income');
          break;

        case 'VIEW_TODAY':
          router.push('/(tabs)/calendar');
          break;

        case 'FULL_REPORT':
          router.push('/(tabs)/analytics');
          break;

        case 'SCHED_APPROVE': {
          const logId = data.logId;
          if (logId) {
            const { approveScheduled } = await import('../src/scheduled/ScheduledExpenseEngine');
            await approveScheduled(logId);
          }
          break;
        }

        case 'SCHED_REJECT': {
          const logId = data.logId;
          if (logId) {
            const { rejectScheduled } = await import('../src/scheduled/ScheduledExpenseEngine');
            await rejectScheduled(logId);
          }
          break;
        }

        case 'SCHED_EDIT': {
          const schedId = data.schedId;
          if (schedId) {
            router.push(`/scheduled-expenses/add?id=${schedId}` as any);
          }
          break;
        }

        case 'ADD_MISSING':
          router.push('/(tabs)/add');
          break;

        default:
          if (data?.type === 'sched_trigger') {
            try {
              const { checkAndProcessScheduled } = await import('../src/scheduled/ScheduledExpenseEngine');
              await checkAndProcessScheduled();
            } catch (e) {}
            router.push('/scheduled-expenses');
            break;
          }
          if (typeof data?.screen === 'string') {
            // @ts-ignore
            router.push(data.screen);
          }
      }
    });

    return () => subscription.remove();
  }, [fontsLoaded, router]);

  if (!lockChecked || !fontsLoaded) {
    return null;
  }

  if (isLocked) {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <LockScreen onUnlock={async () => {
          const { recordUnlock } = await import('../services/security/AppLockService');
          await recordUnlock();
          setIsLocked(false);
        }} />
      </GestureHandlerRootView>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <SubscriptionProvider>
          <AppProvider>
            <SafeAreaProvider>
            {/* Force DefaultTheme per absolute rules (light theme only) */}
            <ThemeProvider value={DefaultTheme}>
              <View style={{ flex: 1 }}>
                <ErrorBoundary
                  FallbackComponent={RootErrorFallback}
                  onReset={() => {
                    router.replace('/');
                  }}
                >
                  <Stack>
                    <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                    <Stack.Screen name="budgets" options={{ headerShown: false }} />
                    <Stack.Screen name="add-transfer" options={{ headerShown: false }} />
                    <Stack.Screen name="add-income" options={{ headerShown: false }} />
                    <Stack.Screen name="edit-transaction" options={{ headerShown: false }} />
                    <Stack.Screen name="manage-categories" options={{ headerShown: false }} />
                    <Stack.Screen name="manage-income-sources" options={{ headerShown: false }} />
                    <Stack.Screen name="data-cleanup" options={{ headerShown: false }} />
                    <Stack.Screen name="savings-goals" options={{ headerShown: false }} />
                    <Stack.Screen name="cash-flow" options={{ headerShown: false }} />
                    <Stack.Screen name="subscriptions" options={{ headerShown: false }} />
                    <Stack.Screen name="financial-report" options={{ headerShown: false }} />
                    <Stack.Screen name="account-detail" options={{ headerShown: false }} />
                    <Stack.Screen name="category-detail" options={{ headerShown: false }} />
                    <Stack.Screen name="income-breakdown" options={{ headerShown: false }} />
                    <Stack.Screen name="debt-calculator" options={{ headerShown: false }} />
                    <Stack.Screen name="debt-tracker/index" options={{ headerShown: false }} />
                    <Stack.Screen name="debt-tracker/add" options={{ headerShown: false }} />
                    <Stack.Screen name="debt-tracker/[id]" options={{ headerShown: false }} />
                    <Stack.Screen name="debt-tracker/edit/[id]" options={{ headerShown: false }} />
                    <Stack.Screen name="debts/index" options={{ headerShown: false }} />
                    <Stack.Screen name="debts/[id]" options={{ headerShown: false }} />
                    <Stack.Screen name="emi-tracker/index" options={{ headerShown: false }} />
                    <Stack.Screen name="emi-tracker/add" options={{ headerShown: false }} />
                    <Stack.Screen name="emi-tracker/detail" options={{ headerShown: false }} />
                    <Stack.Screen name="books/index" options={{ headerShown: false }} />
                    <Stack.Screen name="books/[id]" options={{ headerShown: false }} />
                    <Stack.Screen name="bill-splitter/index" options={{ headerShown: false }} />
                    <Stack.Screen name="bill-splitter/manage-group" options={{ headerShown: false }} />
                    <Stack.Screen name="bill-splitter/group-details" options={{ headerShown: false }} />
                    <Stack.Screen name="bill-splitter/add-group-expense" options={{ headerShown: false }} />
                    <Stack.Screen name="chit-funds/index" options={{ headerShown: false }} />
                    <Stack.Screen name="chit-funds/add" options={{ headerShown: false }} />
                    <Stack.Screen name="chit-funds/[id]" options={{ headerShown: false }} />
                    <Stack.Screen name="chit-funds/edit/[id]" options={{ headerShown: false }} />
                    <Stack.Screen name="notification-settings/index" options={{ headerShown: false }} />
                    <Stack.Screen name="manage-accounts" options={{ headerShown: false }} />
                    <Stack.Screen name="telegram-settings" options={{ headerShown: false }} />
                    <Stack.Screen name="security/lock-screen" options={{ headerShown: false }} />
                    <Stack.Screen name="security/app-lock-settings" options={{ headerShown: false }} />
                    <Stack.Screen name="security/setup-pin" options={{ headerShown: false }} />
                    <Stack.Screen name="tax-planner/index" options={{ headerShown: false }} />
                    <Stack.Screen name="tax-planner/add-deduction" options={{ headerShown: false }} />
                    <Stack.Screen name="future-calendar/index" options={{ headerShown: false }} />
                    <Stack.Screen name="sinking-funds/index" options={{ headerShown: false }} />
                    <Stack.Screen name="sinking-funds/add" options={{ headerShown: false }} />
                    <Stack.Screen name="scheduled-expenses/index" options={{ headerShown: false }} />
                    <Stack.Screen name="scheduled-expenses/add" options={{ headerShown: false }} />
                    <Stack.Screen name="scheduled-expenses/[id]" options={{ headerShown: false }} />
                    <Stack.Screen name="upcoming-bills/index" options={{ headerShown: false }} />
                    <Stack.Screen name="upcoming-bills/add" options={{ headerShown: false }} />
                    <Stack.Screen name="quick-guide" options={{ headerShown: false }} />
                    <Stack.Screen name="paywall" options={{ headerShown: false }} />
                    <Stack.Screen name="+not-found" />
                  </Stack>
                  <OnboardingTour 
                    visible={showOnboarding} 
                    onClose={() => setShowOnboarding(false)} 
                  />
                </ErrorBoundary>
              </View>
            </ThemeProvider>
          </SafeAreaProvider>
        </AppProvider>
      </SubscriptionProvider>
    </QueryClientProvider>
  </GestureHandlerRootView>
);
}
