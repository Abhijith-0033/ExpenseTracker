'use strict';
require('dotenv').config();

const TelegramBot = require('node-telegram-bot-api');
const { v4: uuidv4 } = require('uuid');
const { parseMessage } = require('./parser');
const { formatCategoryList } = require('./categories');
const db = require('./database');

let bot;

function initBot() {
  if (!process.env.TELEGRAM_BOT_TOKEN) {
    console.error('❌ TELEGRAM_BOT_TOKEN not set in environment');
    return null;
  }

  // Use webhook mode (not polling) for production server
  bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: false });
  console.log('✅ Telegram bot initialized (webhook mode)');
  return bot;
}

function getBot() {
  return bot;
}

/**
 * Format a date ISO string for display.
 * @param {string} isoDate
 * @returns {string}
 */
function formatDate(isoDate) {
  try {
    const d = new Date(isoDate);
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return isoDate.substring(0, 10);
  }
}

/**
 * Format a number as Indian Rupee.
 */
function formatAmount(amount) {
  return '₹' + Number(amount).toLocaleString('en-IN', { maximumFractionDigits: 2 });
}

// ── COMMAND HANDLERS ──────────────────────────────────────────────────────────

async function handleStart(msg) {
  const telegramId = String(msg.from.id);
  const chatId = String(msg.chat.id);

  let user = db.getUserByTelegramId(telegramId);

  if (user) {
    // Already linked — return existing code
    await bot.sendMessage(chatId,
      `👋 Welcome back!\n\n` +
      `Your connection code is:\n\`${user.app_user_id}\`\n\n` +
      `Use this in your Gastos app → Settings → Telegram Bot to link (or re-link) your account.`,
      { parse_mode: 'Markdown' }
    );
    return;
  }

  // New user — generate UUID
  const appUserId = uuidv4();
  db.upsertUser(telegramId, chatId, appUserId);

  await bot.sendMessage(chatId,
    `🎉 *Welcome to your Expense Tracker Bot!*\n\n` +
    `Your connection code:\n\`${appUserId}\`\n\n` +
    `📱 *How to link:*\n` +
    `1. Open your Gastos app\n` +
    `2. Go to Settings → Telegram Bot\n` +
    `3. Paste this code and tap Connect\n\n` +
    `After linking, send expenses like:\n` +
    `• \`food 150\`\n` +
    `• \`transport 50 office cab\`\n` +
    `• \`income 45000 salary\`\n\n` +
    `Type /help for all commands.`,
    { parse_mode: 'Markdown' }
  );
}

async function handleHelp(msg) {
  const chatId = String(msg.chat.id);
  await bot.sendMessage(chatId,
    `📋 *How to Add Expenses*\n\n` +
    `*Format:* category amount note(optional)\n\n` +
    `*Examples:*\n` +
    `• \`food 150\`\n` +
    `• \`transport 50 office cab\`\n` +
    `• \`shopping 2500 new shoes\`\n` +
    `• \`income 45000 salary\`\n` +
    `• \`food 150 yesterday\`\n` +
    `• \`food 150 25/06\`\n\n` +
    `📌 *Category Keywords*\n` +
    `food, transport, shopping, rent,\n` +
    `entertainment, medical, grocery,\n` +
    `education, income, other\n\n` +
    `⚡ *Commands*\n` +
    `/today — Today's expenses\n` +
    `/week — This week summary\n` +
    `/month — This month summary\n` +
    `/balance — Account balances\n` +
    `/categories — Full category list\n` +
    `/undo — Undo last transaction\n` +
    `/status — Connection status`,
    { parse_mode: 'Markdown' }
  );
}

async function handleStatus(msg) {
  const chatId = String(msg.chat.id);
  const telegramId = String(msg.from.id);
  const user = db.getUserByTelegramId(telegramId);

  if (!user) {
    await bot.sendMessage(chatId,
      `❌ Not linked to any app account.\nSend /start to get your connection code.`
    );
    return;
  }

  await bot.sendMessage(chatId,
    `✅ *Bot Status*\n\n` +
    `Connected: Yes\n` +
    `App User ID: \`${user.app_user_id.substring(0, 8)}...\`\n` +
    `Linked at: ${user.linked_at}`,
    { parse_mode: 'Markdown' }
  );
}

async function handleCategories(msg) {
  const chatId = String(msg.chat.id);
  const telegramId = String(msg.from.id);
  const user = db.getUserByTelegramId(telegramId);

  const userCategories = user ? db.getUserCategories(user.app_user_id) : [];
  const text = formatCategoryList(userCategories);
  await bot.sendMessage(chatId, text, { parse_mode: 'Markdown' });
}

async function handleUndo(msg) {
  const chatId = String(msg.chat.id);
  const telegramId = String(msg.from.id);
  const user = db.getUserByTelegramId(telegramId);

  if (!user) {
    await bot.sendMessage(chatId, `❌ Not linked. Send /start first.`);
    return;
  }

  const lastTx = db.getLastProcessedTransaction(user.app_user_id);
  if (!lastTx) {
    await bot.sendMessage(chatId, `Nothing to undo. No recent transactions found.`);
    return;
  }

  db.updateTransactionStatus(lastTx.id, 'undo_requested');
  await bot.sendMessage(chatId,
    `↩️ *Undo request sent!*\n\n` +
    `${lastTx.category} ${formatAmount(lastTx.amount)} will be removed from your app on the next sync.`,
    { parse_mode: 'Markdown' }
  );
}

async function handleQueryCommand(msg, command) {
  const chatId = String(msg.chat.id);
  const telegramId = String(msg.from.id);
  const user = db.getUserByTelegramId(telegramId);

  if (!user) {
    await bot.sendMessage(chatId, `❌ Not linked. Send /start first.`);
    return;
  }

  db.insertCommandLog(user.app_user_id, command);
  await bot.sendMessage(chatId, `⏳ Fetching data... (updates when your app syncs)`);
}

// ── PLAIN MESSAGE HANDLER ─────────────────────────────────────────────────────

async function handlePlainMessage(msg) {
  const chatId = String(msg.chat.id);
  const telegramId = String(msg.from.id);
  const text = msg.text || '';

  // STEP 1: Check if user is linked
  const user = db.getUserByTelegramId(telegramId);
  if (!user) {
    await bot.sendMessage(chatId,
      `❌ Your Telegram is not linked to the app yet.\n\n` +
      `Send /start to get your connection code, then link in the Gastos app.`
    );
    return;
  }

  // Get user's synced categories for better matching
  const userCategories = db.getUserCategories(user.app_user_id);

  // STEP 2: Parse the message
  const result = parseMessage(text, userCategories);

  if (!result.isValid) {
    await bot.sendMessage(chatId,
      result.errorMessage + '\n\n_Format: food 150 your note_',
      { parse_mode: 'Markdown' }
    );
    return;
  }

  // STEP 3: Store pending transaction
  const txId = uuidv4();
  db.insertPendingTransaction({
    id: txId,
    app_user_id: user.app_user_id,
    type: result.type,
    amount: result.amount,
    category: result.category,
    note: result.note,
    date: result.date,
    raw_message: text,
    telegram_msg_id: String(msg.message_id),
  });

  // STEP 4: Send confirmation with inline keyboard
  const emoji = result.type === 'income' ? '💰' : '💸';
  const dateDisplay = formatDate(result.date);
  const noteLine = result.note ? `\nNote:      ${result.note}` : '';

  const confirmText =
    `${emoji} *Got it!*\n\n` +
    `Amount:    ${formatAmount(result.amount)}\n` +
    `Category:  ${result.category}\n` +
    `Date:      ${dateDisplay}` +
    noteLine + '\n\n' +
    `_Saving to your app..._`;

  await bot.sendMessage(chatId, confirmText, {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [[
        { text: '✅ Confirm', callback_data: `confirm_${txId}` },
        { text: '❌ Cancel', callback_data: `cancel_${txId}` },
      ]]
    }
  });
}

// ── CALLBACK QUERY HANDLER (inline keyboard buttons) ─────────────────────────

async function handleCallbackQuery(callbackQuery) {
  const data = callbackQuery.data;
  const chatId = String(callbackQuery.message.chat.id);
  const messageId = callbackQuery.message.message_id;

  if (data.startsWith('confirm_')) {
    const txId = data.replace('confirm_', '');
    db.updateTransactionStatus(txId, 'confirmed');

    await bot.answerCallbackQuery(callbackQuery.id, { text: '✅ Confirmed!' });
    await bot.editMessageReplyMarkup(
      { inline_keyboard: [] },
      { chat_id: chatId, message_id: messageId }
    );
    await bot.editMessageText(
      callbackQuery.message.text + '\n\n✅ *Confirmed! Processing...*',
      { chat_id: chatId, message_id: messageId, parse_mode: 'Markdown' }
    );
  } else if (data.startsWith('cancel_')) {
    const txId = data.replace('cancel_', '');
    db.updateTransactionStatus(txId, 'cancelled');

    await bot.answerCallbackQuery(callbackQuery.id, { text: '❌ Cancelled' });
    await bot.editMessageText(
      '❌ Transaction cancelled.',
      { chat_id: chatId, message_id: messageId }
    );
  }
}

// ── PROCESS UPDATE (called from server.js webhook handler) ───────────────────

async function processUpdate(update) {
  if (!bot) return;

  try {
    if (update.callback_query) {
      await handleCallbackQuery(update.callback_query);
      return;
    }

    const msg = update.message;
    if (!msg || !msg.text) return;

    const text = msg.text.trim();

    if (text === '/start' || text.startsWith('/start ')) {
      await handleStart(msg);
    } else if (text === '/help') {
      await handleHelp(msg);
    } else if (text === '/status') {
      await handleStatus(msg);
    } else if (text === '/categories') {
      await handleCategories(msg);
    } else if (text === '/undo') {
      await handleUndo(msg);
    } else if (['/today', '/balance', '/week', '/month'].includes(text)) {
      const commandMap = {
        '/today': 'query_today',
        '/balance': 'query_balance',
        '/week': 'query_week',
        '/month': 'query_month',
      };
      await handleQueryCommand(msg, commandMap[text]);
    } else if (text.startsWith('/')) {
      await bot.sendMessage(String(msg.chat.id),
        `Unknown command. Type /help to see all commands.`
      );
    } else {
      await handlePlainMessage(msg);
    }
  } catch (err) {
    console.error('Error processing update:', err);
  }
}

/**
 * Send a follow-up message to user after transaction is processed.
 */
async function notifyTransactionProcessed(appUserId, tx, success, errorMsg) {
  try {
    const user = db.getUserByAppUserId(appUserId);
    if (!user || !bot) return;

    const chatId = user.chat_id;

    if (success) {
      const dateDisplay = formatDate(tx.date);
      const noteStr = tx.note ? `\n📝 ${tx.note}` : '';
      await bot.sendMessage(chatId,
        `✅ *Transaction Added!*\n\n` +
        `${formatAmount(tx.amount)} · ${tx.category}\n` +
        `${dateDisplay}${noteStr}\n\n` +
        `Balance updated in your app.`,
        { parse_mode: 'Markdown' }
      );
    } else {
      await bot.sendMessage(chatId,
        `❌ Failed to add transaction.\n` +
        `Reason: ${errorMsg || 'Unknown error'}\n\n` +
        `Please add it manually in the app.`
      );
    }
  } catch (err) {
    console.error('Error sending notification:', err);
  }
}

/**
 * Send command response to user.
 */
async function sendCommandResponse(appUserId, responseText) {
  try {
    const user = db.getUserByAppUserId(appUserId);
    if (!user || !bot) return;
    await bot.sendMessage(user.chat_id, responseText, { parse_mode: 'Markdown' });
  } catch (err) {
    console.error('Error sending command response:', err);
  }
}

module.exports = {
  initBot,
  getBot,
  processUpdate,
  notifyTransactionProcessed,
  sendCommandResponse,
};
