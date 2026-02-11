/**
 * Spending analyzer
 * Calculates totals, trends, and insights from categorized receipts
 */

const { getMonthKey } = require('./utils.cjs');

/**
 * Calculate spending by category
 */
function calculateCategorySpending(categorizedReceipts) {
  const categoryTotals = {};
  const categoryItemCounts = {};

  for (const receipt of categorizedReceipts) {
    for (const item of receipt.items) {
      const category = item.category;
      const price = item.totalPrice || 0;

      if (!categoryTotals[category]) {
        categoryTotals[category] = 0;
        categoryItemCounts[category] = 0;
      }

      categoryTotals[category] += price;
      categoryItemCounts[category]++;
    }
  }

  // Calculate total spending
  const totalSpending = Object.values(categoryTotals).reduce((sum, val) => sum + val, 0);

  // Build category stats array
  const categoryStats = Object.keys(categoryTotals).map(category => ({
    category,
    total: categoryTotals[category],
    percentage: totalSpending > 0 ? (categoryTotals[category] / totalSpending * 100) : 0,
    itemCount: categoryItemCounts[category],
    averagePrice: categoryItemCounts[category] > 0
      ? categoryTotals[category] / categoryItemCounts[category]
      : 0
  }));

  // Sort by total spending (descending)
  categoryStats.sort((a, b) => b.total - a.total);

  return {
    categories: categoryStats,
    totalSpending,
    totalItems: Object.values(categoryItemCounts).reduce((sum, val) => sum + val, 0)
  };
}

/**
 * Find most frequently purchased items
 */
function calculateTopItems(categorizedReceipts) {
  const itemFrequency = {};
  const itemSpending = {};

  for (const receipt of categorizedReceipts) {
    for (const item of receipt.items) {
      const name = item.name;
      const qty = item.quantity || 1;
      const price = item.totalPrice || 0;

      if (!itemFrequency[name]) {
        itemFrequency[name] = 0;
        itemSpending[name] = 0;
      }

      itemFrequency[name] += qty;
      itemSpending[name] += price;
    }
  }

  // Top by frequency
  const topByFrequency = Object.keys(itemFrequency)
    .map(name => ({
      name,
      totalQuantity: itemFrequency[name],
      totalSpending: itemSpending[name],
      averagePrice: itemSpending[name] / itemFrequency[name]
    }))
    .sort((a, b) => b.totalQuantity - a.totalQuantity)
    .slice(0, 20);

  // Top by spending
  const topBySpending = Object.keys(itemSpending)
    .map(name => ({
      name,
      totalSpending: itemSpending[name],
      totalQuantity: itemFrequency[name],
      averagePrice: itemSpending[name] / itemFrequency[name]
    }))
    .sort((a, b) => b.totalSpending - a.totalSpending)
    .slice(0, 20);

  return {
    topByFrequency,
    topBySpending
  };
}

/**
 * Calculate monthly spending trends
 */
function calculateMonthlyTrends(categorizedReceipts) {
  const monthlyData = {};

  for (const receipt of categorizedReceipts) {
    const date = receipt.metadata.date;
    if (!date) continue;

    const monthKey = getMonthKey(date);
    if (!monthlyData[monthKey]) {
      monthlyData[monthKey] = {
        month: monthKey,
        totalSpending: 0,
        receiptCount: 0,
        itemCount: 0
      };
    }

    const receiptTotal = receipt.items.reduce((sum, item) => sum + (item.totalPrice || 0), 0);
    monthlyData[monthKey].totalSpending += receiptTotal;
    monthlyData[monthKey].receiptCount++;
    monthlyData[monthKey].itemCount += receipt.items.length;
  }

  // Convert to array and sort by month
  const monthlyTrends = Object.values(monthlyData)
    .map(month => ({
      ...month,
      averageBasket: month.receiptCount > 0 ? month.totalSpending / month.receiptCount : 0,
      averageItemPrice: month.itemCount > 0 ? month.totalSpending / month.itemCount : 0
    }))
    .sort((a, b) => a.month.localeCompare(b.month));

  return monthlyTrends;
}

/**
 * Calculate store vs e-commerce stats
 */
function calculateStoreStats(categorizedReceipts) {
  let storeReceipts = 0;
  let ecommerceReceipts = 0;
  let storeSpending = 0;
  let ecommerceSpending = 0;

  for (const receipt of categorizedReceipts) {
    const total = receipt.items.reduce((sum, item) => sum + (item.totalPrice || 0), 0);

    if (receipt.metadata.isEcommerce) {
      ecommerceReceipts++;
      ecommerceSpending += total;
    } else {
      storeReceipts++;
      storeSpending += total;
    }
  }

  return {
    store: {
      receiptCount: storeReceipts,
      totalSpending: storeSpending,
      averageBasket: storeReceipts > 0 ? storeSpending / storeReceipts : 0
    },
    ecommerce: {
      receiptCount: ecommerceReceipts,
      totalSpending: ecommerceSpending,
      averageBasket: ecommerceReceipts > 0 ? ecommerceSpending / ecommerceReceipts : 0
    }
  };
}

/**
 * Run complete analysis
 */
function analyzeReceipts(categorizedReceipts) {
  console.log('Analyzing spending patterns...');

  const categorySpending = calculateCategorySpending(categorizedReceipts);
  const topItems = calculateTopItems(categorizedReceipts);
  const monthlyTrends = calculateMonthlyTrends(categorizedReceipts);
  const storeStats = calculateStoreStats(categorizedReceipts);

  console.log('✓ Analysis complete');

  return {
    categorySpending,
    topItems,
    monthlyTrends,
    storeStats,
    summary: {
      totalReceipts: categorizedReceipts.length,
      totalSpending: categorySpending.totalSpending,
      totalItems: categorySpending.totalItems,
      averageBasket: categorizedReceipts.length > 0
        ? categorySpending.totalSpending / categorizedReceipts.length
        : 0
    }
  };
}

module.exports = {
  analyzeReceipts,
  calculateCategorySpending,
  calculateTopItems,
  calculateMonthlyTrends,
  calculateStoreStats
};
