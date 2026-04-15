'use strict';

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// ---------------------------------------------------------------------------
// Data loading
// ---------------------------------------------------------------------------

const OUTPUT_DIR = path.join(__dirname, '..', 'output');

function loadJSON(filename) {
  const filePath = path.join(OUTPUT_DIR, filename);
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (err) {
    console.error(`Failed to load ${filename}:`, err.message);
    return null;
  }
}

// Willys: grandTotal is wrong (contains item count). Calculate from items.
function willysTotal(receipt) {
  if (!receipt.items || !Array.isArray(receipt.items)) return 0;
  return receipt.items
    .filter(item => item.totalPrice >= 0)
    .reduce((sum, item) => sum + (item.totalPrice || 0), 0);
}

// ICA: grandTotal is correct. Negative totalPrice = discounts/returns.
function icaTotal(receipt) {
  if (receipt.metadata && typeof receipt.metadata.grandTotal === 'number') {
    return receipt.metadata.grandTotal;
  }
  if (!receipt.items || !Array.isArray(receipt.items)) return 0;
  return receipt.items
    .filter(item => item.totalPrice >= 0)
    .reduce((sum, item) => sum + (item.totalPrice || 0), 0);
}

function parseMonth(dateStr) {
  if (!dateStr) return null;
  // ISO date string: "2025-05-02T07:36:31.000Z"
  return dateStr.substring(0, 7); // "2025-05"
}

function monthLabel(yyyyMM) {
  const [year, month] = yyyyMM.split('-');
  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'Maj', 'Jun',
    'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dec',
  ];
  return `${months[parseInt(month, 10) - 1]} ${year}`;
}

// Load data once at startup
const willysData = loadJSON('willys-analysis.json');
const icaData = loadJSON('ica-analysis.json');

if (!willysData || !icaData) {
  console.error('ERROR: Could not load required data files. Exiting.');
  process.exit(1);
}

// Enrich receipts with computed totals and normalised month
const willysReceipts = willysData.receipts
  .filter(r => r.metadata && r.metadata.date)
  .map(r => ({
    store: 'willys',
    date: r.metadata.date.substring(0, 10), // YYYY-MM-DD
    month: parseMonth(r.metadata.date),
    total: willysTotal(r),
    itemCount: r.items ? r.items.filter(i => i.totalPrice >= 0 && i.unitPrice > 0).length : 0,
    filename: r.filename,
    items: (r.items || []).filter(i => i.totalPrice >= 0 && i.unitPrice > 0),
  }));

const icaReceipts = icaData.receipts
  .filter(r => r.metadata && r.metadata.date)
  .map(r => ({
    store: 'ica',
    date: r.metadata.date.substring(0, 10),
    month: parseMonth(r.metadata.date),
    total: icaTotal(r),
    itemCount: r.items ? r.items.filter(i => i.totalPrice >= 0).length : 0,
    filename: r.filename,
    items: (r.items || []).filter(i => i.totalPrice >= 0),
  }));

const allReceipts = [...willysReceipts, ...icaReceipts];

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ---------------------------------------------------------------------------
// GET /api/summary
// ---------------------------------------------------------------------------

app.get('/api/summary', (req, res) => {
  try {
    const willysTotalAmt = willysReceipts.reduce((s, r) => s + r.total, 0);
    const icaTotalAmt = icaReceipts.reduce((s, r) => s + r.total, 0);
    const combinedTotal = willysTotalAmt + icaTotalAmt;
    const combinedCount = willysReceipts.length + icaReceipts.length;

    // Find unique months across all receipts
    const months = new Set(allReceipts.map(r => r.month).filter(Boolean));
    const monthCount = months.size;

    res.json({
      willys: {
        total: Math.round(willysTotalAmt),
        count: willysReceipts.length,
        avgPerReceipt: willysReceipts.length
          ? Math.round(willysTotalAmt / willysReceipts.length)
          : 0,
      },
      ica: {
        total: Math.round(icaTotalAmt),
        count: icaReceipts.length,
        avgPerReceipt: icaReceipts.length
          ? Math.round(icaTotalAmt / icaReceipts.length)
          : 0,
      },
      combined: {
        total: Math.round(combinedTotal),
        count: combinedCount,
        avgPerMonth: monthCount ? Math.round(combinedTotal / monthCount) : 0,
        monthCount,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// GET /api/monthly
// ---------------------------------------------------------------------------

app.get('/api/monthly', (req, res) => {
  try {
    const map = new Map();

    for (const r of willysReceipts) {
      if (!r.month) continue;
      if (!map.has(r.month)) {
        map.set(r.month, { month: r.month, willys: 0, ica: 0, total: 0, willysCount: 0, icaCount: 0 });
      }
      const entry = map.get(r.month);
      entry.willys += r.total;
      entry.willysCount += 1;
    }

    for (const r of icaReceipts) {
      if (!r.month) continue;
      if (!map.has(r.month)) {
        map.set(r.month, { month: r.month, willys: 0, ica: 0, total: 0, willysCount: 0, icaCount: 0 });
      }
      const entry = map.get(r.month);
      entry.ica += r.total;
      entry.icaCount += 1;
    }

    const result = Array.from(map.values())
      .map(entry => ({
        month: entry.month,
        label: monthLabel(entry.month),
        willys: Math.round(entry.willys),
        ica: Math.round(entry.ica),
        total: Math.round(entry.willys + entry.ica),
        willysCount: entry.willysCount,
        icaCount: entry.icaCount,
      }))
      .sort((a, b) => a.month.localeCompare(b.month));

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// GET /api/receipts?month=2025-02
// ---------------------------------------------------------------------------

app.get('/api/receipts', (req, res) => {
  try {
    const { month } = req.query;

    let filtered = allReceipts;

    if (month) {
      // Validate format YYYY-MM
      if (!/^\d{4}-\d{2}$/.test(month)) {
        return res.status(400).json({ error: 'Invalid month format. Use YYYY-MM.' });
      }
      filtered = allReceipts.filter(r => r.month === month);
    }

    const result = filtered
      .map(r => ({
        store: r.store,
        date: r.date,
        total: Math.round(r.total * 100) / 100,
        itemCount: r.itemCount,
        filename: r.filename,
      }))
      .sort((a, b) => b.date.localeCompare(a.date));

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// GET /api/top-products?month=2025-02&limit=10
// ---------------------------------------------------------------------------

app.get('/api/top-products', (req, res) => {
  try {
    const { month, limit } = req.query;
    const topN = limit ? parseInt(limit, 10) : 10;

    if (isNaN(topN) || topN < 1) {
      return res.status(400).json({ error: 'Invalid limit value.' });
    }

    if (month && !/^\d{4}-\d{2}$/.test(month)) {
      return res.status(400).json({ error: 'Invalid month format. Use YYYY-MM.' });
    }

    let sourceReceipts = allReceipts;
    if (month) {
      sourceReceipts = allReceipts.filter(r => r.month === month);
    }

    // Aggregate by lowercase product name
    const productMap = new Map();

    for (const receipt of sourceReceipts) {
      for (const item of receipt.items) {
        if (!item.name || item.totalPrice < 0) continue;
        const key = item.name.trim().toLowerCase();
        if (!productMap.has(key)) {
          productMap.set(key, {
            name: item.name.trim(), // preserve original casing from first encounter
            totalSpent: 0,
            count: 0,
          });
        }
        const entry = productMap.get(key);
        entry.totalSpent += item.totalPrice || 0;
        entry.count += item.quantity || 1;
      }
    }

    const result = Array.from(productMap.values())
      .sort((a, b) => b.totalSpent - a.totalSpent)
      .slice(0, topN)
      .map(p => ({
        name: p.name,
        totalSpent: Math.round(p.totalSpent * 100) / 100,
        count: p.count,
        avgPrice: p.count > 0 ? Math.round((p.totalSpent / p.count) * 100) / 100 : 0,
      }));

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// GET /api/search?q=mjölk&limit=20
// ---------------------------------------------------------------------------

app.get('/api/search', (req, res) => {
  try {
    const { q, limit } = req.query;

    if (!q || q.length < 2) {
      return res.json([]);
    }

    const topN = Math.min(limit ? parseInt(limit, 10) : 20, 100);
    if (isNaN(topN) || topN < 1) {
      return res.status(400).json({ error: 'Invalid limit value.' });
    }

    const qLower = q.toLowerCase();
    const productMap = new Map();

    for (const receipt of allReceipts) {
      for (const item of receipt.items) {
        if (!item.name || !item.name.toLowerCase().includes(qLower)) continue;
        const key = item.name.trim().toLowerCase();
        if (!productMap.has(key)) {
          productMap.set(key, {
            name: item.name.trim(),
            totalSpent: 0,
            count: 0,
            lastSeen: null,
            stores: new Set(),
          });
        }
        const entry = productMap.get(key);
        entry.totalSpent += item.totalPrice || 0;
        entry.count += item.quantity || 1;
        entry.stores.add(receipt.store);
        if (!entry.lastSeen || receipt.date > entry.lastSeen) {
          entry.lastSeen = receipt.date;
        }
      }
    }

    const result = Array.from(productMap.values())
      .sort((a, b) => b.totalSpent - a.totalSpent)
      .slice(0, topN)
      .map(p => ({
        name: p.name,
        totalSpent: Math.round(p.totalSpent * 100) / 100,
        count: p.count,
        avgPrice: p.count > 0 ? Math.round((p.totalSpent / p.count) * 100) / 100 : 0,
        lastSeen: p.lastSeen,
        stores: Array.from(p.stores),
      }));

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// GET /api/product-history?name=Coca Cola Zero
// ---------------------------------------------------------------------------

app.get('/api/product-history', (req, res) => {
  try {
    const { name } = req.query;

    if (!name) {
      return res.status(400).json({ error: 'Query parameter "name" is required.' });
    }

    const nameLower = name.trim().toLowerCase();
    const history = [];

    for (const receipt of allReceipts) {
      for (const item of receipt.items) {
        if (!item.name || item.name.trim().toLowerCase() !== nameLower) continue;
        history.push({
          date: receipt.date,
          store: receipt.store,
          unitPrice: item.unitPrice,
          quantity: item.quantity,
          totalPrice: item.totalPrice,
          receiptFilename: receipt.filename,
        });
      }
    }

    history.sort((a, b) => a.date.localeCompare(b.date));

    res.json(history);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// GET /api/categories?month=2025-02
// ---------------------------------------------------------------------------

app.get('/api/categories', (req, res) => {
  try {
    const { month } = req.query;

    if (month && !/^\d{4}-\d{2}$/.test(month)) {
      return res.status(400).json({ error: 'Invalid month format. Use YYYY-MM.' });
    }

    let sourceReceipts = allReceipts;
    if (month) {
      sourceReceipts = allReceipts.filter(r => r.month === month);
    }

    const categoryMap = new Map();
    let grandTotal = 0;

    for (const receipt of sourceReceipts) {
      for (const item of receipt.items) {
        if (item.totalPrice < 0) continue;
        const cat = (item.category && item.category.trim() && item.category.trim().toLowerCase() !== 'uncategorized')
          ? item.category.trim()
          : 'Övrigt';
        if (!categoryMap.has(cat)) {
          categoryMap.set(cat, { category: cat, totalSpent: 0, itemCount: 0 });
        }
        const entry = categoryMap.get(cat);
        entry.totalSpent += item.totalPrice || 0;
        entry.itemCount += 1;
        grandTotal += item.totalPrice || 0;
      }
    }

    const result = Array.from(categoryMap.values())
      .sort((a, b) => b.totalSpent - a.totalSpent)
      .map(c => ({
        category: c.category,
        totalSpent: Math.round(c.totalSpent * 100) / 100,
        itemCount: c.itemCount,
        percentage: grandTotal > 0 ? Math.round((c.totalSpent / grandTotal) * 1000) / 10 : 0,
      }));

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// GET /api/receipt?store=willys&filename=kvitto_152.pdf
// ---------------------------------------------------------------------------

app.get('/api/receipt', (req, res) => {
  try {
    const { store, filename } = req.query;

    if (!store || !filename) {
      return res.status(400).json({ error: 'Både store och filename krävs.' });
    }

    if (store !== 'willys' && store !== 'ica') {
      return res.status(400).json({ error: 'store måste vara willys eller ica.' });
    }

    const receipts = store === 'willys' ? willysReceipts : icaReceipts;
    const receipt  = receipts.find(r => r.filename === filename);

    if (!receipt) {
      return res.status(404).json({ error: 'Kvitto hittades inte.' });
    }

    res.json({
      store:     receipt.store,
      date:      receipt.date,
      total:     receipt.total,
      itemCount: receipt.itemCount,
      filename:  receipt.filename,
      items:     receipt.items.filter(i => i.totalPrice > 0).map(item => ({
        name:       item.name,
        quantity:   item.quantity,
        unitPrice:  item.unitPrice,
        totalPrice: item.totalPrice,
        category:   item.category || null,
      })),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// GET /api/price-changes?limit=20
// ---------------------------------------------------------------------------

app.get('/api/price-changes', (req, res) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit, 10) : 20;
    if (isNaN(limit) || limit < 1) {
      return res.status(400).json({ error: 'Invalid limit value.' });
    }

    // Build price map: name (lowercase) → [{date, price, store, displayName}]
    const productPrices = new Map();

    for (const receipt of allReceipts) {
      for (const item of receipt.items) {
        if (!item.unitPrice || item.unitPrice === 0) continue;
        if (/pant|plastkasse|påse|rabatt|kampanj/i.test(item.name)) continue;
        const name = item.name.trim().toLowerCase();
        if (!productPrices.has(name)) {
          productPrices.set(name, { displayName: item.name.trim(), entries: [] });
        }
        productPrices.get(name).entries.push({
          date: receipt.date,
          price: item.unitPrice,
          store: receipt.store,
        });
      }
    }

    const results = [];

    for (const [name, data] of productPrices) {
      const entries = data.entries.sort((a, b) => a.date.localeCompare(b.date));
      if (entries.length < 3) continue;

      const firstDate = entries[0].date;
      const lastDate  = entries[entries.length - 1].date;

      // Require at least 60 days span
      const daySpan = (new Date(lastDate) - new Date(firstDate)) / (1000 * 60 * 60 * 24);
      if (daySpan < 60) continue;

      // Compare average of first 20% vs last 20%
      const slice = Math.max(1, Math.ceil(entries.length * 0.2));
      const firstSlice = entries.slice(0, slice);
      const lastSlice  = entries.slice(entries.length - slice);

      const firstPrice = firstSlice.reduce((s, e) => s + e.price, 0) / firstSlice.length;
      const lastPrice  = lastSlice.reduce((s, e) => s + e.price, 0) / lastSlice.length;

      if (firstPrice === 0) continue;
      const percentChange = ((lastPrice - firstPrice) / firstPrice) * 100;

      results.push({
        name,
        displayName: data.displayName,
        firstPrice: Math.round(firstPrice * 100) / 100,
        lastPrice:  Math.round(lastPrice * 100) / 100,
        percentChange: Math.round(percentChange * 10) / 10,
        purchases: entries.length,
        firstDate,
        lastDate,
      });
    }

    results.sort((a, b) => Math.abs(b.percentChange) - Math.abs(a.percentChange));

    res.json(results.slice(0, limit));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// GET /api/compare?monthA=2025-03&monthB=2025-04
// ---------------------------------------------------------------------------

app.get('/api/compare', (req, res) => {
  try {
    const { monthA, monthB } = req.query;

    if (!monthA || !monthB) {
      return res.status(400).json({ error: 'Both monthA and monthB are required.' });
    }
    if (!/^\d{4}-\d{2}$/.test(monthA) || !/^\d{4}-\d{2}$/.test(monthB)) {
      return res.status(400).json({ error: 'Invalid month format. Use YYYY-MM.' });
    }

    function buildMonthData(month) {
      const receipts = allReceipts.filter(r => r.month === month);

      const willysAmt = receipts.filter(r => r.store === 'willys').reduce((s, r) => s + r.total, 0);
      const icaAmt    = receipts.filter(r => r.store === 'ica').reduce((s, r) => s + r.total, 0);
      const total     = willysAmt + icaAmt;

      // Categories (max 6)
      const categoryMap = new Map();
      let grandTotal = 0;
      for (const receipt of receipts) {
        for (const item of receipt.items) {
          if (item.totalPrice < 0) continue;
          const cat = (item.category && item.category.trim() && item.category.trim().toLowerCase() !== 'uncategorized')
            ? item.category.trim()
            : 'Övrigt';
          if (!categoryMap.has(cat)) {
            categoryMap.set(cat, { category: cat, totalSpent: 0, itemCount: 0 });
          }
          const entry = categoryMap.get(cat);
          entry.totalSpent += item.totalPrice || 0;
          entry.itemCount  += 1;
          grandTotal       += item.totalPrice || 0;
        }
      }
      const categories = Array.from(categoryMap.values())
        .sort((a, b) => b.totalSpent - a.totalSpent)
        .slice(0, 6)
        .map(c => ({
          category:   c.category,
          totalSpent: Math.round(c.totalSpent * 100) / 100,
          itemCount:  c.itemCount,
          percentage: grandTotal > 0 ? Math.round((c.totalSpent / grandTotal) * 1000) / 10 : 0,
        }));

      // Top products (max 5)
      const productMap = new Map();
      for (const receipt of receipts) {
        for (const item of receipt.items) {
          if (!item.name || item.totalPrice < 0) continue;
          const key = item.name.trim().toLowerCase();
          if (!productMap.has(key)) {
            productMap.set(key, { name: item.name.trim(), totalSpent: 0, count: 0 });
          }
          const entry = productMap.get(key);
          entry.totalSpent += item.totalPrice || 0;
          entry.count      += item.quantity || 1;
        }
      }
      const topProducts = Array.from(productMap.values())
        .sort((a, b) => b.totalSpent - a.totalSpent)
        .slice(0, 5)
        .map(p => ({
          name:       p.name,
          totalSpent: Math.round(p.totalSpent * 100) / 100,
          count:      p.count,
        }));

      return {
        month,
        label:        monthLabel(month),
        total:        Math.round(total),
        willys:       Math.round(willysAmt),
        ica:          Math.round(icaAmt),
        receiptCount: receipts.length,
        categories,
        topProducts,
      };
    }

    const dataA = buildMonthData(monthA);
    const dataB = buildMonthData(monthB);

    const diffTotal   = dataB.total - dataA.total;
    const diffWillys  = dataB.willys - dataA.willys;
    const diffIca     = dataB.ica - dataA.ica;
    const pctChange   = dataA.total > 0 ? Math.round((diffTotal / dataA.total) * 1000) / 10 : 0;

    res.json({
      monthA: dataA,
      monthB: dataB,
      diff: {
        total:         diffTotal,
        percentChange: pctChange,
        willys:        diffWillys,
        ica:           diffIca,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// 404 fallback for unknown API routes
// ---------------------------------------------------------------------------

app.use('/api', (req, res) => {
  res.status(404).json({ error: `Unknown endpoint: ${req.path}` });
});

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

app.listen(PORT, () => {
  console.log(`Kvittokollen API running at http://localhost:${PORT}`);
  console.log(`  Willys receipts loaded: ${willysReceipts.length}`);
  console.log(`  ICA receipts loaded:    ${icaReceipts.length}`);
});
