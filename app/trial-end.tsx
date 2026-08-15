import React from 'react';
import PaywallScreen from '../src/subscription/PaywallScreen';

export default function TrialEndScreen() {
  return <PaywallScreen showClose={false} context="trial_expired" />;
}
