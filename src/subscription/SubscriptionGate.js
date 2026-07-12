import React from 'react';
import { useSubscription } from './useSubscription';
import PaywallScreen from './PaywallScreen';

export const SubscriptionGate = ({ feature, children, showClose = true }) => {
  const { checkAccess } = useSubscription();
  
  if (checkAccess(feature)) {
    return children;
  }
  
  return <PaywallScreen showClose={showClose} />;
};
