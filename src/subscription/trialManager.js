import AsyncStorage from '@react-native-async-storage/async-storage';

const TRIAL_BANNER_DISMISSED_KEY = 'trial_banner_dismissed_until';

export async function shouldShowTrialBanner() {
  const dismissedUntil = await AsyncStorage.getItem(TRIAL_BANNER_DISMISSED_KEY);
  if (!dismissedUntil) return true;
  return Date.now() > parseInt(dismissedUntil);
}

export async function dismissTrialBannerForOneHour() {
  const oneHour = Date.now() + 3600000;
  await AsyncStorage.setItem(TRIAL_BANNER_DISMISSED_KEY, oneHour.toString());
}
