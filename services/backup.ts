// import * as FileSystem from 'expo-file-system'; // usage deprecated in strict mode
import { writeAsStringAsync, readAsStringAsync, cacheDirectory } from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { Alert, Platform } from 'react-native';
import { z } from 'zod';
import {
    getDatabase,
    initDatabase,
    Transaction,
    Account,
    IncomeSource,
    Debt,
    DebtHistory,
    RechargeMeta,
    SavingsGoal,
    SavingsContribution,
    Subscription
} from './database';
import { ExpenseBook, BookItem } from './books';
import { BillGroup, BillGroupMember, BillExpense, BillExpenseSplit } from './billSplitter';

// Schema Versioning to ensure backward/forward compatibility in future
const CURRENT_SCHEMA_VERSION = 2;
const EXPORT_APP_VERSION = '3.2.0';

interface BackupData {
    metadata: {
        timestamp: number;
        date: string;
        schemaVersion: number;
        appVersion: string;
        platform: string;
    };
    data: {
        accounts: Account[];
        transactions: Transaction[];
        incomeSources: IncomeSource[];
        debts: Debt[];
        debtHistory: DebtHistory[];
        expenseBooks: ExpenseBook[];
        expenseBookItems: BookItem[];
        categoryBudgets: any[];
        billGroups: BillGroup[];
        billGroupMembers: BillGroupMember[];
        billExpenses: BillExpense[];
        billExpenseSplits: BillExpenseSplit[];
        rechargeMeta: RechargeMeta[];
        savingsGoals: SavingsGoal[];
        savingsContributions: SavingsContribution[];
        subscriptions: Subscription[];
        // New tables
        debtRecords: any[];
        debtRepayments: any[];
        chitFunds: any[];
        chitMonthlyRecords: any[];
        chitMembers: any[];
        emiRecords: any[];
        emiPayments: any[];
        notificationSchedules: any[];
        dailyReportCache: any[];
        categories: any[];
        categorySubcategories: any[];
    };
}

const AccountSchema = z.object({
    id: z.number(),
    name: z.string(),
    balance: z.number(),
    type: z.string(),
});

const TransactionSchema = z.object({
    id: z.number(),
    amount: z.number(),
    category: z.string(),
    subcategory: z.string().nullish().transform(val => val ?? ''),
    account_id: z.number(),
    date: z.string(),
    description: z.string().nullish().transform(val => val ?? ''),
    created_at: z.union([z.number(), z.string()]).nullish().transform(val => {
        if (typeof val === 'number') return val;
        if (typeof val === 'string') return Date.parse(val) || Date.now();
        return Date.now();
    }),
});

const IncomeSourceSchema = z.object({
    id: z.number(),
    name: z.string(),
    icon: z.string().nullish().transform(val => val ?? 'Briefcase'),
});

const CategoryBudgetSchema = z.object({
    id: z.number(),
    category: z.string(),
    amount: z.number(),
    month: z.string(),
    created_at: z.union([z.number(), z.string()]).nullish().transform(val => typeof val === 'number' ? val : (Date.parse(val || '') || Date.now())),
});

const DebtSchema = z.object({
    id: z.number(),
    name: z.string(),
    type: z.enum(['debt', 'receivable'] as const),
    amount: z.number(),
    notes: z.string().nullish().transform(val => val ?? ''),
    created_at: z.union([z.number(), z.string()]).nullish().transform(val => typeof val === 'number' ? val : (Date.parse(val || '') || Date.now())),
    last_updated: z.union([z.number(), z.string()]).nullish().transform(val => typeof val === 'number' ? val : (Date.parse(val || '') || Date.now())),
});

const DebtHistorySchema = z.object({
    id: z.number(),
    debt_id: z.number(),
    change_amount: z.number(),
    action: z.enum(['increase', 'reduce'] as const),
    notes: z.string().nullish().transform(val => val ?? ''),
    date: z.union([z.number(), z.string()]).nullish().transform(val => typeof val === 'number' ? val : (Date.parse(val || '') || Date.now())),
});

const ExpenseBookSchema = z.object({
    id: z.number(),
    name: z.string(),
    description: z.string().nullish().transform(val => val ?? undefined),
    budget: z.number().nullish().transform(val => val ?? 0),
    created_at: z.union([z.number(), z.string()]).nullish().transform(val => typeof val === 'number' ? val : (Date.parse(val || '') || Date.now())),
    last_updated: z.union([z.number(), z.string()]).nullish().transform(val => typeof val === 'number' ? val : (Date.parse(val || '') || Date.now())),
});

const BookItemSchema = z.object({
    id: z.number(),
    book_id: z.number(),
    name: z.string(),
    amount: z.number(),
    notes: z.string().nullish().transform(val => val ?? undefined),
    date: z.union([z.number(), z.string()]).nullish().transform(val => typeof val === 'number' ? val : (Date.parse(val || '') || Date.now())),
    type: z.enum(['expense', 'income'] as const),
    income_source_id: z.number().nullish().transform(val => val ?? null),
});

const BillGroupSchema = z.object({
    id: z.number(),
    name: z.string(),
    description: z.string().nullish().transform(val => val ?? undefined),
    created_at: z.union([z.number(), z.string()]).nullish().transform(val => typeof val === 'number' ? val : (Date.parse(val || '') || Date.now())),
    last_updated: z.union([z.number(), z.string()]).nullish().transform(val => typeof val === 'number' ? val : (Date.parse(val || '') || Date.now())),
    is_archived: z.number().nullish().transform(val => val ?? 0),
});

const BillGroupMemberSchema = z.object({
    id: z.number(),
    group_id: z.number(),
    name: z.string(),
    created_at: z.union([z.number(), z.string()]).nullish().transform(val => typeof val === 'number' ? val : (Date.parse(val || '') || Date.now())),
});

const BillExpenseSchema = z.object({
    id: z.number(),
    group_id: z.number(),
    title: z.string(),
    amount: z.number(),
    paid_by_member_id: z.number(),
    date: z.union([z.number(), z.string()]).transform(val => typeof val === 'number' ? val : (Date.parse(val || '') || Date.now())),
    notes: z.string().nullish().transform(val => val ?? undefined),
    created_at: z.union([z.number(), z.string()]).nullish().transform(val => typeof val === 'number' ? val : (Date.parse(val || '') || Date.now())),
});

const BillExpenseSplitSchema = z.object({
    id: z.number(),
    expense_id: z.number(),
    member_id: z.number(),
    amount: z.number(),
    created_at: z.union([z.number(), z.string()]).nullish().transform(val => typeof val === 'number' ? val : (Date.parse(val || '') || Date.now())),
});

const RechargeMetaSchema = z.object({
    id: z.number(),
    expense_id: z.number(),
    validity_days: z.number(),
    expiry_date: z.string(),
    reminder_date: z.string(),
    notification_id: z.string().nullish().transform(val => val ?? ''),
});

const SavingsGoalSchema = z.object({
    id: z.number(),
    name: z.string(),
    target_amount: z.number(),
    current_amount: z.number(),
    deadline: z.string(),
    linked_account_id: z.number().nullish().transform(val => val ?? null),
    icon: z.string().nullish().transform(val => val ?? '🎯'),
    color: z.string().nullish().transform(val => val ?? '#6941C6'),
    created_at: z.union([z.number(), z.string()]).nullish().transform(val => typeof val === 'number' ? val : (Date.parse(val || '') || Date.now())),
    last_updated: z.union([z.number(), z.string()]).nullish().transform(val => typeof val === 'number' ? val : (Date.parse(val || '') || Date.now())),
    is_completed: z.number().nullish().transform(val => val ?? 0),
});

const SavingsContributionSchema = z.object({
    id: z.number(),
    goal_id: z.number(),
    amount: z.number(),
    date: z.string(),
    notes: z.string().nullish().transform(val => val ?? ''),
    auto_detected: z.number().nullish().transform(val => val ?? 0),
    created_at: z.union([z.number(), z.string()]).nullish().transform(val => typeof val === 'number' ? val : (Date.parse(val || '') || Date.now())),
});

const SubscriptionSchema = z.object({
    id: z.number(),
    name: z.string(),
    amount: z.number(),
    billing_cycle: z.enum(['monthly', 'quarterly', 'yearly', 'custom'] as const),
    next_renewal_date: z.string(),
    category: z.string(),
    account_id: z.number().nullish().transform(val => val ?? null),
    icon: z.string().nullish().transform(val => val ?? '📦'),
    color: z.string().nullish().transform(val => val ?? '#7C3AED'),
    is_active: z.number(),
    reminder_notification_id: z.string().nullish().transform(val => val ?? ''),
    notes: z.string().nullish().transform(val => val ?? ''),
    created_at: z.union([z.number(), z.string()]).nullish().transform(val => typeof val === 'number' ? val : (Date.parse(val || '') || Date.now())),
    last_updated: z.union([z.number(), z.string()]).nullish().transform(val => typeof val === 'number' ? val : (Date.parse(val || '') || Date.now())),
    custom_interval_value: z.number().nullish().transform(val => val ?? undefined),
    custom_interval_unit: z.enum(['days', 'weeks', 'months'] as const).nullish().transform(val => val ?? undefined),
    website: z.string().nullish().transform(val => val ?? undefined),
    auto_renew: z.number().nullish().transform(val => val ?? undefined),
    payment_method: z.string().nullish().transform(val => val ?? undefined),
    sub_category: z.string().nullish().transform(val => val ?? undefined),
    reminder_days_before: z.number().nullish().transform(val => val ?? undefined),
    status: z.enum(['active', 'paused', 'cancelled'] as const).nullish().transform(val => val ?? undefined),
});

const DebtRecordSchema = z.object({
    id: z.number(),
    name: z.string(),
    description: z.string().nullable().optional(),
    principal: z.number(),
    interest_rate: z.number(),
    interest_type: z.string(),
    repayment_freq: z.string(),
    custom_freq_days: z.number().nullable().optional(),
    start_date: z.string(),
    expected_end_date: z.string().nullable().optional(),
    status: z.string(),
    direction: z.string(),
    created_at: z.string().nullable().optional(),
    updated_at: z.string().nullable().optional(),
});

const DebtRepaymentSchema = z.object({
    id: z.number(),
    debt_id: z.number(),
    amount: z.number(),
    payment_date: z.string(),
    payment_type: z.string(),
    note: z.string().nullable().optional(),
    account_id: z.number(),
    created_at: z.string().nullable().optional(),
});

const ChitFundSchema = z.object({
    id: z.number(),
    name: z.string(),
    total_members: z.number(),
    monthly_amount: z.number(),
    total_pot: z.number(),
    duration_months: z.number(),
    start_date: z.string(),
    foreman_commission: z.number(),
    status: z.string(),
    my_turn_month: z.number().nullable().optional(),
    notes: z.string().nullable().optional(),
    created_at: z.string().nullable().optional(),
});

const ChitMonthlyRecordSchema = z.object({
    id: z.number(),
    chit_id: z.number(),
    month_number: z.number(),
    month_date: z.string(),
    amount_paid: z.number(),
    payment_date: z.string().nullable().optional(),
    payment_status: z.string(),
    winner_name: z.string().nullable().optional(),
    winner_is_me: z.number().nullable().optional(),
    bid_amount: z.number().nullable().optional(),
    pot_amount: z.number().nullable().optional(),
    commission_deducted: z.number().nullable().optional(),
    net_received: z.number().nullable().optional(),
    dividend_received: z.number().nullable().optional(),
    account_id: z.number().nullable().optional(),
    notes: z.string().nullable().optional(),
    created_at: z.string().nullable().optional(),
});

const ChitMemberSchema = z.object({
    id: z.number(),
    chit_id: z.number(),
    member_name: z.string(),
    member_turn_month: z.number().nullable().optional(),
    notes: z.string().nullable().optional(),
});

const EmiRecordSchema = z.object({
    id: z.number(),
    name: z.string(),
    lender_name: z.string().nullable().optional(),
    principal: z.number(),
    total_amount: z.number(),
    emi_amount: z.number(),
    interest_rate: z.number(),
    tenure_months: z.number(),
    start_date: z.string(),
    due_day: z.number(),
    is_autopay: z.number(),
    autopay_account_id: z.number().nullable().optional(),
    status: z.string(),
    category: z.string(),
    notes: z.string().nullable().optional(),
    created_at: z.string().nullable().optional(),
    updated_at: z.string().nullable().optional(),
});

const EmiPaymentSchema = z.object({
    id: z.number(),
    emi_id: z.number(),
    month_number: z.number(),
    due_date: z.string(),
    paid_date: z.string().nullable().optional(),
    amount_paid: z.number(),
    principal_component: z.number(),
    interest_component: z.number(),
    outstanding_balance: z.number(),
    payment_status: z.string(),
    payment_mode: z.string().nullable().optional(),
    account_id: z.number().nullable().optional(),
    transaction_id: z.number().nullable().optional(),
    notes: z.string().nullable().optional(),
    created_at: z.string().nullable().optional(),
});

const NotificationScheduleSchema = z.object({
    id: z.number(),
    item_type: z.string(),
    item_id: z.number(),
    notification_id: z.string(),
    trigger_type: z.string(),
    scheduled_for: z.string(),
    created_at: z.string().nullable().optional(),
});

const DailyReportCacheSchema = z.object({
    id: z.number(),
    report_date: z.string(),
    total_expense: z.number(),
    total_income: z.number(),
    top_category: z.string().nullable().optional(),
    top_category_amount: z.number().nullable().optional(),
    transaction_count: z.number(),
    month_expense_to_date: z.number(),
    current_balance: z.number(),
    last_updated: z.string().nullable().optional(),
});

const CategorySchema = z.object({
    id: z.number(),
    name: z.string(),
    is_recurring: z.number().nullish().transform(val => val ?? 0),
    default_validity: z.number().nullish().transform(val => val ?? null),
    sort_order: z.number().nullish().transform(val => val ?? null),
});

const CategorySubcategorySchema = z.object({
    id: z.number(),
    category_id: z.number(),
    name: z.string(),
    is_recurring: z.number().nullish().transform(val => val ?? 0),
    default_validity: z.number().nullish().transform(val => val ?? null),
});

const BackupDataSchema = z.object({
    metadata: z.object({
        timestamp: z.number(),
        date: z.string(),
        schemaVersion: z.number(),
        appVersion: z.string(),
        platform: z.string(),
    }),
    data: z.object({
        accounts: z.array(AccountSchema),
        transactions: z.array(TransactionSchema),
        incomeSources: z.array(IncomeSourceSchema).optional().default([]),
        debts: z.array(DebtSchema).optional().default([]),
        debtHistory: z.array(DebtHistorySchema).optional().default([]),
        expenseBooks: z.array(ExpenseBookSchema).optional().default([]),
        expenseBookItems: z.array(BookItemSchema).optional().default([]),
        categoryBudgets: z.array(CategoryBudgetSchema).optional().default([]),
        billGroups: z.array(BillGroupSchema).optional().default([]),
        billGroupMembers: z.array(BillGroupMemberSchema).optional().default([]),
        billExpenses: z.array(BillExpenseSchema).optional().default([]),
        billExpenseSplits: z.array(BillExpenseSplitSchema).optional().default([]),
        rechargeMeta: z.array(RechargeMetaSchema).optional().default([]),
        savingsGoals: z.array(SavingsGoalSchema).optional().default([]),
        savingsContributions: z.array(SavingsContributionSchema).optional().default([]),
        subscriptions: z.array(SubscriptionSchema).optional().default([]),
        debtRecords: z.array(DebtRecordSchema).optional().default([]),
        debtRepayments: z.array(DebtRepaymentSchema).optional().default([]),
        chitFunds: z.array(ChitFundSchema).optional().default([]),
        chitMonthlyRecords: z.array(ChitMonthlyRecordSchema).optional().default([]),
        chitMembers: z.array(ChitMemberSchema).optional().default([]),
        emiRecords: z.array(EmiRecordSchema).optional().default([]),
        emiPayments: z.array(EmiPaymentSchema).optional().default([]),
        notificationSchedules: z.array(NotificationScheduleSchema).optional().default([]),
        dailyReportCache: z.array(DailyReportCacheSchema).optional().default([]),
        categories: z.array(CategorySchema).optional().default([]),
        categorySubcategories: z.array(CategorySubcategorySchema).optional().default([]),
    }),
});

// Helper to sanitize filename
const getSafeFilename = (prefix: string, ext: string) => {
    const date = new Date().toISOString().split('T')[0];
    const time = new Date().getTime();
    return `${prefix}_${date}_${time}.${ext}`;
};

export const exportData = async () => {
    try {
        await initDatabase();
        const db = getDatabase();

        // 1. Fetch all data in parallel
        const [
            transactions,
            accounts,
            incomeSources,
            debts,
            debtHistory,
            expenseBooks,
            expenseBookItems,
            categoryBudgets,
            billGroups,
            billGroupMembers,
            billExpenses,
            billExpenseSplits,
            rechargeMeta,
            savingsGoals,
            savingsContributions,
            subscriptions,
            debtRecords,
            debtRepayments,
            chitFunds,
            chitMonthlyRecords,
            chitMembers,
            emiRecords,
            emiPayments,
            notificationSchedules,
            dailyReportCache,
            categories,
            categorySubcategories
        ] = await Promise.all([
            db.getAllAsync<Transaction>('SELECT * FROM transactions'),
            db.getAllAsync<Account>('SELECT * FROM accounts'), // Includes meta categories
            db.getAllAsync<IncomeSource>('SELECT * FROM income_sources'),
            db.getAllAsync<Debt>('SELECT * FROM debts'),
            db.getAllAsync<DebtHistory>('SELECT * FROM debt_history'),
            db.getAllAsync<ExpenseBook>('SELECT * FROM expense_books'),
            db.getAllAsync<BookItem>('SELECT * FROM expense_book_items'),
            db.getAllAsync<any>('SELECT * FROM category_budgets'),
            db.getAllAsync<BillGroup>('SELECT * FROM bill_groups'),
            db.getAllAsync<BillGroupMember>('SELECT * FROM bill_group_members'),
            db.getAllAsync<BillExpense>('SELECT * FROM bill_expenses'),
            db.getAllAsync<BillExpenseSplit>('SELECT * FROM bill_expense_splits'),
            db.getAllAsync<RechargeMeta>('SELECT * FROM recharge_meta'),
            db.getAllAsync<SavingsGoal>('SELECT * FROM savings_goals'),
            db.getAllAsync<SavingsContribution>('SELECT * FROM savings_contributions'),
            db.getAllAsync<Subscription>('SELECT * FROM subscriptions'),
            db.getAllAsync<any>('SELECT * FROM debt_records'),
            db.getAllAsync<any>('SELECT * FROM debt_repayments'),
            db.getAllAsync<any>('SELECT * FROM chit_funds'),
            db.getAllAsync<any>('SELECT * FROM chit_monthly_records'),
            db.getAllAsync<any>('SELECT * FROM chit_members'),
            db.getAllAsync<any>('SELECT * FROM emi_records'),
            db.getAllAsync<any>('SELECT * FROM emi_payments'),
            db.getAllAsync<any>('SELECT * FROM notification_schedules'),
            db.getAllAsync<any>('SELECT * FROM daily_report_cache'),
            db.getAllAsync<any>('SELECT * FROM categories'),
            db.getAllAsync<any>('SELECT * FROM category_subcategories'),
        ]);

        // 2. Construct Backup Object
        const backup: BackupData = {
            metadata: {
                timestamp: Date.now(),
                date: new Date().toISOString(),
                schemaVersion: CURRENT_SCHEMA_VERSION,
                appVersion: EXPORT_APP_VERSION,
                platform: Platform.OS,
            },
            data: {
                accounts,
                transactions,
                incomeSources,
                debts,
                debtHistory,
                expenseBooks,
                expenseBookItems,
                categoryBudgets,
                billGroups,
                billGroupMembers,
                billExpenses,
                billExpenseSplits,
                rechargeMeta,
                savingsGoals,
                savingsContributions,
                subscriptions,
                debtRecords,
                debtRepayments,
                chitFunds,
                chitMonthlyRecords,
                chitMembers,
                emiRecords,
                emiPayments,
                notificationSchedules,
                dailyReportCache,
                categories,
                categorySubcategories
            }
        };

        // 3. Write to File
        const jsonString = JSON.stringify(backup, null, 2);
        const fileName = getSafeFilename('expense_tracker_backup', 'json');
        const fileUri = cacheDirectory + fileName;

        await writeAsStringAsync(fileUri, jsonString, { encoding: 'utf8' });

        // 4. Share
        if (await Sharing.isAvailableAsync()) {
            await Sharing.shareAsync(fileUri, {
                mimeType: 'application/json',
                dialogTitle: 'Save Backup File'
            });
        } else {
            Alert.alert("Error", "Sharing is not available on this device");
        }

    } catch (error) {
        console.error('Export failed:', error);
        Alert.alert('Export Failed', 'An error occurred while creating the backup.');
    }
};

export const exportCSV = async () => {
    try {
        await initDatabase();
        const db = getDatabase();
        const transactions = await db.getAllAsync<Transaction>('SELECT * FROM transactions ORDER BY date DESC');

        if (transactions.length === 0) {
            Alert.alert('No Data', 'No transactions to export.');
            return;
        }

        // CSV Header
        let csvContent = "Date,Description,Category,Subcategory,Amount,Account ID,Created At\n";

        // CSV Rows
        transactions.forEach(tx => {
            // Escape quotes and handle commas in text
            const desc = tx.description ? `"${tx.description.replace(/"/g, '""')}"` : '';
            const cat = `"${tx.category}"`;
            const sub = `"${tx.subcategory}"`;
            const date = new Date(tx.date).toLocaleDateString() + ' ' + new Date(tx.date).toLocaleTimeString();

            csvContent += `${date},${desc},${cat},${sub},${tx.amount},${tx.account_id},${tx.created_at}\n`;
        });

        const fileName = getSafeFilename('transactions_export', 'csv');
        const fileUri = cacheDirectory + fileName;

        await writeAsStringAsync(fileUri, csvContent, { encoding: 'utf8' });

        if (await Sharing.isAvailableAsync()) {
            await Sharing.shareAsync(fileUri, {
                mimeType: 'text/csv',
                dialogTitle: 'Export CSV'
            });
        }

    } catch (error) {
        console.error('CSV Export failed:', error);
        Alert.alert('Export Failed', 'An error occurred while generating CSV.');
    }
};

export const restoreData = async () => {
    try {
        // 1. Pick File
        const result = await DocumentPicker.getDocumentAsync({
            type: ['application/json', '*/*'], // Allow generic types in case mime detection fails
            copyToCacheDirectory: true
        });

        if (result.canceled) return;

        const fileUri = result.assets[0].uri;

        // 2. Read and Parse
        const fileContent = await readAsStringAsync(fileUri);
        const parsedJson = JSON.parse(fileContent);

        // 3. Validate Zod Schema
        const validation = BackupDataSchema.safeParse(parsedJson);
        if (!validation.success) {
            console.error('Backup validation failed:', validation.error.format());
            throw new Error("Invalid backup file format. Schema validation failed.");
        }
        const backup = validation.data;

        if (backup.metadata.schemaVersion > CURRENT_SCHEMA_VERSION) {
            Alert.alert(
                "Incompatible Version",
                `This backup is from a newer version of the app (Schema v${backup.metadata.schemaVersion}). Please update the app to restore it.`
            );
            return;
        }

        // 4. Confirm Alert
        Alert.alert(
            "Confirm Restore",
            "⚠️ This will PERMANENTLY REPLACE all your current data. This action cannot be undone. Are you sure?",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Restore Now",
                    style: "destructive",
                    onPress: () => performRestore(backup.data)
                }
            ]
        );

    } catch (error) {
        console.error('Restore failed:', error);
        Alert.alert('Restore Failed', 'Invalid header or corrupt file.');
    }
};

const performRestore = async (data: BackupData['data']) => {
    try {
        await initDatabase();
        const db = getDatabase();

        await db.withTransactionAsync(async () => {
            // 1. Wipe All Tables (Reverse Sequence)
            await db.runAsync('DELETE FROM bill_expense_splits');
            await db.runAsync('DELETE FROM bill_expenses');
            await db.runAsync('DELETE FROM bill_group_members');
            await db.runAsync('DELETE FROM bill_groups');
            await db.runAsync('DELETE FROM expense_book_items');
            await db.runAsync('DELETE FROM expense_books');
            await db.runAsync('DELETE FROM debt_history');
            await db.runAsync('DELETE FROM debts');
            await db.runAsync('DELETE FROM income_sources');
            await db.runAsync('DELETE FROM category_budgets');
            await db.runAsync('DELETE FROM recharge_meta');
            await db.runAsync('DELETE FROM savings_contributions');
            await db.runAsync('DELETE FROM savings_goals');
            await db.runAsync('DELETE FROM emi_payments');
            await db.runAsync('DELETE FROM emi_records');
            await db.runAsync('DELETE FROM chit_monthly_records');
            await db.runAsync('DELETE FROM chit_members');
            await db.runAsync('DELETE FROM chit_funds');
            await db.runAsync('DELETE FROM debt_repayments');
            await db.runAsync('DELETE FROM debt_records');
            await db.runAsync('DELETE FROM subscriptions');
            await db.runAsync('DELETE FROM notification_schedules');
            await db.runAsync('DELETE FROM daily_report_cache');
            await db.runAsync('DELETE FROM transactions');
            await db.runAsync('DELETE FROM category_subcategories');
            await db.runAsync('DELETE FROM categories');
            await db.runAsync('DELETE FROM accounts');

            // 2. Insert Data (Strict Order)

            // Accounts (restore IDs to maintain relationships)
            for (const acc of data.accounts) {
                await db.runAsync(
                    'INSERT INTO accounts (id, name, balance, type) VALUES (?, ?, ?, ?)',
                    [acc.id, acc.name, acc.balance, acc.type]
                );
            }

            // Categories
            if (data.categories) {
                for (const cat of data.categories) {
                    await db.runAsync(
                        'INSERT INTO categories (id, name, is_recurring, default_validity, sort_order) VALUES (?, ?, ?, ?, ?)',
                        [cat.id, cat.name, cat.is_recurring, cat.default_validity, cat.sort_order]
                    );
                }
            }

            // Category Subcategories
            if (data.categorySubcategories) {
                for (const subcat of data.categorySubcategories) {
                    await db.runAsync(
                        'INSERT INTO category_subcategories (id, category_id, name, is_recurring, default_validity) VALUES (?, ?, ?, ?, ?)',
                        [subcat.id, subcat.category_id, subcat.name, subcat.is_recurring, subcat.default_validity]
                    );
                }
            }

            // Income Sources
            for (const inc of data.incomeSources) {
                await db.runAsync(
                    'INSERT INTO income_sources (id, name, icon) VALUES (?, ?, ?)',
                    [inc.id, inc.name, inc.icon]
                );
            }

            // Category Budgets
            if (data.categoryBudgets) {
                for (const cb of data.categoryBudgets) {
                    await db.runAsync(
                        'INSERT INTO category_budgets (id, category, amount, month, created_at) VALUES (?, ?, ?, ?, ?)',
                        [cb.id, cb.category, cb.amount, cb.month, cb.created_at]
                    );
                }
            }

            // Transactions
            for (const tx of data.transactions) {
                await db.runAsync(
                    'INSERT INTO transactions (id, amount, category, subcategory, account_id, date, description, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                    [tx.id, tx.amount, tx.category, tx.subcategory, tx.account_id, tx.date, tx.description, tx.created_at]
                );
            }

            // Debts
            for (const debt of data.debts) {
                await db.runAsync(
                    'INSERT INTO debts (id, name, type, amount, notes, created_at, last_updated) VALUES (?, ?, ?, ?, ?, ?, ?)',
                    [debt.id, debt.name, debt.type, debt.amount, debt.notes, debt.created_at, debt.last_updated]
                );
            }

            // Debt History
            for (const dh of data.debtHistory) {
                await db.runAsync(
                    'INSERT INTO debt_history (id, debt_id, change_amount, action, notes, date) VALUES (?, ?, ?, ?, ?, ?)',
                    [dh.id, dh.debt_id, dh.change_amount, dh.action, dh.notes, dh.date]
                );
            }

            // Expense Books
            for (const book of data.expenseBooks) {
                await db.runAsync(
                    'INSERT INTO expense_books (id, name, description, budget, created_at, last_updated) VALUES (?, ?, ?, ?, ?, ?)',
                    [book.id, book.name, book.description ?? null, book.budget, book.created_at, book.last_updated]
                );
            }

            // Expense Book Items
            for (const item of data.expenseBookItems) {
                await db.runAsync(
                    'INSERT INTO expense_book_items (id, book_id, name, amount, notes, date, type, income_source_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                    [item.id, item.book_id, item.name, item.amount, item.notes ?? null, item.date, item.type ?? 'expense', item.income_source_id ?? null]
                );
            }

            // Bill Groups
            if (data.billGroups) {
                for (const g of data.billGroups) {
                    await db.runAsync(
                        'INSERT INTO bill_groups (id, name, description, created_at, last_updated, is_archived) VALUES (?, ?, ?, ?, ?, ?)',
                        [g.id, g.name, g.description ?? null, g.created_at, g.last_updated, g.is_archived]
                    );
                }
            }

            // Bill Group Members
            if (data.billGroupMembers) {
                for (const m of data.billGroupMembers) {
                    await db.runAsync(
                        'INSERT INTO bill_group_members (id, group_id, name, created_at) VALUES (?, ?, ?, ?)',
                        [m.id, m.group_id, m.name, m.created_at]
                    );
                }
            }

            // Bill Expenses
            if (data.billExpenses) {
                for (const e of data.billExpenses) {
                    await db.runAsync(
                        'INSERT INTO bill_expenses (id, group_id, title, amount, paid_by_member_id, date, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                        [e.id, e.group_id, e.title, e.amount, e.paid_by_member_id, e.date, e.notes ?? null, e.created_at]
                    );
                }
            }

            // Bill Expense Splits
            if (data.billExpenseSplits) {
                for (const s of data.billExpenseSplits) {
                    await db.runAsync(
                        'INSERT INTO bill_expense_splits (id, expense_id, member_id, amount, created_at) VALUES (?, ?, ?, ?, ?)',
                        [s.id, s.expense_id, s.member_id, s.amount, s.created_at]
                    );
                }
            }

            // Recharge Meta (Restore after transactions)
            if (data.rechargeMeta) {
                for (const rm of data.rechargeMeta) {
                    await db.runAsync(
                        'INSERT INTO recharge_meta (id, expense_id, validity_days, expiry_date, reminder_date, notification_id) VALUES (?, ?, ?, ?, ?, ?)',
                        [rm.id, rm.expense_id, rm.validity_days, rm.expiry_date, rm.reminder_date, rm.notification_id]
                    );
                }
            }

            if (data.savingsGoals) {
                for (const g of data.savingsGoals) {
                    await db.runAsync(
                        'INSERT INTO savings_goals (id, name, target_amount, current_amount, deadline, linked_account_id, icon, color, created_at, last_updated, is_completed) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                        [g.id, g.name, g.target_amount, g.current_amount, g.deadline, g.linked_account_id, g.icon, g.color, g.created_at, g.last_updated, g.is_completed]
                    );
                }
            }

            if (data.savingsContributions) {
                for (const c of data.savingsContributions) {
                    await db.runAsync(
                        'INSERT INTO savings_contributions (id, goal_id, amount, date, notes, auto_detected, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
                        [c.id, c.goal_id, c.amount, c.date, c.notes, c.auto_detected, c.created_at]
                    );
                }
            }

            if (data.subscriptions) {
                for (const s of data.subscriptions) {
                    await db.runAsync(
                        'INSERT INTO subscriptions (id, name, amount, billing_cycle, next_renewal_date, category, account_id, icon, color, is_active, reminder_notification_id, notes, created_at, last_updated, custom_interval_value, custom_interval_unit, website, auto_renew, payment_method, sub_category, reminder_days_before, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                        [s.id, s.name, s.amount, s.billing_cycle, s.next_renewal_date, s.category, s.account_id, s.icon, s.color, s.is_active, s.reminder_notification_id, s.notes, s.created_at, s.last_updated, s.custom_interval_value ?? null, s.custom_interval_unit ?? null, s.website ?? null, s.auto_renew ?? 1, s.payment_method ?? null, s.sub_category ?? null, s.reminder_days_before ?? 3, s.status ?? 'active']
                    );
                }
            }

            // --- New Modules Restore ---

            if (data.debtRecords) {
                for (const d of data.debtRecords) {
                    await db.runAsync(
                        'INSERT INTO debt_records (id, name, description, principal, interest_rate, interest_type, repayment_freq, custom_freq_days, start_date, expected_end_date, status, direction, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                        [d.id, d.name, d.description ?? null, d.principal, d.interest_rate, d.interest_type, d.repayment_freq, d.custom_freq_days, d.start_date, d.expected_end_date, d.status, d.direction, d.created_at, d.updated_at]
                    );
                }
            }

            if (data.debtRepayments) {
                for (const dr of data.debtRepayments) {
                    await db.runAsync(
                        'INSERT INTO debt_repayments (id, debt_id, amount, payment_date, payment_type, note, account_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                        [dr.id, dr.debt_id, dr.amount, dr.payment_date, dr.payment_type, dr.note ?? null, dr.account_id, dr.created_at]
                    );
                }
            }

            if (data.chitFunds) {
                for (const cf of data.chitFunds) {
                    await db.runAsync(
                        'INSERT INTO chit_funds (id, name, total_members, monthly_amount, total_pot, duration_months, start_date, foreman_commission, status, my_turn_month, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                        [cf.id, cf.name, cf.total_members, cf.monthly_amount, cf.total_pot, cf.duration_months, cf.start_date, cf.foreman_commission, cf.status, cf.my_turn_month, cf.notes ?? null, cf.created_at]
                    );
                }
            }

            if (data.chitMonthlyRecords) {
                for (const cm of data.chitMonthlyRecords) {
                    await db.runAsync(
                        'INSERT INTO chit_monthly_records (id, chit_id, month_number, month_date, amount_paid, payment_date, payment_status, winner_name, winner_is_me, bid_amount, pot_amount, commission_deducted, net_received, dividend_received, account_id, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                        [cm.id, cm.chit_id, cm.month_number, cm.month_date, cm.amount_paid, cm.payment_date, cm.payment_status, cm.winner_name, cm.winner_is_me, cm.bid_amount, cm.pot_amount, cm.commission_deducted, cm.net_received, cm.dividend_received, cm.account_id, cm.notes ?? null, cm.created_at]
                    );
                }
            }

            if (data.chitMembers) {
                for (const mb of data.chitMembers) {
                    await db.runAsync(
                        'INSERT INTO chit_members (id, chit_id, member_name, member_turn_month, notes) VALUES (?, ?, ?, ?, ?)',
                        [mb.id, mb.chit_id, mb.member_name, mb.member_turn_month, mb.notes ?? null]
                    );
                }
            }

            if (data.emiRecords) {
                for (const er of data.emiRecords) {
                    await db.runAsync(
                        'INSERT INTO emi_records (id, name, lender_name, principal, total_amount, emi_amount, interest_rate, tenure_months, start_date, due_day, is_autopay, autopay_account_id, status, category, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                        [er.id, er.name, er.lender_name ?? null, er.principal, er.total_amount, er.emi_amount, er.interest_rate, er.tenure_months, er.start_date, er.due_day, er.is_autopay, er.autopay_account_id, er.status, er.category, er.notes ?? null, er.created_at, er.updated_at]
                    );
                }
            }

            if (data.emiPayments) {
                for (const ep of data.emiPayments) {
                    await db.runAsync(
                        'INSERT INTO emi_payments (id, emi_id, month_number, due_date, paid_date, amount_paid, principal_component, interest_component, outstanding_balance, payment_status, payment_mode, account_id, transaction_id, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                        [ep.id, ep.emi_id, ep.month_number, ep.due_date, ep.paid_date, ep.amount_paid, ep.principal_component, ep.interest_component, ep.outstanding_balance, ep.payment_status, ep.payment_mode, ep.account_id, ep.transaction_id, ep.notes ?? null, ep.created_at]
                    );
                }
            }

            if (data.notificationSchedules) {
                for (const ns of data.notificationSchedules) {
                    await db.runAsync(
                        'INSERT INTO notification_schedules (id, item_type, item_id, notification_id, trigger_type, scheduled_for, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
                        [ns.id, ns.item_type, ns.item_id, ns.notification_id, ns.trigger_type, ns.scheduled_for, ns.created_at]
                    );
                }
            }

            if (data.dailyReportCache) {
                for (const dr of data.dailyReportCache) {
                    await db.runAsync(
                        'INSERT INTO daily_report_cache (id, report_date, total_expense, total_income, top_category, top_category_amount, transaction_count, month_expense_to_date, current_balance, last_updated) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                        [dr.id, dr.report_date, dr.total_expense, dr.total_income, dr.top_category, dr.top_category_amount, dr.transaction_count, dr.month_expense_to_date, dr.current_balance, dr.last_updated]
                    );
                }
            }
        });

        Alert.alert("Success", "Data restored successfully! The app will reload to apply changes.");

    } catch (e) {
        console.error("Restore Transaction Failed", e);
        Alert.alert("Restore Failed", "Database error during restore. No changes were applied.");
        throw e; // trigger rollback
    }
};
