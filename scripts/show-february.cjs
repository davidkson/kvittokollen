const fs = require('fs');

const willysData = JSON.parse(fs.readFileSync('./output/willys-analysis.json', 'utf8'));
const icaData = JSON.parse(fs.readFileSync('./output/ica-analysis.json', 'utf8'));

// Funktion för att beräkna total från items (Willys grandTotal är fel)
function calculateTotal(receipt) {
  if (!receipt.items || !Array.isArray(receipt.items)) return 0;
  return receipt.items.reduce((sum, item) => sum + (item.totalPrice || 0), 0);
}

let willysTotal = 0;
let willysCount = 0;
let icaTotal = 0;
let icaCount = 0;

const willysReceipts = [];
const icaReceipts = [];

// Willys februari
if (willysData.receipts) {
  willysData.receipts.forEach(receipt => {
    const date = new Date(receipt.metadata?.date);
    if (date.getFullYear() === 2026 && date.getMonth() === 1) { // Month 1 = February
      const correctTotal = calculateTotal(receipt);
      willysTotal += correctTotal;
      willysCount++;
      willysReceipts.push({
        date: date.toISOString().split('T')[0],
        total: correctTotal
      });
    }
  });
}

// ICA februari
if (icaData.receipts) {
  icaData.receipts.forEach(receipt => {
    const date = new Date(receipt.metadata?.date);
    if (date.getFullYear() === 2026 && date.getMonth() === 1) { // Month 1 = February
      const total = receipt.metadata?.grandTotal || 0;
      icaTotal += total;
      icaCount++;
      icaReceipts.push({
        date: date.toISOString().split('T')[0],
        total: total
      });
    }
  });
}

const grandTotal = willysTotal + icaTotal;
const grandCount = willysCount + icaCount;

console.log('═══════════════════════════════════════════════════════════════');
console.log('📊 FEBRUARI 2026 - HANDLINGSSAMMANFATTNING');
console.log('═══════════════════════════════════════════════════════════════\n');

console.log('💰 TOTAL: ' + grandTotal.toFixed(2) + ' SEK');
console.log('🛒 Antal kvitton: ' + grandCount);
console.log('📊 Genomsnitt/kvitto: ' + (grandTotal / grandCount).toFixed(2) + ' SEK\n');

console.log('═══════════════════════════════════════════════════════════════');
console.log('🏪 PER BUTIK:\n');

console.log('🛒 WILLYS:');
console.log('   💰 ' + willysTotal.toFixed(2) + ' SEK (' + ((willysTotal / grandTotal) * 100).toFixed(1) + '%)');
console.log('   🛒 ' + willysCount + ' kvitton');
console.log('   📊 Snitt: ' + (willysCount > 0 ? (willysTotal / willysCount).toFixed(2) : '0.00') + ' SEK/kvitto\n');

console.log('🍎 ICA:');
console.log('   💰 ' + icaTotal.toFixed(2) + ' SEK (' + ((icaTotal / grandTotal) * 100).toFixed(1) + '%)');
console.log('   🛒 ' + icaCount + ' kvitton');
console.log('   📊 Snitt: ' + (icaCount > 0 ? (icaTotal / icaCount).toFixed(2) : '0.00') + ' SEK/kvitto\n');

console.log('═══════════════════════════════════════════════════════════════');
console.log('📅 ALLA KVITTON I FEBRUARI:\n');

const allReceipts = [
  ...willysReceipts.map(r => ({ ...r, store: 'Willys' })),
  ...icaReceipts.map(r => ({ ...r, store: 'ICA' }))
].sort((a, b) => a.date.localeCompare(b.date));

allReceipts.forEach(r => {
  const store = r.store === 'Willys' ? '🛒' : '🍎';
  console.log(`  ${store} ${r.date} - ${r.total.toFixed(2)} SEK`);
});

console.log('\n═══════════════════════════════════════════════════════════════');
