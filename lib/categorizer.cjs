/**
 * Item categorizer for Swedish grocery items (Willys + ICA).
 *
 * One shared category set for both stores. Keywords are regex fragments, not
 * plain substrings, so short words don't match inside unrelated words
 * ("ost" in "rostbiff", "te" in "tomater", "ris" in "pris").
 *
 * Helpers (Unicode-aware, since \b does not treat å/ä/ö as letters):
 *   word('ost')  - whole word only            "Ost 28%"
 *   end('ost')   - word ending, for compounds "färskost", "prästost"
 *   start('ris') - word beginning             "risgrynsgröt"
 *   anything else is matched anywhere in the name.
 *
 * Order matters: the first category with a match wins. Specific things
 * (pet food, deposits, candy) are checked before broad ones (dairy, meat).
 */

const L = '\\p{L}';
const word = s => `(?<!${L})(?:${s})(?!${L})`;
const start = s => `(?<!${L})(?:${s})`;
const end = s => `(?:${s})(?!${L})`;
const edge = s => `${start(s)}|${end(s)}`;

// --- Pet food --------------------------------------------------------------

// Brand names. "gourmet" only as its own word so "gourmetskinka" stays meat.
const CAT_FOOD_PATTERN = new RegExp(
  ['kattmat', 'felix', 'whiskas', 'sheba', word('gourmet'), 'dreamies',
    'perfect fit', 'catessy', `${start('whis')}(?!ky)`, 'kattstick', 'kattsnacks', 'kattsand']
    .join('|'),
  'iu'
);

/**
 * ICA uses generic names for cat food ("*Sås Tonfisk", "Filet Kyck Tonfisk").
 * Heuristic from CLAUDE.md: fish + texture word + low price.
 */
function isLikelyCatFood(name, price) {
  if (!name) return false;
  if (/bröd|ost|yoghurt|korv|hamburgare|pizza|soppa|grädde|smör|sallad|pasta|ris/i.test(name)) {
    return false;
  }
  const hasFish = /tonfisk|lax|fisk/i.test(name);
  // Texture must be its own word ("Filet Kyck Tonfisk", "*Sås Tonfisk"),
  // so human food like "Laxfilet" or "Tonfisksås" is not counted.
  const hasTexture = /(?<!\p{L})(?:sås|mousse|filet|paté|gelé)(?!\p{L})/iu.test(name);
  const lowPrice = typeof price === 'number' && price < 100;
  return hasFish && hasTexture && lowPrice;
}

function isCatFood(name, price) {
  if (!name) return false;
  if (/mjölk/i.test(name)) return false;
  return CAT_FOOD_PATTERN.test(name) || isLikelyCatFood(name, price);
}

// --- Category keyword table (checked in order) -----------------------------

const CATEGORY_RULES = [
  ['Bags & Deposits', [
    start('pant'), 'kasse', end('påse'), word('påsar'),
  ]],

  ['Snacks & Candy', [
    'choklad', 'godis', 'chips', 'popcorn', 'nötter', 'jordnöt', 'cashew',
    'kex', 'cookie', 'snacks', 'daim', 'marabou', 'helnöt', 'lakrits',
    'ostbåg', 'tuggummi', 'pastill', 'karamell', 'gelé', 'snickers',
    'twix', word('mars'), 'bounty', 'kexchoklad', 'dumle', 'polly',
  ]],

  ['Frozen', [
    'fryst', 'frysta', 'frozen', start('glass'), end('glass'),
    end('pizza'), 'lasagne', 'fiskpinn', 'pommes',
  ]],

  ['Bread & Bakery', [
    'bröd', 'limpa', 'fralla', 'frallor', 'baguette', end('kaka'), end('kakor'),
    start('bulle'), end('bulle'), end('bullar'), 'tortilla', 'bagel', 'wraps',
    'knäcke', 'croissant', 'tårta', 'muffin', 'kanelbulle',
  ]],

  ['Dairy', [
    'mjölk', 'yoghurt', 'yogurt', word('fil'), end('fil'), start('ost'), `(?<!r)${end('ost')}`,
    'smör(?!gås)', 'bregott', 'margarin', 'grädd', 'crème fraîche',
    'creme fraiche', 'fraiche', 'keso', 'kvarg', 'mozzarella', 'cheddar',
    'parmesan', 'feta', 'halloumi', 'cream cheese', 'kesella', 'turkisk',
  ]],

  ['Meat & Protein', [
    'nötfärs', 'köttfärs', 'blandfärs', 'kött', 'kyckl', 'fläsk', 'bacon',
    'korv', 'skinka', 'fisk', edge('lax'), 'räkor', 'räka', edge('ägg'),
    'omelett', 'filé', 'filet', 'kalkon', 'salami', 'medaljong', 'biff',
    'entrecote', 'karré', 'kassler', 'chorizo', 'pulled', 'torsk', start('sej'),
    'tofu', 'quorn', 'hamburgare', 'köttbullar',
  ]],

  ['Sauces & Condiments', [
    'sås', 'ketchup', 'senap', 'majonnäs', 'aioli', 'dressing', 'krydd',
    'taco', 'burrito', 'carbonara', 'pesto', 'salsa', end('dipp?'),
    'bbq', 'saucelover', 'sriracha', 'soja', 'vinäger', 'buljong', 'fond',
  ]],

  ['Beverages', [
    'cola', end('zero'), 'pepsi', 'fanta', 'sprite', 'juice', 'läsk',
    'vatten(?!melon)', 'kaffe(?!filter)', word('te'), 'thé', 'energidryck',
    'red ?bull', 'monster', 'dryck', 'milkshake', 'smoothie', 'barista',
    'mountain', 'blast', 'koffeinfri', 'saft', word('öl'), `(?<!mj)${end('öl')}`,
    word('vin'), 'sprit', 'cider', 'loka', 'ramlösa', 'festis', 'trocadero',
  ]],

  ['Fruit & Vegetables', [
    'gurka', '(?<!krossade |passerade )tomat(?!puré)', 'sallad', 'paprika', 'lök', 'morot', 'morötter',
    'potatis', 'banan', 'äpple', 'frukt', 'grönsak', 'avokado', 'citron',
    start('lime'), 'spenat', 'broccoli', 'blomkål', 'vitkål', 'champinjon',
    'svamp(?!duk)', end('bär'), 'hallon', 'jordgubb', 'päron', 'apelsin', 'clementin',
    'mandarin', 'vindruv', 'druvor', 'mango', 'melon', 'ananas', 'kiwi',
    'zucchini', 'squash', 'sparris', 'majs', 'ingefära', 'rucola', 'selleri',
    'rödbet', 'sötpotatis', 'aubergine', 'chili',
  ]],

  ['Pantry Staples', [
    'pasta', 'spagetti', 'spaghetti', 'makaroner', 'penne', 'fusilli',
    start('ris'), `(?<!p)${end('ris')}`, 'mjöl(?!k)', 'socker', edge('salt'), 'olja',
    'konserv', 'bönor', 'beans', 'linser', 'kikärt', 'quinoa', 'bulgur',
    'couscous', 'nudlar', 'ramen', 'havregryn', 'müsli', 'musli', 'flingor',
    'gryn', 'russin', 'vanilj', 'jäst', 'bakpulver', 'honung', 'sylt',
    'krossade', 'passerade', 'tomatpuré',
  ]],

  ['Personal Care', [
    'dusch', 'schampo', 'shampoo', 'balsam(?!vin|ico)', 'tvål', 'tandkräm',
    'tandborst', start('deo'), 'rakhyvel', 'rakblad', 'blöjor', 'våtservett',
    'bomullspinn', 'tampong', 'binda', 'bindor', 'hudkräm', 'solskydd',
  ]],

  ['Household', [
    'papper', start('disk'), 'tvätt', 'rengöring', word('wc'), 'hushåll',
    'servetter', 'kaffefilter', 'folie', 'plastfolie', 'batteri', 'lampa',
    'sopsäck', 'svamp(?=duk)', 'trasa', 'ljus(?!t)', 'tändstick',
  ]],

  ['Clothing', [
    't-shirt', 'tröja', 'byxor', 'klänning', 'kläder', 'strumpor', 'kalsong',
  ]],
];

const COMPILED_RULES = CATEGORY_RULES.map(([category, patterns]) => [
  category,
  new RegExp(patterns.join('|'), 'iu'),
]);

const CATEGORY_NAMES = [
  'Pet Food',
  'Discounts & Offers',
  ...CATEGORY_RULES.map(([category]) => category),
  'Uncategorized',
];

/**
 * Categorize a single item.
 *
 * @param {string} itemName
 * @param {object} [opts]
 * @param {number} [opts.price]      unit price, used for the ICA cat food heuristic
 * @param {boolean} [opts.isDiscount] discount rows get their own category
 * @returns {string} one of CATEGORY_NAMES
 */
function categorizeItem(itemName, opts = {}) {
  if (!itemName) return 'Uncategorized';

  if (opts.isDiscount) return 'Discounts & Offers';
  if (isCatFood(itemName, opts.price) || /katt/i.test(itemName)) return 'Pet Food';

  for (const [category, regex] of COMPILED_RULES) {
    if (regex.test(itemName)) return category;
  }

  return 'Uncategorized';
}

/** Categorize an item object as stored in the analysis JSON. */
function categorizeReceiptItem(item) {
  return categorizeItem(item.name, {
    price: item.unitPrice,
    isDiscount: Boolean(item.isDiscount),
  });
}

/**
 * Categorize all items in all receipts
 */
function categorizeAllItems(parsedReceipts) {
  console.log('Categorizing items...');

  const categorized = parsedReceipts.map(receipt => ({
    ...receipt,
    items: receipt.items.map(item => ({ ...item, category: categorizeReceiptItem(item) })),
  }));

  let totalItems = 0;
  let categorizedCount = 0;
  for (const receipt of categorized) {
    for (const item of receipt.items) {
      totalItems++;
      if (item.category !== 'Uncategorized') categorizedCount++;
    }
  }

  const rate = totalItems > 0 ? (categorizedCount / totalItems * 100) : 0;
  console.log(`✓ Categorized ${categorizedCount}/${totalItems} items (${rate.toFixed(1)}%)`);

  return categorized;
}

/**
 * Get all unique uncategorized items for review
 */
function getUncategorizedItems(categorizedReceipts) {
  const uncategorizedSet = new Set();
  for (const receipt of categorizedReceipts) {
    for (const item of receipt.items) {
      if (item.category === 'Uncategorized') uncategorizedSet.add(item.name);
    }
  }
  return Array.from(uncategorizedSet).sort();
}

module.exports = {
  categorizeItem,
  categorizeReceiptItem,
  categorizeAllItems,
  getUncategorizedItems,
  isCatFood,
  isLikelyCatFood,
  CAT_FOOD_PATTERN,
  CATEGORY_NAMES,
};
