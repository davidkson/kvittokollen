/**
 * Receipt parser for Swedish Willys receipts
 * Extracts items, prices, metadata using regex patterns
 */

const { parseSwedishNumber, parseReceiptDate, cleanItemName } = require('./utils.cjs');

/**
 * Parse a single item line from receipt text
 * Handles multiple formats:
 * - Simple: "GURKA IMPORT 19,90"
 * - Weight: "NÖTFÄRS 12%\n 0,899kg*149,00kr/kg 133,95"
 * - Quantity: "MELLANMJÖLK 1L 2st*13,90 27,80"
 * - Discount: "Rabatt:BRÖD -6,00"
 */
function parseItemLine(line) {
  line = line.trim();
  if (!line) return null;

  // Skip non-item lines (metadata, headers, payment info, etc.)
  if (line.match(/^(Totalt|SUMMA|DEBIT|CREDIT|SWISH|Kvitto|Butik|Datum|Willys Plus|Ordernummer|Ditt ordernummer|Terminal|Ref:|Mottaget|Kontaktlös|Med Willys|Tfn:|Org:|Start|Slut|Självscanning|========|----------|Kundvagn|Auth|Du sparar|sparar totalt|Saldo|Återbetalas|ATT BETALA|Öresutjämning|KÖPT|VAROR|Kortnummer|Org\.|nr\.|Välkommen|Moms|varav moms|Kvittots|nummer)/i)) {
    return null;
  }

  // Skip lines that look like reference numbers, timestamps, or IDs (very large numbers > 100000)
  if (line.match(/^\S+:?\s+\d{7,}$/)) {
    return null;
  }

  // Skip lines with multiple space-separated numbers (VAT calculations, totals, etc.)
  // e.g., "12,00 196,32 1635,88" or "12,00 189,95 1583,04"
  if (line.match(/^\d+[,\.]\d+\s+\d+[,\.]\d+\s+\d+[,\.]\d+/)) {
    return null;
  }

  // Skip lines that are just a single large number (prices without item names)
  if (line.match(/^[\d\s,.]+$/)) {
    return null;
  }

  // Discount line: "Rabatt:BRÖD -6,00"
  const discountMatch = line.match(/^Rabatt:(.+?)\s+([-\d,]+)$/i);
  if (discountMatch) {
    return {
      name: cleanItemName(discountMatch[1]),
      quantity: 1,
      unitPrice: parseSwedishNumber(discountMatch[2]),
      totalPrice: parseSwedishNumber(discountMatch[2]),
      isDiscount: true
    };
  }

  // Deposit/Pant: "+PANT ENG PET >1L 2,00"
  const pantMatch = line.match(/^\+?PANT\s+(.+?)\s+([\d,]+)$/i);
  if (pantMatch) {
    return {
      name: cleanItemName('PANT ' + pantMatch[1]),
      quantity: 1,
      unitPrice: parseSwedishNumber(pantMatch[2]),
      totalPrice: parseSwedishNumber(pantMatch[2]),
      isPant: true
    };
  }

  // Quantity format: "MELLANMJÖLK 1L 2st*13,90 27,80"
  const qtyMatch = line.match(/^(.+?)\s+(\d+)st\*?([\d,]+)\s+([\d,]+)$/i);
  if (qtyMatch) {
    return {
      name: cleanItemName(qtyMatch[1]),
      quantity: parseInt(qtyMatch[2]),
      unitPrice: parseSwedishNumber(qtyMatch[3]),
      totalPrice: parseSwedishNumber(qtyMatch[4])
    };
  }

  // Weight format: "NÖTFÄRS 12%" on one line, then "0,899kg*149,00kr/kg 133,95"
  // This needs special handling - look for weight on next line

  // Simple format: "GURKA IMPORT 19,90"
  const simpleMatch = line.match(/^(.+?)\s+([\d,]+)$/);
  if (simpleMatch) {
    const name = cleanItemName(simpleMatch[1]);
    const price = parseSwedishNumber(simpleMatch[2]);

    // Skip if this looks like a total line
    if (name.match(/^(Totalt|SUMMA|ATT BETALA)/i)) {
      return null;
    }

    return {
      name,
      quantity: 1,
      unitPrice: price,
      totalPrice: price
    };
  }

  return null;
}

/**
 * Parse weight-based items that span multiple lines
 * Example: "NÖTFÄRS 12%\n 0,899kg*149,00kr/kg 133,95"
 */
function parseWeightItem(nameLine, weightLine) {
  const weightMatch = weightLine.match(/([\d,]+)kg\s*\*\s*([\d,]+)kr\/kg\s+([\d,]+)/);
  if (weightMatch) {
    return {
      name: cleanItemName(nameLine),
      quantity: parseSwedishNumber(weightMatch[1]),
      unit: 'kg',
      unitPrice: parseSwedishNumber(weightMatch[2]),
      totalPrice: parseSwedishNumber(weightMatch[3])
    };
  }
  return null;
}

/**
 * Extract receipt metadata (store, date, total, etc.)
 */
function extractMetadata(text) {
  const metadata = {};

  // Store name - look for "Willys Marieberg" etc
  const storeMatch = text.match(/Willys\s+([^\n]+)/i);
  if (storeMatch) {
    metadata.store = cleanItemName(storeMatch[1]);
  }

  // Check if e-commerce receipt
  metadata.isEcommerce = text.includes('E-HANDEL') || text.includes('e-handel');

  // Date/time: "2026-01-30 16:50:48"
  const dateMatch = text.match(/(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})/);
  if (dateMatch) {
    metadata.date = parseReceiptDate(dateMatch[1]);
  }

  // Total items: "Totalt 29 varor"
  const itemsMatch = text.match(/Totalt\s+(\d+)\s+varor/i);
  if (itemsMatch) {
    metadata.totalItems = parseInt(itemsMatch[1]);
  }

  // Grand total: "Totalt 779,42 SEK" or "ATT BETALA 779,42"
  const totalMatch = text.match(/(?:Totalt|ATT BETALA)\s+([\d\s,]+)\s*(?:SEK|kr)?/i);
  if (totalMatch) {
    metadata.grandTotal = parseSwedishNumber(totalMatch[1]);
  }

  // Payment method
  if (text.match(/DEBIT\s+MASTERCARD/i)) {
    metadata.paymentMethod = 'Debit Card';
  } else if (text.match(/CREDIT/i)) {
    metadata.paymentMethod = 'Credit Card';
  } else if (text.match(/SWISH/i)) {
    metadata.paymentMethod = 'Swish';
  }

  return metadata;
}

/**
 * Parse complete receipt text into structured data
 */
function parseReceipt(text, filename) {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l);
  const items = [];
  const metadata = extractMetadata(text);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const nextLine = i + 1 < lines.length ? lines[i + 1] : '';

    // Check for weight-based items (name on one line, weight on next)
    if (nextLine.match(/[\d,]+kg\s*\*/)) {
      const weightItem = parseWeightItem(line, nextLine);
      if (weightItem) {
        items.push(weightItem);
        i++; // Skip next line since we processed it
        continue;
      }
    }

    // Try to parse as regular item
    const item = parseItemLine(line);
    if (item) {
      items.push(item);
    }
  }

  return {
    filename,
    metadata,
    items,
    itemCount: items.length
  };
}

/**
 * Parse all extracted receipts
 */
function parseAllReceipts(extractedReceipts) {
  const parsed = [];
  const warnings = [];

  console.log(`Parsing ${extractedReceipts.length} receipts...`);

  for (const receipt of extractedReceipts) {
    try {
      const parsedReceipt = parseReceipt(receipt.text, receipt.filename);

      // Warn if no items found
      if (parsedReceipt.items.length === 0) {
        warnings.push({
          filename: receipt.filename,
          warning: 'No items parsed from receipt'
        });
      }

      parsed.push(parsedReceipt);
    } catch (error) {
      warnings.push({
        filename: receipt.filename,
        error: error.message
      });
    }
  }

  console.log(`✓ Parsed ${parsed.length} receipts`);
  if (warnings.length > 0) {
    console.log(`⚠ ${warnings.length} warnings`);
  }

  return { parsed, warnings };
}

module.exports = {
  parseReceipt,
  parseAllReceipts,
  parseItemLine
};
