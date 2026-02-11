#!/usr/bin/env node

const fs = require('fs');

const willysData = JSON.parse(fs.readFileSync('../output/willys-analysis.json', 'utf8'));
const icaData = JSON.parse(fs.readFileSync('../output/ica-analysis.json', 'utf8'));

console.log('╔════════════════════════════════════════════════════════════════╗');
console.log('║        💰 TOTAL MATBUDGET - MÅNAD FÖR MÅNAD 💰               ║');
console.log('╚════════════════════════════════════════════════════════════════╝\n');

// Beräkna korrekt total från items (för Willys)
function calculateTotal(receipt) {
  if (!receipt.items || !Array.isArray(receipt.items)) return 0;
  return receipt.items.reduce((sum, item) => sum + (item.totalPrice || 0), 0);
}

// Gruppera per månad
const monthlyData = {};

for (const receipt of willysData.receipts) {
  if (!receipt.metadata || !receipt.metadata.date) continue;

  const date = new Date(receipt.metadata.date);
  if (isNaN(date.getTime())) continue;

  const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

  if (!monthlyData[monthKey]) {
    monthlyData[monthKey] = {
      willys: { count: 0, total: 0, receipts: [] },
      ica: { count: 0, total: 0, receipts: [] }
    };
  }

  const total = calculateTotal(receipt);
  monthlyData[monthKey].willys.count++;
  monthlyData[monthKey].willys.total += total;
  monthlyData[monthKey].willys.receipts.push({
    date: receipt.metadata.date,
    total: total
  });
}

for (const receipt of icaData.receipts) {
  if (!receipt.metadata || !receipt.metadata.date) continue;

  const date = new Date(receipt.metadata.date);
  if (isNaN(date.getTime())) continue;

  const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

  if (!monthlyData[monthKey]) {
    monthlyData[monthKey] = {
      willys: { count: 0, total: 0, receipts: [] },
      ica: { count: 0, total: 0, receipts: [] }
    };
  }

  const total = receipt.metadata.grandTotal || 0;
  monthlyData[monthKey].ica.count++;
  monthlyData[monthKey].ica.total += total;
  monthlyData[monthKey].ica.receipts.push({
    date: receipt.metadata.date,
    total: total
  });
}

const monthNames = {
  '01': 'Januari', '02': 'Februari', '03': 'Mars', '04': 'April',
  '05': 'Maj', '06': 'Juni', '07': 'Juli', '08': 'Augusti',
  '09': 'September', '10': 'Oktober', '11': 'November', '12': 'December'
};

const sortedMonths = Object.keys(monthlyData).sort();

console.log('═══════════════════════════════════════════════════════════════\n');
console.log('📅 MÅNADSVIS ÖVERSIKT:\n');

let totalWillysSpent = 0;
let totalIcaSpent = 0;
let totalWillysCount = 0;
let totalIcaCount = 0;

sortedMonths.forEach((monthKey, idx) => {
  const [year, month] = monthKey.split('-');
  const data = monthlyData[monthKey];

  const willysTotal = data.willys.total;
  const icaTotal = data.ica.total;
  const monthTotal = willysTotal + icaTotal;

  const willysCount = data.willys.count;
  const icaCount = data.ica.count;
  const totalCount = willysCount + icaCount;

  totalWillysSpent += willysTotal;
  totalIcaSpent += icaTotal;
  totalWillysCount += willysCount;
  totalIcaCount += icaCount;

  const willysPercent = monthTotal > 0 ? (willysTotal / monthTotal * 100) : 0;
  const icaPercent = monthTotal > 0 ? (icaTotal / monthTotal * 100) : 0;

  console.log(`${idx + 1}. ${monthNames[month]} ${year}`);
  console.log(`   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`   💰 Totalt: ${monthTotal.toFixed(2)} SEK (${totalCount} inköp)`);
  console.log('');

  if (willysTotal > 0) {
    console.log(`   🏪 Willys:`);
    console.log(`      ${willysCount} inköp - ${willysTotal.toFixed(2)} SEK (${willysPercent.toFixed(1)}%)`);
    console.log(`      Snitt: ${(willysTotal / willysCount).toFixed(2)} SEK/inköp`);
    console.log('');
  }

  if (icaTotal > 0) {
    console.log(`   🏪 ICA:`);
    console.log(`      ${icaCount} inköp - ${icaTotal.toFixed(2)} SEK (${icaPercent.toFixed(1)}%)`);
    console.log(`      Snitt: ${(icaTotal / icaCount).toFixed(2)} SEK/inköp`);
    console.log('');
  }
});

console.log('═══════════════════════════════════════════════════════════════\n');
console.log('📊 TOTAL SAMMANSTÄLLNING:\n');

const grandTotal = totalWillysSpent + totalIcaSpent;
const grandCount = totalWillysCount + totalIcaCount;

console.log(`   💵 Total kostnad: ${grandTotal.toFixed(2)} SEK`);
console.log(`   🛒 Totalt inköp: ${grandCount} st`);
console.log(`   📅 Antal månader: ${sortedMonths.length}`);
console.log(`   📊 Genomsnitt: ${(grandTotal / sortedMonths.length).toFixed(2)} SEK/månad\n`);

console.log('   PER BUTIK:\n');

const willysPercent = (totalWillysSpent / grandTotal * 100);
const icaPercent = (totalIcaSpent / grandTotal * 100);

console.log(`   🏪 Willys:`);
console.log(`      💵 ${totalWillysSpent.toFixed(2)} SEK (${willysPercent.toFixed(1)}%)`);
console.log(`      🛒 ${totalWillysCount} inköp`);
console.log(`      📊 Snitt: ${(totalWillysSpent / totalWillysCount).toFixed(2)} SEK/inköp`);
console.log(`      📅 Snitt: ${(totalWillysSpent / sortedMonths.length).toFixed(2)} SEK/månad\n`);

console.log(`   🏪 ICA:`);
console.log(`      💵 ${totalIcaSpent.toFixed(2)} SEK (${icaPercent.toFixed(1)}%)`);
console.log(`      🛒 ${totalIcaCount} inköp`);
console.log(`      📊 Snitt: ${(totalIcaSpent / totalIcaCount).toFixed(2)} SEK/inköp`);
console.log(`      📅 Snitt: ${(totalIcaSpent / sortedMonths.length).toFixed(2)} SEK/månad\n`);

console.log('═══════════════════════════════════════════════════════════════\n');
console.log('📈 STATISTIK:\n');

// Hitta högsta/lägsta månad
const monthTotals = sortedMonths.map(m => ({
  month: m,
  total: monthlyData[m].willys.total + monthlyData[m].ica.total
}));

const highest = monthTotals.reduce((max, m) => m.total > max.total ? m : max);
const lowest = monthTotals.reduce((min, m) => m.total < min.total ? m : min);

const [highYear, highMonth] = highest.month.split('-');
const [lowYear, lowMonth] = lowest.month.split('-');

console.log(`   📈 Högsta månad: ${monthNames[highMonth]} ${highYear} (${highest.total.toFixed(2)} SEK)`);
console.log(`   📉 Lägsta månad: ${monthNames[lowMonth]} ${lowYear} (${lowest.total.toFixed(2)} SEK)`);
console.log(`   📊 Skillnad: ${(highest.total - lowest.total).toFixed(2)} SEK\n`);

// Genomsnitt per dag
const firstDate = new Date(sortedMonths[0] + '-01');
const lastDate = new Date(sortedMonths[sortedMonths.length - 1] + '-01');
const monthsDiff = ((lastDate - firstDate) / (1000 * 60 * 60 * 24)) / 30.44 + 1;
const daysDiff = monthsDiff * 30.44;

console.log(`   💰 Genomsnitt per dag: ${(grandTotal / daysDiff).toFixed(2)} SEK`);
console.log(`   🛒 Genomsnitt antal inköp per månad: ${(grandCount / sortedMonths.length).toFixed(1)} st\n`);

console.log('═══════════════════════════════════════════════════════════════\n');
console.log('📊 VISUELL FÖRDELNING (totalt):\n');

const willysBar = '█'.repeat(Math.round(willysPercent / 2));
const icaBar = '█'.repeat(Math.round(icaPercent / 2));

console.log(`Willys ${willysBar} ${willysPercent.toFixed(1)}%`);
console.log(`ICA    ${icaBar} ${icaPercent.toFixed(1)}%\n`);

console.log('═══════════════════════════════════════════════════════════════\n');
console.log('📊 ÅRSPROGNOS:\n');

const yearlyEstimate = (grandTotal / monthsDiff) * 12;

console.log(`   Baserat på ${monthsDiff.toFixed(1)} månaders data:`);
console.log(`   💵 Beräknad årskostnad: ${yearlyEstimate.toFixed(2)} SEK`);
console.log(`   📅 Det är ~${(yearlyEstimate / 12).toFixed(2)} SEK/månad\n`);

console.log('═══════════════════════════════════════════════════════════════\n');
console.log('✅ Sammanställning klar!\n');
