#!/usr/bin/env node

const fs = require('fs');

const willysData = JSON.parse(fs.readFileSync('../output/willys-analysis.json', 'utf8'));
const icaData = JSON.parse(fs.readFileSync('../output/ica-analysis.json', 'utf8'));

console.log('╔════════════════════════════════════════════════════════════════╗');
console.log('║              🥤 COCA COLA ZERO - ANALYS                       ║');
console.log('╚════════════════════════════════════════════════════════════════╝\n');

// Sök efter Coca Cola Zero varianter
const cokePattern = /coca.{0,5}cola.{0,10}zero|cola.{0,5}zero|coke.{0,5}zero|koffeinfri.{0,5}zero/i;

const allCoke = [];

function collectCoke(receipts, chain) {
  for (const receipt of receipts) {
    const date = receipt.metadata?.date || '';
    for (const item of receipt.items || []) {
      if (cokePattern.test(item.name)) {
        allCoke.push({
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

collectCoke(willysData.receipts, 'Willys');
collectCoke(icaData.receipts, 'ICA');

console.log(`📦 Totalt antal Coca Cola Zero inköp: ${allCoke.length}\n`);

if (allCoke.length === 0) {
  console.log('❌ Ingen Coca Cola Zero hittades.\n');
  process.exit(0);
}

console.log('═══════════════════════════════════════════════════════════════\n');
console.log('🥤 ALLA PRODUKTER:\n');

// Gruppera per produktnamn
const products = {};
for (const item of allCoke) {
  const name = item.name;
  if (!products[name]) {
    products[name] = {
      count: 0,
      totalCost: 0,
      totalUnits: 0,
      chains: new Set(),
      items: []
    };
  }
  products[name].count++;
  products[name].totalCost += item.totalPrice;
  products[name].totalUnits += item.quantity;
  products[name].chains.add(item.chain);
  products[name].items.push(item);
}

const sortedProducts = Object.entries(products)
  .sort((a, b) => b[1].totalCost - a[1].totalCost);

sortedProducts.forEach(([name, data], idx) => {
  const chains = Array.from(data.chains).join(', ');
  console.log(`${idx + 1}. ${name}`);
  console.log(`   💵 ${data.totalCost.toFixed(2)} SEK (${data.count} köp)`);
  console.log(`   📦 ${data.totalUnits.toFixed(0)} enheter totalt`);
  console.log(`   🏪 ${chains}`);
  console.log(`   📊 Snitt: ${(data.totalCost / data.count).toFixed(2)} SEK/köp\n`);
});

console.log('═══════════════════════════════════════════════════════════════\n');
console.log('📊 TOTALT:\n');

const totalCost = allCoke.reduce((sum, item) => sum + item.totalPrice, 0);
const totalUnits = allCoke.reduce((sum, item) => sum + item.quantity, 0);

console.log(`   💵 Total kostnad: ${totalCost.toFixed(2)} SEK`);
console.log(`   📦 Totalt enheter: ${totalUnits.toFixed(0)} st`);
console.log(`   🛒 Antal köp: ${allCoke.length}\n`);

// Försök uppskatta liter
let estimatedLiters = 0;
for (const item of allCoke) {
  // Kolla om det är burkar, PET eller storpack
  const name = item.name.toLowerCase();

  if (/burk|can|33cl|330ml/i.test(name)) {
    // Burkar 33cl
    estimatedLiters += item.quantity * 0.33;
  } else if (/50cl|500ml|5dl/i.test(name)) {
    // 50cl PET
    estimatedLiters += item.quantity * 0.5;
  } else if (/1,5l|1\.5l|150cl|1500ml/i.test(name)) {
    // 1.5L PET
    estimatedLiters += item.quantity * 1.5;
  } else if (/2l|2\.0l|200cl|2000ml/i.test(name)) {
    // 2L PET
    estimatedLiters += item.quantity * 2;
  } else if (/20p|30p/i.test(name)) {
    // Storpack - anta 33cl burkar
    estimatedLiters += item.quantity * 20 * 0.33; // eller 30
  } else if (/4p|4-pack|4pack/i.test(name)) {
    // 4-pack - anta 1.5L
    estimatedLiters += item.quantity * 4 * 1.5;
  } else {
    // Default - anta 1.5L
    estimatedLiters += item.quantity * 1.5;
  }
}

console.log(`   🥤 Uppskattat: ~${estimatedLiters.toFixed(1)} liter Coca Cola Zero\n`);

console.log('═══════════════════════════════════════════════════════════════\n');
console.log('🏪 PER BUTIK:\n');

const willysCoke = allCoke.filter(c => c.chain === 'Willys');
const icaCoke = allCoke.filter(c => c.chain === 'ICA');

const willysCost = willysCoke.reduce((sum, c) => sum + c.totalPrice, 0);
const icaCost = icaCoke.reduce((sum, c) => sum + c.totalPrice, 0);
const willysUnits = willysCoke.reduce((sum, c) => sum + c.quantity, 0);
const icaUnits = icaCoke.reduce((sum, c) => sum + c.quantity, 0);

console.log(`   Willys:`);
console.log(`      💵 ${willysCost.toFixed(2)} SEK (${(willysCost/totalCost*100).toFixed(1)}%)`);
console.log(`      📦 ${willysUnits.toFixed(0)} enheter (${willysCoke.length} köp)`);
console.log(`      📊 Snitt: ${(willysCost / willysCoke.length).toFixed(2)} SEK/köp\n`);

console.log(`   ICA:`);
console.log(`      💵 ${icaCost.toFixed(2)} SEK (${(icaCost/totalCost*100).toFixed(1)}%)`);
console.log(`      📦 ${icaUnits.toFixed(0)} enheter (${icaCoke.length} köp)`);
console.log(`      📊 Snitt: ${(icaCost / icaCoke.length).toFixed(2)} SEK/köp\n`);

console.log('═══════════════════════════════════════════════════════════════\n');
console.log('📅 MÅNADSVIS:\n');

// Gruppera per månad
const monthlyData = {};
for (const item of allCoke) {
  if (!item.date) continue;
  const date = new Date(item.date);
  const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

  if (!monthlyData[monthKey]) {
    monthlyData[monthKey] = { cost: 0, units: 0, count: 0 };
  }

  monthlyData[monthKey].cost += item.totalPrice;
  monthlyData[monthKey].units += item.quantity;
  monthlyData[monthKey].count++;
}

const monthNames = {
  '01': 'Jan', '02': 'Feb', '03': 'Mar', '04': 'Apr',
  '05': 'Maj', '06': 'Jun', '07': 'Jul', '08': 'Aug',
  '09': 'Sep', '10': 'Okt', '11': 'Nov', '12': 'Dec'
};

const sortedMonths = Object.keys(monthlyData).sort();

sortedMonths.forEach(monthKey => {
  const [year, month] = monthKey.split('-');
  const data = monthlyData[monthKey];
  console.log(`   ${monthNames[month]} ${year}: ${data.cost.toFixed(2)} SEK (${data.units.toFixed(0)} enheter, ${data.count} köp)`);
});

console.log('\n═══════════════════════════════════════════════════════════════\n');
console.log('💡 INTRESSANTA FAKTA:\n');

const firstDate = allCoke.filter(c => c.date).sort((a, b) => new Date(a.date) - new Date(b.date))[0];
const lastDate = allCoke.filter(c => c.date).sort((a, b) => new Date(b.date) - new Date(a.date))[0];

if (firstDate && lastDate) {
  const first = new Date(firstDate.date);
  const last = new Date(lastDate.date);
  const daysDiff = (last - first) / (1000 * 60 * 60 * 24);
  const monthsDiff = daysDiff / 30.44;

  console.log(`   📅 Period: ${first.toISOString().split('T')[0]} till ${last.toISOString().split('T')[0]}`);
  console.log(`   📊 ${monthsDiff.toFixed(1)} månader\n`);

  console.log(`   🥤 Konsumtion:`);
  console.log(`      ${(estimatedLiters / monthsDiff).toFixed(1)} liter/månad`);
  console.log(`      ${(estimatedLiters / daysDiff).toFixed(2)} liter/dag\n`);

  console.log(`   💰 Kostnad:`);
  console.log(`      ${(totalCost / monthsDiff).toFixed(2)} SEK/månad`);
  console.log(`      ${(totalCost / estimatedLiters).toFixed(2)} SEK/liter\n`);

  const yearlyEstimate = (totalCost / monthsDiff) * 12;
  const yearlyLiters = (estimatedLiters / monthsDiff) * 12;

  console.log(`   📈 Årsprognos:`);
  console.log(`      ~${yearlyEstimate.toFixed(2)} SEK/år`);
  console.log(`      ~${yearlyLiters.toFixed(0)} liter/år\n`);
}

console.log('═══════════════════════════════════════════════════════════════\n');
console.log('✅ Analys klar!\n');
