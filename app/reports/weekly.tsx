import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, StatusBar,
  TouchableOpacity, ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowLeft } from 'lucide-react-native';
import { CustomBarChart } from '../../components/reports/CustomBarChart';
import { format, addDays, subWeeks } from 'date-fns';
import { Colors, Typography, Layout } from '../../constants/Theme';
import {
  fetchPeriodData, computeMetrics, generateInsights,
  PeriodData, ComputedMetrics, Insight, getWeeklyRange, getCategoryColor
} from '../../services/reportsEngine';
import { PeriodSelector, PeriodType } from '../../components/reports/PeriodSelector';
import { ReportCard } from '../../components/reports/ReportCard';
import { InsightCard } from '../../components/reports/InsightCard';
import { HeatMapGrid } from '../../components/reports/HeatMapGrid';
import { CashFlowWaterfall } from '../../components/reports/CashFlowWaterfall';
import { SpendingRadar } from '../../components/reports/SpendingRadar';
import { formatCurrency } from '../../utils/currency';
import { safeDivide } from '../../utils/mathUtils';


export default function ReportsWeeklyScreen() {
  const params = useLocalSearchParams<{ date?: string }>();
  const initialDate = params.date ? new Date(params.date) : new Date();

  const [periodType, setPeriodType] = useState<PeriodType>('weekly');
  const [currentDate, setCurrentDate] = useState(initialDate);
  const [loading, setLoading] = useState(true);
  const [periodData, setPeriodData] = useState<PeriodData | null>(null);
  const [metrics, setMetrics] = useState<ComputedMetrics | null>(null);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [lastWeekData, setLastWeekData] = useState<PeriodData | null>(null);

  const loadData = useCallback(async (date: Date) => {
    setLoading(true);
    try {
      const range = getWeeklyRange(date);
      const data = await fetchPeriodData(range.startDate, range.endDate, range.daysInPeriod);
      const m = computeMetrics(data);
      const ins = generateInsights(m, data, 'week');

      // Also load last week for radar comparison
      const lastWeekRange = getWeeklyRange(subWeeks(date, 1));
      const lastData = await fetchPeriodData(lastWeekRange.startDate, lastWeekRange.endDate, 7);

      setPeriodData(data);
      setMetrics(m);
      setInsights(ins);
      setLastWeekData(lastData);
    } catch (e) {
      console.error('weekly loadData error:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData(currentDate);
  }, [currentDate]);

  const handlePeriodTypeChange = (type: PeriodType) => {
    if (type === 'daily') router.replace({ pathname: '/reports/daily', params: { date: format(currentDate, 'yyyy-MM-dd') } });
    else if (type === 'monthly') router.replace({ pathname: '/reports/monthly', params: { date: format(currentDate, 'yyyy-MM-dd') } });
    setPeriodType(type);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={Colors.primary[500]} />
        </View>
      </SafeAreaView>
    );
  }

  const range = getWeeklyRange(currentDate);
  const isPositive = metrics ? metrics.netSavings >= 0 : true;

  // Build 7-day bar data
  const day = currentDate.getDay();
  const diff = currentDate.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(currentDate);
  monday.setDate(diff);

  const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const sevenDayData = dayLabels.map((label, i) => {
    const d = addDays(monday, i);
    const dateStr = d.toISOString().split('T')[0];
    const dayAgg = periodData?.dailyAggregates.find(a => a.date === dateStr);
    return { label, expense: dayAgg?.expense ?? 0, income: dayAgg?.income ?? 0 };
  });

  // Build 7-day grouped bar data for CustomBarChart
  const barGroups = sevenDayData.map(d => ({
    label: d.label,
    bars: [
      { value: d.income, color: Colors.success[500] },
      { value: d.expense, color: Colors.danger[500] },
    ],
  }));
  const maxWeeklyVal = Math.max(...sevenDayData.flatMap(d => [d.expense, d.income]), 100);

  // Heatmap data
  const periods = ['Morning', 'Afternoon', 'Evening', 'Night'];
  const heatmapData = periods.flatMap(period => dayLabels.map((day, dIdx) => {
    const d = addDays(monday, dIdx);
    const dateStr = d.toISOString().split('T')[0];
    const txsForDay = periodData?.transactions.filter(t => {
      const txDate = t.date.split('T')[0];
      const hour = new Date(t.created_at).getHours();
      const inPeriod = period === 'Morning' ? (hour >= 6 && hour < 12)
        : period === 'Afternoon' ? (hour >= 12 && hour < 18)
        : period === 'Evening' ? (hour >= 18 && hour < 22)
        : (hour >= 22 || hour < 6);
      return txDate === dateStr && t.category !== 'Income' && inPeriod;
    }) ?? [];
    const amount = txsForDay.reduce((s, t) => s + t.amount, 0);
    return { day, period, amount, txCount: txsForDay.length };
  }));

  // Radar data
  const ALL_CATS = ['Food', 'Transport', 'Shopping', 'Bills', 'Entertainment', 'Health'];
  const radarData = ALL_CATS.map(cat => {
    const thisAmt = periodData?.categoryBreakdown.find(c => c.name === cat)?.total ?? 0;
    const lastAmt = lastWeekData?.categoryBreakdown.find(c => c.name === cat)?.total ?? 0;
    const maxAmt = Math.max(thisAmt, lastAmt, 1);
    return {
      label: cat,
      thisValue: safeDivide(thisAmt, maxAmt, 0) * 100,
      lastValue: safeDivide(lastAmt, maxAmt, 0) * 100,
    };
  });

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

      <View style={styles.topNav}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft size={22} color={Colors.gray[800]} />
        </TouchableOpacity>
        <Text style={styles.navTitle}>Weekly Report</Text>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} scrollEventThrottle={16} showsVerticalScrollIndicator={false}>

        <PeriodSelector
          periodType={periodType}
          currentDate={currentDate}
          onPeriodTypeChange={handlePeriodTypeChange}
          onDateChange={setCurrentDate}
        />

        {/* ── SECTION 1: WEEK HERO ─────────────────── */}
        <LinearGradient
          colors={isPositive ? ['#4D966F', '#265E3F'] : ['#D44D4D', '#8F2626']}
          style={styles.heroCard}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        >
          <View style={styles.decCircle1} />
          <Text style={styles.heroWeekLabel}>
            {format(new Date(range.startDate + 'T00:00:00'), 'dd MMM')} – {format(new Date(range.endDate + 'T00:00:00'), 'dd MMM yyyy')}
          </Text>

          <View style={styles.heroRow}>
            {/* Circular Savings Rate */}
            <View style={styles.savingsRingContainer}>
              <View style={styles.savingsRing}>
                <Text style={styles.savingsRingValue} adjustsFontSizeToFit numberOfLines={1}>{metrics?.savingsRate.toFixed(0) ?? '0'}%</Text>
                <Text style={styles.savingsRingLabel}>Savings</Text>
              </View>
            </View>

            {/* Stats */}
            <View style={styles.heroStats}>
              <Text style={styles.heroStatLabel}>💰 Income</Text>
              <Text style={styles.heroStatValue}>{formatCurrency(metrics?.totalIncome ?? 0)}</Text>
              <Text style={styles.heroStatLabel}>💸 Expense</Text>
              <Text style={styles.heroStatValue}>{formatCurrency(metrics?.totalExpense ?? 0)}</Text>
              {metrics && metrics.expenseChange !== 0 && (
                <Text style={styles.heroChangeText} adjustsFontSizeToFit numberOfLines={1}>
                  {metrics.expenseChange > 0 ? '▲' : '▼'} {Math.abs(metrics.expenseChange).toFixed(0)}% vs last week
                </Text>
              )}
            </View>
          </View>
        </LinearGradient>

        {/* ── SECTION 2: 7-DAY BAR CHART ─────────── */}
        <ReportCard title="Daily Spending This Week" subtitle="Income (green) vs Expense (red)">
          <View style={{ marginTop: 8 }}>
            <CustomBarChart groups={barGroups} height={150} />
          </View>
          <View style={styles.barLegend}>
            <View style={[styles.legendDot, { backgroundColor: Colors.success[500] }]} />
            <Text style={styles.legendText}>Income</Text>
            <View style={[styles.legendDot, { backgroundColor: Colors.danger[500], marginLeft: 12 }]} />
            <Text style={styles.legendText}>Expense</Text>
          </View>
        </ReportCard>

        {/* ── SECTION 3: CATEGORY PERFORMANCE ───── */}
        <ReportCard title="Category Performance" subtitle="Top spending categories this week">
          {periodData?.categoryBreakdown.slice(0, 8).map((cat) => {
            const prevCat = lastWeekData?.categoryBreakdown.find(c => c.name === cat.name);
            const change = prevCat ? safeDivide(cat.total - prevCat.total, prevCat.total, 0) * 100 : 0;
            const maxTotal = periodData.categoryBreakdown[0]?.total ?? 1;
            const widthPct = safeDivide(cat.total, maxTotal, 0) * 100;

            return (
              <View key={cat.name} style={styles.catPerfRow}>
                <Text style={styles.catPerfName} numberOfLines={1}>{cat.name}</Text>
                <View style={styles.catPerfBar}>
                  <View style={[styles.catPerfFill, { width: `${widthPct}%`, backgroundColor: getCategoryColor(cat.name) }]} />
                </View>
                <Text style={styles.catPerfAmt}>{formatCurrency(Math.round(cat.total))}</Text>
                {prevCat && (
                  <Text style={[styles.catPerfChange, { color: change > 0 ? Colors.danger[500] : Colors.success[500] }]} adjustsFontSizeToFit numberOfLines={1}>
                    {change > 0 ? '▲' : '▼'} {Math.abs(change).toFixed(0)}%
                  </Text>
                )}
              </View>
            );
          })}
        </ReportCard>

        {/* ── SECTION 4: HEATMAP ──────────────────── */}
        <ReportCard title="Spending Heatmap" subtitle="Amount by day and time of day">
          <HeatMapGrid data={heatmapData} />
        </ReportCard>

        {/* ── SECTION 5: CASH FLOW WATERFALL ─────── */}
        <ReportCard title="Cash Flow Analysis" subtitle="How money flowed this week">
          <CashFlowWaterfall
            startBalance={0}
            income={metrics?.totalIncome ?? 0}
            expense={metrics?.totalExpense ?? 0}
          />
        </ReportCard>

        {/* ── SECTION 6: RADAR CHART ──────────────── */}
        {radarData.some(d => d.thisValue > 0 || d.lastValue > 0) && (
          <ReportCard title="This Week vs Last Week" subtitle="Category spending comparison">
            <View style={{ alignItems: 'center' }}>
              <SpendingRadar data={radarData} size={220} />
            </View>
          </ReportCard>
        )}

        {/* ── SECTION 7: INSIGHTS ─────────────────── */}
        {insights.length > 0 && (
          <ReportCard title="📊 Weekly Insights">
            {insights.map((insight, i) => (
              <InsightCard key={i} insight={insight} index={i} />
            ))}
          </ReportCard>
        )}

        {/* ── SECTION 8: NEXT WEEK FORECAST ────────  */}
        <LinearGradient colors={[Colors.primary[500] + '33', Colors.primary[50]]} style={styles.forecastCard} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
          <Text style={styles.forecastTitle}>🔮 Next Week Forecast</Text>
          <Text style={styles.forecastBody}>
            Based on your spending patterns this week:{'\n\n'}
            📊 Expected Expense: {formatCurrency(Math.round((metrics?.totalExpense ?? 0) * 1.05))}{'\n'}
            📈 Recommended Daily Budget: {formatCurrency(Math.round((metrics?.avgDailyExpense ?? 0) * 0.95))}{'\n\n'}
            {metrics?.topCategory ? `💡 Focus area: ${metrics.topCategory.name}` : ''}
          </Text>
          <Text style={styles.forecastDisclaimer}>Prediction based on spending history</Text>
        </LinearGradient>

        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.gray[50] },
  content: { padding: Layout.spacing.md },
  topNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Layout.spacing.md, paddingVertical: 12 },
  backBtn: { padding: 8 },
  navTitle: { fontSize: Typography.size.lg, fontFamily: Typography.family.bold, color: Colors.gray[900] },

  // Hero
  heroCard: { borderRadius: 24, padding: 20, marginBottom: Layout.spacing.md, overflow: 'hidden', ...Layout.shadows.lg },
  decCircle1: { position: 'absolute', top: -20, right: -20, width: 120, height: 120, borderRadius: 60, backgroundColor: 'rgba(255,255,255,0.08)' },
  heroWeekLabel: { fontSize: 11, fontFamily: Typography.family.bold, color: 'rgba(255,255,255,0.7)', marginBottom: 16, letterSpacing: 0.5 },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: 20 },
  savingsRingContainer: { alignItems: 'center' },
  savingsRing: { width: 110, height: 110, borderRadius: 55, borderWidth: 6, borderColor: 'rgba(255,255,255,0.6)', justifyContent: 'center', alignItems: 'center' },
  savingsRingValue: { fontSize: 28, fontFamily: Typography.family.bold, color: Colors.white, width: '80%', textAlign: 'center' },
  savingsRingLabel: { fontSize: 11, color: 'rgba(255,255,255,0.7)' },
  heroStats: { flex: 1 },
  heroStatLabel: { fontSize: 11, color: 'rgba(255,255,255,0.7)', marginTop: 6 },
  heroStatValue: { fontSize: 18, fontFamily: Typography.family.bold, color: Colors.white, marginBottom: 2 },
  heroChangeText: { fontSize: 11, fontFamily: Typography.family.bold, color: 'rgba(255,255,255,0.8)', marginTop: 8 },

  // Category Performance
  catPerfRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  catPerfName: { width: 70, fontSize: 11, fontFamily: Typography.family.medium, color: Colors.gray[700] },
  catPerfBar: { flex: 1, height: 8, backgroundColor: Colors.gray[100], borderRadius: 4, marginHorizontal: 8 },
  catPerfFill: { height: 8, borderRadius: 4 },
  catPerfAmt: { width: 60, fontSize: 11, fontFamily: Typography.family.bold, color: Colors.gray[900], textAlign: 'right' },
  catPerfChange: { minWidth: 44, maxWidth: 54, fontSize: 10, fontFamily: Typography.family.bold, textAlign: 'right' },

  // Forecast
  forecastCard: { borderRadius: 20, padding: 20, marginBottom: Layout.spacing.md, borderWidth: 1, borderColor: Colors.primary[500] + '40' },
  forecastTitle: { fontSize: Typography.size.md, fontFamily: Typography.family.bold, color: Colors.primary[700], marginBottom: 12 },
  forecastBody: { fontSize: Typography.size.sm, fontFamily: Typography.family.regular, color: Colors.gray[700], lineHeight: 22 },
  forecastDisclaimer: { fontSize: 10, color: Colors.gray[400], marginTop: 12, fontStyle: 'italic' },

  // Bar chart legend
  barLegend: { flexDirection: 'row', alignItems: 'center', marginTop: 8, paddingLeft: 44 },
  legendDot: { width: 8, height: 8, borderRadius: 4, marginRight: 4 },
  legendText: { fontSize: 11, color: Colors.gray[500], fontFamily: Typography.family.regular },
});
