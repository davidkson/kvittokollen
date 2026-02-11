#!/usr/bin/env node

const fs = require('fs');

const willysData = JSON.parse(fs.readFileSync('../output/willys-analysis.json', 'utf8'));
const icaData = JSON.parse(fs.readFileSync('../output/ica-analysis.json', 'utf8'));

console.log('╔════════════════════════════════════════════════════════════════╗');
console.log('║              🔍 VARUANALYS - UTMÄRKANDE VAROR                 ║');
console.log('╚════════════════════════════════════════════════════════════════╝\n');

// Samla alla varor
const allItems = [];

for (const receipt of willysData.receipts) {
  const date = receipt.metadata?.date || '';
  for (const item of receipt.items || []) {
    allItems.push({
      ...item,
      date,
      chain: 'Willys'
    });
  }
}

for (const receipt of icaData.receipts) {
  const date = receipt.metadata?.date || '';
  for (const item of receipt.items || []) {
    allItems.push({
      ...item,
      date,
      chain: 'ICA'
    });
  }
}

console.log(`📦 Totalt antal varor: ${allItems.length}\n`);

console.log('═══════════════════════════════════════════════════════════════\n');
console.log('💎 DYRASTE ENSKILDA VAROR (topp 30):\n');

const sortedByPrice = [...allItems].sort((a, b) => b.totalPrice - a.totalPrice);

sortedByPrice.slice(0, 30).forEach((item, idx) => {
  const date = item.date ? new Date(item.date).toISOString().split('T')[0] : 'N/A';
  console.log(`${idx + 1}. ${item.name}`);
  console.log(`   💵 ${item.totalPrice.toFixed(2)} SEK (${item.quantity} st × ${item.unitPrice.toFixed(2)} SEK)`);
  console.log(`   🏪 ${item.chain} - ${date}\n`);
});

console.log('═══════════════════════════════════════════════════════════════\n');
console.log('🔥 DYRASTE VAROR PER STYCK (unitPrice > 100 SEK):\n');

const expensivePerUnit = allItems
  .filter(item => item.unitPrice > 100)
  .sort((a, b) => b.unitPrice - a.unitPrice)
  .slice(0, 20);

expensivePerUnit.forEach((item, idx) => {
  const date = item.date ? new Date(item.date).toISOString().split('T')[0] : 'N/A';
  console.log(`${idx + 1}. ${item.name}`);
  console.log(`   💰 ${item.unitPrice.toFixed(2)} SEK/st (köpt ${item.quantity} st = ${item.totalPrice.toFixed(2)} SEK)`);
  console.log(`   🏪 ${item.chain} - ${date}\n`);
});

console.log('═══════════════════════════════════════════════════════════════\n');
console.log('📊 MEST KÖPTA VAROR (frekvens):\n');

// Gruppera efter varunamn
const itemFrequency = {};
for (const item of allItems) {
  const name = item.name.toLowerCase();
  if (!itemFrequency[name]) {
    itemFrequency[name] = {
      count: 0,
      totalSpent: 0,
      totalQuantity: 0,
      originalName: item.name,
      chains: new Set()
    };
  }
  itemFrequency[name].count++;
  itemFrequency[name].totalSpent += item.totalPrice;
  itemFrequency[name].totalQuantity += item.quantity;
  itemFrequency[name].chains.add(item.chain);
}

const sortedByFrequency = Object.values(itemFrequency)
  .sort((a, b) => b.count - a.count)
  .slice(0, 20);

sortedByFrequency.forEach((item, idx) => {
  const chains = Array.from(item.chains).join(', ');
  console.log(`${idx + 1}. ${item.originalName}`);
  console.log(`   🔢 Köpt ${item.count} gånger (totalt ${item.totalQuantity.toFixed(1)} st)`);
  console.log(`   💵 Total kostnad: ${item.totalSpent.toFixed(2)} SEK (snitt ${(item.totalSpent/item.count).toFixed(2)} SEK/köp)`);
  console.log(`   🏪 ${chains}\n`);
});

console.log('═══════════════════════════════════════════════════════════════\n');
console.log('💰 VAROR SOM KOSTAT MEST TOTALT:\n');

const sortedByTotalSpent = Object.values(itemFrequency)
  .sort((a, b) => b.totalSpent - a.totalSpent)
  .slice(0, 20);

sortedByTotalSpent.forEach((item, idx) => {
  const chains = Array.from(item.chains).join(', ');
  console.log(`${idx + 1}. ${item.originalName}`);
  console.log(`   💵 Total: ${item.totalSpent.toFixed(2)} SEK (${item.count} köp)`);
  console.log(`   📦 Totalt: ${item.totalQuantity.toFixed(1)} st (snitt ${(item.totalQuantity/item.count).toFixed(1)} st/köp)`);
  console.log(`   🏪 ${chains}\n`);
});

console.log('═══════════════════════════════════════════════════════════════\n');
console.log('🎯 OVANLIGA DYRA VAROR (totalPrice > 200 SEK, ej kött/fisk):\n');

const unusualExpensive = allItems
  .filter(item => {
    const name = item.name.toLowerCase();
    const isFood = /kött|fisk|lax|fläsk|nöt|kalv|lamm|karré|entrecôte|ryggbiff|kotlett|hamburgare|färs|grillfilé/.test(name);
    return item.totalPrice > 200 && !isFood;
  })
  .sort((a, b) => b.totalPrice - a.totalPrice)
  .slice(0, 15);

if (unusualExpensive.length > 0) {
  unusualExpensive.forEach((item, idx) => {
    const date = item.date ? new Date(item.date).toISOString().split('T')[0] : 'N/A';
    console.log(`${idx + 1}. ${item.name}`);
    console.log(`   💵 ${item.totalPrice.toFixed(2)} SEK (${item.quantity} st × ${item.unitPrice.toFixed(2)} SEK)`);
    console.log(`   🏪 ${item.chain} - ${date}\n`);
  });
} else {
  console.log('   Inga ovanliga dyra varor hittades.\n');
}

console.log('═══════════════════════════════════════════════════════════════\n');
console.log('✅ Analys klar!\n');
