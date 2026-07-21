import { Platform } from 'react-native';
import Purchases from 'react-native-purchases';
import { RC_API_KEY, RC_ENTITLEMENT_ID, RC_MONTHLY_PACKAGE_ID, RC_YEARLY_PACKAGE_ID } from './config';
import { getDatabase, initDatabase } from '../../services/database';

export async function initialize() {
  try {
    // Configure RevenueCat (anonymous device ID)
    await Purchases.configure({ 
      apiKey: RC_API_KEY,
      useAmazon: Platform.OS === 'android',
    });
    await syncSubscriptionStatus();
  } catch (e) {
    console.warn('RevenueCat initialization failed:', e);
  }
}

export async function getSubscriptionStatus() {
  try {
    // ONLINE: Try RevenueCat first
    const customerInfo = await Purchases.getCustomerInfo();
    const isPremium = customerInfo.entitlements.active[RC_ENTITLEMENT_ID] !== undefined;
    const expiry = customerInfo.entitlements.active[RC_ENTITLEMENT_ID]?.expirationDate ?? null;
    const plan = customerInfo.entitlements.active[RC_ENTITLEMENT_ID]?.productIdentifier ?? null;
    
    // Update local cache
    await upsertCache({
      tier: isPremium ? 'premium' : 'free',
      plan,
      subscription_expiry: expiry,
      last_verified: new Date().toISOString(),
    });
    
    return { tier: isPremium ? 'premium' : 'free', isPremium, expiry, plan };
  } catch (_e) {
    // OFFLINE: Use cached value
    const cache = await getSubscriptionCache();
    if (!cache) return { tier: 'free', isPremium: false };
    
    const lastVerified = cache.last_verified ? new Date(cache.last_verified) : null;
    const hoursSinceVerified = lastVerified
      ? (Date.now() - lastVerified.getTime()) / 3600000
      : Infinity;
    
    if (hoursSinceVerified < 48) {
      // Grace period — trust cache
      return { tier: cache.tier, isPremium: cache.tier === 'premium' };
    }
    
    // > 48h offline → downgrade gracefully
    return { tier: 'free', isPremium: false };
  }
}

export async function getTrialStatus() {
  const cache = await getSubscriptionCache();
  const now = Date.now();
  
  if (!cache || !cache.trial_start_date) {
    // First launch — start 48-hour trial
    const trialStart = new Date().toISOString();
    const trialEnd = new Date(now + 48 * 3600000).toISOString();
    await upsertCache({
      trial_start_date: trialStart,
      trial_end_date: trialEnd,
      is_trial_active: 1,
    });
    return { isActive: true, hoursRemaining: 48 };
  }
  
  const trialStart = new Date(cache.trial_start_date).getTime();
  const hoursElapsed = (now - trialStart) / 3600000;
  const isActive = hoursElapsed < 48;
  const hoursRemaining = Math.max(0, 48 - hoursElapsed);
  
  // Update cache
  if (!isActive && cache.is_trial_active) {
    await upsertCache({ is_trial_active: 0 });
  }
  
  return { isActive, hoursRemaining: Math.round(hoursRemaining * 10) / 10 };
}

export async function purchaseMonthly() {
  const offerings = await Purchases.getOfferings();
  const pkg = offerings.current?.availablePackages?.find(
    p => p.identifier === RC_MONTHLY_PACKAGE_ID
  );
  if (!pkg) throw new Error('Monthly package not found');
  await Purchases.purchasePackage(pkg);
  return await getSubscriptionStatus();
}

export async function purchaseYearly() {
  const offerings = await Purchases.getOfferings();
  const pkg = offerings.current?.availablePackages?.find(
    p => p.identifier === RC_YEARLY_PACKAGE_ID
  );
  if (!pkg) throw new Error('Yearly package not found');
  await Purchases.purchasePackage(pkg);
  return await getSubscriptionStatus();
}

export async function restorePurchases() {
  await Purchases.restorePurchases();
  return await getSubscriptionStatus();
}

export async function getUserId() {
  try {
    const info = await Purchases.getCustomerInfo();
    return info.originalAppUserId;
  } catch (_e) {
    return null;
  }
}

async function syncSubscriptionStatus() {
  try {
    await getSubscriptionStatus();
  } catch (_e) {
    // silent
  }
}

// Internal helpers using database functions
async function upsertCache(data) {
  try {
    await initDatabase();
    const db = getDatabase();
    const existing = await db.getFirstAsync('SELECT id FROM subscription_cache LIMIT 1');
    
    if (existing) {
      const sets = Object.entries(data).map(([k]) => `${k} = ?`).join(', ');
      const vals = [...Object.values(data), new Date().toISOString(), existing.id];
      await db.runAsync(
        `UPDATE subscription_cache SET ${sets}, updated_at = ? WHERE id = ?`,
        vals
      );
    } else {
      // First time insert — ensure revenuecat_user_id is set
      const userId = await getUserId().catch(() => 'anonymous') || 'anonymous';
      const fullData = { revenuecat_user_id: userId, ...data };
      const cols = Object.keys(fullData).join(', ');
      const placeholders = Object.keys(fullData).map(() => '?').join(', ');
      await db.runAsync(
        `INSERT INTO subscription_cache (${cols}) VALUES (${placeholders})`,
        Object.values(fullData)
      );
    }
  } catch (e) {
    console.error('upsertCache failed:', e);
  }
}

async function getSubscriptionCache() {
  try {
    await initDatabase();
    const db = getDatabase();
    return await db.getFirstAsync('SELECT * FROM subscription_cache LIMIT 1');
  } catch (_e) {
    return null;
  }
}
