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
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';

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
    const prepare = async () => {
      try {
        // Initialize notifications
        await initNotifications();
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
    const subscription = Notifications.addNotificationResponseReceivedListener(response => {
      const screen = response.notification.request.content.data.screen;
      if (typeof screen === 'string') {
        // @ts-ignore - Dynamic navigation based on notification data
        router.push(screen);
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
                <Stack.Screen name="+not-found" />
              </Stack>
            </View>
          </ThemeProvider>
        </SafeAreaProvider>
      </AppProvider>
    </GestureHandlerRootView>
  );
}
