#!/usr/bin/env node

/**
 * Willys Receipt Analysis System
 * Main orchestration script
 *
 * Analyzes 153 PDF receipts from Willys grocery store to understand:
 * - What items have been purchased
 * - What categories the most money has been spent on
 * - Overall spending trends and insights
 */

const path = require('path');
const { extractAllReceipts } = require('../lib/pdf-extractor.cjs');
const { parseAllReceipts } = require('../lib/receipt-parser.cjs');
const { categorizeAllItems, getUncategorizedItems } = require('../lib/categorizer.cjs');
const { analyzeReceipts } = require('../lib/analyzer.cjs');
const { generateAllReports } = require('../lib/report-generator.cjs');

// Configuration
const RECEIPTS_DIR = path.join(__dirname, '../receipts/willys');
const OUTPUT_DIR = path.join(__dirname, '../output');

/**
 * Main analysis pipeline
 */
async function main() {
  console.log('=== Willys Receipt Analysis System ===\n');

  try {
    // Step 1: Extract text from all PDFs
    console.log('Step 1: Extracting text from PDFs...');
    const { results: extractedReceipts, errors: extractionErrors } = await extractAllReceipts(RECEIPTS_DIR);
    console.log('');

    if (extractedReceipts.length === 0) {
      console.error('❌ No receipts could be extracted. Exiting.');
      process.exit(1);
    }

    // Step 2: Parse receipt text into structured data
    console.log('Step 2: Parsing receipt data...');
    const { parsed: parsedReceipts, warnings: parsingWarnings } = parseAllReceipts(extractedReceipts);
    console.log('');

    if (parsedReceipts.length === 0) {
      console.error('❌ No receipts could be parsed. Exiting.');
      process.exit(1);
    }

    // Step 3: Categorize items
    console.log('Step 3: Categorizing items...');
    const categorizedReceipts = categorizeAllItems(parsedReceipts);
    const uncategorizedItems = getUncategorizedItems(categorizedReceipts);
    console.log('');

    // Step 4: Analyze spending patterns
    console.log('Step 4: Analyzing spending patterns...');
    const analysis = analyzeReceipts(categorizedReceipts);
    console.log('');

    // Step 5: Generate reports
    console.log('Step 5: Generating reports...');
    await generateAllReports(
      categorizedReceipts,
      analysis,
      uncategorizedItems,
      extractionErrors,
      parsingWarnings,
      OUTPUT_DIR
    );
    console.log('');

    // Print summary
    console.log('=== Analysis Complete ===\n');
    console.log('📊 Summary:');
    console.log(`  Total Receipts: ${analysis.summary.totalReceipts}`);
    console.log(`  Total Spending: ${analysis.summary.totalSpending.toFixed(2)} SEK`);
    console.log(`  Total Items: ${analysis.summary.totalItems}`);
    console.log(`  Average Basket: ${analysis.summary.averageBasket.toFixed(2)} SEK`);
    console.log('');

    console.log('📁 Reports generated in: output/');
    console.log('  - willys-analysis.json (complete data)');
    console.log('  - spending-report.md (human-readable report)');
    console.log('  - category-spending.csv (category breakdown)');
    console.log('  - items-all.csv (all items from all receipts)');
    console.log('  - top-items.csv (most purchased items)');
    console.log('');

    console.log('✅ Analysis complete! Check output/spending-report.md for insights.');

  } catch (error) {
    console.error('❌ Analysis failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the analysis
main();
