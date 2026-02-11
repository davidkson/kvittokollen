#!/usr/bin/env node

const fs = require('fs');

const icaData = JSON.parse(fs.readFileSync('../output/ica-analysis.json', 'utf8'));

console.log('╔════════════════════════════════════════════════════════════════╗');
console.log('║         🔍 UNDERSÖKNING - ICA KATTMATSBENÄMNINGAR            ║');
console.log('╚════════════════════════════════════════════════════════════════╝\n');

// Nuvarande filter
const catFoodPattern = /kattmat|felix|whiskas|sheba|gourmet|dreamies|perfect fit|catessy/i;
const excludePattern = /mjölk/i;

console.log('═══════════════════════════════════════════════════════════════\n');
console.log('📋 HITTADE MED NUVARANDE FILTER:\n');

const foundWithCurrentFilter = [];
for (const receipt of icaData.receipts) {
  for (const item of receipt.items || []) {
    if (catFoodPattern.test(item.name) && !excludePattern.test(item.name)) {
      foundWithCurrentFilter.push({
        date: receipt.metadata?.date || '',
        name: item.name,
        price: item.totalPrice,
        quantity: item.quantity
      });
    }
  }
}

foundWithCurrentFilter.sort((a, b) => new Date(a.date) - new Date(b.date));

if (foundWithCurrentFilter.length > 0) {
  foundWithCurrentFilter.forEach((item, idx) => {
    console.log(`${idx + 1}. ${item.date}`);
    console.log(`   ${item.name}`);
    console.log(`   ${item.price.toFixed(2)} SEK (${item.quantity} st)\n`);
  });
} else {
  console.log('   Ingen kattmat hittades.\n');
}

console.log('═══════════════════════════════════════════════════════════════\n');
console.log('🔍 SÖKER EFTER MÖJLIGA KATTMATSPRODUKTER (bred sökning):\n');

// Bred sökning efter möjliga kattmatsprodukter
const possibleCatFood = [];
const searchTerms = [
  'katt', 'fisk', 'sås', 'paté', 'gelé', 'filet',
  'tonfisk', 'lax', 'kyckling', 'lever', 'kött'
];

for (const receipt of icaData.receipts) {
  for (const item of receipt.items || []) {
    const name = item.name.toLowerCase();

    // Skippa uppenbart fel
    if (/mjölk|bröd|ost|yoghurt|korv|hamburgare|pizza|soppa|grädde|smör/i.test(item.name)) {
      continue;
    }

    // Leta efter kombinationer som kan vara kattmat
    const hasCatKeyword = /katt/i.test(item.name);
    const hasFishKeyword = /fisk|tonfisk|lax|räk/i.test(item.name);
    const hasTextureKeyword = /sås|paté|gelé|filet|mousse/i.test(item.name);
    const hasBrandKeyword = /sheba|felix|whiskas|gourmet|catessy|perfect fit|dreamies/i.test(item.name);

    // Om det är uppenbart kattmat eller har kattmat-liknande egenskaper
    if (hasCatKeyword || hasBrandKeyword ||
        (hasFishKeyword && hasTextureKeyword && item.totalPrice < 100)) {
      possibleCatFood.push({
        date: receipt.metadata?.date || '',
        name: item.name,
        price: item.totalPrice,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        reason: hasCatKeyword ? 'Har "katt"' :
                hasBrandKeyword ? 'Känt märke' :
                'Fisk + textur (lågt pris)'
      });
    }
  }
}

// Sortera efter datum
possibleCatFood.sort((a, b) => new Date(a.date) - new Date(b.date));

console.log(`Hittade ${possibleCatFood.length} möjliga kattmatsprodukter:\n`);

possibleCatFood.forEach((item, idx) => {
  console.log(`${idx + 1}. ${item.date}`);
  console.log(`   ${item.name}`);
  console.log(`   ${item.price.toFixed(2)} SEK (${item.quantity} st × ${item.unitPrice.toFixed(2)} SEK)`);
  console.log(`   Anledning: ${item.reason}\n`);
});

console.log('═══════════════════════════════════════════════════════════════\n');
console.log('📊 GRUPPERING PER PRODUKTNAMN:\n');

const grouped = {};
for (const item of possibleCatFood) {
  if (!grouped[item.name]) {
    grouped[item.name] = {
      count: 0,
      totalCost: 0,
      totalQty: 0
    };
  }
  grouped[item.name].count++;
  grouped[item.name].totalCost += item.price;
  grouped[item.name].totalQty += item.quantity;
}

const sorted = Object.entries(grouped)
  .sort((a, b) => b[1].totalCost - a[1].totalCost);

sorted.forEach(([name, data]) => {
  console.log(`${name}`);
  console.log(`   ${data.totalCost.toFixed(2)} SEK (${data.count} köp, ${data.totalQty.toFixed(0)} st)\n`);
});

console.log('═══════════════════════════════════════════════════════════════\n');
console.log('💡 SLUTSATS:\n');

const currentTotal = foundWithCurrentFilter.reduce((sum, item) => sum + item.price, 0);
const possibleTotal = possibleCatFood.reduce((sum, item) => sum + item.price, 0);

console.log(`   Nuvarande filter fångar: ${currentTotal.toFixed(2)} SEK`);
console.log(`   Bred sökning fångar: ${possibleTotal.toFixed(2)} SEK`);
console.log(`   Skillnad: ${(possibleTotal - currentTotal).toFixed(2)} SEK\n`);

console.log('═══════════════════════════════════════════════════════════════\n');
console.log('✅ Undersökning klar!\n');
