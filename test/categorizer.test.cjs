const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const {
  categorizeItem, categorizeReceiptItem, isCatFood, isLikelyCatFood, CATEGORY_NAMES,
} = require('../lib/categorizer.cjs');

function expectCategories(table) {
  for (const [name, expected, opts] of table) {
    assert.equal(categorizeItem(name, opts), expected, `${name} -> ${expected}`);
  }
}

describe('categorizeItem: short keywords only match as words / word parts', () => {
  test('ost does not match inside other words', () => {
    assert.notEqual(categorizeItem('Rostbiff'), 'Dairy');
    assert.equal(categorizeItem('Rostbiff'), 'Meat & Protein');
    assert.notEqual(categorizeItem('Rostad lök'), 'Dairy');
  });

  test('ris does not match "Pris"', () => {
    assert.notEqual(categorizeItem('Pris'), 'Pantry Staples');
    assert.notEqual(categorizeItem('PRIS'), 'Pantry Staples');
  });

  test('te only as a whole word', () => {
    assert.equal(categorizeItem('Te Earl Grey'), 'Beverages');
    assert.equal(categorizeItem('Grönt te'), 'Beverages');
    assert.notEqual(categorizeItem('Tomater'), 'Beverages');
    assert.notEqual(categorizeItem('Potatis'), 'Beverages');
  });

  test('fil only as word/ending, not in "filet"', () => {
    assert.notEqual(categorizeItem('Kycklingfilet'), 'Dairy');
    assert.equal(categorizeItem('Kycklingfilet'), 'Meat & Protein');
    assert.equal(categorizeItem('Fil 3%'), 'Dairy');
    assert.equal(categorizeItem('Ekologisk filmjölk'), 'Dairy');
  });
});

describe('categorizeItem: compounds still match', () => {
  test('dairy and pantry compounds', () => {
    expectCategories([
      ['Mellanmjölk', 'Dairy'],
      ['MELLANMJÖLK 1L', 'Dairy'],
      ['Färskost naturell', 'Dairy'],
      ['Prästost 31%', 'Dairy'],
      ['Ost 28%', 'Dairy'],
      ['Jasminris', 'Pantry Staples'],
      ['Ris basmati', 'Pantry Staples'],
      ['Bakpulver', 'Pantry Staples'],
    ]);
  });

  test('flour compounds are Pantry Staples, not beer',
    () => {
      expectCategories([
        ['Vetemjöl', 'Pantry Staples'],
        ['Rågmjöl', 'Pantry Staples'],
        ['Mjöl special', 'Pantry Staples'],
      ]);
    });

  test('negative lookaheads', () => {
    expectCategories([
      ['Smörgåsgurka', 'Fruit & Vegetables'],
      ['Vattenmelon', 'Fruit & Vegetables'],
      ['Kaffefilter', 'Household'],
      ['Kaffe bryggmalet', 'Beverages'],
    ]);
  });

  test('coffee roast names are not cheese',
    () => {
      expectCategories([
        ['Kaffe mellanrost', 'Beverages'],
        ['Bryggkaffe mörkrost', 'Beverages'],
      ]);
    });
});

describe('categorizeItem: rule order', () => {
  test('specific before broad', () => {
    expectCategories([
      ['Mjölkchoklad', 'Snacks & Candy'],
      ['MJÖLKCHOKLAD 200G', 'Snacks & Candy'],
      ['Hamburgerbröd', 'Bread & Bakery'],
      ['Pizzaost', 'Dairy'],
      ['Pizza Margherita', 'Frozen'],
      ['Ostbågar', 'Snacks & Candy'],
      ['Fiskpinnar', 'Frozen'],
      ['Chilisås', 'Sauces & Condiments'],
      ['Coca-Cola Zero 1,5L', 'Beverages'],
      ['GURKA IMPORT', 'Fruit & Vegetables'],
      ['Toalettpapper', 'Household'],
      ['Schampo', 'Personal Care'],
      ['Strumpor', 'Clothing'],
    ]);
  });

  test('unknown and empty names', () => {
    assert.equal(categorizeItem('Xyzzy'), 'Uncategorized');
    assert.equal(categorizeItem(''), 'Uncategorized');
    assert.equal(categorizeItem(undefined), 'Uncategorized');
  });

  test('explicit pantry tomato products are Pantry Staples',
    () => {
      expectCategories([
        ['Krossade tomater', 'Pantry Staples'],
        ['Tomatpuré', 'Pantry Staples'],
      ]);
    });
});

describe('categorizeItem: Pet Food', () => {
  test('brands', () => {
    for (const name of ['Felix Kattmat', 'Whiskas Kyckling', 'Sheba Fresh', 'Gourmet Gold Paté',
      'Dreamies Ost', 'Perfect Fit Adult', 'Catessy Lax', 'WHIS KYCKL 4P', 'Kattsand']) {
      assert.equal(categorizeItem(name), 'Pet Food', name);
    }
  });

  test('gourmet only as its own word', () => {
    assert.equal(categorizeItem('GOURMETSKINKA'), 'Meat & Protein');
  });

  test('whisky is not Whiskas', () => {
    assert.notEqual(categorizeItem('Whisky'), 'Pet Food');
  });

  test('ICA generic cat food via price heuristic', () => {
    assert.equal(categorizeItem('*Sås Tonfisk', { price: 12.95 }), 'Pet Food');
    assert.equal(categorizeItem('Filet Kyck Tonfisk', { price: 9.5 }), 'Pet Food');
    assert.equal(categorizeItem('Mousse Lax', { price: 15 }), 'Pet Food');
    // too expensive / no price -> not cat food
    assert.notEqual(categorizeItem('*Sås Tonfisk', { price: 150 }), 'Pet Food');
    assert.notEqual(categorizeItem('*Sås Tonfisk'), 'Pet Food');
    // human food words veto the heuristic
    assert.notEqual(categorizeItem('Fiskgratäng sås pasta', { price: 49 }), 'Pet Food');
  });

  test('Kattmjölk is Pet Food, not Dairy', () => {
    assert.equal(categorizeItem('Kattmjölk'), 'Pet Food');
  });

  test('human salmon fillet is not cat food',
    () => {
      assert.equal(categorizeItem('Laxfilet 4-pack', { price: 79.9 }), 'Meat & Protein');
    });

  test('isLikelyCatFood / isCatFood helpers', () => {
    assert.equal(isLikelyCatFood('Sås Tonfisk', 10), true);
    assert.equal(isLikelyCatFood('Sås Tonfisk', '10'), false);
    assert.equal(isLikelyCatFood('', 10), false);
    assert.equal(isCatFood('Felix'), true);
    assert.equal(isCatFood('Felix mjölk'), false);
    assert.equal(isCatFood(''), false);
  });
});

describe('categorizeItem: discounts and pant', () => {
  test('isDiscount wins over everything', () => {
    assert.equal(categorizeItem('BRÖD', { isDiscount: true }), 'Discounts & Offers');
    assert.equal(categorizeItem('Felix Kattmat', { isDiscount: true }), 'Discounts & Offers');
  });

  test('pant and bags', () => {
    expectCategories([
      ['PANT ENG PET >1L', 'Bags & Deposits'],
      ['Pant burk', 'Bags & Deposits'],
      ['Bärkasse', 'Bags & Deposits'],
      ['Plastpåse', 'Bags & Deposits'],
    ]);
  });
});

describe('categorizeReceiptItem', () => {
  test('uses name, unitPrice and isDiscount', () => {
    assert.equal(categorizeReceiptItem({ name: 'Sås Tonfisk', unitPrice: 12 }), 'Pet Food');
    assert.notEqual(categorizeReceiptItem({ name: 'Sås Tonfisk', unitPrice: 200 }), 'Pet Food');
    assert.equal(categorizeReceiptItem({ name: 'BRÖD', unitPrice: -6, isDiscount: true }), 'Discounts & Offers');
    assert.equal(categorizeReceiptItem({ name: 'Mellanmjölk', unitPrice: 14 }), 'Dairy');
  });
});

describe('CATEGORY_NAMES', () => {
  test('contains every value categorizeItem returns', () => {
    const samples = [
      ['Felix'], ['BRÖD', { isDiscount: true }], ['PANT BURK'], ['Choklad'], ['Glass vanilj'],
      ['Limpa'], ['Mjölk'], ['Bacon'], ['Ketchup'], ['Juice'], ['Banan'], ['Pasta'],
      ['Tandkräm'], ['Diskmedel'], ['T-shirt'], ['Xyzzy'], [''],
      ['Rostbiff'], ['Pris'], ['Tomater'], ['Sås Tonfisk', { price: 10 }],
    ];
    const seen = new Set(samples.map(([n, o]) => categorizeItem(n, o)));
    for (const c of seen) assert.ok(CATEGORY_NAMES.includes(c), c);
    // every named category is reachable by at least one sample
    for (const c of CATEGORY_NAMES) assert.ok(seen.has(c), `no sample for ${c}`);
  });

  test('no duplicates', () => {
    assert.equal(new Set(CATEGORY_NAMES).size, CATEGORY_NAMES.length);
  });
});
