/**
 * Parser for ICA receipts (PDF text from Kivra).
 *
 * Pure functions: text in, data out. No file or PDF access here, so the
 * parser can be unit tested with plain strings. Used by
 * scripts/update-ica.cjs and reports/analyze-ica.cjs.
 */

const { categorizeItem } = require('./categorizer.cjs');

/**
 * Parse date from ICA receipt text
 */
function extractDate(text) {
  // First valid YYYY-MM-DD; skip things that only look like dates (e.g. "9999-99-99").
  for (const match of text.matchAll(/(?<!\d)(\d{4}-\d{2}-\d{2})(?!\d)/g)) {
    const date = new Date(match[1]);
    if (!Number.isNaN(date.getTime()) && date.toISOString().startsWith(match[1])) {
      return date.toISOString();
    }
  }
  return null;
}

/**
 * Extract store name from ICA receipt
 */
function extractStore(text) {
  // "ICA" must start a word, so "Erica 3" (cashier name) is not taken as the store.
  const storeMatch = text.match(/(?<!\p{L})(Maxi ICA [^\n]+|ICA [^\n]+)/iu);
  if (storeMatch) {
    return storeMatch[1].trim().split('\n')[0];
  }
  return 'ICA';
}

/**
 * Parse items from ICA receipt
 */
function parseItems(text) {
  const items = [];
  const lines = text.split('\n');
  let inItemSection = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    if (line.includes('Beskrivning') && line.includes('Artikelnummer')) {
      inItemSection = true;
      continue;
    }

    if (inItemSection && (line.includes('Betalat') || line.includes('Moms %'))) {
      break;
    }

    if (!inItemSection || !line) continue;

    // Check if this is a discounted item (starts with *)
    const isDiscounted = line.startsWith('*');

    // Match item line
    const itemMatch = line.match(/^(\*)?(.+?)\s+(\d{7,})\s+([\d,\.]+)\s+([\d,\.]+)\s+(st|kg|l|m|g|ml|cl|fp|hg|dl|förp)?\s*([\d,\.\-]+)$/);

    if (itemMatch) {
      const name = itemMatch[2].trim();
      const unitPrice = parseFloat(itemMatch[4].replace(',', '.'));
      const quantity = parseFloat(itemMatch[5].replace(',', '.'));
      const originalPrice = parseFloat(itemMatch[7].replace(',', '.'));

      let finalPrice = originalPrice;
      let discount = 0;

      // If discounted, check next line for discount amount
      if (isDiscounted && i + 1 < lines.length) {
        const nextLine = lines[i + 1].trim();
        // A discount line has a negative amount and no article number;
        // anything else is the next product and must not be swallowed.
        const discountMatch = /\d{7,}/.test(nextLine)
          ? null
          : nextLine.match(/^(.+?)\s+(-[\d,\.]+)$/);

        if (discountMatch) {
          discount = parseFloat(discountMatch[2].replace(',', '.'));
          finalPrice = originalPrice + discount; // discount is negative
          i++; // Skip next line since we've processed it
        }
      }

      items.push({
        name: name,
        quantity: quantity,
        unitPrice: finalPrice / quantity,
        totalPrice: finalPrice,
        originalPrice: isDiscounted ? originalPrice : undefined,
        discount: isDiscounted ? Math.abs(discount) : undefined,
        category: categorizeItem(name, { price: finalPrice / quantity })
      });
    }
    // Handle standalone discount lines (pant, etc)
    else if (line.includes('-') && line.match(/([\d,\.]+)$/) && !line.match(/\d{7,}/)) {
      const discountMatch = line.match(/^(.+?)\s+([\-\d,\.]+)$/);
      if (discountMatch) {
        const name = discountMatch[1].trim();
        const totalPrice = parseFloat(discountMatch[2].replace(',', '.'));

        // Only add if it's truly a standalone discount (not part of a product)
        if (totalPrice < 0 && !line.match(/\d{7,}/)) {
          items.push({
            name: name,
            quantity: 1,
            unitPrice: totalPrice,
            totalPrice: totalPrice,
            isDiscount: true,
            category: 'Discounts & Offers'
          });
        }
      }
    }
  }

  return items;
}

/**
 * Calculate grand total from items
 */
function calculateGrandTotal(items) {
  return items.reduce((sum, item) => sum + item.totalPrice, 0);
}


/**
 * Parse a full ICA receipt text into the structure stored in ica-analysis.json.
 * Returns null if no items were found.
 */
function parseIcaReceipt(text, filename) {
  const items = parseItems(text);
  if (items.length === 0) return null;

  return {
    filename,
    metadata: {
      store: extractStore(text),
      isEcommerce: false,
      date: extractDate(text),
      totalItems: items.length,
      grandTotal: calculateGrandTotal(items),
    },
    items,
    itemCount: items.length,
  };
}

module.exports = {
  parseIcaReceipt,
  parseItems,
  extractDate,
  extractStore,
  calculateGrandTotal,
};
