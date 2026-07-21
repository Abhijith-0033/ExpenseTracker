import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SubscriptionManager from '../src/subscription/SubscriptionManager';

export async function maybeShowTrialEndScreen(router: any): Promise<void> {
  try {
    // 1. Check if trial end screen has already been shown
    const shown = await AsyncStorage.getItem('trial_end_screen_shown');
    if (shown === 'true') return;

    // 2. Check current subscription status
    const sub = await SubscriptionManager.getSubscriptionStatus();
    if (sub.isPremium) return; // Premium users don't need a trial-end screen

    // 3. Check trial status
    const trial = await SubscriptionManager.getTrialStatus();
    if (!trial.isActive && trial.hoursRemaining === 0) {
      // Trial is expired!
      await AsyncStorage.setItem('trial_end_screen_shown', 'true');
      router.push('/trial-end');
    }
  } catch (error) {
    console.warn('Failed in maybeShowTrialEndScreen (non-critical):', error);
  }
}
