#!/usr/bin/env node

const fs = require('fs');

const willysData = JSON.parse(fs.readFileSync('../output/willys-analysis.json', 'utf8'));
const icaData = JSON.parse(fs.readFileSync('../output/ica-analysis.json', 'utf8'));

console.log('╔════════════════════════════════════════════════════════════════╗');
console.log('║           🔍 DETALJANALYS - NOVEMBER 2025                     ║');
console.log('╚════════════════════════════════════════════════════════════════╝\n');

// Beräkna korrekt total från items (för Willys)
function calculateTotal(receipt) {
  if (!receipt.items || !Array.isArray(receipt.items)) return 0;
  return receipt.items.reduce((sum, item) => sum + (item.totalPrice || 0), 0);
}

// Samla November 2025 kvitton
const novReceipts = [];

for (const receipt of willysData.receipts) {
  if (!receipt.metadata || !receipt.metadata.date) continue;
  const date = new Date(receipt.metadata.date);
  if (date.getFullYear() === 2025 && date.getMonth() === 10) { // November = månad 10 (0-indexed)
    novReceipts.push({
      date: receipt.metadata.date,
      chain: 'Willys',
      total: calculateTotal(receipt),
      items: receipt.items || [],
      itemCount: receipt.items?.length || 0
    });
  }
}

for (const receipt of icaData.receipts) {
  if (!receipt.metadata || !receipt.metadata.date) continue;
  const date = new Date(receipt.metadata.date);
  if (date.getFullYear() === 2025 && date.getMonth() === 10) {
    novReceipts.push({
      date: receipt.metadata.date,
      chain: 'ICA',
      total: receipt.metadata.grandTotal || 0,
      items: receipt.items || [],
      itemCount: receipt.items?.length || 0
    });
  }
}

// Sortera efter datum
novReceipts.sort((a, b) => new Date(a.date) - new Date(b.date));

console.log('═══════════════════════════════════════════════════════════════\n');
console.log('📅 ALLA INKÖP I NOVEMBER 2025:\n');

novReceipts.forEach((receipt, idx) => {
  const date = new Date(receipt.date).toISOString().split('T')[0];
  console.log(`${idx + 1}. ${date} - ${receipt.chain}`);
  console.log(`   💰 ${receipt.total.toFixed(2)} SEK (${receipt.itemCount} varor)\n`);
});

const totalNov = novReceipts.reduce((sum, r) => sum + r.total, 0);
const willysNov = novReceipts.filter(r => r.chain === 'Willys');
const icaNov = novReceipts.filter(r => r.chain === 'ICA');

console.log('═══════════════════════════════════════════════════════════════\n');
console.log('📊 NOVEMBER 2025 SAMMANFATTNING:\n');

console.log(`   💰 Totalt: ${totalNov.toFixed(2)} SEK`);
console.log(`   🛒 Antal inköp: ${novReceipts.length}`);
console.log(`   📊 Snitt per inköp: ${(totalNov / novReceipts.length).toFixed(2)} SEK\n`);

console.log(`   Willys: ${willysNov.length} inköp, ${willysNov.reduce((s, r) => s + r.total, 0).toFixed(2)} SEK`);
console.log(`   ICA: ${icaNov.length} inköp, ${icaNov.reduce((s, r) => s + r.total, 0).toFixed(2)} SEK\n`);

// Jämför med genomsnittet
console.log('═══════════════════════════════════════════════════════════════\n');
console.log('📈 JÄMFÖRELSE MED ANDRA MÅNADER:\n');

// Beräkna genomsnitt för andra månader
const otherMonths = {};

for (const receipt of willysData.receipts) {
  if (!receipt.metadata || !receipt.metadata.date) continue;
  const date = new Date(receipt.metadata.date);
  const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

  if (monthKey === '2025-11') continue; // Skippa november

  if (!otherMonths[monthKey]) otherMonths[monthKey] = { total: 0, count: 0 };
  otherMonths[monthKey].total += calculateTotal(receipt);
  otherMonths[monthKey].count++;
}

for (const receipt of icaData.receipts) {
  if (!receipt.metadata || !receipt.metadata.date) continue;
  const date = new Date(receipt.metadata.date);
  const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

  if (monthKey === '2025-11') continue;

  if (!otherMonths[monthKey]) otherMonths[monthKey] = { total: 0, count: 0 };
  otherMonths[monthKey].total += receipt.metadata.grandTotal || 0;
  otherMonths[monthKey].count++;
}

const avgOtherTotal = Object.values(otherMonths).reduce((sum, m) => sum + m.total, 0) / Object.keys(otherMonths).length;
const avgOtherCount = Object.values(otherMonths).reduce((sum, m) => sum + m.count, 0) / Object.keys(otherMonths).length;

console.log(`   November 2025:`);
console.log(`      Total: ${totalNov.toFixed(2)} SEK`);
console.log(`      Antal inköp: ${novReceipts.length}`);
console.log(`      Snitt per inköp: ${(totalNov / novReceipts.length).toFixed(2)} SEK\n`);

console.log(`   Genomsnitt andra månader:`);
console.log(`      Total: ${avgOtherTotal.toFixed(2)} SEK`);
console.log(`      Antal inköp: ${avgOtherCount.toFixed(1)}`);
console.log(`      Snitt per inköp: ${(avgOtherTotal / avgOtherCount).toFixed(2)} SEK\n`);

const diffTotal = totalNov - avgOtherTotal;
const diffPercent = (diffTotal / avgOtherTotal * 100);

console.log(`   📊 Skillnad: ${diffTotal.toFixed(2)} SEK (${diffPercent.toFixed(1)}%)`);
console.log(`   📊 Antal inköp: ${novReceipts.length} vs ${avgOtherCount.toFixed(1)} normalt\n`);

// Analysera vad som kan ha hänt
console.log('═══════════════════════════════════════════════════════════════\n');
console.log('🔍 VAD SKILJER NOVEMBER?\n');

// Kolla om det finns stora hemleveranser
const hasDelivery = novReceipts.some(r =>
  r.items.some(item => /hemleverans|plockavgift/i.test(item.name))
);

console.log(`   Hemleveranser: ${hasDelivery ? 'Ja' : 'Nej (ingen hemleverans!)'}`);

if (!hasDelivery) {
  console.log(`   💡 Detta kan förklara lägre kostnad - inga stora hemleveranser\n`);
}

// Kolla fördelning över månaden
const firstDay = Math.min(...novReceipts.map(r => new Date(r.date).getDate()));
const lastDay = Math.max(...novReceipts.map(r => new Date(r.date).getDate()));

console.log(`   Spridning: ${firstDay} nov - ${lastDay} nov (${lastDay - firstDay + 1} dagars period)`);

// Kolla om det är många små inköp
const smallPurchases = novReceipts.filter(r => r.total < 300);
console.log(`   Små inköp (<300 SEK): ${smallPurchases.length} av ${novReceipts.length}\n`);

// Kolla storleken på inköpen
const avgPerPurchase = totalNov / novReceipts.length;
const avgPerPurchaseOther = avgOtherTotal / avgOtherCount;

console.log(`   Genomsnitt per inköp:`);
console.log(`      November: ${avgPerPurchase.toFixed(2)} SEK`);
console.log(`      Normalt: ${avgPerPurchaseOther.toFixed(2)} SEK`);
console.log(`      Skillnad: ${(avgPerPurchase - avgPerPurchaseOther).toFixed(2)} SEK\n`);

// Visa största inköpen
console.log('═══════════════════════════════════════════════════════════════\n');
console.log('💰 STÖRSTA INKÖPEN I NOVEMBER:\n');

const sorted = [...novReceipts].sort((a, b) => b.total - a.total);
sorted.slice(0, 5).forEach((receipt, idx) => {
  const date = new Date(receipt.date).toISOString().split('T')[0];
  console.log(`${idx + 1}. ${date} - ${receipt.chain}: ${receipt.total.toFixed(2)} SEK`);

  // Visa topp 3 varor
  const topItems = receipt.items
    .sort((a, b) => b.totalPrice - a.totalPrice)
    .slice(0, 3);

  topItems.forEach(item => {
    console.log(`      • ${item.name}: ${item.totalPrice.toFixed(2)} SEK`);
  });
  console.log('');
});

console.log('═══════════════════════════════════════════════════════════════\n');
console.log('💡 SLUTSATS:\n');

if (!hasDelivery && novReceipts.length > avgOtherCount) {
  console.log('   ✅ November har fler men mindre inköp än normalt');
  console.log('   ✅ Ingen hemleverans = lägre totalkostnad');
  console.log('   💡 Du handlade oftare men köpte mindre varje gång\n');
} else if (!hasDelivery) {
  console.log('   ✅ Ingen hemleverans detta månad');
  console.log('   💡 Normalt kostar hemleveranser 2,000-3,000 SEK per tillfälle\n');
} else if (novReceipts.length < avgOtherCount) {
  console.log('   ⚠️  Färre inköp än normalt');
  console.log('   💡 Möjligen mindre konsumption eller annan källa för mat\n');
} else {
  console.log('   💡 November verkar vara en månad med lägre konsumption\n');
}

console.log('═══════════════════════════════════════════════════════════════\n');
console.log('✅ Analys klar!\n');
