import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  StatusBar, ActivityIndicator, Dimensions
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronRight } from 'lucide-react-native';
import { Colors, Typography, Layout } from '../../constants/Theme';
import { useSubscription } from '../../src/subscription/useSubscription';
import {
  getHistoricalHealthScores,
  getMonthlyRange,
  getDailyRange,
  getWeeklyRange,
  fetchPeriodData,
  computeMetrics,
} from '../../services/reportsEngine';
import { formatCurrency } from '../../utils/currency';
import { format } from 'date-fns';
import { LineChart } from 'react-native-gifted-charts';
import { MiniSparkline } from '../../components/reports/MiniSparkline';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH * 0.62;

export default function ReportsHomeScreen() {
  const { isPremium, isTrialActive } = useSubscription();
  const hasFullAccess = isPremium || isTrialActive;

  const [loading, setLoading] = useState(true);
  const [todaySummary, setTodaySummary] = useState({ expense: 0, income: 0 });
  const [weekSummary, setWeekSummary] = useState({ expense: 0, income: 0, changeVsLast: 0 });
  const [monthSummary, setMonthSummary] = useState({ expense: 0, income: 0, savingsRate: 0 });
  const [recentMonths, setRecentMonths] = useState<{ month: string; score: number; expense: number; income: number; }[]>([]);
  const [healthHistory, setHealthHistory] = useState<{ value: number; label: string }[]>([]);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const now = new Date();

      // Today
      const { startDate: todayStart, endDate: todayEnd } = getDailyRange(now);
      const todayData = await fetchPeriodData(todayStart, todayEnd, 1);
      const todayMetrics = computeMetrics(todayData);
      setTodaySummary({ expense: todayMetrics.totalExpense, income: todayMetrics.totalIncome });

      // This week
      const { startDate: wStart, endDate: wEnd } = getWeeklyRange(now);
      const weekData = await fetchPeriodData(wStart, wEnd, 7);
      const weekMetrics = computeMetrics(weekData);
      setWeekSummary({
        expense: weekMetrics.totalExpense,
        income: weekMetrics.totalIncome,
        changeVsLast: weekMetrics.expenseChange,
      });

      // This month
      const { startDate: mStart, endDate: mEnd, daysInPeriod } = getMonthlyRange(now);
      const monthData = await fetchPeriodData(mStart, mEnd, daysInPeriod);
      const monthMetrics = computeMetrics(monthData);
      setMonthSummary({
        expense: monthMetrics.totalExpense,
        income: monthMetrics.totalIncome,
        savingsRate: monthMetrics.savingsRate,
      });

      // Historical health scores
      const history = await getHistoricalHealthScores(6);
      setRecentMonths(history);
      setHealthHistory(history.map(h => ({
        value: h.score,
        label: format(new Date(h.month + '-01'), 'MMM'),
      })));
    } catch (e) {
      console.error('ReportsHomeScreen loadData error:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!hasFullAccess) {
      router.replace('/paywall');
      return;
    }
    loadData();
  }, []);

  if (!hasFullAccess) return null;

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingCenter}>
          <ActivityIndicator size="large" color={Colors.primary[500]} />
          <Text style={styles.loadingText}>Loading reports...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>Reports</Text>
            <Text style={styles.headerSub}>Your financial intelligence hub</Text>
          </View>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
        </View>

        {/* Current Period Quick Cards */}
        <Text style={styles.sectionLabel}>CURRENT PERIODS</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.quickCardsScroll}
        >
          {/* Today Card */}
          <TouchableOpacity onPress={() => router.push({ pathname: '/reports/daily', params: { date: format(new Date(), 'yyyy-MM-dd') } })} activeOpacity={0.85}>
            <LinearGradient colors={['#E8917A', '#D66A4E']} style={[styles.quickCard, { width: CARD_WIDTH }]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
              <Text style={styles.quickCardLabel}>📅 Today</Text>
              <Text style={styles.quickCardExpense}>{formatCurrency(todaySummary.expense)}</Text>
              <Text style={styles.quickCardSub}>spent today</Text>
              <View style={styles.quickCardRow}>
                <Text style={styles.quickCardIncome}>+{formatCurrency(todaySummary.income)}</Text>
                <Text style={styles.quickCardLink}>View Report →</Text>
              </View>
            </LinearGradient>
          </TouchableOpacity>

          {/* This Week Card */}
          <TouchableOpacity onPress={() => router.push({ pathname: '/reports/weekly', params: { date: format(new Date(), 'yyyy-MM-dd') } })} activeOpacity={0.85}>
            <LinearGradient colors={['#4D966F', '#377A55']} style={[styles.quickCard, { width: CARD_WIDTH }]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
              <Text style={styles.quickCardLabel}>📊 This Week</Text>
              <Text style={styles.quickCardExpense}>{formatCurrency(weekSummary.expense)}</Text>
              <Text style={styles.quickCardSub}>spent this week</Text>
              <View style={styles.quickCardRow}>
                <Text style={styles.quickCardIncome}>
                  {weekSummary.changeVsLast > 0 ? '▲' : '▼'} {Math.abs(weekSummary.changeVsLast).toFixed(0)}% vs last
                </Text>
                <Text style={styles.quickCardLink}>View Report →</Text>
              </View>
            </LinearGradient>
          </TouchableOpacity>

          {/* This Month Card */}
          <TouchableOpacity onPress={() => router.push({ pathname: '/reports/monthly', params: { date: format(new Date(), 'yyyy-MM-dd') } })} activeOpacity={0.85}>
            <LinearGradient colors={['#3B82F6', '#1D4ED8']} style={[styles.quickCard, { width: CARD_WIDTH }]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
              <Text style={styles.quickCardLabel}>📆 This Month</Text>
              <Text style={styles.quickCardExpense}>{monthSummary.savingsRate.toFixed(0)}%</Text>
              <Text style={styles.quickCardSub}>savings rate</Text>
              <View style={styles.quickCardRow}>
                <Text style={styles.quickCardIncome}>{formatCurrency(monthSummary.expense)} spent</Text>
                <Text style={styles.quickCardLink}>View Report →</Text>
              </View>
            </LinearGradient>
          </TouchableOpacity>
        </ScrollView>

        {/* Health Timeline Chart */}
        {healthHistory.length > 1 && (
          <View style={styles.healthCard}>
            <Text style={styles.healthTitle}>Financial Health Over Time</Text>
            <Text style={styles.healthSub}>Your score trend for the last 6 months</Text>
            <LineChart
              data={healthHistory}
              width={SCREEN_WIDTH - 64}
              height={120}
              color={Colors.primary[500]}
              thickness={3}
              dataPointsColor={Colors.primary[700]}
              startFillColor={Colors.primary[200]}
              endFillColor={Colors.primary[50]}
              startOpacity={0.6}
              endOpacity={0.1}
              areaChart
              isAnimated
              curved
              initialSpacing={16}
              noOfSections={3}
              maxValue={100}
              yAxisThickness={0}
              rulesType="solid"
              rulesColor={Colors.gray[200]}
              xAxisLabelTextStyle={{ color: Colors.gray[500], fontSize: 10, fontFamily: Typography.family.bold }}
              yAxisTextStyle={{ color: Colors.gray[500], fontSize: 10 }}
            />
          </View>
        )}

        {/* Recent Reports List */}
        <Text style={styles.sectionLabel}>PREVIOUS MONTHS</Text>
        {recentMonths.slice().reverse().map((m) => {
          const monthDate = new Date(m.month + '-01');
          const grade = m.score >= 80 ? 'A' : m.score >= 65 ? 'B' : m.score >= 50 ? 'C' : 'D';
          const gradeColor = m.score >= 80 ? Colors.success[600] : m.score >= 65 ? Colors.primary[600] : m.score >= 50 ? Colors.warning[600] : Colors.danger[600];
          const netSavings = m.income - m.expense;
          const monthSparkData = [m.score * 0.8, m.score * 0.9, m.score, m.score * 1.05, m.score * 0.95, m.score];

          return (
            <TouchableOpacity
              key={m.month}
              style={styles.recentRow}
              onPress={() => router.push({ pathname: '/reports/monthly', params: { date: m.month + '-01' } })}
              activeOpacity={0.7}
            >
              <View style={styles.recentLeft}>
                <Text style={styles.recentMonth}>{format(monthDate, 'MMMM yyyy')}</Text>
                <Text style={styles.recentSummary}>
                  {formatCurrency(m.expense)} spent · {formatCurrency(Math.max(0, netSavings))} saved
                </Text>
              </View>
              <MiniSparkline data={monthSparkData} color={Colors.primary[500]} width={50} height={20} />
              <View style={[styles.gradeBadge, { backgroundColor: gradeColor + '20', borderColor: gradeColor }]}>
                <Text style={[styles.gradeText, { color: gradeColor }]}>{grade}</Text>
              </View>
              <ChevronRight size={16} color={Colors.gray[400]} />
            </TouchableOpacity>
          );
        })}

        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.gray[50] },
  content: { padding: Layout.spacing.lg },
  loadingCenter: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 12, color: Colors.gray[500], fontFamily: Typography.family.regular },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 },
  headerTitle: { fontSize: Typography.size.xxxl, fontFamily: Typography.family.bold, color: Colors.gray[900] },
  headerSub: { fontSize: Typography.size.sm, fontFamily: Typography.family.regular, color: Colors.gray[500], marginTop: 2 },
  backBtn: { paddingVertical: 6, paddingHorizontal: 12 },
  backText: { fontSize: Typography.size.sm, fontFamily: Typography.family.bold, color: Colors.primary[600] },
  sectionLabel: { fontSize: 11, fontFamily: Typography.family.bold, color: Colors.gray[400], letterSpacing: 1, textTransform: 'uppercase', marginBottom: 12 },
  quickCardsScroll: { gap: 12, paddingBottom: 8, marginBottom: 24 },
  quickCard: { borderRadius: Layout.radius.xl, padding: 20, ...Layout.shadows.lg },
  quickCardLabel: { fontSize: Typography.size.sm, fontFamily: Typography.family.bold, color: 'rgba(255,255,255,0.8)', marginBottom: 8 },
  quickCardExpense: { fontSize: Typography.size.xxl, fontFamily: Typography.family.bold, color: Colors.white },
  quickCardSub: { fontSize: Typography.size.xs, color: 'rgba(255,255,255,0.7)', marginBottom: 12 },
  quickCardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  quickCardIncome: { fontSize: Typography.size.xs, fontFamily: Typography.family.medium, color: 'rgba(255,255,255,0.9)' },
  quickCardLink: { fontSize: 11, fontFamily: Typography.family.bold, color: Colors.white },
  healthCard: { backgroundColor: Colors.white, borderRadius: Layout.radius.xl, padding: 20, marginBottom: 24, ...Layout.shadows.sm },
  healthTitle: { fontSize: Typography.size.md, fontFamily: Typography.family.bold, color: Colors.gray[900], marginBottom: 4 },
  healthSub: { fontSize: Typography.size.xs, fontFamily: Typography.family.regular, color: Colors.gray[500], marginBottom: 12 },
  recentRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.white, borderRadius: Layout.radius.lg, padding: 16, marginBottom: 10, ...Layout.shadows.sm },
  recentLeft: { flex: 1 },
  recentMonth: { fontSize: Typography.size.md, fontFamily: Typography.family.bold, color: Colors.gray[900] },
  recentSummary: { fontSize: Typography.size.xs, fontFamily: Typography.family.regular, color: Colors.gray[500], marginTop: 2 },
  gradeBadge: { width: 32, height: 32, borderRadius: 8, borderWidth: 1.5, justifyContent: 'center', alignItems: 'center', marginHorizontal: 10 },
  gradeText: { fontSize: Typography.size.sm, fontFamily: Typography.family.bold },
});
