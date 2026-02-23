const data = require('../output/willys-analysis.json');

console.log('Kollar datum för kvitton 87-93 (före rensning av dubbletter):\n');

const receipts = data.receipts.slice(87, 94);
receipts.forEach((r, i) => {
  const actualIndex = 87 + i;
  const date = r.metadata?.date || 'MISSING';
  const filename = r.filename || 'N/A';
  const total = r.items?.reduce((sum, item) => sum + (item.totalPrice || 0), 0).toFixed(2) || '0';

  console.log(`Index ${actualIndex}:`);
  console.log(`  Date: ${date}`);
  console.log(`  Filename: ${filename}`);
  console.log(`  Total: ${total} SEK`);
  console.log(`  Items: ${r.items?.length || 0}`);
  console.log();
});
