const { CATEGORY_MAP, matchCategory } = require('./parser');

/**
 * Format the full category list for display in /categories command.
 * @param {string[]} userCategories - synced from the user's app
 * @returns {string}
 */
function formatCategoryList(userCategories = []) {
  const lines = ['📋 *Category Keywords*\n'];

  const grouped = {};
  for (const [keyword, category] of Object.entries(CATEGORY_MAP)) {
    if (!grouped[category]) grouped[category] = [];
    grouped[category].push(keyword);
  }

  for (const [category, keywords] of Object.entries(grouped)) {
    lines.push(`*${category}*`);
    lines.push(keywords.slice(0, 6).join(', '));
    lines.push('');
  }

  if (userCategories.length > 0) {
    lines.push('*Your Custom Categories*');
    lines.push(userCategories.join(', '));
  }

  return lines.join('\n');
}

module.exports = { CATEGORY_MAP, matchCategory, formatCategoryList };
