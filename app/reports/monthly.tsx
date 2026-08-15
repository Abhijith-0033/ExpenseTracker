import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, StatusBar,
  TouchableOpacity, ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowLeft } from 'lucide-react-native';
import { PieChart } from 'react-native-gifted-charts';
import { CustomLineChart } from '../../components/reports/CustomBarChart';
import { format, eachDayOfInterval, parseISO } from 'date-fns';
import { Colors, Typography, Layout } from '../../constants/Theme';
import {
  fetchPeriodData, computeMetrics, generateInsights, computeSpendingPersonality,
  computeReportCard, computeFinancialHealthScore,
  PeriodData, ComputedMetrics, Insight,
  getMonthlyRange, getCategoryColor
} from '../../services/reportsEngine';
import { PeriodSelector, PeriodType } from '../../components/reports/PeriodSelector';
import { ReportCard } from '../../components/reports/ReportCard';
import { InsightCard } from '../../components/reports/InsightCard';
import { FinancialFreedomSlider } from '../../components/reports/FinancialFreedomSlider';
import { FinancialScoreCard } from '../../components/reports/FinancialScoreCard';
import { CashFlowWaterfall } from '../../components/reports/CashFlowWaterfall';
import { formatCurrency } from '../../utils/currency';
import { safeDivide } from '../../utils/mathUtils';
import { getDatabase, initDatabase } from '../../services/database';


export default function ReportsMonthlyScreen() {
  const params = useLocalSearchParams<{ date?: string }>();
  const initialDate = params.date ? new Date(params.date) : new Date();

  const [periodType, setPeriodType] = useState<PeriodType>('monthly');
  const [currentDate, setCurrentDate] = useState(initialDate);
  const [loading, setLoading] = useState(true);
  const [periodData, setPeriodData] = useState<PeriodData | null>(null);
  const [metrics, setMetrics] = useState<ComputedMetrics | null>(null);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [budgets, setBudgets] = useState<{ category: string; budget: number; spent: number }[]>([]);
  const [cumulativeData, setCumulativeData] = useState<{ value: number; label: string }[]>([]);
  const [cumulativeIncomeData, setCumulativeIncomeData] = useState<{ value: number }[]>([]);

  const loadData = useCallback(async (date: Date) => {
    setLoading(true);
    try {
      const range = getMonthlyRange(date);
      const data = await fetchPeriodData(range.startDate, range.endDate, range.daysInPeriod);
      const m = computeMetrics(data);
      const ins = generateInsights(m, data, 'month');
      setPeriodData(data);
      setMetrics(m);
      setInsights(ins);

      // Build cumulative spending curve
      const days = eachDayOfInterval({ start: parseISO(range.startDate), end: parseISO(range.endDate) });
      let cumulExp = 0;
      let cumulInc = 0;
      const cExp: { value: number; label: string }[] = [];
      const cInc: { value: number }[] = [];

      for (const day of days) {
        const dateStr = day.toISOString().split('T')[0];
        const agg = data.dailyAggregates.find(a => a.date === dateStr);
        cumulExp += agg?.expense ?? 0;
        cumulInc += agg?.income ?? 0;
        const dayNum = day.getDate();
        cExp.push({ value: cumulExp, label: dayNum % 5 === 1 ? String(dayNum) : '' });
        cInc.push({ value: cumulInc });
      }
      setCumulativeData(cExp);
      setCumulativeIncomeData(cInc);

      // Load budgets
      try {
        await initDatabase();
        const db = getDatabase();
        const monthStr = format(date, 'yyyy-MM');
        const budgetRows = await db.getAllAsync<{ category: string; amount: number }>(
          `SELECT category, amount FROM category_budgets WHERE month = ?`,
          [monthStr]
        );
        const budgetData = budgetRows.map(b => {
          const spent = data.categoryBreakdown.find(c => c.name === b.category)?.total ?? 0;
          return { category: b.category, budget: b.amount, spent };
        });
        setBudgets(budgetData);
      } catch (_e) { setBudgets([]); }

    } catch (e) {
      console.error('monthly loadData error:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData(currentDate);
  }, [currentDate]);

  const handlePeriodTypeChange = (type: PeriodType) => {
    if (type === 'daily') router.replace({ pathname: '/reports/daily', params: { date: format(currentDate, 'yyyy-MM-dd') } });
    else if (type === 'weekly') router.replace({ pathname: '/reports/weekly', params: { date: format(currentDate, 'yyyy-MM-dd') } });
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

  const isPositive = metrics ? metrics.netSavings >= 0 : true;
  const personality = metrics && periodData ? computeSpendingPersonality(metrics, periodData) : null;
  const reportCard = metrics ? computeReportCard(metrics) : [];
  const annualExpense = (metrics?.totalExpense ?? 0) * 12;
  const annualSavings = (metrics?.netSavings ?? 0) * 12;
  const freedomNumber = annualExpense * 25;

  const pieData = periodData?.categoryBreakdown.slice(0, 6).map(cat => ({
    value: cat.total,
    color: getCategoryColor(cat.name),
  })) ?? [];

  const gradeColor = (score: number) => {
    if (score >= 80) return Colors.success[600];
    if (score >= 65) return Colors.primary[600];
    if (score >= 50) return Colors.warning[600];
    return Colors.danger[600];
  };

  const performanceEmoji = (metrics?.savingsRate ?? 0) >= 30 ? '🌟' : (metrics?.savingsRate ?? 0) >= 10 ? '✅' : (metrics?.savingsRate ?? 0) >= 0 ? '⚠️' : '🚨';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

      <View style={styles.topNav}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft size={22} color={Colors.gray[800]} />
        </TouchableOpacity>
        <Text style={styles.navTitle}>Monthly Report</Text>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} scrollEventThrottle={16} showsVerticalScrollIndicator={false}>

        <PeriodSelector
          periodType={periodType}
          currentDate={currentDate}
          onPeriodTypeChange={handlePeriodTypeChange}
          onDateChange={setCurrentDate}
        />

        {/* ── SECTION 1: MONTHLY HERO ──────────── */}
        <LinearGradient
          colors={isPositive ? ['#4D966F', '#0C2618'] : ['#D44D4D', '#420C0C']}
          style={styles.heroCard}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        >
          <View style={styles.decCircle1} />
          <View style={styles.heroHeaderRow}>
            <Text style={styles.heroMonthLabel}>{format(currentDate, 'MMMM yyyy')}</Text>
            <Text style={styles.heroEmoji}>{performanceEmoji}</Text>
          </View>

          {/* Circular Gauge */}
          <View style={styles.gaugeWrapper}>
            <View style={[styles.gaugeOuter, { borderColor: 'rgba(255,255,255,0.3)' }]}>
              <View style={[styles.gaugeInner, { borderColor: isPositive ? '#86EFAC' : '#FCA5A5' }]}>
                <Text style={styles.gaugeLabel}>Savings Rate</Text>
                <Text style={styles.savingsRingValue} adjustsFontSizeToFit numberOfLines={1}>{metrics?.savingsRate.toFixed(0) ?? '0'}%</Text>
                <Text style={styles.gaugeSub}>of income saved</Text>
              </View>
            </View>
          </View>

          {/* Bottom 3 tiles */}
          <View style={styles.heroTilesRow}>
            {[
              { label: 'Income', value: formatCurrency(metrics?.totalIncome ?? 0), change: metrics?.incomeChange },
              { label: 'Expense', value: formatCurrency(metrics?.totalExpense ?? 0), change: metrics?.expenseChange },
              { label: 'Savings', value: formatCurrency(Math.abs(metrics?.netSavings ?? 0)), change: null },
            ].map(tile => (
              <View key={tile.label} style={styles.heroTile}>
                <Text style={styles.heroTileLabel}>{tile.label}</Text>
                <Text style={styles.heroTileValue} numberOfLines={1}>{tile.value}</Text>
                {tile.change !== null && tile.change !== undefined && (
                  metrics && metrics.expenseChange !== 0 && (
                    <Text style={styles.heroChangeText} adjustsFontSizeToFit numberOfLines={1}>
                      {metrics.expenseChange > 0 ? '▲' : '▼'} {Math.abs(metrics.expenseChange).toFixed(0)}% vs last month
                    </Text>
                  )
                )}
              </View>
            ))}
          </View>
        </LinearGradient>

        {/* ── SECTION 2: 30-DAY CURVE ──────────── */}
        {cumulativeData.length > 1 && (
          <ReportCard title="30-Day Spending Curve" subtitle="Cumulative expense vs income">
            <CustomLineChart
              data={cumulativeData}
              data2={cumulativeIncomeData}
              color={Colors.danger[500]}
              color2={Colors.success[500]}
              height={150}
            />
            <View style={styles.legendRow}>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: Colors.danger[500] }]} />
                <Text style={styles.legendText}>Cumulative Expense</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: Colors.success[500] }]} />
                <Text style={styles.legendText}>Cumulative Income</Text>
              </View>
            </View>
          </ReportCard>
        )}

        {/* ── SECTION 3: CATEGORY DEEP DIVE ─────── */}
        {pieData.length > 0 && (
          <ReportCard title="Category Analysis" subtitle="Where your money went this month">
            <View style={{ alignItems: 'center', marginBottom: 16 }}>
              <PieChart
                data={pieData}
                donut
                radius={90}
                innerRadius={50}
                focusOnPress
                centerLabelComponent={() => (
                  <View style={{ alignItems: 'center' }}>
                    <Text style={styles.donutCenter}>{formatCurrency(metrics?.totalExpense ?? 0)}</Text>
                    <Text style={styles.donutSub}>Total</Text>
                  </View>
                )}
              />
            </View>
            {/* Category Comparison Table */}
            <View style={styles.catTableHeader}>
              <Text style={[styles.catTableHead, { flex: 2 }]}>Category</Text>
              <Text style={styles.catTableHead}>This Month</Text>
              <Text style={styles.catTableHead}>Change</Text>
            </View>
            {periodData?.categoryBreakdown.slice(0, 8).map(cat => (
              <View key={cat.name} style={styles.catTableRow}>
                <View style={[styles.catDot, { backgroundColor: getCategoryColor(cat.name) }]} />
                <Text style={[styles.catTableCell, { flex: 2 }]} numberOfLines={1}>{cat.name}</Text>
                <Text style={styles.catTableCell}>{formatCurrency(Math.round(cat.total))}</Text>
                <Text style={[styles.catTableCell, { color: Colors.gray[500] }]}>—</Text>
              </View>
            ))}
          </ReportCard>
        )}

        {/* ── SECTION 4: BUDGET PERFORMANCE ────── */}
        {budgets.length > 0 && (
          <ReportCard title="Budget Performance" subtitle="Your budget vs actual spending">
            {budgets.map(b => {
              const pct = safeDivide(b.spent, b.budget, 0) * 100;
              const isOver = b.spent > b.budget;
              const status = pct < 70 ? 'Under Budget ✅' : pct < 90 ? 'On Track 👍' : pct < 100 ? 'Near Limit ⚠️' : 'Exceeded 🔴';
              const barColor = pct < 70 ? Colors.success[500] : pct < 90 ? Colors.primary[500] : pct < 100 ? Colors.warning[500] : Colors.danger[500];
              return (
                <View key={b.category} style={styles.budgetRow}>
                  <Text style={styles.budgetCat} numberOfLines={1}>{b.category}</Text>
                  <View style={styles.budgetBarWrapper}>
                    <View style={[styles.budgetBarFill, { width: `${Math.min(pct, 100)}%`, backgroundColor: barColor }]} />
                    {isOver && <View style={[styles.budgetOverFill, { left: '100%', backgroundColor: Colors.danger[500] }]} />}
                  </View>
                  <View style={styles.budgetAmounts}>
                    <Text style={styles.budgetSpent}>{formatCurrency(Math.round(b.spent))}</Text>
                    <Text style={styles.budgetOf}>/{formatCurrency(b.budget)}</Text>
                  </View>
                  <Text style={[styles.budgetStatus, { color: barColor }]}>{status}</Text>
                </View>
              );
            })}
          </ReportCard>
        )}

        {/* ── SECTION 5: NET WORTH IMPACT ──────── */}
        <ReportCard title="How This Month Affected Your Wealth" subtitle="Monthly financial impact">
          <CashFlowWaterfall
            startBalance={0}
            income={metrics?.totalIncome ?? 0}
            expense={metrics?.totalExpense ?? 0}
          />
          <View style={styles.breakdownTable}>
            {[
              { label: '+ Income', value: formatCurrency(metrics?.totalIncome ?? 0), color: Colors.success[600] },
              { label: '- Expenses', value: formatCurrency(metrics?.totalExpense ?? 0), color: Colors.danger[600] },
              { label: '= Net', value: formatCurrency(Math.abs(metrics?.netSavings ?? 0)), color: isPositive ? Colors.success[600] : Colors.danger[600] },
            ].map(row => (
              <View key={row.label} style={styles.breakdownRow}>
                <Text style={styles.breakdownLabel}>{row.label}</Text>
                <Text style={[styles.breakdownValue, { color: row.color }]}>{row.value}</Text>
              </View>
            ))}
          </View>
        </ReportCard>

        {/* ── SECTION 6: SPENDING PERSONALITY ───── */}
        {personality && (
          <ReportCard title="Your Spending Personality" subtitle="This month's financial character">
            <View style={styles.personalityCard}>
              <Text style={styles.personalityEmoji}>{personality.emoji}</Text>
              <Text style={[styles.personalityProfile, { color: personality.color }]}>{personality.profile}</Text>
              <Text style={styles.personalityDesc}>{personality.description}</Text>

              <View style={styles.personalityTips}>
                {personality.tips.map((tip, i) => (
                  <View key={i} style={styles.tipRow}>
                    <Text style={styles.tipBullet}>→</Text>
                    <Text style={styles.tipText}>{tip}</Text>
                  </View>
                ))}
              </View>

              <FinancialScoreCard score={personality.score} label="Financial Discipline Score" />
            </View>
          </ReportCard>
        )}

        {/* ── SECTION 7: FINANCIAL INDEPENDENCE ── */}
        <LinearGradient
          colors={['#2563EB', '#1C3FAA']}
          style={styles.freedomCard}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        >
          <Text style={styles.freedomTitle}>🎯 Financial Freedom Progress</Text>
          <Text style={styles.freedomNumber}>Freedom Number: {formatCurrency(Math.round(freedomNumber))}</Text>
          <Text style={styles.freedomSub}>
            Your monthly net savings: {formatCurrency(Math.round(metrics?.netSavings ?? 0))}{'\n'}
            {annualSavings > 0
              ? `At this rate, freedom in ~${Math.min(999, Math.round(safeDivide(freedomNumber, Math.max(annualSavings, 1), 999)))} years`
              : 'Increase savings to reach financial freedom'}
          </Text>

          <View style={styles.freedomSliderWrapper}>
            <FinancialFreedomSlider
              currentSavingsRate={metrics?.savingsRate ?? 0}
              annualExpense={annualExpense}
              annualSavings={annualSavings}
            />
          </View>
        </LinearGradient>

        {/* ── SECTION 8: MONTHLY INSIGHTS ─────── */}
        {insights.length > 0 && (
          <ReportCard title="📊 Monthly Insights">
            {insights.map((insight, i) => (
              <InsightCard key={i} insight={insight} index={i} />
            ))}
          </ReportCard>
        )}

        {/* ── SECTION 9: REPORT CARD ───────────── */}
        <ReportCard title="📋 Month Report Card" subtitle="Gamified financial grade">
          {reportCard.map((row, i) => {
            const color = gradeColor(row.score);
            return (
              <View key={row.category} style={[styles.gradeRow, i < reportCard.length - 1 && styles.gradeRowBorder]}>
                <Text style={styles.gradeCategory}>{row.category}</Text>
                <View style={styles.gradeScoreWrapper}>
                  <View style={styles.scoreBar}>
                    <View style={[styles.scoreBarFill, { width: `${row.score}%`, backgroundColor: color }]} />
                  </View>
                  <Text style={styles.scoreNum}>{row.score}/100</Text>
                </View>
                <View style={[styles.gradeBadge, { backgroundColor: color + '20', borderColor: color }]}>
                  <Text style={[styles.gradeText, { color }]}>{row.grade}</Text>
                </View>
              </View>
            );
          })}
        </ReportCard>

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
  heroHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  heroMonthLabel: { fontSize: Typography.size.xl, fontFamily: Typography.family.bold, color: Colors.white },
  heroEmoji: { fontSize: 28 },
  gaugeWrapper: { alignItems: 'center', marginBottom: 20 },
  gaugeOuter: { width: 140, height: 140, borderRadius: 70, borderWidth: 6, justifyContent: 'center', alignItems: 'center' },
  gaugeInner: { width: 112, height: 112, borderRadius: 56, borderWidth: 4, justifyContent: 'center', alignItems: 'center' },
  gaugeLabel: { fontSize: 10, color: 'rgba(255,255,255,0.7)', textAlign: 'center' },
  gaugeSub: { fontSize: 9, color: 'rgba(255,255,255,0.6)', textAlign: 'center' },
  heroTilesRow: { flexDirection: 'row', gap: 8 },
  heroTile: { flex: 1, backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 12, padding: 12 },
  heroTileLabel: { fontSize: 10, color: 'rgba(255,255,255,0.7)', marginBottom: 4 },
  heroTileValue: { fontSize: 14, fontFamily: Typography.family.bold, color: Colors.white },
  heroChangeText: { fontSize: 10, fontFamily: Typography.family.bold, color: Colors.white, marginTop: 4 },
  savingsRingValue: { fontSize: 28, fontFamily: Typography.family.bold, color: Colors.white, width: '80%', textAlign: 'center' },
  catPerfChange: { minWidth: 44, maxWidth: 54, fontSize: 10, fontFamily: Typography.family.bold, textAlign: 'right' },

  // Chart / donut
  donutCenter: { fontSize: 14, fontFamily: Typography.family.bold, color: Colors.gray[900] },
  donutSub: { fontSize: 9, color: Colors.gray[500] },
  legendRow: { flexDirection: 'row', justifyContent: 'center', gap: 20, marginTop: 8 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 11, color: Colors.gray[600] },

  // Category table
  catDot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  catTableHeader: { flexDirection: 'row', paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: Colors.gray[200], marginBottom: 4 },
  catTableHead: { fontSize: 10, fontFamily: Typography.family.bold, color: Colors.gray[500], textTransform: 'uppercase', flex: 1 },
  catTableRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Colors.gray[100] },
  catTableCell: { flex: 1, fontSize: Typography.size.sm, color: Colors.gray[700] },

  // Budgets
  budgetRow: { marginBottom: 16 },
  budgetCat: { fontSize: Typography.size.sm, fontFamily: Typography.family.bold, color: Colors.gray[800], marginBottom: 6 },
  budgetBarWrapper: { height: 8, backgroundColor: Colors.gray[100], borderRadius: 4, overflow: 'hidden', marginBottom: 4 },
  budgetBarFill: { height: 8, borderRadius: 4 },
  budgetOverFill: { position: 'absolute', height: 8 },
  budgetAmounts: { flexDirection: 'row', marginBottom: 2 },
  budgetSpent: { fontSize: 12, fontFamily: Typography.family.bold, color: Colors.gray[900] },
  budgetOf: { fontSize: 12, color: Colors.gray[500] },
  budgetStatus: { fontSize: 11, fontFamily: Typography.family.medium },

  // Net Worth
  breakdownTable: { marginTop: 16, borderTopWidth: 1, borderTopColor: Colors.gray[200], paddingTop: 12 },
  breakdownRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  breakdownLabel: { fontSize: Typography.size.sm, fontFamily: Typography.family.medium, color: Colors.gray[600] },
  breakdownValue: { fontSize: Typography.size.sm, fontFamily: Typography.family.bold },

  // Personality
  personalityCard: { alignItems: 'center' },
  personalityEmoji: { fontSize: 64, marginBottom: 8 },
  personalityProfile: { fontSize: Typography.size.lg, fontFamily: Typography.family.bold, marginBottom: 8 },
  personalityDesc: { fontSize: Typography.size.sm, fontFamily: Typography.family.regular, color: Colors.gray[600], textAlign: 'center', lineHeight: 22, marginBottom: 16 },
  personalityTips: { width: '100%', marginBottom: 20 },
  tipRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 6 },
  tipBullet: { fontSize: 14, color: Colors.primary[500], marginRight: 8, marginTop: 2 },
  tipText: { flex: 1, fontSize: Typography.size.sm, color: Colors.gray[700], lineHeight: 20 },

  // Freedom Card
  freedomCard: { borderRadius: 20, padding: 20, marginBottom: Layout.spacing.md, ...Layout.shadows.lg },
  freedomTitle: { fontSize: Typography.size.lg, fontFamily: Typography.family.bold, color: Colors.white, marginBottom: 8 },
  freedomNumber: { fontSize: Typography.size.xl, fontFamily: Typography.family.bold, color: 'rgba(255,255,255,0.9)', marginBottom: 8 },
  freedomSub: { fontSize: Typography.size.sm, color: 'rgba(255,255,255,0.8)', lineHeight: 20, marginBottom: 20 },
  freedomSliderWrapper: { backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 16, padding: 16 },

  // Report Card
  gradeRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
  gradeRowBorder: { borderBottomWidth: 1, borderBottomColor: Colors.gray[100] },
  gradeCategory: { flex: 1, fontSize: Typography.size.sm, fontFamily: Typography.family.medium, color: Colors.gray[700] },
  gradeScoreWrapper: { flexDirection: 'row', alignItems: 'center', flex: 2, marginRight: 12 },
  scoreBar: { flex: 1, height: 6, backgroundColor: Colors.gray[100], borderRadius: 3, marginRight: 8 },
  scoreBarFill: { height: 6, borderRadius: 3 },
  scoreNum: { fontSize: 10, color: Colors.gray[500], width: 44 },
  gradeBadge: { width: 36, height: 36, borderRadius: 8, borderWidth: 1.5, justifyContent: 'center', alignItems: 'center' },
  gradeText: { fontSize: 12, fontFamily: Typography.family.bold },
});
