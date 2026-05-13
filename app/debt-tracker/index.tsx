import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, Alert, ActivityIndicator } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { ArrowLeft, Plus, TrendingDown, CreditCard, AlertCircle } from 'lucide-react-native';
import { Colors, Layout, Typography, SemanticColors } from '../../constants/Theme';
import { getDebtRecords, getDebtRepayments, deleteDebtRecord } from '../../services/debttracker/debtService';
import { calculateCurrentBalance, DebtRecord } from '../../services/debttracker/DebtEngine';
import { formatCurrency } from '../../utils/currency';
import { Snackbar } from '../../components/Snackbar';
import { Swipeable } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';

type FilterType = 'all' | 'borrowed' | 'lent' | 'completed';

export default function DebtTrackerScreen() {
  const router = useRouter();
  const [debts, setDebts] = useState<DebtRecord[]>([]);
  const [filteredDebts, setFilteredDebts] = useState<DebtRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [summary, setSummary] = useState({
    totalOwed: 0,
    totalOwedToMe: 0,
    overdueCount: 0
  });

  // Snackbar state
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');

  const fetchData = async () => {
    try {
      const allDebts = await getDebtRecords();
      setDebts(allDebts);
      setFilteredDebts(allDebts);
      
      // Calculate summary
      let totalOwed = 0;
      let totalOwedToMe = 0;
      let overdueCount = 0;
      
      for (const debt of allDebts.filter(d => d.status === 'active')) {
        const repayments = await getDebtRepayments(debt.id);
        const calculation = calculateCurrentBalance(debt, repayments);
        
        if (debt.direction === 'borrowed') {
          totalOwed += calculation.currentBalance;
        } else {
          totalOwedToMe += calculation.currentBalance;
        }
        
        if (calculation.isOverdue) {
          overdueCount++;
        }
      }
      
      setSummary({ totalOwed, totalOwedToMe, overdueCount });
    } catch (error) {
      console.error('Failed to fetch debts:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    React.useCallback(() => {
      fetchData();
    }, [])
  );

  useEffect(() => {
    let filtered = debts;
    
    switch (activeFilter) {
      case 'borrowed':
        filtered = debts.filter(d => d.direction === 'borrowed');
        break;
      case 'lent':
        filtered = debts.filter(d => d.direction === 'lent');
        break;
      case 'completed':
        filtered = debts.filter(d => d.status === 'completed');
        break;
    }
    
    setFilteredDebts(filtered);
  }, [activeFilter, debts]);

  const handleDelete = (debt: DebtRecord) => {
    Alert.alert(
      'Delete Debt',
      `This will permanently delete '${debt.name}' and all its repayment history. This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteDebtRecord(debt.id);
              fetchData();
              setSnackbarMessage('Debt deleted');
              setSnackbarVisible(true);
            } catch (error) {
              Alert.alert('Error', 'Failed to delete debt');
            }
          }
        }
      ]
    );
  };

  const DebtCard = ({ debt }: { debt: DebtRecord }) => {
    const swipeRef = React.useRef<Swipeable>(null);
    const [calculation, setCalculation] = useState<any>(null);

    useEffect(() => {
      const loadCalculation = async () => {
        const repayments = await getDebtRepayments(debt.id);
        const calc = calculateCurrentBalance(debt, repayments);
        setCalculation(calc);
      };
      loadCalculation();
    }, [debt.id]);

    const renderRightActions = () => {
      return (
        <View style={styles.actionsContainer}>
          <TouchableOpacity 
            style={[styles.actionBtn, { backgroundColor: Colors.primary[500] }]} 
            onPress={() => {
              swipeRef.current?.close();
              router.push(`/debt-tracker/edit/${debt.id}` as any);
            }}
          >
            <Text style={styles.actionText}>Edit</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.actionBtn, { backgroundColor: Colors.danger[500] }]} 
            onPress={() => {
              swipeRef.current?.close();
              handleDelete(debt);
            }}
          >
            <Text style={styles.actionText}>Delete</Text>
          </TouchableOpacity>
        </View>
      );
    };

    if (!calculation) return null;

    const progressPercentage = debt.principal > 0 ? (calculation.totalRepaid / (calculation.totalAccrued || 1)) * 100 : 0;
    const progressColor = progressPercentage < 50 ? SemanticColors.expense : progressPercentage < 80 ? '#F59E0B' : SemanticColors.income;

    return (
      <Swipeable ref={swipeRef} renderRightActions={renderRightActions}>
        <TouchableOpacity 
          style={styles.debtCard} 
          onPress={() => router.push(`/debt-tracker/${debt.id}` as any)}
          activeOpacity={0.7}
        >
          {/* Top Row */}
          <View style={styles.cardHeader}>
            <View style={styles.personInfo}>
              <View style={[
                styles.avatar,
                { backgroundColor: debt.direction === 'borrowed' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)' }
              ]}>
                <Text style={[
                  styles.avatarText,
                  { color: debt.direction === 'borrowed' ? SemanticColors.expense : SemanticColors.income }
                ]}>
                  {debt.name.charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={styles.personDetails}>
                <Text style={styles.personName}>{debt.name}</Text>
                <Text style={styles.startedDate}>Started: {new Date(debt.start_date).toLocaleDateString()}</Text>
              </View>
            </View>
            
            <View style={styles.statusSection}>
              {debt.status === 'completed' && (
                <View style={[styles.statusBadge, { backgroundColor: Colors.success[100] }]}>
                  <Text style={[styles.statusText, { color: Colors.success[600] }]}>✓ Paid</Text>
                </View>
              )}
              {calculation.isOverdue && debt.status === 'active' && (
                <View style={[styles.statusBadge, { backgroundColor: Colors.danger[100] }]}>
                  <Text style={[styles.statusText, { color: Colors.danger[600] }]}>Overdue</Text>
                </View>
              )}
            </View>
          </View>

          {/* Balance Row */}
          <View style={styles.balanceRow}>
            <View style={styles.balanceLeft}>
              <Text style={styles.remainingLabel}>Remaining</Text>
              <Text style={[
                styles.remainingAmount,
                { color: debt.direction === 'borrowed' ? SemanticColors.expense : SemanticColors.income }
              ]}>
                {formatCurrency(calculation.currentBalance)}
              </Text>
            </View>
            <View style={styles.balanceRight}>
              <Text style={styles.paidLabel}>Paid</Text>
              <Text style={styles.paidAmount}>{formatCurrency(calculation.totalRepaid)}</Text>
            </View>
          </View>

          {/* Progress Bar */}
          <View style={styles.progressContainer}>
            <View style={styles.progressTrack}>
              <View style={[
                styles.progressFill,
                { 
                  width: `${Math.min(progressPercentage, 100)}%`,
                  backgroundColor: progressColor
                }
              ]} />
            </View>
          </View>

          {/* Bottom Row */}
          <View style={styles.bottomRow}>
            <View style={styles.dueInfo}>
              <Text style={styles.dueLabel}>Next due:</Text>
              {calculation.isOverdue ? (
                <Text style={styles.overdueText}>
                  Overdue by {calculation.daysOverdue} days
                </Text>
              ) : calculation.nextDueDate === new Date().toISOString().split('T')[0] ? (
                <Text style={styles.dueTodayText}>Due Today</Text>
              ) : (
                <Text style={styles.nextDueText}>
                  Next: {calculation.nextDueDate ? new Date(calculation.nextDueDate).toLocaleDateString() : 'N/A'}
                </Text>
              )}
            </View>
            
            {debt.interest_rate > 0 && (
              <View style={styles.interestBadge}>
                <Text style={styles.interestText}>
                  {debt.interest_type === 'simple' ? 'Simple Interest' : 
                   debt.interest_type === 'compound_monthly' ? 'Compound Monthly' :
                   debt.interest_type === 'compound_quarterly' ? 'Compound Quarterly' :
                   debt.interest_type === 'compound_half_yearly' ? 'Compound Half-Yearly' :
                   debt.interest_type === 'compound_yearly' ? 'Compound Yearly' : 'Interest'}
                </Text>
              </View>
            )}
          </View>
        </TouchableOpacity>
      </Swipeable>
    );
  };

  const FilterTabs = () => (
    <View style={styles.filterContainer}>
      {(['all', 'borrowed', 'lent', 'completed'] as FilterType[]).map((filter) => (
        <TouchableOpacity
          key={filter}
          style={[
            styles.filterTab,
            activeFilter === filter && styles.filterTabActive
          ]}
          onPress={() => setActiveFilter(filter)}
        >
          <Text style={[
            styles.filterText,
            activeFilter === filter && styles.filterTextActive
          ]}>
            {filter.charAt(0).toUpperCase() + filter.slice(1)}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft size={24} color={Colors.gray[900]} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Debt Tracker</Text>
        <TouchableOpacity onPress={() => router.push('/debt-tracker/add' as any)} style={styles.addBtn}>
          <Plus size={24} color="white" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Summary Card */}
        <View style={styles.summaryCard}>
          <View style={styles.summaryItem}>
            <View style={styles.summaryIcon}>
              <TrendingDown size={20} color={SemanticColors.expense} />
            </View>
            <Text style={styles.summaryLabel}>I Owe</Text>
            <Text style={[styles.summaryAmount, { color: SemanticColors.expense }]}>
              {formatCurrency(summary.totalOwed)}
            </Text>
          </View>
          
          <View style={styles.divider} />
          
          <View style={styles.summaryItem}>
            <View style={styles.summaryIcon}>
              <CreditCard size={20} color={SemanticColors.income} />
            </View>
            <Text style={styles.summaryLabel}>Owed to Me</Text>
            <Text style={[styles.summaryAmount, { color: SemanticColors.income }]}>
              {formatCurrency(summary.totalOwedToMe)}
            </Text>
          </View>
        </View>

        {/* Filter Tabs */}
        <FilterTabs />

        {/* Debt List */}
        {loading ? (
          <ActivityIndicator size="large" color={Colors.primary[500]} style={{ marginTop: 40 }} />
        ) : filteredDebts.length > 0 ? (
          filteredDebts.map((debt) => (
            <DebtCard key={debt.id} debt={debt} />
          ))
        ) : (
          <View style={styles.emptyState}>
            <AlertCircle size={48} color={Colors.gray[400]} />
            <Text style={styles.emptyTitle}>No debts tracked</Text>
            <Text style={styles.emptySubtitle}>
              Track loans you've taken or given with full repayment history
            </Text>
            <TouchableOpacity 
              style={styles.emptyActionBtn} 
              onPress={() => router.push('/debt-tracker/add' as any)}
            >
              <Text style={styles.emptyActionText}>Add Debt</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Snackbar */}
      <Snackbar
        visible={snackbarVisible}
        message={snackbarMessage}
        onDismiss={() => setSnackbarVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.gray[50],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    backgroundColor: Colors.white,
  },
  backBtn: {
    padding: 4,
    marginLeft: -4,
  },
  headerTitle: {
    fontSize: Typography.size.xl,
    fontFamily: Typography.family.bold,
    color: Colors.gray[900],
  },
  addBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primary[600],
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 16,
  },
  summaryCard: {
    flexDirection: 'row',
    backgroundColor: Colors.white,
    borderRadius: Layout.radius.lg,
    padding: 20,
    marginTop: 16,
    marginBottom: 20,
    ...Layout.shadows.md,
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.gray[100],
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: Typography.size.sm,
    color: Colors.gray[500],
    fontFamily: Typography.family.medium,
    marginBottom: 4,
  },
  summaryAmount: {
    fontSize: Typography.size.xxl,
    fontFamily: Typography.family.bold,
  },
  divider: {
    width: 1,
    backgroundColor: Colors.gray[200],
    marginHorizontal: 20,
  },
  filterContainer: {
    flexDirection: 'row',
    backgroundColor: Colors.white,
    borderRadius: Layout.radius.lg,
    padding: 4,
    marginBottom: 20,
    ...Layout.shadows.sm,
  },
  filterTab: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: Layout.radius.md,
    alignItems: 'center',
  },
  filterTabActive: {
    backgroundColor: Colors.primary[100],
  },
  filterText: {
    fontSize: Typography.size.sm,
    fontFamily: Typography.family.medium,
    color: Colors.gray[600],
  },
  filterTextActive: {
    color: Colors.primary[600],
    fontFamily: Typography.family.bold,
  },
  debtCard: {
    backgroundColor: Colors.white,
    borderRadius: Layout.radius.lg,
    padding: 16,
    marginBottom: 12,
    ...Layout.shadows.sm,
  },
  actionsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingLeft: 10,
  },
  actionBtn: {
    width: 72,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: Layout.radius.lg,
    marginLeft: 8,
  },
  actionText: {
    color: 'white',
    fontSize: 11,
    fontFamily: Typography.family.bold,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  personInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    fontSize: Typography.size.lg,
    fontFamily: Typography.family.bold,
  },
  personDetails: {
    flex: 1,
  },
  personName: {
    fontSize: Typography.size.lg,
    fontFamily: Typography.family.bold,
    color: Colors.gray[900],
    marginBottom: 2,
  },
  startedDate: {
    fontSize: Typography.size.xs,
    color: Colors.gray[500],
  },
  statusSection: {
    alignItems: 'flex-end',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Layout.radius.sm,
  },
  statusText: {
    fontSize: Typography.size.xs,
    fontFamily: Typography.family.bold,
  },
  balanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  balanceLeft: {
    flex: 1,
  },
  remainingLabel: {
    fontSize: Typography.size.xs,
    color: Colors.gray[500],
    marginBottom: 2,
  },
  remainingAmount: {
    fontSize: Typography.size.xl,
    fontFamily: Typography.family.bold,
  },
  balanceRight: {
    alignItems: 'flex-end',
  },
  paidLabel: {
    fontSize: Typography.size.xs,
    color: Colors.gray[500],
    marginBottom: 2,
  },
  paidAmount: {
    fontSize: Typography.size.md,
    fontFamily: Typography.family.bold,
    color: SemanticColors.income,
  },
  progressContainer: {
    marginBottom: 12,
  },
  progressTrack: {
    height: 6,
    backgroundColor: Colors.gray[200],
    borderRadius: Layout.radius.full,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: Layout.radius.full,
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dueInfo: {
    flex: 1,
  },
  dueLabel: {
    fontSize: Typography.size.xs,
    color: Colors.gray[500],
    marginBottom: 2,
  },
  nextDueText: {
    fontSize: Typography.size.xs,
    color: Colors.gray[400],
  },
  dueTodayText: {
    fontSize: Typography.size.xs,
    color: '#F59E0B',
    fontFamily: Typography.family.medium,
  },
  overdueText: {
    fontSize: Typography.size.xs,
    color: Colors.danger[600],
    fontFamily: Typography.family.medium,
  },
  interestBadge: {
    backgroundColor: Colors.gray[100],
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Layout.radius.sm,
  },
  interestText: {
    fontSize: Typography.size.xs,
    color: Colors.gray[400],
    fontFamily: Typography.family.medium,
  },
  emptyState: {
    alignItems: 'center',
    marginTop: 60,
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: Typography.size.xl,
    fontFamily: Typography.family.bold,
    color: Colors.gray[600],
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: Typography.size.md,
    color: Colors.gray[500],
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  emptyActionBtn: {
    backgroundColor: Colors.primary[600],
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: Layout.radius.lg,
  },
  emptyActionText: {
    color: 'white',
    fontSize: Typography.size.md,
    fontFamily: Typography.family.bold,
  },
});
