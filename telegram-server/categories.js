'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// TOP-LEVEL CATEGORY ALIASES
// Maps user shorthand → canonical category name (must match app exactly)
// ─────────────────────────────────────────────────────────────────────────────
const CATEGORY_ALIASES = {
  'food': 'Food',             'f': 'Food',
  'transport': 'Transport',   'trans': 'Transport',     'tr': 'Transport',
  'entertainment': 'Entertainment', 'ent': 'Entertainment', 'fun': 'Entertainment',
  'internship': 'Internship', 'intern': 'Internship',   'int': 'Internship',
  'college': 'College fuel split', 'cfs': 'College fuel split',
    'fuelsplit': 'College fuel split',
  'home': 'Home',             'h': 'Home',
  'health': 'Health',         'med': 'Health',
  'others': 'Others',         'other': 'Others',        'misc': 'Others',
  'phone': 'Phone',           'ph': 'Phone',
  'shopping': 'Shopping',     'shop': 'Shopping',       'sh': 'Shopping',
  'education': 'Education',   'edu': 'Education',       'ed': 'Education',
  'beauty': 'Beauty',         'bty': 'Beauty',
  'placement': 'Placement',   'place': 'Placement',     'pl': 'Placement',
  'subscription': 'Subscription', 'sub': 'Subscription', 'subs': 'Subscription',
  'parents': 'Parents',       'parent': 'Parents',      'par': 'Parents',
    'mom': 'Parents',         'dad': 'Parents',
  'job': 'Job (evo7)',        'evo7': 'Job (evo7)',      'work': 'Job (evo7)',
    'evo': 'Job (evo7)',
};

// ─────────────────────────────────────────────────────────────────────────────
// SUBCATEGORY ALIASES  (keyed by canonical category name)
// ─────────────────────────────────────────────────────────────────────────────
const SUBCATEGORY_ALIASES = {
  'Food': {
    'snacks': 'Snacks',       'snack': 'Snacks',        's': 'Snacks',
    'heavy': 'Heavy food',    'heavyfood': 'Heavy food', 'hf': 'Heavy food',
      'lunch': 'Heavy food',  'dinner': 'Heavy food',   'meal': 'Heavy food',
      'rice': 'Heavy food',   'biriyani': 'Heavy food',
    'juice': 'Juice',         'j': 'Juice',
    'tea': 'Tea or coffee',   'coffee': 'Tea or coffee', 'tc': 'Tea or coffee',
      'chai': 'Tea or coffee', 'teaorcoffee': 'Tea or coffee',
    'sweets': 'Sweets',       'sweet': 'Sweets',         'mithai': 'Sweets',
  },
  'Transport': {
    'fuel': 'Fuel',           'petrol': 'Fuel',          'gas': 'Fuel',
      'diesel': 'Fuel',
    'public': 'Public Transport', 'bus': 'Public Transport',
      'auto': 'Public Transport', 'metro': 'Public Transport',
      'train': 'Public Transport', 'pt': 'Public Transport',
      'rickshaw': 'Public Transport',
  },
  'Entertainment': {
    'movies': 'Movies',       'movie': 'Movies',         'film': 'Movies',
      'cinema': 'Movies',
    'hangout': 'Hangouts with friends', 'friends': 'Hangouts with friends',
      'outing': 'Hangouts with friends', 'hangouts': 'Hangouts with friends',
      'ho': 'Hangouts with friends',
  },
  'Internship': {
    'busfair': 'Bus fair',    'bus': 'Bus fair',         'bf': 'Bus fair',
    'carfuel': 'Car Fuel',    'car': 'Car Fuel',         'cf': 'Car Fuel',
    'food': 'Food',           'f': 'Food',
    'snacks': 'Snacks',       'snack': 'Snacks',
  },
  'Home': {
    'accessories': 'Accessories', 'acc': 'Accessories',
  },
  'Health': {
    'hospital': 'Hospital',   'hosp': 'Hospital',
    'medicine': 'Medicine',   'meds': 'Medicine',        'tablet': 'Medicine',
      'tablets': 'Medicine',
    'test': 'Test',           'tests': 'Test',            'lab': 'Test',
  },
  'Phone': {
    'recharge': 'Recharge',   'rech': 'Recharge',        'rc': 'Recharge',
      'sim': 'Recharge',
    'data': 'Data recharge',  'datarecharge': 'Data recharge',
      'dr': 'Data recharge',  'net': 'Data recharge',
  },
  'Shopping': {
    'clothes': 'Clothes',     'clothing': 'Clothes',     'cl': 'Clothes',
      'shirt': 'Clothes',
    'accessories': 'Accessories', 'acc': 'Accessories',
    'dairy': 'Dairy',         'milk': 'Dairy',           'curd': 'Dairy',
    'footwear': 'Footwear',   'shoes': 'Footwear',       'foot': 'Footwear',
      'sandals': 'Footwear',  'fw': 'Footwear',
  },
  'Education': {
    'print': 'Print',         'printing': 'Print',       'xerox': 'Print',
    'fees': 'Fees',           'fee': 'Fees',
    'project': 'Project',     'proj': 'Project',
    'celebrations': 'Celebrations', 'celebrate': 'Celebrations',
      'cel': 'Celebrations',
  },
  'Beauty': {
    'haircut': 'Haircut',     'hair': 'Haircut',         'hc': 'Haircut',
      'salon': 'Haircut',
  },
  'Placement': {
    'travel': 'Travel',       'tr': 'Travel',            'trip': 'Travel',
    'food': 'Food',           'f': 'Food',
  },
  'Subscription': {
    'streaming': 'Streaming', 'stream': 'Streaming',     'netflix': 'Streaming',
      'hotstar': 'Streaming', 'prime': 'Streaming',
    'cloud': 'Cloud Storage', 'storage': 'Cloud Storage', 'gdrive': 'Cloud Storage',
      'cs': 'Cloud Storage',
    'music': 'Music',         'spotify': 'Music',        'msc': 'Music',
    'software': 'Software',   'soft': 'Software',        'sw': 'Software',
    'gaming': 'Gaming',       'game': 'Gaming',          'gm': 'Gaming',
      'steam': 'Gaming',
    'other': 'Other',         'misc': 'Other',
  },
  'Job (evo7)': {
    'busfair': 'Bus fair',    'bus': 'Bus fair',         'bf': 'Bus fair',
    'food': 'Food',           'f': 'Food',
    'snacks': 'Snacks or drinks', 'drinks': 'Snacks or drinks',
      'sd': 'Snacks or drinks', 'snacksordrinks': 'Snacks or drinks',
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// matchCategory(text) → canonical category name string
// ─────────────────────────────────────────────────────────────────────────────
function matchCategory(text) {
  if (!text || !text.trim()) return 'Others';
  const t = text.trim().toLowerCase().replace(/\s+/g, '');

  // 1. Exact alias hit
  if (CATEGORY_ALIASES[t]) return CATEGORY_ALIASES[t];

  // 2. Partial: alias key contained in input, or input contained in key
  for (const [key, value] of Object.entries(CATEGORY_ALIASES)) {
    if (t.includes(key) || key.includes(t)) return value;
  }

  return 'Others';
}

// ─────────────────────────────────────────────────────────────────────────────
// matchSubcategory(categoryName, text) → canonical subcategory string | null
// Returns null when unrecognised — caller adds a warning to the user.
// ─────────────────────────────────────────────────────────────────────────────
function matchSubcategory(categoryName, text) {
  if (!text || !text.trim()) return null;
  const map = SUBCATEGORY_ALIASES[categoryName];
  if (!map) return null;

  const t = text.trim().toLowerCase().replace(/\s+/g, '');

  // 1. Exact alias hit
  if (map[t]) return map[t];

  // 2. Partial match
  for (const [key, value] of Object.entries(map)) {
    if (t.includes(key) || key.includes(t)) return value;
  }

  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// formatCategoryList() → Markdown string for /categories command
// ─────────────────────────────────────────────────────────────────────────────
function formatCategoryList() {
  return (
    `📋 *Your Categories*\n\n` +
    `Format: \`category/subcategory amount account note\`\n\n` +
    `*food* (f)\n` +
    `  snacks · heavy · juice · tea · sweets\n\n` +
    `*transport* (tr)\n` +
    `  fuel · public\n\n` +
    `*health* (med)\n` +
    `  hospital · medicine · test\n\n` +
    `*phone* (ph)\n` +
    `  recharge · data\n\n` +
    `*shopping* (shop)\n` +
    `  clothes · accessories · dairy · footwear\n\n` +
    `*education* (edu)\n` +
    `  print · fees · project · celebrations\n\n` +
    `*internship* (intern)\n` +
    `  busfair · carfuel · food · snacks\n\n` +
    `*sub* (subscription)\n` +
    `  streaming · music · cloud · software · gaming\n\n` +
    `*job* (evo7, work)\n` +
    `  busfair · food · snacks\n\n` +
    `*entertainment* (ent)\n` +
    `  movies · hangout\n\n` +
    `*beauty* · *home* · *placement*\n` +
    `*college* · *parents* · *others*\n\n` +
    `*Examples:*\n` +
    `\`food/snacks 50\`\n` +
    `\`health/medicine 200 hdfc\`\n` +
    `\`sub/netflix 199 hdfc monthly\`\n` +
    `\`internship/busfair 35 cash\``
  );
}

module.exports = {
  CATEGORY_ALIASES,
  SUBCATEGORY_ALIASES,
  matchCategory,
  matchSubcategory,
  formatCategoryList,
};
