import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, SafeAreaView, ActivityIndicator, Alert, StatusBar } from 'react-native';
import { useRouter } from 'expo-router';
import { Crown, Check, X, Shield, Sparkles, ArrowRight } from 'lucide-react-native';
import { Colors, Typography, Layout } from '../../constants/Theme';
import { useSubscription } from './useSubscription';
import { LinearGradient } from 'expo-linear-gradient';



export default function PaywallScreen({ showClose = true }) {
  const router = useRouter();
  const { purchaseMonthly, purchaseYearly, restorePurchases, isTrialActive, trialHoursRemaining, toggleDevPremium } = useSubscription();
  const [loading, setLoading] = useState(false);

  const handlePurchase = async (type) => {
    setLoading(true);
    try {
      if (type === 'monthly') {
        await purchaseMonthly();
      } else {
        await purchaseYearly();
      }
      Alert.alert('Success', 'Thank you for upgrading to Gastos Premium!');
      if (showClose) {
        router.back();
      }
    } catch (e) {
      if (e.message && e.message.includes('User cancelled')) {
        // Silent cancel
      } else {
        Alert.alert('Purchase Failed', e.message || 'Something went wrong during purchase.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async () => {
    setLoading(true);
    try {
      const result = await restorePurchases();
      if (result.isPremium) {
        Alert.alert('Restored', 'Your Gastos Premium subscription was restored successfully.');
        if (showClose) router.back();
      } else {
        Alert.alert('No Subscription Found', 'We could not find an active subscription to restore.');
      }
    } catch (_e) {
      Alert.alert('Error', 'Failed to restore purchases.');
    } finally {
      setLoading(false);
    }
  };

  const premiumFeatures = [
    { title: 'Unlimited Accounts', desc: 'Add credit cards, cash wallets, bank accounts.' },
    { title: 'Scheduled Expenses', desc: 'Automate your daily, weekly, or monthly recurring bills.' },
    { title: 'All-Time Transaction History', desc: 'No more 30-day limits. View all your historical records.' },
    { title: 'Deep Analytics Insights', desc: 'Access distribution graphs, composition charts, yearly comparison.' },
    { title: 'Advanced Financial Modules', desc: 'EMI tracker, chit funds, sinking funds, split bill groups.' },
    { title: 'Data Backup & Export', desc: 'Backup full data in JSON and export transactions to CSV.' },
    { title: 'Telegram Integration', desc: 'Log expenses on the go with our AI-powered Telegram Bot.' },
    { title: 'Smart Budgets & Goals', desc: 'Manage unlimited savings goals and target budgets.' },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      <LinearGradient
        colors={[Colors.gray[900], '#1E1E38']}
        style={StyleSheet.absoluteFill}
      />
      
      {/* Background decoration */}
      <View style={styles.glowCircle1} />
      <View style={styles.glowCircle2} />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          {showClose ? (
            <TouchableOpacity onPress={() => router.back()} style={styles.closeButton}>
              <X size={20} color={Colors.white} />
            </TouchableOpacity>
          ) : <View style={{ height: 40 }} />}
          
          <Crown size={48} color="#F59E0B" style={styles.crownIcon} />
          <Text style={styles.title}>Gastos Premium</Text>
          <Text style={styles.subtitle}>Supercharge your personal finance management</Text>
        </View>

        {/* Trial Banner */}
        {isTrialActive && (
          <View style={styles.trialBanner}>
            <Sparkles size={16} color={Colors.warning[500]} />
            <Text style={styles.trialText}>
              You are currently on a <Text style={{ fontFamily: Typography.family.bold }}>48-hour free trial</Text> ({Math.round(trialHoursRemaining)}h left)
            </Text>
          </View>
        )}

        {/* Pricing Cards */}
        <View style={styles.pricingContainer}>
          {/* Yearly Card (Recommended) */}
          <TouchableOpacity 
            style={[styles.pricingCard, styles.yearlyCard]} 
            activeOpacity={0.9}
            onPress={() => handlePurchase('yearly')}
          >
            <View style={styles.bestValueBadge}>
              <Text style={styles.bestValueText}>BEST VALUE</Text>
            </View>
            <Text style={styles.planTitle}>Yearly Access</Text>
            <View style={styles.priceRow}>
              <Text style={styles.currencySymbol}>₹</Text>
              <Text style={styles.priceValue}>799</Text>
              <Text style={styles.priceDuration}>/ year</Text>
            </View>
            <Text style={styles.priceMeta}>₹66.58/month — Save 44%</Text>
            
            <View style={[styles.buyButton, styles.yearlyBuyButton]}>
              <Text style={styles.buyButtonText}>Unlock Yearly Premium</Text>
              <ArrowRight size={16} color={Colors.gray[900]} />
            </View>
          </TouchableOpacity>

          {/* Monthly Card */}
          <TouchableOpacity 
            style={[styles.pricingCard, styles.monthlyCard]} 
            activeOpacity={0.9}
            onPress={() => handlePurchase('monthly')}
          >
            <Text style={[styles.planTitle, { color: Colors.white }]}>Monthly Pass</Text>
            <View style={styles.priceRow}>
              <Text style={[styles.currencySymbol, { color: Colors.gray[300] }]}>₹</Text>
              <Text style={[styles.priceValue, { color: Colors.white }]}>99</Text>
              <Text style={[styles.priceDuration, { color: Colors.gray[400] }]}>/ month</Text>
            </View>
            <Text style={[styles.priceMeta, { color: Colors.gray[400] }]}>Billed monthly. Cancel anytime.</Text>
            
            <View style={[styles.buyButton, styles.monthlyBuyButton]}>
              <Text style={[styles.buyButtonText, { color: Colors.white }]}>Get Monthly Pass</Text>
              <ArrowRight size={16} color={Colors.white} />
            </View>
          </TouchableOpacity>
        </View>

        {/* Features List */}
        <View style={styles.featuresContainer}>
          <Text style={styles.sectionHeader}>{"What's Included"}</Text>
          {premiumFeatures.map((feat, index) => (
            <View key={index} style={styles.featureRow}>
              <View style={styles.checkWrapper}>
                <Check size={16} color={Colors.success[500]} />
              </View>
              <View style={styles.featureTextContainer}>
                <Text style={styles.featureTitle}>{feat.title}</Text>
                <Text style={styles.featureDesc}>{feat.desc}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Restore purchases & privacy */}
        <View style={styles.footerContainer}>
          {__DEV__ && (
            <TouchableOpacity 
              style={styles.devBypassBtn} 
              onPress={async () => {
                await toggleDevPremium();
                Alert.alert('Dev Mode', 'Subscription state toggled!');
                if (showClose) {
                  router.back();
                }
              }}
            >
              <Sparkles size={14} color={Colors.warning[500]} style={{ marginRight: 6 }} />
              <Text style={styles.devBypassText}>DEBUG: Toggle Premium Bypass</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity style={styles.restoreBtn} onPress={handleRestore}>
            <Shield size={14} color={Colors.gray[400]} style={{ marginRight: 6 }} />
            <Text style={styles.restoreBtnText}>Restore Purchases</Text>
          </TouchableOpacity>
          <Text style={styles.termsText}>
            Payments will be processed securely via Google Play / App Store. Active subscriptions will auto-renew until cancelled in your store account settings.
          </Text>
        </View>
      </ScrollView>

      {/* Loading Overlay */}
      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={Colors.primary[500]} />
          <Text style={styles.loadingText}>Processing transaction...</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#101026',
  },
  glowCircle1: {
    position: 'absolute',
    top: -100,
    right: -100,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: 'rgba(232, 145, 122, 0.15)',
    filter: 'blur(60px)',
  },
  glowCircle2: {
    position: 'absolute',
    bottom: 100,
    left: -150,
    width: 350,
    height: 350,
    borderRadius: 175,
    backgroundColor: 'rgba(99, 102, 241, 0.12)',
    filter: 'blur(70px)',
  },
  scrollContent: {
    paddingBottom: 60,
  },
  header: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 16,
    marginBottom: 20,
  },
  closeButton: {
    alignSelf: 'flex-start',
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    marginBottom: 16,
  },
  crownIcon: {
    marginBottom: 16,
  },
  title: {
    fontSize: Typography.size.xxl,
    fontFamily: Typography.family.bold,
    color: Colors.white,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: Typography.size.sm,
    fontFamily: Typography.family.medium,
    color: Colors.gray[400],
    textAlign: 'center',
    paddingHorizontal: 20,
    lineHeight: 20,
  },
  trialBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginHorizontal: 24,
    marginBottom: 24,
    gap: 10,
  },
  trialText: {
    flex: 1,
    fontSize: Typography.size.xs + 1,
    color: '#FBBF24',
    fontFamily: Typography.family.regular,
  },
  pricingContainer: {
    paddingHorizontal: 24,
    gap: 16,
    marginBottom: 32,
  },
  pricingCard: {
    borderRadius: 24,
    padding: 24,
    ...Layout.shadows.md,
  },
  yearlyCard: {
    backgroundColor: Colors.primary[500],
    borderWidth: 1.5,
    borderColor: Colors.primary[200],
  },
  monthlyCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  bestValueBadge: {
    position: 'absolute',
    top: 16,
    right: 20,
    backgroundColor: '#FFE8E0',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  bestValueText: {
    fontSize: 9,
    fontFamily: Typography.family.bold,
    color: Colors.primary[700],
    letterSpacing: 0.5,
  },
  planTitle: {
    fontSize: Typography.size.md,
    fontFamily: Typography.family.bold,
    color: Colors.gray[900],
    marginBottom: 8,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 4,
  },
  currencySymbol: {
    fontSize: 20,
    fontFamily: Typography.family.bold,
    color: Colors.gray[900],
    marginRight: 2,
  },
  priceValue: {
    fontSize: 36,
    fontFamily: Typography.family.bold,
    color: Colors.gray[900],
  },
  priceDuration: {
    fontSize: Typography.size.sm,
    fontFamily: Typography.family.medium,
    color: Colors.gray[700],
    marginLeft: 4,
  },
  priceMeta: {
    fontSize: Typography.size.xs,
    fontFamily: Typography.family.medium,
    color: Colors.gray[800],
    marginBottom: 20,
  },
  buyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 16,
    gap: 8,
  },
  yearlyBuyButton: {
    backgroundColor: Colors.white,
  },
  monthlyBuyButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  buyButtonText: {
    fontSize: Typography.size.md - 1,
    fontFamily: Typography.family.bold,
    color: Colors.gray[900],
  },
  featuresContainer: {
    paddingHorizontal: 24,
    marginBottom: 32,
  },
  sectionHeader: {
    fontSize: Typography.size.md,
    fontFamily: Typography.family.bold,
    color: Colors.white,
    marginBottom: 16,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  featureRow: {
    flexDirection: 'row',
    marginBottom: 20,
    alignItems: 'flex-start',
    gap: 16,
  },
  checkWrapper: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(77, 150, 111, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  featureTextContainer: {
    flex: 1,
  },
  featureTitle: {
    fontSize: Typography.size.md - 1,
    fontFamily: Typography.family.bold,
    color: Colors.white,
    marginBottom: 4,
  },
  featureDesc: {
    fontSize: Typography.size.sm - 1,
    fontFamily: Typography.family.regular,
    color: Colors.gray[400],
    lineHeight: 18,
  },
  footerContainer: {
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  restoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    marginBottom: 16,
  },
  restoreBtnText: {
    fontSize: Typography.size.xs + 1,
    fontFamily: Typography.family.bold,
    color: Colors.gray[400],
  },
  termsText: {
    fontSize: Typography.size.xs - 1,
    color: Colors.gray[500],
    textAlign: 'center',
    lineHeight: 14,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(16, 16, 38, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  loadingText: {
    marginTop: 16,
    color: Colors.white,
    fontFamily: Typography.family.medium,
    fontSize: Typography.size.sm,
  },
  devBypassBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  devBypassText: {
    fontSize: Typography.size.xs + 1,
    fontFamily: Typography.family.bold,
    color: '#FBBF24',
  },
});
