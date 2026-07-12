import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';

// AsyncStorage keys — non-sensitive
export const LOCK_KEYS = {
  ENABLED:         'applock_enabled',          // 'true' | 'false'
  BIOMETRIC:       'applock_biometric',         // 'true' | 'false'
  TIMEOUT_MINUTES: 'applock_timeout_minutes',   // '0' | '1' | '5' | '15' | '60'
  LAST_UNLOCK:     'applock_last_unlock_ts',    // timestamp string
  BACKGROUNDED_AT: 'applock_backgrounded_at',   // timestamp string
};

// SecureStore key — sensitive
const PIN_HASH_KEY = 'applock_pin_hash';

export const hashPin = async (pin: string): Promise<string> => {
  return await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    pin
  );
};

export const savePin = async (pin: string): Promise<void> => {
  const hash = await hashPin(pin);
  await SecureStore.setItemAsync(PIN_HASH_KEY, hash);
};

export const verifyPin = async (enteredPin: string): Promise<boolean> => {
  const storedHash = await SecureStore.getItemAsync(PIN_HASH_KEY);
  if (!storedHash) return false;
  const enteredHash = await hashPin(enteredPin);
  return storedHash === enteredHash;
};

export const clearPin = async (): Promise<void> => {
  await SecureStore.deleteItemAsync(PIN_HASH_KEY);
};

export const isLockEnabled = async (): Promise<boolean> => {
  const val = await AsyncStorage.getItem(LOCK_KEYS.ENABLED);
  return val === 'true';
};

export const setLockEnabled = async (enabled: boolean): Promise<void> => {
  await AsyncStorage.setItem(LOCK_KEYS.ENABLED, enabled ? 'true' : 'false');
};

export const isBiometricEnabled = async (): Promise<boolean> => {
  const val = await AsyncStorage.getItem(LOCK_KEYS.BIOMETRIC);
  return val === 'true';
};

export const setBiometricEnabled = async (enabled: boolean): Promise<void> => {
  await AsyncStorage.setItem(LOCK_KEYS.BIOMETRIC, enabled ? 'true' : 'false');
};

export const getTimeoutMinutes = async (): Promise<number> => {
  const val = await AsyncStorage.getItem(LOCK_KEYS.TIMEOUT_MINUTES);
  return val ? parseInt(val) : 0;
};

export const setTimeoutMinutes = async (minutes: number): Promise<void> => {
  await AsyncStorage.setItem(LOCK_KEYS.TIMEOUT_MINUTES, String(minutes));
};

export const recordUnlock = async (): Promise<void> => {
  await AsyncStorage.setItem(LOCK_KEYS.LAST_UNLOCK, String(Date.now()));
};

export const recordBackground = async (): Promise<void> => {
  await AsyncStorage.setItem(LOCK_KEYS.BACKGROUNDED_AT, String(Date.now()));
};

export const shouldLockAfterBackground = async (): Promise<boolean> => {
  const enabled = await isLockEnabled();
  if (!enabled) return false;

  const bgAt = await AsyncStorage.getItem(LOCK_KEYS.BACKGROUNDED_AT);
  if (!bgAt) return false;
  const timeoutMinutes = await getTimeoutMinutes();
  if (timeoutMinutes === 0) return true; // Always lock
  const elapsed = (Date.now() - parseInt(bgAt)) / 1000 / 60; // minutes
  return elapsed >= timeoutMinutes;
};

export const isPinSet = async (): Promise<boolean> => {
  const hash = await SecureStore.getItemAsync(PIN_HASH_KEY);
  return !!hash;
};
