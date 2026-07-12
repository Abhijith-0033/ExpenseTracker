import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, ActivityIndicator, Switch, Alert } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { ArrowLeft, Plus, Calendar, Clock, AlertTriangle, ShieldCheck, CheckCircle2, XCircle } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, Typography, Layout } from '../../constants/Theme';
import { formatCurrency } from '../../utils/currency';
import { getDatabase , getAllScheduledExpenses, getScheduledExpenseStats, updateScheduledExpense, ScheduledExpenseJoined } from '../../services/database';
import { useSubscription } from '../../src/subscription/useSubscription';
import PaywallScreen from '../../src/subscription/PaywallScreen';
import { scheduleNotificationsForExpense, cancelNotificationsForExpense } from '../../src/scheduled/ScheduledExpenseEngine';
import { ConfirmActionSheet } from '../../components/ConfirmActionSheet';

const DAYS_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function ScheduledExpensesIndex() {
  const router = useRouter();
  const { isPremium, isTrialActive } = useSubscription();
  
  const [schedules, setSchedules] = useState<ScheduledExpenseJoined[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'schedules' | 'logs' | 'pending'>('schedules');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pendingLogs, setPendingLogs] = useState<any[]>([]);
  const [confirmSheet, setConfirmSheet] = useState<{
    title: string;
    description: string;
    confirmLabel: string;
    actionType: 'delete' | 'edit' | 'approve' | 'pay' | 'warning';
    onConfirm: () => void;
  } | null>(null);

  const loadData = useCallback(async () => {
    try {
      const db = getDatabase();
      const allSchedules = await getAllScheduledExpenses();
      setSchedules(allSchedules);

      const allLogs = await db.getAllAsync(`
        SELECT sel.*, se.name as expense_name, c.name as category_name
        FROM scheduled_expense_log sel
        LEFT JOIN scheduled_expenses se ON sel.scheduled_expense_id = se.id
        LEFT JOIN categories c ON se.category_id = c.id
        ORDER BY sel.created_at DESC
        LIMIT 50
      `);
      setLogs(allLogs);

      const pLogs = await db.getAllAsync(`
        SELECT sel.*, se.name as expense_name, c.name as category_name,
               se.amount as schedule_amount, a.name as account_name
        FROM scheduled_expense_log sel
        LEFT JOIN scheduled_expenses se ON sel.scheduled_expense_id = se.id
        LEFT JOIN categories c ON se.category_id = c.id
        LEFT JOIN accounts a ON se.account_id = a.id
        WHERE sel.action = 'pending'
        ORDER BY sel.scheduled_date DESC
      `);
      setPendingLogs(pLogs);

      const st = await getScheduledExpenseStats();
      setStats(st);
    } catch (e) {
      console.error('Failed to load scheduled expenses data:', e);
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

  if (!isPremium && !isTrialActive) {
    return <PaywallScreen showClose={true} />;
  }

  const toggleScheduleActive = async (item: ScheduledExpenseJoined) => {
    const newStatus = item.is_active === 1 ? 0 : 1;
    // 1. Optimistic update — flip the UI immediately
    setSchedules(prev => prev.map(s => s.id === item.id ? { ...s, is_active: newStatus } : s));
    try {
      await updateScheduledExpense(item.id, { is_active: newStatus });
      const updatedItem = { ...item, is_active: newStatus };
      if (newStatus === 1) {
        await scheduleNotificationsForExpense(updatedItem);
      } else {
        await cancelNotificationsForExpense(item.id);
      }
      // Silently refresh stats only
      const st = await getScheduledExpenseStats();
      setStats(st);
    } catch (_e) {
      // 2. Rollback on failure
      setSchedules(prev => prev.map(s => s.id === item.id ? { ...s, is_active: item.is_active } : s));
      Alert.alert('Error', 'Failed to update schedule state.');
    }
  };

  const handleApprove = (logId: number) => {
    setConfirmSheet({
      title: 'Approve Expense?',
      description: 'The transaction will be recorded in your account immediately.',
      confirmLabel: 'Approve',
      actionType: 'approve',
      onConfirm: async () => {
        setConfirmSheet(null);
        const { approveScheduled } = await import('../../src/scheduled/ScheduledExpenseEngine');
        await approveScheduled(logId);
        loadData();
      }
    });
  };

  const handleReject = (logId: number) => {
    setConfirmSheet({
      title: 'Reject Expense?',
      description: 'This scheduled expense will be marked as rejected for today.',
      confirmLabel: 'Reject',
      actionType: 'warning',
      onConfirm: async () => {
        setConfirmSheet(null);
        const { rejectScheduled } = await import('../../src/scheduled/ScheduledExpenseEngine');
        await rejectScheduled(logId);
        loadData();
      }
    });
  };

  const getDaysFormatted = (daysJson: string) => {
    try {
      const days = JSON.parse(daysJson) as number[];
      return days.map(d => DAYS_NAMES[d - 1]).join(', ');
    } catch {
      return '';
    }
  };

  const getLogActionIcon = (action: string) => {
    switch (action) {
      case 'auto_created':
        return <ShieldCheck size={18} color={Colors.success[600]} />;
      case 'approved':
        return <CheckCircle2 size={18} color={Colors.success[600]} />;
      case 'rejected':
        return <XCircle size={18} color={Colors.danger[600]} />;
      case 'missed':
        return <AlertTriangle size={18} color={Colors.warning[600]} />;
      default:
        return <Clock size={18} color={Colors.gray[400]} />;
    }
  };

  const getLogActionLabel = (action: string) => {
    switch (action) {
      case 'auto_created': return 'Auto-Created';
      case 'approved': return 'Approved';
      case 'rejected': return 'Rejected';
      case 'missed': return 'Missed';
      case 'pending': return 'Pending Approval';
      default: return action;
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary[500]} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft size={22} color={Colors.gray[800]} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Scheduled Expenses</Text>
        <TouchableOpacity onPress={() => router.push('/scheduled-expenses/add')} style={styles.addBtn}>
          <Plus size={22} color={Colors.white} />
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} />}
      >
        {/* Stats Summary Card */}
        {stats && (
          <View style={styles.statsCard}>
            <Text style={styles.statsLabel}>{"THIS WEEK'S AUTO-RUN SAVINGS"}</Text>
            <Text style={styles.statsValue}>{formatCurrency(stats.autoCreatedAmount)}</Text>
            <View style={styles.statsDivider} />
            <View style={styles.statsGrid}>
              <View style={styles.statItem}>
                <Text style={styles.statCount}>{stats.autoCreatedCount}</Text>
                <Text style={styles.statLabelSub}>Processed</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statCount}>{stats.pendingCount}</Text>
                <Text style={styles.statLabelSub}>Pending</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statCount}>{stats.rejectedCount}</Text>
                <Text style={styles.statLabelSub}>Rejected</Text>
              </View>
            </View>
          </View>
        )}

        {/* Tab Selector */}
        <View style={styles.tabContainer}>
          <TouchableOpacity 
            style={[styles.tab, activeTab === 'schedules' && styles.activeTab]} 
            onPress={() => setActiveTab('schedules')}
          >
            <Text style={[styles.tabText, activeTab === 'schedules' && styles.activeTabText]}>Active Schedules</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.tab, activeTab === 'logs' && styles.activeTab]} 
            onPress={() => setActiveTab('logs')}
          >
            <Text style={[styles.tabText, activeTab === 'logs' && styles.activeTabText]}>Execution Log</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.tab, activeTab === 'pending' && styles.activeTab]} 
            onPress={() => setActiveTab('pending')}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Text style={[styles.tabText, activeTab === 'pending' && styles.activeTabText]}>Pending</Text>
              {pendingLogs.length > 0 && (
                <View style={styles.tabBadge}>
                  <Text style={styles.tabBadgeText}>{pendingLogs.length}</Text>
                </View>
              )}
            </View>
          </TouchableOpacity>
        </View>

        {/* Schedules Tab */}
        {activeTab === 'schedules' ? (
          <View style={styles.listContainer}>
            {schedules.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Calendar size={48} color={Colors.gray[300]} style={{ marginBottom: 12 }} />
                <Text style={styles.emptyTitle}>No scheduled expenses</Text>
                <Text style={styles.emptySub}>Set up daily, weekly, or monthly automatic expense logging or approvals.</Text>
                <TouchableOpacity style={styles.emptyBtn} onPress={() => router.push('/scheduled-expenses/add')}>
                  <Text style={styles.emptyBtnText}>Create Schedule</Text>
                </TouchableOpacity>
              </View>
            ) : (
              schedules.map((item) => (
                <TouchableOpacity 
                  key={item.id} 
                  style={[styles.scheduleCard, item.is_active === 0 && styles.pausedCard]}
                  activeOpacity={0.8}
                  onPress={() => router.push(`/scheduled-expenses/${item.id}`)}
                >
                  <View style={styles.cardTop}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.cardName}>{item.name}</Text>
                      <Text style={styles.cardMeta}>{item.category_name} · {item.account_name}</Text>
                    </View>
                    <View style={styles.switchWrapper}>
                      <Switch
                        value={item.is_active === 1}
                        onValueChange={() => toggleScheduleActive(item)}
                        trackColor={{ false: Colors.gray[200], true: Colors.primary[500] }}
                        thumbColor={Colors.white}
                      />
                    </View>
                  </View>
                  <View style={styles.cardDivider} />
                  <View style={styles.cardBottom}>
                    <View style={styles.scheduleInfo}>
                      <Clock size={14} color={Colors.gray[400]} style={{ marginRight: 6 }} />
                      <Text style={styles.scheduleDays} numberOfLines={1}>
                        {getDaysFormatted(item.days_of_week)} at {item.scheduled_time}
                      </Text>
                    </View>
                    <Text style={styles.cardAmount}>{formatCurrency(item.amount)}</Text>
                  </View>
                  {item.auto_create === 1 && (
                    <View style={styles.autoCreateBadge}>
                      <ShieldCheck size={10} color={Colors.success[600]} style={{ marginRight: 4 }} />
                      <Text style={styles.autoCreateBadgeText}>Auto-Create enabled</Text>
                    </View>
                  )}
                </TouchableOpacity>
              ))
            )}
          </View>
        ) : activeTab === 'logs' ? (
          /* Logs Tab */
          <View style={styles.listContainer}>
            {logs.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Clock size={48} color={Colors.gray[300]} style={{ marginBottom: 12 }} />
                <Text style={styles.emptyTitle}>No runs logged yet</Text>
                <Text style={styles.emptySub}>History of executions, automated runs, and approvals will show here.</Text>
              </View>
            ) : (
              logs.map((log) => (
                <View key={log.id} style={styles.logCard}>
                  <View style={styles.logLeft}>
                    <View style={[styles.logIconContainer, { backgroundColor: log.action === 'rejected' ? Colors.danger[50] : (log.action === 'missed' ? Colors.warning[50] : Colors.success[50]) }]}>
                      {getLogActionIcon(log.action)}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.logTitle}>{log.expense_name || 'Deleted Schedule'}</Text>
                      <Text style={styles.logMeta}>{log.scheduled_date} · {getLogActionLabel(log.action)}</Text>
                    </View>
                  </View>
                  <Text style={[styles.logAmount, log.action === 'rejected' && { textDecorationLine: 'line-through', color: Colors.gray[400] }]}>
                    {formatCurrency(log.amount)}
                  </Text>
                </View>
              ))
            )}
          </View>
        ) : (
          /* Pending Tab */
          <View style={styles.listContainer}>
            {pendingLogs.length === 0 ? (
              <View style={styles.emptyContainer}>
                <CheckCircle2 size={48} color={Colors.gray[300]} style={{ marginBottom: 12 }} />
                <Text style={styles.emptyTitle}>No pending approvals</Text>
                <Text style={styles.emptySub}>Scheduled expenses requiring your approval will appear here.</Text>
              </View>
            ) : (
              pendingLogs.map((log) => (
                <View key={log.id} style={styles.pendingCard}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardName}>{log.expense_name || 'Deleted Schedule'}</Text>
                    <Text style={styles.cardMeta}>{log.category_name} · {log.account_name}</Text>
                    <Text style={styles.cardMeta}>Due: {log.scheduled_date}</Text>
                  </View>
                  <Text style={styles.cardAmount}>{formatCurrency(log.amount)}</Text>
                  <View style={styles.approvalBtns}>
                    <TouchableOpacity style={styles.approveBtn} onPress={() => handleApprove(log.id)}>
                      <CheckCircle2 size={16} color={Colors.white} />
                      <Text style={styles.approveBtnText}>Approve</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.rejectBtn} onPress={() => handleReject(log.id)}>
                      <XCircle size={16} color={Colors.white} />
                      <Text style={styles.rejectBtnText}>Reject</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
          </View>
        )}
      </ScrollView>

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
  container: { flex: 1, backgroundColor: Colors.gray[50] },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.gray[50] },
  header: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingHorizontal: 20, 
    paddingVertical: 12, 
    justifyContent: 'space-between',
    backgroundColor: Colors.white,
    ...Layout.shadows.sm
  },
  backBtn: { 
    padding: 10, 
    backgroundColor: Colors.white, 
    borderRadius: 12,
    ...Layout.shadows.sm
  },
  addBtn: { 
    padding: 10, 
    backgroundColor: Colors.primary[500], 
    borderRadius: 12,
    ...Layout.shadows.sm
  },
  headerTitle: { fontSize: 20, fontFamily: Typography.family.bold, color: Colors.gray[900] },
  scrollContent: { padding: 20, paddingBottom: 100 },
  statsCard: { 
    backgroundColor: Colors.gray[900], 
    padding: 24, 
    borderRadius: 24,
    marginBottom: 24,
    ...Layout.shadows.md
  },
  statsLabel: { 
    fontSize: 10, 
    fontFamily: Typography.family.bold, 
    color: Colors.gray[400], 
    letterSpacing: 1,
    marginBottom: 4
  },
  statsValue: { 
    fontSize: 32, 
    fontFamily: Typography.family.bold, 
    color: Colors.white 
  },
  statsDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginVertical: 16,
  },
  statsGrid: { flexDirection: 'row', justifyContent: 'space-between' },
  statItem: { alignItems: 'center', flex: 1 },
  statCount: { fontSize: 18, fontFamily: Typography.family.bold, color: Colors.white, marginBottom: 2 },
  statLabelSub: { fontSize: 11, color: Colors.gray[400], fontFamily: Typography.family.medium },
  tabContainer: { 
    flexDirection: 'row', 
    backgroundColor: Colors.gray[200], 
    borderRadius: 14, 
    padding: 4,
    marginBottom: 24
  },
  tab: { 
    flex: 1, 
    paddingVertical: 10, 
    alignItems: 'center', 
    borderRadius: 10 
  },
  activeTab: { backgroundColor: Colors.white, ...Layout.shadows.sm },
  tabText: { fontSize: 14, fontFamily: Typography.family.medium, color: Colors.gray[500] },
  activeTabText: { color: Colors.gray[900], fontFamily: Typography.family.bold },
  listContainer: { gap: 16 },
  scheduleCard: {
    backgroundColor: Colors.white,
    borderRadius: 20,
    padding: 16,
    ...Layout.shadows.sm,
    borderWidth: 1,
    borderColor: Colors.gray[100]
  },
  pausedCard: {
    opacity: 0.6
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12
  },
  cardName: {
    fontSize: 16,
    fontFamily: Typography.family.bold,
    color: Colors.gray[900]
  },
  cardMeta: {
    fontSize: 12,
    fontFamily: Typography.family.medium,
    color: Colors.gray[400],
    marginTop: 2
  },
  switchWrapper: {
    justifyContent: 'center',
    alignItems: 'center'
  },
  cardDivider: {
    height: 1,
    backgroundColor: Colors.gray[100],
    marginVertical: 12
  },
  cardBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  scheduleInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1
  },
  scheduleDays: {
    fontSize: 12,
    fontFamily: Typography.family.medium,
    color: Colors.gray[500],
    marginRight: 12
  },
  cardAmount: {
    fontSize: 16,
    fontFamily: Typography.family.bold,
    color: Colors.gray[900]
  },
  autoCreateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: Colors.success[50],
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 3,
    marginTop: 10
  },
  autoCreateBadgeText: {
    fontSize: 9,
    fontFamily: Typography.family.bold,
    color: Colors.success[700]
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 20
  },
  emptyTitle: {
    fontSize: 16,
    fontFamily: Typography.family.bold,
    color: Colors.gray[700],
    marginBottom: 6
  },
  emptySub: {
    fontSize: 13,
    color: Colors.gray[400],
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 20
  },
  emptyBtn: {
    backgroundColor: Colors.primary[500],
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 14,
    ...Layout.shadows.md
  },
  emptyBtnText: {
    color: Colors.white,
    fontFamily: Typography.family.bold,
    fontSize: 14
  },
  logCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 14,
    ...Layout.shadows.sm
  },
  logLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 12
  },
  logIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12
  },
  logTitle: {
    fontSize: 14,
    fontFamily: Typography.family.bold,
    color: Colors.gray[900]
  },
  logMeta: {
    fontSize: 11,
    fontFamily: Typography.family.medium,
    color: Colors.gray[400],
    marginTop: 2
  },
  logAmount: {
    fontSize: 14,
    fontFamily: Typography.family.bold,
    color: Colors.gray[800]
  },
  tabBadge: {
    backgroundColor: Colors.danger[500],
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  tabBadgeText: {
    fontSize: 10,
    fontFamily: Typography.family.bold,
    color: Colors.white,
  },
  pendingCard: {
    backgroundColor: Colors.white,
    borderRadius: 20,
    padding: 16,
    borderLeftWidth: 4,
    borderLeftColor: Colors.warning[400],
    ...Layout.shadows.sm,
    gap: 8,
  },
  approvalBtns: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  approveBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: Colors.success[600],
    borderRadius: 12,
    paddingVertical: 10,
  },
  approveBtnText: {
    fontSize: 13,
    fontFamily: Typography.family.bold,
    color: Colors.white,
  },
  rejectBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: Colors.danger[600],
    borderRadius: 12,
    paddingVertical: 10,
  },
  rejectBtnText: {
    fontSize: 13,
    fontFamily: Typography.family.bold,
    color: Colors.white,
  }
});
