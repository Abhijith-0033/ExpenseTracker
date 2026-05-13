import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts, DMSans_400Regular, DMSans_500Medium, DMSans_700Bold } from '@expo-google-fonts/dm-sans';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import 'react-native-reanimated';
import { useColorScheme, View } from 'react-native';
import { AppProvider } from '../context/AppContext';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { initNotifications } from '../services/notifications';
import { initializeNotificationManager } from '../services/notifications/NotificationManager';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { runAutoPay } from '../services/emitracker/AutoPayEngine';

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const router = useRouter();

  const [fontsLoaded] = useFonts({
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_700Bold,
  });

  useEffect(() => {
    async function prepare() {
      try {
        await initNotifications();
        await initializeNotificationManager();
        // Run AutoPay for EMI payments
        await runAutoPay();
      } catch (e) {
        console.warn('Error initializing notifications:', e);
      }
    }

    prepare();
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

        case 'ADD_MISSING':
          router.push('/(tabs)/add');
          break;

        default:
          if (typeof data.screen === 'string') {
            // @ts-ignore
            router.push(data.screen);
          }
      }
    });

    return () => subscription.remove();
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AppProvider>
        <SafeAreaProvider>
          {/* Force DefaultTheme per absolute rules (light theme only) */}
          <ThemeProvider value={DefaultTheme}>
            <View style={{ flex: 1 }}>
              <Stack>
                <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                <Stack.Screen name="budgets" options={{ headerShown: false }} />
                <Stack.Screen name="add-transfer" options={{ headerShown: false }} />
                <Stack.Screen name="savings-goals" options={{ headerShown: false }} />
                <Stack.Screen name="cash-flow" options={{ headerShown: false }} />
                <Stack.Screen name="subscriptions" options={{ headerShown: false }} />
                <Stack.Screen name="financial-report" options={{ headerShown: false }} />
                <Stack.Screen name="account-detail" options={{ headerShown: false }} />
                <Stack.Screen name="category-detail" options={{ headerShown: false }} />
                <Stack.Screen name="income-breakdown" options={{ headerShown: false }} />
                <Stack.Screen name="debt-calculator" options={{ headerShown: false }} />
                <Stack.Screen name="debt-tracker" options={{ headerShown: false }} />
                <Stack.Screen name="debt-tracker/add" options={{ headerShown: false }} />
                <Stack.Screen name="debt-tracker/edit" options={{ headerShown: false }} />
                <Stack.Screen name="chit-funds" options={{ headerShown: false }} />
                <Stack.Screen name="chit-funds/add" options={{ headerShown: false }} />
                <Stack.Screen name="chit-funds/edit" options={{ headerShown: false }} />
                <Stack.Screen name="notification-settings" options={{ headerShown: false }} />
                <Stack.Screen name="manage-accounts" options={{ headerShown: false }} />
                <Stack.Screen name="+not-found" />
              </Stack>
            </View>
          </ThemeProvider>
        </SafeAreaProvider>
      </AppProvider>
    </GestureHandlerRootView>
  );
}
