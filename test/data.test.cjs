const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const data = require('../lib/data.cjs');
const { parseReceipt } = require('../lib/receipt-parser.cjs');

const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} != ${b}`);

describe('totals', () => {
  const willys = {
    metadata: { grandTotal: 3 }, // wrong on purpose: Willys grandTotal holds item count
    items: [{ totalPrice: 19.9 }, { totalPrice: 32 }, { totalPrice: -6, isDiscount: true }],
  };

  test('calculateTotal sums all Willys items incl. negative discounts, ignores grandTotal', () => {
    close(data.calculateTotal(willys), 45.9);
  });

  test('calculateTotal handles missing items / totalPrice', () => {
    assert.equal(data.calculateTotal({}), 0);
    assert.equal(data.calculateTotal(null), 0);
    assert.equal(data.calculateTotal({ items: 'nope' }), 0);
    close(data.calculateTotal({ items: [{ totalPrice: 5 }, { name: 'x' }] }), 5);
  });

  test('icaTotal uses grandTotal', () => {
    assert.equal(data.icaTotal({ metadata: { grandTotal: 100 }, items: [{ totalPrice: 1 }] }), 100);
    assert.equal(data.icaTotal({ metadata: { grandTotal: 0 }, items: [{ totalPrice: 1 }] }), 0);
  });

  test('icaTotal falls back to item sum', () => {
    const items = [{ totalPrice: 10 }, { totalPrice: -2 }];
    assert.equal(data.icaTotal({ metadata: {}, items }), 8);
    assert.equal(data.icaTotal({ items }), 8);
    assert.equal(data.icaTotal({ metadata: { grandTotal: NaN }, items }), 8);
    assert.equal(data.icaTotal({ metadata: { grandTotal: '100' }, items }), 8);
  });

  test('receiptTotal dispatches per store and throws on unknown store', () => {
    close(data.receiptTotal(willys, 'willys'), 45.9);
    assert.equal(data.receiptTotal(willys, 'ica'), 3);
    assert.throws(() => data.receiptTotal(willys, 'coop'), /Unknown store "coop"/);
    assert.throws(() => data.receiptTotal(willys), /Unknown store/);
  });
});

describe('monthKey', () => {
  test('ISO string -> YYYY-MM', () => {
    assert.equal(data.monthKey({ metadata: { date: '2025-05-02T07:36:31.000Z' } }), '2025-05');
  });

  test('missing date -> null', () => {
    assert.equal(data.monthKey({ metadata: {} }), null);
    assert.equal(data.monthKey({}), null);
    assert.equal(data.monthKey(null), null);
  });

  test('works on a freshly parsed Willys receipt (metadata.date is a Date)',
    () => {
      const r = parseReceipt('Willys Testköping\n2026-01-30 16:50:48\nGURKA 19,90', 'x');
      assert.equal(data.monthKey(r), '2026-01');
    });
});

describe('product matchers', () => {
  test('isMilk: real milk', () => {
    for (const n of ['Mellanmjölk', 'MELLANMJÖLK 1L', 'Standardmjölk 3%', 'Lättmjölk', 'Filmjölk', 'Laktosfri mjölk']) {
      assert.equal(data.isMilk(n), true, n);
    }
  });

  test('isMilk: never chocolate or other excluded products', () => {
    for (const n of ['Mjölkchoklad', 'MJÖLKCHOKLAD 200G', 'Marabou Helnöt mjölkchoklad', 'Daim mjölk',
      'Kattmjölk', 'Mjölkkex', 'Cookie mjölk', 'Snickers mjölk', 'Twix', 'Mars mjölk', 'Bounty mjölk']) {
      assert.equal(data.isMilk(n), false, n);
    }
  });

  test('isMilk: unrelated and empty', () => {
    assert.equal(data.isMilk('Vetemjöl'), false);
    assert.equal(data.isMilk(''), false);
    assert.equal(data.isMilk(undefined), false);
  });

  test('isCokeZero', () => {
    for (const n of ['Coca-Cola Zero 1,5L', 'COCA-COLA ZERO SUGAR', 'Coca Cola Zero', 'Cola Zero',
      'Coke Zero', 'Koffeinfri Zero']) {
      assert.equal(data.isCokeZero(n), true, n);
    }
    for (const n of ['Coca-Cola Original', 'Pepsi Max', 'Fanta Zero', '', undefined]) {
      assert.equal(data.isCokeZero(n), false, String(n));
    }
  });

  test('isCatFood (re-exported)', () => {
    assert.equal(data.isCatFood('Felix Kattmat'), true);
    assert.equal(data.isCatFood('Sås Tonfisk', 12), true);
    assert.equal(data.isCatFood('Sås Tonfisk', 150), false);
    assert.equal(data.isCatFood('GOURMETSKINKA'), false);
    assert.equal(data.isCatFood('Mellanmjölk'), false);
  });
});

describe('loading with KVITTO_OUTPUT_DIR', () => {
  let dir;
  let prev;
  const willysFixture = [{ filename: 'w.pdf', metadata: { date: '2025-02-01T10:00:00.000Z' }, items: [{ name: 'GURKA', totalPrice: 19.9 }] }];
  const icaFixture = [{ filename: 'i.pdf', metadata: { grandTotal: 42 }, items: [] }];

  before(() => {
    prev = process.env.KVITTO_OUTPUT_DIR;
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kvitto-test-'));
    fs.writeFileSync(path.join(dir, 'willys-analysis.json'), JSON.stringify(willysFixture));
    fs.writeFileSync(path.join(dir, 'ica-analysis.json'), JSON.stringify(icaFixture));
    process.env.KVITTO_OUTPUT_DIR = dir;
  });

  after(() => {
    if (prev === undefined) delete process.env.KVITTO_OUTPUT_DIR;
    else process.env.KVITTO_OUTPUT_DIR = prev;
    fs.rmSync(dir, { recursive: true, force: true });
  });

  test('outputDir honours env', () => {
    assert.equal(data.outputDir(), dir);
  });

  test('loadWillys / loadIca read the fixture files', () => {
    assert.deepEqual(data.loadWillys(), willysFixture);
    assert.deepEqual(data.loadIca(), icaFixture);
  });

  test('loadAnalysis rejects unknown store', () => {
    assert.throws(() => data.loadAnalysis('coop'), /Unknown store/);
  });

  test('missing file throws ENOENT', () => {
    fs.rmSync(path.join(dir, 'ica-analysis.json'));
    assert.throws(() => data.loadIca(), { code: 'ENOENT' });
  });
});

describe('outputDir default', () => {
  test('defaults to <repo>/output when env is unset', () => {
    const prev = process.env.KVITTO_OUTPUT_DIR;
    delete process.env.KVITTO_OUTPUT_DIR;
    try {
      assert.equal(data.outputDir(), path.join(__dirname, '..', 'output'));
    } finally {
      if (prev !== undefined) process.env.KVITTO_OUTPUT_DIR = prev;
    }
  });
});
