import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  SafeAreaView,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { ShieldAlert, ArrowRight, Activity, Calendar, Tag, Shield, Clock } from 'lucide-react-native';
import { Colors, Typography, Layout } from '../constants/Theme';
import { getDatabase, initDatabase } from '../services/database';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function TrialEndScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    transactions: 0,
    categories: 0,
    emis: 0,
    savingsGoals: 0,
  });

  useEffect(() => {
    async function loadStats() {
      try {
        await initDatabase();
        const db = getDatabase();
        if (db) {
          const txRes = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM transactions');
          const catRes = await db.getFirstAsync<{ count: number }>('SELECT COUNT(DISTINCT category) as count FROM transactions');
          const emiRes = await db.getFirstAsync<{ count: number }>("SELECT COUNT(*) as count FROM emi_records WHERE status = 'active'");
          const goalRes = await db.getFirstAsync<{ count: number }>("SELECT COUNT(*) as count FROM savings_goals WHERE is_completed = 0");

          setStats({
            transactions: txRes?.count ?? 0,
            categories: catRes?.count ?? 0,
            emis: emiRes?.count ?? 0,
            savingsGoals: goalRes?.count ?? 0,
          });
        }
      } catch (e) {
        console.warn('Failed to load stats on trial-end screen:', e);
      } finally {
        setLoading(false);
      }
    }
    loadStats();
  }, []);

  const handleContinueFree = () => {
    router.replace('/(tabs)');
  };

  const handleUpgrade = () => {
    router.replace('/paywall?context=trial_ending');
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary[500]} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={['#0F0C20', '#15102A', '#0F0C20']}
        style={StyleSheet.absoluteFill}
      />

      <View style={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.alertBadge}>
            <ShieldAlert size={28} color="#EF4444" />
          </View>
          <Text style={styles.title}>Your Premium Trial Has Expired</Text>
          <Text style={styles.subtitle}>
            Your data is 100% safe, but advanced features are now locked.
          </Text>
        </View>

        {/* Stats Summary List */}
        <View style={styles.statsCard}>
          <Text style={styles.statsCardTitle}>{"Here's what you built in the last 48 hours:"}</Text>
          
          <View style={styles.statRow}>
            <View style={styles.iconWrapper}>
              <Activity size={18} color={Colors.primary[400]} />
            </View>
            <View style={styles.statTextContainer}>
              <Text style={styles.statValue}>{stats.transactions} transactions logged</Text>
              <Text style={styles.statLabel}>Historical data logs</Text>
            </View>
          </View>

          <View style={styles.separator} />

          <View style={styles.statRow}>
            <View style={styles.iconWrapper}>
              <Tag size={18} color="#10B981" />
            </View>
            <View style={styles.statTextContainer}>
              <Text style={styles.statValue}>{stats.categories} categories tracked</Text>
              <Text style={styles.statLabel}>Spending insights and breakdown</Text>
            </View>
          </View>

          {stats.emis > 0 && (
            <>
              <View style={styles.separator} />
              <View style={styles.statRow}>
                <View style={styles.iconWrapper}>
                  <Calendar size={18} color="#F59E0B" />
                </View>
                <View style={styles.statTextContainer}>
                  <Text style={styles.statValue}>{stats.emis} active EMIs managed</Text>
                  <Text style={styles.statLabel}>Loan tracking & AutoPay schedule</Text>
                </View>
              </View>
            </>
          )}

          {stats.savingsGoals > 0 && (
            <>
              <View style={styles.separator} />
              <View style={styles.statRow}>
                <View style={styles.iconWrapper}>
                  <Shield size={18} color="#8B5CF6" />
                </View>
                <View style={styles.statTextContainer}>
                  <Text style={styles.statValue}>{stats.savingsGoals} savings goals in progress</Text>
                  <Text style={styles.statLabel}>Goal milestones and progress tracking</Text>
                </View>
              </View>
            </>
          )}
        </View>

        {/* CTA Buttons */}
        <View style={styles.footer}>
          <Pressable
            style={({ pressed }) => [styles.upgradeBtn, pressed && styles.pressed]}
            onPress={handleUpgrade}
          >
            <Text style={styles.upgradeBtnText}>Keep Premium Access</Text>
            <ArrowRight size={18} color={Colors.white} />
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.skipBtn, pressed && styles.pressed]}
            onPress={handleContinueFree}
          >
            <Text style={styles.skipBtnText}>Continue with Free Version</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F0C20',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#0F0C20',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
  header: {
    alignItems: 'center',
    marginTop: 20,
  },
  alertBadge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 1.5,
    borderColor: 'rgba(239, 68, 68, 0.25)',
  },
  title: {
    fontSize: 24,
    fontFamily: Typography.family.bold,
    color: Colors.white,
    textAlign: 'center',
    marginBottom: 10,
    lineHeight: 30,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: Typography.family.medium,
    color: Colors.gray[400],
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 12,
  },
  statsCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: Layout.radius.xl,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    marginVertical: 24,
  },
  statsCardTitle: {
    fontSize: 14,
    fontFamily: Typography.family.bold,
    color: Colors.gray[300],
    marginBottom: 16,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconWrapper: {
    width: 36,
    height: 36,
    borderRadius: Layout.radius.md,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  statTextContainer: {
    flex: 1,
  },
  statValue: {
    fontSize: 15,
    fontFamily: Typography.family.bold,
    color: Colors.white,
  },
  statLabel: {
    fontSize: 12,
    color: Colors.gray[400],
    marginTop: 2,
    fontFamily: Typography.family.regular,
  },
  separator: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    marginVertical: 14,
  },
  footer: {
    gap: 16,
    marginBottom: 10,
  },
  upgradeBtn: {
    backgroundColor: Colors.primary[500],
    borderRadius: Layout.radius.lg,
    paddingVertical: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  upgradeBtnText: {
    fontSize: 16,
    fontFamily: Typography.family.bold,
    color: Colors.white,
  },
  skipBtn: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  skipBtnText: {
    fontSize: 14,
    fontFamily: Typography.family.medium,
    color: Colors.gray[400],
    textDecorationLine: 'underline',
  },
  pressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
});
