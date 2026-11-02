/**
 * Shared data access and domain rules for receipt analysis.
 *
 * Everything that used to be copy-pasted between reports lives here:
 * loading the analysis JSON (independent of the current directory),
 * correct receipt totals per store, and the product matchers from CLAUDE.md.
 *
 * Set KVITTO_OUTPUT_DIR to read analysis files from another directory
 * (used by tests and fixtures).
 */

const fs = require('fs');
const path = require('path');
const { isCatFood, isLikelyCatFood, CAT_FOOD_PATTERN } = require('./categorizer.cjs');

// --- Loading ---------------------------------------------------------------

function outputDir() {
  return process.env.KVITTO_OUTPUT_DIR || path.join(__dirname, '..', 'output');
}

function loadAnalysis(store) {
  if (store !== 'willys' && store !== 'ica') {
    throw new Error(`Unknown store "${store}", expected "willys" or "ica"`);
  }
  const file = path.join(outputDir(), `${store}-analysis.json`);
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

const loadWillys = () => loadAnalysis('willys');
const loadIca = () => loadAnalysis('ica');

// --- Totals ----------------------------------------------------------------

function sumItems(receipt) {
  if (!receipt || !Array.isArray(receipt.items)) return 0;
  return receipt.items.reduce((sum, item) => sum + (item.totalPrice || 0), 0);
}

/**
 * Willys: metadata.grandTotal is WRONG (holds the item count).
 * The paid amount is the sum of all item rows, including negative discount rows.
 */
function calculateTotal(receipt) {
  return sumItems(receipt);
}

/**
 * ICA: metadata.grandTotal is correct (already includes discounts).
 * Falls back to summing items if it is missing.
 */
function icaTotal(receipt) {
  const grandTotal = receipt && receipt.metadata && receipt.metadata.grandTotal;
  if (typeof grandTotal === 'number' && !Number.isNaN(grandTotal)) return grandTotal;
  return sumItems(receipt);
}

/** Correct paid total for a receipt from either store. */
function receiptTotal(receipt, store) {
  if (store === 'willys') return calculateTotal(receipt);
  if (store === 'ica') return icaTotal(receipt);
  throw new Error(`Unknown store "${store}", expected "willys" or "ica"`);
}

/**
 * "2025-05-02T07:36:31.000Z" -> "2025-05" (null if no date).
 * Accepts both the ISO string stored in the JSON files and a Date object
 * (freshly parsed Willys receipts); both are read in UTC so they agree.
 */
function monthKey(receipt) {
  const date = receipt && receipt.metadata && receipt.metadata.date;
  if (!date) return null;
  if (date instanceof Date) {
    return Number.isNaN(date.getTime()) ? null : date.toISOString().substring(0, 7);
  }
  return String(date).substring(0, 7);
}

// --- Product matchers (see CLAUDE.md) --------------------------------------

const MILK_PATTERN = /mjölk/i;
// Never count chocolate etc. as milk.
const MILK_EXCLUDE_PATTERN = /choklad|helnöt|daim|katt|kex|cookie|snickers|twix|mars|bounty/i;

function isMilk(name) {
  return Boolean(name) && MILK_PATTERN.test(name) && !MILK_EXCLUDE_PATTERN.test(name);
}

const COKE_ZERO_PATTERN = /coca.{0,5}cola.{0,10}zero|cola.{0,5}zero|coke.{0,5}zero|koffeinfri.{0,5}zero/i;

function isCokeZero(name) {
  return Boolean(name) && COKE_ZERO_PATTERN.test(name);
}

module.exports = {
  outputDir,
  loadAnalysis,
  loadWillys,
  loadIca,
  sumItems,
  calculateTotal,
  icaTotal,
  receiptTotal,
  monthKey,
  MILK_PATTERN,
  MILK_EXCLUDE_PATTERN,
  isMilk,
  COKE_ZERO_PATTERN,
  isCokeZero,
  CAT_FOOD_PATTERN,
  isCatFood,
  isLikelyCatFood,
};
