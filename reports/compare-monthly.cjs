#!/usr/bin/env node

const fs = require('fs');

const willysData = JSON.parse(fs.readFileSync('../output/willys-analysis.json', 'utf8'));
const icaData = JSON.parse(fs.readFileSync('../output/ica-analysis.json', 'utf8'));

// Svenska månadnamn
const monthNames = {
  '01': 'Januari', '02': 'Februari', '03': 'Mars', '04': 'April',
  '05': 'Maj', '06': 'Juni', '07': 'Juli', '08': 'Augusti',
  '09': 'September', '10': 'Oktober', '11': 'November', '12': 'December'
};

// Beräkna korrekt total från items
function calculateTotal(receipt) {
  if (!receipt.items || !Array.isArray(receipt.items)) return 0;
  return receipt.items.reduce((sum, item) => sum + (item.totalPrice || 0), 0);
}

// Gruppera kvitton per månad
function groupByMonth(receipts, chain) {
  const monthly = {};

  for (const receipt of receipts) {
    if (!receipt.metadata || !receipt.metadata.date) continue;

    const date = new Date(receipt.metadata.date);
    if (isNaN(date.getTime())) continue;

    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

    if (!monthly[monthKey]) {
      monthly[monthKey] = {
        willys: { count: 0, total: 0 },
        ica: { count: 0, total: 0 }
      };
    }

    // För Willys: beräkna från items (grandTotal är fel)
    // För ICA: använd grandTotal (är korrekt)
    const total = chain === 'willys' ? calculateTotal(receipt) : (receipt.metadata.grandTotal || 0);

    if (chain === 'willys') {
      monthly[monthKey].willys.count++;
      monthly[monthKey].willys.total += total;
    } else {
      monthly[monthKey].ica.count++;
      monthly[monthKey].ica.total += total;
    }
  }

  return monthly;
}

// Samla data från båda kedjorna
const willysMonthly = groupByMonth(willysData.receipts, 'willys');
const icaMonthly = groupByMonth(icaData.receipts, 'ica');

// Kombinera månader
const allMonths = new Set([...Object.keys(willysMonthly), ...Object.keys(icaMonthly)]);
const combined = {};

for (const month of allMonths) {
  combined[month] = {
    willys: willysMonthly[month]?.willys || { count: 0, total: 0 },
    ica: icaMonthly[month]?.ica || { count: 0, total: 0 }
  };
}

// Sortera månader
const sortedMonths = Object.keys(combined).sort();

console.log('╔════════════════════════════════════════════════════════════════╗');
console.log('║           📊 MÅNADSVIS JÄMFÖRELSE - WILLYS VS ICA             ║');
console.log('╚════════════════════════════════════════════════════════════════╝\n');

// Beräkna totaler
let totalWillysCount = 0;
let totalWillysSEK = 0;
let totalIcaCount = 0;
let totalIcaSEK = 0;

sortedMonths.forEach((monthKey, idx) => {
  const [year, month] = monthKey.split('-');
  const monthName = monthNames[month];
  const data = combined[monthKey];

  const willysCount = data.willys.count;
  const willysSEK = data.willys.total;
  const icaCount = data.ica.count;
  const icaSEK = data.ica.total;

  const monthTotal = willysSEK + icaSEK;
  const totalCount = willysCount + icaCount;

  totalWillysCount += willysCount;
  totalWillysSEK += willysSEK;
  totalIcaCount += icaCount;
  totalIcaSEK += icaSEK;

  const willysPercent = monthTotal > 0 ? (willysSEK / monthTotal * 100) : 0;
  const icaPercent = monthTotal > 0 ? (icaSEK / monthTotal * 100) : 0;

  console.log(`${idx + 1}. ${monthName} ${year}`);
  console.log(`   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`   💰 Totalt: ${monthTotal.toFixed(2)} SEK (${totalCount} inköp)`);
  console.log('');
  console.log(`   🏪 Willys:`);
  console.log(`      Inköp:  ${willysCount} st`);
  console.log(`      Summa:  ${willysSEK.toFixed(2)} SEK (${willysPercent.toFixed(1)}%)`);
  console.log(`      Snitt:  ${willysCount > 0 ? (willysSEK / willysCount).toFixed(2) : '0.00'} SEK/inköp`);
  console.log('');
  console.log(`   🏪 ICA:`);
  console.log(`      Inköp:  ${icaCount} st`);
  console.log(`      Summa:  ${icaSEK.toFixed(2)} SEK (${icaPercent.toFixed(1)}%)`);
  console.log(`      Snitt:  ${icaCount > 0 ? (icaSEK / icaCount).toFixed(2) : '0.00'} SEK/inköp`);
  console.log('');
});

console.log('═══════════════════════════════════════════════════════════════\n');
console.log('📊 TOTALT ÖVER ALLA MÅNADER:\n');

const grandTotal = totalWillysSEK + totalIcaSEK;
const grandCount = totalWillysCount + totalIcaCount;

console.log(`   💰 Total kostnad: ${grandTotal.toFixed(2)} SEK`);
console.log(`   🛒 Totalt inköp: ${grandCount} st`);
console.log(`   📅 Antal månader: ${sortedMonths.length}\n`);

console.log('   PER BUTIK:\n');
console.log(`   🏪 Willys:`);
console.log(`      Inköp:  ${totalWillysCount} st (${(totalWillysCount/grandCount*100).toFixed(1)}%)`);
console.log(`      Summa:  ${totalWillysSEK.toFixed(2)} SEK (${(totalWillysSEK/grandTotal*100).toFixed(1)}%)`);
console.log(`      Snitt:  ${(totalWillysSEK/totalWillysCount).toFixed(2)} SEK/inköp\n`);

console.log(`   🏪 ICA:`);
console.log(`      Inköp:  ${totalIcaCount} st (${(totalIcaCount/grandCount*100).toFixed(1)}%)`);
console.log(`      Summa:  ${totalIcaSEK.toFixed(2)} SEK (${(totalIcaSEK/grandTotal*100).toFixed(1)}%)`);
console.log(`      Snitt:  ${(totalIcaSEK/totalIcaCount).toFixed(2)} SEK/inköp\n`);

console.log('═══════════════════════════════════════════════════════════════\n');
console.log('📈 INKÖPSFREKVENS PER MÅNAD (GENOMSNITT):\n');

const avgWillysPerMonth = totalWillysCount / sortedMonths.length;
const avgIcaPerMonth = totalIcaCount / sortedMonths.length;
const avgTotalPerMonth = grandCount / sortedMonths.length;

console.log(`   🏪 Willys: ${avgWillysPerMonth.toFixed(1)} inköp/månad`);
console.log(`   🏪 ICA:    ${avgIcaPerMonth.toFixed(1)} inköp/månad`);
console.log(`   📊 Totalt: ${avgTotalPerMonth.toFixed(1)} inköp/månad\n`);

console.log('═══════════════════════════════════════════════════════════════\n');
console.log('📊 VISUELL FÖRDELNING (antal inköp):\n');

const willysBar = '█'.repeat(Math.round(totalWillysCount / grandCount * 50));
const icaBar = '█'.repeat(Math.round(totalIcaCount / grandCount * 50));

console.log(`Willys ${willysBar} ${(totalWillysCount/grandCount*100).toFixed(1)}%`);
console.log(`ICA    ${icaBar} ${(totalIcaCount/grandCount*100).toFixed(1)}%\n`);

console.log('═══════════════════════════════════════════════════════════════\n');
console.log('✅ Analys klar!\n');
