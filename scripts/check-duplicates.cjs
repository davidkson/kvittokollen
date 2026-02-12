#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const outputDir = path.join(__dirname, '../output');
const willysData = JSON.parse(fs.readFileSync(path.join(outputDir, 'willys-analysis.json'), 'utf8'));
const icaData = JSON.parse(fs.readFileSync(path.join(outputDir, 'ica-analysis.json'), 'utf8'));

console.log('╔════════════════════════════════════════════════════════════════╗');
console.log('║              🔍 SÖKER EFTER DUBBLETTER                        ║');
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

  return {
    date,
    total: total.toFixed(2),
    itemCount,
    itemsSignature,
    filename: receipt.filename
  };
}

function findDuplicates(receipts, chain, chainName) {
  console.log(`═══════════════════════════════════════════════════════════════`);
  console.log(`🏪 ${chainName.toUpperCase()}:\n`);

  const signatures = receipts.map((receipt, idx) => ({
    index: idx,
    ...createReceiptSignature(receipt, chain),
    receipt
  }));

  // Gruppera efter filnamn
  const byFilename = {};
  signatures.forEach(sig => {
    const fn = sig.filename;
    if (!byFilename[fn]) byFilename[fn] = [];
    byFilename[fn].push(sig);
  });

  const filenameDuplicates = Object.entries(byFilename)
    .filter(([_, sigs]) => sigs.length > 1);

  if (filenameDuplicates.length > 0) {
    console.log(`📁 SAMMA FILNAMN (${filenameDuplicates.length} grupper):\n`);
    filenameDuplicates.forEach(([filename, sigs]) => {
      console.log(`   Filnamn: ${filename}`);
      console.log(`   Antal: ${sigs.length} kopior`);
      sigs.forEach((sig, idx) => {
        console.log(`      ${idx + 1}. Datum: ${sig.date}, Total: ${sig.total} SEK, Varor: ${sig.itemCount}`);
      });
      console.log('');
    });
  }

  // Gruppera efter datum + total + itemCount
  const byDateTotal = {};
  signatures.forEach(sig => {
    const key = `${sig.date}|${sig.total}|${sig.itemCount}`;
    if (!byDateTotal[key]) byDateTotal[key] = [];
    byDateTotal[key].push(sig);
  });

  const dateTotalDuplicates = Object.entries(byDateTotal)
    .filter(([_, sigs]) => sigs.length > 1);

  if (dateTotalDuplicates.length > 0) {
    console.log(`📅 SAMMA DATUM + BELOPP + ANTAL VAROR (${dateTotalDuplicates.length} grupper):\n`);
    dateTotalDuplicates.forEach(([key, sigs]) => {
      const [date, total, itemCount] = key.split('|');
      console.log(`   ${date} - ${total} SEK (${itemCount} varor)`);
      console.log(`   Antal: ${sigs.length} kopior`);
      sigs.forEach((sig, idx) => {
        console.log(`      ${idx + 1}. ${sig.filename}`);
      });
      console.log('');
    });
  }

  // Gruppera efter exakt innehåll (itemsSignature)
  const byContent = {};
  signatures.forEach(sig => {
    const key = sig.itemsSignature;
    if (!byContent[key]) byContent[key] = [];
    byContent[key].push(sig);
  });

  const contentDuplicates = Object.entries(byContent)
    .filter(([_, sigs]) => sigs.length > 1);

  if (contentDuplicates.length > 0) {
    console.log(`🛒 EXAKT SAMMA INNEHÅLL (${contentDuplicates.length} grupper):\n`);
    contentDuplicates.forEach(([_, sigs]) => {
      const first = sigs[0];
      console.log(`   Datum: ${first.date}, Total: ${first.total} SEK, Varor: ${first.itemCount}`);
      console.log(`   Antal: ${sigs.length} exakta kopior`);
      sigs.forEach((sig, idx) => {
        console.log(`      ${idx + 1}. ${sig.filename}`);
      });
      console.log('');
    });
  }

  if (filenameDuplicates.length === 0 && dateTotalDuplicates.length === 0 && contentDuplicates.length === 0) {
    console.log('✅ Inga dubbletter hittades!\n');
  }

  return {
    filenameDuplicates: filenameDuplicates.length,
    dateTotalDuplicates: dateTotalDuplicates.length,
    contentDuplicates: contentDuplicates.length,
    totalDuplicateReceipts: contentDuplicates.reduce((sum, [_, sigs]) => sum + sigs.length - 1, 0)
  };
}

const willysResult = findDuplicates(willysData.receipts, 'willys', 'Willys');
const icaResult = findDuplicates(icaData.receipts, 'ica', 'ICA');

console.log('═══════════════════════════════════════════════════════════════');
console.log('📊 SAMMANFATTNING:\n');

console.log(`🏪 Willys:`);
console.log(`   Total antal kvitton: ${willysData.receipts.length}`);
console.log(`   Dubbletter (exakt innehåll): ${willysResult.totalDuplicateReceipts}`);
console.log(`   Unika kvitton: ${willysData.receipts.length - willysResult.totalDuplicateReceipts}\n`);

console.log(`🏪 ICA:`);
console.log(`   Total antal kvitton: ${icaData.receipts.length}`);
console.log(`   Dubbletter (exakt innehåll): ${icaResult.totalDuplicateReceipts}`);
console.log(`   Unika kvitton: ${icaData.receipts.length - icaResult.totalDuplicateReceipts}\n`);

const totalDuplicates = willysResult.totalDuplicateReceipts + icaResult.totalDuplicateReceipts;
if (totalDuplicates > 0) {
  console.log(`⚠️  Totalt ${totalDuplicates} dubblettkvitton hittades!`);
  console.log(`💡 Dessa bör tas bort för korrekt analys.\n`);
} else {
  console.log('✅ Inga dubbletter hittades - data är ren!\n');
}

console.log('═══════════════════════════════════════════════════════════════\n');
