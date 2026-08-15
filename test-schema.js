const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database(':memory:');

db.serialize(() => {
  db.run(`
      CREATE TABLE IF NOT EXISTS transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        amount REAL NOT NULL,
        category TEXT NOT NULL,
        subcategory TEXT NOT NULL,
        account_id INTEGER NOT NULL,
        date TEXT NOT NULL,
        description TEXT,
        created_at INTEGER NOT NULL,
        source TEXT DEFAULT 'manual'
      );

      CREATE TABLE IF NOT EXISTS accounts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        balance REAL NOT NULL,
        type TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS category_budgets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        category TEXT NOT NULL,
        amount REAL NOT NULL,
        month TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        UNIQUE(category, month)
      );

      CREATE TABLE IF NOT EXISTS income_sources (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        icon TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS debts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        amount REAL DEFAULT 0,
        notes TEXT,
        created_at INTEGER,
        last_updated INTEGER
      );

      CREATE TABLE IF NOT EXISTS debt_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        debt_id INTEGER NOT NULL,
        change_amount REAL NOT NULL,
        action TEXT NOT NULL,
        notes TEXT,
        date INTEGER,
        FOREIGN KEY (debt_id) REFERENCES debts (id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS expense_books (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT,
        budget REAL DEFAULT 0,
        created_at INTEGER NOT NULL,
        last_updated INTEGER NOT NULL
      );

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

      CREATE TABLE IF NOT EXISTS bill_groups (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT,
        created_at INTEGER NOT NULL,
        last_updated INTEGER NOT NULL,
        is_archived INTEGER DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS bill_group_members (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        group_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        FOREIGN KEY (group_id) REFERENCES bill_groups(id) ON DELETE CASCADE
      );

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

      CREATE TABLE IF NOT EXISTS bill_expense_splits (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        expense_id INTEGER NOT NULL,
        member_id INTEGER NOT NULL,
        amount REAL NOT NULL,
        created_at INTEGER NOT NULL,
        FOREIGN KEY (expense_id) REFERENCES bill_expenses(id) ON DELETE CASCADE,
        FOREIGN KEY (member_id) REFERENCES bill_group_members(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS recharge_meta (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        expense_id INTEGER NOT NULL,
        validity_days INTEGER NOT NULL,
        expiry_date TEXT NOT NULL,
        reminder_date TEXT NOT NULL,
        notification_id TEXT,
        FOREIGN KEY (expense_id) REFERENCES transactions(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS savings_goals (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        target_amount REAL NOT NULL,
        current_amount REAL DEFAULT 0,
        deadline TEXT,
        icon TEXT DEFAULT 'bullseye',
        color TEXT DEFAULT '#3B82F6',
        created_at INTEGER NOT NULL,
        last_updated INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS savings_contributions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        goal_id INTEGER NOT NULL,
        amount REAL NOT NULL,
        date TEXT NOT NULL,
        notes TEXT,
        created_at INTEGER NOT NULL,
        FOREIGN KEY (goal_id) REFERENCES savings_goals(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS subscriptions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        amount REAL NOT NULL,
        billing_cycle TEXT NOT NULL DEFAULT 'monthly',
        next_renewal_date TEXT NOT NULL,
        category TEXT DEFAULT 'Subscriptions',
        account_id INTEGER,
        icon TEXT DEFAULT 'dY"',
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

      CREATE TABLE IF NOT EXISTS notification_schedules (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        item_type TEXT NOT NULL,
        item_id INTEGER NOT NULL,
        notification_id TEXT NOT NULL,
        trigger_type TEXT NOT NULL,
        scheduled_for TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );

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

      CREATE TABLE IF NOT EXISTS debt_repayments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        debt_id INTEGER NOT NULL,
        amount REAL NOT NULL,
        payment_date TEXT NOT NULL,
        payment_type TEXT DEFAULT 'principal',
        note TEXT DEFAULT NULL,
        account_id INTEGER DEFAULT NULL,
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (debt_id) REFERENCES debt_records(id) ON DELETE CASCADE
      );

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
        account_id INTEGER DEFAULT NULL,
        notes TEXT DEFAULT NULL,
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (chit_id) REFERENCES chit_funds(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS chit_members (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        chit_id INTEGER NOT NULL,
        member_name TEXT NOT NULL,
        member_turn_month INTEGER DEFAULT NULL,
        notes TEXT DEFAULT NULL,
        FOREIGN KEY (chit_id) REFERENCES chit_funds(id) ON DELETE CASCADE
      );

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
  `, (err) => {
    if (err) console.error("Error on v1:", err);
    else console.log("v1 passed");
  });

  db.run(`
      CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        is_recurring INTEGER DEFAULT 0,
        default_validity INTEGER DEFAULT NULL
      );
      CREATE TABLE IF NOT EXISTS category_subcategories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        category_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        is_recurring INTEGER DEFAULT 0,
        default_validity INTEGER DEFAULT NULL,
        FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE,
        UNIQUE(category_id, name)
      );
  `, (err) => {
    if (err) console.error("Error on v2:", err);
    else console.log("v2 passed");
  });

  db.run(`
      CREATE TABLE IF NOT EXISTS onboarding_state (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_name TEXT DEFAULT NULL,
        certificate_generated INTEGER DEFAULT 0,
        certificate_number TEXT DEFAULT NULL,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );
  `, (err) => {
    if (err) console.error("Error on v8:", err);
    else console.log("v8 passed");
  });

  db.run(`
      CREATE TABLE IF NOT EXISTS expense_book_sections (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        book_id     INTEGER NOT NULL,
        name        TEXT NOT NULL,
        color       TEXT DEFAULT NULL,
        icon        TEXT DEFAULT NULL,
        order_index INTEGER DEFAULT 0,
        created_at  TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (book_id) REFERENCES expense_books(id) ON DELETE CASCADE
      );
  `, (err) => {
    if (err) console.error("Error on v10:", err);
    else console.log("v10 passed");
  });
});
