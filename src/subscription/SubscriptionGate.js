import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Lock, Sparkles } from 'lucide-react-native';
import { Colors, Typography, Layout } from '../../constants/Theme';
import { useSubscription } from './useSubscription';

/**
 * SubscriptionGate
 * @param {string} [feature] - Key of feature to check against checkAccess()
 * @param {React.ReactNode} children - Component to render if user has access
 * @param {React.ReactNode} [fallback] - Custom fallback UI if locked
 * @param {string} [title] - Custom lock card title
 * @param {string} [description] - Custom lock card description
 * @param {boolean} [fullscreen=true] - If true, renders a full page lock
 */
export function SubscriptionGate({
  feature,
  children,
  fallback,
  title = 'Premium Feature',
  description = 'Upgrade to Gastos Premium to unlock this feature and take control of your finances.',
  fullscreen = true,
}) {
  const router = useRouter();
  const { isPremium, isTrialActive, loading, checkAccess } = useSubscription();

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary[600]} />
      </View>
    );
  }

  const hasAccess = feature ? checkAccess(feature) : (isPremium || isTrialActive);

  if (hasAccess) {
    return children;
  }

  if (fallback) {
    return fallback;
  }

  return (
    <View style={fullscreen ? styles.fullContainer : styles.cardContainer}>
      <View style={styles.iconCircle}>
        <Lock size={28} color={Colors.primary[600]} />
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.description}>{description}</Text>
      <TouchableOpacity
        style={styles.upgradeBtn}
        activeOpacity={0.85}
        onPress={() => router.push('/paywall')}
      >
        <Sparkles size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
        <Text style={styles.upgradeBtnText}>Upgrade to Premium</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.gray[50],
  },
  fullContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: Colors.gray[50],
  },
  cardContainer: {
    backgroundColor: Colors.white,
    borderRadius: Layout.radius.xl,
    padding: 24,
    marginVertical: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.gray[200],
    ...Layout.shadows.sm,
  },
  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: Colors.primary[50],
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.primary[100],
  },
  title: {
    fontSize: Typography.size.lg,
    fontFamily: Typography.family.bold,
    color: Colors.gray[900],
    marginBottom: 8,
    textAlign: 'center',
  },
  description: {
    fontSize: Typography.size.sm,
    fontFamily: Typography.family.regular,
    color: Colors.gray[600],
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
    paddingHorizontal: 12,
  },
  upgradeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary[600],
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: Layout.radius.full,
    ...Layout.shadows.sm,
  },
  upgradeBtnText: {
    color: '#FFFFFF',
    fontSize: Typography.size.md,
    fontFamily: Typography.family.bold,
  },
});

