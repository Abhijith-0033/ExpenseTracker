'use strict';
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const { initBot, processUpdate, notifyTransactionProcessed, sendCommandResponse } = require('./bot');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;
const APP_SECRET_KEY = process.env.APP_SECRET_KEY || 'default_secret_change_me';

// ── MIDDLEWARE ────────────────────────────────────────────────────────────────

app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '1mb' }));

// Simple in-memory rate limiter (30 req/min per app_user_id)
const rateLimitMap = new Map();
function checkRateLimit(appUserId) {
  const now = Date.now();
  const windowMs = 60 * 1000; // 1 minute
  const maxRequests = 30;

  if (!rateLimitMap.has(appUserId)) {
    rateLimitMap.set(appUserId, { count: 1, windowStart: now });
    return true;
  }

  const record = rateLimitMap.get(appUserId);
  if (now - record.windowStart > windowMs) {
    // Reset window
    rateLimitMap.set(appUserId, { count: 1, windowStart: now });
    return true;
  }

  if (record.count >= maxRequests) return false;
  record.count++;
  return true;
}

// Secret key middleware for protected routes
function requireSecret(req, res, next) {
  const secret = req.headers['x-app-secret'];
  if (secret !== APP_SECRET_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

// ── WEBHOOK ENDPOINT ──────────────────────────────────────────────────────────

// Telegram sends updates here
app.post('/webhook', async (req, res) => {
  // Always respond immediately (Telegram requires < 5s response)
  res.sendStatus(200);
  // Process asynchronously
  setImmediate(() => processUpdate(req.body));
});

// ── API ENDPOINTS ─────────────────────────────────────────────────────────────

// GET /health — Railway health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// GET /api/pending/:app_user_id — App polls this to get pending transactions
app.get('/api/pending/:app_user_id', requireSecret, (req, res) => {
  const { app_user_id } = req.params;

  if (!checkRateLimit(app_user_id)) {
    return res.status(429).json({ error: 'Too many requests. Wait a minute.' });
  }

  try {
    const transactions = db.getPendingTransactions(app_user_id);
    const commands = db.getPendingCommands(app_user_id);
    res.json({ transactions, commands });
  } catch (err) {
    console.error('Error fetching pending:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/processed/:transaction_id — App reports transaction processed
app.post('/api/processed/:transaction_id', requireSecret, async (req, res) => {
  const { transaction_id } = req.params;
  const { app_user_id, success, error_message } = req.body;

  console.log(`[/api/processed] txId=${transaction_id} app_user_id=${app_user_id} success=${success}`);

  try {
    const tx = db.getTransactionById(transaction_id);
    if (!tx) {
      console.warn(`[/api/processed] Transaction not found: ${transaction_id}`);
      return res.status(404).json({ error: 'Transaction not found' });
    }

    console.log(`[/api/processed] Found tx: category=${tx.category} amount=${tx.amount} status=${tx.status}`);

    db.updateTransactionStatus(
      transaction_id,
      'processed',
      new Date().toISOString()
    );

    res.json({ ok: true });

    // Send Telegram notification to user (async, don't block response)
    setImmediate(() => notifyTransactionProcessed(app_user_id, tx, success, error_message));
  } catch (err) {
    console.error('Error marking processed:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/command-response — App sends response to /today /balance etc
app.post('/api/command-response', requireSecret, async (req, res) => {
  const { app_user_id, command_id, response_text } = req.body;

  try {
    db.updateCommandResult(command_id, response_text);
    res.json({ ok: true });
    setImmediate(() => sendCommandResponse(app_user_id, response_text));
  } catch (err) {
    console.error('Error sending command response:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/sync-categories — App syncs its category list to server
app.post('/api/sync-categories', requireSecret, (req, res) => {
  const { app_user_id, categories } = req.body;

  if (!app_user_id || !Array.isArray(categories)) {
    return res.status(400).json({ error: 'Invalid payload' });
  }

  try {
    db.syncCategories(app_user_id, categories);
    res.json({ ok: true, synced: categories.length });
  } catch (err) {
    console.error('Error syncing categories:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── SERVER START ──────────────────────────────────────────────────────────────

async function start() {
  // Initialize bot
  initBot();

  // Register webhook with Telegram (if RAILWAY_URL is set)
  const railwayUrl = process.env.RAILWAY_URL;
  const token = process.env.TELEGRAM_BOT_TOKEN;

  if (railwayUrl && token) {
    try {
      const https = require('https');
      const webhookUrl = `${railwayUrl}/webhook`;
      const apiUrl = `https://api.telegram.org/bot${token}/setWebhook?url=${encodeURIComponent(webhookUrl)}`;

      https.get(apiUrl, (res) => {
        let data = '';
        res.on('data', chunk => { data += chunk; });
        res.on('end', () => {
          const parsed = JSON.parse(data);
          if (parsed.ok) {
            console.log(`✅ Webhook registered: ${webhookUrl}`);
          } else {
            console.warn('⚠️ Webhook registration failed:', parsed);
          }
        });
      }).on('error', (err) => {
        console.warn('⚠️ Could not register webhook:', err.message);
      });
    } catch (err) {
      console.warn('⚠️ Webhook setup error:', err);
    }
  } else {
    console.warn('⚠️ RAILWAY_URL not set — webhook not registered. Set it after deployment.');
  }

  app.listen(PORT, () => {
    console.log(`🚀 Expense Tracker Bot server running on port ${PORT}`);
  });
}

start();
