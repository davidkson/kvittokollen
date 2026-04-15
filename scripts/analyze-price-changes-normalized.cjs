const fs = require('fs');

const willysData = JSON.parse(fs.readFileSync('./output/willys-analysis.json', 'utf8'));
const icaData = JSON.parse(fs.readFileSync('./output/ica-analysis.json', 'utf8'));

// Extrahera storlek från produktnamn
function extractSize(name) {
  // Leta efter mönster som "1l", "1.5l", "500g", "400g", etc.
  const patterns = [
    /(\d+(?:\.\d+)?)\s*l(?:iter)?/i,  // 1l, 1.5l, 1 liter
    /(\d+(?:\.\d+)?)\s*kg/i,           // 1kg, 0.5kg
    /(\d+)\s*g(?:ram)?/i                // 500g, 400gram
  ];

  for (const pattern of patterns) {
    const match = name.match(pattern);
    if (match) {
      const value = parseFloat(match[1]);

      // Konvertera till standardenheter (liter eller kg)
      if (pattern.source.includes('g')) {
        return { value: value / 1000, unit: 'kg' }; // Konvertera g till kg
      } else {
        return { value, unit: pattern.source.includes('l') ? 'l' : 'kg' };
      }
    }
  }

  return null;
}

// Samla produkter med normaliserade priser
const productPrices = new Map();

function processReceipts(receipts, store) {
  receipts.forEach(receipt => {
    const date = new Date(receipt.metadata?.date);
    if (!date || isNaN(date.getTime())) return;

    receipt.items.forEach(item => {
      // Skippa rabatter och pant
      if (item.isDiscount || item.totalPrice < 0) return;
      if (/pant|plastkasse|påse|rabatt|kampanj/i.test(item.name)) return;

      const unitPrice = item.unitPrice || 0;
      if (unitPrice === 0) return;

      // Extrahera storlek
      const size = extractSize(item.name);

      // Om vi hittar storlek, normalisera priset
      if (size) {
        const pricePerUnit = unitPrice / size.value;

        // Skapa en normaliserad produktnyckel
        // Ta bort storleksinformation från namnet
        const baseName = item.name
          .replace(/\d+(?:\.\d+)?\s*(?:l|liter|kg|g|gram)/gi, '')
          .replace(/\s+/g, ' ')
          .trim()
          .toLowerCase();

        const key = `${baseName}|${size.unit}`;

        if (!productPrices.has(key)) {
          productPrices.set(key, {
            baseName,
            unit: size.unit,
            purchases: []
          });
        }

        productPrices.get(key).purchases.push({
          date,
          pricePerUnit,
          originalPrice: unitPrice,
          size: size.value,
          store,
          fullName: item.name
        });
      }
    });
  });
}

processReceipts(willysData.receipts, 'Willys');
processReceipts(icaData.receipts, 'ICA');

// Analysera produkter
const analyzableProducts = [];

productPrices.forEach((data, key) => {
  const { baseName, unit, purchases } = data;

  if (purchases.length < 3) return;

  purchases.sort((a, b) => a.date - b.date);

  const firstDate = purchases[0].date;
  const lastDate = purchases[purchases.length - 1].date;
  const daysDiff = (lastDate - firstDate) / (1000 * 60 * 60 * 24);

  if (daysDiff < 60) return;

  const firstPrice = purchases[0].pricePerUnit;
  const lastPrice = purchases[purchases.length - 1].pricePerUnit;
  const priceChange = lastPrice - firstPrice;
  const percentChange = (priceChange / firstPrice) * 100;

  const avgPrice = purchases.reduce((sum, p) => sum + p.pricePerUnit, 0) / purchases.length;

  analyzableProducts.push({
    baseName,
    unit,
    purchases: purchases.length,
    firstDate,
    lastDate,
    firstPrice,
    lastPrice,
    priceChange,
    percentChange,
    avgPrice,
    daysDiff: Math.round(daysDiff),
    allPurchases: purchases
  });
});

// Sortera efter antal köp först, sedan efter absolut prisförändring
analyzableProducts.sort((a, b) => {
  if (b.purchases !== a.purchases) {
    return b.purchases - a.purchases;
  }
  return Math.abs(b.percentChange) - Math.abs(a.percentChange);
});

console.log('═══════════════════════════════════════════════════════════════');
console.log('📊 PRISUTVECKLING - NORMALISERAT PER ENHET');
console.log('═══════════════════════════════════════════════════════════════\n');

console.log(`Analyserade ${productPrices.size} produkter med känd storlek`);
console.log(`Hittade ${analyzableProducts.length} produkter köpta 3+ gånger över 60+ dagar\n`);

console.log('═══════════════════════════════════════════════════════════════');
console.log('🛒 MEST KÖPTA PRODUKTER (NORMALISERADE PRISER):\n');

analyzableProducts.slice(0, 15).forEach((product, i) => {
  const trend = product.percentChange > 0 ? '📈' : product.percentChange < 0 ? '📉' : '➡️';
  const sign = product.percentChange > 0 ? '+' : '';
  const unitLabel = product.unit === 'l' ? 'liter' : 'kg';

  console.log(`${i + 1}. ${product.baseName.toUpperCase()}`);
  console.log(`   🛒 Köpt ${product.purchases} gånger över ${product.daysDiff} dagar`);
  console.log(`   ${trend} ${product.firstPrice.toFixed(2)} → ${product.lastPrice.toFixed(2)} SEK/${unitLabel}`);
  console.log(`   📊 ${sign}${product.percentChange.toFixed(1)}% förändring`);

  if (Math.abs(product.percentChange) > 20) {
    console.log(`   ⚠️  Betydande prisförändring!`);
  }

  console.log('');
});

console.log('═══════════════════════════════════════════════════════════════');
console.log('📈 STÖRSTA PRISÖKNINGAR (NORMALISERAT):\n');

const increases = [...analyzableProducts]
  .filter(p => p.percentChange > 5 && p.purchases >= 3)
  .sort((a, b) => b.percentChange - a.percentChange)
  .slice(0, 10);

increases.forEach((product, i) => {
  const unitLabel = product.unit === 'l' ? 'liter' : 'kg';
  console.log(`${i + 1}. ${product.baseName.toUpperCase()}`);
  console.log(`   📅 ${product.firstDate.toISOString().split('T')[0]} → ${product.lastDate.toISOString().split('T')[0]}`);
  console.log(`   💰 ${product.firstPrice.toFixed(2)} → ${product.lastPrice.toFixed(2)} SEK/${unitLabel}`);
  console.log(`   📈 +${product.priceChange.toFixed(2)} SEK/${unitLabel} (+${product.percentChange.toFixed(1)}%)`);
  console.log(`   🛒 ${product.purchases} köp, snitt ${product.avgPrice.toFixed(2)} SEK/${unitLabel}`);
  console.log('');
});

console.log('═══════════════════════════════════════════════════════════════');
console.log('📉 STÖRSTA PRISSÄNKNINGAR (NORMALISERAT):\n');

const decreases = [...analyzableProducts]
  .filter(p => p.percentChange < -5 && p.purchases >= 3)
  .sort((a, b) => a.percentChange - b.percentChange)
  .slice(0, 10);

decreases.forEach((product, i) => {
  const unitLabel = product.unit === 'l' ? 'liter' : 'kg';
  console.log(`${i + 1}. ${product.baseName.toUpperCase()}`);
  console.log(`   📅 ${product.firstDate.toISOString().split('T')[0]} → ${product.lastDate.toISOString().split('T')[0]}`);
  console.log(`   💰 ${product.firstPrice.toFixed(2)} → ${product.lastPrice.toFixed(2)} SEK/${unitLabel}`);
  console.log(`   📉 ${product.priceChange.toFixed(2)} SEK/${unitLabel} (${product.percentChange.toFixed(1)}%)`);
  console.log(`   🛒 ${product.purchases} köp, snitt ${product.avgPrice.toFixed(2)} SEK/${unitLabel}`);
  console.log('');
});

console.log('═══════════════════════════════════════════════════════════════');
