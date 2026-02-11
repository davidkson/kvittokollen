#!/usr/bin/env node

const { execSync } = require('child_process');
const path = require('path');

const reports = {
  '1': { name: 'Topp produkter (mest köpta & dyraste)', file: 'top-products.cjs' },
  '2': { name: 'Total matbudget månad för månad', file: 'total-spending-monthly.cjs' },
  '3': { name: 'Coca Cola Zero analys', file: 'analyze-coke-zero.cjs' },
  '4': { name: 'Kattmat sammanställning', file: 'catfood-summary.cjs' },
  '5': { name: 'Mjölk analys', file: 'analyze-milk.cjs' },
  '6': { name: 'November 2025 detaljanalys', file: 'analyze-november-2025.cjs' },
  '7': { name: 'Jämför kattmat per butik', file: 'compare-cat-food.cjs' },
  '8': { name: 'Månatlig kattmat', file: 'analyze-catfood-monthly.cjs' },
};

console.log('\n╔════════════════════════════════════════════════════════════════╗');
console.log('║              📊 KVITTO-ANALYS - RAPPORTER 📊                  ║');
console.log('╚════════════════════════════════════════════════════════════════╝\n');

Object.entries(reports).forEach(([key, report]) => {
  console.log(`  ${key}. ${report.name}`);
});

console.log('\n  0. Avsluta\n');

const choice = process.argv[2];

if (!choice || choice === '0') {
  console.log('Avslutar...\n');
  process.exit(0);
}

const report = reports[choice];

if (!report) {
  console.log('❌ Ogiltigt val!\n');
  process.exit(1);
}

console.log(`\n▶️  Kör: ${report.name}\n`);
console.log('═══════════════════════════════════════════════════════════════\n');

try {
  execSync(`node reports/${report.file}`, { stdio: 'inherit', cwd: __dirname });
} catch (error) {
  console.error('\n❌ Fel vid körning av rapport\n');
  process.exit(1);
}
