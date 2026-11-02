const { loadWillys, calculateTotal } = require('../lib/data.cjs');

/**
 * Kontrollerar Willys-kvitton för dubbletter baserat på content signature
 * Signatur: datum|totalsumma|antal items|items signatur
 */

function createItemsSignature(items) {
  if (!items || !Array.isArray(items)) return '';
  return items
    .map(item => `${item.name}:${item.quantity}:${item.totalPrice}`)
    .sort()
    .join('|');
}

function createContentSignature(receipt) {
  const date = receipt.metadata?.date || receipt.date || receipt.receiptDate || 'unknown';
  const total = calculateTotal(receipt).toFixed(2);
  const itemCount = receipt.items?.length || 0;
  const itemsSignature = createItemsSignature(receipt.items);

  return `${date}|${total}|${itemCount}|${itemsSignature}`;
}

function checkDuplicates() {
  console.log('Läser Willys-data...');
  const data = loadWillys();

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
          date: original.receipt.metadata?.date || original.receipt.date || original.receipt.receiptDate,
          total: calculateTotal(original.receipt).toFixed(2),
          items: original.receipt.items?.length || 0,
          fileName: original.receipt.filename
        },
        duplicate: {
          index: index,
          date: receipt.metadata?.date || receipt.date || receipt.receiptDate,
          total: calculateTotal(receipt).toFixed(2),
          items: receipt.items?.length || 0,
          fileName: receipt.filename
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
