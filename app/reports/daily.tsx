import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, StatusBar,
  TouchableOpacity, ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowLeft } from 'lucide-react-native';
import { PieChart } from 'react-native-gifted-charts';
import { HourBarChart } from '../../components/reports/CustomBarChart';
import { format } from 'date-fns';
import { Colors, Typography, Layout } from '../../constants/Theme';
import {
  fetchPeriodData, computeMetrics, generateInsights,
  PeriodData, ComputedMetrics, Insight, getDailyRange,
  getWeeklyRange, getMonthlyRange, getCategoryColor
} from '../../services/reportsEngine';
import { PeriodSelector, PeriodType } from '../../components/reports/PeriodSelector';
import { ReportCard } from '../../components/reports/ReportCard';
import { InsightCard } from '../../components/reports/InsightCard';
import { formatCurrency } from '../../utils/currency';
import { safeDivide } from '../../utils/mathUtils';


const DAILY_TIPS: { [key: number]: string } = {
  1: "The 24-hour rule: Wait 24 hours before any non-essential purchase over ₹500. Most impulse buys get reconsidered.",
  2: "Automate your savings. Set up an automatic transfer on salary day so you save before you can spend.",
  3: "The Latte Factor: Small daily spends add up fast. Even ₹50/day = ₹18,250 per year.",
  4: "The 50/30/20 rule: 50% needs, 30% wants, 20% savings. Review your category breakdown to see where you stand.",
  5: "Weekend warning: Spending tends to spike on weekends. Set a weekend budget before Friday evening.",
  6: "Review your week's spending. Small reductions compound into real wealth over years.",
  0: "The 50/30/20 rule: 50% needs, 30% wants, 20% savings. Check how your today's split compares.",
};

export default function ReportsDailyScreen() {
  const params = useLocalSearchParams<{ date?: string }>();
  const initialDate = params.date ? new Date(params.date) : new Date();

  const [periodType, setPeriodType] = useState<PeriodType>('daily');
  const [currentDate, setCurrentDate] = useState(initialDate);
  const [loading, setLoading] = useState(true);
  const [periodData, setPeriodData] = useState<PeriodData | null>(null);
  const [metrics, setMetrics] = useState<ComputedMetrics | null>(null);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [selectedCatIndex, setSelectedCatIndex] = useState<number | null>(null);

  const scrollRef = useRef<ScrollView>(null);

  const loadData = useCallback(async (date: Date, type: PeriodType) => {
    setLoading(true);
    try {
      let range;
      if (type === 'daily') range = getDailyRange(date);
      else if (type === 'weekly') range = getWeeklyRange(date);
      else range = getMonthlyRange(date);

      const data = await fetchPeriodData(range.startDate, range.endDate, range.daysInPeriod);
      const m = computeMetrics(data);
      const ins = generateInsights(m, data, type === 'daily' ? 'day' : type === 'weekly' ? 'week' : 'month');
      setPeriodData(data);
      setMetrics(m);
      setInsights(ins);
    } catch (e) {
      console.error('daily loadData error:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData(currentDate, periodType);
  }, [currentDate, periodType]);

  const handlePeriodTypeChange = (type: PeriodType) => {
    setPeriodType(type);
    if (type === 'weekly') {
      router.replace({ pathname: '/reports/weekly', params: { date: format(currentDate, 'yyyy-MM-dd') } });
    } else if (type === 'monthly') {
      router.replace({ pathname: '/reports/monthly', params: { date: format(currentDate, 'yyyy-MM-dd') } });
    }
  };



  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingCenter}>
          <ActivityIndicator size="large" color={Colors.primary[500]} />
        </View>
      </SafeAreaView>
    );
  }

  const isPositive = metrics ? metrics.netSavings >= 0 : true;
  const heroGradient = isPositive
    ? ['#4D966F', '#265E3F'] as [string, string]
    : ['#D44D4D', '#8F2626'] as [string, string];

  const pieData = periodData?.categoryBreakdown.map((cat, i) => ({
    value: cat.total,
    color: getCategoryColor(cat.name),
    text: cat.name,
    focused: selectedCatIndex === i,
  })) ?? [];

  const hourItems = periodData?.hourDistribution.map(h => ({
    hour: `${parseInt(h.hour)}`,
    value: h.total,
    color: parseInt(h.hour) < 12 ? '#F97316' : parseInt(h.hour) < 18 ? Colors.primary[500] : parseInt(h.hour) < 22 ? '#8B5CF6' : '#1E3A5F',
  })) ?? [];

  const dayOfWeek = currentDate.getDay();
  const dailyTip = DAILY_TIPS[dayOfWeek] ?? DAILY_TIPS[1];

  // Group transactions by period of day
  const groupedTransactions = {
    Morning: periodData?.transactions.filter(t => {
      const h = new Date(t.created_at).getHours();
      return h >= 6 && h < 12;
    }) ?? [],
    Afternoon: periodData?.transactions.filter(t => {
      const h = new Date(t.created_at).getHours();
      return h >= 12 && h < 18;
    }) ?? [],
    Evening: periodData?.transactions.filter(t => {
      const h = new Date(t.created_at).getHours();
      return h >= 18 && h < 22;
    }) ?? [],
    Night: periodData?.transactions.filter(t => {
      const h = new Date(t.created_at).getHours();
      return h >= 22 || h < 6;
    }) ?? [],
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

      {/* Top Nav */}
      <View style={styles.topNav}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft size={22} color={Colors.gray[800]} />
        </TouchableOpacity>
        <Text style={styles.navTitle}>Financial Report</Text>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView ref={scrollRef} contentContainerStyle={styles.content} scrollEventThrottle={16} showsVerticalScrollIndicator={false}>

        {/* Period Selector */}
        <PeriodSelector
          periodType={periodType}
          currentDate={currentDate}
          onPeriodTypeChange={handlePeriodTypeChange}
          onDateChange={setCurrentDate}
        />

        {/* ── SECTION 1: DAILY HERO CARD ─────────────── */}
        <LinearGradient colors={heroGradient} style={styles.heroCard} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
          {/* Decorative circles */}
          <View style={styles.decCircle1} />
          <View style={styles.decCircle2} />

          {/* Comparison badge */}
          {metrics && metrics.prevExpense > 0 && (
            <View style={[styles.compBadge, { backgroundColor: metrics.expenseChange > 0 ? 'rgba(239,68,68,0.3)' : 'rgba(16,185,129,0.3)' }]}>
              <Text style={styles.compBadgeText}>
                {metrics.expenseChange > 0 ? '▲' : '▼'} {Math.abs(metrics.expenseChange).toFixed(0)}% vs yesterday
              </Text>
            </View>
          )}

          <Text style={styles.heroDate}>
            {format(currentDate, 'EEEE, d MMMM yyyy').toUpperCase()}
          </Text>

          <Text style={styles.heroAmount}>
            {metrics ? (metrics.netSavings >= 0 ? '+' : '') + formatCurrency(Math.round(metrics.netSavings)) : '—'}
          </Text>
          <Text style={styles.heroSubtitle}>
            {metrics ? (metrics.netSavings >= 0 ? 'Saved today' : 'Overspent today') : ''}
          </Text>

          {/* Mini stats row */}
          <View style={styles.miniStatsRow}>
            <View style={styles.miniStat}>
              <Text style={styles.miniStatEmoji}>💸</Text>
              <Text style={styles.miniStatVal}>{formatCurrency(metrics?.totalExpense ?? 0)}</Text>
            </View>
            <View style={styles.miniStat}>
              <Text style={styles.miniStatEmoji}>💰</Text>
              <Text style={styles.miniStatVal}>{formatCurrency(metrics?.totalIncome ?? 0)}</Text>
            </View>
            <View style={styles.miniStat}>
              <Text style={styles.miniStatEmoji}>📝</Text>
              <Text style={styles.miniStatVal}>{metrics?.transactionCount ?? 0} txns</Text>
            </View>
          </View>
        </LinearGradient>

        {/* ── SECTION 2: 24-HOUR TIMELINE ───────────── */}
        {hourItems.length > 0 && (
          <ReportCard title="Spending Timeline" subtitle="Expense distribution by hour">
            <View style={{ marginTop: 8 }}>
              <HourBarChart data={hourItems} height={130} />
            </View>
          </ReportCard>
        )}

        {/* ── SECTION 3: EXPENSE DONUT ──────────────── */}
        {pieData.length > 0 && (
          <ReportCard title="Where Did Money Go?" subtitle="Category breakdown">
            <View style={styles.donutWrapper}>
              <PieChart
                data={pieData}
                donut
                radius={90}
                innerRadius={50}
                focusOnPress
                centerLabelComponent={() => (
                  <View style={{ alignItems: 'center' }}>
                    <Text style={styles.donutCenter}>{formatCurrency(metrics?.totalExpense ?? 0)}</Text>
                    <Text style={styles.donutCenterSub}>Total Spent</Text>
                  </View>
                )}
              />
            </View>
            {/* Category Legend */}
            {periodData?.categoryBreakdown.map((cat, i) => {
              const pct = safeDivide(cat.total, metrics?.totalExpense ?? 1, 0) * 100;
              return (
                <TouchableOpacity key={cat.name} style={styles.catLegendRow} onPress={() => setSelectedCatIndex(selectedCatIndex === i ? null : i)}>
                  <View style={[styles.catDot, { backgroundColor: getCategoryColor(cat.name) }]} />
                  <Text style={styles.catLegendName}>{cat.name}</Text>
                  <View style={styles.catBarWrapper}>
                    <View style={[styles.catBar, { width: `${pct}%`, backgroundColor: getCategoryColor(cat.name) }]} />
                  </View>
                  <View style={styles.catRight}>
                    <Text style={styles.catLegendAmt} numberOfLines={1}>{formatCurrency(Math.round(cat.total))}</Text>
                    <Text style={styles.catLegendPct}>{pct.toFixed(0)}%</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </ReportCard>
        )}

        {/* ── SECTION 4: TRANSACTION TIMELINE ──────── */}
        {periodData && periodData.transactions.length > 0 && (
          <ReportCard title="All Transactions" subtitle={`${periodData.transactions.length} transactions today`}>
            {(['Morning', 'Afternoon', 'Evening', 'Night'] as const).map(period => {
              const txs = groupedTransactions[period];
              if (txs.length === 0) return null;
              const groupTotal = txs.filter(t => t.category !== 'Income').reduce((s, t) => s + t.amount, 0);
              return (
                <View key={period}>
                  <View style={styles.timeGroupHeader}>
                    <Text style={styles.timeGroupTitle}>{period} • {formatCurrency(Math.round(groupTotal))}</Text>
                  </View>
                  <View style={styles.timelineContainer}>
                    <View style={styles.timelineLine} />
                    {txs.map(tx => (
                      <TouchableOpacity
                        key={tx.id}
                        style={styles.txItem}
                        onPress={() => router.push({ pathname: '/edit-transaction', params: { id: tx.id } })}
                        activeOpacity={0.7}
                      >
                        <View style={[styles.txDot, { backgroundColor: getCategoryColor(tx.category) }]} />
                        <View style={styles.txInfo}>
                          <Text style={styles.txTime}>{format(new Date(tx.created_at), 'h:mm a')}</Text>
                          <Text style={styles.txDesc}>{tx.description || tx.category}</Text>
                          <View style={styles.txMeta}>
                            <View style={[styles.txCategoryChip, { backgroundColor: getCategoryColor(tx.category) + '20' }]}>
                              <Text style={[styles.txCategoryText, { color: getCategoryColor(tx.category) }]}>{tx.subcategory || tx.category}</Text>
                            </View>
                          </View>
                        </View>
                        <Text style={[styles.txAmount, { color: tx.category === 'Income' ? Colors.success[600] : Colors.danger[600] }]}>
                          {tx.category === 'Income' ? '+' : '-'}{formatCurrency(Math.round(tx.amount))}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              );
            })}
          </ReportCard>
        )}

        {/* ── SECTION 5: DAILY INSIGHTS ─────────────── */}
        {insights.length > 0 && (
          <ReportCard title="💡 Today's Insights">
            {insights.slice(0, 3).map((insight, i) => (
              <InsightCard key={i} insight={insight} index={i} />
            ))}
          </ReportCard>
        )}

        {/* ── SECTION 6: FINANCIAL TIP ──────────────── */}
        <LinearGradient colors={[Colors.primary[500], Colors.primary[700]]} style={styles.tipCard} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
          <Text style={styles.tipEmoji}>📚</Text>
          <Text style={styles.tipTitle}>Financial Tip of the Day</Text>
          <Text style={styles.tipBody}>{dailyTip}</Text>
        </LinearGradient>

        {/* Empty State */}
        {periodData?.transactions.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>💸</Text>
            <Text style={styles.emptyTitle}>No transactions today</Text>
            <Text style={styles.emptySub}>Your spending and income for this day will appear here</Text>
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.gray[50] },
  content: { padding: Layout.spacing.md },
  loadingCenter: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  topNav: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Layout.spacing.md, paddingVertical: 12,
  },
  backBtn: { padding: 8 },
  navTitle: { fontSize: Typography.size.lg, fontFamily: Typography.family.bold, color: Colors.gray[900] },

  // Hero Card
  heroCard: {
    borderRadius: 24, padding: 20, marginBottom: Layout.spacing.md,
    overflow: 'hidden', ...Layout.shadows.lg,
  },
  decCircle1: { position: 'absolute', top: -20, right: -20, width: 120, height: 120, borderRadius: 60, backgroundColor: 'rgba(255,255,255,0.08)' },
  decCircle2: { position: 'absolute', bottom: -40, left: 10, width: 100, height: 100, borderRadius: 50, backgroundColor: 'rgba(255,255,255,0.06)' },
  compBadge: { position: 'absolute', top: 16, right: 16, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  compBadgeText: { fontSize: 11, fontFamily: Typography.family.bold, color: Colors.white },
  heroDate: { fontSize: 10, fontFamily: Typography.family.bold, color: 'rgba(255,255,255,0.7)', letterSpacing: 1.2, marginBottom: 8 },
  heroAmount: { fontSize: 40, fontFamily: Typography.family.bold, color: Colors.white, marginBottom: 4 },
  heroSubtitle: { fontSize: Typography.size.sm, color: 'rgba(255,255,255,0.8)', marginBottom: 20 },
  miniStatsRow: { flexDirection: 'row', gap: 10 },
  miniStat: { flex: 1, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 10, padding: 10, alignItems: 'center' },
  miniStatEmoji: { fontSize: 16, marginBottom: 2 },
  miniStatVal: { fontSize: 11, fontFamily: Typography.family.bold, color: Colors.white },

  // Charts
  chartWrapper: { alignItems: 'center', marginVertical: 8 },
  donutWrapper: { alignItems: 'center', marginBottom: 16 },
  donutCenter: { fontSize: 16, fontFamily: Typography.family.bold, color: Colors.gray[900] },
  donutCenterSub: { fontSize: 10, color: Colors.gray[500] },

  // Category Legend
  catLegendRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Colors.gray[100] },
  catDot: { width: 10, height: 10, borderRadius: 5, marginRight: 8 },
  catLegendName: { width: 80, fontSize: 12, fontFamily: Typography.family.medium, color: Colors.gray[700] },
  catBarWrapper: { flex: 1, height: 4, backgroundColor: Colors.gray[100], borderRadius: 2, marginHorizontal: 8 },
  catBar: { height: 4, borderRadius: 2 },
  catRight: { flexDirection: 'row', alignItems: 'center', width: 95, justifyContent: 'flex-end' },
  catLegendAmt: { fontSize: 12, fontFamily: Typography.family.bold, color: Colors.gray[900], marginRight: 6 },
  catLegendPct: { width: 34, fontSize: 11, color: Colors.gray[500], textAlign: 'right' },

  // Transaction Timeline
  timeGroupHeader: { paddingVertical: 8, paddingHorizontal: 4, marginTop: 4 },
  timeGroupTitle: { fontSize: 11, fontFamily: Typography.family.bold, color: Colors.gray[500], textTransform: 'uppercase', letterSpacing: 0.5 },
  timelineContainer: { paddingLeft: 16, position: 'relative' },
  timelineLine: { position: 'absolute', left: 20, top: 0, bottom: 0, width: 1, backgroundColor: Colors.gray[200] },
  txItem: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 10, paddingLeft: 16, borderRadius: 8 },
  txDot: { width: 10, height: 10, borderRadius: 5, marginRight: 12, marginTop: 3, position: 'absolute', left: -5 },
  txInfo: { flex: 1 },
  txTime: { fontSize: 10, color: Colors.gray[400], marginBottom: 2 },
  txDesc: { fontSize: Typography.size.sm, fontFamily: Typography.family.medium, color: Colors.gray[800] },
  txMeta: { flexDirection: 'row', marginTop: 4 },
  txCategoryChip: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  txCategoryText: { fontSize: 10, fontFamily: Typography.family.medium },
  txAmount: { fontSize: Typography.size.sm, fontFamily: Typography.family.bold },

  // Tip Card
  tipCard: { borderRadius: 20, padding: 20, marginBottom: Layout.spacing.md },
  tipEmoji: { fontSize: 28, marginBottom: 8 },
  tipTitle: { fontSize: Typography.size.md, fontFamily: Typography.family.bold, color: Colors.white, marginBottom: 8 },
  tipBody: { fontSize: Typography.size.sm, fontFamily: Typography.family.regular, color: 'rgba(255,255,255,0.9)', lineHeight: 22 },

  // Empty State
  emptyState: { alignItems: 'center', paddingVertical: 40 },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: Typography.size.lg, fontFamily: Typography.family.bold, color: Colors.gray[800] },
  emptySub: { fontSize: Typography.size.sm, fontFamily: Typography.family.regular, color: Colors.gray[500], textAlign: 'center', marginTop: 6 },
});
