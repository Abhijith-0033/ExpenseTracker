import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SubscriptionManager from './SubscriptionManager';

const SubscriptionContext = createContext({
  isPremium: false,
  isTrialActive: false,
  trialHoursRemaining: 0,
  tier: 'free',
  plan: null,
  loading: true,
  purchaseMonthly: async () => {},
  purchaseYearly: async () => {},
  restorePurchases: async () => {},
  checkAccess: (feature) => false,
  refreshSubscription: async () => {},
  toggleDevPremium: async () => {},
});

export const FREE_FEATURES = [
  'add_expense',
  'add_income',
  'view_transactions_30d',
  'basic_dashboard',
  'manage_categories',
  'single_account',
  'basic_notifications',
];

export const SubscriptionProvider = ({ children }) => {
  const [state, setState] = useState({
    isPremium: false,
    isTrialActive: false,
    trialHoursRemaining: 0,
    tier: 'free',
    plan: null,
    loading: true,
  });
  
  const appStateRef = useRef('active');

  const refreshSubscription = async () => {
    let isSubscribed = false;
    let currentTier = 'free';
    let currentPlan = null;
    let isTrialOn = false;
    let trialHours = 0;

    try {
      const subStatus = await SubscriptionManager.getSubscriptionStatus().catch(err => {
        console.warn('getSubscriptionStatus failed:', err);
        return { isPremium: false, tier: 'free', plan: null };
      });
      isSubscribed = subStatus.isPremium;
      currentTier = subStatus.tier;
      currentPlan = subStatus.plan;
    } catch (e) {
      console.warn(e);
    }

    try {
      const trialStatus = await SubscriptionManager.getTrialStatus().catch(err => {
        console.warn('getTrialStatus failed:', err);
        return { isActive: false, hoursRemaining: 0 };
      });
      isTrialOn = trialStatus.isActive;
      trialHours = trialStatus.hoursRemaining;
    } catch (e) {
      console.warn(e);
    }

    try {
      const devOverride = await AsyncStorage.getItem('dev_force_premium');
      const forcePremium = devOverride === 'true';

      setState({
        isPremium: forcePremium || isSubscribed,
        tier: forcePremium ? 'premium' : currentTier,
        plan: forcePremium ? 'dev_bypass' : currentPlan,
        isTrialActive: (forcePremium || isSubscribed) ? false : isTrialOn,
        trialHoursRemaining: trialHours,
        loading: false,
      });
    } catch (e) {
      console.warn('Storage read or setState failed in refreshSubscription:', e);
      setState(prev => ({ ...prev, loading: false }));
    }
  };

  useEffect(() => {
    // Initialize RevenueCat & get initial status
    SubscriptionManager.initialize().catch(console.warn);
    refreshSubscription();
  }, []);

  // Refresh on foreground
  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active' && appStateRef.current !== 'active') {
        refreshSubscription();
      }
      appStateRef.current = nextState;
    });
    return () => sub.remove();
  }, []);

  const checkAccess = (feature) => {
    if (state.isPremium || state.isTrialActive) return true;
    return FREE_FEATURES.includes(feature);
  };

  const purchaseMonthly = async () => {
    const result = await SubscriptionManager.purchaseMonthly();
    await refreshSubscription();
    await handleUpgrade();
    return result;
  };

  const purchaseYearly = async () => {
    const result = await SubscriptionManager.purchaseYearly();
    await refreshSubscription();
    await handleUpgrade();
    return result;
  };

  const restorePurchases = async () => {
    const result = await SubscriptionManager.restorePurchases();
    await refreshSubscription();
    if (result.isPremium) {
      await handleUpgrade();
    } else {
      await handleDowngrade();
    }
    return result;
  };

  const handleUpgrade = async () => {
    try {
      const { registerScheduledExpenseTask, scheduleNotificationsForExpense } = 
        await import('../scheduled/ScheduledExpenseEngine');
      await registerScheduledExpenseTask();
      // Reschedule all active schedules
      const { getDatabase } = await import('../../services/database');
      const db = getDatabase();
      const schedules = await db.getAllAsync(
        "SELECT * FROM scheduled_expenses WHERE status = 'active' AND is_active = 1"
      );
      for (const se of schedules) {
        await scheduleNotificationsForExpense(se);
      }
    } catch (e) {
      console.warn('handleUpgrade failed:', e);
    }
  };

  const handleDowngrade = async () => {
    try {
      const { unregisterScheduledExpenseTask, cancelNotificationsForExpense } = 
        await import('../scheduled/ScheduledExpenseEngine');
      await unregisterScheduledExpenseTask();
      // Cancel all scheduled notifications
      const { getDatabase } = await import('../../services/database');
      const db = getDatabase();
      const schedules = await db.getAllAsync("SELECT id FROM scheduled_expenses");
      for (const se of schedules) {
        await cancelNotificationsForExpense(se.id);
      }
    } catch (e) {
      console.warn('handleDowngrade failed:', e);
    }
  };

  const toggleDevPremium = async () => {
    try {
      const current = await AsyncStorage.getItem('dev_force_premium');
      const newVal = current === 'true' ? 'false' : 'true';
      await AsyncStorage.setItem('dev_force_premium', newVal);
      if (newVal === 'true') {
        await handleUpgrade();
      } else {
        await handleDowngrade();
      }
      await refreshSubscription();
    } catch (e) {
      console.warn('toggleDevPremium failed:', e);
    }
  };

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
