const fs = require('fs');

const willysData = JSON.parse(fs.readFileSync('./output/willys-analysis.json', 'utf8'));
const icaData = JSON.parse(fs.readFileSync('./output/ica-analysis.json', 'utf8'));

// Samla alla produkter med datum och pris
const productPrices = new Map();

// Willys
willysData.receipts.forEach(receipt => {
  const date = new Date(receipt.metadata?.date);
  if (!date || isNaN(date.getTime())) return;

  receipt.items.forEach(item => {
    // Skippa rabatter och pant
    if (item.isDiscount || item.totalPrice < 0) return;
    if (/pant|plastkasse|påse|rabatt|kampanj/i.test(item.name)) return;

    const name = item.name.toLowerCase().trim();
    const unitPrice = item.unitPrice || 0;

    if (unitPrice === 0) return;

    if (!productPrices.has(name)) {
      productPrices.set(name, []);
    }

    productPrices.get(name).push({
      date: date,
      price: unitPrice,
      store: 'Willys',
      quantity: item.quantity || 1
    });
  });
});

// ICA
icaData.receipts.forEach(receipt => {
  const date = new Date(receipt.metadata?.date);
  if (!date || isNaN(date.getTime())) return;

  receipt.items.forEach(item => {
    // Skippa rabatter och pant
    if (item.isDiscount || item.totalPrice < 0) return;
    if (/pant|plastkasse|påse|rabatt|kampanj/i.test(item.name)) return;

    const name = item.name.toLowerCase().trim();
    const unitPrice = item.unitPrice || 0;

    if (unitPrice === 0) return;

    if (!productPrices.has(name)) {
      productPrices.set(name, []);
    }

    productPrices.get(name).push({
      date: date,
      price: unitPrice,
      store: 'ICA',
      quantity: item.quantity || 1
    });
  });
});

// Filtrera produkter som köpts minst 3 gånger över minst 60 dagar
const analyzableProducts = [];

productPrices.forEach((purchases, name) => {
  if (purchases.length < 3) return;

  // Sortera efter datum
  purchases.sort((a, b) => a.date - b.date);

  const firstDate = purchases[0].date;
  const lastDate = purchases[purchases.length - 1].date;
  const daysDiff = (lastDate - firstDate) / (1000 * 60 * 60 * 24);

  if (daysDiff < 60) return; // Minst 60 dagar mellan första och sista köp

  const firstPrice = purchases[0].price;
  const lastPrice = purchases[purchases.length - 1].price;
  const priceChange = lastPrice - firstPrice;
  const percentChange = (priceChange / firstPrice) * 100;

  // Beräkna genomsnittspris för bättre jämförelse
  const avgPrice = purchases.reduce((sum, p) => sum + p.price, 0) / purchases.length;

  analyzableProducts.push({
    name,
    purchases: purchases.length,
    firstDate,
    lastDate,
    firstPrice,
    lastPrice,
    priceChange,
    percentChange,
    avgPrice,
    daysDiff: Math.round(daysDiff),
    allPrices: purchases
  });
});

// Sortera efter procentuell förändring
analyzableProducts.sort((a, b) => Math.abs(b.percentChange) - Math.abs(a.percentChange));

console.log('═══════════════════════════════════════════════════════════════');
console.log('📊 PRISUTVECKLING - PRODUKTER ÖVER TID');
console.log('═══════════════════════════════════════════════════════════════\n');

console.log(`Analyserade ${productPrices.size} unika produkter`);
console.log(`Hittade ${analyzableProducts.length} produkter köpta 3+ gånger över 60+ dagar\n`);

console.log('═══════════════════════════════════════════════════════════════');
console.log('📈 STÖRSTA PRISÖKNINGAR:\n');

const increases = analyzableProducts.filter(p => p.percentChange > 0).slice(0, 10);

increases.forEach((product, i) => {
  console.log(`${i + 1}. ${product.name.toUpperCase()}`);
  console.log(`   📅 ${product.firstDate.toISOString().split('T')[0]} → ${product.lastDate.toISOString().split('T')[0]} (${product.daysDiff} dagar)`);
  console.log(`   💰 ${product.firstPrice.toFixed(2)} SEK → ${product.lastPrice.toFixed(2)} SEK`);
  console.log(`   📈 +${product.priceChange.toFixed(2)} SEK (+${product.percentChange.toFixed(1)}%)`);
  console.log(`   🛒 Köpt ${product.purchases} gånger, snitt ${product.avgPrice.toFixed(2)} SEK`);
  console.log('');
});

console.log('═══════════════════════════════════════════════════════════════');
console.log('📉 STÖRSTA PRISSÄNKNINGAR:\n');

const decreases = analyzableProducts.filter(p => p.percentChange < 0).slice(0, 10);

if (decreases.length > 0) {
  decreases.forEach((product, i) => {
    console.log(`${i + 1}. ${product.name.toUpperCase()}`);
    console.log(`   📅 ${product.firstDate.toISOString().split('T')[0]} → ${product.lastDate.toISOString().split('T')[0]} (${product.daysDiff} dagar)`);
    console.log(`   💰 ${product.firstPrice.toFixed(2)} SEK → ${product.lastPrice.toFixed(2)} SEK`);
    console.log(`   📉 ${product.priceChange.toFixed(2)} SEK (${product.percentChange.toFixed(1)}%)`);
    console.log(`   🛒 Köpt ${product.purchases} gånger, snitt ${product.avgPrice.toFixed(2)} SEK`);
    console.log('');
  });
} else {
  console.log('Inga produkter har blivit billigare!\n');
}

console.log('═══════════════════════════════════════════════════════════════');
console.log('📊 MEST KÖPTA PRODUKTER MED PRISUTVECKLING:\n');

// Sortera efter antal köp
const mostBought = [...analyzableProducts].sort((a, b) => b.purchases - a.purchases).slice(0, 5);

mostBought.forEach((product, i) => {
  const trend = product.percentChange > 0 ? '📈' : product.percentChange < 0 ? '📉' : '➡️';
  const sign = product.percentChange > 0 ? '+' : '';

  console.log(`${i + 1}. ${product.name.toUpperCase()}`);
  console.log(`   🛒 Köpt ${product.purchases} gånger över ${product.daysDiff} dagar`);
  console.log(`   ${trend} ${product.firstPrice.toFixed(2)} → ${product.lastPrice.toFixed(2)} SEK (${sign}${product.percentChange.toFixed(1)}%)`);
  console.log('');
});

console.log('═══════════════════════════════════════════════════════════════');
