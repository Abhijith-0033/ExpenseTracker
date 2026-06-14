import { getDatabase, initDatabase, Subscription } from './database';
import { schedulePaymentNotifications, cancelPaymentNotifications, reschedulePaymentNotifications } from './paymentNotifications';
import { addDays, addMonths, addYears } from 'date-fns';
export { Subscription };

const ensureDb = async () => {
    const db = getDatabase();
    if (!db) {
        await initDatabase();
        return getDatabase();
    }
    return db;
};

export const scheduleRenewalReminder = async (sub: Subscription): Promise<void> => {
    // Only schedule if active and status is active
    if (sub.is_active && (sub.status === 'active' || !sub.status)) {
        await schedulePaymentNotifications({
            id: sub.id,
            type: 'subscription',
            name: sub.name,
            amount: sub.amount,
            dueDate: sub.next_renewal_date,
            category: sub.category,
            accountId: sub.account_id || undefined,
        });
    }
};

export const addSubscription = async (sub: Omit<Subscription, 'id' | 'created_at' | 'last_updated' | 'reminder_notification_id'>) => {
    const db = await ensureDb();
    const timestamp = Date.now();
    
    const result = await db.runAsync(
        'INSERT INTO subscriptions (name, amount, billing_cycle, next_renewal_date, category, account_id, icon, color, is_active, notes, created_at, last_updated, custom_interval_value, custom_interval_unit, website, auto_renew, payment_method, sub_category, reminder_days_before, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [sub.name, sub.amount, sub.billing_cycle, sub.next_renewal_date, sub.category, sub.account_id ?? null, sub.icon ?? null, sub.color ?? null, sub.is_active, sub.notes ?? null, timestamp, timestamp, sub.custom_interval_value ?? null, sub.custom_interval_unit ?? null, sub.website ?? null, sub.auto_renew ?? 1, sub.payment_method ?? null, sub.sub_category ?? null, sub.reminder_days_before ?? 3, sub.status || 'active']
    );
    
    const id = result.lastInsertRowId;
    const newSub = await db.getFirstAsync<Subscription>('SELECT * FROM subscriptions WHERE id = ?', [id]);
    if (newSub) {
        await scheduleRenewalReminder(newSub);
    }
};

export const getSubscriptions = async (): Promise<Subscription[]> => {
    const db = await ensureDb();
    return await db.getAllAsync<Subscription>("SELECT * FROM subscriptions WHERE is_active = 1 AND (status = 'active' OR status IS NULL) ORDER BY next_renewal_date ASC");
};

export const getAllSubscriptions = async (): Promise<Subscription[]> => {
    const db = await ensureDb();
    return await db.getAllAsync<Subscription>('SELECT * FROM subscriptions ORDER BY is_active DESC, status ASC, next_renewal_date ASC');
};

export const updateSubscription = async (id: number, updates: Partial<Subscription>) => {
    const db = await ensureDb();
    const timestamp = Date.now();
    
    const current = await db.getFirstAsync<Subscription>('SELECT * FROM subscriptions WHERE id = ?', [id]);
    if (!current) return;
    
    const fields = [];
    const values = [];
    for (const [key, value] of Object.entries(updates)) {
        if (value !== undefined) {
            fields.push(`${key} = ?`);
            values.push(value);
        }
    }
    
    fields.push('last_updated = ?');
    values.push(timestamp);
    values.push(id);
    
    await db.runAsync(`UPDATE subscriptions SET ${fields.join(', ')} WHERE id = ?`, values);
    
    // Reschedule
    const updated = await db.getFirstAsync<Subscription>('SELECT * FROM subscriptions WHERE id = ?', [id]);
    if (updated) {
        if (updated.is_active === 0 || updated.status === 'cancelled' || updated.status === 'paused') {
            await cancelPaymentNotifications(id, 'subscription');
        } else {
            await reschedulePaymentNotifications({
                id: updated.id,
                type: 'subscription',
                name: updated.name,
                amount: updated.amount,
                dueDate: updated.next_renewal_date,
                category: updated.category,
                accountId: updated.account_id || undefined,
            });
        }
    }
};

export const deleteSubscription = async (id: number) => {
    const db = await ensureDb();
    await cancelPaymentNotifications(id, 'subscription');
    await db.runAsync('DELETE FROM subscriptions WHERE id = ?', [id]);
};

export const toggleActive = async (id: number, isActive: boolean) => {
    await updateSubscription(id, { is_active: isActive ? 1 : 0 });
};

export const getMonthlyBurn = async (): Promise<number> => {
    const subs = await getSubscriptions();
    let total = 0;
    for (const sub of subs) {
        if (sub.billing_cycle === 'monthly') {
            total += sub.amount;
        } else if (sub.billing_cycle === 'quarterly') {
            total += sub.amount / 3;
        } else if (sub.billing_cycle === 'yearly') {
            total += sub.amount / 12;
        } else if (sub.billing_cycle === 'custom' && sub.custom_interval_value && sub.custom_interval_unit) {
            const n = sub.custom_interval_value;
            switch (sub.custom_interval_unit) {
                case 'days': total += (sub.amount / n) * 30; break;
                case 'weeks': total += (sub.amount / (n * 7)) * 30; break;
                case 'months': total += sub.amount / n; break;
            }
        }
    }
    return total;
};

export const getUpcomingRenewals = async (days: number = 7): Promise<Subscription[]> => {
    const db = await ensureDb();
    const endDays = new Date();
    endDays.setDate(endDays.getDate() + days);
    const dateBound = endDays.toISOString().split('T')[0];
    
    return await db.getAllAsync<Subscription>(
        `SELECT * FROM subscriptions WHERE is_active = 1 AND (status = 'active' OR status IS NULL) AND next_renewal_date <= ? ORDER BY next_renewal_date ASC`,
        [dateBound]
    );
};

export const advanceRenewalDate = async (id: number) => {
    const db = await ensureDb();
    const current = await db.getFirstAsync<Subscription>('SELECT * FROM subscriptions WHERE id = ?', [id]);
    if (!current) return;
    
    const currentRenewal = new Date(current.next_renewal_date);
    let nextRenewal = currentRenewal;
    
    if (current.billing_cycle === 'monthly') {
        nextRenewal = addMonths(currentRenewal, 1);
    } else if (current.billing_cycle === 'quarterly') {
        nextRenewal = addMonths(currentRenewal, 3);
    } else if (current.billing_cycle === 'yearly') {
        nextRenewal = addYears(currentRenewal, 1);
    } else if (current.billing_cycle === 'custom' && current.custom_interval_value && current.custom_interval_unit) {
        const n = current.custom_interval_value;
        switch (current.custom_interval_unit) {
            case 'days': nextRenewal = addDays(currentRenewal, n); break;
            case 'weeks': nextRenewal = addDays(currentRenewal, n * 7); break;
            case 'months': nextRenewal = addMonths(currentRenewal, n); break;
        }
    }
    
    await updateSubscription(id, { next_renewal_date: nextRenewal.toISOString().split('T')[0] });
};

export const updateSubscriptionStatus = async (id: number, status: 'active' | 'paused' | 'cancelled') => {
    await updateSubscription(id, { status });
};

export const getSubscriptionsByStatus = async (status: string): Promise<Subscription[]> => {
    const db = await ensureDb();
    return await db.getAllAsync<Subscription>('SELECT * FROM subscriptions WHERE status = ? ORDER BY next_renewal_date ASC', [status]);
};
