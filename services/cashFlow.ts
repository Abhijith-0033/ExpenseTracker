import { getDatabase, initDatabase } from './database';
import { getUpcomingRenewals } from './subscriptions';
import { addDays, differenceInCalendarDays } from 'date-fns';

export interface CashFlowEvent {
    type: 'income' | 'expense' | 'bill';
    description: string;
    amount: number;
    source: 'recurring' | 'scheduled' | 'predicted' | 'subscription';
}

export interface CashFlowDay {
    date: string;
    predictedIncome: number;
    predictedExpense: number;
    runningBalance: number;
    events: CashFlowEvent[];
    isNegative: boolean;
}

const ensureDb = async () => {
    const db = getDatabase();
    if (!db) {
        await initDatabase();
        return getDatabase();
    }
    return db;
};

interface TransactionSample {
    description: string;
    category: string;
    subcategory: string;
    amount: number;
    date: string;
}

const toDayString = (date: Date) => date.toISOString().split('T')[0];

// Internal helper for recurring detection from transaction history.
export const detectRecurringTransactions = async (daysWindow: number): Promise<Array<{date: string, amount: number, description: string, type: 'income'|'expense'}>> => {
    const db = await ensureDb();

    const historyStart = new Date();
    historyStart.setMonth(historyStart.getMonth() - 6);

    const transactions = await db.getAllAsync<TransactionSample>(`
        SELECT description, category, subcategory, amount, date
        FROM transactions
        WHERE date >= ?
          AND category NOT IN ('Transfer', 'Debt/Credit')
          AND amount > 0
        ORDER BY date ASC
    `, [historyStart.toISOString()]);

    const groups = new Map<string, TransactionSample[]>();
    transactions.forEach(tx => {
        const normalizedDescription = (tx.description || tx.subcategory || tx.category || 'Transaction').trim().toLowerCase();
        const key = `${tx.category}|${tx.subcategory}|${normalizedDescription}`;
        groups.set(key, [...(groups.get(key) || []), tx]);
    });

    const predictedEvents: Array<{date: string, amount: number, description: string, type: 'income'|'expense'}> = [];
    const now = new Date();
    const endWindow = addDays(now, daysWindow);

    groups.forEach(samples => {
        if (samples.length < 2) return;

        const dates = samples.map(sample => new Date(sample.date)).sort((a, b) => a.getTime() - b.getTime());
        const intervals = dates.slice(1).map((date, index) => differenceInCalendarDays(date, dates[index]));
        const positiveIntervals = intervals.filter(interval => interval >= 5);
        if (positiveIntervals.length === 0) return;

        const avgInterval = positiveIntervals.reduce((sum, interval) => sum + interval, 0) / positiveIntervals.length;
        const isRecurring = positiveIntervals.length >= 1 && avgInterval <= 45;
        if (!isRecurring) return;

        const lastSample = samples[samples.length - 1];
        const avgAmount = samples.reduce((sum, sample) => sum + sample.amount, 0) / samples.length;
        let nextDate = addDays(dates[dates.length - 1], Math.round(avgInterval));

        while (nextDate < now) {
            nextDate = addDays(nextDate, Math.round(avgInterval));
        }

        if (nextDate <= endWindow) {
            const type: 'income' | 'expense' = lastSample.category === 'Income' ? 'income' : 'expense';
            predictedEvents.push({
                date: toDayString(nextDate),
                amount: Number(avgAmount.toFixed(2)),
                description: lastSample.description || lastSample.subcategory || lastSample.category,
                type
            });
        }
    });

    return predictedEvents;
};

export const generateCashFlowForecast = async (days: number = 30): Promise<CashFlowDay[]> => {
    const db = await ensureDb();
    
    // 1. Get current balance
    const accounts = await db.getAllAsync<{balance: number}>("SELECT balance FROM accounts WHERE type != 'meta_categories'");
    const startBalance = accounts.reduce((sum, acc) => sum + acc.balance, 0);
    
    // 2. Fetch all upcoming data sources
    
    // A. Subscriptions (next 30 days)
    const subscriptions = await getUpcomingRenewals(days);
    
    const now = new Date();
    const endDay = toDayString(addDays(now, days));

    // B. Recharge/Bills (from recharge_meta)
    const bills = await db.getAllAsync<{expiry_date: string, amount: number, description: string}>(`
        SELECT r.expiry_date, t.amount, t.description
        FROM recharge_meta r
        JOIN transactions t ON r.expense_id = t.id
        WHERE date(r.expiry_date) >= date(?) AND date(r.expiry_date) <= date(?)
    `, [toDayString(now), endDay]);
    
    // C. Detected recurring
    const recurring = await detectRecurringTransactions(days);
    
    // 3. Build day-by-day calendar
    const calendar: CashFlowDay[] = [];
    let currentBalance = startBalance;
    
    for (let i = 0; i < days; i++) {
        const currentDay = addDays(now, i);
        const dayStr = toDayString(currentDay);
        
        let dailyIncome = 0;
        let dailyExpense = 0;
        const events: CashFlowEvent[] = [];
        
        // Add subscriptions
        subscriptions.forEach(sub => {
            if (sub.next_renewal_date.startsWith(dayStr)) {
                dailyExpense += sub.amount;
                events.push({
                    type: 'expense',
                    description: `Subscription: ${sub.name}`,
                    amount: sub.amount,
                    source: 'subscription'
                });
            }
        });
        
        // Add bills
        bills.forEach(bill => {
            if (bill.expiry_date.startsWith(dayStr)) {
                dailyExpense += bill.amount;
                events.push({
                    type: 'bill',
                    description: `Bill: ${bill.description}`,
                    amount: bill.amount,
                    source: 'scheduled'
                });
            }
        });
        
        // Add recurring
        recurring.forEach(rec => {
            if (rec.date === dayStr) {
                if (rec.type === 'income') {
                    dailyIncome += rec.amount;
                } else {
                    dailyExpense += rec.amount;
                }
                events.push({
                    type: rec.type,
                    description: `${rec.type === 'income' ? 'Expected Income' : 'Predicted'}: ${rec.description}`,
                    amount: rec.amount,
                    source: 'predicted'
                });
            }
        });
        
        currentBalance = currentBalance + dailyIncome - dailyExpense;
        
        calendar.push({
            date: dayStr,
            predictedIncome: dailyIncome,
            predictedExpense: dailyExpense,
            runningBalance: currentBalance,
            events,
            isNegative: currentBalance < 0
        });
    }
    
    return calendar;
};
