import { Platform } from 'react-native';

// RevenueCat API Keys — Replace these with your actual public keys from app.revenuecat.com
// Google Play key starts with goog_
const RC_GOOGLE_KEY = 'test_KLXzOTxrisiHSECstDMHluXmxx'; 
// App Store key starts with appl_
const RC_APPLE_KEY = 'test_KLXzOTxrisiHSECstDMHluXmxx';
// Amazon Appstore key starts with amzn_
const RC_AMAZON_KEY = 'amzn_nnetDlZOEfVAlbtjWDD0uUPrGCU';

export const RC_API_KEY = Platform.select({
  android: RC_AMAZON_KEY,
  ios: RC_APPLE_KEY,
  default: RC_GOOGLE_KEY
});

export const RC_ENTITLEMENT_ID = 'premium';
export const RC_MONTHLY_PACKAGE_ID = 'monthly_premium';
export const RC_YEARLY_PACKAGE_ID = 'yearly_premium';
