import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, StatusBar, TouchableOpacity, Dimensions } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useApp } from '../../context/AppContext';
import { Card } from '../../components/ui/Card';
import { Wallet, TrendingUp, TrendingDown, ArrowRight, BookOpen, ChevronLeft, ChevronRight, Activity } from 'lucide-react-native';
import { Colors, Layout, Typography } from '../../constants/Theme';
import { LinearGradient } from 'expo-linear-gradient';
import { formatCurrency } from '../../utils/currency';
import { addMonths, subMonths, format } from 'date-fns';
import { getBooks } from '../../services/books';
import { getDebtSummary, DebtSummary } from '../../services/debts';
import { getDailyIncomeExpense, getWeeklyIncomeExpense, getMonthlyIncomeExpense, getYearlyIncomeExpense } from '../../services/analysis';
import { AnimatedBalance } from '../../components/AnimatedBalance';
import { MonthlyExpensePieChart } from '../../components/MonthlyExpensePieChart';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown, FadeInRight } from 'react-native-reanimated';
import { GestureHandlerRootView, Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import { PressableScale } from '../../components/ui/PressableScale';
import { CalendarDays, CalendarRange, Calendar, BarChart3, PieChart as PieChartIcon, X } from 'lucide-react-native';
import { Modal } from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function Dashboard() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { accounts, transactions, refreshData } = useApp();
  const [refreshing, setRefreshing] = useState(false);

  // Dashboard Summaries State
  const [bookSummary, setBookSummary] = useState({ count: 0, total: 0 });
  const [debtSummary, setDebtSummary] = useState<DebtSummary>({ totalDebt: 0, totalReceivable: 0, netPosition: 0 });
  
  // New metrics states
  const [dailyStats, setDailyStats] = useState({ income: 0, expense: 0 });
  const [weeklyStats, setWeeklyStats] = useState({ income: 0, expense: 0 });
  const [monthlyStats, setMonthlyStats] = useState({ income: 0, expense: 0 });
  const [yearlyStats, setYearlyStats] = useState({ income: 0, expense: 0 });
  const [showPieModal, setShowPieModal] = useState(false);

  const fetchSummaries = async () => {
    try {
      const books = await getBooks();
      const booksTotal = books.reduce((sum, b) => sum + (b.total_spent || 0), 0);
      setBookSummary({ count: books.length, total: booksTotal });

      const debts = await getDebtSummary();
      setDebtSummary(debts);

      // Fetch new metrics
      const now = new Date();
      const [dStats, wStats, mStats, yStats] = await Promise.all([
        getDailyIncomeExpense(now),
        getWeeklyIncomeExpense(now),
        getMonthlyIncomeExpense(now),
        getYearlyIncomeExpense(now.getFullYear())
      ]);
      
      setDailyStats(dStats);
      setWeeklyStats(wStats);
      setMonthlyStats(mStats);
      setYearlyStats(yStats);
    } catch (e) {
      console.error("Failed to fetch dashboard summaries", e);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refreshData(), fetchSummaries()]);
    setRefreshing(false);
  }, [refreshData]);

  useFocusEffect(
    useCallback(() => {
      fetchSummaries();
    }, [])
  );

  const totalBalance = accounts.reduce((sum, acc) => sum + acc.balance, 0);
  const income = transactions.filter(t => t.type === 'income' || (t.category === 'Income' && !t.type)).reduce((s, t) => s + t.amount, 0);
  const expense = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView style={styles.mainContainer} edges={['top']}>
        <StatusBar barStyle="dark-content" />
        <LinearGradient
          colors={[Colors.gray[50], Colors.gray[50]]}
          style={StyleSheet.absoluteFill}
        />

        <ScrollView
          style={styles.container}
          contentContainerStyle={[styles.contentContainer, { paddingBottom: 100 }]}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary[500]} />}
        >
          <Animated.View entering={FadeInDown.duration(600)} style={styles.header}>
            <View>
              <Text style={styles.greeting}>Overview</Text>
              <Text style={styles.date}>{format(new Date(), 'EEEE, do MMMM')}</Text>
            </View>
            <TouchableOpacity
              activeOpacity={0.7}
              style={styles.profilePlaceholder}
              onPress={() => { }}
            >
              <Text style={styles.profileInitials}>ME</Text>
            </TouchableOpacity>
          </Animated.View>

          {/* Main Balance Card */}
          <Animated.View entering={FadeInDown.delay(100).duration(600)}>
            <LinearGradient
              colors={[Colors.primary[500], Colors.primary[400]]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.balanceGradient}
            >
              <View style={styles.decCircle1} />
              <View style={styles.decCircle2} />

              <View style={styles.balanceContent}>
                <View>
                  <Text style={styles.balanceLabel}>Total Balance</Text>
                  <AnimatedBalance value={totalBalance} style={styles.balanceValue} />
                </View>
                <View style={styles.balanceRight}>
                  <Wallet size={36} color="rgba(255,255,255,0.25)" />
                </View>
              </View>
            </LinearGradient>
          </Animated.View>

          {/* Dashboard Metrics Grid */}
          <Animated.View entering={FadeInDown.delay(150).duration(600)} style={styles.metricsGridContainer}>
            <View style={styles.metricsGridRow}>
              <View style={styles.metricCardHalf}>
                <View style={[styles.metricCardIcon, { backgroundColor: Colors.accent.mint }]}>
                  <CalendarDays size={18} color={Colors.success[600]} />
                </View>
                <Text style={styles.metricGridLabel}>Today's Income</Text>
                <Text style={[styles.metricGridValue, { color: Colors.success[700] }]} numberOfLines={1}>{formatCurrency(dailyStats.income)}</Text>
              </View>
              <View style={styles.metricCardHalf}>
                <View style={[styles.metricCardIcon, { backgroundColor: Colors.accent.rose }]}>
                  <CalendarDays size={18} color={Colors.danger[600]} />
                </View>
                <Text style={styles.metricGridLabel}>Today's Expense</Text>
                <Text style={[styles.metricGridValue, { color: Colors.danger[700] }]} numberOfLines={1}>{formatCurrency(dailyStats.expense)}</Text>
              </View>
            </View>

            <View style={styles.metricsGridRow}>
              <View style={styles.metricCardHalf}>
                <View style={[styles.metricCardIcon, { backgroundColor: Colors.accent.mint }]}>
                  <CalendarRange size={18} color={Colors.success[600]} />
                </View>
                <Text style={styles.metricGridLabel}>This Week (Inc)</Text>
                <Text style={[styles.metricGridValue, { color: Colors.success[700] }]} numberOfLines={1}>{formatCurrency(weeklyStats.income)}</Text>
              </View>
              <View style={styles.metricCardHalf}>
                <View style={[styles.metricCardIcon, { backgroundColor: Colors.accent.rose }]}>
                  <CalendarRange size={18} color={Colors.danger[600]} />
                </View>
                <Text style={styles.metricGridLabel}>This Week (Exp)</Text>
                <Text style={[styles.metricGridValue, { color: Colors.danger[700] }]} numberOfLines={1}>{formatCurrency(weeklyStats.expense)}</Text>
              </View>
            </View>

            {/* Combined This Month & Mini Pie Chart Metric */}
            <PressableScale 
               style={[styles.metricCardFull, { padding: 16, marginVertical: 4, justifyContent: 'space-between' }]}
               onPress={() => setShowPieModal(true)}
            >
               <View style={{ flex: 1 }}>
                   <Text style={[styles.metricGridLabel, { fontSize: Typography.size.sm }]}>This Month's Spending</Text>
                   <Text style={{ fontSize: 10, color: Colors.gray[500], marginTop: 2 }}>Tap to view breakdown</Text>
                   
                   <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 16, gap: 16 }}>
                       <View>
                           <Text style={{ fontSize: 10, color: Colors.gray[500], marginBottom: 2 }}>Income</Text>
                           <Text style={[styles.metricGridValue, { color: Colors.success[700], fontSize: 16 }]}>{formatCurrency(monthlyStats.income)}</Text>
                       </View>
                       <View>
                           <Text style={{ fontSize: 10, color: Colors.gray[500], marginBottom: 2 }}>Expense</Text>
                           <Text style={[styles.metricGridValue, { color: Colors.danger[700], fontSize: 16 }]}>{formatCurrency(monthlyStats.expense)}</Text>
                       </View>
                   </View>
               </View>
               
               <View style={{ width: 80, height: 80, alignItems: 'center', justifyContent: 'center' }}>
                   <MonthlyExpensePieChart initialMonth={new Date()} variant="mini" />
               </View>
            </PressableScale>

            <View style={styles.metricsGridRow}>
              <View style={styles.metricCardHalf}>
                <View style={[styles.metricCardIcon, { backgroundColor: Colors.accent.mint }]}>
                  <BarChart3 size={18} color={Colors.success[600]} />
                </View>
                <Text style={styles.metricGridLabel}>This Year (Inc)</Text>
                <Text style={[styles.metricGridValue, { color: Colors.success[700] }]} numberOfLines={1}>{formatCurrency(yearlyStats.income)}</Text>
              </View>
              <View style={styles.metricCardHalf}>
                <View style={[styles.metricCardIcon, { backgroundColor: Colors.accent.rose }]}>
                  <BarChart3 size={18} color={Colors.danger[600]} />
                </View>
                <Text style={styles.metricGridLabel}>This Year (Exp)</Text>
                <Text style={[styles.metricGridValue, { color: Colors.danger[700] }]} numberOfLines={1}>{formatCurrency(yearlyStats.expense)}</Text>
              </View>
            </View>

            <PressableScale style={[styles.metricCardFull, { backgroundColor: Colors.accent.lavender }]} onPress={() => {}}>
              <View style={styles.metricCardIconRow}>
                <View style={[styles.metricCardIcon, { backgroundColor: 'rgba(255,255,255,0.6)' }]}>
                  <Activity size={20} color={Colors.primary[600]} />
                </View>
              </View>
              <View style={{ flex: 1, marginLeft: 16 }}>
                <Text style={styles.metricTitle}>Net Cash Flow (Monthly)</Text>
                <Text style={[styles.metricValue, { color: Colors.primary[700] }]}>{formatCurrency(monthlyStats.income - monthlyStats.expense)}</Text>
              </View>
            </PressableScale>
          </Animated.View>


          <Animated.View entering={FadeInDown.delay(300).duration(600)}>
            <Text style={styles.sectionHeaderTitle}>Financial Modules</Text>

            {/* Expense Books Section */}
            <PressableScale
              style={[styles.bookModuleCard, { backgroundColor: Colors.accent.rose }]}
              onPress={() => router.push('/books' as any)}
            >
              <View style={styles.bookModuleInner}>
                <View style={[styles.iconContainerPrimary, { backgroundColor: 'rgba(255,255,255,0.6)' }]}>
                  <BookOpen size={24} color={Colors.danger[500]} />
                </View>
                <View style={styles.moduleContent}>
                  <Text style={styles.moduleTitle}>Expense Books</Text>
                  <Text style={styles.moduleSubtitle}>{bookSummary.count} Active Projects</Text>
                </View>
                <View style={styles.moduleRight}>
                  <Text style={styles.moduleAmount}>{formatCurrency(bookSummary.total)}</Text>
                  <Text style={styles.moduleLabel}>Total Tracked</Text>
                </View>
              </View>
            </PressableScale>

            {/* Debts & Receivables */}
            <View style={styles.debtRow}>
              <PressableScale
                style={[styles.debtModuleCard, { backgroundColor: Colors.gray[100] }]}
                onPress={() => router.push('/debts?type=debt' as any)}
              >
                <View style={[styles.iconContainer, { backgroundColor: Colors.white }]}>
                  <TrendingDown size={22} color={Colors.danger[500]} />
                </View>
                <View style={styles.debtContent}>
                  <Text style={styles.debtLabel}>I Owe</Text>
                  <Text style={[styles.debtAmount, { color: Colors.danger[600] }]} numberOfLines={1}>
                    {formatCurrency(debtSummary.totalDebt)}
                  </Text>
                </View>
                <View style={styles.actionIcon}>
                  <ArrowRight size={14} color={Colors.gray[400]} />
                </View>
              </PressableScale>

              <PressableScale
                style={[styles.debtModuleCard, { backgroundColor: Colors.accent.mint }]}
                onPress={() => router.push('/debts?type=receivable' as any)}
              >
                <View style={[styles.iconContainer, { backgroundColor: Colors.white }]}>
                  <TrendingUp size={22} color={Colors.success[500]} />
                </View>
                <View style={styles.debtContent}>
                  <Text style={styles.debtLabel}>They Owe</Text>
                  <Text style={[styles.debtAmount, { color: Colors.success[600] }]} numberOfLines={1}>
                    {formatCurrency(debtSummary.totalReceivable)}
                  </Text>
                </View>
                <View style={styles.actionIcon}>
                  <ArrowRight size={14} color={Colors.gray[400]} />
                </View>
              </PressableScale>
            </View>
          </Animated.View>

          {/* Accounts Section */}
          <Animated.View entering={FadeInDown.delay(500).duration(600)} style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>My Accounts</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.accountsScroll}>
              {accounts.length > 0 ? accounts.map((acc, index) => (
                <Card key={acc.id} style={[styles.accountCard, { marginLeft: index === 0 ? 0 : 16 }]}>
                  <View style={styles.accountHeader}>
                    <View style={[styles.accIcon, { backgroundColor: Colors.primary[50] }]}>
                      <Wallet size={18} color={Colors.primary[500]} />
                    </View>
                    <Text style={styles.accountType}>{acc.type}</Text>
                  </View>
                  <View>
                    <Text style={styles.accountName} numberOfLines={1}>{acc.name}</Text>
                    <Text style={styles.accountBalance}>{formatCurrency(acc.balance)}</Text>
                  </View>
                </Card>
              )) : (
                <Text style={styles.emptyAccounts}>No accounts added yet</Text>
              )}
            </ScrollView>
          </Animated.View>
        </ScrollView>

        {/* Pie Chart Detailed Modal */}
        <Modal visible={showPieModal} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Analysis Breakdown</Text>
                <TouchableOpacity onPress={() => setShowPieModal(false)} style={styles.closeBtn}>
                  <X size={24} color={Colors.gray[500]} />
                </TouchableOpacity>
              </View>
              
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
                <MonthlyExpensePieChart initialMonth={new Date()} />
              </ScrollView>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  mainContainer: {
    flex: 1,
    backgroundColor: Colors.gray[50],
  },
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: Layout.spacing.lg,
    paddingTop: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Layout.spacing.xl,
  },
  greeting: {
    fontSize: Typography.size.xxl,
    fontFamily: Typography.family.bold,
    color: Colors.gray[900],
    letterSpacing: -0.5,
  },
  date: {
    fontSize: Typography.size.sm,
    fontFamily: Typography.family.medium,
    color: Colors.gray[500],
    marginTop: 2,
  },
  profilePlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primary[50],
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: Colors.primary[100],
  },
  profileInitials: {
    color: Colors.primary[600],
    fontFamily: Typography.family.bold,
    fontSize: Typography.size.md,
  },
  balanceGradient: {
    borderRadius: 28,
    padding: 24,
    ...Layout.shadows.xl,
    marginBottom: 24,
    overflow: 'hidden',
  },
  decCircle1: {
    position: 'absolute',
    top: -20,
    right: -20,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  decCircle2: {
    position: 'absolute',
    bottom: -40,
    left: 20,
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  balanceContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  balanceRight: {
    justifyContent: 'center',
    opacity: 0.8,
  },
  balanceLabel: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: Typography.size.sm,
    fontFamily: Typography.family.medium,
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  balanceValue: {
    color: Colors.white,
    fontSize: Typography.size.display,
    fontFamily: Typography.family.bold,
    letterSpacing: -1,
  },
  metricsSection: {
    marginHorizontal: -Layout.spacing.lg,
    marginBottom: 32,
  },
  metricsScroll: {
    paddingHorizontal: Layout.spacing.lg,
    gap: 16,
  },
  metricCard: {
    width: 160,
    padding: 20,
    borderRadius: 24,
    justifyContent: 'space-between',
  },
  metricIconRow: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  metricTitle: {
    fontFamily: Typography.family.medium,
    fontSize: Typography.size.xs,
    color: Colors.gray[600],
    marginBottom: 4,
  },
  metricValue: {
    fontFamily: Typography.family.bold,
    fontSize: Typography.size.lg,
  },
  sectionHeaderTitle: {
    fontSize: Typography.size.sm,
    fontFamily: Typography.family.bold,
    color: Colors.gray[400],
    marginBottom: 16,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  bookModuleCard: {
    marginBottom: 20,
    borderRadius: 24,
    overflow: 'hidden',
  },
  bookModuleInner: {
    padding: 24,
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainerPrimary: {
    width: 52,
    height: 52,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  moduleContent: {
    flex: 1,
  },
  moduleTitle: {
    fontSize: Typography.size.lg,
    fontFamily: Typography.family.bold,
    color: Colors.gray[900],
  },
  moduleSubtitle: {
    fontSize: Typography.size.xs,
    fontFamily: Typography.family.regular,
    color: Colors.gray[600],
    marginTop: 2,
  },
  moduleRight: {
    alignItems: 'flex-end',
  },
  moduleAmount: {
    fontSize: Typography.size.lg,
    fontFamily: Typography.family.bold,
    color: Colors.gray[900],
  },
  moduleLabel: {
    fontSize: Typography.size.xs,
    fontFamily: Typography.family.regular,
    color: Colors.gray[500],
    marginTop: 2,
  },
  debtRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 32,
  },
  debtModuleCard: {
    flex: 1,
    borderRadius: 24,
    padding: 20,
    justifyContent: 'space-between',
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  debtContent: {
    marginBottom: 4,
  },
  debtLabel: {
    fontSize: Typography.size.sm,
    fontFamily: Typography.family.medium,
    color: Colors.gray[600],
    marginBottom: 4,
  },
  debtAmount: {
    fontSize: Typography.size.xl,
    fontFamily: Typography.family.bold,
  },
  actionIcon: {
    position: 'absolute',
    top: 20,
    right: 20,
  },
  section: {
    marginBottom: 32,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: Typography.size.lg,
    fontFamily: Typography.family.bold,
    color: Colors.gray[900],
  },
  accountsScroll: {
    paddingRight: 16,
    paddingBottom: 8,
  },
  accountCard: {
    width: 160,
    height: 150,
    padding: 20,
    justifyContent: 'space-between',
    backgroundColor: Colors.white,
    borderRadius: 24,
    ...Layout.shadows.sm,
  },
  accountHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  accIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  accountType: {
    fontSize: Typography.size.xs,
    fontFamily: Typography.family.bold,
    color: Colors.gray[400],
    textTransform: 'uppercase',
  },
  accountName: {
    fontSize: Typography.size.md,
    fontFamily: Typography.family.bold,
    color: Colors.gray[800],
    marginBottom: 4,
  },
  accountBalance: {
    fontSize: Typography.size.lg,
    fontFamily: Typography.family.bold,
    color: Colors.gray[900],
  },
  emptyAccounts: {
    color: Colors.gray[400],
    fontFamily: Typography.family.regular,
    fontStyle: 'italic',
    padding: 20,
  },
  metricsGridContainer: {
    marginHorizontal: 0,
    marginBottom: 32,
    gap: 12,
  },
  metricsGridRow: {
    flexDirection: 'row',
    gap: 12,
  },
  metricCardHalf: {
    flex: 1,
    backgroundColor: Colors.white,
    padding: 16,
    borderRadius: 24,
    ...Layout.shadows.sm,
  },
  metricCardFull: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    padding: 20,
    borderRadius: 24,
    ...Layout.shadows.sm,
  },
  metricCardIconRow: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  metricCardIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  metricGridLabel: {
    fontFamily: Typography.family.medium,
    fontSize: Typography.size.xs,
    color: Colors.gray[600],
    marginBottom: 4,
  },
  metricGridValue: {
    fontFamily: Typography.family.bold,
    fontSize: Typography.size.lg,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingTop: 24,
    paddingHorizontal: 0,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingHorizontal: 24,
  },
  modalTitle: {
    fontSize: Typography.size.xl,
    fontFamily: Typography.family.bold,
    color: Colors.gray[900],
  },
  closeBtn: {
    padding: 8,
    marginRight: -8,
  },
});
