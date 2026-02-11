const data = require('../output/willys-analysis.json');

// Monthly breakdown
const monthlyData = {};

for (const receipt of data.receipts) {
  if (!receipt.metadata.date) continue;

  const date = new Date(receipt.metadata.date);
  const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

  if (!monthlyData[monthKey]) {
    monthlyData[monthKey] = {
      receipts: 0,
      totalSpending: 0,
      items: 0
    };
  }

  // Calculate receipt total
  const receiptTotal = receipt.items.reduce((sum, item) => sum + (item.totalPrice || 0), 0);

  monthlyData[monthKey].receipts++;
  monthlyData[monthKey].totalSpending += receiptTotal;
  monthlyData[monthKey].items += receipt.items.length;
}

// Sort by month
const sortedMonths = Object.keys(monthlyData).sort();

// Swedish month names
const monthNames = {
  '01': 'Januari',
  '02': 'Februari',
  '03': 'Mars',
  '04': 'April',
  '05': 'Maj',
  '06': 'Juni',
  '07': 'Juli',
  '08': 'Augusti',
  '09': 'September',
  '10': 'Oktober',
  '11': 'November',
  '12': 'December'
};

console.log('╔════════════════════════════════════════════════════════════════╗');
console.log('║               📅 MÅNADSVISA UTGIFTER 📅                        ║');
console.log('╚════════════════════════════════════════════════════════════════╝\n');

// Calculate totals
let grandTotal = 0;
let totalReceipts = 0;
let totalItems = 0;

sortedMonths.forEach(monthKey => {
  const data = monthlyData[monthKey];
  grandTotal += data.totalSpending;
  totalReceipts += data.receipts;
  totalItems += data.items;
});

// Print each month
console.log('MÅNAD FÖR MÅNAD:\n');
sortedMonths.forEach((monthKey, idx) => {
  const [year, month] = monthKey.split('-');
  const monthName = monthNames[month];
  const data = monthlyData[monthKey];
  const avgPerReceipt = data.totalSpending / data.receipts;
  const avgPerItem = data.totalSpending / data.items;

  console.log(`${idx + 1}. ${monthName} ${year}`);
  console.log(`   💰 Totalt: ${data.totalSpending.toFixed(2)} SEK`);
  console.log(`   🛒 Antal kvitton: ${data.receipts} st`);
  console.log(`   📦 Antal artiklar: ${data.items} st`);
  console.log(`   📊 Snitt per kvitto: ${avgPerReceipt.toFixed(2)} SEK`);
  console.log(`   💵 Snitt per artikel: ${avgPerItem.toFixed(2)} SEK`);
  console.log('');
});

console.log('═══════════════════════════════════════════════════════════════\n');
console.log('📊 TOTALT:\n');
console.log(`   💰 Total kostnad: ${grandTotal.toFixed(2)} SEK`);
console.log(`   📅 Antal månader: ${sortedMonths.length}`);
console.log(`   🛒 Totalt kvitton: ${totalReceipts}`);
console.log(`   📦 Totalt artiklar: ${totalItems}`);
console.log(`   📈 Genomsnitt per månad: ${(grandTotal / sortedMonths.length).toFixed(2)} SEK`);
console.log(`   📊 Genomsnitt per kvitto: ${(grandTotal / totalReceipts).toFixed(2)} SEK\n`);

console.log('═══════════════════════════════════════════════════════════════\n');
console.log('💡 ANALYS:\n');

// Find highest and lowest months
const highest = sortedMonths.reduce((max, month) =>
  monthlyData[month].totalSpending > monthlyData[max].totalSpending ? month : max
);
const lowest = sortedMonths.reduce((min, month) =>
  monthlyData[month].totalSpending < monthlyData[min].totalSpending ? month : min
);

const [highYear, highMonth] = highest.split('-');
const [lowYear, lowMonth] = lowest.split('-');

console.log(`   🔝 Högsta månad: ${monthNames[highMonth]} ${highYear} (${monthlyData[highest].totalSpending.toFixed(2)} SEK)`);
console.log(`   📉 Lägsta månad: ${monthNames[lowMonth]} ${lowYear} (${monthlyData[lowest].totalSpending.toFixed(2)} SEK)`);
console.log(`   📊 Skillnad: ${(monthlyData[highest].totalSpending - monthlyData[lowest].totalSpending).toFixed(2)} SEK`);

// Calculate trend
const firstHalf = sortedMonths.slice(0, Math.floor(sortedMonths.length / 2));
const secondHalf = sortedMonths.slice(Math.floor(sortedMonths.length / 2));

const firstHalfAvg = firstHalf.reduce((sum, m) => sum + monthlyData[m].totalSpending, 0) / firstHalf.length;
const secondHalfAvg = secondHalf.reduce((sum, m) => sum + monthlyData[m].totalSpending, 0) / secondHalf.length;

const trend = secondHalfAvg > firstHalfAvg ? '📈 Ökande' : '📉 Minskande';
const trendPercent = ((secondHalfAvg - firstHalfAvg) / firstHalfAvg * 100).toFixed(1);

console.log(`   ${trend} trend: ${trendPercent}% (första halvan: ${firstHalfAvg.toFixed(2)} SEK, andra halvan: ${secondHalfAvg.toFixed(2)} SEK)`);

// Visual bar chart
console.log('\n═══════════════════════════════════════════════════════════════\n');
console.log('📊 VISUELL REPRESENTATION:\n');

const maxSpending = Math.max(...sortedMonths.map(m => monthlyData[m].totalSpending));
const barWidth = 50;

sortedMonths.forEach(monthKey => {
  const [year, month] = monthKey.split('-');
  const monthName = monthNames[month].substring(0, 3);
  const spending = monthlyData[monthKey].totalSpending;
  const barLength = Math.round((spending / maxSpending) * barWidth);
  const bar = '█'.repeat(barLength);

  console.log(`${monthName} ${year.substring(2)} ${bar} ${spending.toFixed(0)} SEK`);
});

console.log('');
