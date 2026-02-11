#!/usr/bin/env node

const fs = require('fs');

const willysData = JSON.parse(fs.readFileSync('../output/willys-analysis.json', 'utf8'));
const icaData = JSON.parse(fs.readFileSync('../output/ica-analysis.json', 'utf8'));

console.log('╔════════════════════════════════════════════════════════════════╗');
console.log('║           📊 MEST KÖPTA & DYRASTE PRODUKTER 📊               ║');
console.log('╚════════════════════════════════════════════════════════════════╝\n');

// Samla alla produkter
const products = {};

function collectProducts(receipts, chain) {
  for (const receipt of receipts) {
    for (const item of receipt.items || []) {
      // Skippa negativa belopp (kampanjrabatter)
      if (item.totalPrice < 0) continue;

      const name = item.name;

      if (!products[name]) {
        products[name] = {
          count: 0,
          totalCost: 0,
          totalQuantity: 0,
          chains: new Set(),
          avgPrice: 0
        };
      }

      products[name].count++;
      products[name].totalCost += item.totalPrice;
      products[name].totalQuantity += item.quantity;
      products[name].chains.add(chain);
    }
  }
}

collectProducts(willysData.receipts, 'Willys');
collectProducts(icaData.receipts, 'ICA');

// Beräkna genomsnittspris
for (const name in products) {
  products[name].avgPrice = products[name].totalCost / products[name].count;
}

console.log('═══════════════════════════════════════════════════════════════\n');
console.log('🏆 TOPP 30 - MEST KÖPTA PRODUKTER (antal inköp):\n');

const sortedByCount = Object.entries(products)
  .sort((a, b) => b[1].count - a[1].count)
  .slice(0, 30);

sortedByCount.forEach(([name, data], idx) => {
  const chains = Array.from(data.chains).join(', ');
  console.log(`${(idx + 1).toString().padStart(2)}. ${name}`);
  console.log(`    🛒 ${data.count} gånger | 💰 ${data.totalCost.toFixed(2)} SEK totalt | 📦 ${data.totalQuantity.toFixed(0)} st`);
  console.log(`    📊 Snitt: ${data.avgPrice.toFixed(2)} SEK/köp | 🏪 ${chains}\n`);
});

console.log('═══════════════════════════════════════════════════════════════\n');
console.log('💰 TOPP 30 - DYRASTE PRODUKTER (total kostnad):\n');

const sortedByCost = Object.entries(products)
  .sort((a, b) => b[1].totalCost - a[1].totalCost)
  .slice(0, 30);

sortedByCost.forEach(([name, data], idx) => {
  const chains = Array.from(data.chains).join(', ');
  console.log(`${(idx + 1).toString().padStart(2)}. ${name}`);
  console.log(`    💰 ${data.totalCost.toFixed(2)} SEK totalt | 🛒 ${data.count} köp | 📦 ${data.totalQuantity.toFixed(0)} st`);
  console.log(`    📊 Snitt: ${data.avgPrice.toFixed(2)} SEK/köp | 🏪 ${chains}\n`);
});

console.log('═══════════════════════════════════════════════════════════════\n');
console.log('📊 STATISTIK:\n');

const totalUniqueProducts = Object.keys(products).length;
const totalPurchases = Object.values(products).reduce((sum, p) => sum + p.count, 0);
const totalSpent = Object.values(products).reduce((sum, p) => sum + p.totalCost, 0);

console.log(`   📦 Totalt antal unika produkter: ${totalUniqueProducts}`);
console.log(`   🛒 Totalt antal produktköp: ${totalPurchases}`);
console.log(`   💰 Total kostnad: ${totalSpent.toFixed(2)} SEK`);
console.log(`   📊 Genomsnitt: ${(totalSpent / totalPurchases).toFixed(2)} SEK/produktköp\n`);

console.log('═══════════════════════════════════════════════════════════════\n');
console.log('✅ Analys klar!\n');
