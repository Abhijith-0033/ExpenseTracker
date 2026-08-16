import React from 'react';
export interface SubscriptionGateProps {
  feature?: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
  title?: string;
  description?: string;
  fullscreen?: boolean;
}
export declare function SubscriptionGate(props: SubscriptionGateProps): JSX.Element;