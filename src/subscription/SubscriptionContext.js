import React, { createContext, useContext, useEffect, useState } from 'react';

const SubscriptionContext = createContext({
  isPremium: true,
  isTrialActive: false,
  trialHoursRemaining: 0,
  tier: 'premium',
  plan: 'personal',
  loading: false,
  purchaseMonthly: async () => ({ tier: 'premium', isPremium: true }),
  purchaseYearly: async () => ({ tier: 'premium', isPremium: true }),
  restorePurchases: async () => ({ tier: 'premium', isPremium: true }),
  checkAccess: (_feature) => true,
  refreshSubscription: async () => {},
  toggleDevPremium: async () => {},
});

export const FREE_FEATURES = [];

export const SubscriptionProvider = ({ children }) => {
  const [state] = useState({
    isPremium: true,
    isTrialActive: false,
    trialHoursRemaining: 0,
    tier: 'premium',
    plan: 'personal',
    loading: false,
  });

  useEffect(() => {
    // Ensure scheduled expense engine is active
    const initEngine = async () => {
      try {
        const { registerScheduledExpenseTask } = await import('../scheduled/ScheduledExpenseEngine');
        await registerScheduledExpenseTask();
      } catch (e) {
        console.warn('ScheduledExpenseEngine init failed (non-critical):', e);
      }
    };
    initEngine();
  }, []);

  const checkAccess = (_feature) => true;
  const purchaseMonthly = async () => ({ tier: 'premium', isPremium: true });
  const purchaseYearly = async () => ({ tier: 'premium', isPremium: true });
  const restorePurchases = async () => ({ tier: 'premium', isPremium: true });
  const refreshSubscription = async () => {};
  const toggleDevPremium = async () => {};

  return (
    <SubscriptionContext.Provider value={{
      ...state,
      purchaseMonthly,
      purchaseYearly,
      restorePurchases,
      checkAccess,
      refreshSubscription,
      toggleDevPremium,
    }}>
      {children}
    </SubscriptionContext.Provider>
  );
};

export const useSubscription = () => useContext(SubscriptionContext);
