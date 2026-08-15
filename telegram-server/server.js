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

// ── RAZORPAY SUBSCRIPTION & ORDER API ──────────────────────────────────────────

const Razorpay = require('razorpay');
const crypto = require('crypto');

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || 'rzp_test_TPz58kY38e4DDc',
  key_secret: process.env.RAZORPAY_KEY_SECRET || '6693V7PqLIRdvcxP2DhppQaM',
});

const PLAN_IDS = {
  monthly: process.env.RAZORPAY_MONTHLY_PLAN_ID || 'plan_TPywoFrCTxtzZN',
  yearly: process.env.RAZORPAY_YEARLY_PLAN_ID || 'plan_TPz0CFJt6Nu9ay',
};

// POST /api/create-subscription — Creates Razorpay subscription for monthly/yearly
app.post('/api/create-subscription', requireSecret, async (req, res) => {
  const { userId, plan } = req.body;

  if (!userId || !plan || !PLAN_IDS[plan]) {
    return res.status(400).json({ error: 'Invalid userId or plan' });
  }

  try {
    const subscription = await razorpay.subscriptions.create({
      plan_id: PLAN_IDS[plan],
      total_count: plan === 'monthly' ? 120 : 10,
      quantity: 1,
      customer_notify: 1,
      notes: { userId, plan },
    });

    db.upsertSubscription(userId, {
      plan,
      status: 'created',
      razorpay_subscription_id: subscription.id,
    });

    res.json({ subscriptionId: subscription.id });
  } catch (err) {
    console.error('/api/create-subscription error:', err);
    res.status(500).json({ error: err.message || 'Failed to create subscription' });
  }
});

// POST /api/create-order — Creates Razorpay One-Time Order for Lifetime plan (₹999)
app.post('/api/create-order', requireSecret, async (req, res) => {
  const { userId, amount, plan } = req.body;

  if (!userId || !amount) {
    return res.status(400).json({ error: 'userId and amount are required' });
  }

  if (parseInt(amount) !== 99900) {
    return res.status(400).json({ error: 'Invalid amount for lifetime plan' });
  }

  try {
    const order = await razorpay.orders.create({
      amount: 99900,
      currency: 'INR',
      receipt: `gastos_lifetime_${userId}_${Date.now()}`,
      notes: { userId, plan: 'lifetime' },
    });

    db.upsertSubscription(userId, {
      plan: 'lifetime',
      status: 'pending_lifetime',
      razorpay_subscription_id: null,
    });

    res.json({ orderId: order.id });
  } catch (err) {
    console.error('/api/create-order error:', err);
    res.status(500).json({ error: err.message || 'Failed to create order' });
  }
});

// POST /api/razorpay-webhook — Handles Razorpay webhook notifications
app.post('/api/razorpay-webhook', async (req, res) => {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET || 'gastosWebhook2026SecretKey';
  const signature = req.headers['x-razorpay-signature'];

  if (signature) {
    const shasum = crypto.createHmac('sha256', secret);
    shasum.update(JSON.stringify(req.body));
    const digest = shasum.digest('hex');

    if (digest !== signature) {
      console.warn('[Webhook] Invalid signature');
      return res.status(400).json({ error: 'Invalid signature' });
    }
  }

  const { event, payload } = req.body;
  console.log(`[Webhook Event]: ${event}`);

  try {
    if (event === 'subscription.activated' || event === 'subscription.charged') {
      const subEntity = payload.subscription.entity;
      const notes = subEntity.notes || {};
      const userId = notes.userId;
      const plan = notes.plan || 'monthly';
      const periodEnd = subEntity.current_end
        ? new Date(subEntity.current_end * 1000).toISOString()
        : new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString();

      if (userId) {
        db.upsertSubscription(userId, {
          plan,
          status: 'premium',
          razorpay_subscription_id: subEntity.id,
          current_period_end: periodEnd,
        });
        console.log(`[Webhook] Activated ${plan} subscription for ${userId}`);
      }
    } else if (event === 'payment.captured') {
      const paymentEntity = payload.payment.entity;
      const notes = paymentEntity.notes || {};
      const userId = notes.userId;
      const plan = notes.plan;

      if (userId && plan === 'lifetime') {
        db.upsertSubscription(userId, {
          plan: 'lifetime',
          status: 'premium',
          current_period_end: '2099-12-31T23:59:59.000Z',
        });
        console.log(`[Webhook] Activated lifetime subscription for ${userId}`);
      }
    } else if (event === 'subscription.cancelled' || event === 'subscription.halted') {
      const subEntity = payload.subscription.entity;
      const notes = subEntity.notes || {};
      const userId = notes.userId;

      if (userId) {
        db.upsertSubscription(userId, {
          plan: notes.plan || 'monthly',
          status: 'cancelled',
          razorpay_subscription_id: subEntity.id,
        });
        console.log(`[Webhook] Cancelled subscription for ${userId}`);
      }
    }

    res.json({ status: 'ok' });
  } catch (err) {
    console.error('[Webhook Error]:', err);
    res.status(500).json({ error: 'Webhook handler error' });
  }
});

// GET /api/subscription-status/:userId — Checks user subscription status
app.get('/api/subscription-status/:userId', requireSecret, (req, res) => {
  const { userId } = req.params;

  try {
    const sub = db.getSubscription(userId);
    if (!sub) {
      return res.json({
        isPremium: false,
        status: 'free',
        plan: null,
        expiryDate: null,
      });
    }

    const now = new Date();
    const expiryDate = sub.current_period_end ? new Date(sub.current_period_end) : null;
    const isPremium = sub.status === 'premium' && (expiryDate === null || expiryDate > now);

    res.json({
      isPremium,
      status: sub.status,
      plan: sub.plan,
      expiryDate: sub.current_period_end,
      razorpaySubscriptionId: sub.razorpay_subscription_id,
    });
  } catch (err) {
    console.error('/api/subscription-status error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/cancel-subscription — Cancels active subscription via Razorpay
app.post('/api/cancel-subscription', requireSecret, async (req, res) => {
  const { userId } = req.body;

  try {
    const sub = db.getSubscription(userId);
    if (!sub || !sub.razorpay_subscription_id) {
      return res.status(400).json({ error: 'No active Razorpay subscription found' });
    }

    await razorpay.subscriptions.cancel(sub.razorpay_subscription_id, false);

    db.upsertSubscription(userId, {
      plan: sub.plan,
      status: 'cancelled',
      razorpay_subscription_id: sub.razorpay_subscription_id,
      current_period_end: sub.current_period_end,
    });

    res.json({ ok: true, message: 'Subscription cancelled successfully' });
  } catch (err) {
    console.error('/api/cancel-subscription error:', err);
    res.status(500).json({ error: err.message || 'Failed to cancel subscription' });
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
