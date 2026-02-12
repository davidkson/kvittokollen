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

// Configuration
const RECEIPTS_DIR = path.join(__dirname, '../receipts');
const JSON_OUTPUT = path.join(__dirname, '../output', 'ica-analysis.json');

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
 * Parse date from ICA receipt text
 */
function extractDate(text) {
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
  const storeMatch = text.match(/(Maxi ICA [^\n]+|ICA [^\n]+)/i);
  if (storeMatch) {
    return storeMatch[1].trim().split('\n')[0];
  }
  return 'ICA';
}

/**
 * Simple categorization based on product name
 */
function categorizeItem(name) {
  const nameLower = name.toLowerCase();

  if (nameLower.match(/mjölk|yoghurt|fil|kvarg|grädde|smör|ost|mozzarella/)) return 'Dairy';
  if (nameLower.match(/kött|fläsk|korv|köttfärs|kalkon|kyckling|bacon|skinka|medaljong/)) return 'Meat & Protein';
  if (nameLower.match(/banan|äpple|tomat|paprika|vitlök|champinjon|sallad|frukt|grönsak/)) return 'Fruit & Vegetables';
  if (nameLower.match(/dryck|läsk|juice|vatten|kaffe|te\b|öl|vin|sprit/)) return 'Beverages';
  if (nameLower.match(/nudlar|pasta|ris|mjöl|socker|salt|kryddor|olja|sås|buljong|müsli|russin|vanilj/)) return 'Pantry Staples';
  if (nameLower.match(/fryst|glass/)) return 'Frozen Foods';
  if (nameLower.match(/bröd|kaka|tårta|bulle|choklad|godis|daim|helnöt/)) return 'Bakery & Sweets';
  if (nameLower.match(/deo|schampo|tvål|tandkräm|rakhyvel/)) return 'Personal Care';
  if (nameLower.match(/disk|tvätt|papper|påse|miljökasse/)) return 'Household';
  if (nameLower.match(/t-shirt|tröja|byxor|klänning|kläder/)) return 'Clothing';

  return 'Uncategorized';
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

    // Match item line
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
    // Handle discount lines
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
 * Calculate grand total from items
 */
function calculateGrandTotal(items) {
  return items.reduce((sum, item) => sum + item.totalPrice, 0);
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
    totalSpending += receipt.metadata.grandTotal;
    totalItems += receipt.itemCount;
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
  const total = receipt.metadata.grandTotal || 0;
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
        generatedAt: existingData.metadata.generatedAt || new Date().toISOString(),
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
