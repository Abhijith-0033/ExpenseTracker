export interface SinkingFund {
  id: number;
  name: string;
  target_amount: number;
  target_date: string;
  category_id?: number;
  start_date: string;
  monthly_contribution: number;
  current_saved: number;
  linked_account_id?: number;
  status: 'active' | 'completed' | 'paused';
  is_recurring_annual: number;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface SinkingFundContribution {
  id: number;
  fund_id: number;
  amount: number;
  contribution_date: string;
  account_id?: number;
  transaction_id?: number;
  notes?: string;
  created_at: string;
}

export interface FundStatus {
  totalSaved: number;
  remaining: number;
  percentComplete: number;
  isOnTrack: boolean;
  status: 'on_track' | 'behind' | 'completed' | 'overdue';
  catchUpMonthly: number;
  monthsRemaining: number;
}

export function monthsBetween(from: Date | string, to: Date | string): number {
  const f = typeof from === 'string' ? new Date(from) : from;
  const t = typeof to === 'string' ? new Date(to) : to;
  return (t.getFullYear() - f.getFullYear()) * 12 + (t.getMonth() - f.getMonth());
}

export function calculateMonthlyContribution(
  targetAmount: number,
  startDate: string,
  targetDate: string
): number {
  const months = monthsBetween(startDate, targetDate);
  if (months <= 0) return targetAmount;
  return Math.ceil(targetAmount / months);
}

export function getFundStatus(fund: SinkingFund, totalSaved: number): FundStatus {
  const remaining = Math.max(0, fund.target_amount - totalSaved);
  const percentComplete = fund.target_amount > 0
    ? (totalSaved / fund.target_amount) * 100 : 0;

  const today = new Date();
  const targetDate = new Date(fund.target_date);
  const startDate = new Date(fund.start_date);

  const monthsRemaining = Math.max(0, monthsBetween(today, targetDate));
  const totalMonths = Math.max(1, monthsBetween(startDate, targetDate));
  const monthsElapsed = Math.max(0, monthsBetween(startDate, today));

  const expectedSavedByNow = (fund.target_amount / totalMonths) * monthsElapsed;
  const isOnTrack = totalSaved >= expectedSavedByNow * 0.9;

  let status: FundStatus['status'];
  if (percentComplete >= 100) {
    status = 'completed';
  } else if (monthsRemaining <= 0 && remaining > 0) {
    status = 'overdue';
  } else if (isOnTrack) {
    status = 'on_track';
  } else {
    status = 'behind';
  }

  const catchUpMonthly = monthsRemaining > 0
    ? Math.ceil(remaining / monthsRemaining)
    : remaining;

  return { totalSaved, remaining, percentComplete, isOnTrack, status, catchUpMonthly, monthsRemaining };
}
