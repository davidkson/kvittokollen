const fs = require('fs');
const path = require('path');

/**
 * Tar bort dubbletter från Willys-analysis.json
 * Skapar backup innan borttagning
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
  const date = receipt.metadata?.date || receipt.date || receipt.receiptDate || 'unknown';
  const total = calculateTotal(receipt).toFixed(2);
  const itemCount = receipt.items?.length || 0;
  const itemsSignature = createItemsSignature(receipt.items);

  return `${date}|${total}|${itemCount}|${itemsSignature}`;
}

function removeDuplicates() {
  const willysPath = path.join(__dirname, '../output/willys-analysis.json');
  const backupPath = path.join(__dirname, '../output/willys-analysis.json.backup');

  console.log('📖 Läser Willys-data...');
  const data = JSON.parse(fs.readFileSync(willysPath, 'utf8'));

  const receipts = data.receipts || [];
  console.log(`   Totalt antal kvitton: ${receipts.length}\n`);

  // Skapa backup
  console.log('💾 Skapar backup...');
  fs.copyFileSync(willysPath, backupPath);
  console.log(`   ✅ Backup sparad: ${backupPath}\n`);

  // Hitta unika kvitton
  const signatureMap = new Map();
  const uniqueReceipts = [];
  const duplicates = [];

  receipts.forEach((receipt, index) => {
    const signature = createContentSignature(receipt);

    if (!signatureMap.has(signature)) {
      signatureMap.set(signature, { index, receipt });
      uniqueReceipts.push(receipt);
    } else {
      const original = signatureMap.get(signature);
      duplicates.push({
        signature,
        original: {
          index: original.index,
          date: original.receipt.metadata?.date || 'N/A',
          total: calculateTotal(original.receipt).toFixed(2),
          items: original.receipt.items?.length || 0
        },
        duplicate: {
          index: index,
          date: receipt.metadata?.date || 'N/A',
          total: calculateTotal(receipt).toFixed(2),
          items: receipt.items?.length || 0
        }
      });
    }
  });

  if (duplicates.length === 0) {
    console.log('✅ Inga dubbletter hittades! Ingen uppdatering behövs.\n');
    fs.unlinkSync(backupPath); // Ta bort backup
    return;
  }

  console.log(`🔍 Hittade ${duplicates.length} dubbletter:\n`);

  duplicates.forEach((dup, i) => {
    console.log(`Dubblett #${i + 1}:`);
    console.log(`  Original (index ${dup.original.index}): ${dup.original.total} SEK, ${dup.original.items} items`);
    console.log(`  Dubblett (index ${dup.duplicate.index}): ${dup.duplicate.total} SEK, ${dup.duplicate.items} items`);
  });

  // Uppdatera metadata
  const oldTotal = data.metadata.totalSpending;
  const oldCount = data.metadata.totalReceipts;
  const oldItems = data.metadata.totalItems;

  const newTotal = uniqueReceipts.reduce((sum, r) => sum + calculateTotal(r), 0);
  const newCount = uniqueReceipts.length;
  const newItems = uniqueReceipts.reduce((sum, r) => sum + (r.items?.length || 0), 0);

  data.metadata.totalReceipts = newCount;
  data.metadata.totalSpending = newTotal;
  data.metadata.totalItems = newItems;
  data.metadata.averageBasket = newCount > 0 ? newTotal / newCount : 0;
  data.metadata.lastUpdated = new Date().toISOString();
  data.receipts = uniqueReceipts;

  // Spara uppdaterad fil
  console.log('\n💾 Sparar uppdaterad fil...');
  fs.writeFileSync(willysPath, JSON.stringify(data, null, 2), 'utf8');

  console.log('\n' + '='.repeat(60));
  console.log('✅ KLART! Dubbletter borttagna');
  console.log('='.repeat(60));
  console.log(`📊 Före:`);
  console.log(`   Kvitton: ${oldCount}`);
  console.log(`   Total: ${oldTotal.toFixed(2)} SEK`);
  console.log(`   Items: ${oldItems}`);
  console.log(`\n📊 Efter:`);
  console.log(`   Kvitton: ${newCount}`);
  console.log(`   Total: ${newTotal.toFixed(2)} SEK`);
  console.log(`   Items: ${newItems}`);
  console.log(`\n📉 Skillnad:`);
  console.log(`   Kvitton: -${oldCount - newCount}`);
  console.log(`   Total: -${(oldTotal - newTotal).toFixed(2)} SEK`);
  console.log(`   Items: -${oldItems - newItems}`);
  console.log(`\n💾 Backup finns på: ${backupPath}`);
  console.log('='.repeat(60));
}

removeDuplicates();
