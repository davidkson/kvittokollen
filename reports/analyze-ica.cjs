#!/usr/bin/env node

/**
 * ICA Receipt Analysis
 * Analyzes ICA receipts and outputs same structure as Willys analysis
 */

const fs = require('fs');
const path = require('path');
const { PDFParse } = require('pdf-parse');

// Configuration
const ICA_RECEIPTS_META = './receipts/ica-receipts.json';
const RECEIPTS_DIR = './receipts';
const OUTPUT_FILE = '../output/ica-analysis.json';

/**
 * Extract text from PDF
 */
async function extractPdfText(pdfPath) {
  const dataBuffer = fs.readFileSync(pdfPath);
  const uint8Array = new Uint8Array(dataBuffer);
  const parser = new PDFParse(uint8Array);
  await parser.load();
  const result = await parser.getText();
  await parser.destroy();
  return result.text;
}

/**
 * Parse date from ICA receipt text
 */
function extractDate(text) {
  // Look for date in format: 2025-02-01
  const dateMatch = text.match(/(\d{4}-\d{2}-\d{2})/);
  if (dateMatch) {
    return new Date(dateMatch[1]).toISOString();
  }
  return null;
}

/**
 * Extract store name from ICA receipt
 */
function extractStore(text) {
  // Look for ICA store name (e.g., "Maxi ICA Stormarknad Kumla")
  const storeMatch = text.match(/(Maxi ICA [^\n]+|ICA [^\n]+)/i);
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

  // Find the start of items (after "Beskrivning Artikelnummer Pris Mängd Summa")
  let inItemSection = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Start of items section
    if (line.includes('Beskrivning') && line.includes('Artikelnummer')) {
      inItemSection = true;
      continue;
    }

    // End of items section
    if (inItemSection && (line.includes('Betalat') || line.includes('Moms %'))) {
      break;
    }

    if (!inItemSection || !line) continue;

    // Match item line: "Product name NNNNNN price qty unit total"
    // Example: "AXA F-müsli Guld 5701029160823 33,95 1,00 st 33,95"
    const itemMatch = line.match(/^(.+?)\s+(\d{10,})\s+([\d,\.]+)\s+([\d,\.]+)\s+(st|kg|l|m|g|ml|cl|fp|hg|dl|förp)?\s*([\d,\.\-]+)$/);

    if (itemMatch) {
      const name = itemMatch[1].trim();
      const unitPrice = parseFloat(itemMatch[3].replace(',', '.'));
      const quantity = parseFloat(itemMatch[4].replace(',', '.'));
      const totalPrice = parseFloat(itemMatch[6].replace(',', '.'));

      items.push({
        name: name,
        quantity: quantity,
        unitPrice: unitPrice,
        totalPrice: totalPrice,
        category: categorizeItem(name)
      });
    }
    // Handle discount lines (e.g., "Chokladkaka 3f79kr -19,85")
    else if (line.includes('-') && line.match(/([\d,\.]+)$/)) {
      const discountMatch = line.match(/^(.+?)\s+([\-\d,\.]+)$/);
      if (discountMatch) {
        const name = discountMatch[1].trim();
        const totalPrice = parseFloat(discountMatch[2].replace(',', '.'));

        items.push({
          name: name,
          quantity: 1,
          unitPrice: totalPrice,
          totalPrice: totalPrice,
          isDiscount: totalPrice < 0,
          category: 'Discounts & Offers'
        });
      }
    }
  }

  return items;
}

/**
 * Simple categorization based on product name
 */
function categorizeItem(name) {
  const nameLower = name.toLowerCase();

  // Dairy
  if (nameLower.match(/mjölk|yoghurt|fil|kvarg|grädde|smör|ost|mozzarella/)) {
    return 'Dairy';
  }

  // Meat & Protein
  if (nameLower.match(/kött|fläsk|korv|köttfärs|kalkon|kyckling|bacon|skinka|medaljong/)) {
    return 'Meat & Protein';
  }

  // Fruit & Vegetables
  if (nameLower.match(/banan|äpple|tomat|paprika|vitlök|champinjon|sallad|frukt|grönsak/)) {
    return 'Fruit & Vegetables';
  }

  // Beverages
  if (nameLower.match(/dryck|läsk|juice|vatten|kaffe|te\b|öl|vin|sprit/)) {
    return 'Beverages';
  }

  // Pantry Staples
  if (nameLower.match(/nudlar|pasta|ris|mjöl|socker|salt|kryddor|olja|sås|buljong|müsli|russin|vanilj/)) {
    return 'Pantry Staples';
  }

  // Frozen
  if (nameLower.match(/fryst|glass/)) {
    return 'Frozen Foods';
  }

  // Bakery & Sweets
  if (nameLower.match(/bröd|kaka|tårta|bulle|choklad|godis|daim|helnöt/)) {
    return 'Bakery & Sweets';
  }

  // Personal care
  if (nameLower.match(/deo|schampo|tvål|tandkräm|rakhyvel/)) {
    return 'Personal Care';
  }

  // Household
  if (nameLower.match(/disk|tvätt|papper|påse|miljökasse/)) {
    return 'Household';
  }

  // Clothing
  if (nameLower.match(/t-shirt|tröja|byxor|klänning|kläder/)) {
    return 'Clothing';
  }

  return 'Uncategorized';
}

/**
 * Calculate grand total from items
 */
function calculateGrandTotal(items) {
  return items.reduce((sum, item) => sum + item.totalPrice, 0);
}

/**
 * Parse a single ICA receipt
 */
async function parseICAReceipt(pdfPath, filename) {
  try {
    console.log(`   📄 ${filename}...`);

    const text = await extractPdfText(pdfPath);
    const items = parseItems(text);
    const date = extractDate(text);
    const store = extractStore(text);
    const grandTotal = calculateGrandTotal(items);

    if (items.length === 0) {
      console.log(`      ⚠️  Inga artiklar hittades`);
      return null;
    }

    console.log(`      ✅ ${items.length} artiklar, ${grandTotal.toFixed(2)} SEK`);

    return {
      filename: filename,
      metadata: {
        store: store,
        isEcommerce: false,
        date: date,
        totalItems: items.length,
        grandTotal: grandTotal
      },
      items: items,
      itemCount: items.length
    };
  } catch (error) {
    console.log(`      ❌ Fel: ${error.message}`);
    return null;
  }
}

/**
 * Main analysis
 */
async function main() {
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║              📊 ICA KVITTANALYS 📊                            ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  // Load metadata
  if (!fs.existsSync(ICA_RECEIPTS_META)) {
    console.log('❌ Ingen ICA-kvittofil hittades:', ICA_RECEIPTS_META);
    return;
  }

  const metadata = JSON.parse(fs.readFileSync(ICA_RECEIPTS_META, 'utf8'));
  console.log(`📥 Läser ${metadata.receipts.length} ICA-kvitton...\n`);

  const receipts = [];

  for (const receipt of metadata.receipts) {
    const pdfPath = path.join(RECEIPTS_DIR, receipt.fileName);

    if (!fs.existsSync(pdfPath)) {
      console.log(`   ⚠️  Fil saknas: ${receipt.fileName}`);
      continue;
    }

    const parsed = await parseICAReceipt(pdfPath, receipt.fileName);
    if (parsed) {
      receipts.push(parsed);
    }
  }

  console.log(`\n✅ Analyserade ${receipts.length} kvitton\n`);

  // Calculate summary statistics
  const totalSpending = receipts.reduce((sum, r) => sum + r.metadata.grandTotal, 0);
  const totalItems = receipts.reduce((sum, r) => sum + r.itemCount, 0);
  const averageBasket = receipts.length > 0 ? totalSpending / receipts.length : 0;

  // Build analysis object
  const analysis = {
    metadata: {
      generatedAt: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
      totalReceipts: receipts.length,
      totalSpending: totalSpending,
      totalItems: totalItems,
      averageBasket: averageBasket
    },
    receipts: receipts,
    analysis: {
      byCategory: {},
      byStore: {},
      topProducts: []
    }
  };

  // Category analysis
  const categoryTotals = {};
  const productCounts = {};

  for (const receipt of receipts) {
    for (const item of receipt.items) {
      // Category totals
      if (!categoryTotals[item.category]) {
        categoryTotals[item.category] = { count: 0, total: 0 };
      }
      categoryTotals[item.category].count += item.quantity;
      categoryTotals[item.category].total += item.totalPrice;

      // Product counts
      if (!productCounts[item.name]) {
        productCounts[item.name] = { count: 0, total: 0 };
      }
      productCounts[item.name].count += item.quantity;
      productCounts[item.name].total += item.totalPrice;
    }
  }

  analysis.analysis.byCategory = categoryTotals;

  // Top products
  const topProducts = Object.entries(productCounts)
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 20)
    .map(([name, data]) => ({
      name,
      count: data.count,
      totalSpent: data.total
    }));

  analysis.analysis.topProducts = topProducts;

  // Save to file
  const outputDir = path.dirname(OUTPUT_FILE);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(analysis, null, 2), 'utf8');

  console.log('═══════════════════════════════════════════════════════════════\n');
  console.log('📊 SAMMANFATTNING:\n');
  console.log(`   💰 Total kostnad: ${totalSpending.toFixed(2)} SEK`);
  console.log(`   🛒 Antal kvitton: ${receipts.length} st`);
  console.log(`   📦 Totalt artiklar: ${totalItems} st`);
  console.log(`   📊 Snitt per kvitto: ${averageBasket.toFixed(2)} SEK\n`);

  console.log('   TOP 5 KATEGORIER:\n');
  const topCategories = Object.entries(categoryTotals)
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 5);

  topCategories.forEach(([cat, data], idx) => {
    console.log(`   ${idx + 1}. ${cat}: ${data.total.toFixed(2)} SEK (${data.count.toFixed(0)} st)`);
  });

  console.log('\n═══════════════════════════════════════════════════════════════\n');
  console.log(`💾 Analys sparad: ${OUTPUT_FILE}\n`);
  console.log('✅ Analys klar!\n');
}

// Run
main().catch(error => {
  console.error('❌ Fel:', error);
  process.exit(1);
});
