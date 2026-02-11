/**
 * Utility functions for Swedish receipt parsing
 */

/**
 * Parse Swedish formatted numbers (uses comma as decimal separator)
 * Examples: "19,90" -> 19.90, "1 234,56" -> 1234.56
 */
function parseSwedishNumber(str) {
  if (!str) return null;

  // Remove spaces and replace comma with dot
  const cleaned = str.toString().replace(/\s/g, '').replace(',', '.');
  const parsed = parseFloat(cleaned);

  return isNaN(parsed) ? null : parsed;
}

/**
 * Parse Swedish date/time from receipt
 * Format: "2026-01-30 16:50:48"
 */
function parseReceiptDate(dateStr) {
  if (!dateStr) return null;

  try {
    const date = new Date(dateStr);
    return isNaN(date.getTime()) ? null : date;
  } catch (err) {
    return null;
  }
}

/**
 * Extract month/year from date for trend analysis
 */
function getMonthKey(date) {
  if (!date) return null;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Clean item name - remove extra whitespace, normalize
 */
function cleanItemName(name) {
  if (!name) return '';
  return name.trim().replace(/\s+/g, ' ');
}

/**
 * Format currency for display
 */
function formatSEK(amount) {
  return `${amount.toFixed(2)} SEK`;
}

/**
 * Format percentage for display
 */
function formatPercent(value) {
  return `${value.toFixed(1)}%`;
}

module.exports = {
  parseSwedishNumber,
  parseReceiptDate,
  getMonthKey,
  cleanItemName,
  formatSEK,
  formatPercent
};
