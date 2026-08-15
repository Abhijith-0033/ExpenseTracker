/**
 * ReportsEngine.ts
 * Pure data computation layer for the Financial Reports module.
 * All queries are parameterized. All computations run off main thread.
 * READ-ONLY — does NOT modify any existing tables.
 */

import { getDatabase, initDatabase } from './database';
import { safeDivide } from '../utils/mathUtils';
import { subMonths } from 'date-fns';

// ── TYPES ──────────────────────────────────────────────────────────

export interface RawTransaction {
  id: number;
  amount: number;
  category: string;
  subcategory: string;
  account_id: number;
  date: string;         // ISO string
  created_at: number;   // Unix ms
  description: string;
}

export interface DailyAggregate {
  date: string;         // YYYY-MM-DD
  expense: number;
  income: number;
  transaction_count: number;
}

export interface CategoryBreakdown {
  name: string;
  total: number;
  count: number;
  average: number;
  color: string;        // generated color
}

export interface HourDistribution {
  hour: string;         // "00"-"23"
  total: number;
  count: number;
}

export interface PeriodData {
  transactions: RawTransaction[];
  previousTransactions: RawTransaction[];
  dailyAggregates: DailyAggregate[];
  categoryBreakdown: CategoryBreakdown[];
  hourDistribution: HourDistribution[];
  startDate: string;
  endDate: string;
  prevStartDate: string;
  prevEndDate: string;
}

export interface ComputedMetrics {
  totalExpense: number;
  totalIncome: number;
  netSavings: number;
  savingsRate: number;        // percentage 0-100
  avgDailyExpense: number;
  avgTransactionAmount: number;
  prevExpense: number;
  prevIncome: number;
  expenseChange: number;      // percentage
  incomeChange: number;       // percentage
  highestSpendDay: DailyAggregate | null;
  lowestSpendDay: DailyAggregate | null;
  topCategory: CategoryBreakdown | null;
  mostUsedPaymentMode: string;
  daysInPeriod: number;
  transactionCount: number;
}

export interface Insight {
  type: 'critical' | 'warning' | 'positive' | 'excellent' | 'insight' | 'action' | 'educational' | 'tip';
  title: string;
  body: string;
  icon: string;
  color: string;
  priority: number;
}

// ── CATEGORY COLOR PALETTE ─────────────────────────────────────────

const CATEGORY_COLORS = [
  '#E8917A', '#4D966F', '#3B82F6', '#F59E0B', '#8B5CF6',
  '#EC4899', '#06B6D4', '#10B981', '#F97316', '#6366F1',
  '#14B8A6', '#EF4444', '#84CC16', '#F43F5E', '#0EA5E9',
];

export function getCategoryColor(categoryName: string): string {
  let hash = 0;
  for (let i = 0; i < categoryName.length; i++) {
    hash = categoryName.charCodeAt(i) + ((hash << 5) - hash);
  }
  return CATEGORY_COLORS[Math.abs(hash) % CATEGORY_COLORS.length];
}

// ── DB HELPERS ─────────────────────────────────────────────────────

async function ensureDb() {
  await initDatabase();
  return getDatabase();
}

// ── MASTER DATA FETCH ──────────────────────────────────────────────

/**
 * Fetches all raw data for a given date range.
 * startDate and endDate are YYYY-MM-DD strings.
 */
export async function fetchPeriodData(
  startDate: string,
  endDate: string,
  daysInPeriod: number
): Promise<PeriodData> {
  const db = await ensureDb();

  // Calculate previous period
  const prevEnd = new Date(startDate);
  prevEnd.setDate(prevEnd.getDate() - 1);
  const prevStart = new Date(prevEnd);
  prevStart.setDate(prevStart.getDate() - (daysInPeriod - 1));

  const prevStartDate = prevStart.toISOString().split('T')[0];
  const prevEndDate = prevEnd.toISOString().split('T')[0];

  // QUERY 1: All transactions in period (expense + income, no transfers)
  const transactions = await db.getAllAsync<RawTransaction>(
    `SELECT id, amount, category, subcategory, account_id, date, created_at, description
     FROM transactions
     WHERE substr(date, 1, 10) >= ? AND substr(date, 1, 10) <= ?
       AND category != 'Transfer'
       AND category != 'Debt/Credit'
     ORDER BY date DESC`,
    [startDate, endDate]
  );

  // QUERY 2: Previous period transactions
  const previousTransactions = await db.getAllAsync<RawTransaction>(
    `SELECT id, amount, category, subcategory, account_id, date, created_at, description
     FROM transactions
     WHERE substr(date, 1, 10) >= ? AND substr(date, 1, 10) <= ?
       AND category != 'Transfer'
       AND category != 'Debt/Credit'
     ORDER BY date DESC`,
    [prevStartDate, prevEndDate]
  );

  // QUERY 3: Daily aggregates
  const dailyAggregates = await db.getAllAsync<DailyAggregate>(
    `SELECT substr(date, 1, 10) as date,
            SUM(CASE WHEN category != 'Income' THEN amount ELSE 0 END) as expense,
            SUM(CASE WHEN category = 'Income' THEN amount ELSE 0 END) as income,
            COUNT(*) as transaction_count
     FROM transactions
     WHERE substr(date, 1, 10) >= ? AND substr(date, 1, 10) <= ?
       AND category != 'Transfer'
       AND category != 'Debt/Credit'
     GROUP BY substr(date, 1, 10)
     ORDER BY date ASC`,
    [startDate, endDate]
  );

  // QUERY 4: Category breakdown (expenses only)
  const rawCategoryBreakdown = await db.getAllAsync<{
    name: string; total: number; count: number; average: number;
  }>(
    `SELECT category as name,
            SUM(amount) as total,
            COUNT(id) as count,
            AVG(amount) as average
     FROM transactions
     WHERE substr(date, 1, 10) >= ? AND substr(date, 1, 10) <= ?
       AND category != 'Income'
       AND category != 'Transfer'
       AND category != 'Debt/Credit'
     GROUP BY category
     ORDER BY total DESC`,
    [startDate, endDate]
  );

  const categoryBreakdown: CategoryBreakdown[] = rawCategoryBreakdown.map(c => ({
    ...c,
    color: getCategoryColor(c.name),
  }));

  // QUERY 5: Hour distribution (only for single-day)
  let hourDistribution: HourDistribution[] = [];
  if (daysInPeriod === 1) {
    const hourRaw = await db.getAllAsync<{ hour: number; total: number; count: number }>(
      `SELECT CAST((created_at / 3600000) % 24 AS INTEGER) as hour,
              SUM(amount) as total,
              COUNT(*) as count
       FROM transactions
       WHERE substr(date, 1, 10) = ?
         AND category != 'Income'
         AND category != 'Transfer'
         AND category != 'Debt/Credit'
       GROUP BY CAST((created_at / 3600000) % 24 AS INTEGER)
       ORDER BY hour ASC`,
      [startDate]
    );
    hourDistribution = hourRaw.map(h => ({
      hour: Math.abs(h.hour).toString().padStart(2, '0'),
      total: h.total,
      count: h.count,
    }));
  }

  return {
    transactions,
    previousTransactions,
    dailyAggregates,
    categoryBreakdown,
    hourDistribution,
    startDate,
    endDate,
    prevStartDate,
    prevEndDate,
  };
}

// ── DATE RANGE HELPERS ─────────────────────────────────────────────

export function getDailyRange(date: Date): { startDate: string; endDate: string; daysInPeriod: number } {
  const d = date.toISOString().split('T')[0];
  return { startDate: d, endDate: d, daysInPeriod: 1 };
}

export function getWeeklyRange(date: Date): { startDate: string; endDate: string; daysInPeriod: number } {
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1); // Monday
  const monday = new Date(date);
  monday.setDate(diff);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return {
    startDate: monday.toISOString().split('T')[0],
    endDate: sunday.toISOString().split('T')[0],
    daysInPeriod: 7,
  };
}

export function getMonthlyRange(date: Date): { startDate: string; endDate: string; daysInPeriod: number } {
  const year = date.getFullYear();
  const month = date.getMonth();
  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 0);
  return {
    startDate: start.toISOString().split('T')[0],
    endDate: end.toISOString().split('T')[0],
    daysInPeriod: end.getDate(),
  };
}

// ── METRICS COMPUTATION ────────────────────────────────────────────

export function computeMetrics(data: PeriodData): ComputedMetrics {
  const expenseTransactions = data.transactions.filter(t => t.category !== 'Income');
  const incomeTransactions = data.transactions.filter(t => t.category === 'Income');

  const totalExpense = expenseTransactions.reduce((sum, t) => sum + t.amount, 0);
  const totalIncome = incomeTransactions.reduce((sum, t) => sum + t.amount, 0);
  const netSavings = totalIncome - totalExpense;
  const savingsRate = safeDivide(netSavings, totalIncome, 0) * 100;

  const prevExpense = data.previousTransactions
    .filter(t => t.category !== 'Income')
    .reduce((sum, t) => sum + t.amount, 0);
  const prevIncome = data.previousTransactions
    .filter(t => t.category === 'Income')
    .reduce((sum, t) => sum + t.amount, 0);

  const expenseChange = safeDivide(totalExpense - prevExpense, prevExpense, 0) * 100;
  const incomeChange = safeDivide(totalIncome - prevIncome, prevIncome, 0) * 100;

  const startMs = new Date(data.startDate + 'T00:00:00').getTime();
  const endMs = new Date(data.endDate + 'T00:00:00').getTime();
  const daysInPeriod = Math.max(1, Math.round((endMs - startMs) / 86400000) + 1);

  const avgDailyExpense = safeDivide(totalExpense, daysInPeriod, 0);
  const avgTransactionAmount = safeDivide(totalExpense, expenseTransactions.length, 0);

  const highestSpendDay = data.dailyAggregates.length > 0
    ? data.dailyAggregates.reduce((max, d) => d.expense > max.expense ? d : max, data.dailyAggregates[0])
    : null;

  const spendDays = data.dailyAggregates.filter(d => d.expense > 0);
  const lowestSpendDay = spendDays.length > 0
    ? spendDays.reduce((min, d) => d.expense < min.expense ? d : min, spendDays[0])
    : null;

  const topCategory = data.categoryBreakdown.length > 0 ? data.categoryBreakdown[0] : null;

  // Most used subcategory as payment mode proxy
  const subcategoryMap = new Map<string, number>();
  for (const t of expenseTransactions) {
    subcategoryMap.set(t.subcategory, (subcategoryMap.get(t.subcategory) || 0) + 1);
  }
  let mostUsedPaymentMode = 'Cash';
  let maxCount = 0;
  subcategoryMap.forEach((count, sub) => {
    if (count > maxCount) { maxCount = count; mostUsedPaymentMode = sub; }
  });

  return {
    totalExpense,
    totalIncome,
    netSavings,
    savingsRate,
    avgDailyExpense,
    avgTransactionAmount,
    prevExpense,
    prevIncome,
    expenseChange,
    incomeChange,
    highestSpendDay,
    lowestSpendDay,
    topCategory,
    mostUsedPaymentMode,
    daysInPeriod,
    transactionCount: data.transactions.length,
  };
}

// ── INSIGHT GENERATOR ──────────────────────────────────────────────

const INSIGHT_COLORS = {
  critical: '#EF4444',
  warning: '#F59E0B',
  positive: '#10B981',
  excellent: '#6366F1',
  insight: '#3B82F6',
  action: '#F97316',
  educational: '#8B5CF6',
  tip: '#14B8A6',
};

export function generateInsights(
  metrics: ComputedMetrics,
  data: PeriodData,
  periodLabel: string
): Insight[] {
  const insights: Insight[] = [];

  // INSIGHT 1 — Spending Trend
  if (metrics.prevExpense > 0) {
    if (metrics.expenseChange > 20) {
      const diff = metrics.totalExpense - metrics.prevExpense;
      insights.push({
        type: 'warning',
        icon: '📈',
        title: `Spending Up ${Math.abs(metrics.expenseChange).toFixed(0)}% from last ${periodLabel}`,
        body: `You spent ₹${Math.round(diff).toLocaleString('en-IN')} more than last ${periodLabel}. ${metrics.topCategory?.name ?? ''} was the biggest driver.`,
        color: INSIGHT_COLORS.warning,
        priority: 2,
      });
    } else if (metrics.expenseChange < -10) {
      const diff = metrics.prevExpense - metrics.totalExpense;
      insights.push({
        type: 'positive',
        icon: '📉',
        title: `Great! Spending Down ${Math.abs(metrics.expenseChange).toFixed(0)}%`,
        body: `You spent ₹${Math.round(diff).toLocaleString('en-IN')} less than last ${periodLabel}. Keep this momentum going!`,
        color: INSIGHT_COLORS.positive,
        priority: 5,
      });
    }
  }

  // INSIGHT 2 — Savings Rate
  if (metrics.totalIncome > 0) {
    if (metrics.savingsRate < 0) {
      insights.push({
        type: 'critical',
        icon: '🚨',
        title: 'You Spent More Than You Earned',
        body: `You overspent by ₹${Math.round(Math.abs(metrics.netSavings)).toLocaleString('en-IN')}. Review ${metrics.topCategory?.name ?? 'your top category'} which is taking the most.`,
        color: INSIGHT_COLORS.critical,
        priority: 1,
      });
    } else if (metrics.savingsRate < 10) {
      const needed = metrics.totalIncome * 0.20 - metrics.netSavings;
      insights.push({
        type: 'warning',
        icon: '⚠️',
        title: 'Savings Rate Below 10%',
        body: `Financial experts recommend saving at least 20%. You need ₹${Math.round(needed).toLocaleString('en-IN')} more in savings this period.`,
        color: INSIGHT_COLORS.warning,
        priority: 2,
      });
    } else if (metrics.savingsRate >= 30) {
      const annualSavings = metrics.netSavings * (365 / metrics.daysInPeriod);
      insights.push({
        type: 'excellent',
        icon: '🌟',
        title: `Excellent ${metrics.savingsRate.toFixed(0)}% Savings Rate!`,
        body: `You're in the top tier of savers. At this rate, you save ₹${Math.round(annualSavings).toLocaleString('en-IN')} per year.`,
        color: INSIGHT_COLORS.excellent,
        priority: 5,
      });
    }
  }

  // INSIGHT 3 — Top Category Warning
  if (metrics.topCategory && metrics.totalExpense > 0) {
    const pct = safeDivide(metrics.topCategory.total, metrics.totalExpense, 0) * 100;
    if (pct > 40) {
      insights.push({
        type: 'insight',
        icon: '🎯',
        title: `${metrics.topCategory.name} is ${pct.toFixed(0)}% of Your Spending`,
        body: `Nearly half your spending is in one category. Consider if this aligns with your financial goals.`,
        color: INSIGHT_COLORS.insight,
        priority: 3,
      });
    }
  }

  // INSIGHT 4 — No Spend Streak
  const sortedDays = [...data.dailyAggregates].sort((a, b) => b.date.localeCompare(a.date));
  let streak = 0;
  for (const day of sortedDays) {
    if (day.expense === 0) streak++;
    else break;
  }
  if (streak >= 2) {
    insights.push({
      type: 'positive',
      icon: '🔥',
      title: `${streak}-Day No-Spend Streak!`,
      body: `You went ${streak} days without spending. That saved approximately ₹${Math.round(metrics.avgDailyExpense * streak).toLocaleString('en-IN')}.`,
      color: INSIGHT_COLORS.positive,
      priority: 4,
    });
  }

  // INSIGHT 5 — Financial Freedom Number
  if (metrics.totalExpense > 0) {
    const annualExpense = metrics.totalExpense * (365 / metrics.daysInPeriod);
    const freedomNumber = annualExpense * 25;
    insights.push({
      type: 'educational',
      icon: '🎯',
      title: `Your Freedom Number: ₹${formatIndian(Math.round(freedomNumber))}`,
      body: `This is how much you need invested to cover expenses forever. Increasing savings by 10% could shave years off your timeline.`,
      color: INSIGHT_COLORS.educational,
      priority: 6,
    });
  }

  // INSIGHT 6 — Category Reduction Opportunity
  if (data.categoryBreakdown.length > 1) {
    const nonEssential = data.categoryBreakdown.find(c => 
      !['Food', 'Housing', 'Utilities', 'Health', 'Transport'].includes(c.name)
    );
    if (nonEssential) {
      const savings = nonEssential.total * 0.30;
      insights.push({
        type: 'action',
        icon: '✂️',
        title: `Cut ${nonEssential.name} by 30% and Save ₹${Math.round(savings).toLocaleString('en-IN')}`,
        body: `This is your highest non-essential expense. Small reductions here have the biggest financial impact.`,
        color: INSIGHT_COLORS.action,
        priority: 3,
      });
    }
  }

  // INSIGHT 7 — Best Day Pattern
  if (metrics.highestSpendDay) {
    const dayName = new Date(metrics.highestSpendDay.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long' });
    const isWeekend = ['Saturday', 'Sunday'].includes(dayName);
    if (isWeekend) {
      insights.push({
        type: 'insight',
        icon: '📅',
        title: `Weekends Are Your Costly Days`,
        body: `${dayName} was your highest spend day at ₹${Math.round(metrics.highestSpendDay.expense).toLocaleString('en-IN')}. Plan weekend activities within a budget.`,
        color: INSIGHT_COLORS.insight,
        priority: 4,
      });
    }
  }

  // Sort by priority (lower = more important)
  insights.sort((a, b) => a.priority - b.priority);

  // Return top 5
  return insights.slice(0, 5);
}

// Helper
function formatIndian(n: number): string {
  return n.toLocaleString('en-IN');
}

// ── FINANCIAL HEALTH SCORE ────────────────────────────────────────

export function computeFinancialHealthScore(metrics: ComputedMetrics): number {
  let score = 50;
  
  // Savings rate contribution (max +30)
  if (metrics.savingsRate >= 30) score += 30;
  else if (metrics.savingsRate >= 20) score += 20;
  else if (metrics.savingsRate >= 10) score += 10;
  else if (metrics.savingsRate < 0) score -= 20;

  // Spending trend contribution (max +20)
  if (metrics.expenseChange < -10) score += 20;
  else if (metrics.expenseChange < 0) score += 10;
  else if (metrics.expenseChange > 20) score -= 15;
  else if (metrics.expenseChange > 10) score -= 5;

  // Top category concentration (max -20)
  if (metrics.topCategory && metrics.totalExpense > 0) {
    const pct = safeDivide(metrics.topCategory.total, metrics.totalExpense, 0) * 100;
    if (pct > 60) score -= 20;
    else if (pct > 40) score -= 10;
  }

  return Math.max(0, Math.min(100, Math.round(score)));
}

// ── REPORT CARD GRADES ─────────────────────────────────────────────

export function computeReportCard(metrics: ComputedMetrics): {
  category: string; grade: string; score: number;
}[] {
  const savingsScore = Math.max(0, Math.min(100, metrics.savingsRate > 0 ? (metrics.savingsRate / 50) * 100 : 0));
  const consistencyScore = metrics.daysInPeriod > 7
    ? Math.max(0, Math.min(100, 100 - (metrics.expenseChange > 0 ? metrics.expenseChange : 0)))
    : 80;
  const disciplineScore = metrics.topCategory && metrics.totalExpense > 0
    ? Math.max(0, Math.min(100, 100 - safeDivide(metrics.topCategory.total, metrics.totalExpense, 0) * 100))
    : 80;
  const trendScore = metrics.expenseChange < 0 ? 90 : metrics.expenseChange < 10 ? 75 : 50;
  const overallScore = (savingsScore + consistencyScore + disciplineScore + trendScore) / 4;

  const grade = (s: number) => {
    if (s >= 90) return 'A+'; if (s >= 80) return 'A';
    if (s >= 75) return 'B+'; if (s >= 70) return 'B';
    if (s >= 65) return 'C+'; if (s >= 60) return 'C';
    return 'D';
  };

  return [
    { category: 'Savings Rate', grade: grade(savingsScore), score: Math.round(savingsScore) },
    { category: 'Consistency', grade: grade(consistencyScore), score: Math.round(consistencyScore) },
    { category: 'Discipline', grade: grade(disciplineScore), score: Math.round(disciplineScore) },
    { category: 'Spending Trend', grade: grade(trendScore), score: Math.round(trendScore) },
    { category: 'Overall', grade: grade(overallScore), score: Math.round(overallScore) },
  ];
}

// ── SPENDING PERSONALITY ───────────────────────────────────────────

export function computeSpendingPersonality(metrics: ComputedMetrics, data: PeriodData): {
  profile: string; emoji: string; description: string; score: number; color: string; tips: string[];
} {
  const score = computeFinancialHealthScore(metrics);

  if (metrics.savingsRate >= 30) {
    return {
      profile: 'The Smart Saver', emoji: '💰', color: '#10B981',
      description: 'Excellent discipline this period! You are building real wealth and setting yourself up for financial freedom.',
      score, tips: ['Keep your savings rate above 30%', 'Consider investing your surplus', 'Review and increase savings targets annually'],
    };
  }

  // Calculate variance
  const expAmounts = data.dailyAggregates.filter(d => d.expense > 0).map(d => d.expense);
  const avg = safeDivide(expAmounts.reduce((a, b) => a + b, 0), expAmounts.length, 0);
  const variance = safeDivide(expAmounts.reduce((a, b) => a + Math.pow(b - avg, 2), 0), expAmounts.length, 0);
  const stdDev = Math.sqrt(variance);
  const isHighVariance = stdDev > avg * 0.6;

  if (isHighVariance) {
    return {
      profile: 'The Impulse Buyer', emoji: '🎢', color: '#0BA5EC',
      description: 'Your spending has high variance between days. Some days are frugal, others very high — this suggests impulse purchases.',
      score, tips: ['Wait 24 hours before purchases over ₹500', 'Set a daily spending limit', 'Track triggers that cause impulse buys'],
    };
  }

  const topCategoryPct = metrics.topCategory
    ? safeDivide(metrics.topCategory.total, metrics.totalExpense, 0) * 100
    : 0;

  if (topCategoryPct > 40) {
    return {
      profile: 'The Lifestyle Spender', emoji: '🛍️', color: '#F97316',
      description: `You prioritized lifestyle and comfort this period. ${metrics.topCategory?.name ?? 'One category'} dominates your spending.`,
      score, tips: ['Set a category budget for your top spending area', 'Find free or cheaper alternatives', 'Redirect 20% of lifestyle spend to savings'],
    };
  }

  return {
    profile: 'The Disciplined Planner', emoji: '📋', color: '#6366F1',
    description: 'Your spending is consistent and well-distributed across categories. You show thoughtful financial management.',
    score, tips: ['Maintain this consistency', 'Look for investment opportunities', 'Set specific saving milestones'],
  };
}

// ── HISTORICAL HEALTH SCORES ───────────────────────────────────────

export async function getHistoricalHealthScores(months: number = 6): Promise<{
  month: string; score: number; expense: number; income: number;
}[]> {
  const db = await ensureDb();
  const results: { month: string; score: number; expense: number; income: number; }[] = [];
  const now = new Date();

  for (let i = months - 1; i >= 0; i--) {
    const date = subMonths(now, i);
    const { startDate, endDate, daysInPeriod } = getMonthlyRange(date);
    try {
      const periodData = await fetchPeriodData(startDate, endDate, daysInPeriod);
      const metrics = computeMetrics(periodData);
      const score = computeFinancialHealthScore(metrics);
      results.push({
        month: startDate.substring(0, 7),
        score,
        expense: metrics.totalExpense,
        income: metrics.totalIncome,
      });
    } catch (_e) {
      results.push({ month: startDate.substring(0, 7), score: 50, expense: 0, income: 0 });
    }
  }

  return results;
}
