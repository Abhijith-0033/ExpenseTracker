'use strict';

/**
 * Maps casual user text → standardized category names.
 * These should match the user's app categories.
 * The app syncs its real category list to the server on connect.
 */
const CATEGORY_MAP = {
  // Food & Dining
  'food': 'Food', 'eat': 'Food', 'eating': 'Food', 'lunch': 'Food',
  'dinner': 'Food', 'breakfast': 'Food', 'snack': 'Food', 'coffee': 'Food',
  'cafe': 'Food', 'restaurant': 'Food', 'swiggy': 'Food', 'zomato': 'Food',
  'biryani': 'Food', 'pizza': 'Food', 'burger': 'Food',

  // Transport
  'transport': 'Transport', 'travel': 'Transport', 'bus': 'Transport',
  'auto': 'Transport', 'cab': 'Transport', 'uber': 'Transport', 'ola': 'Transport',
  'petrol': 'Transport', 'fuel': 'Transport', 'train': 'Transport',
  'metro': 'Transport', 'bike': 'Transport', 'taxi': 'Transport',
  'rickshaw': 'Transport',

  // Shopping
  'shopping': 'Shopping', 'shop': 'Shopping', 'clothes': 'Shopping',
  'amazon': 'Shopping', 'flipkart': 'Shopping', 'myntra': 'Shopping',
  'fashion': 'Shopping', 'shoes': 'Shopping',

  // Bills & Utilities (maps to Housing in default app categories)
  'bill': 'Housing', 'bills': 'Housing', 'electricity': 'Housing',
  'water': 'Housing', 'internet': 'Housing', 'wifi': 'Housing',
  'phone': 'Housing', 'recharge': 'Housing', 'mobile': 'Housing',
  'rent': 'Housing', 'maintenance': 'Housing',

  // Entertainment
  'entertainment': 'Entertainment', 'movie': 'Entertainment',
  'movies': 'Entertainment', 'netflix': 'Entertainment',
  'spotify': 'Entertainment', 'game': 'Entertainment', 'games': 'Entertainment',
  'cinema': 'Entertainment', 'theatre': 'Entertainment',

  // Health
  'medical': 'Housing', 'medicine': 'Housing', 'doctor': 'Housing',
  'hospital': 'Housing', 'pharmacy': 'Housing', 'health': 'Housing',

  // Education
  'education': 'Housing', 'book': 'Housing', 'books': 'Housing',
  'course': 'Housing', 'fees': 'Housing', 'tuition': 'Housing',

  // Grocery (maps to Food in default app)
  'grocery': 'Food', 'groceries': 'Food', 'vegetables': 'Food',
  'milk': 'Food', 'fruits': 'Food', 'market': 'Food',

  // Subscriptions
  'subscription': 'Subscription', 'sub': 'Subscription',

  // Income
  'salary': 'Income', 'freelance': 'Income', 'investment': 'Income',
  'dividend': 'Income', 'bonus': 'Income',

  // Other / Misc
  'other': 'Other', 'misc': 'Other', 'miscellaneous': 'Other',
};

/**
 * Match a text word to a category name.
 * @param {string} text
 * @param {string[]} [userCategories] - synced from app (optional)
 * @returns {string}
 */
function matchCategory(text, userCategories = []) {
  const lower = text.trim().toLowerCase();
  if (!lower) return 'Other';

  // Direct map lookup
  if (CATEGORY_MAP[lower]) return CATEGORY_MAP[lower];

  // Partial: check if text contains any map key
  for (const [key, value] of Object.entries(CATEGORY_MAP)) {
    if (lower.includes(key)) return value;
  }

  // Check against user's actual category names (case-insensitive)
  for (const cat of userCategories) {
    if (lower.includes(cat.toLowerCase()) || cat.toLowerCase().includes(lower)) {
      return cat;
    }
  }

  return 'Other';
}

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
 * Main parser function.
 * @param {string} rawText
 * @param {string[]} [userCategories]
 * @returns {{ type, amount, category, note, date, isValid, errorMessage }}
 */
function parseMessage(rawText, userCategories = []) {
  const result = {
    type: 'expense',
    amount: null,
    category: null,
    note: null,
    date: new Date().toISOString(),
    isValid: false,
    errorMessage: null,
  };

  if (!rawText || rawText.trim().length === 0) {
    result.errorMessage = '❌ Empty message.\n\nFormat: food 150 your note';
    return result;
  }

  let text = rawText.trim();

  // STEP 1 — Check for income prefix
  if (/^(income|inc)\s+/i.test(text)) {
    result.type = 'income';
    text = text.replace(/^(income|inc)\s+/i, '').trim();
  }

  // STEP 2 — Extract date if present
  const { date, matched: dateStr } = extractDate(text);
  result.date = date;
  if (dateStr) {
    text = text.replace(dateStr, '').replace(/\s+/g, ' ').trim();
  }

  // STEP 3 — Find amount (first number, supports commas like 1,500)
  const amountRegex = /\b(\d{1,3}(?:,\d{3})*(?:\.\d+)?|\d+(?:\.\d+)?)\b/;
  const amountMatch = text.match(amountRegex);

  if (!amountMatch) {
    result.errorMessage =
      '❌ Could not find a valid amount.\n\nFormat: food 150\nor: food 150 lunch with team';
    return result;
  }

  const amountStr = amountMatch[0].replace(/,/g, '');
  result.amount = parseFloat(amountStr);

  if (isNaN(result.amount) || result.amount <= 0) {
    result.errorMessage = '❌ Amount must be a positive number.';
    return result;
  }

  // STEP 4 — Split text around the amount position
  const amountIndex = text.indexOf(amountMatch[0]);
  const beforeAmount = text.substring(0, amountIndex).trim();
  const afterAmount = text.substring(amountIndex + amountMatch[0].length).trim();

  // Category is the word(s) before the amount
  if (beforeAmount) {
    result.category = matchCategory(beforeAmount, userCategories);
  } else if (afterAmount) {
    // e.g. "150 food" — amount first, then category
    // Try matching the first word of afterAmount as category
    const firstWord = afterAmount.split(/\s+/)[0];
    const mapped = matchCategory(firstWord, userCategories);
    if (mapped !== 'Other') {
      result.category = mapped;
      const rest = afterAmount.replace(firstWord, '').trim();
      result.note = rest || null;
    } else {
      result.category = 'Other';
      result.note = afterAmount || null;
    }
  } else {
    // Only amount, no category
    result.category = result.type === 'income' ? 'Income' : 'Other';
  }

  // Note is text after the amount (if category was before)
  if (beforeAmount && afterAmount) {
    result.note = afterAmount || null;
  }

  // Income type: force category to 'Income'
  if (result.type === 'income') {
    result.category = 'Income';
    // The note can include whatever was before/after
    const combined = [beforeAmount, afterAmount].filter(Boolean).join(' ').trim();
    result.note = combined || null;
  }

  // STEP 5 — Validate
  result.isValid = true;
  return result;
}

module.exports = { parseMessage, matchCategory, CATEGORY_MAP };
