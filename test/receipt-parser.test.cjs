const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { parseItemLine, parseReceipt } = require('../lib/receipt-parser.cjs');

const FIXTURE = fs.readFileSync(path.join(__dirname, 'fixtures', 'willys-receipt.txt'), 'utf8');

describe('Willys parseItemLine', () => {
  test('simple line', () => {
    assert.deepEqual(parseItemLine('GURKA IMPORT 19,90'), {
      name: 'GURKA IMPORT', quantity: 1, unitPrice: 19.9, totalPrice: 19.9,
    });
  });

  test('name with digits and comma keeps everything but the last price', () => {
    const item = parseItemLine('COCA-COLA ZERO 1,5L 24,90');
    assert.equal(item.name, 'COCA-COLA ZERO 1,5L');
    assert.equal(item.totalPrice, 24.9);
  });

  test('collapses extra whitespace in name', () => {
    assert.equal(parseItemLine('  GURKA    IMPORT   19,90 ').name, 'GURKA IMPORT');
  });

  test('quantity line', () => {
    assert.deepEqual(parseItemLine('MELLANMJÖLK 1L 2st*13,90 27,80'), {
      name: 'MELLANMJÖLK 1L', quantity: 2, unitPrice: 13.9, totalPrice: 27.8,
    });
  });

  test('discount line is negative and flagged', () => {
    assert.deepEqual(parseItemLine('Rabatt:BRÖD -6,00'), {
      name: 'BRÖD', quantity: 1, unitPrice: -6, totalPrice: -6, isDiscount: true,
    });
  });

  test('pant line with and without leading +', () => {
    assert.deepEqual(parseItemLine('+PANT ENG PET >1L 2,00'), {
      name: 'PANT ENG PET >1L', quantity: 1, unitPrice: 2, totalPrice: 2, isPant: true,
    });
    assert.equal(parseItemLine('PANT BURK 1,00').isPant, true);
  });

  test('empty and whitespace lines', () => {
    assert.equal(parseItemLine(''), null);
    assert.equal(parseItemLine('   '), null);
  });

  test('skips metadata / payment / total lines', () => {
    for (const line of [
      'Totalt 7 varor', 'SUMMA 234,55', 'ATT BETALA 234,55', 'DEBIT MASTERCARD 234,55',
      'SWISH 100,00', 'Kvitto 0001', 'Tfn: 000-000 00 00', 'Org.nr 000000-0000',
      'Moms % Moms Netto Brutto', 'Du sparar 6,00', 'Öresutjämning 0,45',
      'Willys Plus 12,00', '========', '----------',
    ]) {
      assert.equal(parseItemLine(line), null, line);
    }
  });

  test('skips VAT rows with several numbers', () => {
    assert.equal(parseItemLine('12,00 196,32 1635,88'), null);
    assert.equal(parseItemLine('25,00 0,45 1,80 2,25'), null);
  });

  test('skips number-only lines and long reference ids', () => {
    assert.equal(parseItemLine('234,55'), null);
    assert.equal(parseItemLine('1234567890'), null);
    assert.equal(parseItemLine('Kassa: 12345678'), null);
  });

  test('line with no trailing price is not an item', () => {
    assert.equal(parseItemLine('Willys Testköping'), null);
  });

  test('product whose name starts with a skip-prefix word is still an item',
    () => {
      assert.equal(parseItemLine('AUTHENTIC TORTILLA CHIPS 29,90')?.name, 'AUTHENTIC TORTILLA CHIPS');
    });
});

describe('Willys parseReceipt', () => {
  const receipt = parseReceipt(FIXTURE, 'test.pdf');

  test('filename and item count', () => {
    assert.equal(receipt.filename, 'test.pdf');
    assert.equal(receipt.itemCount, receipt.items.length);
    assert.equal(receipt.items.length, 7);
  });

  test('item names in order', () => {
    assert.deepEqual(receipt.items.map(i => i.name), [
      'GURKA IMPORT', 'MELLANMJÖLK 1L', 'NÖTFÄRS 12%', 'BRÖD FRALLOR', 'BRÖD',
      'COCA-COLA ZERO 1,5L', 'PANT ENG PET >1L',
    ]);
  });

  test('multi-line weight item', () => {
    const item = receipt.items.find(i => i.name === 'NÖTFÄRS 12%');
    assert.deepEqual(item, {
      name: 'NÖTFÄRS 12%', quantity: 0.899, unit: 'kg', unitPrice: 149, totalPrice: 133.95,
    });
  });

  test('weight item with spaces around *', () => {
    const r = parseReceipt('LÖSVIKTSGODIS\n0,250kg * 99,00kr/kg 24,75', 'x');
    assert.deepEqual(r.items, [
      { name: 'LÖSVIKTSGODIS', quantity: 0.25, unit: 'kg', unitPrice: 99, totalPrice: 24.75 },
    ]);
  });

  test('item rows sum to the paid amount (discounts included)', () => {
    const sum = receipt.items.reduce((s, i) => s + i.totalPrice, 0);
    assert.ok(Math.abs(sum - 234.55) < 0.001, `sum was ${sum}`);
  });

  test('metadata: store, date, e-commerce, payment, item count', () => {
    const m = receipt.metadata;
    assert.equal(m.store, 'Testköping');
    assert.equal(m.isEcommerce, false);
    assert.equal(m.paymentMethod, 'Debit Card');
    assert.equal(m.totalItems, 7);
    assert.ok(m.date instanceof Date);
    // Parsed as local time
    assert.deepEqual(
      [m.date.getFullYear(), m.date.getMonth() + 1, m.date.getDate(), m.date.getHours(), m.date.getMinutes(), m.date.getSeconds()],
      [2026, 1, 30, 16, 50, 48],
    );
  });

  test('metadata: grandTotal is the paid amount',
    () => {
      assert.equal(receipt.metadata.grandTotal, 234.55);
    });

  test('metadata: e-commerce flag', () => {
    assert.equal(parseReceipt('Willys E-HANDEL\nGURKA 19,90', 'x').metadata.isEcommerce, true);
    assert.equal(parseReceipt('Willys Hemma e-handel\nGURKA 19,90', 'x').metadata.isEcommerce, true);
  });

  test('metadata: payment methods', () => {
    assert.equal(parseReceipt('CREDIT VISA 10,00', 'x').metadata.paymentMethod, 'Credit Card');
    assert.equal(parseReceipt('SWISH 10,00', 'x').metadata.paymentMethod, 'Swish');
    assert.equal(parseReceipt('KONTANT 10,00', 'x').metadata.paymentMethod, undefined);
  });

  test('missing metadata is left undefined', () => {
    const m = parseReceipt('GURKA 19,90', 'x').metadata;
    assert.equal(m.store, undefined);
    assert.equal(m.date, undefined);
  });
});
