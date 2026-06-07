import { getDatabase, initDatabase, getCategories, getAccounts, addTransactionDirect } from '../services/database';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { TELEGRAM_KEYS } from './TelegramService';

// ── TRANSACTION PROCESSOR ────────────────────────────────────────────────────

/**
 * Process a single pending transaction from the bot.
 * Uses addTransactionDirect() to bypass the throttle guard.
 */
export async function processPendingTransaction(transaction: any): Promise<{
  success: boolean;
  transactionId?: number;
  error?: string;
}> {
  try {
    await initDatabase();
    const db = getDatabase();

    // ── STEP 1 — Resolve category ────────────────────────────────────────────
    // Categories live in a JSON blob inside the accounts table (CategoryNode[]).
    // getCategories() returns CategoryNode[] where each node has:
    //   { id, name, subcategories: string[] }
    const categories = await getCategories();
    const expenseCategories = categories.filter(c => c.name !== 'Income');

    let resolvedCategory = transaction.category || 'Others';
    const matchedNode = categories.find(
      (c: { name: string }) => c.name.toLowerCase() === resolvedCategory.toLowerCase()
    );
    if (!matchedNode) {
      // Category from bot doesn't exist in user's app — fall back to first expense category
      resolvedCategory = expenseCategories[0]?.name || 'Others';
    }

    // ── STEP 1B — Resolve subcategory ────────────────────────────────────────
    // Subcategories are a plain string[] inside each CategoryNode.
    // We do a case-insensitive match.
    let resolvedSubcategory = '';
    if (transaction.subcategory && matchedNode) {
      const subLower = transaction.subcategory.toLowerCase();
      const found = (matchedNode.subcategories as string[]).find(
        (s: string) => s.toLowerCase() === subLower
      );
      if (found) {
        resolvedSubcategory = found;                          // matched — use exact DB spelling
      } else {
        resolvedSubcategory = transaction.subcategory;        // not in list — save as-is anyway
        console.warn(
          `[Telegram] Subcategory '${transaction.subcategory}' not in ` +
          `'${resolvedCategory}' list. Saving as-is.`
        );
      }
    }

    // ── STEP 2 — Resolve account ──────────────────────────────────────────────
    const defaultAccountId = await AsyncStorage.getItem(TELEGRAM_KEYS.DEFAULT_ACCOUNT_ID);
    const accounts = await getAccounts();

    if (accounts.length === 0) {
      return { success: false, error: 'No accounts found in app' };
    }

    let account = accounts[0]; // fallback: first account

    // Priority 1: named account from bot message (e.g. transaction.account = "HDFC")
    if (transaction.account) {
      const byName = accounts.find(
        (a: { name: string }) => a.name.toLowerCase() === transaction.account.toLowerCase()
      );
      if (byName) account = byName;
    // Priority 2: default to "Cash" if no account was typed in Telegram
    } else {
      const cashAccount = accounts.find(
        (a: { name: string }) => a.name.toLowerCase() === 'cash'
      );
      if (cashAccount) account = cashAccount;
    }

    // ── STEP 3 — Duplicate check ──────────────────────────────────────────────
    // Reject identical (amount + category + date) within the last 5 minutes
    const fiveMinsAgo = Date.now() - 5 * 60 * 1000;
    const datePrefix = transaction.date.substring(0, 10);

    const duplicate = await db.getFirstAsync<{ id: number }>(
      `SELECT id FROM transactions
       WHERE amount = ? AND category = ? AND substr(date, 1, 10) = ?
       AND created_at >= ?
       LIMIT 1`,
      [transaction.amount, resolvedCategory, datePrefix, fiveMinsAgo]
    );

    if (duplicate) {
      return {
        success: false,
        error: 'Duplicate transaction detected (same amount+category in last 5 min)',
      };
    }

    // ── STEP 4 — Insert transaction ───────────────────────────────────────────
    const txId = await addTransactionDirect({
      amount:      transaction.amount,
      category:    resolvedCategory,
      subcategory: resolvedSubcategory,       // '' if none, non-empty if matched
      account_id:  account.id,
      date:        transaction.date,
      description: transaction.note || 'Added via Telegram',
      source:      'telegram',
    });

    return { success: true, transactionId: txId };
  } catch (err) {
    console.error('[Telegram] processPendingTransaction error:', err);
    return { success: false, error: (err as Error).message };
  }
}

// ── COMMAND PROCESSOR ────────────────────────────────────────────────────────

/**
 * Process a bot command (query_today, query_balance, etc.)
 * Returns formatted text to send back to Telegram.
 */
export async function processCommand(command: any): Promise<string | null> {
  try {
    await initDatabase();
    const db = getDatabase();
    const today = new Date().toISOString().substring(0, 10);

    switch (command.command) {
      case 'query_today': {
        const rows = await db.getAllAsync<{
          amount: number; category: string; description: string; type?: string;
        }>(
          `SELECT t.amount, t.category, t.description
           FROM transactions t
           WHERE substr(t.date, 1, 10) = ?
           ORDER BY t.created_at DESC`,
          [today]
        );

        if (rows.length === 0) return '📊 *Today\'s Summary*\n\nNo transactions today.';

        const expenses = rows.filter(r => r.category !== 'Income');
        const incomes = rows.filter(r => r.category === 'Income');
        const totalExpense = expenses.reduce((s, r) => s + r.amount, 0);
        const totalIncome = incomes.reduce((s, r) => s + r.amount, 0);

        const lines = [
          `📊 *Today's Summary*\n`,
          `💸 Expenses: ₹${totalExpense.toLocaleString('en-IN')}`,
          `💰 Income: ₹${totalIncome.toLocaleString('en-IN')}`,
          `\n*Transactions:*`,
          ...rows.slice(0, 10).map(r => {
            const desc = r.description ? ` — ${r.description}` : '';
            return `• ${r.category}: ₹${r.amount.toLocaleString('en-IN')}${desc}`;
          }),
        ];

        if (rows.length > 10) lines.push(`_...and ${rows.length - 10} more_`);
        return lines.join('\n');
      }

      case 'query_balance': {
        const accounts = await getAccounts();
        if (accounts.length === 0) return '💼 *Account Balances*\n\nNo accounts found.';

        const total = accounts.reduce((s, a) => s + a.balance, 0);
        const lines = [
          `💼 *Account Balances*\n`,
          ...accounts.map(a => `🏦 ${a.name}: ₹${a.balance.toLocaleString('en-IN')}`),
          `───────────────`,
          `Total: ₹${total.toLocaleString('en-IN')}`,
        ];
        return lines.join('\n');
      }

      case 'query_week': {
        const monday = new Date();
        monday.setDate(monday.getDate() - monday.getDay() + 1);
        monday.setHours(0, 0, 0, 0);
        const mondayStr = monday.toISOString().substring(0, 10);

        const rows = await db.getAllAsync<{ amount: number; category: string }>(
          `SELECT amount, category FROM transactions
           WHERE substr(date, 1, 10) >= ?
           ORDER BY date ASC`,
          [mondayStr]
        );

        const expenses = rows.filter(r => r.category !== 'Income');
        const incomes = rows.filter(r => r.category === 'Income');

        // Top categories
        const catTotals: Record<string, number> = {};
        for (const r of expenses) {
          catTotals[r.category] = (catTotals[r.category] || 0) + r.amount;
        }
        const topCats = Object.entries(catTotals)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 3)
          .map(([cat, amt]) => `• ${cat}: ₹${amt.toLocaleString('en-IN')}`);

        const lines = [
          `📅 *This Week's Summary*\n`,
          `💸 Expenses: ₹${expenses.reduce((s, r) => s + r.amount, 0).toLocaleString('en-IN')}`,
          `💰 Income: ₹${incomes.reduce((s, r) => s + r.amount, 0).toLocaleString('en-IN')}`,
          topCats.length ? `\n*Top Categories:*\n${topCats.join('\n')}` : '',
        ];
        return lines.filter(Boolean).join('\n');
      }

      case 'query_month': {
        const monthPrefix = today.substring(0, 7); // e.g. "2026-06"

        const rows = await db.getAllAsync<{ amount: number; category: string }>(
          `SELECT amount, category FROM transactions
           WHERE substr(date, 1, 7) = ?`,
          [monthPrefix]
        );

        const expenses = rows.filter(r => r.category !== 'Income');
        const incomes = rows.filter(r => r.category === 'Income');

        const catTotals: Record<string, number> = {};
        for (const r of expenses) {
          catTotals[r.category] = (catTotals[r.category] || 0) + r.amount;
        }
        const topCats = Object.entries(catTotals)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 5)
          .map(([cat, amt]) => `• ${cat}: ₹${amt.toLocaleString('en-IN')}`);

        const monthName = new Date().toLocaleString('en-IN', { month: 'long', year: 'numeric' });
        const lines = [
          `📆 *${monthName} Summary*\n`,
          `💸 Expenses: ₹${expenses.reduce((s, r) => s + r.amount, 0).toLocaleString('en-IN')}`,
          `💰 Income: ₹${incomes.reduce((s, r) => s + r.amount, 0).toLocaleString('en-IN')}`,
          topCats.length ? `\n*Top Categories:*\n${topCats.join('\n')}` : '',
        ];
        return lines.filter(Boolean).join('\n');
      }

      default:
        return null;
    }
  } catch (err) {
    console.error('[Telegram] processCommand error:', err);
    return null;
  }
}

// ── UNDO PROCESSOR ───────────────────────────────────────────────────────────

/**
 * Process an undo request.
 * Finds the matching transaction by amount + category + date and deletes it.
 */
export async function processUndo(undoRecord: any): Promise<{ success: boolean; error?: string }> {
  try {
    await initDatabase();
    const db = getDatabase();

    const datePrefix = undoRecord.date.substring(0, 10);

    // Find the local transaction
    const found = await db.getFirstAsync<{
      id: number; amount: number; category: string; account_id: number;
    }>(
      `SELECT id, amount, category, account_id FROM transactions
       WHERE amount = ? AND category = ? AND substr(date, 1, 10) = ?
       AND source = 'telegram'
       ORDER BY created_at DESC LIMIT 1`,
      [undoRecord.amount, undoRecord.category, datePrefix]
    );

    if (!found) {
      return { success: false, error: 'Transaction not found locally' };
    }

    // Delete transaction and reverse account balance
    await db.withTransactionAsync(async () => {
      // Reverse the balance change
      // For expenses: balance was decreased, so we add it back
      // For income: balance was increased, so we subtract it
      const isIncome = found.category === 'Income';
      const balanceDelta = isIncome ? -found.amount : found.amount;

      await db.runAsync(
        'DELETE FROM transactions WHERE id = ?',
        [found.id]
      );
      await db.runAsync(
        'UPDATE accounts SET balance = balance + ? WHERE id = ?',
        [balanceDelta, found.account_id]
      );
    });

    return { success: true };
  } catch (err) {
    console.error('[Telegram] processUndo error:', err);
    return { success: false, error: (err as Error).message };
  }
}
