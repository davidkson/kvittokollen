#!/usr/bin/env node

/**
 * Re-apply the shared categorizer (lib/categorizer.cjs) to existing analysis
 * data, without re-reading any PDFs. Run after changing category rules.
 *
 *   node scripts/recategorize.cjs            # writes changes (backup first)
 *   node scripts/recategorize.cjs --dry-run  # only show what would change
 *
 * A backup is written next to each file as <name>.json.backup (gitignored).
 */

const fs = require('fs');
const path = require('path');
const { categorizeReceiptItem } = require('../lib/categorizer.cjs');
const { outputDir } = require('../lib/data.cjs');

const dryRun = process.argv.includes('--dry-run');

function recategorizeFile(store) {
  const file = path.join(outputDir(), `${store}-analysis.json`);
  if (!fs.existsSync(file)) {
    console.log(`⚠️  ${file} saknas, hoppar över ${store}`);
    return;
  }

  const raw = fs.readFileSync(file, 'utf8');
  const data = JSON.parse(raw);

  const before = {};
  const after = {};
  const moves = {};
  let changed = 0;

  for (const receipt of data.receipts || []) {
    for (const item of receipt.items || []) {
      const oldCat = item.category || 'Uncategorized';
      const newCat = categorizeReceiptItem(item);
      const amount = item.totalPrice || 0;

      before[oldCat] = (before[oldCat] || 0) + amount;
      after[newCat] = (after[newCat] || 0) + amount;

      if (oldCat !== newCat) {
        changed++;
        const key = `${oldCat} → ${newCat}`;
        moves[key] = moves[key] || { count: 0, examples: new Set() };
        moves[key].count++;
        if (moves[key].examples.size < 4) moves[key].examples.add(item.name);
        item.category = newCat;
      }
    }
  }

  console.log(`\n=== ${store.toUpperCase()} — ${changed} varor bytte kategori ===`);
  Object.entries(moves)
    .sort((a, b) => b[1].count - a[1].count)
    .forEach(([key, m]) => {
      console.log(`  ${String(m.count).padStart(4)}  ${key}   (t.ex. ${[...m.examples].join(', ')})`);
    });

  console.log('\n  Kategori                    Före (SEK)   Efter (SEK)');
  const cats = new Set([...Object.keys(before), ...Object.keys(after)]);
  [...cats]
    .sort((a, b) => (after[b] || 0) - (after[a] || 0))
    .forEach(cat => {
      const b = (before[cat] || 0).toFixed(0).padStart(10);
      const a = (after[cat] || 0).toFixed(0).padStart(12);
      console.log(`  ${cat.padEnd(26)}${b}${a}`);
    });

  if (dryRun) {
    console.log('\n  (--dry-run: inget sparat)');
    return;
  }

  fs.writeFileSync(`${file}.backup`, raw, 'utf8');
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
  console.log(`\n  ✓ Sparat ${file} (backup: ${path.basename(file)}.backup)`);
}

recategorizeFile('willys');
recategorizeFile('ica');
