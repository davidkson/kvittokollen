#!/usr/bin/env node

/**
 * ICA Receipt Analysis
 * Analyzes ICA receipts and outputs same structure as Willys analysis
 */

const fs = require('fs');
const path = require('path');
const { PDFParse } = require('pdf-parse');
const { parseItems, extractDate, extractStore, calculateGrandTotal } = require('../lib/ica-parser.cjs');
const { outputDir } = require('../lib/data.cjs');

// Configuration
const ICA_RECEIPTS_META = path.join(__dirname, '../receipts/ica/ica-receipts.json');
const RECEIPTS_DIR = path.join(__dirname, '../receipts/ica');
const OUTPUT_FILE = path.join(outputDir(), 'ica-analysis.json');

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
