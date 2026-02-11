#!/usr/bin/env node

const fs = require('fs');

const willysData = JSON.parse(fs.readFileSync('../output/willys-analysis.json', 'utf8'));
const icaData = JSON.parse(fs.readFileSync('../output/ica-analysis.json', 'utf8'));

// Dagens datum
const today = new Date();
const currentYear = today.getFullYear();
const currentMonth = today.getMonth() + 1; // 0-indexed, så +1

console.log('╔════════════════════════════════════════════════════════════════╗');
console.log('║              🥛 MJÖLKINKÖP - DENNA MÅNAD                      ║');
console.log('╚════════════════════════════════════════════════════════════════╝\n');

const monthNames = {
  1: 'Januari', 2: 'Februari', 3: 'Mars', 4: 'April',
  5: 'Maj', 6: 'Juni', 7: 'Juli', 8: 'Augusti',
  9: 'September', 10: 'Oktober', 11: 'November', 12: 'December'
};

console.log(`📅 Aktuell månad: ${monthNames[currentMonth]} ${currentYear}\n`);

// Samla mjölk från denna månad
const currentMonthMilk = [];

function collectMonthMilk(receipts, chain) {
  for (const receipt of receipts) {
    const date = receipt.metadata?.date ? new Date(receipt.metadata.date) : null;
    if (!date) continue;

    if (date.getFullYear() === currentYear && date.getMonth() + 1 === currentMonth) {
      for (const item of receipt.items || []) {
        // Filtrera bort choklad, godis och kattmjölk
        if (/mjölk/i.test(item.name) && !/choklad|helnöt|daim|katt|kex|cookie|snickers|twix|mars|bounty/i.test(item.name)) {
          // Försök extrahera volym
          let litersPerUnit = 1;
          if (/0,5|500ml|5dl/i.test(item.name)) litersPerUnit = 0.5;
          if (/1,5|1\.5|1500ml|15dl/i.test(item.name)) litersPerUnit = 1.5;
          if (/2l|2000ml|20dl/i.test(item.name)) litersPerUnit = 2;

          currentMonthMilk.push({
            date: receipt.metadata.date,
            chain,
            name: item.name,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            totalPrice: item.totalPrice,
            litersPerUnit,
            totalLiters: item.quantity * litersPerUnit,
            pricePerLiter: item.unitPrice / litersPerUnit
          });
        }
      }
    }
  }
}

collectMonthMilk(willysData.receipts, 'Willys');
collectMonthMilk(icaData.receipts, 'ICA');

if (currentMonthMilk.length === 0) {
  console.log('❌ Inga mjölkinköp hittades denna månad.\n');
  console.log('💡 Tips: Kontrollera att du har hämtat nya kvitton med "npm run willys" eller "npm run ica"\n');
  process.exit(0);
}

// Sortera efter datum
currentMonthMilk.sort((a, b) => new Date(a.date) - new Date(b.date));

console.log('═══════════════════════════════════════════════════════════════\n');
console.log('🛒 ALLA MJÖLKINKÖP:\n');

currentMonthMilk.forEach((milk, idx) => {
  const date = new Date(milk.date).toISOString().split('T')[0];
  console.log(`${idx + 1}. ${date} - ${milk.chain}`);
  console.log(`   📦 ${milk.name}`);
  console.log(`   🥛 Mängd: ${milk.quantity} st × ${milk.litersPerUnit}L = ${milk.totalLiters.toFixed(1)} liter`);
  console.log(`   💵 Pris: ${milk.totalPrice.toFixed(2)} SEK (${milk.pricePerLiter.toFixed(2)} SEK/liter)`);
  console.log('');
});

console.log('═══════════════════════════════════════════════════════════════\n');
console.log('📊 SAMMANFATTNING:\n');

const totalLiters = currentMonthMilk.reduce((sum, m) => sum + m.totalLiters, 0);
const totalCost = currentMonthMilk.reduce((sum, m) => sum + m.totalPrice, 0);
const avgPricePerLiter = totalCost / totalLiters;

console.log(`   🥛 Total volym: ${totalLiters.toFixed(1)} liter`);
console.log(`   💵 Total kostnad: ${totalCost.toFixed(2)} SEK`);
console.log(`   💰 Snittpris: ${avgPricePerLiter.toFixed(2)} SEK/liter`);
console.log(`   📅 Antal köp: ${currentMonthMilk.length}\n`);

// Per butik
const willysMilk = currentMonthMilk.filter(m => m.chain === 'Willys');
const icaMilk = currentMonthMilk.filter(m => m.chain === 'ICA');

if (willysMilk.length > 0) {
  const willysLiters = willysMilk.reduce((sum, m) => sum + m.totalLiters, 0);
  const willysCost = willysMilk.reduce((sum, m) => sum + m.totalPrice, 0);
  console.log(`   Willys:`);
  console.log(`      ${willysLiters.toFixed(1)} liter för ${willysCost.toFixed(2)} SEK (${(willysCost/willysLiters).toFixed(2)} SEK/L)\n`);
}

if (icaMilk.length > 0) {
  const icaLiters = icaMilk.reduce((sum, m) => sum + m.totalLiters, 0);
  const icaCost = icaMilk.reduce((sum, m) => sum + m.totalPrice, 0);
  console.log(`   ICA:`);
  console.log(`      ${icaLiters.toFixed(1)} liter för ${icaCost.toFixed(2)} SEK (${(icaCost/icaLiters).toFixed(2)} SEK/L)\n`);
}

// Jämför med snittet
console.log('═══════════════════════════════════════════════════════════════\n');
console.log('📈 JÄMFÖRELSE MED GENOMSNITT:\n');

// Beräkna genomsnitt från alla månader
let allMilk = [];
function collectAllMilk(receipts, chain) {
  for (const receipt of receipts) {
    for (const item of receipt.items || []) {
      if (/mjölk/i.test(item.name) && !/choklad|helnöt|daim|katt|kex|cookie|snickers|twix|mars|bounty/i.test(item.name)) {
        let litersPerUnit = 1;
        if (/0,5|500ml|5dl/i.test(item.name)) litersPerUnit = 0.5;
        if (/1,5|1\.5|1500ml|15dl/i.test(item.name)) litersPerUnit = 1.5;
        if (/2l|2000ml|20dl/i.test(item.name)) litersPerUnit = 2;
        allMilk.push({
          chain,
          totalPrice: item.totalPrice,
          totalLiters: item.quantity * litersPerUnit
        });
      }
    }
  }
}
collectAllMilk(willysData.receipts, 'Willys');
collectAllMilk(icaData.receipts, 'ICA');

const allLiters = allMilk.reduce((sum, m) => sum + m.totalLiters, 0);
const allCost = allMilk.reduce((sum, m) => sum + m.totalPrice, 0);
const allAvgPrice = allCost / allLiters;

console.log(`   Denna månad: ${avgPricePerLiter.toFixed(2)} SEK/liter`);
console.log(`   Genomsnitt (alla månader): ${allAvgPrice.toFixed(2)} SEK/liter`);

const diff = avgPricePerLiter - allAvgPrice;
const diffPercent = (diff / allAvgPrice * 100);

if (diff > 0) {
  console.log(`   📈 ${diff.toFixed(2)} SEK/L DYRARE än snittet (+${diffPercent.toFixed(1)}%)\n`);
} else if (diff < 0) {
  console.log(`   📉 ${Math.abs(diff).toFixed(2)} SEK/L BILLIGARE än snittet (${diffPercent.toFixed(1)}%)\n`);
} else {
  console.log(`   ➡️  Samma som snittet\n`);
}

// Tips baserat på köpen
console.log('═══════════════════════════════════════════════════════════════\n');
console.log('💡 ANALYS:\n');

const hasExpensiveMilk = currentMonthMilk.some(m => m.pricePerLiter > 14);
const hasCheapMilk = currentMonthMilk.some(m => m.pricePerLiter < 10);

if (hasExpensiveMilk && !hasCheapMilk) {
  console.log('   ⚠️  Du köper bara dyr mjölk denna månad!');
  console.log('   💡 Överväg att köpa:');
  console.log('      • ICA "Mellanmjölk 1,5%" (~9.79 SEK/L)');
  console.log('      • Willys "Garant 1,5%" (~9.27 SEK/L)\n');
} else if (hasCheapMilk && hasExpensiveMilk) {
  console.log('   ⚠️  Blandade priser - både billig och dyr mjölk');
  const expensive = currentMonthMilk.filter(m => m.pricePerLiter > 14);
  console.log(`   💡 Undvik dessa dyrare varianter:`);
  expensive.forEach(m => {
    console.log(`      • ${m.name} (${m.pricePerLiter.toFixed(2)} SEK/L)`);
  });
  console.log('');
} else if (hasCheapMilk) {
  console.log('   ✅ Bra jobbat! Du köper billig mjölk denna månad.');
  console.log('   💪 Fortsätt köpa samma produkter!\n');
}

// Visa om du köpt på rätt ställe
if (willysMilk.length > 0 && icaMilk.length > 0) {
  const willysAvg = willysMilk.reduce((sum, m) => sum + m.totalPrice, 0) / willysMilk.reduce((sum, m) => sum + m.totalLiters, 0);
  const icaAvg = icaMilk.reduce((sum, m) => sum + m.totalPrice, 0) / icaMilk.reduce((sum, m) => sum + m.totalLiters, 0);

  if (icaAvg < willysAvg) {
    console.log(`   💡 ICA är billigare denna månad (${icaAvg.toFixed(2)} vs ${willysAvg.toFixed(2)} SEK/L)`);
    console.log(`      Överväg att köpa mer mjölk på ICA!\n`);
  } else {
    console.log(`   💡 Willys är billigare denna månad (${willysAvg.toFixed(2)} vs ${icaAvg.toFixed(2)} SEK/L)`);
    console.log(`      Överväg att köpa mer mjölk på Willys!\n`);
  }
}

console.log('═══════════════════════════════════════════════════════════════\n');
console.log('✅ Analys klar!\n');
