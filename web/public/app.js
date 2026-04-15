/* ============================================================
   Kvittokollen – app.js
   Vanilla JS, Chart.js via CDN
   ============================================================ */

const API = '';  // same-origin; backend on port 3000

let productChart = null;

/* ============================================================
   Utilities
   ============================================================ */

/** Format number as Swedish currency: "10 234 kr" */
function formatAmount(n) {
  if (n == null || isNaN(n)) return '–';
  return Math.round(n).toLocaleString('sv-SE') + ' kr';
}

/** Format a date string "2025-02-15" → "15 feb 2025" */
function formatDate(str) {
  if (!str) return '–';
  const d = new Date(str + 'T12:00:00');
  return d.toLocaleDateString('sv-SE', { day: 'numeric', month: 'short', year: 'numeric' });
}

/** Swedish month labels for axis ticks */
function monthLabel(iso) {
  // iso: "2025-02"
  const [year, mon] = iso.split('-');
  const d = new Date(`${iso}-01T12:00:00`);
  const m = d.toLocaleDateString('sv-SE', { month: 'short' });
  const shortYear = year.slice(2);
  return `${m} ${shortYear}`;
}

function show(el) { el.classList.remove('hidden'); }
function hide(el) { el.classList.add('hidden'); }
function toggle(el, visible) { visible ? show(el) : hide(el); }

/* ============================================================
   State
   ============================================================ */
let state = {
  selectedMonth: 'all',   // 'all' or 'YYYY-MM'
  summary: null,
  monthly: null,
  chart: null,
};

/* ============================================================
   API calls
   ============================================================ */
async function apiFetch(path) {
  const res = await fetch(API + path);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

/* ============================================================
   Render: Summary cards
   ============================================================ */
function renderSummaryAll(summary) {
  const { willys, ica, combined } = summary;

  document.getElementById('summary-heading').textContent = 'Alla månader';

  document.getElementById('stat-total').textContent    = formatAmount(combined.total);
  document.getElementById('stat-period').textContent   = `Totalt ${combined.monthCount} månader`;

  document.getElementById('stat-avg-month').textContent = formatAmount(combined.avgPerMonth);
  document.getElementById('stat-months').textContent    = `${combined.monthCount} månader`;

  document.getElementById('stat-count').textContent      = combined.count + ' st';
  document.getElementById('stat-avg-receipt').textContent = `Snitt ${formatAmount((willys.avgPerReceipt + ica.avgPerReceipt) / 2)} / kvitto`;

  document.getElementById('stat-willys').textContent       = formatAmount(willys.total);
  document.getElementById('stat-willys-count').textContent = `${willys.count} kvitton`;

  document.getElementById('stat-ica').textContent       = formatAmount(ica.total);
  document.getElementById('stat-ica-count').textContent = `${ica.count} kvitton`;
}

function renderSummaryMonth(monthData) {
  const total = monthData.total;
  const willysTotal = monthData.willys;
  const icaTotal    = monthData.ica;
  const wCount      = monthData.willysCount;
  const iCount      = monthData.icaCount;
  const count       = wCount + iCount;
  const avgReceipt  = count > 0 ? total / count : 0;

  document.getElementById('summary-heading').textContent = monthData.label;

  document.getElementById('stat-total').textContent    = formatAmount(total);
  document.getElementById('stat-period').textContent   = monthData.label;

  document.getElementById('stat-avg-month').textContent = formatAmount(avgReceipt);
  document.getElementById('stat-months').textContent    = 'Snitt per kvitto';

  document.getElementById('stat-count').textContent      = count + ' st';
  document.getElementById('stat-avg-receipt').textContent = `${wCount} Willys · ${iCount} ICA`;

  document.getElementById('stat-willys').textContent       = formatAmount(willysTotal);
  document.getElementById('stat-willys-count').textContent = `${wCount} kvitton`;

  document.getElementById('stat-ica').textContent       = formatAmount(icaTotal);
  document.getElementById('stat-ica-count').textContent = `${iCount} kvitton`;
}

/* ============================================================
   Render: Sidebar month list
   ============================================================ */
function renderMonthList(monthly) {
  const list = document.getElementById('month-list');
  list.innerHTML = '';

  // newest first
  const sorted = [...monthly].reverse();

  // update "Alla månader" sub-total
  const allTotal = monthly.reduce((s, m) => s + m.total, 0);
  document.getElementById('all-total').textContent = formatAmount(allTotal);

  sorted.forEach(m => {
    const btn = document.createElement('button');
    btn.className = 'month-btn';
    btn.dataset.month = m.month;
    btn.innerHTML = `
      <span class="month-label">${m.label}</span>
      <span class="month-total">${formatAmount(m.total)}</span>
    `;
    btn.addEventListener('click', () => selectMonth(m.month));
    list.appendChild(btn);
  });
}

/* ============================================================
   Render: Chart
   ============================================================ */
function renderChart(monthly) {
  const loading = document.getElementById('chart-loading');
  hide(loading);

  const labels = monthly.map(m => monthLabel(m.month));
  const willysData = monthly.map(m => m.willys);
  const icaData    = monthly.map(m => m.ica);

  const ctx = document.getElementById('monthly-chart').getContext('2d');

  if (state.chart) {
    state.chart.destroy();
  }

  state.chart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Willys',
          data: willysData,
          backgroundColor: 'rgba(76, 175, 80, 0.75)',
          hoverBackgroundColor: 'rgba(76, 175, 80, 1)',
          borderRadius: 4,
          borderSkipped: false,
        },
        {
          label: 'ICA',
          data: icaData,
          backgroundColor: 'rgba(244, 67, 54, 0.75)',
          hoverBackgroundColor: 'rgba(244, 67, 54, 1)',
          borderRadius: 4,
          borderSkipped: false,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false,
      },
      onClick: (event, elements) => {
        if (elements.length > 0) {
          const idx = elements[0].index;
          const month = monthly[idx].month;
          selectMonth(month);
        }
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#16213e',
          borderColor: 'rgba(255,255,255,0.1)',
          borderWidth: 1,
          titleColor: '#e8eaf6',
          bodyColor: '#8892b0',
          padding: 12,
          callbacks: {
            label: ctx => {
              const label = ctx.dataset.label;
              const val   = formatAmount(ctx.parsed.y);
              return `  ${label}: ${val}`;
            },
            footer: items => {
              const total = items.reduce((s, i) => s + i.parsed.y, 0);
              return `  Totalt: ${formatAmount(total)}`;
            },
          },
        },
      },
      scales: {
        x: {
          stacked: false,
          grid: { color: 'rgba(255,255,255,0.04)' },
          ticks: { color: '#8892b0', font: { size: 11 } },
          border: { color: 'rgba(255,255,255,0.07)' },
        },
        y: {
          stacked: false,
          grid: { color: 'rgba(255,255,255,0.04)' },
          ticks: {
            color: '#8892b0',
            font: { size: 11 },
            callback: v => Math.round(v).toLocaleString('sv-SE') + ' kr',
          },
          border: { color: 'rgba(255,255,255,0.07)' },
        },
      },
    },
  });
}

/* ============================================================
   Render: Receipts table
   ============================================================ */
function renderReceipts(receipts) {
  const container = document.getElementById('receipts-container');
  const body      = document.getElementById('receipts-body');
  const badge     = document.getElementById('receipts-count-badge');

  badge.textContent = receipts.length + ' kvitton';
  body.innerHTML = '';

  if (receipts.length === 0) {
    body.innerHTML = `<tr><td colspan="4" style="text-align:center;padding:24px;color:var(--text-dim)">Inga kvitton hittades.</td></tr>`;
    show(container);
    return;
  }

  // Sort by date descending
  const sorted = [...receipts].sort((a, b) => b.date.localeCompare(a.date));

  sorted.forEach(r => {
    const tr = document.createElement('tr');
    const storeCls   = r.store === 'willys' ? 'willys' : 'ica';
    const storeLabel = r.store === 'willys' ? 'Willys' : 'ICA';

    tr.innerHTML = `
      <td>${formatDate(r.date)}</td>
      <td><span class="store-badge ${storeCls}">${storeLabel}</span></td>
      <td class="align-right amount-cell">${formatAmount(r.total)}</td>
      <td class="align-right item-count">${r.itemCount} st</td>
    `;
    tr.addEventListener('click', () => openReceiptModal(r.store, r.filename));
    body.appendChild(tr);
  });

  show(container);
  container.classList.add('fade-in');
}

/* ============================================================
   Render: Top products
   ============================================================ */
function renderProducts(products, containerId, listId) {
  const container = document.getElementById(containerId);
  const list      = document.getElementById(listId);
  list.innerHTML  = '';

  if (!products || products.length === 0) {
    list.innerHTML = `<div style="padding:20px;color:var(--text-dim);text-align:center">Inga produkter hittades.</div>`;
    show(container);
    return;
  }

  const maxSpent = products[0].totalSpent;

  products.forEach((p, i) => {
    const rank = i + 1;
    const rankCls = rank <= 3 ? `rank-${rank}` : '';
    const barPct = maxSpent > 0 ? (p.totalSpent / maxSpent) * 100 : 0;
    const avgStr = p.avgPrice != null ? `Snitt ${formatAmount(p.avgPrice)}` : '';
    const countStr = p.count != null ? `${p.count} st` : '';
    const meta = [countStr, avgStr].filter(Boolean).join(' · ');

    const div = document.createElement('div');
    div.className = 'product-item fade-in';
    div.innerHTML = `
      <div class="product-rank ${rankCls}">${rank}</div>
      <div class="product-info">
        <div class="product-name" title="${escHtml(p.name)}">${escHtml(p.name)}</div>
        <div class="product-meta">${meta}</div>
      </div>
      <div class="product-right">
        <div class="product-total">${formatAmount(p.totalSpent)}</div>
      </div>
      <div class="product-bar-wrap">
        <div class="product-bar" style="width:${barPct.toFixed(1)}%"></div>
      </div>
    `;
    list.appendChild(div);
  });

  show(container);
}

/* ============================================================
   Render: Categories
   ============================================================ */
function renderCategories(categories, month) {
  const container = document.getElementById('categories-container');
  const list      = document.getElementById('categories-list');
  const heading   = document.getElementById('categories-heading');

  list.innerHTML = '';

  if (month === 'all') {
    heading.textContent = 'Kategorier – alla månader';
  } else {
    const md = state.monthly ? state.monthly.find(m => m.month === month) : null;
    heading.textContent = md ? `Kategorier – ${md.label}` : `Kategorier – ${month}`;
  }

  if (!categories || categories.length === 0) {
    list.innerHTML = `<div style="padding:20px;color:var(--text-dim);text-align:center">Inga kategorier hittades.</div>`;
    show(container);
    return;
  }

  const top = categories.slice(0, 10);
  const maxSpent = top[0].totalSpent;

  top.forEach(cat => {
    const barPct = maxSpent > 0 ? (cat.totalSpent / maxSpent) * 100 : 0;
    const pct    = cat.percentage != null ? cat.percentage.toFixed(1) + '%' : '';

    const div = document.createElement('div');
    div.className = 'category-item fade-in';
    div.innerHTML = `
      <span class="category-name">${escHtml(cat.category)}</span>
      <span class="category-pct">${escHtml(pct)}</span>
      <span class="category-amount">${formatAmount(cat.totalSpent)}</span>
      <div class="category-bar-wrap">
        <div class="category-bar" style="width:${barPct.toFixed(1)}%"></div>
      </div>
    `;
    list.appendChild(div);
  });

  show(container);
}

/* ============================================================
   Product history modal
   ============================================================ */
async function openProductModal(productName) {
  const modal    = document.getElementById('product-modal');
  const nameEl   = document.getElementById('product-modal-name');
  const body     = document.getElementById('product-history-body');
  const canvas   = document.getElementById('product-history-chart');

  nameEl.textContent = productName;
  body.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:24px;color:var(--text-dim)">Laddar...</td></tr>`;

  // Destroy previous chart
  if (productChart) {
    productChart.destroy();
    productChart = null;
  }

  modal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';

  try {
    const history = await apiFetch(`/api/product-history?name=${encodeURIComponent(productName)}`);

    // Build chart datasets per store
    const willysPoints = [];
    const icaPoints    = [];

    history.forEach(row => {
      const point = { x: row.date, y: row.unitPrice };
      if (row.store === 'willys') {
        willysPoints.push(point);
      } else {
        icaPoints.push(point);
      }
    });

    const ctx = canvas.getContext('2d');
    productChart = new Chart(ctx, {
      type: 'line',
      data: {
        datasets: [
          {
            label: 'Willys',
            data: willysPoints,
            borderColor: 'rgba(76, 175, 80, 1)',
            backgroundColor: 'rgba(76, 175, 80, 0.12)',
            pointBackgroundColor: 'rgba(76, 175, 80, 1)',
            tension: 0.3,
            pointRadius: 4,
            pointHoverRadius: 6,
          },
          {
            label: 'ICA',
            data: icaPoints,
            borderColor: 'rgba(244, 67, 54, 1)',
            backgroundColor: 'rgba(244, 67, 54, 0.12)',
            pointBackgroundColor: 'rgba(244, 67, 54, 1)',
            tension: 0.3,
            pointRadius: 4,
            pointHoverRadius: 6,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'nearest',
          intersect: false,
        },
        plugins: {
          legend: {
            display: true,
            labels: { color: '#8892b0', font: { size: 11 } },
          },
          tooltip: {
            backgroundColor: '#16213e',
            borderColor: 'rgba(255,255,255,0.1)',
            borderWidth: 1,
            titleColor: '#e8eaf6',
            bodyColor: '#8892b0',
            padding: 12,
            callbacks: {
              title: items => {
                const raw = items[0].raw;
                return formatDate(raw.x);
              },
              label: ctx => {
                return `  ${ctx.dataset.label}: ${formatAmount(ctx.parsed.y)}`;
              },
            },
          },
        },
        scales: {
          x: {
            type: 'category',
            grid: { color: 'rgba(255,255,255,0.04)' },
            ticks: {
              color: '#8892b0',
              font: { size: 10 },
              maxTicksLimit: 10,
              callback: function(val, idx) {
                const raw = this.getLabelForValue(val);
                return formatDate(raw);
              },
            },
            border: { color: 'rgba(255,255,255,0.07)' },
          },
          y: {
            grid: { color: 'rgba(255,255,255,0.04)' },
            ticks: {
              color: '#8892b0',
              font: { size: 11 },
              callback: v => Math.round(v).toLocaleString('sv-SE') + ' kr',
            },
            border: { color: 'rgba(255,255,255,0.07)' },
          },
        },
      },
    });

    // Render table
    body.innerHTML = '';
    history.forEach(row => {
      const storeCls   = row.store === 'willys' ? 'willys' : 'ica';
      const storeLabel = row.store === 'willys' ? 'Willys' : 'ICA';
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${formatDate(row.date)}</td>
        <td><span class="store-badge ${storeCls}">${storeLabel}</span></td>
        <td class="align-right">${row.unitPrice != null ? formatAmount(row.unitPrice) : '–'}</td>
        <td class="align-right">${row.quantity != null ? row.quantity : '–'}</td>
        <td class="align-right item-total">${formatAmount(row.totalPrice)}</td>
      `;
      body.appendChild(tr);
    });

    if (history.length === 0) {
      body.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:24px;color:var(--text-dim)">Ingen historik hittades.</td></tr>`;
    }
  } catch (e) {
    body.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:24px;color:#ef5350">Kunde inte ladda historik: ${escHtml(e.message)}</td></tr>`;
  }
}

function closeProductModal() {
  document.getElementById('product-modal').classList.add('hidden');
  document.body.style.overflow = '';
}

/* ============================================================
   Receipt Modal
   ============================================================ */
async function openReceiptModal(store, filename) {
  const modal = document.getElementById('receipt-modal');
  const body  = document.getElementById('modal-items-body');

  // Reset and show modal
  body.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:24px;color:var(--text-dim)">Laddar...</td></tr>';
  modal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';

  try {
    const data = await apiFetch(`/api/receipt?store=${store}&filename=${encodeURIComponent(filename)}`);

    // Update header
    const badge = document.getElementById('modal-store-badge');
    badge.textContent = data.store === 'willys' ? 'Willys' : 'ICA';
    badge.className = `store-badge ${data.store}`;
    document.getElementById('modal-date').textContent = formatDate(data.date);
    document.getElementById('modal-item-count').textContent = `${data.itemCount} produkter`;
    document.getElementById('modal-total').textContent = formatAmount(data.total);

    // Render items
    body.innerHTML = '';
    const sorted = [...data.items].sort((a, b) => (b.totalPrice || 0) - (a.totalPrice || 0));
    sorted.forEach(item => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="item-name">${escHtml(item.name)}</td>
        <td class="align-right">${item.quantity != null ? item.quantity : '–'}</td>
        <td class="align-right">${item.unitPrice != null ? formatAmount(item.unitPrice) : '–'}</td>
        <td class="align-right item-total">${formatAmount(item.totalPrice)}</td>
      `;
      body.appendChild(tr);
    });
  } catch (e) {
    body.innerHTML = `<tr><td colspan="4" style="text-align:center;padding:24px;color:#ef5350">Kunde inte ladda kvitto: ${escHtml(e.message)}</td></tr>`;
  }
}

function closeReceiptModal() {
  document.getElementById('receipt-modal').classList.add('hidden');
  document.body.style.overflow = '';
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* ============================================================
   Month selection
   ============================================================ */
function setActiveMonthBtn(month) {
  document.querySelectorAll('.month-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.month === month);
  });
}

async function selectMonth(month) {
  if (state.selectedMonth === month) return;
  state.selectedMonth = month;

  setActiveMonthBtn(month);

  const monthDetail      = document.getElementById('month-detail');
  const allProducts      = document.getElementById('all-products-section');
  const priceChanges     = document.getElementById('price-changes-section');

  if (month === 'all') {
    hide(monthDetail);
    show(allProducts);
    show(priceChanges);
    if (state.summary) renderSummaryAll(state.summary);
    loadCategories('all');
    return;
  }

  // Find month data for summary cards
  if (state.monthly) {
    const md = state.monthly.find(m => m.month === month);
    if (md) renderSummaryMonth(md);
  }

  show(monthDetail);
  hide(allProducts);
  hide(priceChanges);

  // Update headings
  const label = state.monthly?.find(m => m.month === month)?.label || month;
  document.getElementById('receipts-heading').textContent  = `Kvitton – ${label}`;
  document.getElementById('products-heading').textContent  = `Topprodukter – ${label}`;

  // Load receipts, top products and categories in parallel
  await Promise.all([
    loadReceipts(month),
    loadTopProducts(month),
    loadCategories(month),
  ]);
}

/* ============================================================
   Data loaders
   ============================================================ */
async function loadSummary() {
  try {
    state.summary = await apiFetch('/api/summary');
    renderSummaryAll(state.summary);
  } catch (e) {
    console.error('Summary error:', e);
    ['stat-total','stat-avg-month','stat-count','stat-willys','stat-ica'].forEach(id => {
      document.getElementById(id).textContent = 'Fel';
    });
  }
}

async function loadMonthly() {
  try {
    state.monthly = await apiFetch('/api/monthly');
    renderMonthList(state.monthly);
    renderChart(state.monthly);
  } catch (e) {
    console.error('Monthly error:', e);
    document.getElementById('month-list').innerHTML =
      `<div class="error-state" style="margin:8px"><span class="error-icon">⚠</span> Kunde inte ladda månader.</div>`;
    hide(document.getElementById('chart-loading'));
  }
}

async function loadReceipts(month) {
  const loading   = document.getElementById('receipts-loading');
  const error     = document.getElementById('receipts-error');
  const container = document.getElementById('receipts-container');

  show(loading);
  hide(error);
  hide(container);

  try {
    const receipts = await apiFetch(`/api/receipts?month=${month}`);
    hide(loading);
    renderReceipts(receipts);
  } catch (e) {
    hide(loading);
    document.getElementById('receipts-error-msg').textContent =
      `Kunde inte ladda kvitton: ${e.message}`;
    show(error);
  }
}

async function loadCategories(month) {
  const loading   = document.getElementById('categories-loading');
  const error     = document.getElementById('categories-error');
  const container = document.getElementById('categories-container');

  show(loading);
  hide(error);
  hide(container);

  const params = (month === 'all') ? '/api/categories' : `/api/categories?month=${month}`;

  try {
    const categories = await apiFetch(params);
    hide(loading);
    renderCategories(categories, month);
  } catch (e) {
    hide(loading);
    show(error);
  }
}

async function loadTopProducts(month, limit = 10) {
  const params = month === 'all'
    ? `/api/top-products?limit=${limit}`
    : `/api/top-products?month=${month}&limit=${limit}`;

  const isAll    = month === 'all';
  const loadingId   = isAll ? 'all-products-loading'   : 'products-loading';
  const errorId     = isAll ? 'all-products-error'     : 'products-error';
  const containerId = isAll ? 'all-products-container' : 'products-container';
  const listId      = isAll ? 'all-products-list'      : 'products-list';

  const loading   = document.getElementById(loadingId);
  const error     = document.getElementById(errorId);
  const container = document.getElementById(containerId);

  show(loading);
  hide(error);
  hide(container);

  try {
    const products = await apiFetch(params);
    hide(loading);
    renderProducts(products, containerId, listId);
  } catch (e) {
    hide(loading);
    show(error);
  }
}

/* ============================================================
   Price changes
   ============================================================ */
async function loadPriceChanges() {
  const loading   = document.getElementById('price-changes-loading');
  const error     = document.getElementById('price-changes-error');
  const container = document.getElementById('price-changes-container');

  show(loading);
  hide(error);
  hide(container);

  try {
    const items = await apiFetch('/api/price-changes?limit=20');
    hide(loading);

    const increases = items.filter(i => i.percentChange > 0);
    const decreases = items.filter(i => i.percentChange < 0);

    const badge = document.getElementById('price-changes-badge');
    badge.textContent = `${increases.length} ökningar · ${decreases.length} sänkningar`;

    renderPriceList(increases, 'price-increases-list');
    renderPriceList(decreases, 'price-decreases-list');

    show(container);
  } catch (e) {
    hide(loading);
    show(error);
  }
}

function renderPriceList(items, listId) {
  const list = document.getElementById(listId);
  list.innerHTML = '';

  const top = items.slice(0, 10);

  top.forEach(item => {
    const isUp      = item.percentChange > 0;
    const sign      = isUp ? '+' : '';
    const badgeCls  = isUp ? 'up' : 'down';
    const diffAmt   = item.lastPrice - item.firstPrice;
    const diffSign  = diffAmt >= 0 ? '+' : '';

    const div = document.createElement('div');
    div.className = 'price-item fade-in';
    div.innerHTML = `
      <div class="price-item-name" title="${escHtml(item.displayName)}">${escHtml(item.displayName)}</div>
      <div class="price-badge ${badgeCls}">${sign}${item.percentChange.toFixed(1)}%</div>
      <div class="price-item-detail">${formatAmount(item.firstPrice)} → ${formatAmount(item.lastPrice)}</div>
      <div class="price-badge ${badgeCls}" style="font-size:0.78rem">${diffSign}${formatAmount(diffAmt)}</div>
    `;
    div.addEventListener('click', () => openProductModal(item.displayName));
    list.appendChild(div);
  });

  if (top.length === 0) {
    list.innerHTML = `<div style="padding:20px;color:var(--text-dim);text-align:center">Inga produkter hittades.</div>`;
  }
}

function initPriceChangeTabs() {
  const tabs      = document.querySelectorAll('.price-tab');
  const incList   = document.getElementById('price-increases-list');
  const decList   = document.getElementById('price-decreases-list');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      if (tab.dataset.tab === 'increases') {
        show(incList);
        hide(decList);
      } else {
        hide(incList);
        show(decList);
      }
    });
  });
}

/* ============================================================
   Compare modal
   ============================================================ */
function openCompareModal() {
  const modal   = document.getElementById('compare-modal');
  const selectA = document.getElementById('compare-month-a');
  const selectB = document.getElementById('compare-month-b');

  // Populate dropdowns from state.monthly (newest first)
  const months = state.monthly ? [...state.monthly].reverse() : [];
  const buildOptions = (sel, defaultIdx) => {
    sel.innerHTML = '';
    months.forEach((m, i) => {
      const opt = document.createElement('option');
      opt.value       = m.month;
      opt.textContent = m.label;
      if (i === defaultIdx) opt.selected = true;
      sel.appendChild(opt);
    });
  };

  // Default: A = second-newest, B = newest
  buildOptions(selectA, 1);
  buildOptions(selectB, 0);

  // Reset result area
  hide(document.getElementById('compare-result'));
  hide(document.getElementById('compare-loading'));
  hide(document.getElementById('compare-error'));

  modal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeCompareModal() {
  document.getElementById('compare-modal').classList.add('hidden');
  document.body.style.overflow = '';
}

async function runComparison() {
  const monthA  = document.getElementById('compare-month-a').value;
  const monthB  = document.getElementById('compare-month-b').value;
  const result  = document.getElementById('compare-result');
  const loading = document.getElementById('compare-loading');
  const error   = document.getElementById('compare-error');
  const errorMsg= document.getElementById('compare-error-msg');

  if (monthA === monthB) {
    errorMsg.textContent = 'Välj två olika månader för att jämföra.';
    show(error);
    return;
  }

  hide(result);
  hide(error);
  show(loading);

  try {
    const data = await apiFetch(`/api/compare?monthA=${monthA}&monthB=${monthB}`);
    hide(loading);
    renderCompareResult(data);
    show(result);
  } catch (e) {
    hide(loading);
    errorMsg.textContent = `Kunde inte hämta jämförelsedata: ${e.message}`;
    show(error);
  }
}

function renderCompareResult(data) {
  const { monthA, monthB, diff } = data;
  const result = document.getElementById('compare-result');

  const isPositive   = diff.total > 0;  // B is more expensive → red
  const diffCls      = isPositive ? 'positive' : 'negative';
  const diffSign     = diff.total >= 0 ? '+' : '';
  const wDiffSign    = diff.willys >= 0 ? '+' : '';
  const iDiffSign    = diff.ica >= 0 ? '+' : '';

  // Categories table rows
  const allCats = new Set([
    ...monthA.categories.map(c => c.category),
    ...monthB.categories.map(c => c.category),
  ]);
  let catRows = '';
  for (const cat of allCats) {
    const a = monthA.categories.find(c => c.category === cat);
    const b = monthB.categories.find(c => c.category === cat);
    const aAmt  = a ? a.totalSpent : 0;
    const bAmt  = b ? b.totalSpent : 0;
    const d     = bAmt - aAmt;
    const dSign = d >= 0 ? '+' : '';
    const dCls  = d > 0 ? 'positive' : d < 0 ? 'negative' : '';
    catRows += `
      <tr>
        <td>${escHtml(cat)}</td>
        <td class="align-right">${aAmt > 0 ? formatAmount(aAmt) : '–'}</td>
        <td class="align-right">${bAmt > 0 ? formatAmount(bAmt) : '–'}</td>
        <td class="align-right compare-diff ${dCls}">${d !== 0 ? dSign + formatAmount(d) : '–'}</td>
      </tr>`;
  }

  // Top products columns
  const buildProductRows = products =>
    products.map(p => `
      <div class="compare-product-row">
        <span>${escHtml(p.name)}</span>
        <span>${formatAmount(p.totalSpent)}</span>
      </div>`).join('');

  result.innerHTML = `
    <div class="compare-total-grid">
      <div class="compare-total-card">
        <div class="compare-total-label">${escHtml(monthA.label)}</div>
        <div class="compare-total-value">${formatAmount(monthA.total)}</div>
        <div class="compare-total-label" style="margin-top:6px">${monthA.receiptCount} kvitton</div>
      </div>
      <div class="compare-total-card">
        <div class="compare-total-label">${escHtml(monthB.label)}</div>
        <div class="compare-total-value">${formatAmount(monthB.total)}</div>
        <div class="compare-diff ${diffCls}">${diffSign}${formatAmount(diff.total)} (${diffSign}${diff.percentChange.toFixed(1)}%)</div>
        <div class="compare-total-label" style="margin-top:4px">${monthB.receiptCount} kvitton</div>
      </div>
    </div>

    <div class="compare-section-title">Butikssplit</div>
    <table class="compare-table">
      <thead>
        <tr><th>Butik</th><th class="align-right">${escHtml(monthA.label)}</th><th class="align-right">${escHtml(monthB.label)}</th><th class="align-right">Diff</th></tr>
      </thead>
      <tbody>
        <tr>
          <td><span class="store-badge willys">Willys</span></td>
          <td class="align-right">${formatAmount(monthA.willys)}</td>
          <td class="align-right">${formatAmount(monthB.willys)}</td>
          <td class="align-right compare-diff ${diff.willys > 0 ? 'positive' : diff.willys < 0 ? 'negative' : ''}">${wDiffSign}${formatAmount(diff.willys)}</td>
        </tr>
        <tr>
          <td><span class="store-badge ica">ICA</span></td>
          <td class="align-right">${formatAmount(monthA.ica)}</td>
          <td class="align-right">${formatAmount(monthB.ica)}</td>
          <td class="align-right compare-diff ${diff.ica > 0 ? 'positive' : diff.ica < 0 ? 'negative' : ''}">${iDiffSign}${formatAmount(diff.ica)}</td>
        </tr>
      </tbody>
    </table>

    <div class="compare-section-title">Kategorier</div>
    <table class="compare-table">
      <thead>
        <tr><th>Kategori</th><th class="align-right">${escHtml(monthA.label)}</th><th class="align-right">${escHtml(monthB.label)}</th><th class="align-right">Diff</th></tr>
      </thead>
      <tbody>${catRows}</tbody>
    </table>

    <div class="compare-section-title">Topprodukter</div>
    <div class="compare-cols">
      <div>
        <div class="compare-col-title">${escHtml(monthA.label)}</div>
        ${buildProductRows(monthA.topProducts)}
      </div>
      <div>
        <div class="compare-col-title">${escHtml(monthB.label)}</div>
        ${buildProductRows(monthB.topProducts)}
      </div>
    </div>
  `;
}

/* ============================================================
   Init
   ============================================================ */
async function init() {
  // "Alla månader" button
  document.getElementById('btn-all').addEventListener('click', () => selectMonth('all'));

  // Receipt modal close handlers
  document.getElementById('modal-close').addEventListener('click', closeReceiptModal);
  document.getElementById('receipt-modal').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeReceiptModal();
  });

  // Product modal close handlers
  document.getElementById('product-modal-close').addEventListener('click', closeProductModal);
  document.getElementById('product-modal').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeProductModal();
  });

  // Compare modal
  document.getElementById('btn-compare').addEventListener('click', openCompareModal);
  document.getElementById('compare-modal-close').addEventListener('click', closeCompareModal);
  document.getElementById('compare-modal').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeCompareModal();
  });
  document.getElementById('compare-run-btn').addEventListener('click', runComparison);

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      closeReceiptModal();
      closeProductModal();
      closeCompareModal();
    }
  });

  // Price changes tabs
  initPriceChangeTabs();

  // Product search with debounce
  let searchTimer = null;
  const searchInput   = document.getElementById('product-search');
  const searchResults = document.getElementById('search-results');
  const searchClear   = document.getElementById('search-clear');

  function clearSearch() {
    searchInput.value = '';
    hide(searchResults);
    hide(searchClear);
    searchResults.innerHTML = '';
    searchInput.focus();
  }

  searchClear.addEventListener('click', clearSearch);

  searchInput.addEventListener('input', () => {
    clearTimeout(searchTimer);
    const q = searchInput.value.trim();
    toggle(searchClear, q.length > 0);
    if (!q) {
      hide(searchResults);
      searchResults.innerHTML = '';
      return;
    }
    searchTimer = setTimeout(async () => {
      try {
        const results = await apiFetch(`/api/search?q=${encodeURIComponent(q)}&limit=8`);
        searchResults.innerHTML = '';
        if (!results || results.length === 0) {
          hide(searchResults);
          return;
        }
        results.forEach(item => {
          const div = document.createElement('div');
          div.className = 'search-result-item';
          const lastSeen = item.lastSeen ? formatDate(item.lastSeen) : '–';
          div.innerHTML = `
            <div class="search-result-name" title="${escHtml(item.name)}">${escHtml(item.name)}</div>
            <div class="search-result-meta">${item.count} köp · ${formatAmount(item.totalSpent)} · senast ${lastSeen}</div>
          `;
          div.addEventListener('click', () => {
            openProductModal(item.name);
            hide(searchResults);
            searchInput.value = '';
          });
          searchResults.appendChild(div);
        });
        show(searchResults);
      } catch (e) {
        console.error('Search error:', e);
      }
    }, 300);
  });

  // Hide search results on outside click
  document.addEventListener('click', e => {
    if (!searchInput.contains(e.target) && !searchResults.contains(e.target)) {
      hide(searchResults);
    }
  });

  // Load data in parallel
  await Promise.all([loadSummary(), loadMonthly()]);

  // Initial state: "all months" – load global top products, categories and price changes in parallel
  await Promise.all([loadTopProducts('all', 15), loadCategories('all'), loadPriceChanges()]);
}

document.addEventListener('DOMContentLoaded', init);
