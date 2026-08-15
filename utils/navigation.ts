import { Router } from 'expo-router';

/**
 * Safely navigates back if there is a screen in the stack,
 * otherwise navigates to the fallback route (default: home tab).
 */
export function safeBack(router: Router, fallbackRoute: string = '/(tabs)') {
  if (router.canGoBack()) {
    router.back();
  } else {
    router.replace(fallbackRoute as any);
  }
}
