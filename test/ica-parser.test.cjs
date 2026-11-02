const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  parseIcaReceipt, parseItems, extractDate, extractStore, calculateGrandTotal,
} = require('../lib/ica-parser.cjs');

const FIXTURE = fs.readFileSync(path.join(__dirname, 'fixtures', 'ica-receipt.txt'), 'utf8');
const HEADER = 'Beskrivning Artikelnummer Pris Mängd Summa(SEK)';
const section = (...lines) => [HEADER, ...lines, 'Betalat 0,00'].join('\n');
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} != ${b}`);

describe('ICA parseItems', () => {
  const items = parseItems(FIXTURE);

  test('finds all item and discount rows in the item section', () => {
    assert.deepEqual(items.map(i => i.name), [
      'AXA F-müsli Guld', 'Prästost 31%', 'Bananer', 'Mellanmjölk 1,5%', 'Bonus-rabatt',
    ]);
  });

  test('normal st line', () => {
    assert.deepEqual(items[0], {
      name: 'AXA F-müsli Guld', quantity: 1, unitPrice: 33.95, totalPrice: 33.95,
      originalPrice: undefined, discount: undefined, category: 'Pantry Staples',
    });
  });

  test('"*" discounted line consumes the following discount line', () => {
    const ost = items[1];
    close(ost.totalPrice, 69.9);
    close(ost.unitPrice, 69.9);
    assert.equal(ost.originalPrice, 89.9);
    assert.equal(ost.discount, 20);
    assert.equal(ost.category, 'Dairy');
    assert.ok(!items.some(i => i.name === 'Rabatt Prästost'));
  });

  test('kg item uses weight as quantity', () => {
    const b = items[2];
    assert.equal(b.quantity, 0.734);
    assert.equal(b.totalPrice, 18.31);
    close(b.unitPrice, 18.31 / 0.734);
    assert.equal(b.category, 'Fruit & Vegetables');
  });

  test('multi-quantity line', () => {
    const m = items[3];
    assert.equal(m.quantity, 2);
    assert.equal(m.totalPrice, 29.8);
    close(m.unitPrice, 14.9);
    assert.equal(m.category, 'Dairy');
  });

  test('standalone negative discount line', () => {
    assert.deepEqual(items[4], {
      name: 'Bonus-rabatt', quantity: 1, unitPrice: -10, totalPrice: -10,
      isDiscount: true, category: 'Discounts & Offers',
    });
  });

  test('ignores lines before the header and after Betalat / Moms %', () => {
    const text = [
      'Gurka 7310000000042 12,90 1,00 st 12,90',
      HEADER,
      'Tomat 7310000000059 20,00 1,00 st 20,00',
      'Moms % Moms Netto Brutto',
      'Paprika 7310000000066 15,00 1,00 st 15,00',
    ].join('\n');
    assert.deepEqual(parseItems(text).map(i => i.name), ['Tomat']);
  });

  test('no header -> no items', () => {
    assert.deepEqual(parseItems('Gurka 7310000000042 12,90 1,00 st 12,90'), []);
  });

  test('hyphenated line with positive amount is not a discount', () => {
    assert.deepEqual(parseItems(section('Coca-Cola info 30,00')), []);
  });

  test('ICA generic cat food gets Pet Food via unit price', () => {
    const [item] = parseItems(section('*Sås Tonfisk 7310000000073 12,95 4,00 st 51,80'));
    assert.equal(item.name, 'Sås Tonfisk');
    assert.equal(item.category, 'Pet Food');
  });

  test('"*" item followed directly by another item does not swallow it',
    () => {
      const got = parseItems(section(
        '*Prästost 31% 7310000000011 89,90 1,00 st 89,90',
        'Gurka 7310000000042 12,90 1,00 st 12,90',
      ));
      assert.deepEqual(got.map(i => [i.name, i.totalPrice]), [['Prästost 31%', 89.9], ['Gurka', 12.9]]);
    });
});

describe('ICA extractDate / extractStore', () => {
  test('extractDate returns UTC midnight ISO string', () => {
    assert.equal(extractDate(FIXTURE), '2025-03-14T00:00:00.000Z');
  });

  test('extractDate without date -> null', () => {
    assert.equal(extractDate('inget datum här'), null);
  });

  test('extractDate on an impossible date returns null instead of throwing',
    () => {
      assert.equal(extractDate('Kvittonr 9999-99-99'), null);
    });

  test('extractStore', () => {
    assert.equal(extractStore(FIXTURE), 'ICA Supermarket Testby');
    assert.equal(extractStore('Maxi ICA Stormarknad Testby\nannat'), 'Maxi ICA Stormarknad Testby');
    assert.equal(extractStore('ica Nära Testby'), 'ica Nära Testby');
    assert.equal(extractStore('Ingen butik'), 'ICA');
  });

  test('extractStore does not match "ica " inside another word',
    () => {
      assert.equal(extractStore('Kassör Erica 3\nICA Nära Testby'), 'ICA Nära Testby');
    });
});

describe('ICA calculateGrandTotal / parseIcaReceipt', () => {
  test('calculateGrandTotal sums including negatives', () => {
    close(calculateGrandTotal([{ totalPrice: 10 }, { totalPrice: 5.5 }, { totalPrice: -3 }]), 12.5);
    assert.equal(calculateGrandTotal([]), 0);
  });

  test('parseIcaReceipt builds full structure', () => {
    const r = parseIcaReceipt(FIXTURE, 'ica.pdf');
    assert.equal(r.filename, 'ica.pdf');
    assert.equal(r.itemCount, 5);
    assert.equal(r.items.length, 5);
    assert.equal(r.metadata.store, 'ICA Supermarket Testby');
    assert.equal(r.metadata.isEcommerce, false);
    assert.equal(r.metadata.date, '2025-03-14T00:00:00.000Z');
    assert.equal(r.metadata.totalItems, 5);
    close(r.metadata.grandTotal, 141.96);
  });

  test('parseIcaReceipt returns null when no items', () => {
    assert.equal(parseIcaReceipt('ICA Nära Testby\n2025-01-01\nBetalat 0,00', 'x.pdf'), null);
    assert.equal(parseIcaReceipt(section(), 'x.pdf'), null);
  });
});
