const fs = require('fs');
const path = require('path');

/**
 * Tar bort dubblett-PDF:er baserat på datum + filstorlek
 * Behåller första filen, tar bort efterföljande dubbletter
 */

const RECEIPTS_DIR = path.join(__dirname, '../receipts/willys');

console.log('═══════════════════════════════════════════════════════════════');
console.log('🧹 TA BORT DUBBLETT-PDF:ER');
console.log('═══════════════════════════════════════════════════════════════\n');

// Läs alla PDF-filer
const pdfFiles = fs.readdirSync(RECEIPTS_DIR).filter(f => f.endsWith('.pdf'));
console.log(`📂 Hittade ${pdfFiles.length} PDF-filer totalt\n`);

// Gruppera efter datum + filstorlek
const filesByDateAndSize = new Map();
const duplicates = [];

pdfFiles.forEach(file => {
  const filePath = path.join(RECEIPTS_DIR, file);
  const stats = fs.statSync(filePath);

  // Extrahera datum från filnamn
  const dateMatch = file.match(/kvitto_(\d{4}-\d{2}-\d{2})_/);
  if (!dateMatch) return;

  const date = dateMatch[1];
  const size = stats.size;
  const key = `${date}|${size}`;

  if (!filesByDateAndSize.has(key)) {
    // Första filen med detta datum + storlek
    filesByDateAndSize.set(key, {
      original: file,
      duplicates: []
    });
  } else {
    // Dubblett!
    filesByDateAndSize.get(key).duplicates.push(file);
    duplicates.push({
      original: filesByDateAndSize.get(key).original,
      duplicate: file,
      date,
      size
    });
  }
});

if (duplicates.length === 0) {
  console.log('✅ Inga dubblett-PDF:er hittades!\n');
  console.log('═══════════════════════════════════════════════════════════════');
  process.exit(0);
}

console.log(`❌ Hittade ${duplicates.length} dubblett-PDF:er:\n`);

// Gruppera per datum för bättre visning
const byDate = {};
duplicates.forEach(d => {
  if (!byDate[d.date]) byDate[d.date] = [];
  byDate[d.date].push(d);
});

Object.keys(byDate).sort().forEach(date => {
  console.log(`📅 ${date}:`);
  byDate[date].forEach(d => {
    console.log(`   ✅ Behåller: ${d.original} (${d.size} bytes)`);
    console.log(`   ❌ Tar bort: ${d.duplicate}`);
  });
  console.log('');
});

console.log('═══════════════════════════════════════════════════════════════');
console.log(`⚠️  Kommer att ta bort ${duplicates.length} filer`);
console.log('═══════════════════════════════════════════════════════════════\n');

// Ta bort dubbletterna
let removedCount = 0;
duplicates.forEach(d => {
  const filePath = path.join(RECEIPTS_DIR, d.duplicate);
  try {
    fs.unlinkSync(filePath);
    removedCount++;
  } catch (error) {
    console.log(`❌ Kunde inte ta bort ${d.duplicate}: ${error.message}`);
  }
});

console.log('\n═══════════════════════════════════════════════════════════════');
console.log('✅ KLART!');
console.log('═══════════════════════════════════════════════════════════════');
console.log(`🗑️  Tog bort: ${removedCount} dubblett-PDF:er`);
console.log(`✅ Behöll: ${filesByDateAndSize.size} unika kvitton`);
console.log(`📊 Totalt nu: ${pdfFiles.length - removedCount} PDF-filer`);
console.log('═══════════════════════════════════════════════════════════════');
