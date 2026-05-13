
import * as SQLite from 'expo-sqlite';

const DB_NAME = 'expense_tracker.db';

export interface Transaction {
  id: number;
  amount: number;
  category: string;
  subcategory: string;
  account_id: number;
  date: string; // ISO string
  description: string;
  created_at: number;
  type?: 'expense' | 'income' | 'transfer' | 'debt';
}

export interface Account {
  id: number;
  name: string;
  balance: number;
  type: string;
}

export const CATEGORY_META_TYPE = 'meta_categories';

export interface CategoryNode {
  id: string;
  name: string;
  subcategories: string[];
  is_recurring?: boolean;
  default_validity?: number;
  subcategory_settings?: Record<string, {
    is_recurring: boolean;
    default_validity?: number;
  }>;
}

export interface IncomeSource {
  id: number;
  name: string;
  icon: string;
}

let db: SQLite.SQLiteDatabase | null = null;
let isInitializing = false;

let lastTransactionTime = 0;

const getAccountBalanceDelta = (tx: Pick<Transaction, 'amount' | 'category' | 'subcategory'>) => {
  if (tx.category === 'Income') return tx.amount;
  if (tx.category === 'Debt/Credit') {
    return tx.subcategory === 'Borrowed' || tx.subcategory === 'Received Back'
      ? tx.amount
      : -tx.amount;
  }
  return -tx.amount;
};

export const initDatabase = async () => {
  if (db) return;

  if (isInitializing) {
    while (isInitializing) {
      await new Promise(resolve => setTimeout(resolve, 50));
      if (db) return;
    }
  }

  isInitializing = true;

  try {
    db = await SQLite.openDatabaseAsync(DB_NAME);

    // Enable WAL mode
    await db.execAsync('PRAGMA journal_mode = WAL;');

    // Creates
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        amount REAL NOT NULL,
        category TEXT NOT NULL,
        subcategory TEXT NOT NULL,
        account_id INTEGER NOT NULL,
        date TEXT NOT NULL,
        description TEXT,
        created_at INTEGER NOT NULL
      );
    `);

    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS accounts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        balance REAL NOT NULL,
        type TEXT NOT NULL
      );
    `);

    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS category_budgets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        category TEXT NOT NULL,
        amount REAL NOT NULL,
        month TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        UNIQUE(category, month)
      );
    `);

    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS income_sources (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        icon TEXT NOT NULL
      );
    `);

    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS debts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        type TEXT NOT NULL, -- 'debt' or 'receivable'
        amount REAL DEFAULT 0,
        notes TEXT,
        created_at INTEGER,
        last_updated INTEGER
      );
    `);

    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS debt_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        debt_id INTEGER NOT NULL,
        change_amount REAL NOT NULL,
        action TEXT NOT NULL, -- 'increase' or 'reduce'
        notes TEXT,
        date INTEGER,
        FOREIGN KEY (debt_id) REFERENCES debts (id) ON DELETE CASCADE
      );
    `);

    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS expense_books (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT,
        budget REAL DEFAULT 0,
        created_at INTEGER NOT NULL,
        last_updated INTEGER NOT NULL
      );
    `);

    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS expense_book_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        book_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        amount REAL NOT NULL,
        notes TEXT,
        date INTEGER NOT NULL,
        type TEXT DEFAULT 'expense',
        income_source_id INTEGER,
        FOREIGN KEY (book_id) REFERENCES expense_books(id) ON DELETE CASCADE
      );
    `);

    // Safe Migration for existing installations
    const tableInfo = await db.getAllAsync<{ name: string }>("PRAGMA table_info(expense_book_items)");
    const columnNames = tableInfo.map(c => c.name);

    if (!columnNames.includes('type')) {
      await db.execAsync("ALTER TABLE expense_book_items ADD COLUMN type TEXT DEFAULT 'expense'");
    }
    if (!columnNames.includes('income_source_id')) {
      await db.execAsync("ALTER TABLE expense_book_items ADD COLUMN income_source_id INTEGER");
    }

    // --- Bill Splitter (Group Expenses) Tables ---

    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS bill_groups (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT,
        created_at INTEGER NOT NULL,
        last_updated INTEGER NOT NULL,
        is_archived INTEGER DEFAULT 0
      );
    `);

    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS bill_group_members (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        group_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        FOREIGN KEY (group_id) REFERENCES bill_groups(id) ON DELETE CASCADE
      );
    `);

    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS bill_expenses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        group_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        amount REAL NOT NULL,
        paid_by_member_id INTEGER NOT NULL,
        date INTEGER NOT NULL,
        notes TEXT,
        created_at INTEGER NOT NULL,
        FOREIGN KEY (group_id) REFERENCES bill_groups(id) ON DELETE CASCADE,
        FOREIGN KEY (paid_by_member_id) REFERENCES bill_group_members(id) ON DELETE CASCADE
      );
    `);

    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS bill_expense_splits (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        expense_id INTEGER NOT NULL,
        member_id INTEGER NOT NULL,
        amount REAL NOT NULL,
        created_at INTEGER NOT NULL,
        FOREIGN KEY (expense_id) REFERENCES bill_expenses(id) ON DELETE CASCADE,
        FOREIGN KEY (member_id) REFERENCES bill_group_members(id) ON DELETE CASCADE
      );
    `);

    // --- Recharge Tracking ---
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS recharge_meta (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        expense_id INTEGER NOT NULL,
        validity_days INTEGER NOT NULL,
        expiry_date TEXT NOT NULL,
        reminder_date TEXT NOT NULL,
        notification_id TEXT,
        FOREIGN KEY (expense_id) REFERENCES transactions(id) ON DELETE CASCADE
      );
    `);

    // --- Savings Goals ---
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS savings_goals (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        target_amount REAL NOT NULL,
        current_amount REAL DEFAULT 0,
        deadline TEXT NOT NULL,
        linked_account_id INTEGER,
        icon TEXT DEFAULT '🎯',
        color TEXT DEFAULT '#6941C6',
        created_at INTEGER NOT NULL,
        last_updated INTEGER NOT NULL,
        is_completed INTEGER DEFAULT 0,
        FOREIGN KEY (linked_account_id) REFERENCES accounts(id)
      );
    `);

    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS savings_contributions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        goal_id INTEGER NOT NULL,
        amount REAL NOT NULL,
        date TEXT NOT NULL,
        notes TEXT,
        auto_detected INTEGER DEFAULT 0,
        created_at INTEGER NOT NULL,
        FOREIGN KEY (goal_id) REFERENCES savings_goals(id) ON DELETE CASCADE
      );
    `);

    await db.execAsync('DROP TABLE IF EXISTS payee_mappings;');

    // --- Subscription Tracker ---
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS subscriptions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        amount REAL NOT NULL,
        billing_cycle TEXT NOT NULL DEFAULT 'monthly',
        next_renewal_date TEXT NOT NULL,
        category TEXT DEFAULT 'Subscriptions',
        account_id INTEGER,
        icon TEXT DEFAULT '📦',
        color TEXT DEFAULT '#7C3AED',
        is_active INTEGER DEFAULT 1,
        reminder_notification_id TEXT,
        notes TEXT,
        created_at INTEGER NOT NULL,
        last_updated INTEGER NOT NULL,
        custom_interval_value INTEGER DEFAULT NULL,
        custom_interval_unit TEXT DEFAULT NULL,
        website TEXT DEFAULT NULL,
        auto_renew INTEGER DEFAULT 1,
        payment_method TEXT DEFAULT NULL,
        sub_category TEXT DEFAULT NULL,
        reminder_days_before INTEGER DEFAULT 3,
        status TEXT DEFAULT 'active',
        FOREIGN KEY (account_id) REFERENCES accounts(id)
      );
    `);

    // Migration for subscriptions table
    const subTableInfo = await db.getAllAsync<{ name: string }>("PRAGMA table_info(subscriptions)");
    const subColumnNames = subTableInfo.map(c => c.name);

    if (!subColumnNames.includes('custom_interval_value')) {
      await db.execAsync("ALTER TABLE subscriptions ADD COLUMN custom_interval_value INTEGER DEFAULT NULL");
    }
    if (!subColumnNames.includes('custom_interval_unit')) {
      await db.execAsync("ALTER TABLE subscriptions ADD COLUMN custom_interval_unit TEXT DEFAULT NULL");
    }
    if (!subColumnNames.includes('website')) {
      await db.execAsync("ALTER TABLE subscriptions ADD COLUMN website TEXT DEFAULT NULL");
    }
    if (!subColumnNames.includes('auto_renew')) {
      await db.execAsync("ALTER TABLE subscriptions ADD COLUMN auto_renew INTEGER DEFAULT 1");
    }
    if (!subColumnNames.includes('payment_method')) {
      await db.execAsync("ALTER TABLE subscriptions ADD COLUMN payment_method TEXT DEFAULT NULL");
    }
    if (!subColumnNames.includes('sub_category')) {
      await db.execAsync("ALTER TABLE subscriptions ADD COLUMN sub_category TEXT DEFAULT NULL");
    }
    if (!subColumnNames.includes('reminder_days_before')) {
      await db.execAsync("ALTER TABLE subscriptions ADD COLUMN reminder_days_before INTEGER DEFAULT 3");
    }
    if (!subColumnNames.includes('status')) {
      await db.execAsync("ALTER TABLE subscriptions ADD COLUMN status TEXT DEFAULT 'active'");
    }

    // --- Notification & Report Tables ---
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS notification_schedules (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        item_type TEXT NOT NULL,       -- 'subscription' | 'recharge' | 'bill'
        item_id INTEGER NOT NULL,
        notification_id TEXT NOT NULL,  -- expo notification identifier
        trigger_type TEXT NOT NULL,     -- '7d' | '3d' | '2d' | '1d' | '0d' | '0d_eve' | 'overdue' | 'daily_YYYY-MM-DD'
        scheduled_for TEXT NOT NULL,    -- ISO date string
        created_at INTEGER NOT NULL
      );
    `);

    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS daily_report_cache (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        report_date TEXT NOT NULL UNIQUE,
        total_expense REAL DEFAULT 0,
        total_income REAL DEFAULT 0,
        top_category TEXT DEFAULT '',
        top_category_amount REAL DEFAULT 0,
        transaction_count INTEGER DEFAULT 0,
        month_expense_to_date REAL DEFAULT 0,
        current_balance REAL DEFAULT 0,
        last_updated INTEGER NOT NULL
      );
    `);

    // --- Debt Tracker Tables ---
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS debt_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT DEFAULT NULL,
        principal REAL NOT NULL,
        interest_rate REAL DEFAULT 0,
        interest_type TEXT DEFAULT 'none',
        repayment_freq TEXT DEFAULT 'monthly',
        custom_freq_days INTEGER DEFAULT NULL,
        start_date TEXT NOT NULL,
        expected_end_date TEXT DEFAULT NULL,
        status TEXT DEFAULT 'active',
        direction TEXT DEFAULT 'borrowed',
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );
    `);

    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS debt_repayments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        debt_id INTEGER NOT NULL,
        amount REAL NOT NULL,
        payment_date TEXT NOT NULL,
        payment_type TEXT DEFAULT 'principal',
        note TEXT DEFAULT NULL,
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (debt_id) REFERENCES debt_records(id) ON DELETE CASCADE
      );
    `);

    // --- Chit Fund Tables ---
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS chit_funds (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        total_members INTEGER NOT NULL,
        monthly_amount REAL NOT NULL,
        total_pot REAL NOT NULL,
        duration_months INTEGER NOT NULL,
        start_date TEXT NOT NULL,
        foreman_commission REAL DEFAULT 5.0,
        status TEXT DEFAULT 'active',
        my_turn_month INTEGER DEFAULT NULL,
        notes TEXT DEFAULT NULL,
        created_at TEXT DEFAULT (datetime('now'))
      );
    `);

    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS chit_monthly_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        chit_id INTEGER NOT NULL,
        month_number INTEGER NOT NULL,
        month_date TEXT NOT NULL,
        amount_paid REAL DEFAULT NULL,
        payment_date TEXT DEFAULT NULL,
        payment_status TEXT DEFAULT 'pending',
        winner_name TEXT DEFAULT NULL,
        winner_is_me INTEGER DEFAULT 0,
        bid_amount REAL DEFAULT NULL,
        pot_amount REAL DEFAULT NULL,
        commission_deducted REAL DEFAULT NULL,
        net_received REAL DEFAULT NULL,
        dividend_received REAL DEFAULT NULL,
        notes TEXT DEFAULT NULL,
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (chit_id) REFERENCES chit_funds(id) ON DELETE CASCADE
      );
    `);

    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS chit_members (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        chit_id INTEGER NOT NULL,
        member_name TEXT NOT NULL,
        member_turn_month INTEGER DEFAULT NULL,
        notes TEXT DEFAULT NULL,
        FOREIGN KEY (chit_id) REFERENCES chit_funds(id) ON DELETE CASCADE
      );
    `);

    // --- EMI Tracker Tables ---
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS emi_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        lender_name TEXT DEFAULT NULL,
        principal REAL NOT NULL,
        total_amount REAL NOT NULL,
        emi_amount REAL NOT NULL,
        interest_rate REAL DEFAULT 0,
        tenure_months INTEGER NOT NULL,
        start_date TEXT NOT NULL,
        due_day INTEGER NOT NULL,
        is_autopay INTEGER DEFAULT 0,
        autopay_account_id INTEGER DEFAULT NULL,
        status TEXT DEFAULT 'active',
        category TEXT DEFAULT 'EMI',
        notes TEXT DEFAULT NULL,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );
    `);

    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS emi_payments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        emi_id INTEGER NOT NULL,
        month_number INTEGER NOT NULL,
        due_date TEXT NOT NULL,
        paid_date TEXT DEFAULT NULL,
        amount_paid REAL DEFAULT NULL,
        principal_component REAL DEFAULT NULL,
        interest_component REAL DEFAULT NULL,
        outstanding_balance REAL DEFAULT NULL,
        payment_status TEXT DEFAULT 'pending',
        payment_mode TEXT DEFAULT NULL,
        account_id INTEGER DEFAULT NULL,
        transaction_id INTEGER DEFAULT NULL,
        notes TEXT DEFAULT NULL,
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (emi_id) REFERENCES emi_records(id) ON DELETE CASCADE
      );
    `);

    // Seed Initial Categories
    const metaCheck = await db.getAllAsync<{ id: number }>('SELECT id FROM accounts WHERE type = ?', [CATEGORY_META_TYPE]);
    if (metaCheck.length === 0) {
      const defaultCategories: CategoryNode[] = [
        { id: '1', name: 'Food', subcategories: ['Groceries', 'Dining Out', 'Snacks'] },
        { id: '2', name: 'Transport', subcategories: ['Fuel', 'Public Transport', 'Maintenance'] },
        { id: '3', name: 'Housing', subcategories: ['Rent', 'Utilities', 'Repairs'] },
        { id: '4', name: 'Entertainment', subcategories: ['Movies', 'Games', 'Subscriptions'] },
        { id: '5', name: 'Income', subcategories: ['Salary', 'Freelance', 'Investment'] },
        { id: '6', name: 'Subscription', subcategories: ['Streaming', 'Cloud Storage', 'Music', 'Software', 'Gaming', 'Other'] },
      ];
      await db.runAsync('INSERT INTO accounts (name, balance, type) VALUES (?, ?, ?)', [JSON.stringify(defaultCategories), 0, CATEGORY_META_TYPE]);
    } else {
      // Migration: Add "Subscription" category for existing users who don't have it
      const metaRow = await db.getFirstAsync<{ name: string }>('SELECT name FROM accounts WHERE type = ?', [CATEGORY_META_TYPE]);
      if (metaRow && metaRow.name) {
        const existingCats: CategoryNode[] = JSON.parse(metaRow.name);
        const hasSubscription = existingCats.some(c => c.name === 'Subscription');
        if (!hasSubscription) {
          const maxId = Math.max(...existingCats.map(c => parseInt(c.id) || 0), 0);
          existingCats.push({
            id: (maxId + 1).toString(),
            name: 'Subscription',
            subcategories: ['Streaming', 'Cloud Storage', 'Music', 'Software', 'Gaming', 'Other'],
          });
          await db.runAsync('UPDATE accounts SET name = ? WHERE type = ?', [JSON.stringify(existingCats), CATEGORY_META_TYPE]);
        }
      }
    }

    // Seed Initial Account
    const accCheck = await db.getAllAsync<{ id: number }>('SELECT id FROM accounts WHERE type != ?', [CATEGORY_META_TYPE]);
    if (accCheck.length === 0) {
      await db.runAsync('INSERT INTO accounts (name, balance, type) VALUES (?, ?, ?)', ['Cash', 0, 'Cash']);
      await db.runAsync('INSERT INTO accounts (name, balance, type) VALUES (?, ?, ?)', ['Bank', 0, 'Bank']);
    }

    // Seed Income Sources
    const incCheck = await db.getAllAsync<{ id: number }>('SELECT id FROM income_sources');
    if (incCheck.length === 0) {
      const defaults = [
        { name: 'Salary', icon: 'Briefcase' },
        { name: 'Freelance', icon: 'Tag' },
        { name: 'Investment', icon: 'TrendingUp' },
        { name: 'Gift', icon: 'Gift' },
        { name: 'Other', icon: 'DollarSign' }
      ];
      for (const d of defaults) {
        await db.runAsync('INSERT INTO income_sources (name, icon) VALUES (?, ?)', [d.name, d.icon]);
      }
    }

    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Database initialization failed:', error);
    db = null;
    throw error;
  } finally {
    isInitializing = false;
  }
};

export const getDatabase = () => {
  if (!db) {
    throw new Error("Database not initialized. Ensure initDatabase() is called.");
  }
  return db;
};

// ... Transactions (Unchanged) ...
export const addTransaction = async (tx: Omit<Transaction, 'id' | 'created_at'>): Promise<number> => {
  await initDatabase();
  const db = getDatabase();
  const timestamp = Date.now();

  // Safeguard: Prevent adding more than one transaction within 5 seconds
  if (timestamp - lastTransactionTime < 5000) {
    throw new Error("Please wait a moment before adding another transaction (1 transaction per 5 seconds).");
  }
  lastTransactionTime = timestamp;

  try {
    let insertedId = 0;
    await db.withTransactionAsync(async () => {
      const result = await db.runAsync(
        `INSERT INTO transactions (amount, category, subcategory, account_id, date, description, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [tx.amount, tx.category, tx.subcategory, tx.account_id, tx.date, tx.description, timestamp]
      );
      insertedId = result.lastInsertRowId;

      await db.runAsync(`UPDATE accounts SET balance = balance + ? WHERE id = ?`, [getAccountBalanceDelta(tx), tx.account_id]);
    });
    return insertedId;
  } catch (e) {
    console.error("Transaction Error", e);
    throw e;
  }
};

export const getTransactions = async (): Promise<Transaction[]> => {
  await initDatabase();
  const db = getDatabase();
  const txs = await db.getAllAsync<Transaction>('SELECT * FROM transactions ORDER BY date DESC');
  return txs.map(t => ({
      ...t,
      type: t.category === 'Income' ? 'income' : (t.category === 'Transfer' ? 'transfer' : (t.category === 'Debt/Credit' ? 'debt' : 'expense'))
  }));
};

export const updateTransaction = async (id: number, updated: Omit<Transaction, 'id' | 'created_at'>): Promise<void> => {
  await initDatabase();
  const db = getDatabase();

  // Throttle check (Same as addTransaction)
  const timestamp = Date.now();
  if (timestamp - lastTransactionTime < 5000) {
    throw new Error("Please wait a moment before updating (1 transaction per 5 seconds).");
  }
  lastTransactionTime = timestamp;

  try {
    await db.withTransactionAsync(async () => {
      // 1. Get original transaction to calculate balance difference
      const originalTX = await db.getFirstAsync<Transaction>('SELECT * FROM transactions WHERE id = ?', [id]);
      if (!originalTX) throw new Error("Original transaction not found");

      await db.runAsync(`UPDATE accounts SET balance = balance - ? WHERE id = ?`, [getAccountBalanceDelta(originalTX), originalTX.account_id]);

      // 3. Update transaction record
      await db.runAsync(
        `UPDATE transactions SET amount = ?, category = ?, subcategory = ?, account_id = ?, date = ?, description = ? WHERE id = ?`,
        [updated.amount, updated.category, updated.subcategory, updated.account_id, updated.date, updated.description, id]
      );

      await db.runAsync(`UPDATE accounts SET balance = balance + ? WHERE id = ?`, [getAccountBalanceDelta(updated), updated.account_id]);
    });
  } catch (e) {
    console.error("Update Transaction Error", e);
    throw e;
  }
};

export const addTransfer = async (
    amount: number,
    fromAccountId: number,
    toAccountId: number,
    date: string,
    description: string
) => {
    await initDatabase();
    const db = getDatabase();
    await db.withTransactionAsync(async () => {
        const fromAcc = await db.getFirstAsync<{balance: number}>('SELECT balance FROM accounts WHERE id = ?', [fromAccountId]);
        if (!fromAcc || fromAcc.balance < amount) {
            throw new Error('INSUFFICIENT_BALANCE');
        }
        
        await db.runAsync('UPDATE accounts SET balance = balance - ? WHERE id = ?', [amount, fromAccountId]);
        await db.runAsync('UPDATE accounts SET balance = balance + ? WHERE id = ?', [amount, toAccountId]);
        
        const timestamp = Date.now();
        await db.runAsync(
            'INSERT INTO transactions (amount, category, subcategory, account_id, date, description, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [amount, 'Transfer', 'Transfer Out', fromAccountId, date, description, timestamp]
        );
        await db.runAsync(
            'INSERT INTO transactions (amount, category, subcategory, account_id, date, description, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [amount, 'Transfer', 'Transfer In', toAccountId, date, description, timestamp]
        );

        // Check if toAccountId is linked to any savings goal
        const linkedGoals = await db.getAllAsync<{id: number, current_amount: number, target_amount: number}>(
            'SELECT id, current_amount, target_amount FROM savings_goals WHERE linked_account_id = ? AND is_completed = 0',
            [toAccountId]
        );
        for (const goal of linkedGoals) {
            await db.runAsync(
                'INSERT INTO savings_contributions (goal_id, amount, date, notes, auto_detected, created_at) VALUES (?, ?, ?, ?, 1, ?)',
                [goal.id, amount, date, 'Auto-detected from transfer', timestamp]
            );
            const newAmount = goal.current_amount + amount;
            const isComplete = newAmount >= goal.target_amount ? 1 : 0;
            await db.runAsync(
                'UPDATE savings_goals SET current_amount = ?, is_completed = ?, last_updated = ? WHERE id = ?',
                [newAmount, isComplete, timestamp, goal.id]
            );
        }
    });
};

export const deleteTransaction = async (id: number, accountId: number, amount: number, category: string) => {
  await initDatabase();
  const db = getDatabase();
  try {
    await db.withTransactionAsync(async () => {
      const originalTX = await db.getFirstAsync<Transaction>('SELECT * FROM transactions WHERE id = ?', [id]);
      await db.runAsync('DELETE FROM transactions WHERE id = ?', [id]);
      const balanceDelta = originalTX
        ? getAccountBalanceDelta(originalTX)
        : getAccountBalanceDelta({ amount, category, subcategory: '' });
      await db.runAsync('UPDATE accounts SET balance = balance - ? WHERE id = ?', [balanceDelta, accountId]);
    });
  } catch (e) { throw e; }
};

// ... Accounts (Unchanged) ...
export const getAccounts = async (): Promise<Account[]> => {
  await initDatabase();
  const db = getDatabase();
  return await db.getAllAsync<Account>('SELECT * FROM accounts WHERE type != ?', [CATEGORY_META_TYPE]);
};

export const addAccount = async (name: string, balance: number, type: string) => {
  await initDatabase();
  const db = getDatabase();
  await db.runAsync('INSERT INTO accounts (name, balance, type) VALUES (?, ?, ?)', [name, balance, type]);
};

export const updateAccount = async (id: number, name: string, balance: number, type: string) => {
  await initDatabase();
  const db = getDatabase();
  await db.runAsync('UPDATE accounts SET name = ?, balance = ?, type = ? WHERE id = ?', [name, balance, type, id]);
}

// ... Categories (Unchanged) ...
export const getCategories = async (): Promise<CategoryNode[]> => {
  await initDatabase();
  const db = getDatabase();
  const res = await db.getFirstAsync<{ name: string }>('SELECT name FROM accounts WHERE type = ?', [CATEGORY_META_TYPE]);
  if (res && res.name) {
    return JSON.parse(res.name);
  }
  return [];
};

export const saveCategories = async (categories: CategoryNode[]) => {
  await initDatabase();
  const db = getDatabase();
  await db.runAsync('UPDATE accounts SET name = ? WHERE type = ?', [JSON.stringify(categories), CATEGORY_META_TYPE]);
}

// ... Income Sources (Unchanged) ...
export const getIncomeSources = async (): Promise<IncomeSource[]> => {
  await initDatabase();
  const db = getDatabase();
  return await db.getAllAsync<IncomeSource>('SELECT * FROM income_sources ORDER BY name ASC');
};

export const addIncomeSource = async (name: string, icon: string) => {
  await initDatabase();
  const db = getDatabase();
  await db.runAsync('INSERT INTO income_sources (name, icon) VALUES (?, ?)', [name, icon]);
};

export const updateIncomeSource = async (id: number, name: string, icon: string) => {
  await initDatabase();
  const db = getDatabase();
  await db.runAsync('UPDATE income_sources SET name = ?, icon = ? WHERE id = ?', [name, icon, id]);
};

export const deleteIncomeSource = async (id: number) => {
  await initDatabase();
  const db = getDatabase();
  await db.runAsync('DELETE FROM income_sources WHERE id = ?', [id]);
};

// --- Debt & Receivables ---

export interface Debt {
  id: number;
  name: string;
  type: 'debt' | 'receivable';
  amount: number;
  notes: string;
  created_at: number;
  last_updated: number;
}

export interface DebtHistory {
  id: number;
  debt_id: number;
  change_amount: number;
  action: 'increase' | 'reduce';
  notes: string;
  date: number;
}

export const getDebts = async (type?: 'debt' | 'receivable'): Promise<Debt[]> => {
  await initDatabase();
  const db = getDatabase();
  if (type) {
    return await db.getAllAsync<Debt>('SELECT * FROM debts WHERE type = ? ORDER BY last_updated DESC', [type]);
  }
  return await db.getAllAsync<Debt>('SELECT * FROM debts ORDER BY last_updated DESC');
};

export const getDebtById = async (id: number): Promise<Debt | null> => {
  await initDatabase();
  const db = getDatabase();
  return await db.getFirstAsync<Debt>('SELECT * FROM debts WHERE id = ?', [id]);
}

export const addDebtPerson = async (name: string, type: 'debt' | 'receivable', notes: string, initialAmount: number = 0, accountId?: number) => {
  await initDatabase();
  const db = getDatabase();
  const timestamp = Date.now();

  await db.withTransactionAsync(async () => {
    const res = await db.runAsync(
      'INSERT INTO debts (name, type, amount, notes, created_at, last_updated) VALUES (?, ?, ?, ?, ?, ?)',
      [name, type, initialAmount, notes, timestamp, timestamp]
    );

    const debtId = res.lastInsertRowId;

    if (initialAmount > 0) {
      await db.runAsync(
        'INSERT INTO debt_history (debt_id, change_amount, action, notes, date) VALUES (?, ?, ?, ?, ?)',
        [debtId, initialAmount, 'increase', 'Initial entry', timestamp]
      );

      // If account is selected, update balance and log transaction
      if (accountId) {
        const isDebt = type === 'debt';
        
        // Balance Logic (Initial entry is always an increase in the record)
        // - I Borrow (Debt): + Account Balance
        // - I Lend (Receivable): - Account Balance
        if (isDebt) {
          await db.runAsync('UPDATE accounts SET balance = balance + ? WHERE id = ?', [initialAmount, accountId]);
        } else {
          await db.runAsync('UPDATE accounts SET balance = balance - ? WHERE id = ?', [initialAmount, accountId]);
        }

        // Log as Transaction
        const txCategory = 'Debt/Credit';
        const txSubcategory = isDebt ? 'Borrowed' : 'Lent';
        const txDescription = isDebt ? `Initial Borrowed from ${name}` : `Initial Lent to ${name}`;

        await db.runAsync(
          `INSERT INTO transactions (amount, category, subcategory, account_id, date, description, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [initialAmount, txCategory, txSubcategory, accountId, new Date().toISOString(), txDescription, timestamp]
        );
      }
    }
  });
};

export const updateDebtAmount = async (
  id: number,
  changeAmount: number,
  action: 'increase' | 'reduce',
  notes: string,
  accountId: number | null
) => {
  await initDatabase();
  const db = getDatabase();
  const timestamp = Date.now();

  // Safeguard: Prevent adding more than one transaction within 5 seconds
  if (timestamp - lastTransactionTime < 5000) {
    throw new Error("Please wait a moment before adding another transaction (1 transaction per 5 seconds).");
  }
  lastTransactionTime = timestamp;

  try {
    await db.withTransactionAsync(async () => {
      // 1. Get Debt Details first to know type
      const debt = await db.getFirstAsync<Debt>('SELECT * FROM debts WHERE id = ?', [id]);
      if (!debt) throw new Error("Debt not found");

      const isDebt = debt.type === 'debt'; // True = I Owe, False = They Owe

      // 2. Update Debt Amount
      if (action === 'increase') {
        await db.runAsync('UPDATE debts SET amount = amount + ?, last_updated = ? WHERE id = ?', [changeAmount, timestamp, id]);
        // Balance Logic:
        // - I Borrow (Increase Debt): + Account Balance
        // - I Lend (Increase Receivable): - Account Balance
        if (accountId !== null) {
          if (isDebt) {
            await db.runAsync('UPDATE accounts SET balance = balance + ? WHERE id = ?', [changeAmount, accountId]);
          } else {
            await db.runAsync('UPDATE accounts SET balance = balance - ? WHERE id = ?', [changeAmount, accountId]);
          }
        }
      } else {
        // Reduce
        await db.runAsync('UPDATE debts SET amount = CASE WHEN amount - ? < 0 THEN 0 ELSE amount - ? END, last_updated = ? WHERE id = ?', [changeAmount, changeAmount, timestamp, id]);
        // Balance Logic:
        // - I Repay (Reduce Debt): - Account Balance
        // - I Receive Back (Reduce Receivable): + Account Balance
        if (accountId !== null) {
          if (isDebt) {
            await db.runAsync('UPDATE accounts SET balance = balance - ? WHERE id = ?', [changeAmount, accountId]);
          } else {
            await db.runAsync('UPDATE accounts SET balance = balance + ? WHERE id = ?', [changeAmount, accountId]);
          }
        }
      }

      // 3. Update History (Existing)
      await db.runAsync(
        'INSERT INTO debt_history (debt_id, change_amount, action, notes, date) VALUES (?, ?, ?, ?, ?)',
        [id, changeAmount, action, notes, timestamp]
      );

      // 4. Log as Transaction (New)
      // Determine description and category based on logic
      let txDescription = '';
      let txCategory = 'Debt/Credit'; // Special category to filter out of normal expense analytics if needed
      let txSubcategory = '';

      if (action === 'increase') {
        if (isDebt) {
          txDescription = `Borrowed from ${debt.name}`;
          txSubcategory = 'Borrowed';
        } else {
          txDescription = `Lent to ${debt.name}`;
          txSubcategory = 'Lent';
        }
      } else {
        if (isDebt) {
          txDescription = `Repaid to ${debt.name}`;
          txSubcategory = 'Repayment';
        } else {
          txDescription = `Received from ${debt.name}`;
          txSubcategory = 'Received Back';
        }
      }

      if (accountId !== null) {
        await db.runAsync(
          `INSERT INTO transactions (amount, category, subcategory, account_id, date, description, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [changeAmount, txCategory, txSubcategory, accountId, new Date().toISOString(), txDescription, timestamp]
        );
      }
    });
  } catch (e) {
    console.error("Failed to update debt with account linkage", e);
    throw e;
  }
};

export const deleteDebtPerson = async (id: number) => {
  await initDatabase();
  const db = getDatabase();
  // Cascade delete handles history, but we do explicitly if needed. Foreign Key is ON DELETE CASCADE.
  await db.runAsync('DELETE FROM debts WHERE id = ?', [id]);
}

export const getDebtHistory = async (debtId: number): Promise<DebtHistory[]> => {
  await initDatabase();
  const db = getDatabase();
  return await db.getAllAsync<DebtHistory>('SELECT * FROM debt_history WHERE debt_id = ? ORDER BY date DESC', [debtId]);
}

// --- Recharge Tracking Helpers ---

export interface RechargeMeta {
  id: number;
  expense_id: number;
  validity_days: number;
  expiry_date: string;
  reminder_date: string;
  notification_id: string;
  // Join data
  amount?: number;
  description?: string;
  subcategory?: string;
}

// --- Savings Goals ---
export interface SavingsGoal {
  id: number;
  name: string;
  target_amount: number;
  current_amount: number;
  deadline: string;
  linked_account_id: number | null;
  icon: string;
  color: string;
  created_at: number;
  last_updated: number;
  is_completed: number;
}

export interface SavingsContribution {
  id: number;
  goal_id: number;
  amount: number;
  date: string;
  notes: string;
  auto_detected: number;
  created_at: number;
}

// --- Subscriptions ---
export interface Subscription {
  id: number;
  name: string;
  amount: number;
  billing_cycle: 'monthly' | 'quarterly' | 'yearly' | 'custom';
  next_renewal_date: string;
  category: string;
  account_id: number | null;
  icon: string;
  color: string;
  is_active: number;
  reminder_notification_id: string;
  notes: string;
  created_at: number;
  last_updated: number;
  // Feature 4B/4C/4E
  custom_interval_value?: number;
  custom_interval_unit?: 'days' | 'weeks' | 'months';
  website?: string;
  auto_renew?: number;
  payment_method?: string;
  sub_category?: string;
  reminder_days_before?: number;
  status?: 'active' | 'paused' | 'cancelled';
}

export const addRechargeMeta = async (meta: Omit<RechargeMeta, 'id'>) => {
  await initDatabase();
  const db = getDatabase();
  await db.runAsync(
    'INSERT INTO recharge_meta (expense_id, validity_days, expiry_date, reminder_date, notification_id) VALUES (?, ?, ?, ?, ?)',
    [meta.expense_id, meta.validity_days, meta.expiry_date, meta.reminder_date, meta.notification_id]
  );
};

export const getUpcomingExpenses = async (): Promise<RechargeMeta[]> => {
  await initDatabase();
  const db = getDatabase();
  const now = new Date().toISOString();

  // Join with transactions to get current name and amount
  return await db.getAllAsync<RechargeMeta>(`
    SELECT r.*, t.amount, t.description, t.subcategory 
    FROM recharge_meta r
    JOIN transactions t ON r.expense_id = t.id
    WHERE r.expiry_date >= ?
    ORDER BY r.expiry_date ASC
  `, [now]);
};

export const deleteRechargeByExpenseId = async (expenseId: number) => {
  await initDatabase();
  const db = getDatabase();
  // We need to return notification_id before deleting so it can be canceled
  const meta = await db.getFirstAsync<{ notification_id: string }>('SELECT notification_id FROM recharge_meta WHERE expense_id = ?', [expenseId]);
  await db.runAsync('DELETE FROM recharge_meta WHERE expense_id = ?', [expenseId]);
  return meta?.notification_id;
};

export const deleteRechargeMeta = async (id: number) => {
  await initDatabase();
  const db = getDatabase();
  const meta = await db.getFirstAsync<{ notification_id: string }>('SELECT notification_id FROM recharge_meta WHERE id = ?', [id]);
  await db.runAsync('DELETE FROM recharge_meta WHERE id = ?', [id]);
  return meta?.notification_id;
};

export const updateRechargeMeta = async (id: number, updates: Partial<RechargeMeta>) => {
  await initDatabase();
  const db = getDatabase();
  const fields = [];
  const values = [];
  if (updates.validity_days !== undefined) { fields.push('validity_days = ?'); values.push(updates.validity_days); }
  if (updates.expiry_date !== undefined) { fields.push('expiry_date = ?'); values.push(updates.expiry_date); }
  if (updates.reminder_date !== undefined) { fields.push('reminder_date = ?'); values.push(updates.reminder_date); }
  if (updates.notification_id !== undefined) { fields.push('notification_id = ?'); values.push(updates.notification_id); }
  
  if (fields.length === 0) return;
  values.push(id);
  
  await db.runAsync(`UPDATE recharge_meta SET ${fields.join(', ')} WHERE id = ?`, values);
};

export const updateBillTransaction = async (expenseId: number, updates: {amount: number, description: string}) => {
  await initDatabase();
  const db = getDatabase();
  await db.runAsync('UPDATE transactions SET amount = ?, description = ? WHERE id = ?', [updates.amount, updates.description, expenseId]);
};

export const updateCategories = async (categories: CategoryNode[]) => {
  await initDatabase();
  const db = getDatabase();
  await db.runAsync('UPDATE accounts SET name = ? WHERE type = ?', [JSON.stringify(categories), CATEGORY_META_TYPE]);
};
