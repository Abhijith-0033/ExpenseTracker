import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, Alert, ActivityIndicator } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { ArrowLeft, Plus, TrendingUp, Users, Calendar, AlertCircle } from 'lucide-react-native';
import { Colors, Layout, Typography, SemanticColors } from '../../constants/Theme';
import { getChitFunds, getChitMonthlyRecords, deleteChitFund } from '../../services/chitfund/chitService';
import { calculateChitFundPosition, ChitFund } from '../../services/chitfund/ChitEngine';
import { formatCurrency } from '../../utils/currency';
import { Snackbar } from '../../components/Snackbar';
import { Swipeable } from 'react-native-gesture-handler';
import { format } from 'date-fns';

type FilterType = 'all' | 'active' | 'completed' | 'cancelled';

export default function ChitFundsScreen() {
  const router = useRouter();
  const [chitFunds, setChitFunds] = useState<ChitFund[]>([]);
  const [filteredChitFunds, setFilteredChitFunds] = useState<ChitFund[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [summary, setSummary] = useState({
    totalInvested: 0,
    totalReceived: 0,
    netPosition: 0,
    activeFunds: 0,
    upcomingPayments: 0,
    myTurns: 0
  });

  // Snackbar state
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');

  const fetchData = async () => {
    try {
      const allChitFunds = await getChitFunds();
      setChitFunds(allChitFunds);
      setFilteredChitFunds(allChitFunds);
      
      // Calculate summary
      let totalInvested = 0;
      let totalReceived = 0;
      let netPosition = 0;
      let activeFunds = 0;
      let upcomingPayments = 0;
      let myTurns = 0;
      
      for (const chitFund of allChitFunds.filter(f => f.status === 'active')) {
        const monthlyRecords = await getChitMonthlyRecords(chitFund.id);
        const calculation = calculateChitFundPosition(chitFund, monthlyRecords);
        
        totalInvested += calculation.totalInvested;
        totalReceived += calculation.totalReceived;
        netPosition += calculation.netPosition;
        activeFunds++;
        
        if (calculation.nextMonthDue !== null) {
          upcomingPayments++;
        }
        
        if (chitFund.my_turn_month !== null) {
          myTurns++;
        }
      }
      
      setSummary({ totalInvested, totalReceived, netPosition, activeFunds, upcomingPayments, myTurns });
    } catch (error) {
      console.error('Failed to fetch chit funds:', error);
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
    let filtered = chitFunds;
    
    switch (activeFilter) {
      case 'active':
        filtered = chitFunds.filter(f => f.status === 'active');
        break;
      case 'completed':
        filtered = chitFunds.filter(f => f.status === 'completed');
        break;
      case 'cancelled':
        filtered = chitFunds.filter(f => f.status === 'cancelled');
        break;
    }
    
    setFilteredChitFunds(filtered);
  }, [activeFilter, chitFunds]);

  const handleDelete = (chitFund: ChitFund) => {
    Alert.alert(
      'Delete Chit Fund',
      `This will permanently delete '${chitFund.name}' and all its records. This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteChitFund(chitFund.id);
              fetchData();
              setSnackbarMessage('Chit fund deleted');
              setSnackbarVisible(true);
            } catch (error) {
              Alert.alert('Error', 'Failed to delete chit fund');
            }
          }
        }
      ]
    );
  };

  const ChitFundCard = ({ chitFund }: { chitFund: ChitFund }) => {
    const swipeRef = React.useRef<Swipeable>(null);
    const [calculation, setCalculation] = useState<any>(null);

    useEffect(() => {
      const loadCalculation = async () => {
        const monthlyRecords = await getChitMonthlyRecords(chitFund.id);
        const calc = calculateChitFundPosition(chitFund, monthlyRecords);
        setCalculation(calc);
      };
      loadCalculation();
    }, [chitFund.id]);

    const renderRightActions = () => {
      return (
        <View style={styles.actionsContainer}>
          <TouchableOpacity 
            style={[styles.actionBtn, { backgroundColor: Colors.primary[500] }]} 
            onPress={() => {
              swipeRef.current?.close();
              router.push(`/chit-funds/edit/${chitFund.id}` as any);
            }}
          >
            <Text style={styles.actionText}>Edit</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.actionBtn, { backgroundColor: Colors.danger[500] }]} 
            onPress={() => {
              swipeRef.current?.close();
              handleDelete(chitFund);
            }}
          >
            <Text style={styles.actionText}>Delete</Text>
          </TouchableOpacity>
        </View>
      );
    };

    if (!calculation) return null;

    const progressPercentage = chitFund.duration_months > 0 ? (calculation.monthsPaid / chitFund.duration_months) * 100 : 0;
    const roiColor = calculation.roi >= 0 ? SemanticColors.income : SemanticColors.expense;
    const roiPrefix = calculation.roi >= 0 ? '+' : '';

    return (
      <Swipeable ref={swipeRef} renderRightActions={renderRightActions}>
        <TouchableOpacity 
          style={styles.chitFundCard} 
          onPress={() => router.push(`/chit-funds/${chitFund.id}` as any)}
          activeOpacity={0.7}
        >
          {/* Header */}
          <View style={styles.cardHeader}>
            <View style={styles.fundInfo}>
              <View style={styles.fundIcon}>
                <Users size={20} color={Colors.primary[600]} />
              </View>
              <View style={styles.fundDetails}>
                <Text style={styles.fundName}>{chitFund.name}</Text>
                <Text style={styles.fundDuration}>
                  {chitFund.duration_months} months • {chitFund.total_members} members
                </Text>
              </View>
            </View>
            
            <View style={styles.statusSection}>
              {chitFund.status === 'completed' && (
                <View style={[styles.statusBadge, { backgroundColor: Colors.success[100] }]}>
                  <Text style={[styles.statusText, { color: Colors.success[600] }]}>Completed</Text>
                </View>
              )}
              {chitFund.status === 'cancelled' && (
                <View style={[styles.statusBadge, { backgroundColor: Colors.danger[100] }]}>
                  <Text style={[styles.statusText, { color: Colors.danger[600] }]}>Cancelled</Text>
                </View>
              )}
              {chitFund.status === 'active' && calculation.nextMonthDue === new Date().getDate() && (
                <View style={[styles.statusBadge, { backgroundColor: Colors.warning[100] }]}>
                  <Text style={[styles.statusText, { color: Colors.warning[600] }]}>Due Today</Text>
                </View>
              )}
            </View>
          </View>

          {/* Financial Summary */}
          <View style={styles.financialSummary}>
            <View style={styles.financialRow}>
              <Text style={styles.financialLabel}>Invested</Text>
              <Text style={styles.financialValue}>
                {formatCurrency(calculation.totalInvested)}
              </Text>
            </View>
            <View style={styles.financialRow}>
              <Text style={styles.financialLabel}>Received</Text>
              <Text style={styles.financialValue}>
                {formatCurrency(calculation.totalReceived)}
              </Text>
            </View>
            <View style={styles.financialRow}>
              <Text style={styles.financialLabel}>Net Position</Text>
              <Text style={[
                styles.financialValue,
                { color: roiColor }
              ]}>
                {formatCurrency(calculation.netPosition)}
              </Text>
            </View>
          </View>

          {/* ROI */}
          <View style={styles.roiSection}>
            <Text style={styles.roiLabel}>ROI</Text>
            <Text style={[
              styles.roiValue,
              { color: roiColor }
            ]}>
              {roiPrefix}{calculation.roi.toFixed(2)}%
            </Text>
            <Text style={styles.annualizedRoi}>
              ({calculation.annualizedRoi.toFixed(2)}% annualized)
            </Text>
          </View>

          {/* Progress */}
          <View style={styles.progressContainer}>
            <View style={styles.progressTrack}>
              <View style={[
                styles.progressFill,
                { 
                  width: `${Math.min(progressPercentage, 100)}%`,
                  backgroundColor: Colors.primary[500]
                }
              ]} />
            </View>
            <Text style={styles.progressText}>
              {calculation.monthsPaid}/{chitFund.duration_months} months
            </Text>
          </View>

          {/* Bottom Info */}
          <View style={styles.bottomRow}>
            <View style={styles.monthlyInfo}>
              <Text style={styles.monthlyLabel}>Monthly</Text>
              <Text style={styles.monthlyAmount}>
                {formatCurrency(chitFund.monthly_amount)}
              </Text>
            </View>
            
            <View style={styles.turnInfo}>
              <Text style={styles.turnLabel}>My Turn</Text>
              {chitFund.my_turn_month ? (
                <Text style={styles.turnValue}>
                  Month {chitFund.my_turn_month}
                </Text>
              ) : (
                <Text style={styles.turnValue}>Not assigned</Text>
              )}
            </View>
            
            <View style={styles.dateInfo}>
              <Text style={styles.dateLabel}>Started</Text>
              <Text style={styles.dateValue}>
                {format(new Date(chitFund.start_date), 'MMM dd, yyyy')}
              </Text>
            </View>
          </View>
        </TouchableOpacity>
      </Swipeable>
    );
  };

  const FilterTabs = () => (
    <View style={styles.filterContainer}>
      {(['all', 'active', 'completed', 'cancelled'] as FilterType[]).map((filter) => (
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
        <Text style={styles.headerTitle}>Chit Funds</Text>
        <TouchableOpacity onPress={() => router.push('/chit-funds/add' as any)} style={styles.addBtn}>
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
              <TrendingUp size={20} color={Colors.primary[600]} />
            </View>
            <Text style={styles.summaryLabel}>Total Invested</Text>
            <Text style={styles.summaryAmount}>
              {formatCurrency(summary.totalInvested)}
            </Text>
          </View>
          
          <View style={styles.divider} />
          
          <View style={styles.summaryItem}>
            <View style={styles.summaryIcon}>
              <Calendar size={20} color={Colors.success[600]} />
            </View>
            <Text style={styles.summaryLabel}>Net Position</Text>
            <Text style={[
              styles.summaryAmount,
              { color: summary.netPosition >= 0 ? Colors.success[600] : Colors.danger[600] }
            ]}>
              {formatCurrency(summary.netPosition)}
            </Text>
          </View>
        </View>

        {/* Quick Stats */}
        <View style={styles.quickStats}>
          <View style={styles.quickStatItem}>
            <Text style={styles.quickStatValue}>{summary.activeFunds}</Text>
            <Text style={styles.quickStatLabel}>Active Funds</Text>
          </View>
          <View style={styles.quickStatItem}>
            <Text style={styles.quickStatValue}>{summary.upcomingPayments}</Text>
            <Text style={styles.quickStatLabel}>Due Payments</Text>
          </View>
          <View style={styles.quickStatItem}>
            <Text style={styles.quickStatValue}>{summary.myTurns}</Text>
            <Text style={styles.quickStatLabel}>My Turns</Text>
          </View>
        </View>

        {/* Filter Tabs */}
        <FilterTabs />

        {/* Chit Fund List */}
        {loading ? (
          <ActivityIndicator size="large" color={Colors.primary[500]} style={{ marginTop: 40 }} />
        ) : filteredChitFunds.length > 0 ? (
          filteredChitFunds.map((chitFund) => (
            <ChitFundCard key={chitFund.id} chitFund={chitFund} />
          ))
        ) : (
          <View style={styles.emptyState}>
            <AlertCircle size={48} color={Colors.gray[400]} />
            <Text style={styles.emptyTitle}>No chit funds tracked</Text>
            <Text style={styles.emptySubtitle}>
              Track your chit fund investments with detailed analytics and ROI tracking
            </Text>
            <TouchableOpacity 
              style={styles.emptyActionBtn} 
              onPress={() => router.push('/chit-funds/add' as any)}
            >
              <Text style={styles.emptyActionText}>Add Chit Fund</Text>
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
    backgroundColor: Colors.primary[100],
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
  quickStats: {
    flexDirection: 'row',
    backgroundColor: Colors.white,
    borderRadius: Layout.radius.lg,
    padding: 16,
    marginBottom: 20,
    ...Layout.shadows.sm,
  },
  quickStatItem: {
    flex: 1,
    alignItems: 'center',
  },
  quickStatValue: {
    fontSize: Typography.size.xl,
    fontFamily: Typography.family.bold,
    color: Colors.gray[900],
    marginBottom: 4,
  },
  quickStatLabel: {
    fontSize: Typography.size.sm,
    color: Colors.gray[500],
    fontFamily: Typography.family.medium,
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
  chitFundCard: {
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
  fundInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  fundIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primary[100],
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  fundDetails: {
    flex: 1,
  },
  fundName: {
    fontSize: Typography.size.lg,
    fontFamily: Typography.family.bold,
    color: Colors.gray[900],
    marginBottom: 4,
  },
  fundDuration: {
    fontSize: Typography.size.sm,
    color: Colors.gray[500],
    fontFamily: Typography.family.medium,
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
  financialSummary: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  financialRow: {
    alignItems: 'center',
  },
  financialLabel: {
    fontSize: Typography.size.xs,
    color: Colors.gray[500],
    marginBottom: 2,
  },
  financialValue: {
    fontSize: Typography.size.sm,
    fontFamily: Typography.family.bold,
    color: Colors.gray[900],
  },
  roiSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    backgroundColor: Colors.gray[50],
    padding: 12,
    borderRadius: Layout.radius.md,
  },
  roiLabel: {
    fontSize: Typography.size.sm,
    color: Colors.gray[600],
    fontFamily: Typography.family.medium,
  },
  roiValue: {
    fontSize: Typography.size.md,
    fontFamily: Typography.family.bold,
  },
  annualizedRoi: {
    fontSize: Typography.size.xs,
    color: Colors.gray[500],
  },
  progressContainer: {
    marginBottom: 16,
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
  progressText: {
    fontSize: Typography.size.xs,
    color: Colors.gray[500],
    textAlign: 'center',
    marginTop: 4,
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  monthlyInfo: {
    alignItems: 'center',
  },
  monthlyLabel: {
    fontSize: Typography.size.xs,
    color: Colors.gray[500],
    marginBottom: 2,
  },
  monthlyAmount: {
    fontSize: Typography.size.sm,
    fontFamily: Typography.family.bold,
    color: Colors.gray[900],
  },
  turnInfo: {
    alignItems: 'center',
  },
  turnLabel: {
    fontSize: Typography.size.xs,
    color: Colors.gray[500],
    marginBottom: 2,
  },
  turnValue: {
    fontSize: Typography.size.sm,
    fontFamily: Typography.family.bold,
    color: Colors.gray[900],
  },
  dateInfo: {
    alignItems: 'center',
  },
  dateLabel: {
    fontSize: Typography.size.xs,
    color: Colors.gray[500],
    marginBottom: 2,
  },
  dateValue: {
    fontSize: Typography.size.sm,
    fontFamily: Typography.family.bold,
    color: Colors.gray[900],
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
