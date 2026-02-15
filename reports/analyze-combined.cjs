#!/usr/bin/env node

/**
 * Combined Receipt Analysis - Willys + ICA
 *
 * Analyzes and compares spending across both grocery chains
 */

const fs = require('fs');
const path = require('path');
const { PDFParse } = require('pdf-parse');

// Configuration
const WILLYS_ANALYSIS = path.join(__dirname, '../output/willys-analysis.json');
const ICA_ANALYSIS = path.join(__dirname, '../output/ica-analysis.json');
const COMBINED_ANALYSIS = path.join(__dirname, '../output/combined-analysis.json');
const ICA_RECEIPTS = path.join(__dirname, '../receipts/ica/ica-receipts.json');
const RECEIPTS_DIR = path.join(__dirname, '../receipts/ica');

// Swedish month names
const monthNames = {
  '01': 'Januari', '02': 'Februari', '03': 'Mars', '04': 'April',
  '05': 'Maj', '06': 'Juni', '07': 'Juli', '08': 'Augusti',
  '09': 'September', '10': 'Oktober', '11': 'November', '12': 'December'
};

/**
 * Extract amount and date from ICA receipt PDF
 */
async function parseICAReceipt(pdfPath) {
  try {
    const dataBuffer = fs.readFileSync(pdfPath);
    const uint8Array = new Uint8Array(dataBuffer);
    const parser = new PDFParse(uint8Array);
    await parser.load();
    const result = await parser.getText();
    await parser.destroy();
    const text = result.text;

    // Extract date (format: YYYY-MM-DD or DD/MM/YYYY)
    let date = null;
    const dateMatch = text.match(/(\d{4}[-\/]\d{2}[-\/]\d{2})|(\d{2}[-\/]\d{2}[-\/]\d{4})/);
    if (dateMatch) {
      date = dateMatch[0].replace(/\//g, '-');
      // Convert DD-MM-YYYY to YYYY-MM-DD if needed
      if (date.match(/^\d{2}-\d{2}-\d{4}$/)) {
        const [day, month, year] = date.split('-');
        date = `${year}-${month}-${day}`;
      }
    }

    // Extract total amount (look for "ATT BETALA", "SUMMA", "TOTALT", etc.)
    let total = 0;
    const totalPatterns = [
      /Totalt\s+SEK\s+([\d\s]+[,\.]\d{2})/i,
      /ATT\s+BETALA[:\s]+([\d\s]+[,\.]\d{2})/i,
      /SUMMA[:\s]+([\d\s]+[,\.]\d{2})/i,
      /TOTALT[:\s]+([\d\s]+[,\.]\d{2})/i,
      /TOTAL[:\s]+([\d\s]+[,\.]\d{2})/i,
      /Att\s+betala[:\s]+([\d\s]+[,\.]\d{2})/i,
      /Betalat\s+([\d\s]+[,\.]\d{2})/i
    ];

    for (const pattern of totalPatterns) {
      const match = text.match(pattern);
      if (match) {
        // Remove spaces and convert comma to dot
        total = parseFloat(match[1].replace(/\s+/g, '').replace(',', '.'));
        break;
      }
    }

    // Extract store name
    let store = 'ICA';
    const storeMatch = text.match(/(ICA\s+[^\n]+)/);
    if (storeMatch) {
      store = storeMatch[1].trim().split('\n')[0].substring(0, 40);
    }

    return { date, total, store, text };
  } catch (error) {
    console.error(`   ⚠️  Error parsing ${pdfPath}:`, error.message);
    return null;
  }
}

/**
 * Load ICA receipts from analysis file
 */
function loadICAReceipts() {
  console.log('📄 Läser ICA-data från analys...\n');

  if (!fs.existsSync(ICA_ANALYSIS)) {
    console.log('   ⚠️  Ingen ICA-analys hittades. Kör "npm run update-ica" först.\n');
    return [];
  }

  const data = JSON.parse(fs.readFileSync(ICA_ANALYSIS, 'utf8'));
  const receipts = [];

  for (const receipt of data.receipts) {
    const total = receipt.metadata?.grandTotal || 0;

    receipts.push({
      fileName: receipt.filename,
      date: receipt.metadata?.date,
      total: total,
      store: receipt.metadata?.store || 'ICA',
      chain: 'ICA'
    });
  }

  console.log(`✅ Läste ${receipts.length} ICA-kvitton\n`);
  return receipts;
}

/**
 * Load Willys data from analysis
 */
function loadWillysReceipts() {
  console.log('📄 Läser Willys-data från analys...\n');

  if (!fs.existsSync(WILLYS_ANALYSIS)) {
    console.log('   ⚠️  Ingen Willys-analys hittades. Kör "npm run analyze" först.\n');
    return [];
  }

  const data = JSON.parse(fs.readFileSync(WILLYS_ANALYSIS, 'utf8'));
  const receipts = [];

  for (const receipt of data.receipts) {
    const total = receipt.items.reduce((sum, item) => sum + (item.totalPrice || 0), 0);

    receipts.push({
      fileName: receipt.metadata.fileName,
      date: receipt.metadata.date,
      total: total,
      store: receipt.metadata.store || 'Willys',
      chain: 'Willys'
    });
  }

  console.log(`✅ Läste ${receipts.length} Willys-kvitton\n`);
  return receipts;
}

/**
 * Group receipts by month and chain
 */
function groupByMonth(receipts) {
  const monthly = {};

  for (const receipt of receipts) {
    if (!receipt.date) continue;

    const date = new Date(receipt.date);
    if (isNaN(date.getTime())) continue;

    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

    if (!monthly[monthKey]) {
      monthly[monthKey] = {
        willys: { count: 0, total: 0 },
        ica: { count: 0, total: 0 }
      };
    }

    const chain = receipt.chain.toLowerCase();
    if (chain === 'willys') {
      monthly[monthKey].willys.count++;
      monthly[monthKey].willys.total += receipt.total;
    } else if (chain === 'ica') {
      monthly[monthKey].ica.count++;
      monthly[monthKey].ica.total += receipt.total;
    }
  }

  return monthly;
}

/**
 * Main analysis
 */
async function main() {
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║         🏪 KOMBINERAD ANALYS - WILLYS + ICA 🏪                ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  // Load data
  const willysReceipts = loadWillysReceipts();
  const icaReceipts = loadICAReceipts();
  const allReceipts = [...willysReceipts, ...icaReceipts];

  if (allReceipts.length === 0) {
    console.log('❌ Inga kvitton att analysera.\n');
    return;
  }

  // Group by month
  const monthly = groupByMonth(allReceipts);
  const sortedMonths = Object.keys(monthly).sort();

  // Calculate totals
  let totalWillys = 0;
  let totalICA = 0;
  let countWillys = 0;
  let countICA = 0;

  for (const month of sortedMonths) {
    totalWillys += monthly[month].willys.total;
    totalICA += monthly[month].ica.total;
    countWillys += monthly[month].willys.count;
    countICA += monthly[month].ica.count;
  }

  const grandTotal = totalWillys + totalICA;
  const totalReceipts = countWillys + countICA;

  // Print monthly breakdown
  console.log('═══════════════════════════════════════════════════════════════\n');
  console.log('📅 MÅNADSVISA UTGIFTER:\n');

  sortedMonths.forEach((monthKey, idx) => {
    const [year, month] = monthKey.split('-');
    const monthName = monthNames[month];
    const data = monthly[monthKey];
    const monthTotal = data.willys.total + data.ica.total;
    const willysPercent = monthTotal > 0 ? (data.willys.total / monthTotal * 100) : 0;
    const icaPercent = monthTotal > 0 ? (data.ica.total / monthTotal * 100) : 0;

    console.log(`${idx + 1}. ${monthName} ${year}`);
    console.log(`   💰 Totalt: ${monthTotal.toFixed(2)} SEK`);
    console.log(`   🏪 Willys: ${data.willys.total.toFixed(2)} SEK (${data.willys.count} kvitton, ${willysPercent.toFixed(1)}%)`);
    console.log(`   🏪 ICA: ${data.ica.total.toFixed(2)} SEK (${data.ica.count} kvitton, ${icaPercent.toFixed(1)}%)`);
    console.log('');
  });

  // Print totals
  console.log('═══════════════════════════════════════════════════════════════\n');
  console.log('📊 TOTALT:\n');
  console.log(`   💰 Total kostnad: ${grandTotal.toFixed(2)} SEK`);
  console.log(`   🛒 Totalt kvitton: ${totalReceipts} st`);
  console.log(`   📅 Antal månader: ${sortedMonths.length}\n`);

  console.log('   PER BUTIK:\n');
  console.log(`   🏪 Willys:`);
  console.log(`      💰 Totalt: ${totalWillys.toFixed(2)} SEK (${(totalWillys/grandTotal*100).toFixed(1)}%)`);
  console.log(`      🛒 Kvitton: ${countWillys} st`);
  console.log(`      📊 Snitt: ${(totalWillys/countWillys).toFixed(2)} SEK/kvitto\n`);

  console.log(`   🏪 ICA:`);
  console.log(`      💰 Totalt: ${totalICA.toFixed(2)} SEK (${(totalICA/grandTotal*100).toFixed(1)}%)`);
  console.log(`      🛒 Kvitton: ${countICA} st`);
  console.log(`      📊 Snitt: ${(totalICA/countICA).toFixed(2)} SEK/kvitto\n`);

  // Comparison
  console.log('═══════════════════════════════════════════════════════════════\n');
  console.log('🔍 JÄMFÖRELSE:\n');

  const avgWillys = totalWillys / countWillys;
  const avgICA = totalICA / countICA;
  const cheaper = avgWillys < avgICA ? 'Willys' : 'ICA';
  const diff = Math.abs(avgWillys - avgICA);
  const diffPercent = (diff / Math.min(avgWillys, avgICA) * 100).toFixed(1);

  console.log(`   📊 Genomsnittligt kvittobelopp:`);
  console.log(`      Willys: ${avgWillys.toFixed(2)} SEK`);
  console.log(`      ICA: ${avgICA.toFixed(2)} SEK`);
  console.log(`      Skillnad: ${diff.toFixed(2)} SEK (${diffPercent}%)`);
  console.log(`      💡 ${cheaper} har lägre snittpris per kvitto\n`);

  const preferred = countWillys > countICA ? 'Willys' : 'ICA';
  const preferredPercent = (Math.max(countWillys, countICA) / totalReceipts * 100).toFixed(1);

  console.log(`   🎯 Mest använda butik: ${preferred} (${preferredPercent}% av kvittona)\n`);

  // Visual comparison
  console.log('═══════════════════════════════════════════════════════════════\n');
  console.log('📊 VISUELL FÖRDELNING:\n');

  const willysBar = '█'.repeat(Math.round(totalWillys / grandTotal * 50));
  const icaBar = '█'.repeat(Math.round(totalICA / grandTotal * 50));

  console.log(`Willys ${willysBar} ${(totalWillys/grandTotal*100).toFixed(1)}%`);
  console.log(`ICA    ${icaBar} ${(totalICA/grandTotal*100).toFixed(1)}%\n`);

  console.log('═══════════════════════════════════════════════════════════════\n');

  // Save combined analysis
  const combinedAnalysis = {
    summary: {
      totalReceipts: totalReceipts,
      totalAmount: grandTotal,
      monthCount: sortedMonths.length,
      dateRange: {
        earliest: sortedMonths[0],
        latest: sortedMonths[sortedMonths.length - 1]
      },
      byChain: {
        willys: {
          receipts: countWillys,
          amount: totalWillys,
          percentage: (totalWillys/grandTotal*100),
          average: avgWillys
        },
        ica: {
          receipts: countICA,
          amount: totalICA,
          percentage: (totalICA/grandTotal*100),
          average: avgICA
        }
      }
    },
    monthly: monthly,
    receipts: {
      willys: willysReceipts,
      ica: icaReceipts
    },
    generatedAt: new Date().toISOString()
  };

  fs.writeFileSync(COMBINED_ANALYSIS, JSON.stringify(combinedAnalysis, null, 2), 'utf8');
  console.log(`💾 Kombinerad analys sparad: ${COMBINED_ANALYSIS}\n`);

  console.log('✅ Analys klar!\n');
}

// Run analysis
main().catch(error => {
  console.error('❌ Fel:', error.message);
  process.exit(1);
});
