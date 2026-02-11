#!/usr/bin/env node

const fs = require('fs');

const willysData = JSON.parse(fs.readFileSync('../output/willys-analysis.json', 'utf8'));
const icaData = JSON.parse(fs.readFileSync('../output/ica-analysis.json', 'utf8'));

// Keywords for cat food
const catFoodKeywords = /kattmat|katt|felix|whiskas|sheba|gourmet|perfect fit|whis|kattstick|kattsnacks/i;
const excludePattern = /mjölk/i;

// ICA-specifika mönster (tonfisk/lax med sås/mousse/filet = kattmat)
function isLikelyCatFood(name, price) {
  // Exkludera uppenbart mänsklig mat
  if (/bröd|ost|yoghurt|korv|hamburgare|pizza|soppa|grädde|smör|sallad|pasta|ris/i.test(name)) {
    return false;
  }

  // ICA-mönster: Fisk + textur + lågt pris = kattmat
  const hasFish = /tonfisk|lax|fisk/i.test(name);
  const hasTexture = /sås|mousse|filet|paté|gelé/i.test(name);
  const lowPrice = price < 100;

  if (hasFish && hasTexture && lowPrice) {
    return true;
  }

  return false;
}

function findCatFood(data, store) {
  const items = [];
  let totalSpent = 0;
  let totalQuantity = 0;

  for (const receipt of data.receipts) {
    for (const item of receipt.items) {
      const matchesPattern = catFoodKeywords.test(item.name);
      const isIcaCatFood = isLikelyCatFood(item.name, item.totalPrice);
      const notMilk = !excludePattern.test(item.name);
      const notDiscount = item.totalPrice >= 0;

      if (notMilk && notDiscount && (matchesPattern || isIcaCatFood)) {
        items.push({
          name: item.name,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          totalPrice: item.totalPrice,
          date: receipt.metadata.date,
          store: receipt.metadata.store
        });
        totalSpent += item.totalPrice;
        totalQuantity += item.quantity;
      }
    }
  }

  return { items, totalSpent, totalQuantity, store };
}

const willysResult = findCatFood(willysData, 'Willys');
const icaResult = findCatFood(icaData, 'ICA');

console.log('╔════════════════════════════════════════════════════════════════╗');
console.log('║              🐱 KATTMAT - JÄMFÖRELSE 🐱                       ║');
console.log('╚════════════════════════════════════════════════════════════════╝\n');

console.log('📊 SAMMANFATTNING:\n');
console.log(`🏪 Willys:`);
console.log(`   💰 Totalt: ${willysResult.totalSpent.toFixed(2)} SEK`);
console.log(`   📦 Antal köp: ${willysResult.items.length} st`);
console.log(`   🔢 Totalt antal: ${willysResult.totalQuantity.toFixed(1)} st`);
console.log(`   📊 Snitt: ${willysResult.items.length > 0 ? (willysResult.totalSpent / willysResult.items.length).toFixed(2) : 0} SEK/köp\n`);

console.log(`🏪 ICA:`);
console.log(`   💰 Totalt: ${icaResult.totalSpent.toFixed(2)} SEK`);
console.log(`   📦 Antal köp: ${icaResult.items.length} st`);
console.log(`   🔢 Totalt antal: ${icaResult.totalQuantity.toFixed(1)} st`);
console.log(`   📊 Snitt: ${icaResult.items.length > 0 ? (icaResult.totalSpent / icaResult.items.length).toFixed(2) : 0} SEK/köp\n`);

const grandTotal = willysResult.totalSpent + icaResult.totalSpent;
console.log(`💰 TOTALT SPENDERAT PÅ KATTMAT: ${grandTotal.toFixed(2)} SEK\n`);

console.log('═══════════════════════════════════════════════════════════════\n');
console.log('📋 WILLYS - KATTMATSINKÖP:\n');

const willysByProduct = {};
willysResult.items.forEach(item => {
  if (!willysByProduct[item.name]) {
    willysByProduct[item.name] = { count: 0, quantity: 0, total: 0 };
  }
  willysByProduct[item.name].count++;
  willysByProduct[item.name].quantity += item.quantity;
  willysByProduct[item.name].total += item.totalPrice;
});

Object.entries(willysByProduct)
  .sort((a, b) => b[1].total - a[1].total)
  .forEach(([name, data]) => {
    console.log(`   ${name}`);
    console.log(`      ${data.count} köp × ${(data.quantity / data.count).toFixed(1)} st = ${data.quantity.toFixed(0)} st totalt (${data.total.toFixed(2)} SEK)`);
  });

console.log('\n═══════════════════════════════════════════════════════════════\n');
console.log('📋 ICA - KATTMATSINKÖP:\n');

const icaByProduct = {};
icaResult.items.forEach(item => {
  if (!icaByProduct[item.name]) {
    icaByProduct[item.name] = { count: 0, quantity: 0, total: 0 };
  }
  icaByProduct[item.name].count++;
  icaByProduct[item.name].quantity += item.quantity;
  icaByProduct[item.name].total += item.totalPrice;
});

Object.entries(icaByProduct)
  .sort((a, b) => b[1].total - a[1].total)
  .forEach(([name, data]) => {
    console.log(`   ${name}`);
    console.log(`      ${data.count} köp × ${(data.quantity / data.count).toFixed(1)} st = ${data.quantity.toFixed(0)} st totalt (${data.total.toFixed(2)} SEK)`);
  });

console.log('\n═══════════════════════════════════════════════════════════════\n');

// Visual comparison
const willysPercent = grandTotal > 0 ? (willysResult.totalSpent / grandTotal * 100) : 0;
const icaPercent = grandTotal > 0 ? (icaResult.totalSpent / grandTotal * 100) : 0;

console.log('📊 VISUELL FÖRDELNING:\n');
const willysBar = '█'.repeat(Math.round(willysPercent / 2));
const icaBar = '█'.repeat(Math.round(icaPercent / 2));

console.log(`Willys ${willysBar} ${willysPercent.toFixed(1)}%`);
console.log(`ICA    ${icaBar} ${icaPercent.toFixed(1)}%\n`);

console.log('═══════════════════════════════════════════════════════════════\n');
console.log('✅ Analys klar!\n');
