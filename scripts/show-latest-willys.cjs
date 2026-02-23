const data = require('../output/willys-analysis.json');

// Hitta senaste kvittot baserat på datum
const receipts = data.receipts.filter(r => r.metadata?.date);
receipts.sort((a, b) => new Date(b.metadata.date) - new Date(a.metadata.date));

const latest = receipts[0];

if (!latest) {
  console.log('Inget kvitto hittat med datum');
  process.exit(0);
}

const total = latest.items.reduce((sum, item) => sum + (item.totalPrice || 0), 0);
const date = new Date(latest.metadata.date);
const dateStr = date.toISOString().split('T')[0];
const timeStr = date.toTimeString().split(' ')[0];

console.log('═══════════════════════════════════════════════════════════════');
console.log('🧾 SENASTE WILLYS-KVITTO');
console.log('═══════════════════════════════════════════════════════════════\n');

console.log('📅 Datum: ' + dateStr + ' kl ' + timeStr);
console.log('🏪 Butik: ' + (latest.metadata.store || 'N/A'));
console.log('📄 Fil: ' + (latest.filename || 'N/A'));
console.log('💰 Total: ' + total.toFixed(2) + ' SEK');
console.log('📦 Antal varor: ' + latest.items.length);
console.log('\n═══════════════════════════════════════════════════════════════');
console.log('🛒 VAROR:\n');

// Gruppera items efter kategori
const byCategory = {};
latest.items.forEach(item => {
  const cat = item.category || 'Övrigt';
  if (!byCategory[cat]) byCategory[cat] = [];
  byCategory[cat].push(item);
});

// Visa per kategori
Object.entries(byCategory)
  .sort(([a], [b]) => a.localeCompare(b))
  .forEach(([category, items]) => {
    console.log('📂 ' + category.toUpperCase());
    items.forEach(item => {
      const qty = item.quantity > 1 ? ' (x' + item.quantity + ')' : '';
      const price = item.totalPrice.toFixed(2);
      const discount = item.isDiscount ? ' 🏷️' : '';
      console.log('   • ' + item.name + qty);
      console.log('     ' + price + ' SEK' + discount);
    });
    console.log();
  });

console.log('═══════════════════════════════════════════════════════════════');
console.log('💡 TIP: Kör "node scripts/show-latest-willys.cjs" för att se detta igen');
console.log('═══════════════════════════════════════════════════════════════');
