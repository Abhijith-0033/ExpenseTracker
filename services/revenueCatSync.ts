/**
 * revenueCatSync.ts
 * Manages syncing user attributes to RevenueCat.
 * Automatically computes user segments, handles install date, and tracks transaction counts.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import Purchases from 'react-native-purchases';
import { initDatabase, getDatabase } from './database';
import { getUserDisplayName, getCertificateNumber } from './onboardingState';

const SYNC_KEYS = {
  INSTALL_DATE: 'revenuecat_install_date',
  LAST_SYNCED_COUNT: 'revenuecat_last_synced_tx_count',
};

/**
 * Syncs user attributes to RevenueCat.
 * Safely wrapped to never block execution or crash the app.
 */
export async function syncUserAttributes(): Promise<void> {
  try {
    // Guard: ensure Purchases SDK is configured before attempting attribute calls
    try {
      await Purchases.getCustomerInfo();
    } catch (_e) {
      console.warn('syncUserAttributes: Purchases not configured yet, skipping');
      return;
    }

    // 1. Get transaction count
    await initDatabase();
    const db = getDatabase();
    const result = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM transactions');
    const txCount = result?.count ?? 0;

    // 2. Determine user segment
    let userSegment = 'new_user';
    if (txCount >= 50) {
      userSegment = 'power_user';
    } else if (txCount >= 10) {
      userSegment = 'active_user';
    } else if (txCount > 0) {
      userSegment = 'casual_user';
    }

    // 3. Get or generate install date
    let installDate = await AsyncStorage.getItem(SYNC_KEYS.INSTALL_DATE);
    if (!installDate) {
      installDate = new Date().toISOString();
      await AsyncStorage.setItem(SYNC_KEYS.INSTALL_DATE, installDate);
    }

    // 4. Get display name and certificate number
    const displayName = await getUserDisplayName();
    const certNumber = await getCertificateNumber();

    // 5. Get app version
    const appVersion = Constants.expoConfig?.version ?? '3.6.0';

    // 6. Build attribute payload
    const attributes: Record<string, string> = {
      transaction_count: String(txCount),
      user_segment: userSegment,
      app_version: appVersion,
      install_date: installDate,
      '$displayName': displayName || 'Gastos User',
    };

    if (displayName && displayName !== 'Anonymous User') {
      attributes['has_name'] = 'true';
    }
    if (certNumber) {
      attributes['certificate_number'] = certNumber;
    }

    // 7. Send to RevenueCat
    await Purchases.setAttributes(attributes);

    // 8. Update last synced count cache
    await AsyncStorage.setItem(SYNC_KEYS.LAST_SYNCED_COUNT, String(txCount));

    console.log('RevenueCat user attributes synced successfully:', attributes);
  } catch (error) {
    console.warn('syncUserAttributes failed (non-critical):', error);
  }
}

/**
 * Checks if transaction count has changed by 10 or more since the last sync.
 * If so, triggers attribute sync.
 */
export async function checkAndSyncOnTransactionChange(): Promise<void> {
  try {
    await initDatabase();
    const db = getDatabase();
    const result = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM transactions');
    const currentCount = result?.count ?? 0;

    const cachedCountStr = await AsyncStorage.getItem(SYNC_KEYS.LAST_SYNCED_COUNT);
    const lastSyncedCount = cachedCountStr ? parseInt(cachedCountStr, 10) : -1;

    // Trigger sync if never synced, or if count difference is 10 or more
    if (lastSyncedCount === -1 || Math.abs(currentCount - lastSyncedCount) >= 10) {
      await syncUserAttributes();
    }
  } catch (error) {
    console.warn('checkAndSyncOnTransactionChange failed (non-critical):', error);
  }
}
