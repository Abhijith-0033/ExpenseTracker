'use strict';

const { matchCategory, matchSubcategory } = require('./categories');

/**
 * Account aliases: user types → canonical account name.
 * The processor will match this against account names in the app's SQLite DB.
 */
const ACCOUNT_ALIASES = {
  'hdfc':    'HDFC',
  'sbi':     'SBI',
  'cash':    'Cash',
  'gpay':    'GPay',
  'paytm':   'Paytm',
  'upi':     'UPI',
  'card':    'Card',
  'axis':    'Axis',
  'icici':   'ICICI',
  'kotak':   'Kotak',
  'phonepe': 'PhonePe',
};

/**
 * Parse a date expression from the message.
 * Returns { date: ISO string, matched: string | null }
 */
function extractDate(text) {
  const today = new Date();
  today.setHours(12, 0, 0, 0); // noon to avoid timezone issues

  // 'yesterday'
  const yesterdayMatch = text.match(/\byesterday\b/i);
  if (yesterdayMatch) {
    const d = new Date(today);
    d.setDate(d.getDate() - 1);
    return { date: d.toISOString(), matched: yesterdayMatch[0] };
  }

  // 'today'
  const todayMatch = text.match(/\btoday\b/i);
  if (todayMatch) {
    return { date: today.toISOString(), matched: todayMatch[0] };
  }

  // DD/MM or D/M format
  const dmMatch = text.match(/\b(\d{1,2})\/(\d{1,2})\b/);
  if (dmMatch) {
    const d = new Date(today);
    d.setMonth(parseInt(dmMatch[2]) - 1);
    d.setDate(parseInt(dmMatch[1]));
    return { date: d.toISOString(), matched: dmMatch[0] };
  }

  // YYYY-MM-DD
  const isoMatch = text.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (isoMatch) {
    const d = new Date(isoMatch[0] + 'T12:00:00.000Z');
    return { date: d.toISOString(), matched: isoMatch[0] };
  }

  // No date found
  return { date: today.toISOString(), matched: null };
}

/**
 * Main parser. Supports both old and new format:
 *   Old: "food 150"                   → category only, no subcategory
 *   New: "food/snacks 150 hdfc note"  → category + subcategory + account + note
 *   Income: "income 45000 hdfc salary"
 *
 * @param {string} rawText
 * @returns {{
 *   type: string, amount: number|null, category: string|null,
 *   subcategory: string|null, account: string|null, note: string|null,
 *   date: string, isValid: boolean, errorMessage: string|null, warnings: string[]
 * }}
 */
function parseMessage(rawText) {
  const result = {
    type: 'expense',
    amount: null,
    category: null,
    subcategory: null,
    account: null,
    note: null,
    date: new Date().toISOString(),
    isValid: false,
    errorMessage: null,
    warnings: [],
  };

  if (!rawText || rawText.trim().length === 0) {
    result.errorMessage = '❌ Empty message.\n\nFormat: food 150 your note';
    return result;
  }

  let text = rawText.trim();

  // ── STEP 1 — Detect income prefix ──────────────────────────────────────────
  if (/^(income|inc)\s+/i.test(text)) {
    result.type = 'income';
    text = text.replace(/^(income|inc)\s+/i, '').trim();
  }

  // ── STEP 2 — Extract date override ─────────────────────────────────────────
  const { date, matched: dateStr } = extractDate(text);
  result.date = date;
  if (dateStr) {
    text = text.replace(dateStr, '').replace(/\s+/g, ' ').trim();
  }

  // ── STEP 3 — Detect slash separator ────────────────────────────────────────
  // Any remaining slash after date removal is the category/subcategory slash.
  // The DD/MM date token was already stripped in STEP 2 above, so this is safe.
  const slashIndex = text.indexOf('/');
  const hasSlash = slashIndex !== -1;

  let categoryPart   = null;  // text before '/'
  let restAfterSlash = text;  // text starting from after '/' (or full text if no slash)

  if (hasSlash) {
    categoryPart   = text.substring(0, slashIndex).trim();
    restAfterSlash = text.substring(slashIndex + 1).trim();
  }

  // ── STEP 4 — Extract amount from restAfterSlash ─────────────────────────
  // Supports: 150  1500  1,500  150.50  1,50,000
  const amountRegex = /\b(\d{1,3}(?:,\d{2,3})*(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)\b/;
  const amountMatch = restAfterSlash.match(amountRegex);

  if (!amountMatch) {
    result.errorMessage =
      '❌ No amount found.\n\n' +
      'Format: category/subcategory amount\n' +
      'Example: food/snacks 150';
    return result;
  }

  const amountValue = parseFloat(amountMatch[0].replace(/,/g, ''));
  if (isNaN(amountValue) || amountValue <= 0) {
    result.errorMessage = '❌ Amount must be greater than 0.';
    return result;
  }
  result.amount = amountValue;

  // Split restAfterSlash around the amount
  const amountPos   = restAfterSlash.indexOf(amountMatch[0]);
  const beforeAmount = restAfterSlash.substring(0, amountPos).trim();          // subcategory token (slash format) OR category token (old format)
  const afterAmount  = restAfterSlash.substring(amountPos + amountMatch[0].length).trim(); // account + note

  // ── STEP 5 — Resolve category and subcategory ────────────────────────────
  if (hasSlash) {
    // NEW FORMAT: categoryPart/[beforeAmount] amount [afterAmount]
    result.category = matchCategory(categoryPart);

    if (result.category === 'Others' && categoryPart) {
      result.warnings.push(`⚠️ '${categoryPart}' is not a recognised category. Saved as Others.`);
    }

    if (beforeAmount) {
      result.subcategory = matchSubcategory(result.category, beforeAmount);
      if (result.subcategory === null) {
        result.warnings.push(
          `⚠️ '${beforeAmount}' is not a recognised subcategory of ${result.category}.`
        );
      }
    }
    // If nothing between '/' and the amount → subcategory stays null, no warning needed

  } else {
    // OLD FORMAT: [beforeAmount] amount [afterAmount]
    // beforeAmount is the entire category token; no subcategory
    result.category = matchCategory(beforeAmount);
    result.subcategory = null;
  }

  // ── STEP 6 — Extract account from afterAmount ────────────────────────────
  const words     = afterAmount ? afterAmount.split(/\s+/) : [];
  const firstWord = words[0] ? words[0].toLowerCase() : '';

  if (ACCOUNT_ALIASES[firstWord]) {
    result.account = ACCOUNT_ALIASES[firstWord];       // e.g. 'HDFC'
    result.note    = words.slice(1).join(' ') || null;
  } else {
    result.account = null;                             // app will use its default account
    result.note    = afterAmount || null;
  }

  // ── STEP 7 — Income override ─────────────────────────────────────────────
  // Income transactions: category is always 'Income'; no subcategory.
  // Account and note resolution (done above) still applies.
  if (result.type === 'income') {
    result.category    = 'Income';
    result.subcategory = null;
  }

  // ── STEP 8 — Validate and return ─────────────────────────────────────────
  result.isValid = true;
  return result;
}

module.exports = { parseMessage, extractDate };
