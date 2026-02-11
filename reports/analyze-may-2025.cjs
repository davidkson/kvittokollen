#!/usr/bin/env node

const fs = require('fs');

const willysData = JSON.parse(fs.readFileSync('../output/willys-analysis.json', 'utf8'));
const icaData = JSON.parse(fs.readFileSync('../output/ica-analysis.json', 'utf8'));

// Beräkna korrekt total från items (för Willys)
function calculateTotal(receipt) {
  if (!receipt.items || !Array.isArray(receipt.items)) return 0;
  return receipt.items.reduce((sum, item) => sum + (item.totalPrice || 0), 0);
}

// Filtrera kvitton från maj 2025
function getMayReceipts(receipts, chain) {
  const mayReceipts = [];

  for (const receipt of receipts) {
    if (!receipt.metadata || !receipt.metadata.date) continue;

    const date = new Date(receipt.metadata.date);
    if (isNaN(date.getTime())) continue;

    if (date.getFullYear() === 2025 && date.getMonth() === 4) { // Maj = månad 4 (0-indexerad)
      const total = chain === 'willys' ? calculateTotal(receipt) : (receipt.metadata.grandTotal || 0);
      mayReceipts.push({
        date: receipt.metadata.date,
        total: total,
        items: receipt.items || [],
        chain: chain,
        filename: receipt.filename
      });
    }
  }

  return mayReceipts;
}

const willysReceipts = getMayReceipts(willysData.receipts, 'willys');
const icaReceipts = getMayReceipts(icaData.receipts, 'ica');

console.log('╔════════════════════════════════════════════════════════════════╗');
console.log('║              🔍 DETALJANALYS - MAJ 2025                       ║');
console.log('╚════════════════════════════════════════════════════════════════╝\n');

console.log('📅 ÖVERSIKT:\n');
console.log(`   🏪 Willys: ${willysReceipts.length} kvitton`);
console.log(`   🏪 ICA:    ${icaReceipts.length} kvitton`);
console.log(`   📊 Totalt: ${willysReceipts.length + icaReceipts.length} kvitton\n`);

// Sortera kvitton efter totalsumma (högst först)
const allReceipts = [...willysReceipts, ...icaReceipts].sort((a, b) => b.total - a.total);

console.log('═══════════════════════════════════════════════════════════════\n');
console.log('💰 STÖRSTA INKÖPEN (topp 10):\n');

allReceipts.slice(0, 10).forEach((receipt, idx) => {
  console.log(`${idx + 1}. ${receipt.date} - ${receipt.chain.toUpperCase()}`);
  console.log(`   💵 ${receipt.total.toFixed(2)} SEK (${receipt.items.length} varor)`);

  // Visa de 3 dyraste varorna på detta kvitto
  const topItems = receipt.items
    .sort((a, b) => b.totalPrice - a.totalPrice)
    .slice(0, 3);

  topItems.forEach(item => {
    console.log(`      • ${item.name}: ${item.totalPrice.toFixed(2)} SEK (${item.quantity} st)`);
  });
  console.log('');
});

console.log('═══════════════════════════════════════════════════════════════\n');
console.log('🛒 ALLA VAROR - SORTERADE EFTER PRIS:\n');

// Samla alla varor från maj 2025
const allItems = [];
for (const receipt of allReceipts) {
  for (const item of receipt.items) {
    allItems.push({
      name: item.name,
      totalPrice: item.totalPrice,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      date: receipt.date,
      chain: receipt.chain
    });
  }
}

// Sortera efter totalpris
allItems.sort((a, b) => b.totalPrice - a.totalPrice);

// Visa topp 20
console.log('Topp 20 dyraste enskilda varor:\n');
allItems.slice(0, 20).forEach((item, idx) => {
  console.log(`${idx + 1}. ${item.name}`);
  console.log(`   💵 ${item.totalPrice.toFixed(2)} SEK (${item.quantity} st × ${item.unitPrice.toFixed(2)} SEK)`);
  console.log(`   🏪 ${item.chain.toUpperCase()} - ${item.date}\n`);
});

console.log('═══════════════════════════════════════════════════════════════\n');
console.log('📊 KATEGORIER (approximativ gruppering):\n');

// Gruppera varor i kategorier baserat på nyckelord
const categories = {
  'Kattmat': /kattmat|katt|felix|whiskas|sheba|gourmet|perfect fit/i,
  'Kött & Fisk': /kött|fisk|kyckling|lax|fläsk|nöt|korv|bacon|hamburgare/i,
  'Mejeri': /mjölk|ost|yoghurt|fil|smör|grädde/i,
  'Frukt & Grönt': /frukt|grönsak|äpple|banan|tomat|gurka|sallad|paprika/i,
  'Bröd & Bakverk': /bröd|limpa|fralla|bulle|kaka|pasta|ris|mjöl/i,
  'Dryck': /dryck|läsk|juice|vatten|öl|vin|kaffe|te/i,
  'Godis & Snacks': /godis|chips|choklad|snacks|glass/i,
  'Hushåll': /papper|toa|disk|tvål|schampo|tandkräm|tvättmedel/i
};

const categoryTotals = {};
const categoryItems = {};

for (const [category, pattern] of Object.entries(categories)) {
  categoryTotals[category] = 0;
  categoryItems[category] = 0;
}
categoryTotals['Övrigt'] = 0;
categoryItems['Övrigt'] = 0;

for (const item of allItems) {
  let matched = false;
  for (const [category, pattern] of Object.entries(categories)) {
    if (pattern.test(item.name)) {
      categoryTotals[category] += item.totalPrice;
      categoryItems[category]++;
      matched = true;
      break;
    }
  }
  if (!matched) {
    categoryTotals['Övrigt'] += item.totalPrice;
    categoryItems['Övrigt']++;
  }
}

// Sortera kategorier efter totalsumma
const sortedCategories = Object.entries(categoryTotals)
  .sort((a, b) => b[1] - a[1])
  .filter(([_, total]) => total > 0);

const grandTotalItems = allItems.reduce((sum, item) => sum + item.totalPrice, 0);

sortedCategories.forEach(([category, total]) => {
  const percent = (total / grandTotalItems * 100).toFixed(1);
  const count = categoryItems[category];
  console.log(`   ${category}:`);
  console.log(`      ${total.toFixed(2)} SEK (${percent}%) - ${count} varor\n`);
});

console.log('═══════════════════════════════════════════════════════════════\n');
console.log('📈 JÄMFÖRELSE MED ANDRA MÅNADER:\n');

// Beräkna genomsnitt för andra månader
function getMonthlyAverages() {
  const monthly = {};

  for (const receipt of willysData.receipts) {
    if (!receipt.metadata || !receipt.metadata.date) continue;
    const date = new Date(receipt.metadata.date);
    if (isNaN(date.getTime())) continue;

    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    if (!monthly[monthKey]) monthly[monthKey] = { total: 0, count: 0 };

    monthly[monthKey].total += calculateTotal(receipt);
    monthly[monthKey].count++;
  }

  for (const receipt of icaData.receipts) {
    if (!receipt.metadata || !receipt.metadata.date) continue;
    const date = new Date(receipt.metadata.date);
    if (isNaN(date.getTime())) continue;

    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    if (!monthly[monthKey]) monthly[monthKey] = { total: 0, count: 0 };

    monthly[monthKey].total += receipt.metadata.grandTotal || 0;
    monthly[monthKey].count++;
  }

  return monthly;
}

const monthlyData = getMonthlyAverages();
const mayTotal = monthlyData['2025-05']?.total || 0;
const mayCount = monthlyData['2025-05']?.count || 0;

// Beräkna genomsnitt för alla andra månader
const otherMonths = Object.entries(monthlyData)
  .filter(([key]) => key !== '2025-05')
  .map(([_, data]) => data);

const avgOtherMonthsTotal = otherMonths.reduce((sum, m) => sum + m.total, 0) / otherMonths.length;
const avgOtherMonthsCount = otherMonths.reduce((sum, m) => sum + m.count, 0) / otherMonths.length;

console.log(`   Maj 2025:`);
console.log(`      Total: ${mayTotal.toFixed(2)} SEK`);
console.log(`      Inköp: ${mayCount} st`);
console.log(`      Snitt: ${(mayTotal / mayCount).toFixed(2)} SEK/inköp\n`);

console.log(`   Genomsnitt andra månader:`);
console.log(`      Total: ${avgOtherMonthsTotal.toFixed(2)} SEK`);
console.log(`      Inköp: ${avgOtherMonthsCount.toFixed(1)} st`);
console.log(`      Snitt: ${(avgOtherMonthsTotal / avgOtherMonthsCount).toFixed(2)} SEK/inköp\n`);

const diffPercent = ((mayTotal - avgOtherMonthsTotal) / avgOtherMonthsTotal * 100).toFixed(1);
console.log(`   📊 Maj 2025 var ${diffPercent}% dyrare än genomsnittet\n`);

console.log('═══════════════════════════════════════════════════════════════\n');
console.log('✅ Analys klar!\n');
