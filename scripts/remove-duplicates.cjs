#!/usr/bin/env node

const fs = require('fs');

console.log('╔════════════════════════════════════════════════════════════════╗');
console.log('║              🧹 TAR BORT DUBBLETTER                           ║');
console.log('╚════════════════════════════════════════════════════════════════╝\n');

// Beräkna korrekt total från items (för Willys)
function calculateTotal(receipt) {
  if (!receipt.items || !Array.isArray(receipt.items)) return 0;
  return receipt.items.reduce((sum, item) => sum + (item.totalPrice || 0), 0);
}

// Skapa en "signatur" för ett kvitto baserat på innehållet
function createReceiptSignature(receipt, chain) {
  const total = chain === 'willys' ? calculateTotal(receipt) : (receipt.metadata.grandTotal || 0);
  const itemCount = receipt.items?.length || 0;
  const date = receipt.metadata?.date || '';

  // Skapa en sorterad lista av items för att jämföra innehåll
  const itemsSignature = (receipt.items || [])
    .map(item => `${item.name}:${item.quantity}:${item.totalPrice}`)
    .sort()
    .join('|');

  return `${date}|${total.toFixed(2)}|${itemCount}|${itemsSignature}`;
}

function removeDuplicates(data, chain, chainName) {
  console.log(`🏪 ${chainName.toUpperCase()}:`);
  console.log(`   Före: ${data.receipts.length} kvitton`);

  const seen = new Set();
  const uniqueReceipts = [];
  let duplicateCount = 0;

  for (const receipt of data.receipts) {
    const signature = createReceiptSignature(receipt, chain);

    if (!seen.has(signature)) {
      seen.add(signature);
      uniqueReceipts.push(receipt);
    } else {
      duplicateCount++;
      console.log(`   ✂️  Tar bort: ${receipt.filename} (${receipt.metadata?.date})`);
    }
  }

  console.log(`   Efter: ${uniqueReceipts.length} kvitton`);
  console.log(`   Borttagna: ${duplicateCount} dubbletter\n`);

  return {
    ...data,
    receipts: uniqueReceipts
  };
}

// Läs in data
const willysData = JSON.parse(fs.readFileSync('../output/willys-analysis.json', 'utf8'));
const icaData = JSON.parse(fs.readFileSync('../output/ica-analysis.json', 'utf8'));

// Ta bort dubbletter
const cleanWillys = removeDuplicates(willysData, 'willys', 'Willys');
const cleanIca = removeDuplicates(icaData, 'ica', 'ICA');

// Spara rensade filer
fs.writeFileSync('../output/willys-analysis.json', JSON.stringify(cleanWillys, null, 2), 'utf8');
fs.writeFileSync('../output/ica-analysis.json', JSON.stringify(cleanIca, null, 2), 'utf8');

console.log('═══════════════════════════════════════════════════════════════');
console.log('💾 SPARADE RENSADE FILER:\n');
console.log('   ✅ output/willys-analysis.json');
console.log('   ✅ output/ica-analysis.json\n');

console.log('═══════════════════════════════════════════════════════════════');
console.log('📊 TOTALT:\n');

const totalBefore = willysData.receipts.length + icaData.receipts.length;
const totalAfter = cleanWillys.receipts.length + cleanIca.receipts.length;
const totalRemoved = totalBefore - totalAfter;

console.log(`   Före:      ${totalBefore} kvitton`);
console.log(`   Efter:     ${totalAfter} kvitton`);
console.log(`   Borttagna: ${totalRemoved} dubbletter\n`);

console.log('✅ Klart! Kör nu "npm run analyze-combined" för uppdaterad analys.\n');
