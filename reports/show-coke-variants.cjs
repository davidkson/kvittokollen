#!/usr/bin/env node

const fs = require('fs');

const willysData = JSON.parse(fs.readFileSync('../output/willys-analysis.json', 'utf8'));
const icaData = JSON.parse(fs.readFileSync('../output/ica-analysis.json', 'utf8'));

console.log('╔════════════════════════════════════════════════════════════════╗');
console.log('║         🥤 ALLA COCA COLA ZERO PRODUKTNAMN 🥤                ║');
console.log('╚════════════════════════════════════════════════════════════════╝\n');

const cokePattern = /coca.{0,5}cola.{0,10}zero|cola.{0,5}zero|coke.{0,5}zero|koffeinfri.{0,5}zero/i;

const products = {};

function collectProducts(receipts, chain) {
  for (const receipt of receipts) {
    for (const item of receipt.items || []) {
      if (cokePattern.test(item.name) && item.totalPrice >= 0) {
        const name = item.name;

        if (!products[name]) {
          products[name] = {
            count: 0,
            totalCost: 0,
            quantity: 0,
            chain
          };
        }

        products[name].count++;
        products[name].totalCost += item.totalPrice;
        products[name].quantity += item.quantity;
      }
    }
  }
}

collectProducts(willysData.receipts, 'Willys');
collectProducts(icaData.receipts, 'ICA');

console.log('═══════════════════════════════════════════════════════════════\n');
console.log('📋 ALLA PRODUKTNAMN SOM MATCHAR "COCA COLA ZERO":\n');

const sortedProducts = Object.entries(products)
  .sort((a, b) => b[1].totalCost - a[1].totalCost);

let grandTotal = 0;
let grandCount = 0;
let grandQuantity = 0;

sortedProducts.forEach(([name, data], idx) => {
  console.log(`${(idx + 1).toString().padStart(2)}. ${name}`);
  console.log(`    💰 ${data.totalCost.toFixed(2)} SEK | 🛒 ${data.count} köp | 📦 ${data.quantity} st | 🏪 ${data.chain}\n`);

  grandTotal += data.totalCost;
  grandCount += data.count;
  grandQuantity += data.quantity;
});

console.log('═══════════════════════════════════════════════════════════════\n');
console.log('📊 SUMMA:\n');
console.log(`   💰 Total kostnad: ${grandTotal.toFixed(2)} SEK`);
console.log(`   🛒 Totalt köp: ${grandCount}`);
console.log(`   📦 Totalt enheter: ${grandQuantity}`);
console.log(`   📋 Antal olika produktnamn: ${sortedProducts.length}\n`);

console.log('═══════════════════════════════════════════════════════════════\n');
console.log('💡 FÖRKLARING:\n');
console.log('   I "topp-produkter" listan räknas varje unikt produktnamn');
console.log('   separat. Samma produkt kan ha olika namn beroende på:');
console.log('   - Storlek (1.5L, 33cl, 4-pack, etc.)');
console.log('   - Variant (koffeinfri, vanlig, etc.)');
console.log('   - Hur butiken skriver det på kvittot\n');
console.log('   Därför kan du inte se hela summan på en rad - den är');
console.log(`   uppdelad på ${sortedProducts.length} olika produktnamn!\n`);

console.log('═══════════════════════════════════════════════════════════════\n');
console.log('✅ Analys klar!\n');
