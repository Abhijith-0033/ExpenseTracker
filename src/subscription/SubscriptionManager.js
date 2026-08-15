export async function initialize() {
  // No-op for personal app build
}

export async function getSubscriptionStatus() {
  return { tier: 'premium', isPremium: true, expiry: null, plan: 'personal' };
}

export async function getTrialStatus() {
  return { isActive: false, hoursRemaining: 0 };
}

export async function purchaseMonthly() {
  return { tier: 'premium', isPremium: true, expiry: null, plan: 'personal' };
}

export async function purchaseYearly() {
  return { tier: 'premium', isPremium: true, expiry: null, plan: 'personal' };
}

export async function restorePurchases() {
  return { tier: 'premium', isPremium: true, expiry: null, plan: 'personal' };
}

export async function getUserId() {
  return null;
}

