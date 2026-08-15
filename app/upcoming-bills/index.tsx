import React, { useState, useCallback } from 'react';
import { 
  View, Text, StyleSheet, ScrollView, TouchableOpacity, 
  RefreshControl, ActivityIndicator, Alert 
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { 
  ArrowLeft, Plus, Calendar, CheckCircle2, Clock 
} from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Colors, Typography, Layout } from '../../constants/Theme';
import { formatCurrency } from '../../utils/currency';
import { getDatabase } from '../../services/database';
import { 
  getAllUpcomingBills, markBillPaid, 
  deleteUpcomingBill, snoozeUpcomingBill, UpcomingBill 
} from '../../services/upcomingBills';
import { useApp } from '../../context/AppContext';
import { format, parseISO, differenceInDays } from 'date-fns';
import { SwipeableRow } from '../../components/SwipeableRow';
import { ConfirmActionSheet } from '../../components/ConfirmActionSheet';
import { SubscriptionGate } from '../../src/subscription/SubscriptionGate';

export default function UpcomingBillsIndex() {
  return (
    <SubscriptionGate
      feature="upcoming_bills"
      title="Upcoming Bills is Premium"
      description="Track pending & overdue bills, get automatic pay reminders, and snooze bills."
    >
      <UpcomingBillsContent />
    </SubscriptionGate>
  );
}

function UpcomingBillsContent() {
  const router = useRouter();
  const { accounts, refreshData } = useApp();

  const [bills, setBills] = useState<(UpcomingBill & { account_name?: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'pending' | 'overdue' | 'paid' | 'all'>('pending');
  
  // Snooze Date Picker State
  const [snoozeBillId, setSnoozeBillId] = useState<number | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [snoozeDate, setSnoozeDate] = useState(new Date());

  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);

  const [confirmSheet, setConfirmSheet] = useState<{
    title: string;
    description: string;
    confirmLabel: string;
    actionType: 'delete' | 'edit' | 'approve' | 'pay' | 'warning';
    onConfirm: () => void;
  } | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const rawBills = await getAllUpcomingBills();
      
      // Resolve account names
      const db = getDatabase();
      const userAccounts = await db.getAllAsync<{ id: number; name: string }>(
        'SELECT id, name FROM accounts'
      );
      const accountMap = new Map(userAccounts.map(a => [a.id, a.name]));

      const resolved = rawBills.map(b => ({
        ...b,
        account_name: b.account_id ? accountMap.get(b.account_id) : undefined
      }));

      setBills(resolved);
    } catch (e) {
      console.error('Failed to load upcoming bills:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleMarkPaid = async (bill: UpcomingBill) => {
    const payAccountId = bill.account_id || (accounts.length > 0 ? accounts[0].id : null);
    if (!payAccountId) {
      Alert.alert('Error', 'Please create an account first to log this payment.');
      return;
    }

    setConfirmSheet({
      title: 'Mark as Paid?',
      description: `This will record a transaction of ${formatCurrency(bill.amount)} for "${bill.name}" and mark the bill as settled.`,
      confirmLabel: 'Confirm Paid',
      actionType: 'pay',
      onConfirm: async () => {
        setConfirmSheet(null);
        try {
          setActionLoadingId(bill.id);
          await markBillPaid(bill.id, payAccountId);
          await refreshData();
          await loadData();
        } catch (e) {
          console.error(e);
          Alert.alert('Error', 'Failed to mark bill as paid.');
        } finally {
          setActionLoadingId(null);
        }
      }
    });
  };

  const handleSnoozePress = (bill: UpcomingBill) => {
    setSnoozeBillId(bill.id);
    setSnoozeDate(bill.due_date ? parseISO(bill.due_date) : new Date());
    setShowDatePicker(true);
  };

  const handleSnoozeConfirm = async (event: any, date?: Date) => {
    setShowDatePicker(false);
    if (!date || snoozeBillId === null) {
      setSnoozeBillId(null);
      return;
    }

    try {
      setActionLoadingId(snoozeBillId);
      const dateStr = date.toISOString().split('T')[0];
      await snoozeUpcomingBill(snoozeBillId, dateStr);
      await loadData();
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Failed to snooze bill.');
    } finally {
      setSnoozeBillId(null);
      setActionLoadingId(null);
    }
  };

  const handleDeleteBill = (bill: UpcomingBill) => {
    setConfirmSheet({
      title: 'Delete Bill?',
      description: `Are you sure you want to delete "${bill.name}"? This action cannot be undone.`,
      confirmLabel: 'Delete',
      actionType: 'delete',
      onConfirm: async () => {
        setConfirmSheet(null);
        try {
          setActionLoadingId(bill.id);
          await deleteUpcomingBill(bill.id);
          await loadData();
        } catch (e) {
          console.error(e);
          Alert.alert('Error', 'Failed to delete bill.');
        } finally {
          setActionLoadingId(null);
        }
      }
    });
  };

  const handleEditBill = (bill: UpcomingBill) => {
    router.push({
      pathname: '/upcoming-bills/add',
      params: { id: bill.id }
    });
  };

  // Filter bills
  const filteredBills = bills.filter(b => {
    if (activeTab === 'all') return true;
    if (activeTab === 'paid') return b.status === 'paid';
    if (activeTab === 'overdue') return b.status === 'overdue';
    if (activeTab === 'pending') return b.status === 'pending' || b.status === 'snoozed';
    return true;
  });

  // Calculate Metrics
  const stats = {
    pendingCount: bills.filter(b => b.status === 'pending' || b.status === 'snoozed').length,
    pendingTotal: bills.filter(b => b.status === 'pending' || b.status === 'snoozed').reduce((sum, b) => sum + b.amount, 0),
    overdueCount: bills.filter(b => b.status === 'overdue').length,
    overdueTotal: bills.filter(b => b.status === 'overdue').reduce((sum, b) => sum + b.amount, 0),
    paidCount: bills.filter(b => b.status === 'paid').length,
    paidTotal: bills.filter(b => b.status === 'paid').reduce((sum, b) => sum + b.amount, 0),
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <ArrowLeft size={24} color={Colors.gray[800]} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Upcoming Bills</Text>
        <TouchableOpacity 
          style={styles.addBtn}
          onPress={() => router.push('/upcoming-bills/add')}
        >
          <Plus size={24} color={Colors.primary[600]} />
        </TouchableOpacity>
      </View>

      {/* Metrics Row */}
      <View style={styles.metricsContainer}>
        <View style={[styles.metricCard, { backgroundColor: Colors.danger[50] }]}>
          <Text style={[styles.metricLabel, { color: Colors.danger[600] }]}>Overdue</Text>
          <Text style={[styles.metricValue, { color: Colors.danger[700] }]}>{formatCurrency(stats.overdueTotal)}</Text>
          <Text style={[styles.metricSub, { color: Colors.danger[500] }]}>{stats.overdueCount} bills</Text>
        </View>
        <View style={[styles.metricCard, { backgroundColor: Colors.warning[50] }]}>
          <Text style={[styles.metricLabel, { color: Colors.warning[600] }]}>Pending</Text>
          <Text style={[styles.metricValue, { color: Colors.warning[700] }]}>{formatCurrency(stats.pendingTotal)}</Text>
          <Text style={[styles.metricSub, { color: Colors.warning[500] }]}>{stats.pendingCount} bills</Text>
        </View>
        <View style={[styles.metricCard, { backgroundColor: Colors.success[50] }]}>
          <Text style={[styles.metricLabel, { color: Colors.success[600] }]}>Paid</Text>
          <Text style={[styles.metricValue, { color: Colors.success[700] }]}>{formatCurrency(stats.paidTotal)}</Text>
          <Text style={[styles.metricSub, { color: Colors.success[500] }]}>{stats.paidCount} bills</Text>
        </View>
      </View>

      {/* Segmented Filter Tab */}
      <View style={styles.tabBar}>
        {(['pending', 'overdue', 'paid', 'all'] as const).map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tabItem, activeTab === tab && styles.activeTabItem]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>
              {tab.toUpperCase()}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Bills Scroll List */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary[500]} />
        </View>
      ) : filteredBills.length === 0 ? (
        <ScrollView
          contentContainerStyle={styles.emptyContainer}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={Colors.primary[500]} />}
        >
          <Calendar size={60} color={Colors.gray[300]} style={{ marginBottom: 16 }} />
          <Text style={styles.emptyTitle}>No bills found</Text>
          <Text style={styles.emptyText}>
            {activeTab === 'pending' ? 'All your bills are paid or snooze-adjusted.' : 
             activeTab === 'overdue' ? 'No overdue bills. Great job staying on track!' :
             activeTab === 'paid' ? 'No paid bills found for this period.' :
             'Tap the plus button at the top to add your first bill.'}
          </Text>
          {activeTab !== 'paid' && (
            <TouchableOpacity 
              style={styles.emptyAddBtn}
              onPress={() => router.push('/upcoming-bills/add')}
            >
              <Text style={styles.emptyAddBtnText}>+ Add Bill Now</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={Colors.primary[500]} />}
        >
          {filteredBills.map((bill) => {
            const dueDate = parseISO(bill.due_date);
            const daysLeft = differenceInDays(dueDate, new Date());

            let statusLabel = `${daysLeft} days left`;
            let statusColor = Colors.success[500];
            let statusBg = Colors.success[50];

            if (bill.status === 'paid') {
              statusLabel = 'Paid';
              statusColor = Colors.success[600];
              statusBg = Colors.success[50];
            } else if (bill.status === 'overdue' || daysLeft < 0) {
              statusLabel = 'Overdue';
              statusColor = Colors.danger[500];
              statusBg = Colors.danger[50];
            } else if (daysLeft === 0) {
              statusLabel = 'Due Today';
              statusColor = Colors.warning[500];
              statusBg = Colors.warning[50];
            } else if (daysLeft === 1) {
              statusLabel = 'Tomorrow';
              statusColor = Colors.warning[400];
              statusBg = Colors.warning[50];
            } else if (bill.status === 'snoozed') {
              statusLabel = 'Snoozed';
              statusColor = Colors.gray[500];
              statusBg = Colors.gray[100];
            }

            const isActionLoading = actionLoadingId === bill.id;

            return (
              <SwipeableRow
                key={bill.id}
                onEdit={() => handleEditBill(bill)}
                onDelete={() => handleDeleteBill(bill)}
              >
                <View style={styles.billRow}>
                  {/* Left Column: Icon */}
                  <View style={styles.billIconContainer}>
                    <Text style={{ fontSize: 20 }}>{bill.icon || '📄'}</Text>
                  </View>

                  {/* Middle Column: Details */}
                  <View style={{ flex: 1, marginRight: 12 }}>
                    <Text style={styles.billNameText}>{bill.name}</Text>
                    <Text style={styles.billMetaText}>
                      {bill.category} {bill.recurrence !== 'once' && `• ${bill.recurrence}`}
                    </Text>
                    <Text style={styles.billDueDateText}>
                      Due: {format(dueDate, 'MMM dd, yyyy')}
                    </Text>
                    {bill.account_name && (
                      <Text style={styles.billAccountText}>Pay from: {bill.account_name}</Text>
                    )}
                  </View>

                  {/* Right Column: Amount & Action */}
                  <View style={{ alignItems: 'flex-end', justifyContent: 'center' }}>
                    <Text style={styles.billAmountText}>{formatCurrency(bill.amount)}</Text>
                    <View style={[styles.statusBadge, { backgroundColor: statusBg, marginTop: 6 }]}>
                      <Text style={[styles.statusBadgeText, { color: statusColor }]}>{statusLabel}</Text>
                    </View>
                    
                    {/* Action buttons (only if not paid) */}
                    {bill.status !== 'paid' && (
                      <View style={styles.rowActions}>
                        <TouchableOpacity
                          style={styles.rowActionBtn}
                          onPress={() => handleSnoozePress(bill)}
                          disabled={isActionLoading}
                        >
                          <Clock size={16} color={Colors.gray[500]} />
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.rowActionBtn, { backgroundColor: Colors.primary[50] }]}
                          onPress={() => handleMarkPaid(bill)}
                          disabled={isActionLoading}
                        >
                          {isActionLoading ? (
                            <ActivityIndicator size="small" color={Colors.primary[600]} style={{ transform: [{ scale: 0.8 }] }} />
                          ) : (
                            <CheckCircle2 size={16} color={Colors.primary[600]} />
                          )}
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                </View>
              </SwipeableRow>
            );
          })}
        </ScrollView>
      )}

      {/* Date Picker for Snooze */}
      {showDatePicker && (
        <DateTimePicker
          value={snoozeDate}
          mode="date"
          onChange={handleSnoozeConfirm}
          minimumDate={new Date()}
        />
      )}

      {confirmSheet && (
        <ConfirmActionSheet
          visible={!!confirmSheet}
          title={confirmSheet.title}
          description={confirmSheet.description}
          confirmLabel={confirmSheet.confirmLabel}
          actionType={confirmSheet.actionType}
          onConfirm={confirmSheet.onConfirm}
          onCancel={() => setConfirmSheet(null)}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.gray[50],
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.gray[100],
    backgroundColor: Colors.white,
  },
  backBtn: {
    padding: 4,
  },
  headerTitle: {
    fontSize: Typography.size.lg,
    fontFamily: Typography.family.bold,
    color: Colors.gray[900],
  },
  addBtn: {
    padding: 4,
  },
  metricsContainer: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  metricCard: {
    flex: 1,
    padding: 12,
    borderRadius: Layout.radius.lg,
    alignItems: 'center',
  },
  metricLabel: {
    fontSize: 10,
    fontFamily: Typography.family.bold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  metricValue: {
    fontSize: Typography.size.md,
    fontFamily: Typography.family.bold,
    marginTop: 4,
  },
  metricSub: {
    fontSize: 9,
    fontFamily: Typography.family.regular,
    marginTop: 2,
  },
  tabBar: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: Colors.gray[100],
    borderRadius: Layout.radius.md,
    padding: 4,
  },
  tabItem: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: Layout.radius.sm,
  },
  activeTabItem: {
    backgroundColor: Colors.white,
    ...Layout.shadows.sm,
  },
  tabText: {
    fontSize: 10,
    fontFamily: Typography.family.bold,
    color: Colors.gray[500],
  },
  activeTabText: {
    color: Colors.primary[600],
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    paddingTop: 60,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: Typography.size.md,
    fontFamily: Typography.family.bold,
    color: Colors.gray[800],
    marginBottom: 8,
  },
  emptyText: {
    fontSize: Typography.size.sm,
    fontFamily: Typography.family.regular,
    color: Colors.gray[500],
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  emptyAddBtn: {
    backgroundColor: Colors.primary[500],
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: Layout.radius.md,
    ...Layout.shadows.sm,
  },
  emptyAddBtnText: {
    color: Colors.white,
    fontFamily: Typography.family.bold,
    fontSize: Typography.size.sm,
  },
  billRow: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.gray[100],
    alignItems: 'center',
  },
  billIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: Colors.gray[50],
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  billNameText: {
    fontSize: Typography.size.md,
    fontFamily: Typography.family.bold,
    color: Colors.gray[900],
  },
  billMetaText: {
    fontSize: Typography.size.xs,
    fontFamily: Typography.family.medium,
    color: Colors.gray[400],
    marginTop: 2,
  },
  billDueDateText: {
    fontSize: Typography.size.xs,
    fontFamily: Typography.family.regular,
    color: Colors.gray[500],
    marginTop: 4,
  },
  billAccountText: {
    fontSize: Typography.size.xs - 1,
    fontFamily: Typography.family.regular,
    color: Colors.primary[600],
    marginTop: 2,
  },
  billAmountText: {
    fontSize: Typography.size.md,
    fontFamily: Typography.family.bold,
    color: Colors.gray[900],
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Layout.radius.full,
  },
  statusBadgeText: {
    fontSize: 9,
    fontFamily: Typography.family.bold,
    textTransform: 'uppercase',
  },
  rowActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  rowActionBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: Colors.gray[50],
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.gray[100],
  },
});
