
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

    // Seed Initial Categories
    const metaCheck = await db.getAllAsync<{ id: number }>('SELECT id FROM accounts WHERE type = ?', [CATEGORY_META_TYPE]);
    if (metaCheck.length === 0) {
      const defaultCategories: CategoryNode[] = [
        { id: '1', name: 'Food', subcategories: ['Groceries', 'Dining Out', 'Snacks'] },
        { id: '2', name: 'Transport', subcategories: ['Fuel', 'Public Transport', 'Maintenance'] },
        { id: '3', name: 'Housing', subcategories: ['Rent', 'Utilities', 'Repairs'] },
        { id: '4', name: 'Entertainment', subcategories: ['Movies', 'Games', 'Subscriptions'] },
        { id: '5', name: 'Income', subcategories: ['Salary', 'Freelance', 'Investment'] },
      ];
      await db.runAsync('INSERT INTO accounts (name, balance, type) VALUES (?, ?, ?)', [JSON.stringify(defaultCategories), 0, CATEGORY_META_TYPE]);
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

      // Update Account Balance
      // Handle Income vs Expense based on category parent
      const isIncome = tx.category === 'Income';
      if (isIncome) {
        await db.runAsync(`UPDATE accounts SET balance = balance + ? WHERE id = ?`, [tx.amount, tx.account_id]);
      } else {
        await db.runAsync(`UPDATE accounts SET balance = balance - ? WHERE id = ?`, [tx.amount, tx.account_id]);
      }
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
  return await db.getAllAsync<Transaction>('SELECT * FROM transactions ORDER BY date DESC');
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

      // 2. Reverse original balance adjustment
      const originalIsIncome = originalTX.category === 'Income';
      if (originalIsIncome) {
        await db.runAsync(`UPDATE accounts SET balance = balance - ? WHERE id = ?`, [originalTX.amount, originalTX.account_id]);
      } else {
        await db.runAsync(`UPDATE accounts SET balance = balance + ? WHERE id = ?`, [originalTX.amount, originalTX.account_id]);
      }

      // 3. Update transaction record
      await db.runAsync(
        `UPDATE transactions SET amount = ?, category = ?, subcategory = ?, account_id = ?, date = ?, description = ? WHERE id = ?`,
        [updated.amount, updated.category, updated.subcategory, updated.account_id, updated.date, updated.description, id]
      );

      // 4. Apply new balance adjustment
      const newIsIncome = updated.category === 'Income';
      if (newIsIncome) {
        await db.runAsync(`UPDATE accounts SET balance = balance + ? WHERE id = ?`, [updated.amount, updated.account_id]);
      } else {
        await db.runAsync(`UPDATE accounts SET balance = balance - ? WHERE id = ?`, [updated.amount, updated.account_id]);
      }
    });
  } catch (e) {
    console.error("Update Transaction Error", e);
    throw e;
  }
};

export const deleteTransaction = async (id: number, accountId: number, amount: number, category: string) => {
  await initDatabase();
  const db = getDatabase();
  try {
    await db.withTransactionAsync(async () => {
      await db.runAsync('DELETE FROM transactions WHERE id = ?', [id]);
      const isIncome = category === 'Income';
      if (isIncome) {
        await db.runAsync('UPDATE accounts SET balance = balance - ? WHERE id = ?', [amount, accountId]);
      } else {
        await db.runAsync('UPDATE accounts SET balance = balance + ? WHERE id = ?', [amount, accountId]);
      }
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

export const addDebtPerson = async (name: string, type: 'debt' | 'receivable', notes: string, initialAmount: number = 0) => {
  await initDatabase();
  const db = getDatabase();
  const timestamp = Date.now();

  await db.withTransactionAsync(async () => {
    const res = await db.runAsync(
      'INSERT INTO debts (name, type, amount, notes, created_at, last_updated) VALUES (?, ?, ?, ?, ?, ?)',
      [name, type, initialAmount, notes, timestamp, timestamp]
    );

    if (initialAmount > 0) {
      await db.runAsync(
        'INSERT INTO debt_history (debt_id, change_amount, action, notes, date) VALUES (?, ?, ?, ?, ?)',
        [res.lastInsertRowId, initialAmount, 'increase', 'Initial entry', timestamp]
      );
    }
  });
};

export const updateDebtAmount = async (
  id: number,
  changeAmount: number,
  action: 'increase' | 'reduce',
  notes: string,
  accountId: number // [NEW] Link to account
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
        if (isDebt) {
          await db.runAsync('UPDATE accounts SET balance = balance + ? WHERE id = ?', [changeAmount, accountId]);
        } else {
          await db.runAsync('UPDATE accounts SET balance = balance - ? WHERE id = ?', [changeAmount, accountId]);
        }
      } else {
        // Reduce
        await db.runAsync('UPDATE debts SET amount = CASE WHEN amount - ? < 0 THEN 0 ELSE amount - ? END, last_updated = ? WHERE id = ?', [changeAmount, changeAmount, timestamp, id]);
        // Balance Logic:
        // - I Repay (Reduce Debt): - Account Balance
        // - I Receive Back (Reduce Receivable): + Account Balance
        if (isDebt) {
          await db.runAsync('UPDATE accounts SET balance = balance - ? WHERE id = ?', [changeAmount, accountId]);
        } else {
          await db.runAsync('UPDATE accounts SET balance = balance + ? WHERE id = ?', [changeAmount, accountId]);
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

      await db.runAsync(
        `INSERT INTO transactions (amount, category, subcategory, account_id, date, description, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [changeAmount, txCategory, txSubcategory, accountId, new Date().toISOString(), txDescription, timestamp]
      );
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

export const updateCategories = async (categories: CategoryNode[]) => {
  await initDatabase();
  const db = getDatabase();
  await db.runAsync('UPDATE accounts SET name = ? WHERE type = ?', [JSON.stringify(categories), CATEGORY_META_TYPE]);
};
