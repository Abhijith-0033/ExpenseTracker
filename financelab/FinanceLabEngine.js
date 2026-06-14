/**
 * FinanceLabEngine.js
 * 
 * Pure READ-ONLY analytics engine for the Financial Intelligence Module.
 * Queries existing SQLite tables: transactions, accounts, savings_goals,
 * savings_contributions, emi_records, emi_payments, debts, subscriptions.
 * 
 * ABSOLUTE RULES:
 * - No INSERT, UPDATE, or DELETE statements
 * - No modification to existing analytics code
 * - All computations in JS after lightweight SQL aggregations
 */

import { getDatabase, initDatabase } from '../services/database';
import { getMergedClassifications } from '../satisfaction/categoryClassification';
import { startOfMonth, endOfMonth, subMonths, format, differenceInMonths } from 'date-fns';
import { safeDivide, clamp } from '../utils/mathUtils';

// ─── Helpers ────────────────────────────────────────────────────────────────

const ensureDb = async () => {
    await initDatabase();
    return getDatabase();
};

/** Returns ISO range strings for the most recent N complete calendar months (not including current partial month) */
const getLastNMonthsRange = (n) => {
    const now = new Date();
    const end = endOfMonth(subMonths(now, 1));       // Last full month end
    const start = startOfMonth(subMonths(now, n));   // N months ago start
    return { start: start.toISOString(), end: end.toISOString() };
};

/** Returns ISO range for the current calendar month */
const getCurrentMonthRange = () => {
    const now = new Date();
    return {
        start: startOfMonth(now).toISOString(),
        end: endOfMonth(now).toISOString(),
    };
};

// ─── Core Data Fetchers ───────────────────────────────────────────────────────

/**
 * Fetch aggregated monthly income and expense for the last N+1 months (including current).
 * Returns array of { month: 'YYYY-MM', income, expense }
 */
async function fetchMonthlyIncomeExpense(monthsBack = 6) {
    const db = await ensureDb();
    const now = new Date();
    const start = startOfMonth(subMonths(now, monthsBack)).toISOString();
    const end = endOfMonth(now).toISOString();

    const rows = await db.getAllAsync(
        `SELECT substr(date, 1, 7) as month, category, SUM(amount) as total
         FROM transactions
         WHERE date >= ? AND date <= ?
           AND category != 'Transfer'
         GROUP BY substr(date, 1, 7), CASE WHEN category = 'Income' THEN 'Income' ELSE 'expense' END
         ORDER BY month ASC`,
        [start, end]
    );

    // Aggregate into { 'YYYY-MM': { income, expense } }
    const map = {};
    rows.forEach(row => {
        if (!map[row.month]) map[row.month] = { income: 0, expense: 0 };
        if (row.category === 'Income') {
            map[row.month].income += row.total;
        } else if (row.category !== 'Debt/Credit') {
            map[row.month].expense += row.total;
        }
    });

    // Fill in all months so we don't have gaps
    const result = [];
    for (let i = monthsBack; i >= 0; i--) {
        const m = format(subMonths(now, i), 'yyyy-MM');
        result.push({ month: m, ...(map[m] || { income: 0, expense: 0 }) });
    }
    return result;
}

/**
 * Fetch expense totals per category for date range, with essential/non-essential split.
 * Returns { essential, nonEssential, byCategory: [{category, total, type}] }
 */
async function fetchExpenseBreakdown(startIso, endIso) {
    const db = await ensureDb();
    const classifications = await getMergedClassifications();

    const rows = await db.getAllAsync(
        `SELECT category, SUM(amount) as total
         FROM transactions
         WHERE date >= ? AND date <= ?
           AND category != 'Income' AND category != 'Transfer' AND category != 'Debt/Credit'
         GROUP BY category`,
        [startIso, endIso]
    );

    let essential = 0;
    let nonEssential = 0;
    const byCategory = rows.map(row => {
        const type = classifications[row.category] || 'non-essential';
        if (type === 'essential') essential += row.total;
        else nonEssential += row.total;
        return { category: row.category, total: row.total, type };
    });

    return { essential, nonEssential, byCategory };
}

/**
 * Fetch total account balance (sum of all real accounts, excluding meta).
 */
async function fetchTotalAccountBalance() {
    const db = await ensureDb();
    const result = await db.getFirstAsync(
        `SELECT COALESCE(SUM(balance), 0) as total
         FROM accounts
         WHERE type != 'meta_categories'`
    );
    return result ? result.total : 0;
}

/**
 * Fetch total active debt (I owe) and total receivables (they owe me).
 */
async function fetchDebtSummary() {
    const db = await ensureDb();

    // Legacy debts table
    const legacyDebts = await db.getAllAsync(
        `SELECT type, COALESCE(SUM(amount), 0) as total FROM debts GROUP BY type`
    );

    // Advanced debt_records table
    const advancedDebts = await db.getAllAsync(
        `SELECT direction, COALESCE(SUM(principal), 0) as principal_total,
                COALESCE(SUM(principal), 0) as total
         FROM debt_records WHERE status = 'active'
         GROUP BY direction`
    );

    // Compute repaid amounts from debt_repayments
    const repayments = await db.getFirstAsync(
        `SELECT COALESCE(SUM(dr.amount), 0) as repaid
         FROM debt_repayments dr
         JOIN debt_records rec ON dr.debt_id = rec.id
         WHERE rec.status = 'active' AND dr.payment_type = 'principal'`
    );
    const totalRepaid = repayments ? repayments.repaid : 0;

    let legacyOwed = 0;   // I owe
    let legacyReceivable = 0; // They owe me
    legacyDebts.forEach(d => {
        if (d.type === 'debt') legacyOwed += d.total;
        else legacyReceivable += d.total;
    });

    let advancedOwed = 0;
    let advancedReceivable = 0;
    advancedDebts.forEach(d => {
        if (d.direction === 'borrowed') advancedOwed += d.total;
        else advancedReceivable += d.total;
    });
    advancedOwed = Math.max(0, advancedOwed - totalRepaid);

    return {
        totalDebt: legacyOwed + advancedOwed,
        totalReceivable: legacyReceivable + advancedReceivable,
    };
}

/**
 * Fetch monthly EMI obligations (sum of active EMI amounts).
 */
async function fetchMonthlyEMIObligations() {
    const db = await ensureDb();
    const result = await db.getFirstAsync(
        `SELECT COALESCE(SUM(emi_amount), 0) as total
         FROM emi_records WHERE status = 'active'`
    );
    return result ? result.total : 0;
}

/**
 * Fetch active subscriptions monthly cost (normalized to monthly).
 */
async function fetchMonthlySubscriptionCost() {
    const db = await ensureDb();
    const subs = await db.getAllAsync(
        `SELECT amount, billing_cycle, custom_interval_value, custom_interval_unit
         FROM subscriptions WHERE is_active = 1 AND (status IS NULL OR status = 'active')`
    );

    let monthlyTotal = 0;
    subs.forEach(sub => {
        switch (sub.billing_cycle) {
            case 'monthly':   monthlyTotal += sub.amount; break;
            case 'quarterly': monthlyTotal += sub.amount / 3; break;
            case 'yearly':    monthlyTotal += sub.amount / 12; break;
            case 'custom': {
                if (sub.custom_interval_value && sub.custom_interval_unit) {
                    if (sub.custom_interval_unit === 'months') {
                        monthlyTotal += sub.amount / sub.custom_interval_value;
                    } else if (sub.custom_interval_unit === 'weeks') {
                        monthlyTotal += (sub.amount * 4.33) / sub.custom_interval_value;
                    } else if (sub.custom_interval_unit === 'days') {
                        monthlyTotal += (sub.amount * 30.44) / sub.custom_interval_value;
                    }
                }
                break;
            }
            default: monthlyTotal += sub.amount;
        }
    });

    return monthlyTotal;
}

/**
 * Fetch active savings goals summary.
 */
async function fetchSavingsGoals() {
    const db = await ensureDb();
    const goals = await db.getAllAsync(
        `SELECT id, name, target_amount, current_amount, deadline, is_completed
         FROM savings_goals WHERE is_completed = 0
         ORDER BY deadline ASC`
    );
    const total_saved = goals.reduce((sum, g) => sum + g.current_amount, 0);
    const total_target = goals.reduce((sum, g) => sum + g.target_amount, 0);
    return { goals, total_saved, total_target };
}

/**
 * Fetch last 6 months expense totals per month for burn rate / runway.
 */
async function fetchMonthlyExpenseTrend(monthsBack = 6) {
    const data = await fetchMonthlyIncomeExpense(monthsBack);
    return data.map(d => ({ month: d.month, expense: d.expense, income: d.income }));
}

// ─── Metric Computations ────────────────────────────────────────────────────

/**
 * 1. SAVINGS RATE
 * Formula: (Income - Expense) / Income * 100
 * Benchmark: <10% Poor | 10–20% Fair | 20–30% Good | >30% Excellent
 */
export async function computeSavingsRate() {
    const { start, end } = getCurrentMonthRange();
    const db = await ensureDb();

    const rows = await db.getAllAsync(
        `SELECT category, SUM(amount) as total
         FROM transactions
         WHERE date >= ? AND date <= ?
           AND category != 'Transfer' AND category != 'Debt/Credit'
         GROUP BY CASE WHEN category = 'Income' THEN 'Income' ELSE 'expense' END`,
        [start, end]
    );

    let income = 0;
    let expense = 0;
    rows.forEach(r => {
        if (r.category === 'Income') income += r.total;
        else expense += r.total;
    });

    const rate = safeDivide(income - expense, income, 0) * 100;
    const saved = income - expense;

    // Trend: last 3 months
    const trend = await fetchMonthlyIncomeExpense(3);
    const trendRates = trend.map(m => ({
        month: m.month,
        value: m.income > 0 ? Math.round(safeDivide(m.income - m.expense, m.income, 0) * 100) : 0,
    }));

    return {
        income,
        expense,
        saved,
        rate: Math.round(rate),
        trendRates,
        benchmark: rate < 10 ? 'Poor' : rate < 20 ? 'Fair' : rate < 30 ? 'Good' : 'Excellent',
        benchmarkColor: rate < 10 ? '#F04438' : rate < 20 ? '#F79009' : rate < 30 ? '#0BA5EC' : '#12B76A',
    };
}

/**
 * 2. BURN RATE & RUNWAY
 * Burn Rate: avg monthly expense (last 3 months)
 * Runway: total account balance / burn rate (months)
 */
export async function computeBurnRateRunway() {
    const trend = await fetchMonthlyIncomeExpense(5);
    const completedMonths = trend.slice(0, -1); // exclude current partial month

    const avgExpense = completedMonths.length > 0
        ? completedMonths.reduce((s, m) => s + m.expense, 0) / completedMonths.length
        : 0;

    const totalBalance = await fetchTotalAccountBalance();
    const runway = avgExpense > 0 ? totalBalance / avgExpense : Infinity;

    const monthlyExpenses = trend.map(m => ({ month: m.month, value: Math.round(m.expense) }));

    return {
        burnRate: Math.round(avgExpense),
        totalBalance: Math.round(totalBalance),
        runway: isFinite(runway) ? Math.round(runway * 10) / 10 : null,
        monthlyExpenses,
        status: runway === Infinity ? 'No Burn' :
                runway < 1 ? 'Critical' :
                runway < 3 ? 'Low' :
                runway < 6 ? 'Moderate' : 'Healthy',
        statusColor: runway === Infinity ? '#12B76A' :
                     runway < 1 ? '#F04438' :
                     runway < 3 ? '#F79009' :
                     runway < 6 ? '#0BA5EC' : '#12B76A',
    };
}

/**
 * 3. 50/30/20 RULE ANALYSIS
 * Needs: Essential expenses
 * Wants: Non-essential expenses
 * Savings: Income - Total Expense
 */
export async function compute503020() {
    const { start, end } = getCurrentMonthRange();
    const breakdown = await fetchExpenseBreakdown(start, end);

    const db = await ensureDb();
    const incomeRow = await db.getFirstAsync(
        `SELECT COALESCE(SUM(amount), 0) as total FROM transactions
         WHERE date >= ? AND date <= ? AND category = 'Income'`,
        [start, end]
    );
    const income = incomeRow ? incomeRow.total : 0;
    const totalExpense = breakdown.essential + breakdown.nonEssential;
    const savings = income - totalExpense;

    const needsPct = safeDivide(breakdown.essential, income, 0) * 100;
    const wantsPct = safeDivide(breakdown.nonEssential, income, 0) * 100;
    const savingsPct = safeDivide(Math.max(savings, 0), income, 0) * 100;

    // Score: how close to ideal 50/30/20
    const needsDiff = Math.abs(needsPct - 50);
    const wantsDiff = Math.abs(wantsPct - 30);
    const savingsDiff = Math.abs(savingsPct - 20);
    const score = Math.max(0, 100 - needsDiff - wantsDiff - savingsDiff);

    return {
        income,
        needs: breakdown.essential,
        wants: breakdown.nonEssential,
        savings: Math.max(savings, 0),
        needsPct: Math.round(needsPct),
        wantsPct: Math.round(wantsPct),
        savingsPct: Math.round(savingsPct),
        idealNeeds: 50,
        idealWants: 30,
        idealSavings: 20,
        adherenceScore: Math.round(score),
        topEssential: breakdown.byCategory.filter(c => c.type === 'essential').sort((a, b) => b.total - a.total).slice(0, 3),
        topNonEssential: breakdown.byCategory.filter(c => c.type === 'non-essential').sort((a, b) => b.total - a.total).slice(0, 3),
    };
}

/**
 * 4. DEBT-TO-INCOME RATIO (DTI)
 * Formula: Total Monthly Debt Obligations / Monthly Income * 100
 * Obligations = EMIs + estimated monthly debt repayment
 * Benchmark: <20% Healthy | 20-36% Caution | >36% High Risk
 */
export async function computeDTI() {
    const { start, end } = getCurrentMonthRange();
    const db = await ensureDb();

    const incomeRow = await db.getFirstAsync(
        `SELECT COALESCE(SUM(amount), 0) as total FROM transactions
         WHERE date >= ? AND date <= ? AND category = 'Income'`,
        [start, end]
    );
    const monthlyIncome = incomeRow ? incomeRow.total : 0;

    const monthlyEMI = await fetchMonthlyEMIObligations();
    const { totalDebt } = await fetchDebtSummary();
    // Estimate monthly obligation on informal debts (assume 12-month repayment by default)
    const informalMonthlyObligation = totalDebt > 0 ? totalDebt / 12 : 0;
    const totalMonthlyDebt = monthlyEMI + informalMonthlyObligation;

    const dti = safeDivide(totalMonthlyDebt, monthlyIncome, 0) * 100;

    // Trend (last 3 months EMI vs income)
    const trend = await fetchMonthlyIncomeExpense(3);
    const dtiTrend = trend.map(m => ({
        month: m.month,
        value: m.income > 0 ? Math.round(safeDivide(monthlyEMI, m.income, 0) * 100) : 0,
    }));

    return {
        monthlyIncome: Math.round(monthlyIncome),
        monthlyEMI: Math.round(monthlyEMI),
        informalMonthlyObligation: Math.round(informalMonthlyObligation),
        totalMonthlyDebt: Math.round(totalMonthlyDebt),
        dti: Math.round(dti),
        dtiTrend,
        status: dti < 20 ? 'Healthy' : dti < 36 ? 'Caution' : 'High Risk',
        statusColor: dti < 20 ? '#12B76A' : dti < 36 ? '#F79009' : '#F04438',
    };
}

/**
 * 5. NET WORTH SNAPSHOT
 * Net Worth = Total Assets (account balances) - Total Liabilities (debts + active EMI remaining)
 */
export async function computeNetWorth() {
    const totalBalance = await fetchTotalAccountBalance();
    const { totalDebt } = await fetchDebtSummary();

    // EMI remaining = sum of pending payments principal
    const db = await ensureDb();
    const emiResult = await db.getFirstAsync(
        `SELECT COALESCE(SUM(ep.outstanding_balance), 0) as total
         FROM emi_payments ep
         JOIN emi_records er ON ep.emi_id = er.id
         WHERE er.status = 'active' AND ep.payment_status = 'pending'
         AND ep.month_number = (
           SELECT MIN(ep2.month_number) FROM emi_payments ep2
           WHERE ep2.emi_id = ep.emi_id AND ep2.payment_status = 'pending'
         )`
    );
    const emiOutstanding = emiResult ? emiResult.total : 0;

    const totalLiabilities = totalDebt + emiOutstanding;
    const totalAssets = Math.max(totalBalance, 0);
    const netWorth = totalAssets - totalLiabilities;

    // Savings goals contribution to net worth
    const { total_saved } = await fetchSavingsGoals();

    return {
        totalAssets: Math.round(totalAssets),
        totalLiabilities: Math.round(totalLiabilities),
        emiOutstanding: Math.round(emiOutstanding),
        debtOwed: Math.round(totalDebt),
        savingsGoalsSaved: Math.round(total_saved),
        netWorth: Math.round(netWorth),
        isPositive: netWorth >= 0,
    };
}

/**
 * 6. EMERGENCY FUND STATUS
 * Target: 3–6 months of average monthly expense as emergency fund
 * Current proxy: sum of all account balances (conservative measure)
 */
export async function computeEmergencyFund() {
    const trend = await fetchMonthlyIncomeExpense(6);
    const completedMonths = trend.slice(0, -1);

    const avgMonthlyExpense = completedMonths.length > 0
        ? completedMonths.reduce((s, m) => s + m.expense, 0) / completedMonths.length
        : 0;

    const totalBalance = await fetchTotalAccountBalance();

    const target3Month = avgMonthlyExpense * 3;
    const target6Month = avgMonthlyExpense * 6;
    const coverageMonths = avgMonthlyExpense > 0 ? totalBalance / avgMonthlyExpense : 0;
    const progressTo3 = clamp(safeDivide(totalBalance, target3Month, 0), 0, 1);
    const progressTo6 = clamp(safeDivide(totalBalance, target6Month, 0), 0, 1);

    return {
        currentFund: Math.round(totalBalance),
        avgMonthlyExpense: Math.round(avgMonthlyExpense),
        target3Month: Math.round(target3Month),
        target6Month: Math.round(target6Month),
        coverageMonths: Math.round(coverageMonths * 10) / 10,
        progressTo3,
        progressTo6,
        status: coverageMonths < 1 ? 'Critical' :
                coverageMonths < 3 ? 'Building' :
                coverageMonths < 6 ? 'Adequate' : 'Strong',
        statusColor: coverageMonths < 1 ? '#F04438' :
                     coverageMonths < 3 ? '#F79009' :
                     coverageMonths < 6 ? '#0BA5EC' : '#12B76A',
    };
}

/**
 * 7. FINANCIAL FREEDOM NUMBER
 * Freedom Number = Annual Expenses / Safe Withdrawal Rate (4%)
 * This is the corpus needed to live off investments.
 */
export async function computeFreedomNumber() {
    const trend = await fetchMonthlyIncomeExpense(12);
    const completedMonths = trend.slice(0, -1);

    const avgMonthlyExpense = completedMonths.length > 0
        ? completedMonths.reduce((s, m) => s + m.expense, 0) / completedMonths.length
        : 0;

    const annualExpense = avgMonthlyExpense * 12;
    const safeWithdrawalRate = 0.04; // 4% rule
    const freedomNumber = safeDivide(annualExpense, safeWithdrawalRate, 0);

    const totalBalance = await fetchTotalAccountBalance();
    const { total_saved } = await fetchSavingsGoals();
    const currentWealth = totalBalance + total_saved;
    const progressToFreedom = clamp(safeDivide(currentWealth, freedomNumber, 0), 0, 1);

    // Projected time to financial freedom (assuming 12% annual return on savings)
    const currentSavingsRate = trend.length > 0
        ? safeDivide(trend[trend.length - 1].income - trend[trend.length - 1].expense, trend[trend.length - 1].income, 0)
        : 0;
    const monthlyContribution = avgMonthlyExpense > 0 ? avgMonthlyExpense * currentSavingsRate : 0;

    return {
        avgMonthlyExpense: Math.round(avgMonthlyExpense),
        annualExpense: Math.round(annualExpense),
        freedomNumber: Math.round(freedomNumber),
        currentWealth: Math.round(currentWealth),
        progressToFreedom,
        monthlyContribution: Math.round(monthlyContribution),
        safeWithdrawalRate: safeWithdrawalRate * 100,
    };
}

/**
 * 8. LIFESTYLE INFLATION TRACKER
 * Compare average expense per month in the last 3 months vs 3 months before that.
 * Positive drift = lifestyle inflation.
 */
export async function computeLifestyleInflation() {
    const trend = await fetchMonthlyIncomeExpense(6);

    // Exclude current partial month
    const completed = trend.slice(0, -1);
    const recent3 = completed.slice(-3);
    const older3 = completed.slice(-6, -3);

    const recentAvg = recent3.length > 0
        ? recent3.reduce((s, m) => s + m.expense, 0) / recent3.length
        : 0;

    const olderAvg = older3.length > 0
        ? older3.reduce((s, m) => s + m.expense, 0) / older3.length
        : 0;

    const drift = safeDivide(recentAvg - olderAvg, olderAvg, 0) * 100;
    const absoluteDrift = recentAvg - olderAvg;

    const monthlyData = trend.map(m => ({ month: m.month, value: Math.round(m.expense) }));

    return {
        recentAvg: Math.round(recentAvg),
        olderAvg: Math.round(olderAvg),
        drift: Math.round(drift * 10) / 10,
        absoluteDrift: Math.round(absoluteDrift),
        monthlyData,
        status: drift < -5 ? 'Improving' :
                drift < 5  ? 'Stable' :
                drift < 15 ? 'Mild Inflation' : 'High Inflation',
        statusColor: drift < -5 ? '#12B76A' :
                     drift < 5  ? '#0BA5EC' :
                     drift < 15 ? '#F79009' : '#F04438',
        trend: drift < 0 ? 'down' : 'up',
    };
}

/**
 * 9. CASH FLOW HEALTH (Monthly Net)
 * Shows a 6-month trend of net cash flow (income - expense) per month.
 */
export async function computeCashFlow() {
    const trend = await fetchMonthlyIncomeExpense(6);

    const months = trend.map(m => ({
        month: m.month,
        income: Math.round(m.income),
        expense: Math.round(m.expense),
        net: Math.round(m.income - m.expense),
    }));

    const latestMonth = months[months.length - 1] || { net: 0, income: 0, expense: 0 };
    const avgNet = months.length > 0
        ? months.reduce((s, m) => s + m.net, 0) / months.length
        : 0;

    const positiveMonths = months.filter(m => m.net > 0).length;

    return {
        months,
        currentNet: latestMonth.net,
        currentIncome: latestMonth.income,
        currentExpense: latestMonth.expense,
        avgNet: Math.round(avgNet),
        positiveMonths,
        totalMonths: months.length,
        status: latestMonth.net > 0 ? 'Positive' : 'Negative',
        statusColor: latestMonth.net > 0 ? '#12B76A' : '#F04438',
    };
}

/**
 * 10. SAVINGS GOAL PROGRESS
 * Shows all active savings goals with progress.
 */
export async function computeSavingsGoalProgress() {
    const { goals, total_saved, total_target } = await fetchSavingsGoals();

    const goalsWithProgress = goals.map(g => {
        const progress = clamp(safeDivide(g.current_amount, g.target_amount, 0), 0, 1);
        const daysLeft = Math.ceil((new Date(g.deadline) - new Date()) / (1000 * 60 * 60 * 24));
        return {
            ...g,
            progress,
            daysLeft,
            isOverdue: daysLeft < 0,
        };
    });

    return {
        goals: goalsWithProgress,
        total_saved: Math.round(total_saved),
        total_target: Math.round(total_target),
        overallProgress: clamp(safeDivide(total_saved, total_target, 0), 0, 1),
    };
}

/**
 * 11. SUBSCRIPTION BURDEN
 * Shows subscriptions as % of income and monthly spend.
 */
export async function computeSubscriptionBurden() {
    const { start, end } = getCurrentMonthRange();
    const db = await ensureDb();

    const incomeRow = await db.getFirstAsync(
        `SELECT COALESCE(SUM(amount), 0) as total FROM transactions
         WHERE date >= ? AND date <= ? AND category = 'Income'`,
        [start, end]
    );
    const monthlyIncome = incomeRow ? incomeRow.total : 0;
    const monthlySubCost = await fetchMonthlySubscriptionCost();

    const burdenPct = safeDivide(monthlySubCost, monthlyIncome, 0) * 100;

    // Get individual subscriptions
    const subs = await db.getAllAsync(
        `SELECT name, amount, billing_cycle, icon, color
         FROM subscriptions WHERE is_active = 1 AND (status IS NULL OR status = 'active')
         ORDER BY amount DESC LIMIT 10`
    );

    return {
        monthlyIncome: Math.round(monthlyIncome),
        monthlySubCost: Math.round(monthlySubCost),
        burdenPct: Math.round(burdenPct * 10) / 10,
        topSubscriptions: subs,
        status: burdenPct < 5 ? 'Low' : burdenPct < 10 ? 'Moderate' : 'High',
        statusColor: burdenPct < 5 ? '#12B76A' : burdenPct < 10 ? '#F79009' : '#F04438',
    };
}

/**
 * 12. INCOME STABILITY INDEX
 * Measures month-to-month income variance.
 * Low variance = stable income source.
 */
export async function computeIncomeStability() {
    const trend = await fetchMonthlyIncomeExpense(6);
    const completed = trend.slice(0, -1);

    const incomes = completed.map(m => m.income).filter(i => i > 0);

    let stability = 100;
    let variance = 0;
    let cv = 0; // coefficient of variation

    if (incomes.length >= 2) {
        const mean = incomes.reduce((s, i) => s + i, 0) / incomes.length;
        variance = incomes.reduce((s, i) => s + Math.pow(i - mean, 2), 0) / incomes.length;
        const stdDev = Math.sqrt(variance);
        cv = safeDivide(stdDev, mean, 0) * 100;
        stability = Math.max(0, 100 - cv);
    }

    const monthlyData = trend.map(m => ({ month: m.month, value: Math.round(m.income) }));

    return {
        stability: Math.round(stability),
        cv: Math.round(cv * 10) / 10,
        monthlyData,
        status: stability > 80 ? 'Very Stable' :
                stability > 60 ? 'Stable' :
                stability > 40 ? 'Variable' : 'Volatile',
        statusColor: stability > 80 ? '#12B76A' :
                     stability > 60 ? '#0BA5EC' :
                     stability > 40 ? '#F79009' : '#F04438',
    };
}

// ─── Master Compute ───────────────────────────────────────────────────────────

/**
 * Compute all Finance Lab metrics in parallel.
 * Returns an object keyed by metric name.
 */
export async function computeAllMetrics() {
    const [
        savingsRate,
        burnRate,
        rule503020,
        dti,
        netWorth,
        emergencyFund,
        freedomNumber,
        lifestyleInflation,
        cashFlow,
        savingsGoals,
        subscriptionBurden,
        incomeStability,
    ] = await Promise.all([
        computeSavingsRate().catch(e => ({ error: e.message })),
        computeBurnRateRunway().catch(e => ({ error: e.message })),
        compute503020().catch(e => ({ error: e.message })),
        computeDTI().catch(e => ({ error: e.message })),
        computeNetWorth().catch(e => ({ error: e.message })),
        computeEmergencyFund().catch(e => ({ error: e.message })),
        computeFreedomNumber().catch(e => ({ error: e.message })),
        computeLifestyleInflation().catch(e => ({ error: e.message })),
        computeCashFlow().catch(e => ({ error: e.message })),
        computeSavingsGoalProgress().catch(e => ({ error: e.message })),
        computeSubscriptionBurden().catch(e => ({ error: e.message })),
        computeIncomeStability().catch(e => ({ error: e.message })),
    ]);

    return {
        savingsRate,
        burnRate,
        rule503020,
        dti,
        netWorth,
        emergencyFund,
        freedomNumber,
        lifestyleInflation,
        cashFlow,
        savingsGoals,
        subscriptionBurden,
        incomeStability,
    };
}
