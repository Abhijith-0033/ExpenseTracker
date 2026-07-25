import { initDatabase, getDatabase } from './database';

// ── Types ─────────────────────────────────────────────────────────────
export interface ExpenseBook {
  id: number;
  name: string;
  description?: string;
  budget: number;
  created_at: number;
  last_updated: number;
  // v3.7.0 new fields
  status?: 'draft' | 'published' | 'archived';
  published_at?: string | null;
  total_amount?: number;
  currency?: string;
  cover_emoji?: string;
  color?: string;
  is_collaborative?: number;
  members?: string | null; // JSON array of names
}

export interface BookSection {
  id: number;
  book_id: number;
  name: string;
  color?: string | null;
  icon?: string | null;
  order_index: number;
  created_at: string;
}

export interface BookItem {
  id: number;
  book_id: number;
  name: string;
  amount: number;
  notes?: string;
  date: number;
  type: 'expense' | 'income';
  income_source_id?: number | null;
  // v3.7.0 new fields
  section_name?: string | null;
  paid_by?: string | null;
  split_among?: string | null;
  transaction_id?: number | null;
  account_id?: number | null;
  is_published?: number;
  photo_uri?: string | null;
}

// ── Book CRUD ─────────────────────────────────────────────────────────

export const getBooks = async (statusFilter?: 'draft' | 'published' | 'archived' | 'all'): Promise<(ExpenseBook & { total_spent: number; total_income: number; item_count: number })[]> => {
  await initDatabase();
  const db = getDatabase();
  
  let whereClause = '';
  const params: any[] = [];
  if (statusFilter && statusFilter !== 'all') {
    whereClause = 'WHERE status = ?';
    params.push(statusFilter);
  }
  
  const books = await db.getAllAsync<ExpenseBook>(
    `SELECT * FROM expense_books ${whereClause} ORDER BY last_updated DESC`,
    params
  );

  const enriched = await Promise.all(books.map(async (book) => {
    const res = await db.getFirstAsync<{ total_spent: number; total_income: number; count: number }>(
      `SELECT
        SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as total_spent,
        SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) as total_income,
        COUNT(*) as count
       FROM expense_book_items WHERE book_id = ?`,
      [book.id]
    );
    return {
      ...book,
      status: book.status || 'published',
      cover_emoji: book.cover_emoji || '📒',
      color: book.color || '#D66A4E',
      currency: book.currency || 'INR',
      total_spent: res?.total_spent || 0,
      total_income: res?.total_income || 0,
      item_count: res?.count || 0,
    };
  }));

  return enriched;
};

export const getBookById = async (id: number): Promise<ExpenseBook | null> => {
  await initDatabase();
  const db = getDatabase();
  const book = await db.getFirstAsync<ExpenseBook>('SELECT * FROM expense_books WHERE id = ?', [id]);
  if (!book) return null;
  return {
    ...book,
    status: book.status || 'published',
    cover_emoji: book.cover_emoji || '📒',
    color: book.color || '#D66A4E',
    currency: book.currency || 'INR',
  };
};

export const addBook = async (
  name: string,
  description: string = '',
  budget: number = 0,
  options?: {
    cover_emoji?: string;
    color?: string;
    currency?: string;
    is_collaborative?: boolean;
    members?: string[];
  }
) => {
  await initDatabase();
  const db = getDatabase();
  const timestamp = Date.now();
  const result = await db.runAsync(
    `INSERT INTO expense_books
       (name, description, budget, created_at, last_updated, status,
        cover_emoji, color, currency, is_collaborative, members, total_amount)
     VALUES (?, ?, ?, ?, ?, 'draft', ?, ?, ?, ?, ?, 0)`,
    [
      name, description, budget, timestamp, timestamp,
      options?.cover_emoji ?? '📒',
      options?.color ?? '#D66A4E',
      options?.currency ?? 'INR',
      options?.is_collaborative ? 1 : 0,
      options?.members ? JSON.stringify(options.members) : null,
    ]
  );
  return result.lastInsertRowId;
};

export const updateBook = async (
  id: number,
  name: string,
  description: string,
  budget: number,
  options?: {
    cover_emoji?: string;
    color?: string;
    currency?: string;
    is_collaborative?: boolean;
    members?: string[];
  }
) => {
  await initDatabase();
  const db = getDatabase();
  await db.runAsync(
    `UPDATE expense_books
     SET name = ?, description = ?, budget = ?, last_updated = ?,
         cover_emoji = COALESCE(?, cover_emoji),
         color = COALESCE(?, color),
         currency = COALESCE(?, currency),
         is_collaborative = COALESCE(?, is_collaborative),
         members = COALESCE(?, members)
     WHERE id = ?`,
    [
      name, description, budget, Date.now(),
      options?.cover_emoji ?? null,
      options?.color ?? null,
      options?.currency ?? null,
      options?.is_collaborative !== undefined ? (options.is_collaborative ? 1 : 0) : null,
      options?.members ? JSON.stringify(options.members) : null,
      id,
    ]
  );
};

export const deleteBook = async (id: number) => {
  await initDatabase();
  const db = getDatabase();
  await db.runAsync('DELETE FROM expense_books WHERE id = ?', [id]);
};

export const archiveBook = async (id: number) => {
  await initDatabase();
  const db = getDatabase();
  await db.runAsync(
    `UPDATE expense_books SET status = 'archived', last_updated = ? WHERE id = ?`,
    [Date.now(), id]
  );
};

// ── Sections ──────────────────────────────────────────────────────────

export const getBookSections = async (bookId: number): Promise<BookSection[]> => {
  await initDatabase();
  const db = getDatabase();
  return await db.getAllAsync<BookSection>(
    'SELECT * FROM expense_book_sections WHERE book_id = ? ORDER BY order_index ASC, created_at ASC',
    [bookId]
  );
};

export const upsertSection = async (bookId: number, name: string, color?: string): Promise<number> => {
  await initDatabase();
  const db = getDatabase();
  const existing = await db.getFirstAsync<{ id: number }>(
    'SELECT id FROM expense_book_sections WHERE book_id = ? AND name = ? COLLATE NOCASE',
    [bookId, name]
  );
  if (existing) return existing.id;
  const result = await db.runAsync(
    'INSERT INTO expense_book_sections (book_id, name, color) VALUES (?, ?, ?)',
    [bookId, name, color ?? null]
  );
  return result.lastInsertRowId;
};

// ── Items (entries) ───────────────────────────────────────────────────

export const getBookItems = async (bookId: number, sectionFilter?: string): Promise<BookItem[]> => {
  await initDatabase();
  const db = getDatabase();
  if (sectionFilter && sectionFilter !== 'All') {
    return await db.getAllAsync<BookItem>(
      'SELECT * FROM expense_book_items WHERE book_id = ? AND section_name = ? ORDER BY date DESC',
      [bookId, sectionFilter]
    );
  }
  return await db.getAllAsync<BookItem>(
    'SELECT * FROM expense_book_items WHERE book_id = ? ORDER BY section_name ASC, date DESC',
    [bookId]
  );
};

export const addBookItem = async (
  bookId: number,
  name: string,
  amount: number,
  notes: string = '',
  date: number = Date.now(),
  type: 'expense' | 'income' = 'expense',
  income_source_id: number | null = null,
  options?: {
    section_name?: string;
    paid_by?: string;
    split_among?: string[];
    account_id?: number;
  }
) => {
  await initDatabase();
  const db = getDatabase();
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT INTO expense_book_items
         (book_id, name, amount, notes, date, type, income_source_id,
          section_name, paid_by, split_among, account_id, is_published)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
      [
        bookId, name, amount, notes, date, type, income_source_id,
        options?.section_name ?? null,
        options?.paid_by ?? null,
        options?.split_among ? JSON.stringify(options.split_among) : null,
        options?.account_id ?? null,
      ]
    );
    // Create section if it doesn't exist
    if (options?.section_name) {
      const existing = await db.getFirstAsync<{ id: number }>(
        'SELECT id FROM expense_book_sections WHERE book_id = ? AND name = ? COLLATE NOCASE',
        [bookId, options.section_name]
      );
      if (!existing) {
        await db.runAsync(
          `INSERT INTO expense_book_sections (book_id, name) VALUES (?, ?)`,
          [bookId, options.section_name]
        );
      }
    }
    // Update book total and timestamp
    await db.runAsync(
      `UPDATE expense_books SET last_updated = ?,
         total_amount = (SELECT COALESCE(SUM(amount),0) FROM expense_book_items WHERE book_id = ? AND type = 'expense')
       WHERE id = ?`,
      [Date.now(), bookId, bookId]
    );
  });
};

export const updateBookItem = async (
  id: number,
  name: string,
  amount: number,
  notes: string,
  date: number,
  type: 'expense' | 'income' = 'expense',
  income_source_id: number | null = null,
  options?: {
    section_name?: string;
    paid_by?: string;
    account_id?: number;
  }
) => {
  await initDatabase();
  const db = getDatabase();
  await db.withTransactionAsync(async () => {
    const item = await db.getFirstAsync<{ book_id: number }>(
      'SELECT book_id FROM expense_book_items WHERE id = ?', [id]
    );
    await db.runAsync(
      `UPDATE expense_book_items
       SET name = ?, amount = ?, notes = ?, date = ?, type = ?, income_source_id = ?,
           section_name = ?, paid_by = ?, account_id = ?
       WHERE id = ?`,
      [
        name, amount, notes, date, type, income_source_id,
        options?.section_name ?? null,
        options?.paid_by ?? null,
        options?.account_id ?? null,
        id,
      ]
    );
    if (item) {
      if (options?.section_name) {
        const existing = await db.getFirstAsync<{ id: number }>(
          'SELECT id FROM expense_book_sections WHERE book_id = ? AND name = ? COLLATE NOCASE',
          [item.book_id, options.section_name]
        );
        if (!existing) {
          await db.runAsync(
            `INSERT INTO expense_book_sections (book_id, name) VALUES (?, ?)`,
            [item.book_id, options.section_name]
          );
        }
      }
      await db.runAsync(
        `UPDATE expense_books SET last_updated = ?,
           total_amount = (SELECT COALESCE(SUM(amount),0) FROM expense_book_items WHERE book_id = ? AND type = 'expense')
         WHERE id = ?`,
        [Date.now(), item.book_id, item.book_id]
      );
    }
  });
};

export const deleteBookItem = async (id: number) => {
  await initDatabase();
  const db = getDatabase();
  await db.withTransactionAsync(async () => {
    const item = await db.getFirstAsync<{ book_id: number }>(
      'SELECT book_id FROM expense_book_items WHERE id = ?', [id]
    );
    await db.runAsync('DELETE FROM expense_book_items WHERE id = ?', [id]);
    if (item) {
      await db.runAsync(
        `UPDATE expense_books SET last_updated = ?,
           total_amount = (SELECT COALESCE(SUM(amount),0) FROM expense_book_items WHERE book_id = ? AND type = 'expense')
         WHERE id = ?`,
        [Date.now(), item.book_id, item.book_id]
      );
    }
  });
};

// ── Summary ───────────────────────────────────────────────────────────

export const getBookSummary = async (bookId: number) => {
  await initDatabase();
  const db = getDatabase();
  const res = await db.getFirstAsync<{ total: number; total_income: number; count: number }>(
    `SELECT
      SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as total,
      SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) as total_income,
      COUNT(*) as count
     FROM expense_book_items WHERE book_id = ?`,
    [bookId]
  );
  const book = await getBookById(bookId);
  return {
    totalSpent: res?.total || 0,
    totalIncome: res?.total_income || 0,
    itemCount: res?.count || 0,
    budget: book?.budget || 0,
    progress: (book?.budget && book.budget > 0) ? ((res?.total || 0) / book.budget) : 0,
  };
};

export const getBookSectionTotals = async (bookId: number): Promise<{ section_name: string; total: number }[]> => {
  await initDatabase();
  const db = getDatabase();
  return await db.getAllAsync<{ section_name: string; total: number }>(
    `SELECT COALESCE(section_name, 'General') as section_name, SUM(amount) as total
     FROM expense_book_items
     WHERE book_id = ? AND type = 'expense'
     GROUP BY section_name
     ORDER BY total DESC`,
    [bookId]
  );
};

export const getBookItemDistribution = async (bookId: number) => {
  const items = await getBookItems(bookId);
  return items.map(item => ({ name: item.name, value: item.amount, color: '#3b82f6' }));
};

// ── Publish / Unpublish ───────────────────────────────────────────────

/**
 * Publishes a draft expense book.
 * - Creates an "Expense Books" category if it doesn't exist.
 * - For each unpublished item: inserts a transaction, deducts account balance.
 * - Updates book status to 'published'.
 * All done atomically.
 */
export const publishBook = async (bookId: number, defaultCategoryId?: number): Promise<void> => {
  await initDatabase();
  const db = getDatabase();

  // 1. Get or create "Expense Books" category
  let expenseBooksCatId = defaultCategoryId;
  if (!expenseBooksCatId) {
    const cat = await db.getFirstAsync<{ id: number }>(
      `SELECT id FROM categories WHERE name = 'Expense Books' LIMIT 1`
    );
    if (cat) {
      expenseBooksCatId = cat.id;
    } else {
      const catResult = await db.runAsync(
        `INSERT INTO categories (name, sort_order) VALUES ('Expense Books', 999)`
      );
      expenseBooksCatId = catResult.lastInsertRowId;
    }
  }

  // 2. Get book info
  const book = await getBookById(bookId);
  if (!book) throw new Error('Book not found');

  // 3. Get all unpublished expense items
  const items = await db.getAllAsync<BookItem>(
    `SELECT * FROM expense_book_items WHERE book_id = ? AND type = 'expense' AND is_published = 0`,
    [bookId]
  );

  if (items.length === 0) throw new Error('No unpublished expense items to publish');

  // 4. Validate all items have account_id
  const missingAccount = items.filter(i => !i.account_id);
  if (missingAccount.length > 0) {
    throw new Error(`${missingAccount.length} items have no account selected. Please assign accounts first.`);
  }

  // 5. Atomic: insert transactions + update balances
  await db.withTransactionAsync(async () => {
    for (const item of items) {
      const categoryName = item.section_name || 'General';
      const description = `${book.name}: ${item.name}`;
      const dateISO = new Date(item.date).toISOString().split('T')[0];

      // Insert transaction
      const txResult = await db.runAsync(
        `INSERT INTO transactions
           (amount, category, subcategory, account_id, date, description, created_at, source, expense_book_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'expense_book', ?)`,
        [
          item.amount,
          categoryName,
          item.name,
          item.account_id!,
          dateISO,
          description,
          Date.now(),
          bookId,
        ]
      );
      const txId = txResult.lastInsertRowId;

      // Deduct from account balance
      await db.runAsync(
        `UPDATE accounts SET balance = balance - ? WHERE id = ?`,
        [item.amount, item.account_id!]
      );

      // Mark item as published
      await db.runAsync(
        `UPDATE expense_book_items SET is_published = 1, transaction_id = ? WHERE id = ?`,
        [txId, item.id]
      );
    }

    // Update book status
    await db.runAsync(
      `UPDATE expense_books SET status = 'published', published_at = datetime('now'), last_updated = ? WHERE id = ?`,
      [Date.now(), bookId]
    );
  });
};

/**
 * Unpublishes (reverses) a published expense book.
 * - Deletes all linked transactions.
 * - Restores account balances.
 * - Resets book status to 'draft'.
 */
export const unpublishBook = async (bookId: number): Promise<void> => {
  await initDatabase();
  const db = getDatabase();

  const publishedItems = await db.getAllAsync<BookItem>(
    `SELECT * FROM expense_book_items WHERE book_id = ? AND is_published = 1 AND transaction_id IS NOT NULL`,
    [bookId]
  );

  await db.withTransactionAsync(async () => {
    for (const item of publishedItems) {
      if (item.transaction_id && item.account_id) {
        // Restore balance
        await db.runAsync(
          `UPDATE accounts SET balance = balance + ? WHERE id = ?`,
          [item.amount, item.account_id]
        );
        // Delete transaction
        await db.runAsync(
          `DELETE FROM transactions WHERE id = ?`,
          [item.transaction_id]
        );
      }
      // Reset item
      await db.runAsync(
        `UPDATE expense_book_items SET is_published = 0, transaction_id = NULL WHERE id = ?`,
        [item.id]
      );
    }
    // Revert book status
    await db.runAsync(
      `UPDATE expense_books SET status = 'draft', published_at = NULL, last_updated = ? WHERE id = ?`,
      [Date.now(), bookId]
    );
  });
};

// ── Pre-publish Review Helpers ────────────────────────────────────────

export interface PublishPreview {
  items: BookItem[];
  itemsMissingAccount: BookItem[];
  accountImpact: { account_id: number; account_name: string; deduction: number; current_balance: number; will_go_negative: boolean }[];
  totalAmount: number;
  itemCount: number;
}

export const getPublishPreview = async (bookId: number): Promise<PublishPreview> => {
  await initDatabase();
  const db = getDatabase();

  const items = await db.getAllAsync<BookItem>(
    `SELECT * FROM expense_book_items WHERE book_id = ? AND type = 'expense' AND is_published = 0`,
    [bookId]
  );

  const itemsMissingAccount = items.filter(i => !i.account_id);
  const totalAmount = items.reduce((s, i) => s + i.amount, 0);

  // Calculate per-account impact
  const accountMap: Record<number, number> = {};
  for (const item of items) {
    if (item.account_id) {
      accountMap[item.account_id] = (accountMap[item.account_id] || 0) + item.amount;
    }
  }

  const accountImpact = await Promise.all(
    Object.entries(accountMap).map(async ([accId, deduction]) => {
      const acc = await db.getFirstAsync<{ id: number; name: string; balance: number }>(
        'SELECT id, name, balance FROM accounts WHERE id = ?',
        [parseInt(accId)]
      );
      return {
        account_id: parseInt(accId),
        account_name: acc?.name ?? 'Unknown',
        deduction,
        current_balance: acc?.balance ?? 0,
        will_go_negative: (acc?.balance ?? 0) - deduction < 0,
      };
    })
  );

  return { items, itemsMissingAccount, accountImpact, totalAmount, itemCount: items.length };
};

// ── Text Share Summary ────────────────────────────────────────────────

export const generateShareSummary = async (bookId: number): Promise<string> => {
  const book = await getBookById(bookId);
  if (!book) return '';

  const sections = await getBookSectionTotals(bookId);
  const items = await getBookItems(bookId);

  let text = `${book.cover_emoji} ${book.name} — Expense Summary\n`;
  text += `${'─'.repeat(30)}\n\n`;

  for (const section of sections) {
    text += `📌 ${section.section_name} (₹${section.total.toLocaleString()})\n`;
    const sectionItems = items.filter(i => (i.section_name || 'General') === section.section_name && i.type === 'expense');
    for (const item of sectionItems) {
      text += `  • ${item.name}: ₹${item.amount.toLocaleString()}\n`;
    }
    text += '\n';
  }

  const total = sections.reduce((s, sec) => s + sec.total, 0);
  text += `${'─'.repeat(30)}\n`;
  text += `Total: ₹${total.toLocaleString()}\n`;
  text += `Generated by Gastos app`;
  return text;
};
