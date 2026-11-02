'use strict';

// Guards for the bug fixes: make sure each fix did not go too far.

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');

const { parseItemLine, parseReceipt } = require('../lib/receipt-parser.cjs');
const { parseItems, extractDate } = require('../lib/ica-parser.cjs');
const { categorizeItem } = require('../lib/categorizer.cjs');

describe('Willys skip list still skips real metadata lines', () => {
  for (const line of [
    'Auth. kod: 123456', 'AUTH 123456', 'Start 2026-01-30 16:50', 'Slut 2026-01-30 16:58',
    'Moms % Moms Netto Brutto', 'Kvittonummer: 1234567', 'Kvitto nr 42', 'Terminal-ID 1234',
    'Totalt 29 varor', 'ATT BETALA 234,55', 'Org.nr 000000-0000', 'Ref: 99999999',
  ]) {
    test(line, () => assert.equal(parseItemLine(line), null));
  }

  test('products starting with a skip word are kept', () => {
    for (const name of ['AUTHENTIC TORTILLA CHIPS', 'STARTPAKET KAFFE', 'SLUTSPURT CHOKLAD', 'MOMSFRI TEST']) {
      assert.equal(parseItemLine(`${name} 29,90`)?.name, name);
    }
  });
});

describe('Willys grandTotal', () => {
  const total = text => parseReceipt(text, 'x').metadata.grandTotal;

  test('prefers ATT BETALA over the item count line', () => {
    assert.equal(total('Totalt 29 varor\nATT BETALA 779,42'), 779.42);
  });

  test('"Totalt <amount> SEK" when there is no ATT BETALA', () => {
    assert.equal(total('Totalt 29 varor\nTotalt 779,42 SEK'), 779.42);
  });

  test('thousands separator', () => {
    assert.equal(total('ATT BETALA 1 234,50'), 1234.5);
  });

  test('does not read the next line', () => {
    assert.equal(total('ATT BETALA 779,42\n12,00 1,00 2,00'), 779.42);
  });

  test('only an item count -> undefined, never the count', () => {
    assert.equal(total('Totalt 29 varor'), undefined);
  });
});

describe('ICA discounted items', () => {
  const HEADER = 'Beskrivning Artikelnummer Pris Mängd Summa(SEK)';
  const section = (...lines) => [HEADER, ...lines, 'Betalat 0,00'].join('\n');

  test('a real discount line after a * item is still applied', () => {
    const items = parseItems(section(
      '*Prästost 31% 7310000000011 89,90 1,00 st 89,90',
      'Rabatt Prästost -20,00',
      'Gurka 7310000000042 12,90 1,00 st 12,90',
    ));
    assert.deepEqual(items.map(i => [i.name, Math.round(i.totalPrice * 100) / 100]),
      [['Prästost 31%', 69.9], ['Gurka', 12.9]]);
  });

  test('* item as the last row', () => {
    const items = parseItems(section('*Prästost 31% 7310000000011 89,90 1,00 st 89,90'));
    assert.equal(items[0].totalPrice, 89.9);
  });
});

describe('ICA extractDate', () => {
  test('skips an invalid date-like number and finds the real date', () => {
    assert.equal(extractDate('Ref 9999-99-99\nDatum 2025-03-14 17:42'), '2025-03-14T00:00:00.000Z');
  });

  test('rejects impossible calendar dates', () => {
    assert.equal(extractDate('2025-02-30'), null);
  });
});

describe('categorizer fixes', () => {
  test('canned tomatoes are Pantry, fresh are Fruit & Vegetables', () => {
    assert.equal(categorizeItem('Krossade tomater'), 'Pantry Staples');
    assert.equal(categorizeItem('Passerade tomater'), 'Pantry Staples');
    assert.equal(categorizeItem('Tomatpuré'), 'Pantry Staples');
    assert.equal(categorizeItem('Tomater kvist'), 'Fruit & Vegetables');
    assert.equal(categorizeItem('Körsbärstomater'), 'Fruit & Vegetables');
  });

  test('ICA cat food still detected, human fish compounds are not', () => {
    assert.equal(categorizeItem('*Sås Tonfisk', { price: 12.95 }), 'Pet Food');
    assert.equal(categorizeItem('Filet Kyck Tonfisk', { price: 15 }), 'Pet Food');
    assert.equal(categorizeItem('Mousse Lax', { price: 9 }), 'Pet Food');
    assert.equal(categorizeItem('Laxfilet 4-pack', { price: 79.9 }), 'Meat & Protein');
    assert.notEqual(categorizeItem('Tonfisksås', { price: 25 }), 'Pet Food');
  });
});
