#!/usr/bin/env node

const fs = require('fs');

const willysData = JSON.parse(fs.readFileSync('../output/willys-analysis.json', 'utf8'));
const icaData = JSON.parse(fs.readFileSync('../output/ica-analysis.json', 'utf8'));

console.log('╔════════════════════════════════════════════════════════════════╗');
console.log('║              🐱 KATTMATSANALYS - MÅNADSVIS                    ║');
console.log('╚════════════════════════════════════════════════════════════════╝\n');

// Kattmats-keywords (exkludera kattmjölk)
const catFoodPattern = /kattmat|felix|whiskas|sheba|gourmet|dreamies|perfect fit|catessy|whis|kattstick|kattsnacks/i;
const excludePattern = /mjölk/i;

// ICA-specifika mönster (tonfisk/lax med sås/mousse/filet = kattmat)
function isLikelyCatFood(name, price) {
  const nameLower = name.toLowerCase();

  // Exkludera uppenbart mänsklig mat
  if (/bröd|ost|yoghurt|korv|hamburgare|pizza|soppa|grädde|smör|sallad|pasta|ris/i.test(name)) {
    return false;
  }

  // ICA-mönster: Fisk + textur + lågt pris = kattmat
  const hasFish = /tonfisk|lax|fisk/i.test(name);
  const hasTexture = /sås|mousse|filet|paté|gelé/i.test(name);
  const lowPrice = price < 100; // Kattmat är oftast billigt per enhet

  if (hasFish && hasTexture && lowPrice) {
    return true;
  }

  return false;
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
      const notDiscount = item.totalPrice >= 0; // Exkludera kampanjrabatter (negativa)

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

console.log(`📦 Totalt antal kattmatsinköp: ${allCatFood.length}\n`);

if (allCatFood.length === 0) {
  console.log('❌ Ingen kattmat hittades.\n');
  process.exit(0);
}

// Beräkna tidsperiod
const sortedByDate = [...allCatFood].filter(f => f.date).sort((a, b) =>
  new Date(a.date) - new Date(b.date)
);

const firstDate = sortedByDate.length > 0 ? new Date(sortedByDate[0].date) : null;
const lastDate = sortedByDate.length > 0 ? new Date(sortedByDate[sortedByDate.length - 1].date) : null;

if (firstDate && lastDate) {
  const monthsDiff = ((lastDate - firstDate) / (1000 * 60 * 60 * 24)) / 30.44;
  console.log(`📅 Period: ${firstDate.toISOString().split('T')[0]} till ${lastDate.toISOString().split('T')[0]}`);
  console.log(`📊 Antal månader: ${monthsDiff.toFixed(1)}\n`);
}

console.log('═══════════════════════════════════════════════════════════════\n');
console.log('📊 TOTALT SENASTE ÅRET:\n');

const totalCost = allCatFood.reduce((sum, f) => sum + f.totalPrice, 0);
const totalQuantity = allCatFood.reduce((sum, f) => sum + f.quantity, 0);

console.log(`   💵 Total kostnad: ${totalCost.toFixed(2)} SEK`);
console.log(`   📦 Antal produkter: ${totalQuantity.toFixed(0)} st`);
console.log(`   🛒 Antal köp: ${allCatFood.length}\n`);

// Per butik
const willysCatFood = allCatFood.filter(f => f.chain === 'Willys');
const icaCatFood = allCatFood.filter(f => f.chain === 'ICA');

const willysCost = willysCatFood.reduce((sum, f) => sum + f.totalPrice, 0);
const icaCost = icaCatFood.reduce((sum, f) => sum + f.totalPrice, 0);
const willysQty = willysCatFood.reduce((sum, f) => sum + f.quantity, 0);
const icaQty = icaCatFood.reduce((sum, f) => sum + f.quantity, 0);

console.log(`   Willys:`);
console.log(`      💵 ${willysCost.toFixed(2)} SEK (${(willysCost/totalCost*100).toFixed(1)}%)`);
console.log(`      📦 ${willysQty.toFixed(0)} produkter (${willysCatFood.length} köp)\n`);

console.log(`   ICA:`);
console.log(`      💵 ${icaCost.toFixed(2)} SEK (${(icaCost/totalCost*100).toFixed(1)}%)`);
console.log(`      📦 ${icaQty.toFixed(0)} produkter (${icaCatFood.length} köp)\n`);

console.log('═══════════════════════════════════════════════════════════════\n');
console.log('📅 MÅNADSVIS ÖVERSIKT:\n');

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

sortedMonths.forEach((monthKey, idx) => {
  const [year, month] = monthKey.split('-');
  const data = monthlyData[monthKey];

  const totalCost = data.willys.cost + data.ica.cost;
  const totalQty = data.willys.quantity + data.ica.quantity;
  const totalCount = data.willys.count + data.ica.count;

  console.log(`${idx + 1}. ${monthNames[month]} ${year}`);
  console.log(`   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`   💰 Totalt: ${totalCost.toFixed(2)} SEK (${totalQty.toFixed(0)} produkter, ${totalCount} köp)`);

  if (data.willys.count > 0) {
    console.log(`\n   🏪 Willys:`);
    console.log(`      ${data.willys.cost.toFixed(2)} SEK (${(data.willys.cost/totalCost*100).toFixed(1)}%)`);
    console.log(`      ${data.willys.quantity.toFixed(0)} produkter (${data.willys.count} köp)`);
  }

  if (data.ica.count > 0) {
    console.log(`\n   🏪 ICA:`);
    console.log(`      ${data.ica.cost.toFixed(2)} SEK (${(data.ica.cost/totalCost*100).toFixed(1)}%)`);
    console.log(`      ${data.ica.quantity.toFixed(0)} produkter (${data.ica.count} köp)`);
  }
  console.log('');
});

console.log('═══════════════════════════════════════════════════════════════\n');
console.log('📊 STATISTIK:\n');

const avgPerMonth = totalCost / sortedMonths.length;
console.log(`   💵 Genomsnitt per månad: ${avgPerMonth.toFixed(2)} SEK`);
console.log(`   📦 Genomsnitt per månad: ${(totalQuantity / sortedMonths.length).toFixed(1)} produkter\n`);

// Hitta högsta och lägsta månad
const monthCosts = sortedMonths.map(m => ({
  month: m,
  cost: monthlyData[m].willys.cost + monthlyData[m].ica.cost
}));

const highest = monthCosts.reduce((max, m) => m.cost > max.cost ? m : max);
const lowest = monthCosts.reduce((min, m) => m.cost < min.cost ? m : min);

const [highYear, highMonth] = highest.month.split('-');
const [lowYear, lowMonth] = lowest.month.split('-');

console.log(`   📈 Högsta månad: ${monthNames[highMonth]} ${highYear} (${highest.cost.toFixed(2)} SEK)`);
console.log(`   📉 Lägsta månad: ${monthNames[lowMonth]} ${lowYear} (${lowest.cost.toFixed(2)} SEK)\n`);

console.log('═══════════════════════════════════════════════════════════════\n');
console.log('🐱 MEST KÖPTA PRODUKTER:\n');

// Gruppera per produktnamn
const products = {};
for (const item of allCatFood) {
  const name = item.name;
  if (!products[name]) {
    products[name] = {
      count: 0,
      totalCost: 0,
      totalQty: 0,
      chains: new Set()
    };
  }
  products[name].count++;
  products[name].totalCost += item.totalPrice;
  products[name].totalQty += item.quantity;
  products[name].chains.add(item.chain);
}

const sortedProducts = Object.entries(products)
  .sort((a, b) => b[1].totalCost - a[1].totalCost)
  .slice(0, 10);

sortedProducts.forEach((([name, data], idx) => {
  const chains = Array.from(data.chains).join(', ');
  console.log(`${idx + 1}. ${name}`);
  console.log(`   💵 ${data.totalCost.toFixed(2)} SEK (${data.count} köp, ${data.totalQty.toFixed(0)} st)`);
  console.log(`   🏪 ${chains}`);
  console.log(`   📊 Snitt: ${(data.totalCost / data.count).toFixed(2)} SEK/köp\n`);
}));

console.log('═══════════════════════════════════════════════════════════════\n');
console.log('💡 ÅRLIG KOSTNAD:\n');

if (firstDate && lastDate) {
  const monthsDiff = ((lastDate - firstDate) / (1000 * 60 * 60 * 24)) / 30.44;
  const yearlyEstimate = (totalCost / monthsDiff) * 12;
  console.log(`   🐱 Kattmat per år: ~${yearlyEstimate.toFixed(2)} SEK`);
  console.log(`   📊 Det är ~${(yearlyEstimate / 12).toFixed(2)} SEK/månad\n`);
}

console.log('═══════════════════════════════════════════════════════════════\n');
console.log('✅ Analys klar!\n');
