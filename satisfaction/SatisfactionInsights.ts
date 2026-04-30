import { SatisfactionMetrics } from './SatisfactionEngine';

export interface SatisfactionInsight {
  icon: string;
  color: string;
  title: string;
  body: string;
  scoreGain: number;
}

export function generateInsights(metrics: SatisfactionMetrics, finalScore: number): SatisfactionInsight[] {
  const actionableInsights: SatisfactionInsight[] = [];

  // OVERSPENDING
  if (metrics.totalExpense > metrics.totalIncome && metrics.totalIncome > 0) {
     const gap = metrics.totalExpense - metrics.totalIncome;
     actionableInsights.push({
       icon: '⚠️', color: '#F04438',
       title: "You're spending more than you earn",
       body: `Reduce expenses by ₹${gap.toFixed(0)} to break even this month`,
       scoreGain: 15
     });
  }
  
  // HIGH LUXURY
  if (metrics.luxuryRatio > 0.3) {
     const saveAmount = metrics.nonEssentialExpense * 0.2;
     actionableInsights.push({
       icon: '🛍️', color: '#F79009',
       title: "High non-essential spending",
       body: `Cutting non-essentials by 20% could save ₹${saveAmount.toFixed(0)} monthly`,
       scoreGain: 8
     });
  }

  // LOW SAVINGS
  if (metrics.savingsRate < 0.1 && metrics.totalIncome > 0 && metrics.remainingBalance > 0) {
     const target = metrics.totalIncome * 0.1;
     actionableInsights.push({
       icon: '💰', color: '#0BA5EC',
       title: "Savings rate is below 10%",
       body: `Try saving at least ₹${target.toFixed(0)} more this month`,
       scoreGain: 8
     });
  }

  // INCONSISTENT SPENDING
  if (metrics.consistencyScore < 0.5) {
     actionableInsights.push({
       icon: '📈', color: '#6941C6',
       title: "Spending pattern is irregular",
       body: "Setting a weekly budget limit can improve consistency",
       scoreGain: 5
     });
  }

  // NEAR ZERO BALANCE
  if (metrics.remainingBalance < metrics.totalIncome * 0.05 && metrics.remainingBalance >= 0 && metrics.totalIncome > 0) {
     actionableInsights.push({
       icon: '🔴', color: '#F04438',
       title: "Balance running low",
       body: "You have less than 5% of income remaining. Review upcoming expenses",
       scoreGain: 0
     });
  }

  // Positive Reinforcements (added at the end)
  const positiveInsights: SatisfactionInsight[] = [];

  if (metrics.savingsRate >= 0.3) {
     positiveInsights.push({
       icon: '🌱', color: '#12B76A',
       title: "Strong savings this month",
       body: `You're saving ${(metrics.savingsRate * 100).toFixed(0)}% of income. Keep it up!`,
       scoreGain: 0
     });
  }

  if (metrics.essentialRatio >= 0.7) {
     positiveInsights.push({
       icon: '✅', color: '#12B76A',
       title: "Spending priorities are healthy",
       body: "Most of your spending is on essential categories",
       scoreGain: 0
     });
  }

  if (finalScore >= 85) {
     positiveInsights.push({
       icon: '🏆', color: '#6941C6',
       title: "Excellent financial health!",
       body: "You're in the top financial discipline tier this month",
       scoreGain: 0
     });
  }

  // Sort negative/actionable first, then positive
  // Already separated, just combine
  const allInsights = [...actionableInsights, ...positiveInsights];
  
  return allInsights.slice(0, 5);
}
