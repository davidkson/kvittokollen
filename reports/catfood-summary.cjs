#!/usr/bin/env node

const fs = require('fs');

const willysData = JSON.parse(fs.readFileSync('../output/willys-analysis.json', 'utf8'));
const icaData = JSON.parse(fs.readFileSync('../output/ica-analysis.json', 'utf8'));

console.log('╔════════════════════════════════════════════════════════════════╗');
console.log('║          🐱 KATTMAT - KOMPLETT SAMMANSTÄLLNING 🐱            ║');
console.log('╚════════════════════════════════════════════════════════════════╝\n');

// Kattmats-filter
const catFoodPattern = /kattmat|felix|whiskas|sheba|gourmet|dreamies|perfect fit|catessy|whis|kattstick|kattsnacks/i;
const excludePattern = /mjölk/i;

function isLikelyCatFood(name, price) {
  if (/bröd|ost|yoghurt|korv|hamburgare|pizza|soppa|grädde|smör|sallad|pasta|ris/i.test(name)) {
    return false;
  }
  const hasFish = /tonfisk|lax|fisk/i.test(name);
  const hasTexture = /sås|mousse|filet|paté|gelé/i.test(name);
  const lowPrice = price < 100;
  return hasFish && hasTexture && lowPrice;
}

// Samla all kattmat
const allCatFood = [];

function collectCatFood(receipts, chain) {
  for (const receipt of receipts) {
    const date = receipt.metadata?.date || '';
    for (const item of receipt.items || []) {
      const matchesPattern = catFoodPattern.test(item.name);
      const isIcaCatFood = isLikelyCatFood(item.name, item.totalPrice);
      const notMilk = !excludePattern.test(item.name);
      const notDiscount = item.totalPrice >= 0;

      if (notMilk && notDiscount && (matchesPattern || isIcaCatFood)) {
        allCatFood.push({
          date,
          chain,
          name: item.name,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          totalPrice: item.totalPrice
        });
      }
    }
  }
}

collectCatFood(willysData.receipts, 'Willys');
collectCatFood(icaData.receipts, 'ICA');

// Gruppera per månad
const monthlyData = {};
for (const item of allCatFood) {
  if (!item.date) continue;
  const date = new Date(item.date);
  const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

  if (!monthlyData[monthKey]) {
    monthlyData[monthKey] = {
      willys: { cost: 0, quantity: 0, count: 0 },
      ica: { cost: 0, quantity: 0, count: 0 }
    };
  }

  if (item.chain === 'Willys') {
    monthlyData[monthKey].willys.cost += item.totalPrice;
    monthlyData[monthKey].willys.quantity += item.quantity;
    monthlyData[monthKey].willys.count++;
  } else {
    monthlyData[monthKey].ica.cost += item.totalPrice;
    monthlyData[monthKey].ica.quantity += item.quantity;
    monthlyData[monthKey].ica.count++;
  }
}

const monthNames = {
  '01': 'Januari', '02': 'Februari', '03': 'Mars', '04': 'April',
  '05': 'Maj', '06': 'Juni', '07': 'Juli', '08': 'Augusti',
  '09': 'September', '10': 'Oktober', '11': 'November', '12': 'December'
};

const sortedMonths = Object.keys(monthlyData).sort();

console.log('═══════════════════════════════════════════════════════════════\n');
console.log('📅 MÅNADSVIS SAMMANSTÄLLNING:\n');

let totalWillysCost = 0;
let totalIcaCost = 0;
let totalWillysQty = 0;
let totalIcaQty = 0;
let totalWillysCount = 0;
let totalIcaCount = 0;

sortedMonths.forEach((monthKey, idx) => {
  const [year, month] = monthKey.split('-');
  const data = monthlyData[monthKey];

  const willysCost = data.willys.cost;
  const icaCost = data.ica.cost;
  const totalCost = willysCost + icaCost;

  const willysQty = data.willys.quantity;
  const icaQty = data.ica.quantity;
  const totalQty = willysQty + icaQty;

  const willysCount = data.willys.count;
  const icaCount = data.ica.count;
  const totalCount = willysCount + icaCount;

  totalWillysCost += willysCost;
  totalIcaCost += icaCost;
  totalWillysQty += willysQty;
  totalIcaQty += icaQty;
  totalWillysCount += willysCount;
  totalIcaCount += icaCount;

  const willysPercent = totalCost > 0 ? (willysCost / totalCost * 100) : 0;
  const icaPercent = totalCost > 0 ? (icaCost / totalCost * 100) : 0;

  console.log(`${monthNames[month]} ${year}:`);
  console.log(`   💰 Totalt:  ${totalCost.toFixed(2)} SEK (${totalQty.toFixed(0)} produkter, ${totalCount} köp)`);

  if (willysCost > 0) {
    console.log(`   🏪 Willys:  ${willysCost.toFixed(2)} SEK (${willysPercent.toFixed(1)}%) - ${willysQty.toFixed(0)} st, ${willysCount} köp`);
  }

  if (icaCost > 0) {
    console.log(`   🏪 ICA:     ${icaCost.toFixed(2)} SEK (${icaPercent.toFixed(1)}%) - ${icaQty.toFixed(0)} st, ${icaCount} köp`);
  }

  console.log('');
});

console.log('═══════════════════════════════════════════════════════════════\n');
console.log('📊 TOTALT ALLA MÅNADER:\n');

const grandTotal = totalWillysCost + totalIcaCost;
const grandQty = totalWillysQty + totalIcaQty;
const grandCount = totalWillysCount + totalIcaCount;

console.log(`   💵 Total kostnad:    ${grandTotal.toFixed(2)} SEK`);
console.log(`   📦 Totalt produkter: ${grandQty.toFixed(0)} st`);
console.log(`   🛒 Totalt köp:       ${grandCount} st\n`);

console.log('   PER BUTIK:\n');

const willysPercent = (totalWillysCost / grandTotal * 100);
const icaPercent = (totalIcaCost / grandTotal * 100);

console.log(`   🏪 Willys:`);
console.log(`      💵 ${totalWillysCost.toFixed(2)} SEK (${willysPercent.toFixed(1)}%)`);
console.log(`      📦 ${totalWillysQty.toFixed(0)} produkter (${totalWillysCount} köp)`);
console.log(`      📊 Snitt: ${(totalWillysCost / totalWillysCount).toFixed(2)} SEK/köp\n`);

console.log(`   🏪 ICA:`);
console.log(`      💵 ${totalIcaCost.toFixed(2)} SEK (${icaPercent.toFixed(1)}%)`);
console.log(`      📦 ${totalIcaQty.toFixed(0)} produkter (${totalIcaCount} köp)`);
console.log(`      📊 Snitt: ${(totalIcaCost / totalIcaCount).toFixed(2)} SEK/köp\n`);

console.log('═══════════════════════════════════════════════════════════════\n');
console.log('📈 GENOMSNITT & PROGNOSER:\n');

const avgPerMonth = grandTotal / sortedMonths.length;
const avgQtyPerMonth = grandQty / sortedMonths.length;

console.log(`   📊 Genomsnitt per månad:`);
console.log(`      💵 ${avgPerMonth.toFixed(2)} SEK`);
console.log(`      📦 ${avgQtyPerMonth.toFixed(1)} produkter\n`);

const firstDate = new Date(sortedMonths[0] + '-01');
const lastDate = new Date(sortedMonths[sortedMonths.length - 1] + '-01');
const monthsDiff = ((lastDate - firstDate) / (1000 * 60 * 60 * 24)) / 30.44 + 1;

const yearlyEstimate = (grandTotal / monthsDiff) * 12;

console.log(`   📅 Beräknad årskostnad:`);
console.log(`      💵 ${yearlyEstimate.toFixed(2)} SEK/år`);
console.log(`      📊 Det är ~${(yearlyEstimate / 12).toFixed(2)} SEK/månad\n`);

console.log('═══════════════════════════════════════════════════════════════\n');
console.log('📊 VISUELL FÖRDELNING:\n');

const willysBar = '█'.repeat(Math.round(willysPercent / 2));
const icaBar = '█'.repeat(Math.round(icaPercent / 2));

console.log(`Willys ${willysBar} ${willysPercent.toFixed(1)}%`);
console.log(`ICA    ${icaBar} ${icaPercent.toFixed(1)}%\n`);

console.log('═══════════════════════════════════════════════════════════════\n');
console.log('✅ Sammanställning klar!\n');
