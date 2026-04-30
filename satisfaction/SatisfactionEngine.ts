import { getDatabase, initDatabase } from '../services/database';
import { getMergedClassifications } from './categoryClassification';
import { startOfMonth, endOfMonth, subMonths, format, startOfWeek, endOfWeek, subWeeks } from 'date-fns';

export interface SatisfactionMetrics {
  totalIncome: number;
  totalExpense: number;
  essentialExpense: number;
  nonEssentialExpense: number;
  remainingBalance: number;
  savingsRate: number;
  essentialRatio: number;
  luxuryRatio: number;
  consistencyScore: number;
  balanceStability: number;
  baseScore: number;
  currentMonthBalance: number;
  previousMonthBalance: number;
  penalties: { reason: string, points: number }[];
  bonuses: { reason: string, points: number }[];
}

export interface SatisfactionStatus {
  label: string;
  color: string;
  emoji: string;
  description: string;
}

export interface SatisfactionResult {
  finalScore: number;
  status: SatisfactionStatus;
  metrics: SatisfactionMetrics;
}

const ensureDb = async () => {
    await initDatabase();
    return getDatabase();
};

export const SatisfactionEngine = {
  compute: async (period: string = 'month'): Promise<SatisfactionResult> => {
    const db = await ensureDb();
    const classifications = await getMergedClassifications();
    const now = new Date();

    // Determine current period bounds
    // Based on user prompt: "For the selected period (default: current calendar month)"
    const start = startOfMonth(now).toISOString();
    const end = endOfMonth(now).toISOString();

    // Get current month transactions
    const query = `
      SELECT amount, category, date 
      FROM transactions 
      WHERE date >= ? AND date <= ? AND category != 'Transfer' AND category != 'Debt/Credit'
    `;
    const transactions = await db.getAllAsync<{ amount: number, category: string, date: string }>(query, [start, end]);

    // 1. Core Metrics
    let totalIncome = 0;
    let totalExpense = 0;
    let essentialExpense = 0;
    let nonEssentialExpense = 0;

    transactions.forEach(t => {
      if (t.category === 'Income') {
        totalIncome += t.amount;
      } else {
        totalExpense += t.amount;
        const type = classifications[t.category] || 'non-essential';
        if (type === 'essential') {
          essentialExpense += t.amount;
        } else {
          nonEssentialExpense += t.amount;
        }
      }
    });

    const remainingBalance = totalIncome - totalExpense;
    const savingsRate = totalIncome > 0 ? remainingBalance / totalIncome : 0;
    const essentialRatio = totalExpense > 0 ? essentialExpense / totalExpense : 0;
    const luxuryRatio = totalExpense > 0 ? nonEssentialExpense / totalExpense : 0;

    // 2. Consistency Score (last 4 weeks)
    // We get last 4 weeks data ending today to calculate consistency
    const fourWeeksAgo = subWeeks(now, 4).toISOString();
    const weeklyQuery = `
      SELECT amount, date 
      FROM transactions 
      WHERE date >= ? AND date <= ? AND category != 'Income' AND category != 'Transfer' AND category != 'Debt/Credit'
    `;
    const weeklyTransactions = await db.getAllAsync<{ amount: number, date: string }>(weeklyQuery, [fourWeeksAgo, now.toISOString()]);
    
    // Bucket into 4 weeks
    const weeklyExpenses = [0, 0, 0, 0];
    weeklyTransactions.forEach(t => {
      const tDate = new Date(t.date);
      const diffTime = Math.abs(now.getTime() - tDate.getTime());
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      const weekIndex = Math.min(3, Math.floor(diffDays / 7));
      weeklyExpenses[weekIndex] += t.amount;
    });

    let consistencyScore = 0.5; // neutral default
    // If fewer than 2 weeks of data, default to 0.5
    const activeWeeks = weeklyExpenses.filter(w => w > 0).length;
    if (activeWeeks >= 2) {
      const mean = weeklyExpenses.reduce((a, b) => a + b, 0) / 4;
      if (mean > 0) {
        const variance = weeklyExpenses.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / 4;
        consistencyScore = 1 - Math.min(variance / (mean * mean), 1);
      }
    }

    // 3. Balance Stability
    const prevMonth = subMonths(now, 1);
    const prevStart = startOfMonth(prevMonth).toISOString();
    const prevEnd = endOfMonth(prevMonth).toISOString();
    
    const prevQuery = `
      SELECT amount, category 
      FROM transactions 
      WHERE date >= ? AND date <= ? AND category != 'Transfer' AND category != 'Debt/Credit'
    `;
    const prevTransactions = await db.getAllAsync<{ amount: number, category: string }>(prevQuery, [prevStart, prevEnd]);
    
    let prevIncome = 0;
    let prevExpense = 0;
    prevTransactions.forEach(t => {
      if (t.category === 'Income') prevIncome += t.amount;
      else prevExpense += t.amount;
    });
    
    const previousMonthBalance = prevIncome - prevExpense;
    const currentMonthBalance = remainingBalance;
    
    let balanceStability = 0.5; // neutral
    if (prevTransactions.length > 0) {
      balanceStability = currentMonthBalance >= previousMonthBalance ? 1 : Math.max(0, currentMonthBalance / previousMonthBalance);
    }

    // 4. Base Score Formula
    const baseScore = 
      (Math.min(Math.max(savingsRate, 0), 1) * 40) +
      (essentialRatio * 20) +
      (balanceStability * 20) +
      (consistencyScore * 20);

    // 5. Penalties and Bonuses
    let penaltyPoints = 0;
    let bonusPoints = 0;
    const penalties: { reason: string, points: number }[] = [];
    const bonuses: { reason: string, points: number }[] = [];

    // PENALTIES
    if (totalExpense > totalIncome && totalIncome > 0) {
      const pts = Math.round(Math.min(((totalExpense - totalIncome) / totalIncome) * 30, 30));
      if (pts > 0) {
        penaltyPoints += pts;
        penalties.push({ reason: 'Overspending detected', points: pts });
      }
    }
    
    if (luxuryRatio > 0.4) {
      const pts = Math.round((luxuryRatio - 0.4) * 25);
      if (pts > 0) {
        penaltyPoints += pts;
        penalties.push({ reason: 'High non-essential spending', points: pts });
      }
    }
    
    if (remainingBalance < 0) {
      penaltyPoints += 15;
      penalties.push({ reason: 'Negative balance', points: 15 });
    } else if (totalIncome > 0 && remainingBalance < totalIncome * 0.1) {
      penaltyPoints += 8;
      penalties.push({ reason: 'Low remaining balance (<10%)', points: 8 });
    }
    
    if (totalIncome === 0 && totalExpense > 0) {
      penaltyPoints += 20;
      penalties.push({ reason: 'Spending with zero income', points: 20 });
    }

    // BONUSES
    if (savingsRate >= 0.3) {
      let pts = 8;
      if (savingsRate >= 0.5) pts += 5;
      bonusPoints += pts;
      bonuses.push({ reason: 'Strong savings rate', points: pts });
    }
    
    if (luxuryRatio < 0.15 && totalExpense > 0) {
      bonusPoints += 5;
      bonuses.push({ reason: 'Controlled luxury spending', points: 5 });
    }
    
    if (consistencyScore > 0.85) {
      bonusPoints += 5;
      bonuses.push({ reason: 'Highly consistent spending pattern', points: 5 });
    }
    
    if (prevTransactions.length > 0 && currentMonthBalance > previousMonthBalance * 1.1) {
      bonusPoints += 5;
      bonuses.push({ reason: 'Positive balance growth vs last month', points: 5 });
    }

    // Final Score
    const finalScore = Math.round(Math.max(0, Math.min(100, baseScore - penaltyPoints + bonusPoints)));

    // Status Classification
    let status: SatisfactionStatus;
    if (finalScore < 30) {
      status = { label: 'Risky', color: '#F04438', emoji: '⚠️', description: 'Your finances need immediate attention' };
    } else if (finalScore < 50) {
      status = { label: 'Moderate', color: '#F79009', emoji: '📊', description: 'Some areas need improvement' };
    } else if (finalScore < 70) {
      status = { label: 'Balanced', color: '#0BA5EC', emoji: '⚖️', description: 'You are managing reasonably well' };
    } else if (finalScore < 85) {
      status = { label: 'Healthy', color: '#12B76A', emoji: '💚', description: 'Great financial discipline' };
    } else {
      status = { label: 'Optimal', color: '#6941C6', emoji: '🏆', description: 'Excellent financial health' };
    }

    const metrics: SatisfactionMetrics = {
      totalIncome,
      totalExpense,
      essentialExpense,
      nonEssentialExpense,
      remainingBalance,
      savingsRate,
      essentialRatio,
      luxuryRatio,
      consistencyScore,
      balanceStability,
      baseScore,
      currentMonthBalance,
      previousMonthBalance,
      penalties,
      bonuses
    };

    return {
      finalScore,
      status,
      metrics
    };
  }
};
