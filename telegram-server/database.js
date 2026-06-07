const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, 'bot_queue.db');
let db;

function getDb() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    initTables();
  }
  return db;
}

function initTables() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      telegram_id TEXT UNIQUE NOT NULL,
      chat_id     TEXT NOT NULL,
      app_user_id TEXT UNIQUE NOT NULL,
      linked_at   TEXT DEFAULT (datetime('now')),
      is_active   INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS pending_transactions (
      id              TEXT PRIMARY KEY,
      app_user_id     TEXT NOT NULL,
      type            TEXT DEFAULT 'expense',
      amount          REAL NOT NULL,
      category        TEXT NOT NULL,
      subcategory     TEXT DEFAULT NULL,
      account         TEXT DEFAULT NULL,
      note            TEXT DEFAULT NULL,
      date            TEXT NOT NULL,
      raw_message     TEXT NOT NULL,
      status          TEXT DEFAULT 'pending',
      created_at      TEXT DEFAULT (datetime('now')),
      processed_at    TEXT DEFAULT NULL,
      telegram_msg_id TEXT DEFAULT NULL
    );

    CREATE TABLE IF NOT EXISTS command_log (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      app_user_id TEXT NOT NULL,
      command     TEXT NOT NULL,
      result      TEXT DEFAULT NULL,
      created_at  TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS user_categories (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      app_user_id TEXT NOT NULL,
      category    TEXT NOT NULL,
      synced_at   TEXT DEFAULT (datetime('now'))
    );
  `);

  // ── Safe migration: add subcategory + account columns if missing ──────────
  // This handles databases that were created before this upgrade.
  const ptCols = db.prepare("PRAGMA table_info(pending_transactions)").all().map(r => r.name);
  if (!ptCols.includes('subcategory')) {
    db.exec("ALTER TABLE pending_transactions ADD COLUMN subcategory TEXT DEFAULT NULL");
  }
  if (!ptCols.includes('account')) {
    db.exec("ALTER TABLE pending_transactions ADD COLUMN account TEXT DEFAULT NULL");
  }
}

// --- User functions ---
function getUserByTelegramId(telegramId) {
  return getDb().prepare('SELECT * FROM users WHERE telegram_id = ?').get(String(telegramId));
}

function getUserByAppUserId(appUserId) {
  return getDb().prepare('SELECT * FROM users WHERE app_user_id = ?').get(appUserId);
}

function upsertUser(telegramId, chatId, appUserId) {
  const existing = getUserByTelegramId(telegramId);
  if (existing) {
    // Update chat_id in case it changed
    getDb().prepare('UPDATE users SET chat_id = ? WHERE telegram_id = ?').run(String(chatId), String(telegramId));
    return existing;
  }
  getDb().prepare(
    'INSERT INTO users (telegram_id, chat_id, app_user_id) VALUES (?, ?, ?)'
  ).run(String(telegramId), String(chatId), appUserId);
  return getUserByTelegramId(telegramId);
}

// --- Pending transaction functions ---
function insertPendingTransaction(tx) {
  getDb().prepare(`
    INSERT INTO pending_transactions
      (id, app_user_id, type, amount, category, subcategory, account,
       note, date, raw_message, status, telegram_msg_id)
    VALUES
      (@id, @app_user_id, @type, @amount, @category, @subcategory, @account,
       @note, @date, @raw_message, 'pending', @telegram_msg_id)
  `).run(tx);
}

function getPendingTransactions(appUserId) {
  return getDb().prepare(`
    SELECT * FROM pending_transactions
    WHERE app_user_id = ?
      AND status IN ('confirmed', 'undo_requested')
      AND created_at > datetime('now', '-24 hours')
    ORDER BY created_at ASC
  `).all(appUserId);
}

function updateTransactionStatus(id, status, processedAt = null) {
  if (processedAt) {
    getDb().prepare(
      'UPDATE pending_transactions SET status = ?, processed_at = ? WHERE id = ?'
    ).run(status, processedAt, id);
  } else {
    getDb().prepare('UPDATE pending_transactions SET status = ? WHERE id = ?').run(status, id);
  }
}

function getTransactionById(id) {
  return getDb().prepare('SELECT * FROM pending_transactions WHERE id = ?').get(id);
}

function getLastProcessedTransaction(appUserId) {
  return getDb().prepare(`
    SELECT * FROM pending_transactions
    WHERE app_user_id = ? AND status = 'processed'
    ORDER BY processed_at DESC
    LIMIT 1
  `).get(appUserId);
}

// --- Command log functions ---
function insertCommandLog(appUserId, command) {
  const result = getDb().prepare(
    'INSERT INTO command_log (app_user_id, command) VALUES (?, ?)'
  ).run(appUserId, command);
  return result.lastInsertRowId;
}

function getPendingCommands(appUserId) {
  return getDb().prepare(
    'SELECT * FROM command_log WHERE app_user_id = ? AND result IS NULL ORDER BY created_at ASC'
  ).all(appUserId);
}

function updateCommandResult(id, result) {
  getDb().prepare('UPDATE command_log SET result = ? WHERE id = ?').run(result, id);
}

// --- Category sync ---
function syncCategories(appUserId, categories) {
  getDb().prepare('DELETE FROM user_categories WHERE app_user_id = ?').run(appUserId);
  const insert = getDb().prepare('INSERT INTO user_categories (app_user_id, category) VALUES (?, ?)');
  for (const cat of categories) {
    insert.run(appUserId, cat);
  }
}

function getUserCategories(appUserId) {
  return getDb().prepare(
    'SELECT category FROM user_categories WHERE app_user_id = ?'
  ).all(appUserId).map(r => r.category);
}

module.exports = {
  getDb,
  getUserByTelegramId,
  getUserByAppUserId,
  upsertUser,
  insertPendingTransaction,
  getPendingTransactions,
  updateTransactionStatus,
  getTransactionById,
  getLastProcessedTransaction,
  insertCommandLog,
  getPendingCommands,
  updateCommandResult,
  syncCategories,
  getUserCategories,
};
