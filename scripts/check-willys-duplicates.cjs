const fs = require('fs');
const path = require('path');

/**
 * Kontrollerar Willys-kvitton för dubbletter baserat på content signature
 * Signatur: datum|totalsumma|antal items|items signatur
 */

function calculateTotal(receipt) {
  if (!receipt.items || !Array.isArray(receipt.items)) return 0;
  return receipt.items.reduce((sum, item) => sum + (item.totalPrice || 0), 0);
}

function createItemsSignature(items) {
  if (!items || !Array.isArray(items)) return '';
  return items
    .map(item => `${item.name}:${item.quantity}:${item.totalPrice}`)
    .sort()
    .join('|');
}

function createContentSignature(receipt) {
  const date = receipt.date || receipt.receiptDate || 'unknown';
  const total = calculateTotal(receipt).toFixed(2);
  const itemCount = receipt.items?.length || 0;
  const itemsSignature = createItemsSignature(receipt.items);

  return `${date}|${total}|${itemCount}|${itemsSignature}`;
}

function checkDuplicates() {
  const willysPath = path.join(__dirname, '../output/willys-analysis.json');

  console.log('Läser Willys-data...');
  const data = JSON.parse(fs.readFileSync(willysPath, 'utf8'));

  const receipts = data.receipts || [];
  console.log(`Total antal kvitton: ${receipts.length}\n`);

  const signatureMap = new Map();
  const duplicates = [];

  receipts.forEach((receipt, index) => {
    const signature = createContentSignature(receipt);

    if (signatureMap.has(signature)) {
      const original = signatureMap.get(signature);
      duplicates.push({
        signature,
        original: {
          index: original.index,
          date: original.receipt.date || original.receipt.receiptDate,
          total: calculateTotal(original.receipt).toFixed(2),
          items: original.receipt.items?.length || 0,
          fileName: original.receipt.fileName
        },
        duplicate: {
          index: index,
          date: receipt.date || receipt.receiptDate,
          total: calculateTotal(receipt).toFixed(2),
          items: receipt.items?.length || 0,
          fileName: receipt.fileName
        }
      });
    } else {
      signatureMap.set(signature, { index, receipt });
    }
  });

  if (duplicates.length === 0) {
    console.log('✅ Inga dubbletter hittades!');
  } else {
    console.log(`❌ Hittade ${duplicates.length} dubbletter:\n`);

    duplicates.forEach((dup, i) => {
      console.log(`Dubblett #${i + 1}:`);
      console.log(`  Original (index ${dup.original.index}):`);
      console.log(`    Datum: ${dup.original.date}`);
      console.log(`    Total: ${dup.original.total} SEK`);
      console.log(`    Items: ${dup.original.items}`);
      console.log(`    Fil: ${dup.original.fileName || 'N/A'}`);
      console.log(`  Dubblett (index ${dup.duplicate.index}):`);
      console.log(`    Datum: ${dup.duplicate.date}`);
      console.log(`    Total: ${dup.duplicate.total} SEK`);
      console.log(`    Items: ${dup.duplicate.items}`);
      console.log(`    Fil: ${dup.duplicate.fileName || 'N/A'}`);
      console.log();
    });

    console.log(`\nSammanfattning:`);
    console.log(`  Totalt antal kvitton: ${receipts.length}`);
    console.log(`  Unika kvitton: ${signatureMap.size}`);
    console.log(`  Dubbletter: ${duplicates.length}`);
  }
}

checkDuplicates();
