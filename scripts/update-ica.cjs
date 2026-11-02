#!/usr/bin/env node

/**
 * Incremental ICA Receipt Update Script
 * Only processes NEW receipts and updates the JSON file
 * Much faster than full re-analysis
 */

const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const { PDFParse } = require('pdf-parse');
const { parseItems, extractDate, extractStore, calculateGrandTotal } = require('../lib/ica-parser.cjs');
const { outputDir } = require('../lib/data.cjs');

// Configuration
const RECEIPTS_DIR = path.join(__dirname, '../receipts/ica');
const JSON_OUTPUT = path.join(outputDir(), 'ica-analysis.json');

/**
 * Extract text from PDF
 */
async function extractPdfText(pdfPath) {
  const dataBuffer = fsSync.readFileSync(pdfPath);
  const uint8Array = new Uint8Array(dataBuffer);
  const parser = new PDFParse(uint8Array);
  await parser.load();
  const result = await parser.getText();
  await parser.destroy();
  return result.text;
}

/**
 * Load existing analysis data
 */
async function loadExistingData() {
  try {
    const data = await fs.readFile(JSON_OUTPUT, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.log('⚠️  Ingen befintlig data hittades, skapar ny...');
    return {
      metadata: {
        generatedAt: new Date().toISOString(),
        totalReceipts: 0,
        totalSpending: 0,
        totalItems: 0,
        averageBasket: 0
      },
      receipts: [],
      analysis: {
        byCategory: {},
        byStore: {},
        topProducts: []
      }
    };
  }
}

/**
 * Get all ICA PDF files from receipts directory
 */
async function getAllIcaPdfFiles() {
  const files = await fs.readdir(RECEIPTS_DIR);
  return files.filter(f => f.toLowerCase().startsWith('ica') && f.toLowerCase().endsWith('.pdf'));
}

/**
 * Find which PDFs are new (not yet processed)
 */
function findNewReceipts(allPdfs, existingData) {
  const processedFilenames = new Set(
    existingData.receipts.map(r => r.filename)
  );

  return allPdfs.filter(pdf => !processedFilenames.has(pdf));
}

/**
 * Process a single new receipt
 */
async function processNewReceipt(filename) {
  const filePath = path.join(RECEIPTS_DIR, filename);

  try {
    const text = await extractPdfText(filePath);
    const items = parseItems(text);

    if (items.length === 0) {
      return { success: false, error: 'Inga artiklar hittades', filename };
    }

    const date = extractDate(text);
    const store = extractStore(text);
    const grandTotal = calculateGrandTotal(items);

    return {
      success: true,
      receipt: {
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
      }
    };
  } catch (error) {
    return { success: false, error: error.message, filename };
  }
}

/**
 * Recalculate summary statistics
 */
function recalculateStats(allReceipts) {
  let totalSpending = 0;
  let totalItems = 0;

  for (const receipt of allReceipts) {
    totalSpending += parseFloat(receipt.metadata?.grandTotal) || 0;
    totalItems += receipt.itemCount || 0;
  }

  return {
    totalReceipts: allReceipts.length,
    totalSpending,
    totalItems,
    averageBasket: allReceipts.length > 0 ? totalSpending / allReceipts.length : 0
  };
}

/**
 * Create a signature for duplicate detection
 */
function createReceiptSignature(receipt) {
  const total = parseFloat(receipt.metadata?.grandTotal) || 0;
  const itemCount = receipt.items?.length || 0;
  const date = receipt.metadata?.date || '';

  // Create sorted list of items for content comparison
  const itemsSignature = (receipt.items || [])
    .map(item => `${item.name}:${item.quantity}:${item.totalPrice}`)
    .sort()
    .join('|');

  return `${date}|${total.toFixed(2)}|${itemCount}|${itemsSignature}`;
}

/**
 * Remove duplicate receipts
 */
function removeDuplicates(receipts) {
  const seen = new Set();
  const uniqueReceipts = [];
  let duplicateCount = 0;

  for (const receipt of receipts) {
    const signature = createReceiptSignature(receipt);

    if (!seen.has(signature)) {
      seen.add(signature);
      uniqueReceipts.push(receipt);
    } else {
      duplicateCount++;
      console.log(`  ✂️  Dublett borttagen: ${receipt.filename} (${receipt.metadata?.date})`);
    }
  }

  return { uniqueReceipts, duplicateCount };
}

/**
 * Recalculate category and product analysis
 */
function recalculateAnalysis(allReceipts) {
  const categoryTotals = {};
  const productCounts = {};

  for (const receipt of allReceipts) {
    if (!receipt.items || !Array.isArray(receipt.items)) continue;

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

  // Top products
  const topProducts = Object.entries(productCounts)
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 20)
    .map(([name, data]) => ({
      name,
      count: data.count,
      totalSpent: data.total
    }));

  return {
    byCategory: categoryTotals,
    topProducts: topProducts
  };
}

/**
 * Main update process
 */
async function main() {
  console.log('╔════════════════════════════════════════════════════════╗');
  console.log('║     📝 UPPDATERA ICA-KVITTON (INKREMENTELL)          ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');

  try {
    // Step 1: Load existing data
    console.log('Steg 1: Läser befintlig data...');
    const existingData = await loadExistingData();
    console.log(`  ✓ Befintliga kvitton: ${existingData.receipts.length}\n`);

    // Step 2: Find all ICA PDFs
    console.log('Steg 2: Letar efter ICA PDF-filer...');
    const allPdfs = await getAllIcaPdfFiles();
    console.log(`  ✓ Totalt ${allPdfs.length} ICA PDF-filer i mappen\n`);

    // Step 3: Identify new receipts
    console.log('Steg 3: Identifierar nya kvitton...');
    const newPdfs = findNewReceipts(allPdfs, existingData);

    if (newPdfs.length === 0) {
      console.log('  ℹ️  Inga nya kvitton hittades!');
      console.log('  📊 Aktuell data är redan uppdaterad.\n');
      console.log('═══════════════════════════════════════════════════════════');
      console.log(`📊 Totalt: ${existingData.receipts.length} kvitton, ${existingData.metadata.totalSpending.toFixed(2)} SEK`);
      return;
    }

    console.log(`  ✓ Hittade ${newPdfs.length} nya kvitton att processa\n`);

    // Step 4: Process new receipts
    console.log('Steg 4: Processar nya kvitton...');
    const newReceipts = [];
    const errors = [];

    for (let i = 0; i < newPdfs.length; i++) {
      const filename = newPdfs[i];
      process.stdout.write(`  Processar: ${filename}...`);

      const result = await processNewReceipt(filename);

      if (result.success) {
        newReceipts.push(result.receipt);
        console.log(' ✓');
      } else {
        errors.push({ filename, error: result.error });
        console.log(' ✗');
      }
    }

    console.log(`  ✓ Processade ${newReceipts.length} nya kvitton`);
    if (errors.length > 0) {
      console.log(`  ✗ Misslyckades med ${errors.length} kvitton\n`);
    } else {
      console.log('');
    }

    // Step 5: Merge with existing data
    console.log('Steg 5: Slår ihop med befintlig data...');
    const allReceipts = [...existingData.receipts, ...newReceipts];
    console.log(`  ✓ Totalt nu: ${allReceipts.length} kvitton\n`);

    // Step 6: Remove duplicates
    console.log('Steg 6: Kontrollerar dubbletter...');
    const { uniqueReceipts, duplicateCount } = removeDuplicates(allReceipts);
    if (duplicateCount > 0) {
      console.log(`  ✓ Tog bort ${duplicateCount} dubbletter\n`);
    } else {
      console.log(`  ✓ Inga dubbletter hittades\n`);
    }

    // Step 7: Recalculate statistics
    console.log('Steg 7: Beräknar om statistik...');
    const stats = recalculateStats(uniqueReceipts);
    console.log(`  ✓ Total kostnad: ${stats.totalSpending.toFixed(2)} SEK`);
    console.log(`  ✓ Totalt artiklar: ${stats.totalItems}`);
    console.log(`  ✓ Snitt per kvitto: ${stats.averageBasket.toFixed(2)} SEK\n`);

    // Step 8: Recalculate analysis
    console.log('Steg 8: Beräknar om kategorianalys...');
    const analysis = recalculateAnalysis(uniqueReceipts);
    console.log(`  ✓ Kategorier: ${Object.keys(analysis.byCategory).length}`);
    console.log(`  ✓ Top produkter: ${analysis.topProducts.length}\n`);

    // Step 9: Save updated JSON
    console.log('Steg 9: Sparar uppdaterad JSON...');
    const updatedData = {
      metadata: {
        generatedAt: existingData.metadata?.generatedAt || new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
        ...stats
      },
      receipts: uniqueReceipts,
      analysis: analysis
    };

    await fs.writeFile(JSON_OUTPUT, JSON.stringify(updatedData, null, 2), 'utf8');
    console.log(`  ✓ JSON-fil uppdaterad: ${JSON_OUTPUT}\n`);

    // Summary
    console.log('═══════════════════════════════════════════════════════════');
    console.log('✅ UPPDATERING KLAR!\n');
    console.log('📊 SAMMANFATTNING:');
    console.log(`  • Nya kvitton: ${newReceipts.length}`);
    console.log(`  • Dubbletter borttagna: ${duplicateCount}`);
    console.log(`  • Totalt kvitton: ${uniqueReceipts.length}`);
    console.log(`  • Total kostnad: ${stats.totalSpending.toFixed(2)} SEK`);
    console.log(`  • Totalt artiklar: ${stats.totalItems}\n`);

    if (errors.length > 0) {
      console.log('⚠️  VARNINGAR:');
      errors.forEach(err => {
        console.log(`  • ${err.filename}: ${err.error}`);
      });
      console.log('');
    }

    console.log('💡 NÄSTA STEG:');
    console.log('  • ICA-analysen är uppdaterad!');
    console.log('  • Kör "npm run analyze-combined" för kombinerad analys\n');

  } catch (error) {
    console.error('❌ Ett fel uppstod:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the update
main();
