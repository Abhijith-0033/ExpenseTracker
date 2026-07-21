import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import PaywallScreen from '../src/subscription/PaywallScreen';

export default function PaywallRoute() {
  const { context } = useLocalSearchParams();
  const contextStr = Array.isArray(context) ? context[0] : context;
  return <PaywallScreen showClose={true} context={contextStr} />;
}
