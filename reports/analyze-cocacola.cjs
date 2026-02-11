const data = require('../output/willys-analysis.json');

// Coca-Cola keywords
const colaKeywords = [
  'coca-cola', 'coca cola', 'cocacola', 'coke'
];

let colaItems = [];

for (const receipt of data.receipts) {
  for (const item of receipt.items) {
    const itemLower = item.name.toLowerCase();
    const isCola = colaKeywords.some(keyword => itemLower.includes(keyword));

    if (isCola) {
      colaItems.push({
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
let totalBottles = 0;

for (const item of colaItems) {
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
  totalBottles += item.quantity;
}

// Calculate averages
for (const key in itemStats) {
  itemStats[key].avgPrice = itemStats[key].totalSpent / itemStats[key].count;
}

// Sort by total spent
const sortedBySpending = Object.values(itemStats).sort((a, b) => b.totalSpent - a.totalSpent);
const sortedByFrequency = Object.values(itemStats).sort((a, b) => b.count - a.count);

// Monthly breakdown
const monthlySpending = {};
const monthlyBottles = {};
for (const item of colaItems) {
  if (item.date) {
    const date = new Date(item.date);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

    if (!monthlySpending[monthKey]) {
      monthlySpending[monthKey] = 0;
      monthlyBottles[monthKey] = 0;
    }
    monthlySpending[monthKey] += item.price;
    monthlyBottles[monthKey] += item.quantity;
  }
}

// Estimate liters
const estimateLiters = () => {
  let totalLiters = 0;
  for (const item of colaItems) {
    const name = item.name.toLowerCase();
    if (name.includes('1,5l') || name.includes('1.5l')) {
      totalLiters += item.quantity * 1.5;
    } else if (name.includes('2l') || name.includes('2,0l')) {
      totalLiters += item.quantity * 2;
    } else if (name.includes('33cl') || name.includes('0,33')) {
      totalLiters += item.quantity * 0.33;
    } else if (name.includes('50cl') || name.includes('0,5')) {
      totalLiters += item.quantity * 0.5;
    } else {
      // Default guess for unknown sizes (assume 1.5L)
      totalLiters += item.quantity * 1.5;
    }
  }
  return totalLiters;
};

const totalLiters = estimateLiters();

console.log('╔════════════════════════════════════════════════════════╗');
console.log('║        🥤 COCA-COLA STATISTIK 🥤                       ║');
console.log('╚════════════════════════════════════════════════════════╝\n');

console.log('📊 SAMMANFATTNING:\n');
console.log('  💰 Total kostnad: ' + totalSpent.toFixed(2) + ' SEK');
console.log('  🛒 Antal köptillfällen: ' + colaItems.length + ' st');
console.log('  🍾 Totalt antal flaskor/burkar: ' + totalBottles + ' st');
console.log('  📏 Uppskattad volym: ' + totalLiters.toFixed(1) + ' liter');
console.log('  📈 Genomsnittspris per köp: ' + (totalSpent / colaItems.length).toFixed(2) + ' SEK');
console.log('  📅 Kostnad per månad (snitt): ' + (totalSpent / 8).toFixed(2) + ' SEK/mån');
console.log('  💧 Liter per månad (snitt): ' + (totalLiters / 8).toFixed(1) + ' L/mån');
console.log('  💵 Andel av totala matköpen: ' + ((totalSpent / 98726.25) * 100).toFixed(1) + '%\n');

console.log('═══════════════════════════════════════════════════════════\n');
console.log('🏆 PRODUKTER SORTERADE EFTER UTGIFT:\n');

sortedBySpending.forEach((item, idx) => {
  console.log(`${idx + 1}. ${item.name}`);
  console.log(`   📍 Köpt: ${item.count} gånger`);
  console.log(`   💰 Totalt: ${item.totalSpent.toFixed(2)} SEK`);
  console.log(`   💵 Snittpris: ${item.avgPrice.toFixed(2)} SEK/gång`);
  console.log(`   🍾 Antal flaskor: ${item.totalQuantity} st`);
  console.log('');
});

console.log('═══════════════════════════════════════════════════════════\n');
console.log('📅 MÅNADSKONSUMTION:\n');

const sortedMonths = Object.keys(monthlySpending).sort();
sortedMonths.forEach(month => {
  console.log(`  ${month}: ${monthlySpending[month].toFixed(2)} SEK (${monthlyBottles[month]} flaskor/burkar, ~${(monthlyBottles[month] * 1.5).toFixed(1)} L)`);
});

console.log('\n═══════════════════════════════════════════════════════════\n');
console.log('💡 INSIKTER:\n');

// Find most common variant
const mostBought = sortedByFrequency[0];
const mostExpensive = sortedBySpending[0];

console.log(`  • Din mest köpta Coca-Cola: ${mostBought.name} (${mostBought.count} gånger)`);
console.log(`  • Mest pengar på: ${mostExpensive.name} (${mostExpensive.totalSpent.toFixed(2)} SEK)`);
console.log(`  • I genomsnitt köper du Coca-Cola ${(colaItems.length / 152).toFixed(1)} gånger per kvitto`);
console.log(`  • Det är ca ${(totalLiters / 8 / 30).toFixed(1)} liter per dag i genomsnitt`);
console.log(`  • Med ${totalBottles} flaskor under 8 månader = ${(totalBottles / (8 * 30)).toFixed(1)} flaskor per dag`);

// Identify product types
let zeroCount = 0;
let regularCount = 0;
let coffeinFreeCount = 0;

for (const item of colaItems) {
  const name = item.name.toLowerCase();
  if (name.includes('zero') || name.includes('koffeinfri')) {
    if (name.includes('koffeinfri')) coffeinFreeCount += item.quantity;
    else zeroCount += item.quantity;
  } else {
    regularCount += item.quantity;
  }
}

console.log('\n  📊 FÖRDELNING:');
console.log(`     • Coca-Cola Zero: ${zeroCount} flaskor (${((zeroCount/totalBottles)*100).toFixed(1)}%)`);
console.log(`     • Koffeinfri Zero: ${coffeinFreeCount} flaskor (${((coffeinFreeCount/totalBottles)*100).toFixed(1)}%)`);
console.log(`     • Vanlig Coca-Cola: ${regularCount} flaskor (${((regularCount/totalBottles)*100).toFixed(1)}%)`);
