#!/usr/bin/env node

/**
 * Incremental Receipt Update Script
 * Only processes NEW receipts and updates the JSON file
 * Much faster than full re-analysis
 */

const fs = require('fs').promises;
const path = require('path');
const { extractPdfText } = require('./lib/pdf-extractor.cjs');
const { parseReceipt } = require('./lib/receipt-parser.cjs');
const { categorizeItem } = require('./lib/categorizer.cjs');

// Configuration
const RECEIPTS_DIR = path.join(__dirname, 'receipts');
const JSON_OUTPUT = path.join(__dirname, 'output', 'willys-analysis.json');

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
        totalItems: 0
      },
      receipts: [],
      analysis: {}
    };
  }
}

/**
 * Get all PDF files from receipts directory
 */
async function getAllPdfFiles() {
  const files = await fs.readdir(RECEIPTS_DIR);
  return files.filter(f => f.toLowerCase().endsWith('.pdf'));
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

  // Extract text
  const extracted = await extractPdfText(filePath);
  if (!extracted.success) {
    return { success: false, error: extracted.error, filename };
  }

  // Parse receipt
  const parsed = parseReceipt(extracted.text, filename);

  // Categorize items
  const categorizedItems = parsed.items.map(item => ({
    ...item,
    category: categorizeItem(item.name)
  }));

  return {
    success: true,
    receipt: {
      ...parsed,
      items: categorizedItems
    }
  };
}

/**
 * Recalculate summary statistics
 */
function recalculateStats(allReceipts) {
  let totalSpending = 0;
  let totalItems = 0;

  for (const receipt of allReceipts) {
    for (const item of receipt.items) {
      totalSpending += item.totalPrice || 0;
      totalItems++;
    }
  }

  return {
    totalReceipts: allReceipts.length,
    totalSpending,
    totalItems,
    averageBasket: allReceipts.length > 0 ? totalSpending / allReceipts.length : 0
  };
}

/**
 * Main update process
 */
async function main() {
  console.log('╔════════════════════════════════════════════════════════╗');
  console.log('║     📝 UPPDATERA KVITTON (INKREMENTELL)               ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');

  try {
    // Step 1: Load existing data
    console.log('Steg 1: Läser befintlig data...');
    const existingData = await loadExistingData();
    console.log(`  ✓ Befintliga kvitton: ${existingData.receipts.length}\n`);

    // Step 2: Find all PDFs
    console.log('Steg 2: Letar efter PDF-filer...');
    const allPdfs = await getAllPdfFiles();
    console.log(`  ✓ Totalt ${allPdfs.length} PDF-filer i mappen\n`);

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

    // Step 6: Recalculate statistics
    console.log('Steg 6: Beräknar om statistik...');
    const stats = recalculateStats(allReceipts);
    console.log(`  ✓ Total kostnad: ${stats.totalSpending.toFixed(2)} SEK`);
    console.log(`  ✓ Totalt artiklar: ${stats.totalItems}`);
    console.log(`  ✓ Snitt per kvitto: ${stats.averageBasket.toFixed(2)} SEK\n`);

    // Step 7: Save updated JSON
    console.log('Steg 7: Sparar uppdaterad JSON...');
    const updatedData = {
      metadata: {
        generatedAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
        ...stats
      },
      receipts: allReceipts,
      analysis: existingData.analysis // Keep old analysis, will be recalculated on full analyze
    };

    await fs.writeFile(JSON_OUTPUT, JSON.stringify(updatedData, null, 2), 'utf8');
    console.log(`  ✓ JSON-fil uppdaterad: ${JSON_OUTPUT}\n`);

    // Summary
    console.log('═══════════════════════════════════════════════════════════');
    console.log('✅ UPPDATERING KLAR!\n');
    console.log('📊 SAMMANFATTNING:');
    console.log(`  • Nya kvitton: ${newReceipts.length}`);
    console.log(`  • Totalt kvitton: ${allReceipts.length}`);
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
    console.log('  • JSON-filen är uppdaterad - du kan fråga mig direkt!');
    console.log('  • För att generera rapporter: npm run analyze\n');

  } catch (error) {
    console.error('❌ Ett fel uppstod:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the update
main();
