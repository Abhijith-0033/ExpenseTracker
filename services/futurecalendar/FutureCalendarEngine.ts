import { initDatabase, getDatabase } from '../database';
import { addDays, addMonths, addYears, addWeeks, format, isBefore, isAfter, parseISO } from 'date-fns';

export interface FutureEvent {
  date: string;          // YYYY-MM-DD
  type: 'emi' | 'subscription' | 'recurring' | 'debt' | 'chit' | 'sinking_fund' | 'income';
  title: string;
  amount: number;
  icon: string;
  color: string;
  sourceId: number | null;
  isIncome?: boolean;
}

const ensureDb = async () => { await initDatabase(); return getDatabase(); };

export async function getFutureEvents(startDate: Date, endDate: Date): Promise<FutureEvent[]> {
  const db = await ensureDb();
  const events: FutureEvent[] = [];
  const startStr = format(startDate, 'yyyy-MM-dd');
  const endStr = format(endDate, 'yyyy-MM-dd');

  // SOURCE 1: EMI due dates
  const emiPayments = await db.getAllAsync<{
    due_date: string; month_number: number; name: string; emi_amount: number; id: number;
  }>(
    `SELECT ep.due_date, ep.month_number, er.name, er.emi_amount, er.id
     FROM emi_payments ep
     JOIN emi_records er ON ep.emi_id = er.id
     WHERE ep.payment_status = 'pending'
       AND ep.due_date BETWEEN ? AND ?
       AND er.status = 'active'`,
    [startStr, endStr]
  );
  for (const e of emiPayments) {
    events.push({
      date: e.due_date, type: 'emi',
      title: `${e.name} EMI`, amount: e.emi_amount,
      icon: '🏦', color: '#7C3AED', sourceId: e.id,
    });
  }

  // SOURCE 2: Subscription renewals
  const subs = await db.getAllAsync<{
    id: number; name: string; amount: number; next_renewal_date: string;
  }>(
    `SELECT id, name, amount, next_renewal_date FROM subscriptions
     WHERE (status = 'active' OR status IS NULL)
       AND is_active = 1
       AND next_renewal_date BETWEEN ? AND ?`,
    [startStr, endStr]
  );
  for (const s of subs) {
    events.push({
      date: s.next_renewal_date, type: 'subscription',
      title: s.name, amount: s.amount,
      icon: '🔁', color: '#F59E0B', sourceId: s.id,
    });
  }

  // SOURCE 3: Debt repayment due dates (pending from debt_records)
  const debts = await db.getAllAsync<{
    id: number; name: string; principal: number; repayment_freq: string;
    custom_freq_days: number | null; start_date: string;
  }>(
    `SELECT id, name, principal, repayment_freq, custom_freq_days, start_date
     FROM debt_records WHERE status = 'active'`
  );
  for (const d of debts) {
    // Compute all occurrences in range
    const repayments = await db.getAllAsync<{ payment_date: string }>(
      'SELECT payment_date FROM debt_repayments WHERE debt_id = ? ORDER BY payment_date DESC LIMIT 1',
      [d.id]
    );
    let lastDate = repayments.length > 0 ? new Date(repayments[0].payment_date) : new Date(d.start_date);

    let nextDue: Date;
    switch (d.repayment_freq) {
      case 'daily':   nextDue = addDays(lastDate, 1); break;
      case 'weekly':  nextDue = addDays(lastDate, 7); break;
      case 'monthly': nextDue = addMonths(lastDate, 1); break;
      case 'custom':  nextDue = addDays(lastDate, d.custom_freq_days || 30); break;
      default:        nextDue = addMonths(lastDate, 1);
    }

    // Project forward until endDate
    while (nextDue <= endDate) {
      if (nextDue >= startDate) {
        events.push({
          date: format(nextDue, 'yyyy-MM-dd'), type: 'debt',
          title: `${d.name} repayment`, amount: 0,
          icon: '💳', color: '#EF4444', sourceId: d.id,
        });
      }
      switch (d.repayment_freq) {
        case 'daily':   nextDue = addDays(nextDue, 1); break;
        case 'weekly':  nextDue = addDays(nextDue, 7); break;
        case 'monthly': nextDue = addMonths(nextDue, 1); break;
        case 'custom':  nextDue = addDays(nextDue, d.custom_freq_days || 30); break;
        default:        nextDue = addMonths(nextDue, 1);
      }
    }
  }

  // SOURCE 4: Chit fund monthly payments
  const chitRecords = await db.getAllAsync<{
    id: number; chit_id: number; month_date: string;
    monthly_amount: number; chit_name: string;
  }>(
    `SELECT cr.id, cr.chit_id, cr.month_date, cf.monthly_amount, cf.name as chit_name
     FROM chit_monthly_records cr
     JOIN chit_funds cf ON cr.chit_id = cf.id
     WHERE cr.payment_status = 'pending'
       AND cr.month_date BETWEEN ? AND ?
       AND cf.status = 'active'`,
    [startStr, endStr]
  );
  for (const c of chitRecords) {
    events.push({
      date: c.month_date, type: 'chit',
      title: `${c.chit_name} payment`, amount: c.monthly_amount,
      icon: '🏛️', color: '#10B981', sourceId: c.chit_id,
    });
  }

  // SOURCE 5: Sinking fund contribution dates
  const sinkingFunds = await db.getAllAsync<{
    id: number; name: string; monthly_contribution: number; start_date: string; target_date: string;
  }>(
    `SELECT id, name, monthly_contribution, start_date, target_date FROM sinking_funds WHERE status = 'active'`
  );
  for (const sf of sinkingFunds) {
    let contribDate = new Date(sf.start_date);
    // Advance to first occurrence on/after startDate
    while (contribDate < startDate) { contribDate = addMonths(contribDate, 1); }
    while (contribDate <= endDate && contribDate <= new Date(sf.target_date)) {
      events.push({
        date: format(contribDate, 'yyyy-MM-dd'), type: 'sinking_fund',
        title: `${sf.name} contribution`, amount: sf.monthly_contribution,
        icon: '🐷', color: '#14B8A6', sourceId: sf.id,
      });
      contribDate = addMonths(contribDate, 1);
    }
  }

  // Sort by date
  events.sort((a, b) => a.date.localeCompare(b.date));
  return events;
}

export function groupEventsByDate(events: FutureEvent[]): Record<string, FutureEvent[]> {
  const groups: Record<string, FutureEvent[]> = {};
  for (const e of events) {
    if (!groups[e.date]) groups[e.date] = [];
    groups[e.date].push(e);
  }
  return groups;
}

export function groupEventsByWeek(events: FutureEvent[]): { weekLabel: string; weekStart: Date; total: number; events: FutureEvent[] }[] {
  const weeks: { weekLabel: string; weekStart: Date; total: number; events: FutureEvent[] }[] = [];
  for (const e of events) {
    const date = new Date(e.date);
    const monday = new Date(date);
    monday.setDate(date.getDate() - date.getDay() + 1);
    const weekKey = format(monday, 'yyyy-MM-dd');

    let week = weeks.find(w => format(w.weekStart, 'yyyy-MM-dd') === weekKey);
    if (!week) {
      const now = new Date();
      const diffDays = Math.floor((monday.getTime() - now.getTime()) / 86400000);
      let weekLabel = `Week of ${format(monday, 'MMM dd')}`;
      if (diffDays < 7 && diffDays >= 0) weekLabel = 'This Week';
      else if (diffDays < 14) weekLabel = 'Next Week';
      week = { weekLabel, weekStart: monday, total: 0, events: [] };
      weeks.push(week);
    }
    week.events.push(e);
    week.total += e.isIncome ? 0 : e.amount;
  }
  return weeks;
}
