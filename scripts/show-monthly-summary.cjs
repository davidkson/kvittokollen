const fs = require('fs');

const willysData = JSON.parse(fs.readFileSync('./output/willys-analysis.json', 'utf8'));
const icaData = JSON.parse(fs.readFileSync('./output/ica-analysis.json', 'utf8'));

// Funktion för att beräkna total från items (Willys grandTotal är fel)
function calculateTotal(receipt) {
  if (!receipt.items || !Array.isArray(receipt.items)) return 0;
  return receipt.items.reduce((sum, item) => sum + (item.totalPrice || 0), 0);
}

// Gruppera kvitton per månad
const monthlyData = {};

// Willys
if (willysData.receipts) {
  willysData.receipts.forEach(receipt => {
    const date = new Date(receipt.metadata?.date);
    if (!date || isNaN(date.getTime())) return;

    const yearMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

    if (!monthlyData[yearMonth]) {
      monthlyData[yearMonth] = {
        willys: { total: 0, count: 0 },
        ica: { total: 0, count: 0 }
      };
    }

    const total = calculateTotal(receipt);
    monthlyData[yearMonth].willys.total += total;
    monthlyData[yearMonth].willys.count++;
  });
}

// ICA
if (icaData.receipts) {
  icaData.receipts.forEach(receipt => {
    const date = new Date(receipt.metadata?.date);
    if (!date || isNaN(date.getTime())) return;

    const yearMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

    if (!monthlyData[yearMonth]) {
      monthlyData[yearMonth] = {
        willys: { total: 0, count: 0 },
        ica: { total: 0, count: 0 }
      };
    }

    const total = receipt.metadata?.grandTotal || 0;
    monthlyData[yearMonth].ica.total += total;
    monthlyData[yearMonth].ica.count++;
  });
}

// Sortera månader
const sortedMonths = Object.keys(monthlyData).sort();

// Få senaste 12 månaderna
const last12Months = sortedMonths.slice(-12);

console.log('═══════════════════════════════════════════════════════════════');
console.log('📊 MÅNATLIG SAMMANFATTNING - SENASTE 12 MÅNADERNA');
console.log('═══════════════════════════════════════════════════════════════\n');

const monthNames = {
  '01': 'Januari', '02': 'Februari', '03': 'Mars', '04': 'April',
  '05': 'Maj', '06': 'Juni', '07': 'Juli', '08': 'Augusti',
  '09': 'September', '10': 'Oktober', '11': 'November', '12': 'December'
};

let grandTotal = 0;
let grandCount = 0;

last12Months.forEach(yearMonth => {
  const [year, month] = yearMonth.split('-');
  const data = monthlyData[yearMonth];

  const willysTotal = data.willys.total;
  const icaTotal = data.ica.total;
  const total = willysTotal + icaTotal;
  const count = data.willys.count + data.ica.count;

  grandTotal += total;
  grandCount += count;

  console.log(`📅 ${monthNames[month]} ${year}`);
  console.log(`   💰 Total: ${total.toFixed(2)} SEK (${count} kvitton)`);
  console.log(`   🛒 Willys: ${willysTotal.toFixed(2)} SEK (${data.willys.count} kvitton)`);
  console.log(`   🍎 ICA: ${icaTotal.toFixed(2)} SEK (${data.ica.count} kvitton)`);

  // Bar chart
  const barLength = Math.round((total / 15000) * 40);
  const bar = '█'.repeat(Math.max(1, barLength));
  console.log(`   📊 ${bar} ${total.toFixed(0)} SEK`);
  console.log('');
});

console.log('═══════════════════════════════════════════════════════════════');
console.log('📈 SAMMANFATTNING:\n');

const avgPerMonth = grandTotal / last12Months.length;
const avgPerReceipt = grandTotal / grandCount;

console.log(`💰 Total 12 månader: ${grandTotal.toFixed(2)} SEK`);
console.log(`🛒 Totalt kvitton: ${grandCount}`);
console.log(`📊 Genomsnitt/månad: ${avgPerMonth.toFixed(2)} SEK`);
console.log(`📊 Genomsnitt/kvitto: ${avgPerReceipt.toFixed(2)} SEK`);

// Hitta högsta och lägsta månaden
let highest = { month: '', total: 0 };
let lowest = { month: '', total: Infinity };

last12Months.forEach(yearMonth => {
  const data = monthlyData[yearMonth];
  const total = data.willys.total + data.ica.total;

  if (total > highest.total) {
    highest = { month: yearMonth, total };
  }
  if (total < lowest.total) {
    lowest = { month: yearMonth, total };
  }
});

const [highYear, highMonth] = highest.month.split('-');
const [lowYear, lowMonth] = lowest.month.split('-');

console.log(`\n📈 Högsta månad: ${monthNames[highMonth]} ${highYear} (${highest.total.toFixed(2)} SEK)`);
console.log(`📉 Lägsta månad: ${monthNames[lowMonth]} ${lowYear} (${lowest.total.toFixed(2)} SEK)`);

console.log('\n═══════════════════════════════════════════════════════════════');
