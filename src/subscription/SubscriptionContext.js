import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';

const USER_ID_KEY = 'gastos_user_id';
const SERVER_URL = 'https://gastos-server-wfl5.onrender.com';

const SubscriptionContext = createContext({
  userId: null,
  isPremium: false,
  isTrialActive: false,
  trialHoursRemaining: 0,
  tier: 'free',
  plan: 'free',
  loading: true,
  purchaseMonthly: async () => {},
  purchaseYearly: async () => {},
  restorePurchases: async () => {},
  checkAccess: (_feature) => false,
  refreshSubscription: async () => {},
  toggleDevPremium: async () => {},
});

export const FREE_FEATURES = [];

export const SubscriptionProvider = ({ children }) => {
  const [state, setState] = useState({
    userId: null,
    isPremium: false,
    isTrialActive: false,
    trialHoursRemaining: 0,
    tier: 'free',
    plan: 'free',
    loading: true,
  });

  const loadOrCreateUserId = async () => {
    try {
      let id = await SecureStore.getItemAsync(USER_ID_KEY);
      if (!id) {
        id = Crypto.randomUUID();
        await SecureStore.setItemAsync(USER_ID_KEY, id);
      }
      return id;
    } catch (e) {
      console.warn('Error reading UUID from SecureStore:', e);
      return 'fallback_local_user_id';
    }
  };

  const refreshSubscription = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true }));
    try {
      const uid = await loadOrCreateUserId();
      
      const response = await fetch(`${SERVER_URL}/api/subscription-status/${uid}`);
      if (!response.ok) throw new Error('Failed to fetch status');
      
      const data = await response.json();
      
      setState({
        userId: uid,
        isPremium: data.isPremium,
        plan: data.plan,
        tier: data.isPremium ? 'premium' : 'free',
        isTrialActive: false,
        trialHoursRemaining: 0,
        loading: false,
      });
    } catch (error) {
      console.warn('Failed to refresh subscription from server:', error);
      // Fallback to free if we can't reach the server
      const uid = await loadOrCreateUserId();
      setState(prev => ({
        ...prev,
        userId: uid,
        isPremium: false,
        plan: 'free',
        tier: 'free',
        loading: false,
      }));
    }
  }, []);

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
    
    // Check real status
    refreshSubscription();
  }, [refreshSubscription]);

  const checkAccess = (_feature) => state.isPremium;
  const purchaseMonthly = async () => {};
  const purchaseYearly = async () => {};
  const restorePurchases = async () => {
    await refreshSubscription();
    return { isPremium: state.isPremium };
  };
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
