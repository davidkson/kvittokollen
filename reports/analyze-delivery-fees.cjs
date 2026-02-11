#!/usr/bin/env node

const fs = require('fs');

const willysData = JSON.parse(fs.readFileSync('../output/willys-analysis.json', 'utf8'));
const icaData = JSON.parse(fs.readFileSync('../output/ica-analysis.json', 'utf8'));

console.log('╔════════════════════════════════════════════════════════════════╗');
console.log('║              📦 LEVERANSAVGIFTER - DETALJANALYS               ║');
console.log('╚════════════════════════════════════════════════════════════════╝\n');

// Beräkna korrekt total från items (för Willys)
function calculateTotal(receipt) {
  if (!receipt.items || !Array.isArray(receipt.items)) return 0;
  return receipt.items.reduce((sum, item) => sum + (item.totalPrice || 0), 0);
}

// Hitta alla kvitton med leveransavgifter
const deliveryReceipts = {
  willys: [],
  ica: []
};

for (const receipt of willysData.receipts) {
  const deliveryItems = receipt.items?.filter(item =>
    /hemleverans|plockavgift|leverans/i.test(item.name)
  ) || [];

  if (deliveryItems.length > 0) {
    const total = calculateTotal(receipt);
    const deliveryFee = deliveryItems.reduce((sum, item) => sum + item.totalPrice, 0);
    const netTotal = total - deliveryFee;

    deliveryReceipts.willys.push({
      date: receipt.metadata?.date || '',
      deliveryItems,
      deliveryFee,
      netTotal,
      total,
      itemCount: receipt.items?.length || 0
    });
  }
}

for (const receipt of icaData.receipts) {
  const deliveryItems = receipt.items?.filter(item =>
    /hemleverans|plockavgift|leverans|avgift.*hem/i.test(item.name)
  ) || [];

  if (deliveryItems.length > 0) {
    const total = receipt.metadata.grandTotal || 0;
    const deliveryFee = deliveryItems.reduce((sum, item) => sum + item.totalPrice, 0);
    const netTotal = total - deliveryFee;

    deliveryReceipts.ica.push({
      date: receipt.metadata?.date || '',
      deliveryItems,
      deliveryFee,
      netTotal,
      total,
      itemCount: receipt.items?.length || 0
    });
  }
}

const allDeliveries = [
  ...deliveryReceipts.willys.map(r => ({ ...r, chain: 'Willys' })),
  ...deliveryReceipts.ica.map(r => ({ ...r, chain: 'ICA' }))
].sort((a, b) => new Date(a.date) - new Date(b.date));

console.log('📊 ÖVERSIKT:\n');
console.log(`   Willys leveranser: ${deliveryReceipts.willys.length} st`);
console.log(`   ICA leveranser: ${deliveryReceipts.ica.length} st`);
console.log(`   Totalt: ${allDeliveries.length} levererade inköp\n`);

const totalWillysFees = deliveryReceipts.willys.reduce((sum, r) => sum + r.deliveryFee, 0);
const totalIcaFees = deliveryReceipts.ica.reduce((sum, r) => sum + r.deliveryFee, 0);
const totalFees = totalWillysFees + totalIcaFees;

console.log(`   Willys avgifter: ${totalWillysFees.toFixed(2)} SEK`);
console.log(`   ICA avgifter: ${totalIcaFees.toFixed(2)} SEK`);
console.log(`   Totalt i avgifter: ${totalFees.toFixed(2)} SEK\n`);

console.log('═══════════════════════════════════════════════════════════════\n');
console.log('📅 ALLA LEVERANSER KRONOLOGISKT:\n');

allDeliveries.forEach((delivery, idx) => {
  const date = delivery.date ? new Date(delivery.date).toISOString().split('T')[0] : 'N/A';
  const percent = (delivery.deliveryFee / delivery.total * 100).toFixed(1);

  console.log(`${idx + 1}. ${date} - ${delivery.chain}`);
  console.log(`   💰 Total: ${delivery.total.toFixed(2)} SEK`);
  console.log(`   📦 Leveransavgift: ${delivery.deliveryFee.toFixed(2)} SEK (${percent}% av totalen)`);
  console.log(`   🛒 Varor (exkl. avgift): ${delivery.netTotal.toFixed(2)} SEK`);
  console.log(`   📊 Antal varor: ${delivery.itemCount}`);

  delivery.deliveryItems.forEach(item => {
    console.log(`      • ${item.name}: ${item.totalPrice.toFixed(2)} SEK`);
  });
  console.log('');
});

console.log('═══════════════════════════════════════════════════════════════\n');
console.log('📈 STATISTIK:\n');

const avgWillysFee = deliveryReceipts.willys.length > 0
  ? totalWillysFees / deliveryReceipts.willys.length
  : 0;
const avgIcaFee = deliveryReceipts.ica.length > 0
  ? totalIcaFees / deliveryReceipts.ica.length
  : 0;

const avgWillysOrder = deliveryReceipts.willys.length > 0
  ? deliveryReceipts.willys.reduce((sum, r) => sum + r.netTotal, 0) / deliveryReceipts.willys.length
  : 0;
const avgIcaOrder = deliveryReceipts.ica.length > 0
  ? deliveryReceipts.ica.reduce((sum, r) => sum + r.netTotal, 0) / deliveryReceipts.ica.length
  : 0;

console.log(`   Willys:`);
console.log(`      Snittavgift: ${avgWillysFee.toFixed(2)} SEK/leverans`);
console.log(`      Snittköp (exkl. avgift): ${avgWillysOrder.toFixed(2)} SEK`);
console.log(`      Avgift i %: ${(avgWillysFee / (avgWillysOrder + avgWillysFee) * 100).toFixed(1)}%\n`);

console.log(`   ICA:`);
console.log(`      Snittavgift: ${avgIcaFee.toFixed(2)} SEK/leverans`);
console.log(`      Snittköp (exkl. avgift): ${avgIcaOrder.toFixed(2)} SEK`);
console.log(`      Avgift i %: ${(avgIcaFee / (avgIcaOrder + avgIcaFee) * 100).toFixed(1)}%\n`);

console.log('═══════════════════════════════════════════════════════════════\n');
console.log('💡 JÄMFÖRELSE MOT TOTALA KOSTNADER:\n');

// Beräkna totala kostnader från alla kvitton
let totalWillysSpent = 0;
for (const receipt of willysData.receipts) {
  totalWillysSpent += calculateTotal(receipt);
}

let totalIcaSpent = 0;
for (const receipt of icaData.receipts) {
  totalIcaSpent += receipt.metadata.grandTotal || 0;
}

const grandTotal = totalWillysSpent + totalIcaSpent;

console.log(`   Total kostnad (allt): ${grandTotal.toFixed(2)} SEK`);
console.log(`   Leveransavgifter: ${totalFees.toFixed(2)} SEK`);
console.log(`   Andel avgifter: ${(totalFees / grandTotal * 100).toFixed(2)}%\n`);

console.log(`   Om du handlat i butik istället:`);
console.log(`   Sparat: ${totalFees.toFixed(2)} SEK`);
console.log(`   Det motsvarar: ${(totalFees / (grandTotal / allDeliveries.length)).toFixed(1)} gratis inköp!\n`);

console.log('═══════════════════════════════════════════════════════════════\n');
console.log('🎯 REKOMMENDATIONER:\n');

const highFeeOrders = allDeliveries.filter(d => {
  const percent = (d.deliveryFee / d.total * 100);
  return percent > 10;
});

if (highFeeOrders.length > 0) {
  console.log(`   ⚠️  ${highFeeOrders.length} leveranser där avgiften var >10% av totalen:`);
  highFeeOrders.forEach(order => {
    const date = new Date(order.date).toISOString().split('T')[0];
    const percent = (order.deliveryFee / order.total * 100).toFixed(1);
    console.log(`      • ${date}: ${order.deliveryFee.toFixed(2)} SEK avgift (${percent}%) för ${order.netTotal.toFixed(2)} SEK varor`);
  });
  console.log('');
}

const minOrderForFee = avgWillysFee > avgIcaFee ? avgWillysFee : avgIcaFee;
console.log(`   💡 För att avgiften ska vara <5% av köpet:`);
console.log(`      Handla för minst ${(minOrderForFee * 20).toFixed(0)} SEK per leverans\n`);

console.log(`   💡 Alternativ:`);
console.log(`      • Klicka & Hämta: Ofta gratis eller billigare`);
console.log(`      • Handla i butik: Spara ${totalFees.toFixed(2)} SEK`);
console.log(`      • Samla beställningar: Färre leveranser = mindre avgifter\n`);

console.log('═══════════════════════════════════════════════════════════════\n');
console.log('✅ Analys klar!\n');
