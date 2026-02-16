// import * as FileSystem from 'expo-file-system'; // usage deprecated in strict mode
import { writeAsStringAsync, readAsStringAsync, documentDirectory, cacheDirectory } from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { Alert, Platform } from 'react-native';
import {
    getDatabase,
    initDatabase,
    Transaction,
    Account,
    CATEGORY_META_TYPE,
    IncomeSource,
    Debt,
    DebtHistory,
    RechargeMeta
} from './database';
import { ExpenseBook, BookItem } from './books';
import { BillGroup, BillGroupMember, BillExpense, BillExpenseSplit } from './billSplitter';

// Schema Versioning to ensure backward/forward compatibility in future
const CURRENT_SCHEMA_VERSION = 1;
const EXPORT_APP_VERSION = '1.9.2';

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
    };
}

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
            rechargeMeta
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
                rechargeMeta
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
        const backup: BackupData = JSON.parse(fileContent);

        // 3. Validate
        if (!backup.metadata || !backup.data || !backup.metadata.schemaVersion) {
            throw new Error("Invalid backup file format. Missing metadata.");
        }

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
            await db.runAsync('DELETE FROM transactions');
            await db.runAsync('DELETE FROM accounts');

            // 2. Insert Data (Strict Order)

            // Accounts (restore IDs to maintain relationships)
            for (const acc of data.accounts) {
                await db.runAsync(
                    'INSERT INTO accounts (id, name, balance, type) VALUES (?, ?, ?, ?)',
                    [acc.id, acc.name, acc.balance, acc.type]
                );
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
                    'INSERT INTO expense_book_items (id, book_id, name, amount, notes, date) VALUES (?, ?, ?, ?, ?, ?)',
                    [item.id, item.book_id, item.name, item.amount, item.notes ?? null, item.date]
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

        });

        Alert.alert("Success", "Data restored successfully! The app will reload to apply changes.", [
            {
                text: "OK", onPress: () => {
                    // In a real app we might restart, here we just let the user know. 
                    // The navigation/context might need a manual refresh hook, but since we are replacing DB, 
                    // usually the next fetch hook updates UI. A forcible reload is better.
                    // For now, simple alert.
                }
            }
        ]);

    } catch (e) {
        console.error("Restore Transaction Failed", e);
        Alert.alert("Restore Failed", "Database error during restore. No changes were applied.");
        throw e; // trigger rollback
    }
};
