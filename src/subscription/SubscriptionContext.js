import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { AppState } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import { getSubscriptionStatus, purchaseMonthly as buyMonthly, purchaseYearly as buyYearly, purchaseLifetime as buyLifetime, restorePurchases as restoreStatus } from './SubscriptionManager';
import { initTrial, getTrialStatus } from './trialManager';

const USER_ID_KEY = 'gastos_user_id';

export const FREE_FEATURES = [
  'add_expense',
  'add_income',
  'add_transfer',
  'view_transactions_30d',
  'basic_dashboard',
  'manage_categories',
  'single_account',
  'app_lock',
  'expense_books',
  'bill_splitter',
  'category_budgets',
  'monthly_trend_chart',
  'current_month_calendar',
];

const SubscriptionContext = createContext({
  userId: null,
  isPremium: false,
  isTrialActive: true,
  trialHoursRemaining: 168,
  trialDaysRemaining: 7,
  tier: 'free',
  plan: 'free',
  loading: true,
  purchaseMonthly: async () => {},
  purchaseYearly: async () => {},
  purchaseLifetime: async () => {},
  restorePurchases: async () => {},
  checkAccess: (_feature) => false,
  refreshSubscription: async () => {},
});

export const SubscriptionProvider = ({ children }) => {
  const [state, setState] = useState({
    userId: null,
    isPremium: false,
    isTrialActive: true,
    trialHoursRemaining: 168,
    trialDaysRemaining: 7,
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
    try {
      const uid = await loadOrCreateUserId();
      const [serverStatus, trialStatus] = await Promise.all([
        getSubscriptionStatus(uid),
        getTrialStatus(),
      ]);

      const isPremium = serverStatus.isPremium;
      const isTrialActive = !isPremium && trialStatus.isActive;

      setState({
        userId: uid,
        isPremium,
        isTrialActive,
        trialHoursRemaining: trialStatus.hoursRemaining,
        trialDaysRemaining: trialStatus.daysRemaining,
        plan: serverStatus.plan || (isTrialActive ? 'trial' : 'free'),
        tier: isPremium ? 'premium' : (isTrialActive ? 'trial' : 'free'),
        loading: false,
      });
    } catch (error) {
      console.warn('Failed to refresh subscription status:', error);
      const uid = await loadOrCreateUserId();
      const trialStatus = await getTrialStatus();
      setState(prev => ({
        ...prev,
        userId: uid,
        isPremium: false,
        isTrialActive: trialStatus.isActive,
        trialHoursRemaining: trialStatus.hoursRemaining,
        trialDaysRemaining: trialStatus.daysRemaining,
        plan: trialStatus.isActive ? 'trial' : 'free',
        tier: trialStatus.isActive ? 'trial' : 'free',
        loading: false,
      }));
    }
  }, []);

  useEffect(() => {
    // 1. Initial setup
    const init = async () => {
      await initTrial();
      await refreshSubscription();
    };
    init();

    // 2. Refresh on app foreground
    const sub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        refreshSubscription();
      }
    });

    return () => sub.remove();
  }, [refreshSubscription]);

  const checkAccess = useCallback((feature) => {
    if (state.isPremium || state.isTrialActive) return true;
    if (!feature) return false;
    return FREE_FEATURES.includes(feature);
  }, [state.isPremium, state.isTrialActive]);

  const purchaseMonthly = async () => {
    if (!state.userId) return;
    const res = await buyMonthly(state.userId);
    await refreshSubscription();
    return res;
  };

  const purchaseYearly = async () => {
    if (!state.userId) return;
    const res = await buyYearly(state.userId);
    await refreshSubscription();
    return res;
  };

  const purchaseLifetime = async () => {
    if (!state.userId) return;
    const res = await buyLifetime(state.userId);
    await refreshSubscription();
    return res;
  };

  const restorePurchases = async () => {
    if (!state.userId) return { isPremium: false };
    const res = await restoreStatus(state.userId);
    await refreshSubscription();
    return res;
  };

  return (
    <SubscriptionContext.Provider value={{
      ...state,
      purchaseMonthly,
      purchaseYearly,
      purchaseLifetime,
      restorePurchases,
      checkAccess,
      refreshSubscription,
    }}>
      {children}
    </SubscriptionContext.Provider>
  );
};

export const useSubscription = () => useContext(SubscriptionContext);
