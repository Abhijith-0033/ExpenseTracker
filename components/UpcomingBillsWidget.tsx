import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Lock, CreditCard, Clock, CheckCircle2 } from 'lucide-react-native';
import { Colors, Layout, Typography } from '../constants/Theme';
import { getBillsDueInDays, markBillPaid, UpcomingBill } from '../services/upcomingBills';
import { useSubscription } from '../src/subscription/useSubscription';
import { useApp } from '../context/AppContext';
import { formatCurrency } from '../utils/currency';
import { format, differenceInDays, parseISO } from 'date-fns';

export const UpcomingBillsWidget = () => {
  const router = useRouter();
  const { isPremium, isTrialActive, restorePurchases } = useSubscription();
  const { accounts, refreshData } = useApp();
  const isFreeUser = !isPremium && !isTrialActive;

  const [bills, setBills] = useState<UpcomingBill[]>([]);
  const [loading, setLoading] = useState(false);
  const [markingId, setMarkingId] = useState<number | null>(null);

  const loadBills = useCallback(async () => {
    if (isFreeUser) return;
    try {
      setLoading(true);
      const data = await getBillsDueInDays(30);
      // Only show top 5 upcoming bills
      setBills(data.slice(0, 5));
    } catch (e) {
      console.error('Failed to load upcoming bills in widget:', e);
    } finally {
      setLoading(false);
    }
  }, [isFreeUser]);

  useEffect(() => {
    loadBills();
  }, [loadBills]);

  const handleMarkPaid = async (bill: UpcomingBill) => {
    // Determine account to pay from
    const payAccountId = bill.account_id || (accounts.length > 0 ? accounts[0].id : null);
    if (!payAccountId) {
      Alert.alert('Error', 'Please create an account first to log this payment.');
      return;
    }

    try {
      setMarkingId(bill.id);
      // Silently mark as paid in the background
      await markBillPaid(bill.id, payAccountId);
      
      // Refresh AppContext data (for balances/transactions lists)
      await refreshData();
      
      // Reload local widget list
      await loadBills();
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Failed to record bill payment.');
    } finally {
      setMarkingId(null);
    }
  };

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // FREE USER LOCK SCREEN OVERLAY
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  if (isFreeUser) {
    return (
      <View style={styles.premiumContainer}>
        <View style={styles.header}>
          <Text style={styles.title}>📅 Upcoming Bills Manager</Text>
          <View style={styles.premiumBadge}>
            <Lock size={12} color={Colors.primary[600]} style={{ marginRight: 4 }} />
            <Text style={styles.premiumBadgeText}>PREMIUM</Text>
          </View>
        </View>
        <View style={styles.lockedCard}>
          <View style={styles.lockIconContainer}>
            <Lock size={28} color={Colors.primary[500]} />
          </View>
          <Text style={styles.lockedTitle}>Never Miss a Bill Payment</Text>
          <Text style={styles.lockedDesc}>
            Track utilities, rent, credit cards, and subscriptions with smart multi-tier notifications (7 days, 3 days, 2 days, and day-of reminders).
          </Text>
          <View style={styles.actionRow}>
            <TouchableOpacity 
              style={styles.upgradeBtn}
              onPress={() => router.push('/paywall')}
            >
              <Text style={styles.upgradeBtnText}>Unlock Bills Manager</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.restoreBtn}
              onPress={restorePurchases}
            >
              <Text style={styles.restoreBtnText}>Restore</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // PREMIUM BILLS WIDGET
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const overdueCount = bills.filter(b => b.status === 'overdue').length;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={styles.title}>📅 Upcoming Bills</Text>
          {overdueCount > 0 && (
            <View style={styles.overdueBadge}>
              <Text style={styles.overdueBadgeText}>{overdueCount} Overdue</Text>
            </View>
          )}
        </View>
        <TouchableOpacity onPress={() => router.push('/upcoming-bills')}>
          <Text style={styles.viewAllBtnText}>Manage →</Text>
        </TouchableOpacity>
      </View>

      {loading && bills.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={Colors.primary[500]} />
        </View>
      ) : bills.length === 0 ? (
        <View style={styles.emptyCard}>
          <CreditCard size={28} color={Colors.gray[300]} style={{ marginBottom: 8 }} />
          <Text style={styles.emptyText}>No bills due in the next 30 days</Text>
          <TouchableOpacity 
            style={styles.addBillLink}
            onPress={() => router.push('/upcoming-bills/add')}
          >
            <Text style={styles.addBillLinkText}>+ Add a Bill</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {bills.map((bill) => {
            const dueDate = parseISO(bill.due_date);
            const daysLeft = differenceInDays(dueDate, new Date());

            let statusColor = Colors.success[500];
            let statusBg = Colors.success[50];
            let statusText = `${daysLeft} days left`;

            if (daysLeft < 0) {
              statusColor = Colors.danger[500];
              statusBg = Colors.danger[50];
              statusText = 'Overdue';
            } else if (daysLeft === 0) {
              statusColor = Colors.warning[500];
              statusBg = Colors.warning[50];
              statusText = 'Due Today';
            } else if (daysLeft === 1) {
              statusColor = Colors.warning[500];
              statusBg = Colors.warning[50];
              statusText = 'Due Tomorrow';
            } else if (daysLeft <= 3) {
              statusColor = Colors.warning[400];
              statusBg = Colors.warning[50];
            }

            const isMarking = markingId === bill.id;

            return (
              <View key={bill.id} style={styles.card}>
                <View style={styles.cardTopRow}>
                  <View style={[styles.statusBadge, { backgroundColor: statusBg }]}>
                    <Text style={[styles.statusText, { color: statusColor }]}>
                      {statusText}
                    </Text>
                  </View>
                  
                  <TouchableOpacity
                    style={[styles.payBtn, isMarking && { opacity: 0.7 }]}
                    disabled={isMarking}
                    onPress={() => handleMarkPaid(bill)}
                  >
                    {isMarking ? (
                      <ActivityIndicator size="small" color={Colors.white} style={{ scaleX: 0.7, scaleY: 0.7 }} />
                    ) : (
                      <CheckCircle2 size={14} color={Colors.white} />
                    )}
                  </TouchableOpacity>
                </View>

                <View style={styles.cardHeader}>
                  <View style={styles.iconContainer}>
                    <Text style={{ fontSize: 16 }}>{bill.icon || '📄'}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.billName} numberOfLines={1}>
                      {bill.name}
                    </Text>
                    <Text style={styles.dueDateText}>Due {format(dueDate, 'MMM dd')}</Text>
                  </View>
                </View>

                <View style={styles.footer}>
                  <Text style={styles.amountText}>{formatCurrency(bill.amount)}</Text>
                  <Clock size={12} color={Colors.gray[400]} style={{ marginLeft: 'auto' }} />
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 24,
  },
  premiumContainer: {
    marginBottom: 24,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingHorizontal: 16,
  },
  title: {
    fontSize: Typography.size.md,
    fontFamily: Typography.family.bold,
    color: Colors.gray[800],
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  premiumBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary[50],
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Layout.radius.full,
  },
  premiumBadgeText: {
    fontSize: 9,
    fontFamily: Typography.family.bold,
    color: Colors.primary[600],
  },
  viewAllBtnText: {
    fontSize: Typography.size.sm,
    fontFamily: Typography.family.bold,
    color: Colors.primary[600],
  },
  scrollContent: {
    paddingLeft: 16,
    paddingRight: 16,
    gap: 12,
  },
  card: {
    width: 170,
    backgroundColor: Colors.white,
    borderRadius: Layout.radius.xl,
    padding: 14,
    ...Layout.shadows.sm,
    borderWidth: 1,
    borderColor: Colors.gray[100],
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Layout.radius.full,
  },
  statusText: {
    fontSize: Typography.size.xs - 2,
    fontFamily: Typography.family.bold,
    textTransform: 'uppercase',
  },
  payBtn: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: Colors.primary[500],
    justifyContent: 'center',
    alignItems: 'center',
    ...Layout.shadows.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: Colors.gray[50],
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  billName: {
    fontSize: Typography.size.sm,
    fontFamily: Typography.family.bold,
    color: Colors.gray[900],
  },
  dueDateText: {
    fontSize: Typography.size.xs,
    fontFamily: Typography.family.regular,
    color: Colors.gray[500],
    marginTop: 1,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: Colors.gray[50],
    paddingTop: 8,
  },
  amountText: {
    fontSize: Typography.size.sm,
    fontFamily: Typography.family.bold,
    color: Colors.gray[900],
  },
  emptyCard: {
    marginHorizontal: 16,
    backgroundColor: Colors.white,
    borderRadius: Layout.radius.xl,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.gray[100],
    ...Layout.shadows.sm,
  },
  emptyText: {
    fontSize: Typography.size.sm,
    fontFamily: Typography.family.medium,
    color: Colors.gray[500],
  },
  addBillLink: {
    marginTop: 8,
  },
  addBillLinkText: {
    fontSize: Typography.size.sm,
    fontFamily: Typography.family.bold,
    color: Colors.primary[600],
  },
  loadingContainer: {
    height: 100,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Locked styles
  lockedCard: {
    marginHorizontal: 16,
    backgroundColor: Colors.white,
    borderRadius: Layout.radius.xl,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.gray[100],
    ...Layout.shadows.sm,
  },
  lockIconContainer: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: Colors.primary[50],
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  lockedTitle: {
    fontSize: Typography.size.md,
    fontFamily: Typography.family.bold,
    color: Colors.gray[900],
    marginBottom: 6,
  },
  lockedDesc: {
    fontSize: Typography.size.xs + 1,
    fontFamily: Typography.family.regular,
    color: Colors.gray[500],
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 16,
    paddingHorizontal: 8,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  upgradeBtn: {
    backgroundColor: Colors.primary[500],
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: Layout.radius.md,
    ...Layout.shadows.sm,
  },
  upgradeBtnText: {
    color: Colors.white,
    fontFamily: Typography.family.bold,
    fontSize: Typography.size.xs + 1,
  },
  restoreBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  restoreBtnText: {
    color: Colors.primary[600],
    fontFamily: Typography.family.bold,
    fontSize: Typography.size.xs + 1,
  },
  overdueBadge: {
    backgroundColor: Colors.danger[50],
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Layout.radius.full,
    marginLeft: 8,
  },
  overdueBadgeText: {
    fontSize: 9,
    fontFamily: Typography.family.bold,
    color: Colors.danger[600],
  },
});
