import * as WebBrowser from 'expo-web-browser';
import { getTrialStatus as fetchTrialStatus } from './trialManager';
import { getDatabase } from '../../services/database';

const SERVER_URL = 'https://gastos-server-wfl5.onrender.com';
const PAYMENT_PAGE_URL = 'https://gastos-payment.netlify.app';

// Must match APP_SECRET_KEY on the Render server
const APP_SECRET_KEY = 'b6e3690000dbz';

export async function initialize() {
  return await fetchTrialStatus();
}

export async function getSubscriptionStatus(userId) {
  if (!userId) {
    return { tier: 'free', isPremium: false, plan: 'free', expiry: null };
  }

  try {
    const res = await fetch(`${SERVER_URL}/api/subscription-status/${userId}`, {
      headers: {
        'Cache-Control': 'no-cache',
        'X-App-Secret': APP_SECRET_KEY,
      },
    });
    if (res.ok) {
      const data = await res.json();
      const status = {
        tier: data.isPremium ? 'premium' : 'free',
        isPremium: !!data.isPremium,
        plan: data.plan || 'free',
        expiry: data.expiryDate || null,   // server returns 'expiryDate'
      };

      // Cache locally in SQLite
      await updateSubscriptionCache(userId, status);
      return status;
    }
  } catch (error) {
    console.warn('Network error fetching subscription status, checking SQLite cache:', error);
  }

  // Offline or network failure: Read SQLite cache
  return await getCachedSubscriptionStatus(userId);
}

export async function getTrialStatus() {
  return await fetchTrialStatus();
}

export async function purchaseMonthly(userId) {
  return await openPaymentFlow(userId, 'monthly');
}

export async function purchaseYearly(userId) {
  return await openPaymentFlow(userId, 'yearly');
}

export async function purchaseLifetime(userId) {
  return await openPaymentFlow(userId, 'lifetime');
}

export async function restorePurchases(userId) {
  return await getSubscriptionStatus(userId);
}

async function openPaymentFlow(userId, planType) {
  if (!userId) {
    throw new Error('User ID is required to process payment.');
  }

  const url = `${PAYMENT_PAGE_URL}?userId=${encodeURIComponent(userId)}&plan=${encodeURIComponent(planType)}`;
  await WebBrowser.openBrowserAsync(url);
  return await getSubscriptionStatus(userId);
}

async function updateSubscriptionCache(userId, status) {
  try {
    const db = await getDatabase();
    const nowISO = new Date().toISOString();
    
    // Table: subscription_cache (id, revenuecat_user_id, tier, plan, subscription_expiry, last_verified)
    const existing = await db.getFirstAsync('SELECT id FROM subscription_cache LIMIT 1');
    if (existing) {
      await db.runAsync(
        `UPDATE subscription_cache 
         SET revenuecat_user_id = ?, tier = ?, plan = ?, subscription_expiry = ?, last_verified = ?, updated_at = ?
         WHERE id = ?`,
        [userId, status.tier, status.plan, status.expiry, nowISO, nowISO, existing.id]
      );
    } else {
      await db.runAsync(
        `INSERT INTO subscription_cache (revenuecat_user_id, tier, plan, subscription_expiry, last_verified, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [userId, status.tier, status.plan, status.expiry, nowISO, nowISO, nowISO]
      );
    }
  } catch (e) {
    console.warn('Failed to update subscription_cache SQLite:', e);
  }
}

async function getCachedSubscriptionStatus(userId) {
  try {
    const db = await getDatabase();
    const row = await db.getFirstAsync(
      'SELECT tier, plan, subscription_expiry, last_verified FROM subscription_cache LIMIT 1'
    );

    if (row && row.last_verified) {
      const lastVerifiedMs = new Date(row.last_verified).getTime();
      const hoursSinceVerified = (Date.now() - lastVerifiedMs) / (1000 * 60 * 60);

      // 48 hours grace period for offline verification
      if (hoursSinceVerified <= 48 && row.tier === 'premium') {
        return {
          tier: 'premium',
          isPremium: true,
          plan: row.plan || 'monthly',
          expiry: row.subscription_expiry || null,
        };
      }
    }
  } catch (e) {
    console.warn('Failed to read subscription_cache from SQLite:', e);
  }

  return { tier: 'free', isPremium: false, plan: 'free', expiry: null };
}

