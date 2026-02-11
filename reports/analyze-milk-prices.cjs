#!/usr/bin/env node

const fs = require('fs');

const willysData = JSON.parse(fs.readFileSync('../output/willys-analysis.json', 'utf8'));
const icaData = JSON.parse(fs.readFileSync('../output/ica-analysis.json', 'utf8'));

console.log('╔════════════════════════════════════════════════════════════════╗');
console.log('║         🥛 DJUPANALYS - VARFÖR ÄR MJÖLK BILLIGARE PÅ ICA?    ║');
console.log('╚════════════════════════════════════════════════════════════════╝\n');

// Samla alla mjölkprodukter med mer detaljer
function collectMilk(receipts, chain) {
  const milk = [];
  for (const receipt of receipts) {
    const date = receipt.metadata?.date || '';
    for (const item of receipt.items || []) {
      if (/mjölk/i.test(item.name) && !/choklad|helnöt|daim|katt|kex|cookie|snickers|twix|mars|bounty/i.test(item.name)) {
        // Försök extrahera volym
        let litersPerUnit = 1;
        if (/0,5|500ml|5dl/i.test(item.name)) litersPerUnit = 0.5;
        if (/1,5|1\.5|1500ml|15dl/i.test(item.name)) litersPerUnit = 1.5;
        if (/2l|2000ml|20dl/i.test(item.name)) litersPerUnit = 2;

        // Normalisera produktnamn för jämförelse
        const normalized = item.name
          .toLowerCase()
          .replace(/\s+/g, ' ')
          .trim();

        milk.push({
          name: item.name,
          normalized,
          date,
          chain,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          totalPrice: item.totalPrice,
          litersPerUnit,
          pricePerLiter: item.unitPrice / litersPerUnit
        });
      }
    }
  }
  return milk;
}

const willysMilk = collectMilk(willysData.receipts, 'Willys');
const icaMilk = collectMilk(icaData.receipts, 'ICA');

console.log('═══════════════════════════════════════════════════════════════\n');
console.log('📊 GRUNDDATA:\n');

const willysTotalLiters = willysMilk.reduce((sum, m) => sum + (m.quantity * m.litersPerUnit), 0);
const icaTotalLiters = icaMilk.reduce((sum, m) => sum + (m.quantity * m.litersPerUnit), 0);
const willysTotalCost = willysMilk.reduce((sum, m) => sum + m.totalPrice, 0);
const icaTotalCost = icaMilk.reduce((sum, m) => sum + m.totalPrice, 0);

console.log(`   Willys: ${willysTotalLiters.toFixed(1)}L för ${willysTotalCost.toFixed(2)} SEK = ${(willysTotalCost/willysTotalLiters).toFixed(2)} SEK/L`);
console.log(`   ICA:    ${icaTotalLiters.toFixed(1)}L för ${icaTotalCost.toFixed(2)} SEK = ${(icaTotalCost/icaTotalLiters).toFixed(2)} SEK/L\n`);

console.log('═══════════════════════════════════════════════════════════════\n');
console.log('🔍 ANALYS 1: FÖRPACKNINGSSTORLEK\n');

// Gruppera per storlek
function groupBySize(milk) {
  const sizes = {};
  for (const m of milk) {
    const size = m.litersPerUnit;
    if (!sizes[size]) sizes[size] = { count: 0, totalLiters: 0, totalCost: 0, items: [] };
    sizes[size].count++;
    sizes[size].totalLiters += m.quantity * m.litersPerUnit;
    sizes[size].totalCost += m.totalPrice;
    sizes[size].items.push(m);
  }
  return sizes;
}

const willysSizes = groupBySize(willysMilk);
const icaSizes = groupBySize(icaMilk);

console.log('   Willys förpackningar:');
Object.entries(willysSizes).sort((a, b) => b[1].totalLiters - a[1].totalLiters).forEach(([size, data]) => {
  console.log(`      ${size}L: ${data.count} köp, ${data.totalLiters.toFixed(1)}L totalt, ${(data.totalCost/data.totalLiters).toFixed(2)} SEK/L`);
});

console.log('\n   ICA förpackningar:');
Object.entries(icaSizes).sort((a, b) => b[1].totalLiters - a[1].totalLiters).forEach(([size, data]) => {
  console.log(`      ${size}L: ${data.count} köp, ${data.totalLiters.toFixed(1)}L totalt, ${(data.totalCost/data.totalLiters).toFixed(2)} SEK/L`);
});

console.log('\n   💡 Observation:');
const willysMainSize = Object.entries(willysSizes).sort((a, b) => b[1].totalLiters - a[1].totalLiters)[0];
const icaMainSize = Object.entries(icaSizes).sort((a, b) => b[1].totalLiters - a[1].totalLiters)[0];
console.log(`      Willys köper mest: ${willysMainSize[0]}L (${(willysMainSize[1].totalLiters/willysTotalLiters*100).toFixed(0)}%)`);
console.log(`      ICA köper mest: ${icaMainSize[0]}L (${(icaMainSize[1].totalLiters/icaTotalLiters*100).toFixed(0)}%)\n`);

console.log('═══════════════════════════════════════════════════════════════\n');
console.log('🔍 ANALYS 2: VARUMÄRKE/TYP\n');

// Gruppera per produkttyp
function groupByProduct(milk) {
  const products = {};
  for (const m of milk) {
    const name = m.name;
    if (!products[name]) products[name] = { count: 0, totalLiters: 0, totalCost: 0, pricesPerLiter: [] };
    products[name].count++;
    products[name].totalLiters += m.quantity * m.litersPerUnit;
    products[name].totalCost += m.totalPrice;
    products[name].pricesPerLiter.push(m.pricePerLiter);
  }
  return products;
}

const willysProducts = groupByProduct(willysMilk);
const icaProducts = groupByProduct(icaMilk);

console.log('   Willys produkter (topp 5):');
Object.entries(willysProducts)
  .sort((a, b) => b[1].totalLiters - a[1].totalLiters)
  .slice(0, 5)
  .forEach(([name, data]) => {
    const avgPrice = data.totalCost / data.totalLiters;
    const minPrice = Math.min(...data.pricesPerLiter);
    const maxPrice = Math.max(...data.pricesPerLiter);
    console.log(`      ${name}`);
    console.log(`         ${data.totalLiters.toFixed(1)}L (${data.count} köp), ${avgPrice.toFixed(2)} SEK/L`);
    if (minPrice !== maxPrice) {
      console.log(`         Pris varierat: ${minPrice.toFixed(2)} - ${maxPrice.toFixed(2)} SEK/L`);
    }
  });

console.log('\n   ICA produkter (topp 5):');
Object.entries(icaProducts)
  .sort((a, b) => b[1].totalLiters - a[1].totalLiters)
  .slice(0, 5)
  .forEach(([name, data]) => {
    const avgPrice = data.totalCost / data.totalLiters;
    const minPrice = Math.min(...data.pricesPerLiter);
    const maxPrice = Math.max(...data.pricesPerLiter);
    console.log(`      ${name}`);
    console.log(`         ${data.totalLiters.toFixed(1)}L (${data.count} köp), ${avgPrice.toFixed(2)} SEK/L`);
    if (minPrice !== maxPrice) {
      console.log(`         Pris varierat: ${minPrice.toFixed(2)} - ${maxPrice.toFixed(2)} SEK/L`);
    }
  });

console.log('\n   💡 Observation:');
// Identifiera lågprismärken
const willysHasGarant = Object.keys(willysProducts).some(p => /garant/i.test(p));
const icaHasICA = Object.keys(icaProducts).some(p => /^mellanmjölk\s*1/i.test(p) && !/garant|arla/i.test(p));
console.log(`      Willys: ${willysHasGarant ? 'Köper Garant (lågprismärke)' : 'Köper ej lågprismärke'}`);
console.log(`      ICA: ${icaHasICA ? 'Köper ICA (butiksmärke)' : 'Köper ej butiksmärke'}\n`);

console.log('═══════════════════════════════════════════════════════════════\n');
console.log('🔍 ANALYS 3: PRISUTVECKLING ÖVER TID\n');

// Gruppera per månad
function groupByMonth(milk) {
  const monthly = {};
  for (const m of milk) {
    if (!m.date) continue;
    const date = new Date(m.date);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    if (!monthly[monthKey]) monthly[monthKey] = { liters: 0, cost: 0, prices: [] };
    monthly[monthKey].liters += m.quantity * m.litersPerUnit;
    monthly[monthKey].cost += m.totalPrice;
    monthly[monthKey].prices.push(m.pricePerLiter);
  }
  return monthly;
}

const willysMonthly = groupByMonth(willysMilk);
const icaMonthly = groupByMonth(icaMilk);

const allMonths = new Set([...Object.keys(willysMonthly), ...Object.keys(icaMonthly)]);
const sortedMonths = Array.from(allMonths).sort();

const monthNames = {
  '01': 'Jan', '02': 'Feb', '03': 'Mar', '04': 'Apr',
  '05': 'Maj', '06': 'Jun', '07': 'Jul', '08': 'Aug',
  '09': 'Sep', '10': 'Okt', '11': 'Nov', '12': 'Dec'
};

console.log('   Månad        Willys SEK/L    ICA SEK/L    Skillnad');
console.log('   ────────────────────────────────────────────────────');
sortedMonths.forEach(month => {
  const [year, m] = month.split('-');
  const willysData = willysMonthly[month];
  const icaData = icaMonthly[month];

  const willysPrice = willysData ? (willysData.cost / willysData.liters) : null;
  const icaPrice = icaData ? (icaData.cost / icaData.liters) : null;

  const willysStr = willysPrice ? willysPrice.toFixed(2).padStart(6) : '    -';
  const icaStr = icaPrice ? icaPrice.toFixed(2).padStart(6) : '    -';
  const diff = (willysPrice && icaPrice) ? (willysPrice - icaPrice).toFixed(2) : '-';
  const diffStr = diff !== '-' ? (diff > 0 ? `+${diff}` : diff) : diff;

  console.log(`   ${monthNames[m]} ${year}      ${willysStr}        ${icaStr}       ${diffStr}`);
});

console.log('\n   💡 Observation:');
const monthsWithBoth = sortedMonths.filter(m => willysMonthly[m] && icaMonthly[m]);
if (monthsWithBoth.length > 0) {
  const diffs = monthsWithBoth.map(m => {
    const wPrice = willysMonthly[m].cost / willysMonthly[m].liters;
    const iPrice = icaMonthly[m].cost / icaMonthly[m].liters;
    return wPrice - iPrice;
  });
  const avgDiff = diffs.reduce((sum, d) => sum + d, 0) / diffs.length;
  const icaCheaperCount = diffs.filter(d => d > 0).length;
  console.log(`      ICA billigare: ${icaCheaperCount} av ${monthsWithBoth.length} månader`);
  console.log(`      Genomsnittlig skillnad: ${avgDiff.toFixed(2)} SEK/L (Willys - ICA)\n`);
}

console.log('═══════════════════════════════════════════════════════════════\n');
console.log('🔍 ANALYS 4: KAMPANJPRISER\n');

// Hitta prisvariation per produkt
console.log('   Produkter med stor prisvariation (möjliga kampanjer):\n');

function findPriceVariations(products, chain) {
  const variations = [];
  for (const [name, data] of Object.entries(products)) {
    if (data.count < 2) continue;
    const prices = data.pricesPerLiter;
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const variation = ((max - min) / min * 100);
    if (variation > 10) {
      variations.push({ name, min, max, variation, chain, count: data.count });
    }
  }
  return variations.sort((a, b) => b.variation - a.variation);
}

const willysVariations = findPriceVariations(willysProducts, 'Willys');
const icaVariations = findPriceVariations(icaProducts, 'ICA');

if (willysVariations.length > 0) {
  console.log('   Willys:');
  willysVariations.slice(0, 3).forEach(v => {
    console.log(`      ${v.name}`);
    console.log(`         ${v.min.toFixed(2)} - ${v.max.toFixed(2)} SEK/L (${v.variation.toFixed(0)}% variation, ${v.count} köp)`);
  });
  console.log('');
}

if (icaVariations.length > 0) {
  console.log('   ICA:');
  icaVariations.slice(0, 3).forEach(v => {
    console.log(`      ${v.name}`);
    console.log(`         ${v.min.toFixed(2)} - ${v.max.toFixed(2)} SEK/L (${v.variation.toFixed(0)}% variation, ${v.count} köp)`);
  });
  console.log('');
}

console.log('   💡 Observation:');
const willysAvgVariation = willysVariations.length > 0
  ? willysVariations.reduce((sum, v) => sum + v.variation, 0) / willysVariations.length
  : 0;
const icaAvgVariation = icaVariations.length > 0
  ? icaVariations.reduce((sum, v) => sum + v.variation, 0) / icaVariations.length
  : 0;

if (willysAvgVariation > 0 || icaAvgVariation > 0) {
  console.log(`      Willys genomsnittlig prisvariation: ${willysAvgVariation.toFixed(0)}%`);
  console.log(`      ICA genomsnittlig prisvariation: ${icaAvgVariation.toFixed(0)}%`);
  if (icaAvgVariation > willysAvgVariation) {
    console.log(`      ICA har mer kampanjer/prisvariation\n`);
  } else {
    console.log(`      Willys har mer kampanjer/prisvariation\n`);
  }
} else {
  console.log('      Ingen signifikant prisvariation upptäckt\n');
}

console.log('═══════════════════════════════════════════════════════════════\n');
console.log('🎯 SAMMANFATTNING - VARFÖR ÄR ICA BILLIGARE?\n');

let reason1 = '';
let reason2 = '';
let reason3 = '';

// Anledning 1: Förpackningsstorlek
const willysPrefers15L = willysMainSize[0] === '1.5';
const icaPrefers1L = icaMainSize[0] === '1';
if (willysPrefers15L && icaPrefers1L) {
  reason1 = '   ❌ FÖRPACKNINGSSTORLEK spelar INTE huvudroll';
  reason1 += '\n      (Större förpackningar är ofta billigare, men Willys köper 1.5L)';
} else if (icaPrefers1L) {
  const price1L_ica = icaSizes[1] ? icaSizes[1].totalCost / icaSizes[1].totalLiters : 0;
  const price15L_willys = willysSizes[1.5] ? willysSizes[1.5].totalCost / willysSizes[1.5].totalLiters : 0;
  if (price1L_ica < price15L_willys) {
    reason1 = '   ✅ KAMPANJPRISER på ICA';
    reason1 += `\n      ICA 1L (${price1L_ica.toFixed(2)} SEK/L) billigare än Willys 1.5L (${price15L_willys.toFixed(2)} SEK/L)`;
  }
}

// Anledning 2: Märke
const icaBuysCheaperBrand = Object.entries(icaProducts).some(([name, data]) => {
  return /^mellanmjölk\s*1/i.test(name) && data.totalLiters > 50;
});
const willysBuysGarant = Object.entries(willysProducts).some(([name, data]) => {
  return /garant/i.test(name) && data.totalLiters > 50;
});

if (icaBuysCheaperBrand) {
  const icaBasic = Object.entries(icaProducts).find(([name]) => /^mellanmjölk\s*1/i.test(name));
  if (icaBasic) {
    const icaBasicPrice = icaBasic[1].totalCost / icaBasic[1].totalLiters;
    reason2 = '   ✅ ICA BUTIKSMÄRKE är billigare';
    reason2 += `\n      ICA Basic mjölk: ${icaBasicPrice.toFixed(2)} SEK/L`;
  }
}

// Anledning 3: Kampanjer
if (icaAvgVariation > willysAvgVariation && icaAvgVariation > 15) {
  reason3 = '   ✅ FLER KAMPANJER på ICA';
  reason3 += `\n      ICA har ${icaAvgVariation.toFixed(0)}% prisvariation vs Willys ${willysAvgVariation.toFixed(0)}%`;
}

console.log(reason1 || '   - Förpackningsstorlek: Ingen stor skillnad');
console.log(reason2 || '   - Märke: Båda köper lågprismärken');
console.log(reason3 || '   - Kampanjer: Liknande prisnivåer');

console.log('\n   📊 SLUTSATS:');
const priceDiff = (willysTotalCost/willysTotalLiters) - (icaTotalCost/icaTotalLiters);
console.log(`      ICA är ${priceDiff.toFixed(2)} SEK/L billigare (${(priceDiff/(willysTotalCost/willysTotalLiters)*100).toFixed(0)}%)`);

if (icaBuysCheaperBrand) {
  console.log(`      Huvudorsak: ICA:s butiksmärke är konsekvent billigare`);
} else if (icaAvgVariation > willysAvgVariation + 10) {
  console.log(`      Huvudorsak: Du träffar fler kampanjer på ICA`);
} else {
  console.log(`      Huvudorsak: Generellt lägre priser på ICA i din region`);
}

console.log('\n═══════════════════════════════════════════════════════════════\n');
console.log('✅ Analys klar!\n');
