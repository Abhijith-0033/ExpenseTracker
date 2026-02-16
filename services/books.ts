
import { initDatabase, getDatabase } from './database';

export interface ExpenseBook {
    id: number;
    name: string;
    description?: string;
    budget: number;
    created_at: number;
    last_updated: number;
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
}

export const getBooks = async (): Promise<(ExpenseBook & { total_spent: number; item_count: number })[]> => {
    await initDatabase();
    const db = getDatabase();
    // Get books
    const books = await db.getAllAsync<ExpenseBook>('SELECT * FROM expense_books ORDER BY last_updated DESC');

    // Enrich with totals (doing this in app layer or subquery)
    // Using a loop for simplicity and safety or subquery if supported well
    const enriched = await Promise.all(books.map(async (book) => {
        const res = await db.getFirstAsync<{ total: number; count: number }>(
            'SELECT SUM(amount) as total, COUNT(*) as count FROM expense_book_items WHERE book_id = ?',
            [book.id]
        );
        return {
            ...book,
            total_spent: res?.total || 0,
            item_count: res?.count || 0
        };
    }));

    return enriched;
};

export const getBookById = async (id: number): Promise<ExpenseBook | null> => {
    await initDatabase();
    const db = getDatabase();
    return await db.getFirstAsync<ExpenseBook>('SELECT * FROM expense_books WHERE id = ?', [id]);
};

export const addBook = async (name: string, description: string = '', budget: number = 0) => {
    await initDatabase();
    const db = getDatabase();
    const timestamp = Date.now();
    await db.runAsync(
        'INSERT INTO expense_books (name, description, budget, created_at, last_updated) VALUES (?, ?, ?, ?, ?)',
        [name, description, budget, timestamp, timestamp]
    );
};

export const updateBook = async (id: number, name: string, description: string, budget: number) => {
    await initDatabase();
    const db = getDatabase();
    const timestamp = Date.now();
    await db.runAsync(
        'UPDATE expense_books SET name = ?, description = ?, budget = ?, last_updated = ? WHERE id = ?',
        [name, description, budget, timestamp, id]
    );
};

export const deleteBook = async (id: number) => {
    await initDatabase();
    const db = getDatabase();
    // Items cascade delete via FK, but we can ensure cleanup if needed
    await db.runAsync('DELETE FROM expense_books WHERE id = ?', [id]);
};

// --- Items ---

export const getBookItems = async (bookId: number): Promise<BookItem[]> => {
    await initDatabase();
    const db = getDatabase();
    return await db.getAllAsync<BookItem>('SELECT * FROM expense_book_items WHERE book_id = ? ORDER BY date DESC', [bookId]);
};

export const addBookItem = async (
    bookId: number,
    name: string,
    amount: number,
    notes: string = '',
    date: number = Date.now(),
    type: 'expense' | 'income' = 'expense',
    income_source_id: number | null = null
) => {
    await initDatabase();
    const db = getDatabase();
    await db.withTransactionAsync(async () => {
        // Add item
        await db.runAsync(
            'INSERT INTO expense_book_items (book_id, name, amount, notes, date, type, income_source_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [bookId, name, amount, notes, date, type, income_source_id]
        );
        // Update book timestamp
        await db.runAsync('UPDATE expense_books SET last_updated = ? WHERE id = ?', [Date.now(), bookId]);
    });
};

export const updateBookItem = async (
    id: number,
    name: string,
    amount: number,
    notes: string,
    date: number,
    type: 'expense' | 'income' = 'expense',
    income_source_id: number | null = null
) => {
    await initDatabase();
    const db = getDatabase();
    await db.withTransactionAsync(async () => {
        // Get book_id first to update timestamp
        const item = await db.getFirstAsync<{ book_id: number }>('SELECT book_id FROM expense_book_items WHERE id = ?', [id]);

        await db.runAsync(
            'UPDATE expense_book_items SET name = ?, amount = ?, notes = ?, date = ?, type = ?, income_source_id = ? WHERE id = ?',
            [name, amount, notes, date, type, income_source_id, id]
        );

        if (item) {
            await db.runAsync('UPDATE expense_books SET last_updated = ? WHERE id = ?', [Date.now(), item.book_id]);
        }
    });
};

export const deleteBookItem = async (id: number) => {
    await initDatabase();
    const db = getDatabase();
    await db.withTransactionAsync(async () => {
        // Get book_id first to update timestamp
        const item = await db.getFirstAsync<{ book_id: number }>('SELECT book_id FROM expense_book_items WHERE id = ?', [id]);

        await db.runAsync('DELETE FROM expense_book_items WHERE id = ?', [id]);

        if (item) {
            await db.runAsync('UPDATE expense_books SET last_updated = ? WHERE id = ?', [Date.now(), item.book_id]);
        }
    });
};

// --- Analytics ---

export const getBookSummary = async (bookId: number) => {
    await initDatabase();
    const db = getDatabase();
    const res = await db.getFirstAsync<{ total: number; total_income: number; count: number }>(
        'SELECT SUM(CASE WHEN type = "expense" THEN amount ELSE 0 END) as total, SUM(CASE WHEN type = "income" THEN amount ELSE 0 END) as total_income, COUNT(*) as count FROM expense_book_items WHERE book_id = ?',
        [bookId]
    );
    const book = await getBookById(bookId);

    return {
        totalSpent: res?.total || 0,
        totalIncome: res?.total_income || 0,
        itemCount: res?.count || 0,
        budget: book?.budget || 0,
        progress: book?.budget && book.budget > 0 ? ((res?.total || 0) / book.budget) : 0
    };
};

export const getBookItemDistribution = async (bookId: number) => {
    await initDatabase();
    const db = getDatabase();
    // Group by name for chart (or maybe custom buckets in future)
    // For now, raw items if < 10, else grouped
    const items = await getBookItems(bookId);
    return items.map(item => ({
        name: item.name,
        value: item.amount,
        color: '#3b82f6' // Default, UI will assign colors
    }));
};
