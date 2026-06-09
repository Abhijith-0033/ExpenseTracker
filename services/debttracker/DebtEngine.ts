// Debt Tracker Computation Engine
// All computations are pure JavaScript - no SQLite writes

export interface DebtRecord {
  id: number;
  name: string;
  description?: string;
  principal: number;
  interest_rate: number;
  interest_type: 'none' | 'simple' | 'compound_monthly' | 'compound_quarterly' | 'compound_half_yearly' | 'compound_yearly';
  repayment_freq: 'daily' | 'weekly' | 'monthly' | 'custom';
  custom_freq_days?: number;
  start_date: string;
  expected_end_date?: string;
  status: 'active' | 'completed' | 'written_off';
  direction: 'borrowed' | 'lent';
  created_at: string;
  updated_at: string;
}

export interface DebtRepayment {
  id: number;
  debt_id: number;
  amount: number;
  payment_date: string;
  payment_type: 'principal' | 'interest' | 'both';
  note?: string;
  account_id?: number;
  created_at: string;
}

export interface DebtCalculation {
  principal: number;
  accruedInterest: number;
  totalAccrued: number;
  totalRepaid: number;
  currentBalance: number;
  principalRemaining: number;
  isOverdue: boolean;
  nextDueDate?: string;
  daysOverdue?: number;
  payoffProjection?: {
    projectedPayoffDate: string;
    totalInterestToBePaid: number;
    totalAmountToBePaid: number;
  };
}

// --- INTEREST COMPUTATION FUNCTIONS ---

export const computeInterest = (
  principal: number,
  rate: number,
  type: DebtRecord['interest_type'],
  years: number
): number => {
  if (rate === 0 || type === 'none') return 0;
  
  switch (type) {
    case 'simple':
      return principal * (rate / 100) * years;
      
    case 'compound_monthly':
      const nMonthly = 12;
      return principal * Math.pow(1 + rate / (100 * nMonthly), nMonthly * years) - principal;
      
    case 'compound_quarterly':
      const nQuarterly = 4;
      return principal * Math.pow(1 + rate / (100 * nQuarterly), nQuarterly * years) - principal;
      
    case 'compound_half_yearly':
      const nHalfYearly = 2;
      return principal * Math.pow(1 + rate / (100 * nHalfYearly), nHalfYearly * years) - principal;
      
    case 'compound_yearly':
      return principal * Math.pow(1 + rate / 100, years) - principal;
      
    default:
      return 0;
  }
};

// --- CURRENT BALANCE CALCULATION ---

export const calculateCurrentBalance = (
  debt: DebtRecord,
  repayments: DebtRepayment[],
  asOfDate: string = new Date().toISOString().split('T')[0]
): DebtCalculation => {
  const startDate = new Date(debt.start_date);
  const currentDate = new Date(asOfDate);
  
  // Calculate elapsed time
  const elapsedMs = currentDate.getTime() - startDate.getTime();
  const elapsedDays = Math.max(0, elapsedMs / (1000 * 60 * 60 * 24));
  const elapsedYears = elapsedDays / 365;
  
  // Calculate accrued interest
  const accruedInterest = computeInterest(debt.principal, debt.interest_rate, debt.interest_type, elapsedYears);
  const totalAccrued = debt.principal + accruedInterest;
  
  // Calculate total repaid
  const totalRepaid = repayments.reduce((sum, payment) => sum + payment.amount, 0);
  
  // Calculate current balance
  const currentBalance = Math.max(0, totalAccrued - totalRepaid);
  const principalRemaining = Math.max(0, debt.principal - totalRepaid);
  
  // Calculate next due date
  const { nextDueDate, daysOverdue } = calculateNextDueDate(debt, repayments, asOfDate);
  
  // Calculate payoff projection (simplified - assumes fixed monthly payments)
  const payoffProjection = currentBalance > 0 ? calculatePayoffProjection(debt, currentBalance, asOfDate) : undefined;
  
  return {
    principal: debt.principal,
    accruedInterest,
    totalAccrued,
    totalRepaid,
    currentBalance,
    principalRemaining,
    isOverdue: daysOverdue !== undefined && daysOverdue > 0,
    nextDueDate,
    daysOverdue,
    payoffProjection
  };
};

// --- NEXT PAYMENT DUE DATE CALCULATION ---

export const calculateNextDueDate = (
  debt: DebtRecord,
  repayments: DebtRepayment[],
  asOfDate: string = new Date().toISOString().split('T')[0]
): { nextDueDate?: string; daysOverdue?: number } => {
  const startDate = new Date(debt.start_date);
  const currentDate = new Date(asOfDate);
  
  // Get the most recent payment date
  const sortedPayments = [...repayments].sort((a, b) => 
    new Date(b.payment_date).getTime() - new Date(a.payment_date).getTime()
  );
  
  let lastPaymentDate = startDate;
  if (sortedPayments.length > 0) {
    lastPaymentDate = new Date(sortedPayments[0].payment_date);
  }
  
  let nextDueDate: Date;
  
  switch (debt.repayment_freq) {
    case 'daily':
      nextDueDate = new Date(lastPaymentDate);
      nextDueDate.setDate(nextDueDate.getDate() + 1);
      break;
      
    case 'weekly':
      nextDueDate = new Date(lastPaymentDate);
      nextDueDate.setDate(nextDueDate.getDate() + 7);
      break;
      
    case 'monthly':
      nextDueDate = new Date(lastPaymentDate);
      nextDueDate.setMonth(nextDueDate.getMonth() + 1);
      break;
      
    case 'custom':
      if (debt.custom_freq_days) {
        nextDueDate = new Date(lastPaymentDate);
        nextDueDate.setDate(nextDueDate.getDate() + debt.custom_freq_days);
      } else {
        // Default to monthly if custom_freq_days is not set
        nextDueDate = new Date(lastPaymentDate);
        nextDueDate.setMonth(nextDueDate.getMonth() + 1);
      }
      break;
      
    default:
      nextDueDate = new Date(lastPaymentDate);
      nextDueDate.setMonth(nextDueDate.getMonth() + 1);
  }
  
  const daysOverdue = Math.floor((currentDate.getTime() - nextDueDate.getTime()) / (1000 * 60 * 60 * 24));
  
  return {
    nextDueDate: nextDueDate.toISOString().split('T')[0],
    daysOverdue: daysOverdue > 0 ? daysOverdue : undefined
  };
};

// --- PAYOFF PROJECTION ---

export const calculatePayoffProjection = (
  debt: DebtRecord,
  currentBalance: number,
  asOfDate: string
): DebtCalculation['payoffProjection'] => {
  // Simplified projection - assumes fixed monthly payment based on repayment frequency
  let monthlyPayment = 0;
  
  switch (debt.repayment_freq) {
    case 'daily':
      monthlyPayment = currentBalance / 30; // Rough estimate
      break;
    case 'weekly':
      monthlyPayment = (currentBalance / 52) * 4; // 4 weeks per month
      break;
    case 'monthly':
      monthlyPayment = currentBalance / 12; // 1 year estimate
      break;
    case 'custom':
      if (debt.custom_freq_days) {
        monthlyPayment = (currentBalance / 365) * (30 / debt.custom_freq_days);
      } else {
        monthlyPayment = currentBalance / 12;
      }
      break;
  }
  
  // If no meaningful payment can be calculated, return undefined
  if (monthlyPayment <= 0) return undefined;
  
  let projectedBalance = currentBalance;
  let totalInterestPaid = 0;
  let monthsToPayoff = 0;
  const maxMonths = 360; // 30 years max to prevent infinite loops
  
  while (projectedBalance > 0 && monthsToPayoff < maxMonths) {
    monthsToPayoff++;
    
    // Calculate interest for this month
    const monthlyInterestRate = debt.interest_rate / 12 / 100;
    const interestForMonth = projectedBalance * monthlyInterestRate;
    
    // Apply payment
    const principalPayment = Math.min(monthlyPayment - interestForMonth, projectedBalance);
    totalInterestPaid += interestForMonth;
    projectedBalance -= principalPayment;
  }
  
  const projectedPayoffDate = new Date(asOfDate);
  projectedPayoffDate.setMonth(projectedPayoffDate.getMonth() + monthsToPayoff);
  
  return {
    projectedPayoffDate: projectedPayoffDate.toISOString().split('T')[0],
    totalInterestToBePaid: totalInterestPaid,
    totalAmountToBePaid: currentBalance + totalInterestPaid
  };
};

// --- INTEREST PREVIEW FOR FORM ---

export const calculateInterestPreview = (
  principal: number,
  rate: number,
  type: DebtRecord['interest_type'],
  years: number = 1
): { totalAmount: number; interestAmount: number } => {
  const interestAmount = computeInterest(principal, rate, type, years);
  const totalAmount = principal + interestAmount;
  
  return {
    totalAmount,
    interestAmount
  };
};

// --- DEBT SUMMARY CALCULATIONS ---

export const calculateDebtSummary = (debts: DebtRecord[], repayments: DebtRepayment[]) => {
  const activeBorrowed = debts.filter(d => d.direction === 'borrowed' && d.status === 'active');
  const activeLent = debts.filter(d => d.direction === 'lent' && d.status === 'active');
  
  let totalBorrowedBalance = 0;
  let totalLentBalance = 0;
  let overdueCount = 0;
  
  activeBorrowed.forEach(debt => {
    const debtRepayments = repayments.filter(r => r.debt_id === debt.id);
    const calculation = calculateCurrentBalance(debt, debtRepayments);
    totalBorrowedBalance += calculation.currentBalance;
    if (calculation.isOverdue) overdueCount++;
  });
  
  activeLent.forEach(debt => {
    const debtRepayments = repayments.filter(r => r.debt_id === debt.id);
    const calculation = calculateCurrentBalance(debt, debtRepayments);
    totalLentBalance += calculation.currentBalance;
  });
  
  return {
    totalOwed: totalBorrowedBalance,
    totalOwedToMe: totalLentBalance,
    overdueCount,
    activeBorrowedCount: activeBorrowed.length,
    activeLentCount: activeLent.length
  };
};

// --- PAYMENT HISTORY ANALYSIS ---

export const analyzePaymentHistory = (debt: DebtRecord, repayments: DebtRepayment[]) => {
  const sortedRepayments = [...repayments].sort((a, b) => 
    new Date(a.payment_date).getTime() - new Date(b.payment_date).getTime()
  );
  
  const balanceHistory: { date: string; balance: number; payment: number }[] = [];
  let runningBalance = debt.principal;
  
  // Add starting point
  balanceHistory.push({
    date: debt.start_date,
    balance: debt.principal,
    payment: 0
  });
  
  // Calculate balance after each payment
  sortedRepayments.forEach(payment => {
    runningBalance = Math.max(0, runningBalance - payment.amount);
    balanceHistory.push({
      date: payment.payment_date,
      balance: runningBalance,
      payment: payment.amount
    });
  });
  
  // Calculate payment composition
  const totalPaid = repayments.reduce((sum, r) => sum + r.amount, 0);
  const principalPaid = repayments
    .filter(r => r.payment_type === 'principal' || r.payment_type === 'both')
    .reduce((sum, r) => sum + r.amount, 0);
  const interestPaid = repayments
    .filter(r => r.payment_type === 'interest' || r.payment_type === 'both')
    .reduce((sum, r) => sum + r.amount, 0);
  
  // Monthly payment analysis
  const monthlyPayments: Record<string, number> = {};
  repayments.forEach(payment => {
    const month = payment.payment_date.substring(0, 7); // YYYY-MM
    monthlyPayments[month] = (monthlyPayments[month] || 0) + payment.amount;
  });
  
  return {
    balanceHistory,
    totalPaid,
    principalPaid,
    interestPaid,
    monthlyPayments
  };
};
