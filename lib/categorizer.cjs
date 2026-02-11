/**
 * Item categorizer for Swedish grocery items
 * Uses keyword matching to classify items into spending categories
 */

// Category definitions with Swedish keywords
const CATEGORIES = {
  'Meat & Protein': [
    'nötfärs', 'köttfärs', 'kött', 'kyckling', 'fläsk', 'bacon',
    'korv', 'skinka', 'fisk', 'lax', 'räkor', 'ägg', 'omelett',
    'filet', 'kyckl', 'tonf', 'tonfisk', 'falukorv', 'grillkorv',
    'gourmetskinka', 'kalkon', 'rökt', 'salami', 'skivad'
  ],

  'Dairy': [
    'mjölk', 'ost', 'yoghurt', 'fil', 'smör', 'margarin',
    'grädde', 'crème fraîche', 'fraiche', 'keso', 'kvarg',
    'mellanmjölk', 'mozzarella', 'cheddar', 'parmesan', 'fetaost',
    'cream cheese', 'halloumi'
  ],

  'Fruit & Vegetables': [
    'gurka', 'tomat', 'sallad', 'paprika', 'lök', 'vitlök',
    'morot', 'potatis', 'banan', 'äpple', 'frukt', 'grönsak',
    'avokado', 'citron', 'lime', 'spenat', 'broccoli', 'blomkål',
    'champinjon', 'svamp', 'bär', 'blåbär', 'hallon', 'jordgubb',
    'salladsbaren', 'isbergssallad', 'körsbärstomat', 'cocktailtomat'
  ],

  'Bread & Bakery': [
    'bröd', 'limpa', 'fralla', 'baguette', 'kaka', 'bulle',
    'skärgårdskaka', 'tunnbröd', 'tortilla', 'bagel', 'wraps'
  ],

  'Pantry Staples': [
    'pasta', 'spagetti', 'makaroner', 'ris', 'risoni',
    'mjöl', 'socker', 'salt', 'olja', 'majs', 'konserv',
    'beans', 'bönor', 'linser', 'quinoa', 'bulgur',
    'nudlar', 'snabbnudlar', 'ramen'
  ],

  'Sauces & Condiments': [
    'sås', 'ketchup', 'senap', 'majonnäs', 'aioli', 'dressing',
    'krydda', 'taco', 'burrito', 'carbonara', 'pesto',
    'kebabsås', 'dip', 'cheddar dip', 'chilisås', 'bbq',
    'saucelover'
  ],

  'Beverages': [
    'cola', 'zero', 'pepsi', 'fanta', 'sprite', 'juice',
    'läsk', 'vatten', 'kaffe', 'te', 'energidryck', 'redbull',
    'dryck', 'milkshake', 'smoothie', 'läskedryck', 'havredryck',
    'barista', 'mountain', 'blast', 'koffeinfri', 'pärondryck',
    'fruktdryck'
  ],

  'Snacks & Candy': [
    'choklad', 'godis', 'chips', 'popcorn', 'nötter',
    'kex', 'cookies', 'snacks', 'daim', 'marabou'
  ],

  'Frozen': [
    'fryst', 'glass', 'frozen', 'pizza', 'lasagne', 'frysta'
  ],

  'Household': [
    'dusch', 'schampo', 'tvål', 'tandkräm', 'papper',
    'disk', 'tvätt', 'rengöring', 'blöjor', 'wc',
    'dubbeldusch', 'toalettpapper', 'hushåll', 'våtservetter',
    'baby', 'servetter'
  ],

  'Bags & Deposits': [
    'kasse', 'pappkasse', 'plastkasse', 'pant'
  ]
};

/**
 * Categorize a single item based on its name
 */
function categorizeItem(itemName) {
  if (!itemName) return 'Uncategorized';

  const nameLower = itemName.toLowerCase();

  // Check each category's keywords
  for (const [category, keywords] of Object.entries(CATEGORIES)) {
    for (const keyword of keywords) {
      if (nameLower.includes(keyword)) {
        return category;
      }
    }
  }

  return 'Uncategorized';
}

/**
 * Categorize all items in all receipts
 */
function categorizeAllItems(parsedReceipts) {
  console.log('Categorizing items...');

  const categorized = parsedReceipts.map(receipt => {
    const categorizedItems = receipt.items.map(item => ({
      ...item,
      category: categorizeItem(item.name)
    }));

    return {
      ...receipt,
      items: categorizedItems
    };
  });

  // Calculate categorization stats
  let totalItems = 0;
  let categorizedCount = 0;

  for (const receipt of categorized) {
    for (const item of receipt.items) {
      totalItems++;
      if (item.category !== 'Uncategorized') {
        categorizedCount++;
      }
    }
  }

  const categorizationRate = totalItems > 0 ? (categorizedCount / totalItems * 100) : 0;
  console.log(`✓ Categorized ${categorizedCount}/${totalItems} items (${categorizationRate.toFixed(1)}%)`);

  return categorized;
}

/**
 * Get all unique uncategorized items for review
 */
function getUncategorizedItems(categorizedReceipts) {
  const uncategorizedSet = new Set();

  for (const receipt of categorizedReceipts) {
    for (const item of receipt.items) {
      if (item.category === 'Uncategorized') {
        uncategorizedSet.add(item.name);
      }
    }
  }

  return Array.from(uncategorizedSet).sort();
}

module.exports = {
  categorizeItem,
  categorizeAllItems,
  getUncategorizedItems,
  CATEGORIES
};
