const fs = require('fs');

const willysData = JSON.parse(fs.readFileSync('./output/willys-analysis.json', 'utf8'));
const icaData = JSON.parse(fs.readFileSync('./output/ica-analysis.json', 'utf8'));

let willysTotal = 0;
let willysCount = 0;
let icaTotal = 0;
let icaCount = 0;

// Check Willys receipts
// OBS: grandTotal är FELAKTIG i Willys-data - räkna från items istället
if (willysData.receipts) {
  willysData.receipts.forEach(receipt => {
    const date = new Date(receipt.metadata.date);
    if (date.getFullYear() === 2026 && date.getMonth() === 1) { // Month 1 = February
      // Beräkna korrekt total från items
      const correctTotal = receipt.items.reduce((sum, item) => sum + (item.totalPrice || 0), 0);
      willysTotal += correctTotal;
      willysCount++;
      console.log(`Willys ${date.toISOString().split('T')[0]}: ${correctTotal.toFixed(2)} kr`);
    }
  });
}

// Check ICA receipts
if (icaData.receipts) {
  icaData.receipts.forEach(receipt => {
    const date = new Date(receipt.metadata.date);
    if (date.getFullYear() === 2026 && date.getMonth() === 1) { // Month 1 = February
      icaTotal += receipt.metadata.grandTotal;
      icaCount++;
      console.log(`ICA ${date.toISOString().split('T')[0]}: ${receipt.metadata.grandTotal.toFixed(2)} kr`);
    }
  });
}

console.log('\n' + '='.repeat(60));
console.log('📊 FEBRUARI 2026 - SAMMANFATTNING');
console.log('='.repeat(60));
console.log(`🛒 Willys: ${willysCount} kvitton = ${willysTotal.toFixed(2)} kr`);
console.log(`🛒 ICA:    ${icaCount} kvitton = ${icaTotal.toFixed(2)} kr`);
console.log('-'.repeat(60));
console.log(`💰 TOTALT: ${willysCount + icaCount} kvitton = ${(willysTotal + icaTotal).toFixed(2)} kr`);
console.log('='.repeat(60));
