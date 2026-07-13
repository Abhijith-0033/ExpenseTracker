import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, ActivityIndicator, Switch, Alert, TextInput } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { 
  ArrowLeft, Plus, Calendar, Clock, AlertTriangle, ShieldCheck, 
  CheckCircle2, XCircle, Search, X, Coffee, Car, Home, Film, 
  ShoppingBag, DollarSign, Tag, RefreshCw, ChevronRight
} from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown } from 'react-native-reanimated';
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
  
  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'paused' | 'auto_run'>('all');

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

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'Food': return <Coffee size={18} color={Colors.warning[500]} />;
      case 'Transport': return <Car size={18} color={Colors.primary[500]} />;
      case 'Housing': return <Home size={18} color={Colors.success[500]} />;
      case 'Entertainment': return <Film size={18} color={Colors.danger[500]} />;
      case 'Shopping': return <ShoppingBag size={18} color={Colors.primary[700]} />;
      case 'Income': return <DollarSign size={18} color={Colors.success.text} />;
      default: return <Tag size={18} color={Colors.gray[500]} />;
    }
  };

  const getCategoryIconBg = (category: string) => {
    switch (category) {
      case 'Food': return Colors.warning.bg;
      case 'Transport': return Colors.primary[100];
      case 'Housing': return Colors.success.bg;
      case 'Entertainment': return Colors.danger.bg;
      case 'Shopping': return Colors.primary[100];
      case 'Income': return Colors.success.bg;
      default: return Colors.gray[100];
    }
  };

  // Search/Filters application
  const filteredSchedules = schedules.filter(item => {
    const nameMatch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
    const catMatch = (item.category_name || '').toLowerCase().includes(searchQuery.toLowerCase());
    const descMatch = (item.description || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesSearch = nameMatch || catMatch || descMatch;

    if (!matchesSearch) return false;
    if (statusFilter === 'active') return item.is_active === 1;
    if (statusFilter === 'paused') return item.is_active === 0;
    if (statusFilter === 'auto_run') return item.auto_create === 1;
    return true;
  });

  const filteredLogs = logs.filter(log => {
    const nameMatch = (log.expense_name || '').toLowerCase().includes(searchQuery.toLowerCase());
    const catMatch = (log.category_name || '').toLowerCase().includes(searchQuery.toLowerCase());
    const actionMatch = getLogActionLabel(log.action).toLowerCase().includes(searchQuery.toLowerCase());
    return nameMatch || catMatch || actionMatch;
  });

  const filteredPendingLogs = pendingLogs.filter(log => {
    const nameMatch = (log.expense_name || '').toLowerCase().includes(searchQuery.toLowerCase());
    const catMatch = (log.category_name || '').toLowerCase().includes(searchQuery.toLowerCase());
    return nameMatch || catMatch;
  });

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
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <ArrowLeft size={22} color={Colors.gray[800]} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Scheduled Expenses</Text>
        <TouchableOpacity onPress={() => router.push('/scheduled-expenses/add')} style={styles.addBtn} activeOpacity={0.7}>
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
          <LinearGradient
            colors={['#1A1A2E', '#342624']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.statsCard}
          >
            <View style={styles.statsHeaderRow}>
              <View>
                <Text style={styles.statsLabel}>{"THIS WEEK'S AUTO-RUN SAVINGS"}</Text>
                <Text style={styles.statsValue}>{formatCurrency(stats.autoCreatedAmount)}</Text>
              </View>
              <View style={styles.statsIconContainer}>
                <RefreshCw size={20} color={Colors.primary[200]} />
              </View>
            </View>
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
          </LinearGradient>
        )}

        {/* Search and Filters */}
        <View style={styles.searchFilterContainer}>
          <View style={styles.searchBar}>
            <Search size={18} color={Colors.gray[400]} style={styles.searchIcon} />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder={
                activeTab === 'schedules' ? "Search schedules..." :
                activeTab === 'logs' ? "Search execution history..." : "Search pending approvals..."
              }
              placeholderTextColor={Colors.gray[400]}
              style={styles.searchInput}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearSearchBtn}>
                <X size={16} color={Colors.gray[500]} />
              </TouchableOpacity>
            )}
          </View>
          
          {activeTab === 'schedules' && (
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false} 
              contentContainerStyle={styles.filterScroll}
            >
              <TouchableOpacity
                style={[styles.filterChip, statusFilter === 'all' && styles.activeFilterChip]}
                onPress={() => setStatusFilter('all')}
              >
                <Text style={[styles.filterChipText, statusFilter === 'all' && styles.activeFilterChipText]}>All</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.filterChip, statusFilter === 'active' && styles.activeFilterChip]}
                onPress={() => setStatusFilter('active')}
              >
                <Text style={[styles.filterChipText, statusFilter === 'active' && styles.activeFilterChipText]}>Active</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.filterChip, statusFilter === 'paused' && styles.activeFilterChip]}
                onPress={() => setStatusFilter('paused')}
              >
                <Text style={[styles.filterChipText, statusFilter === 'paused' && styles.activeFilterChipText]}>Paused</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.filterChip, statusFilter === 'auto_run' && styles.activeFilterChip]}
                onPress={() => setStatusFilter('auto_run')}
              >
                <Text style={[styles.filterChipText, statusFilter === 'auto_run' && styles.activeFilterChipText]}>Auto-Run</Text>
              </TouchableOpacity>
            </ScrollView>
          )}
        </View>

        {/* Tab Selector */}
        <View style={styles.tabContainer}>
          <TouchableOpacity 
            style={[styles.tab, activeTab === 'schedules' && styles.activeTab]} 
            onPress={() => setActiveTab('schedules')}
            activeOpacity={0.8}
          >
            <View style={styles.tabContent}>
              <Calendar size={14} color={activeTab === 'schedules' ? Colors.gray[900] : Colors.gray[500]} />
              <Text style={[styles.tabText, activeTab === 'schedules' && styles.activeTabText]}>Schedules</Text>
            </View>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.tab, activeTab === 'pending' && styles.activeTab]} 
            onPress={() => setActiveTab('pending')}
            activeOpacity={0.8}
          >
            <View style={styles.tabContent}>
              <Clock size={14} color={activeTab === 'pending' ? Colors.gray[900] : Colors.gray[500]} />
              <Text style={[styles.tabText, activeTab === 'pending' && styles.activeTabText]}>Pending</Text>
              {pendingLogs.length > 0 && (
                <View style={styles.tabBadge}>
                  <Text style={styles.tabBadgeText}>{pendingLogs.length}</Text>
                </View>
              )}
            </View>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.tab, activeTab === 'logs' && styles.activeTab]} 
            onPress={() => setActiveTab('logs')}
            activeOpacity={0.8}
          >
            <View style={styles.tabContent}>
              <RefreshCw size={14} color={activeTab === 'logs' ? Colors.gray[900] : Colors.gray[500]} />
              <Text style={[styles.tabText, activeTab === 'logs' && styles.activeTabText]}>History</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Schedules Tab */}
        {activeTab === 'schedules' ? (
          <View style={styles.listContainer}>
            {filteredSchedules.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Calendar size={56} color={Colors.gray[300]} style={{ marginBottom: 16 }} />
                <Text style={styles.emptyTitle}>{searchQuery ? 'No schedules match search' : 'No scheduled expenses'}</Text>
                <Text style={styles.emptySub}>
                  {searchQuery ? 'Check your filters or spelling and try again.' : 'Set up daily, weekly, or monthly automatic expense logging or approvals.'}
                </Text>
                {!searchQuery && (
                  <TouchableOpacity style={styles.emptyBtn} onPress={() => router.push('/scheduled-expenses/add')}>
                    <Text style={styles.emptyBtnText}>Create Schedule</Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : (
              filteredSchedules.map((item, index) => (
                <Animated.View 
                  key={item.id}
                  entering={FadeInDown.delay(index * 50).duration(300)}
                >
                  <TouchableOpacity 
                    style={[styles.scheduleCard, item.is_active === 0 && styles.pausedCard]}
                    activeOpacity={0.8}
                    onPress={() => router.push(`/scheduled-expenses/${item.id}`)}
                  >
                    <View style={styles.cardHeader}>
                      <View style={[styles.iconContainer, { backgroundColor: getCategoryIconBg(item.category_name) }]}>
                        {getCategoryIcon(item.category_name)}
                      </View>
                      <View style={styles.cardMainInfo}>
                        <Text style={styles.cardName}>{item.name}</Text>
                        <View style={styles.cardSubRow}>
                          <View style={styles.categoryBadge}>
                            <Text style={styles.categoryBadgeText}>{item.category_name || 'Other'}</Text>
                          </View>
                          <Text style={styles.bullet}>•</Text>
                          <Text style={styles.accountText}>{item.account_name}</Text>
                        </View>
                      </View>
                      <View style={styles.switchWrapper}>
                        <Switch
                          value={item.is_active === 1}
                          onValueChange={() => toggleScheduleActive(item)}
                          trackColor={{ false: Colors.gray[200], true: Colors.primary[200] }}
                          thumbColor={item.is_active === 1 ? Colors.primary[500] : Colors.gray[400]}
                          ios_backgroundColor={Colors.gray[200]}
                        />
                      </View>
                    </View>
                    <View style={styles.cardDivider} />
                    <View style={styles.cardBottom}>
                      <View style={styles.scheduleInfo}>
                        <Clock size={13} color={Colors.gray[400]} style={{ marginRight: 6 }} />
                        <Text style={styles.scheduleDays} numberOfLines={1}>
                          {getDaysFormatted(item.days_of_week)} at {item.scheduled_time}
                        </Text>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={styles.cardAmount}>{formatCurrency(item.amount)}</Text>
                        {item.auto_create === 1 ? (
                          <View style={styles.autoCreateBadge}>
                            <ShieldCheck size={10} color={Colors.success[600]} style={{ marginRight: 4 }} />
                            <Text style={styles.autoCreateBadgeText}>Auto-Run</Text>
                          </View>
                        ) : (
                          <View style={styles.approvalBadge}>
                            <AlertTriangle size={10} color={Colors.warning[600]} style={{ marginRight: 4 }} />
                            <Text style={styles.approvalBadgeText}>Requires Approval</Text>
                          </View>
                        )}
                      </View>
                    </View>
                  </TouchableOpacity>
                </Animated.View>
              ))
            )}
          </View>
        ) : activeTab === 'logs' ? (
          /* Logs Tab */
          <View style={styles.listContainer}>
            {filteredLogs.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Clock size={56} color={Colors.gray[300]} style={{ marginBottom: 16 }} />
                <Text style={styles.emptyTitle}>{searchQuery ? 'No history matches search' : 'No runs logged yet'}</Text>
                <Text style={styles.emptySub}>
                  {searchQuery ? 'Check your spelling or filter query and try again.' : 'History of executions, automated runs, and approvals will show here.'}
                </Text>
              </View>
            ) : (
              filteredLogs.map((log, index) => (
                <Animated.View 
                  key={log.id}
                  entering={FadeInDown.delay(index * 30).duration(300)}
                >
                  <View style={styles.logCard}>
                    <View style={styles.logLeft}>
                      <View style={[styles.logIconContainer, { backgroundColor: log.action === 'rejected' ? Colors.danger[50] : (log.action === 'missed' ? Colors.warning[50] : Colors.success[50]) }]}>
                        {getLogActionIcon(log.action)}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.logTitle}>{log.expense_name || 'Deleted Schedule'}</Text>
                        <View style={styles.logMetaRow}>
                          <Text style={styles.logMeta}>{log.scheduled_date}</Text>
                          <Text style={styles.bullet}>•</Text>
                          <View style={[
                            styles.statusBadge, 
                            log.action === 'approved' || log.action === 'auto_created' ? styles.statusSuccess :
                            log.action === 'rejected' ? styles.statusDanger : styles.statusWarning
                          ]}>
                            <Text style={[
                              styles.statusBadgeText,
                              log.action === 'approved' || log.action === 'auto_created' ? styles.statusSuccessText :
                              log.action === 'rejected' ? styles.statusDangerText : styles.statusWarningText
                            ]}>
                              {getLogActionLabel(log.action)}
                            </Text>
                          </View>
                        </View>
                      </View>
                    </View>
                    <Text style={[styles.logAmount, log.action === 'rejected' && { textDecorationLine: 'line-through', color: Colors.gray[400] }]}>
                      {formatCurrency(log.amount)}
                    </Text>
                  </View>
                </Animated.View>
              ))
            )}
          </View>
        ) : (
          /* Pending Tab */
          <View style={styles.listContainer}>
            {filteredPendingLogs.length === 0 ? (
              <View style={styles.emptyContainer}>
                <CheckCircle2 size={56} color={Colors.gray[300]} style={{ marginBottom: 16 }} />
                <Text style={styles.emptyTitle}>{searchQuery ? 'No pending items match search' : 'No pending approvals'}</Text>
                <Text style={styles.emptySub}>
                  {searchQuery ? 'Check spelling and try again.' : 'Scheduled expenses requiring your approval will appear here.'}
                </Text>
              </View>
            ) : (
              filteredPendingLogs.map((log, index) => (
                <Animated.View 
                  key={log.id} 
                  entering={FadeInDown.delay(index * 50).duration(300)}
                  style={styles.pendingCard}
                >
                  <View style={styles.pendingCardHeader}>
                    <View style={[styles.iconContainer, { backgroundColor: getCategoryIconBg(log.category_name) }]}>
                      {getCategoryIcon(log.category_name)}
                    </View>
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={styles.pendingCardName}>{log.expense_name || 'Deleted Schedule'}</Text>
                      <Text style={styles.pendingCardMeta}>{log.category_name || 'Other'} · {log.account_name}</Text>
                    </View>
                    <Text style={styles.pendingAmount}>{formatCurrency(log.amount)}</Text>
                  </View>
                  <View style={styles.pendingCardBody}>
                    <View style={styles.dueTag}>
                      <Clock size={12} color={Colors.warning[600]} style={{ marginRight: 4 }} />
                      <Text style={styles.dueTagText}>Due: {log.scheduled_date}</Text>
                    </View>
                  </View>
                  <View style={styles.approvalBtns}>
                    <TouchableOpacity style={styles.approveBtn} onPress={() => handleApprove(log.id)} activeOpacity={0.8}>
                      <CheckCircle2 size={15} color={Colors.white} />
                      <Text style={styles.approveBtnText}>Approve</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.rejectBtn} onPress={() => handleReject(log.id)} activeOpacity={0.8}>
                      <XCircle size={15} color={Colors.white} />
                      <Text style={styles.rejectBtnText}>Reject</Text>
                    </TouchableOpacity>
                  </View>
                </Animated.View>
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
    borderBottomWidth: 1,
    borderBottomColor: Colors.gray[100],
    ...Layout.shadows.sm
  },
  backBtn: { 
    padding: 10, 
    backgroundColor: Colors.white, 
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.gray[200],
    ...Layout.shadows.sm
  },
  addBtn: { 
    padding: 10, 
    backgroundColor: Colors.primary[500], 
    borderRadius: 12,
    ...Layout.shadows.sm
  },
  headerTitle: { fontSize: 18, fontFamily: Typography.family.bold, color: Colors.gray[900] },
  scrollContent: { padding: 20, paddingBottom: 100 },
  statsCard: { 
    padding: 24, 
    borderRadius: 24,
    marginBottom: 20,
    ...Layout.shadows.md
  },
  statsHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  statsIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  statsLabel: { 
    fontSize: 10, 
    fontFamily: Typography.family.bold, 
    color: Colors.gray[400], 
    letterSpacing: 1,
    marginBottom: 4
  },
  statsValue: { 
    fontSize: 30, 
    fontFamily: Typography.family.bold, 
    color: Colors.white 
  },
  statsDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginVertical: 16,
  },
  statsGrid: { flexDirection: 'row', justifyContent: 'space-between' },
  statItem: { alignItems: 'center', flex: 1 },
  statCount: { fontSize: 18, fontFamily: Typography.family.bold, color: Colors.white, marginBottom: 2 },
  statLabelSub: { fontSize: 11, color: Colors.gray[400], fontFamily: Typography.family.medium },
  
  // Search & Filter styles
  searchFilterContainer: {
    marginBottom: 20,
    gap: 12,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.gray[200],
    borderRadius: 14,
    paddingHorizontal: 12,
    height: 48,
    ...Layout.shadows.sm
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    fontFamily: Typography.family.medium,
    color: Colors.gray[800],
  },
  clearSearchBtn: {
    padding: 4,
  },
  filterScroll: {
    gap: 8,
    paddingRight: 20,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.gray[200],
    ...Layout.shadows.sm
  },
  activeFilterChip: {
    backgroundColor: Colors.primary[500],
    borderColor: Colors.primary[500],
  },
  filterChipText: {
    fontSize: 12,
    fontFamily: Typography.family.medium,
    color: Colors.gray[600],
  },
  activeFilterChipText: {
    color: Colors.white,
    fontFamily: Typography.family.bold,
  },

  // Tab switcher
  tabContainer: { 
    flexDirection: 'row', 
    backgroundColor: Colors.gray[100], 
    borderRadius: 14, 
    padding: 4,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: Colors.gray[200]
  },
  tab: { 
    flex: 1, 
    paddingVertical: 10, 
    alignItems: 'center', 
    borderRadius: 10 
  },
  activeTab: { backgroundColor: Colors.white, ...Layout.shadows.sm },
  tabContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  tabText: { fontSize: 13, fontFamily: Typography.family.medium, color: Colors.gray[500] },
  activeTabText: { color: Colors.gray[900], fontFamily: Typography.family.bold },
  tabBadge: {
    backgroundColor: Colors.primary[500],
    borderRadius: 10,
    minWidth: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  tabBadgeText: {
    fontSize: 9,
    fontFamily: Typography.family.bold,
    color: Colors.white,
  },

  // Lists and Cards
  listContainer: { gap: 16 },
  scheduleCard: {
    backgroundColor: Colors.white,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.gray[100],
    ...Layout.shadows.sm,
  },
  pausedCard: {
    opacity: 0.55,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardMainInfo: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
  },
  cardName: {
    fontSize: 15,
    fontFamily: Typography.family.bold,
    color: Colors.gray[900]
  },
  cardSubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  categoryBadge: {
    backgroundColor: Colors.gray[100],
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  categoryBadgeText: {
    fontSize: 10,
    fontFamily: Typography.family.bold,
    color: Colors.gray[600],
  },
  bullet: {
    fontSize: 12,
    color: Colors.gray[300],
    marginHorizontal: 6,
  },
  accountText: {
    fontSize: 12,
    fontFamily: Typography.family.medium,
    color: Colors.gray[500],
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
    backgroundColor: Colors.success[50],
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 3,
    marginTop: 6
  },
  autoCreateBadgeText: {
    fontSize: 9,
    fontFamily: Typography.family.bold,
    color: Colors.success[700]
  },
  approvalBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.warning[50],
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 3,
    marginTop: 6
  },
  approvalBadgeText: {
    fontSize: 9,
    fontFamily: Typography.family.bold,
    color: Colors.warning[700]
  },

  // Empty container
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

  // Logs
  logCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.gray[100],
    ...Layout.shadows.sm
  },
  logLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 12
  },
  logIconContainer: {
    width: 40,
    height: 40,
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
  logMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  logMeta: {
    fontSize: 11,
    fontFamily: Typography.family.medium,
    color: Colors.gray[400]
  },
  statusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  statusBadgeText: {
    fontSize: 9,
    fontFamily: Typography.family.bold,
  },
  statusSuccess: { backgroundColor: Colors.success[50] },
  statusSuccessText: { color: Colors.success[700] },
  statusDanger: { backgroundColor: Colors.danger[50] },
  statusDangerText: { color: Colors.danger[700] },
  statusWarning: { backgroundColor: Colors.warning[50] },
  statusWarningText: { color: Colors.warning[700] },
  logAmount: {
    fontSize: 14,
    fontFamily: Typography.family.bold,
    color: Colors.gray[800]
  },

  // Pending
  pendingCard: {
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.warning[200],
    backgroundColor: '#FFFDF9', // Warm amber tint
    ...Layout.shadows.sm,
    gap: 12,
  },
  pendingCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pendingCardName: {
    fontSize: 15,
    fontFamily: Typography.family.bold,
    color: Colors.gray[900],
  },
  pendingCardMeta: {
    fontSize: 12,
    fontFamily: Typography.family.medium,
    color: Colors.gray[500],
    marginTop: 2,
  },
  pendingAmount: {
    fontSize: 16,
    fontFamily: Typography.family.bold,
    color: Colors.gray[900],
  },
  pendingCardBody: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dueTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.warning[50],
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: Colors.warning[100],
  },
  dueTagText: {
    fontSize: 11,
    fontFamily: Typography.family.bold,
    color: Colors.warning[700],
  },
  approvalBtns: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  approveBtn: {
    flex: 1.2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: Colors.success[600],
    borderRadius: 12,
    paddingVertical: 10,
    ...Layout.shadows.sm
  },
  approveBtnText: {
    fontSize: 13,
    fontFamily: Typography.family.bold,
    color: Colors.white,
  },
  rejectBtn: {
    flex: 0.8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: Colors.danger[600],
    borderRadius: 12,
    paddingVertical: 10,
    ...Layout.shadows.sm
  },
  rejectBtnText: {
    fontSize: 13,
    fontFamily: Typography.family.bold,
    color: Colors.white,
  }
});
