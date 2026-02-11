const data = require('../output/willys-analysis.json');

// Cat food keywords (Swedish)
const catFoodKeywords = [
  'saucelover', 'kattmat', 'whiskas', 'felix', 'sheba',
  'multibox fisk', 'filet kyckl', 'filet tonf', "nature's kyckling",
  'våtfoder', 'torrfoder', 'kattgodis', 'nature`s'
];

let catFoodItems = [];

for (const receipt of data.receipts) {
  for (const item of receipt.items) {
    const itemLower = item.name.toLowerCase();
    const isCatFood = catFoodKeywords.some(keyword => itemLower.includes(keyword));

    if (isCatFood) {
      catFoodItems.push({
        name: item.name,
        quantity: item.quantity || 1,
        price: item.totalPrice,
        date: receipt.metadata.date
      });
    }
  }
}

// Aggregate by item name
const itemStats = {};
let totalSpent = 0;
let totalQuantity = 0;

for (const item of catFoodItems) {
  if (!itemStats[item.name]) {
    itemStats[item.name] = {
      name: item.name,
      count: 0,
      totalSpent: 0,
      totalQuantity: 0,
      avgPrice: 0
    };
  }

  itemStats[item.name].count++;
  itemStats[item.name].totalSpent += item.price;
  itemStats[item.name].totalQuantity += item.quantity;
  totalSpent += item.price;
  totalQuantity += item.quantity;
}

// Calculate averages
for (const key in itemStats) {
  itemStats[key].avgPrice = itemStats[key].totalSpent / itemStats[key].count;
}

// Sort by frequency
const sortedItems = Object.values(itemStats).sort((a, b) => b.count - a.count);

// Monthly breakdown
const monthlySpending = {};
for (const item of catFoodItems) {
  if (item.date) {
    const date = new Date(item.date);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

    if (!monthlySpending[monthKey]) {
      monthlySpending[monthKey] = 0;
    }
    monthlySpending[monthKey] += item.price;
  }
}

console.log('╔════════════════════════════════════════════════════════╗');
console.log('║           🐱 KATTMATSSTATISTIK 🐱                      ║');
console.log('╚════════════════════════════════════════════════════════╝\n');

console.log('📊 SAMMANFATTNING:\n');
console.log('  💰 Total kostnad för kattmat: ' + totalSpent.toFixed(2) + ' SEK');
console.log('  🛒 Totalt antal köptillfällen: ' + catFoodItems.length + ' st');
console.log('  📦 Totalt antal påsar/burkar: ' + totalQuantity.toFixed(0) + ' st');
console.log('  📈 Genomsnittspris per köp: ' + (totalSpent / catFoodItems.length).toFixed(2) + ' SEK');
console.log('  📅 Kostnad per månad (snitt): ' + (totalSpent / 8).toFixed(2) + ' SEK/mån');
console.log('  💵 Andel av totala matköpen: ' + ((totalSpent / 98726.25) * 100).toFixed(1) + '%\n');

console.log('═══════════════════════════════════════════════════════════\n');
console.log('🏆 PRODUKTER SORTERADE EFTER KÖPFREKVENS:\n');

sortedItems.forEach((item, idx) => {
  console.log(`${idx + 1}. ${item.name}`);
  console.log(`   📍 Köpt: ${item.count} gånger`);
  console.log(`   💰 Totalt: ${item.totalSpent.toFixed(2)} SEK`);
  console.log(`   💵 Snittpris: ${item.avgPrice.toFixed(2)} SEK/gång`);
  console.log(`   📦 Antal enheter: ${item.totalQuantity} st`);
  console.log('');
});

console.log('═══════════════════════════════════════════════════════════\n');
console.log('📅 MÅNADSKOSTNAD FÖR KATTMAT:\n');

const sortedMonths = Object.keys(monthlySpending).sort();
sortedMonths.forEach(month => {
  console.log(`  ${month}: ${monthlySpending[month].toFixed(2)} SEK`);
});

console.log('\n═══════════════════════════════════════════════════════════\n');
console.log('💡 INSIKTER:\n');

// Find most expensive item
const mostExpensive = sortedItems.sort((a, b) => b.totalSpent - a.totalSpent)[0];
console.log(`  • Din mest köpta kattmat: ${sortedItems[0].name} (${sortedItems[0].count} gånger)`);
console.log(`  • Mest pengar spenderade på: ${mostExpensive.name} (${mostExpensive.totalSpent.toFixed(2)} SEK)`);
console.log(`  • Billigaste per köp: ${sortedItems.sort((a, b) => a.avgPrice - b.avgPrice)[0].name} (${sortedItems.sort((a, b) => a.avgPrice - b.avgPrice)[0].avgPrice.toFixed(2)} SEK)`);
console.log(`  • I genomsnitt köper du kattmat ${(catFoodItems.length / 152).toFixed(1)} gånger per kvitto`);
