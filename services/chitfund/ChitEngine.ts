// Chit Fund Computation Engine
// All computations are pure JavaScript - no SQLite writes

export interface ChitFund {
  id: number;
  name: string;
  total_members: number;
  monthly_amount: number;
  total_pot: number;
  duration_months: number;
  start_date: string;
  foreman_commission: number;
  status: 'active' | 'completed' | 'cancelled';
  my_turn_month: number | null;
  notes: string | null;
  created_at: string;
}

export interface ChitMonthlyRecord {
  id: number;
  chit_id: number;
  month_number: number;
  month_date: string;
  amount_paid: number | null;
  payment_date: string | null;
  payment_status: 'pending' | 'paid' | 'missed';
  winner_name: string | null;
  winner_is_me: number;
  bid_amount: number | null;
  pot_amount: number | null;
  commission_deducted: number | null;
  net_received: number | null;
  dividend_received: number | null;
  notes: string | null;
  created_at: string;
}

export interface ChitMember {
  id: number;
  chit_id: number;
  member_name: string;
  member_turn_month: number | null;
  notes: string | null;
}

export interface ChitCalculation {
  totalInvested: number;
  totalReceived: number;
  netPosition: number;
  monthsPaid: number;
  monthsRemaining: number;
  nextMonthDue: number | null;
  myTurnStatus: 'upcoming' | 'completed' | 'not_assigned' | 'passed';
  roi: number;
  annualizedRoi: number;
  bestMonth?: {
    monthNumber: number;
    netReceived: number;
    roi: number;
  };
  worstMonth?: {
    monthNumber: number;
    netReceived: number;
    roi: number;
  };
}

// --- CHIT FUND CALCULATIONS ---

export const calculateChitFundPosition = (
  chitFund: ChitFund,
  monthlyRecords: ChitMonthlyRecord[]
): ChitCalculation => {
  const paidRecords = monthlyRecords.filter(r => r.payment_status === 'paid');
  const myPaidRecords = paidRecords.filter(r => r.amount_paid !== null);
  
  // Calculate total invested
  const totalInvested = myPaidRecords.reduce((sum, record) => sum + (record.amount_paid || 0), 0);
  
  // Calculate total received
  const myWonRecords = monthlyRecords.filter(r => r.winner_is_me === 1 && r.net_received !== null);
  const totalReceived = myWonRecords.reduce((sum, record) => sum + (record.net_received || 0), 0);
  
  // Calculate net position
  const netPosition = totalReceived - totalInvested;
  
  // Calculate months paid and remaining
  const monthsPaid = myPaidRecords.length;
  const monthsRemaining = chitFund.duration_months - monthsPaid;
  
  // Find next month due
  const nextMonthDue = monthlyRecords
    .filter(r => r.payment_status === 'pending')
    .sort((a, b) => a.month_number - b.month_number)[0]?.month_number || null;
  
  // Determine my turn status
  let myTurnStatus: ChitCalculation['myTurnStatus'] = 'not_assigned';
  if (chitFund.my_turn_month !== null) {
    const currentMonth = new Date().getMonth() + 1;
    if (chitFund.my_turn_month < currentMonth) {
      myTurnStatus = 'passed';
    } else if (chitFund.my_turn_month === currentMonth) {
      myTurnStatus = 'upcoming';
    } else {
      myTurnStatus = 'upcoming';
    }
    
    // Check if I already won
    const myWonRecord = monthlyRecords.find(r => r.winner_is_me === 1);
    if (myWonRecord) {
      myTurnStatus = 'completed';
    }
  }
  
  // Calculate ROI
  const roi = totalInvested > 0 ? ((totalReceived - totalInvested) / totalInvested) * 100 : 0;
  
  // Calculate annualized ROI
  const elapsedMonths = monthsPaid;
  const annualizedRoi = elapsedMonths > 0 ? (roi / elapsedMonths) * 12 : 0;
  
  // Find best and worst months
  const completedRecords = monthlyRecords.filter(r => r.winner_name !== null && r.net_received !== null);
  
  let bestMonth, worstMonth;
  if (completedRecords.length > 0) {
    const monthCalculations = completedRecords.map(record => ({
      monthNumber: record.month_number,
      netReceived: record.net_received!,
      roi: record.amount_paid ? ((record.net_received! - record.amount_paid) / record.amount_paid) * 100 : 0
    }));
    
    bestMonth = monthCalculations.reduce((best, current) => 
      current.roi > best.roi ? current : best
    );
    
    worstMonth = monthCalculations.reduce((worst, current) => 
      current.roi < worst.roi ? current : worst
    );
  }
  
  return {
    totalInvested,
    totalReceived,
    netPosition,
    monthsPaid,
    monthsRemaining,
    nextMonthDue,
    myTurnStatus,
    roi,
    annualizedRoi,
    bestMonth,
    worstMonth
  };
};

// --- MONTHLY RECORD CALCULATIONS ---

export const calculateMonthlyPot = (
  chitFund: ChitFund,
  monthNumber: number,
  bidAmount: number | null
): { grossPot: number; commission: number; netPot: number } => {
  const grossPot = chitFund.monthly_amount * chitFund.total_members;
  const commission = grossPot * (chitFund.foreman_commission / 100);
  const netPot = grossPot - commission;
  
  return {
    grossPot,
    commission,
    netPot
  };
};

export const calculateWinnerNetAmount = (
  chitFund: ChitFund,
  monthNumber: number,
  bidAmount: number | null,
  winnerPaidAmount: number | null
): { grossReceived: number; commissionDeducted: number; netReceived: number; dividend: number } => {
  const { grossPot, commission, netPot } = calculateMonthlyPot(chitFund, monthNumber, bidAmount);
  
  let grossReceived = netPot;
  let commissionDeducted = 0;
  let dividend = 0;
  
  if (bidAmount !== null && bidAmount > 0) {
    // In a bidding chit, the winner gets the net pot minus bid amount
    grossReceived = netPot - bidAmount;
    commissionDeducted = bidAmount * (chitFund.foreman_commission / 100);
    dividend = bidAmount - commissionDeducted;
  }
  
  const netReceived = grossReceived - commissionDeducted;
  
  return {
    grossReceived,
    commissionDeducted,
    netReceived,
    dividend
  };
};

// --- CHIT FUND PROJECTIONS ---

export const calculateChitFundProjection = (
  chitFund: ChitFund,
  monthlyRecords: ChitMonthlyRecord[],
  assumedBidAmount: number = 0
): {
  projectedTotalInvestment: number;
  projectedTotalReturn: number;
  projectedNetPosition: number;
  projectedRoi: number;
  monthsToComplete: number;
} => {
  const paidMonths = monthlyRecords.filter(r => r.payment_status === 'paid').length;
  const remainingMonths = chitFund.duration_months - paidMonths;
  
  // Projected total investment
  const projectedTotalInvestment = chitFund.monthly_amount * chitFund.duration_months;
  
  // Calculate projected return based on when I expect to win
  let projectedTotalReturn = 0;
  
  if (chitFund.my_turn_month !== null) {
    const myTurnRecord = monthlyRecords.find(r => r.month_number === chitFund.my_turn_month);
    if (myTurnRecord && myTurnRecord.net_received !== null) {
      // I already won
      projectedTotalReturn = myTurnRecord.net_received;
    } else {
      // I will win in my turn month
      const { netReceived } = calculateWinnerNetAmount(
        chitFund,
        chitFund.my_turn_month,
        assumedBidAmount,
        chitFund.monthly_amount
      );
      projectedTotalReturn = netReceived;
    }
  } else {
    // No assigned turn, assume average return
    const avgMonthlyReturn = (chitFund.monthly_amount * chitFund.total_members * (1 - chitFund.foreman_commission / 100)) / chitFund.total_members;
    projectedTotalReturn = avgMonthlyReturn;
  }
  
  const projectedNetPosition = projectedTotalReturn - projectedTotalInvestment;
  const projectedRoi = projectedTotalInvestment > 0 ? (projectedNetPosition / projectedTotalInvestment) * 100 : 0;
  
  return {
    projectedTotalInvestment,
    projectedTotalReturn,
    projectedNetPosition,
    projectedRoi,
    monthsToComplete: remainingMonths
  };
};

// --- CHIT FUND ANALYSIS ---

export const analyzeChitFundPerformance = (
  chitFund: ChitFund,
  monthlyRecords: ChitMonthlyRecord[]
): {
  averageBidAmount: number;
  highestBidAmount: number;
  lowestBidAmount: number;
  biddingFrequency: number; // Percentage of months with bidding
  averageMonthlyReturn: number;
  volatilityIndex: number; // Standard deviation of returns
  paymentCompliance: number; // Percentage of payments made on time
} => {
  const completedRecords = monthlyRecords.filter(r => r.winner_name !== null);
  const biddingRecords = completedRecords.filter(r => r.bid_amount !== null && r.bid_amount > 0);
  
  // Bid analysis
  const bidAmounts = biddingRecords.map(r => r.bid_amount!);
  const averageBidAmount = bidAmounts.length > 0 ? bidAmounts.reduce((sum, bid) => sum + bid, 0) / bidAmounts.length : 0;
  const highestBidAmount = bidAmounts.length > 0 ? Math.max(...bidAmounts) : 0;
  const lowestBidAmount = bidAmounts.length > 0 ? Math.min(...bidAmounts) : 0;
  const biddingFrequency = completedRecords.length > 0 ? (biddingRecords.length / completedRecords.length) * 100 : 0;
  
  // Return analysis
  const monthlyReturns = completedRecords.map(r => r.net_received || 0);
  const averageMonthlyReturn = monthlyReturns.length > 0 ? monthlyReturns.reduce((sum, ret) => sum + ret, 0) / monthlyReturns.length : 0;
  
  // Volatility (standard deviation)
  const variance = monthlyReturns.length > 0 ? 
    monthlyReturns.reduce((sum, ret) => {
      const diff = ret - averageMonthlyReturn;
      return sum + (diff * diff);
    }, 0) / monthlyReturns.length : 0;
  const volatilityIndex = Math.sqrt(variance);
  
  // Payment compliance
  const expectedPayments = monthlyRecords.length;
  const actualPayments = monthlyRecords.filter(r => r.payment_status === 'paid').length;
  const paymentCompliance = expectedPayments > 0 ? (actualPayments / expectedPayments) * 100 : 0;
  
  return {
    averageBidAmount,
    highestBidAmount,
    lowestBidAmount,
    biddingFrequency,
    averageMonthlyReturn,
    volatilityIndex,
    paymentCompliance
  };
};

// --- CHIT FUND COMPARISON ---

export const compareChitFunds = (
  chitFunds: Array<{ chitFund: ChitFund; calculation: ChitCalculation }>
): {
  bestPerforming: { chitFund: ChitFund; roi: number } | null;
  worstPerforming: { chitFund: ChitFund; roi: number } | null;
  highestInvestment: { chitFund: ChitFund; amount: number } | null;
  lowestInvestment: { chitFund: ChitFund; amount: number } | null;
  averageRoi: number;
  totalInvestment: number;
  totalReturn: number;
} => {
  if (chitFunds.length === 0) {
    return {
      bestPerforming: null,
      worstPerforming: null,
      highestInvestment: null,
      lowestInvestment: null,
      averageRoi: 0,
      totalInvestment: 0,
      totalReturn: 0
    };
  }
  
  // Find best and worst performing
  const bestPerforming = chitFunds.reduce((best, current) => 
    current.calculation.roi > best.calculation.roi ? current : best
  );
  
  const worstPerforming = chitFunds.reduce((worst, current) => 
    current.calculation.roi < worst.calculation.roi ? current : worst
  );
  
  // Find highest and lowest investment
  const highestInvestment = chitFunds.reduce((highest, current) => 
    current.calculation.totalInvested > highest.calculation.totalInvested ? current : highest
  );
  
  const lowestInvestment = chitFunds.reduce((lowest, current) => 
    current.calculation.totalInvested < lowest.calculation.totalInvested ? current : lowest
  );
  
  // Calculate averages and totals
  const totalInvestment = chitFunds.reduce((sum, current) => sum + current.calculation.totalInvested, 0);
  const totalReturn = chitFunds.reduce((sum, current) => sum + current.calculation.totalReceived, 0);
  const averageRoi = chitFunds.reduce((sum, current) => sum + current.calculation.roi, 0) / chitFunds.length;
  
  return {
    bestPerforming: { chitFund: bestPerforming.chitFund, roi: bestPerforming.calculation.roi },
    worstPerforming: { chitFund: worstPerforming.chitFund, roi: worstPerforming.calculation.roi },
    highestInvestment: { chitFund: highestInvestment.chitFund, amount: highestInvestment.calculation.totalInvested },
    lowestInvestment: { chitFund: lowestInvestment.chitFund, amount: lowestInvestment.calculation.totalInvested },
    averageRoi,
    totalInvestment,
    totalReturn
  };
};

// --- CHIT FUND RECOMMENDATIONS ---

export const generateChitFundRecommendations = (
  chitFund: ChitFund,
  calculation: ChitCalculation,
  analysis: ReturnType<typeof analyzeChitFundPerformance>
): {
  riskLevel: 'low' | 'medium' | 'high';
  recommendation: string;
  actionItems: string[];
} => {
  const riskLevel = calculation.roi > 10 ? 'low' : calculation.roi > 0 ? 'medium' : 'high';
  
  let recommendation = '';
  let actionItems: string[] = [];
  
  if (riskLevel === 'low') {
    recommendation = 'This chit fund is performing well with good returns.';
    actionItems = [
      'Continue regular payments',
      'Monitor monthly performance',
      'Consider reinvesting returns'
    ];
  } else if (riskLevel === 'medium') {
    recommendation = 'This chit fund has moderate returns. Monitor closely.';
    actionItems = [
      'Ensure timely payments',
      'Track bidding patterns',
      'Consider exit strategies if needed'
    ];
  } else {
    recommendation = 'This chit fund has poor returns. Review your participation.';
    actionItems = [
      'Review payment history',
      'Consider early exit options',
      'Evaluate alternative investments'
    ];
  }
  
  if (analysis.paymentCompliance < 80) {
    actionItems.push('Improve payment compliance - missing payments affects returns');
  }
  
  if (analysis.volatilityIndex > 1000) {
    actionItems.push('High volatility detected - be prepared for fluctuations');
  }
  
  return {
    riskLevel,
    recommendation,
    actionItems
  };
};
