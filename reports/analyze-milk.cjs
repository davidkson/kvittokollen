#!/usr/bin/env node

const fs = require('fs');

const willysData = JSON.parse(fs.readFileSync('../output/willys-analysis.json', 'utf8'));
const icaData = JSON.parse(fs.readFileSync('../output/ica-analysis.json', 'utf8'));

console.log('╔════════════════════════════════════════════════════════════════╗');
console.log('║              🥛 MJÖLKANALYS - DETALJERAD ÖVERSIKT             ║');
console.log('╚════════════════════════════════════════════════════════════════╝\n');

// Samla alla mjölkprodukter
const milkItems = [];

for (const receipt of willysData.receipts) {
  const date = receipt.metadata?.date || '';
  for (const item of receipt.items || []) {
    if (/mjölk/i.test(item.name) && !/choklad|helnöt|daim|katt|kex|cookie|snickers|twix|mars|bounty/i.test(item.name)) {
      milkItems.push({
        ...item,
        date,
        chain: 'Willys'
      });
    }
  }
}

for (const receipt of icaData.receipts) {
  const date = receipt.metadata?.date || '';
  for (const item of receipt.items || []) {
    if (/mjölk/i.test(item.name) && !/choklad|helnöt|daim|katt|kex|cookie|snickers|twix|mars|bounty/i.test(item.name)) {
      milkItems.push({
        ...item,
        date,
        chain: 'ICA'
      });
    }
  }
}

console.log(`📦 Totalt antal mjölkköp: ${milkItems.length}\n`);

// Gruppera per typ
const milkTypes = {};
for (const item of milkItems) {
  const name = item.name;
  if (!milkTypes[name]) {
    milkTypes[name] = {
      count: 0,
      totalLiters: 0,
      totalCost: 0,
      items: []
    };
  }
  milkTypes[name].count++;
  milkTypes[name].totalCost += item.totalPrice;
  milkTypes[name].items.push(item);

  // Försök extrahera volym från produktnamn
  let litersPerUnit = 1; // Standard 1 liter
  if (/0,5|500ml|5dl/i.test(name)) litersPerUnit = 0.5;
  if (/1,5|1\.5|1500ml|15dl/i.test(name)) litersPerUnit = 1.5;
  if (/2l|2000ml|20dl/i.test(name)) litersPerUnit = 2;

  milkTypes[name].totalLiters += item.quantity * litersPerUnit;
}

console.log('═══════════════════════════════════════════════════════════════\n');
console.log('📊 MJÖLKTYPER OCH VOLYMER:\n');

const sortedTypes = Object.entries(milkTypes)
  .sort((a, b) => b[1].totalLiters - a[1].totalLiters);

let grandTotalLiters = 0;
let grandTotalCost = 0;

sortedTypes.forEach(([name, data], idx) => {
  console.log(`${idx + 1}. ${name}`);
  console.log(`   📦 Köpt: ${data.count} gånger`);
  console.log(`   🥛 Total volym: ${data.totalLiters.toFixed(1)} liter`);
  console.log(`   💵 Total kostnad: ${data.totalCost.toFixed(2)} SEK`);
  console.log(`   💰 Pris per liter: ${(data.totalCost / data.totalLiters).toFixed(2)} SEK/liter\n`);

  grandTotalLiters += data.totalLiters;
  grandTotalCost += data.totalCost;
});

console.log('═══════════════════════════════════════════════════════════════\n');
console.log('📈 TOTALT:\n');

console.log(`   🥛 Total volym mjölk: ${grandTotalLiters.toFixed(1)} liter`);
console.log(`   💵 Total kostnad: ${grandTotalCost.toFixed(2)} SEK`);
console.log(`   💰 Snittpris: ${(grandTotalCost / grandTotalLiters).toFixed(2)} SEK/liter`);
console.log(`   📅 Antal köp: ${milkItems.length}\n`);

// Beräkna månadsförbrukning
const sortedByDate = [...milkItems].sort((a, b) =>
  new Date(a.date) - new Date(b.date)
);

const firstDate = sortedByDate.length > 0 ? new Date(sortedByDate[0].date) : null;
const lastDate = sortedByDate.length > 0 ? new Date(sortedByDate[sortedByDate.length - 1].date) : null;

if (firstDate && lastDate) {
  const daysDiff = (lastDate - firstDate) / (1000 * 60 * 60 * 24);
  const monthsDiff = daysDiff / 30.44;

  console.log(`   📆 Period: ${firstDate.toISOString().split('T')[0]} till ${lastDate.toISOString().split('T')[0]}`);
  console.log(`   📊 Antal månader: ${monthsDiff.toFixed(1)}`);
  console.log(`   🥛 Förbrukning: ${(grandTotalLiters / monthsDiff).toFixed(1)} liter/månad\n`);
}

console.log('═══════════════════════════════════════════════════════════════\n');
console.log('📅 PER MÅNAD:\n');

// Gruppera per månad
const monthlyMilk = {};
for (const item of milkItems) {
  if (!item.date) continue;
  const date = new Date(item.date);
  const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

  if (!monthlyMilk[monthKey]) {
    monthlyMilk[monthKey] = {
      liters: 0,
      cost: 0,
      count: 0
    };
  }

  // Försök extrahera volym
  let litersPerUnit = 1;
  if (/0,5|500ml|5dl/i.test(item.name)) litersPerUnit = 0.5;
  if (/1,5|1\.5|1500ml|15dl/i.test(item.name)) litersPerUnit = 1.5;
  if (/2l|2000ml|20dl/i.test(item.name)) litersPerUnit = 2;

  monthlyMilk[monthKey].liters += item.quantity * litersPerUnit;
  monthlyMilk[monthKey].cost += item.totalPrice;
  monthlyMilk[monthKey].count++;
}

const sortedMonths = Object.keys(monthlyMilk).sort();
const monthNames = {
  '01': 'Januari', '02': 'Februari', '03': 'Mars', '04': 'April',
  '05': 'Maj', '06': 'Juni', '07': 'Juli', '08': 'Augusti',
  '09': 'September', '10': 'Oktober', '11': 'November', '12': 'December'
};

sortedMonths.forEach(monthKey => {
  const [year, month] = monthKey.split('-');
  const data = monthlyMilk[monthKey];
  console.log(`   ${monthNames[month]} ${year}:`);
  console.log(`      🥛 ${data.liters.toFixed(1)} liter (${data.count} köp)`);
  console.log(`      💵 ${data.cost.toFixed(2)} SEK (${(data.cost / data.liters).toFixed(2)} SEK/liter)\n`);
});

console.log('═══════════════════════════════════════════════════════════════\n');
console.log('🏪 PER BUTIK:\n');

const willysMilk = milkItems.filter(m => m.chain === 'Willys');
const icaMilk = milkItems.filter(m => m.chain === 'ICA');

const willysLiters = willysMilk.reduce((sum, item) => {
  let litersPerUnit = 1;
  if (/0,5|500ml|5dl/i.test(item.name)) litersPerUnit = 0.5;
  if (/1,5|1\.5|1500ml|15dl/i.test(item.name)) litersPerUnit = 1.5;
  if (/2l|2000ml|20dl/i.test(item.name)) litersPerUnit = 2;
  return sum + (item.quantity * litersPerUnit);
}, 0);

const icaLiters = icaMilk.reduce((sum, item) => {
  let litersPerUnit = 1;
  if (/0,5|500ml|5dl/i.test(item.name)) litersPerUnit = 0.5;
  if (/1,5|1\.5|1500ml|15dl/i.test(item.name)) litersPerUnit = 1.5;
  if (/2l|2000ml|20dl/i.test(item.name)) litersPerUnit = 2;
  return sum + (item.quantity * litersPerUnit);
}, 0);

const willysCost = willysMilk.reduce((sum, item) => sum + item.totalPrice, 0);
const icaCost = icaMilk.reduce((sum, item) => sum + item.totalPrice, 0);

console.log(`   Willys:`);
console.log(`      🥛 ${willysLiters.toFixed(1)} liter (${willysMilk.length} köp)`);
console.log(`      💵 ${willysCost.toFixed(2)} SEK (${(willysCost / willysLiters).toFixed(2)} SEK/liter)\n`);

console.log(`   ICA:`);
console.log(`      🥛 ${icaLiters.toFixed(1)} liter (${icaMilk.length} köp)`);
console.log(`      💵 ${icaCost.toFixed(2)} SEK (${(icaCost / icaLiters).toFixed(2)} SEK/liter)\n`);

console.log('═══════════════════════════════════════════════════════════════\n');
console.log('💡 INTRESSANTA FAKTA:\n');

console.log(`   🥛 Det motsvarar:`);
console.log(`      • ${(grandTotalLiters / 0.2).toFixed(0)} glas mjölk (à 2dl)`);
console.log(`      • ${(grandTotalLiters / 0.033).toFixed(0)} müsliportioner (à 3.3dl)`);
console.log(`      • ${(grandTotalLiters / 3.785).toFixed(1)} gallon (US)\n`);

const daysTracked = firstDate && lastDate ? (lastDate - firstDate) / (1000 * 60 * 60 * 24) : 0;
if (daysTracked > 0) {
  console.log(`   📊 Daglig förbrukning:`);
  console.log(`      • ${(grandTotalLiters / daysTracked).toFixed(2)} liter/dag`);
  console.log(`      • ${((grandTotalLiters / daysTracked) * 1000).toFixed(0)} ml/dag\n`);
}

console.log('═══════════════════════════════════════════════════════════════\n');
console.log('✅ Analys klar!\n');
