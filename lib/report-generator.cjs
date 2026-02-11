/**
 * Report generator
 * Creates JSON, CSV, and Markdown outputs from analysis data
 */

const fs = require('fs').promises;
const path = require('path');
const { formatSEK, formatPercent } = require('./utils.cjs');

/**
 * Generate complete JSON data file
 */
async function generateJSON(categorizedReceipts, analysis, outputDir) {
  const data = {
    metadata: {
      generatedAt: new Date().toISOString(),
      totalReceipts: categorizedReceipts.length,
      ...analysis.summary
    },
    receipts: categorizedReceipts,
    analysis
  };

  const outputPath = path.join(outputDir, 'willys-analysis.json');
  await fs.writeFile(outputPath, JSON.stringify(data, null, 2), 'utf8');

  return outputPath;
}

/**
 * Generate category spending CSV
 */
async function generateCategoryCSV(analysis, outputDir) {
  const rows = [
    ['Category', 'Total (SEK)', 'Percentage', 'Item Count', 'Average Price (SEK)']
  ];

  for (const cat of analysis.categorySpending.categories) {
    rows.push([
      cat.category,
      cat.total.toFixed(2),
      cat.percentage.toFixed(2),
      cat.itemCount,
      cat.averagePrice.toFixed(2)
    ]);
  }

  const csv = rows.map(row => row.join(',')).join('\n');
  const outputPath = path.join(outputDir, 'category-spending.csv');
  await fs.writeFile(outputPath, csv, 'utf8');

  return outputPath;
}

/**
 * Generate all items CSV
 */
async function generateAllItemsCSV(categorizedReceipts, outputDir) {
  const rows = [
    ['Receipt', 'Date', 'Item', 'Category', 'Quantity', 'Unit Price (SEK)', 'Total Price (SEK)']
  ];

  for (const receipt of categorizedReceipts) {
    const date = receipt.metadata.date
      ? receipt.metadata.date.toISOString().split('T')[0]
      : 'Unknown';

    for (const item of receipt.items) {
      rows.push([
        receipt.filename,
        date,
        item.name,
        item.category,
        item.quantity || 1,
        (item.unitPrice || 0).toFixed(2),
        (item.totalPrice || 0).toFixed(2)
      ]);
    }
  }

  const csv = rows.map(row => row.map(cell => {
    // Escape commas and quotes in cell values
    const cellStr = String(cell);
    if (cellStr.includes(',') || cellStr.includes('"')) {
      return `"${cellStr.replace(/"/g, '""')}"`;
    }
    return cellStr;
  }).join(',')).join('\n');

  const outputPath = path.join(outputDir, 'items-all.csv');
  await fs.writeFile(outputPath, csv, 'utf8');

  return outputPath;
}

/**
 * Generate top items CSV
 */
async function generateTopItemsCSV(analysis, outputDir) {
  const rows = [
    ['Item', 'Total Quantity', 'Total Spending (SEK)', 'Average Price (SEK)']
  ];

  for (const item of analysis.topItems.topByFrequency.slice(0, 30)) {
    rows.push([
      item.name,
      item.totalQuantity,
      item.totalSpending.toFixed(2),
      item.averagePrice.toFixed(2)
    ]);
  }

  const csv = rows.map(row => row.map(cell => {
    const cellStr = String(cell);
    if (cellStr.includes(',') || cellStr.includes('"')) {
      return `"${cellStr.replace(/"/g, '""')}"`;
    }
    return cellStr;
  }).join(',')).join('\n');

  const outputPath = path.join(outputDir, 'top-items.csv');
  await fs.writeFile(outputPath, csv, 'utf8');

  return outputPath;
}

/**
 * Generate Markdown report
 */
async function generateMarkdownReport(categorizedReceipts, analysis, uncategorizedItems, outputDir) {
  let md = '# Willys Receipt Analysis Report\n\n';
  md += `**Generated:** ${new Date().toLocaleString('sv-SE')}\n\n`;

  // Executive Summary
  md += '## Executive Summary\n\n';
  md += `- **Total Receipts Analyzed:** ${analysis.summary.totalReceipts}\n`;
  md += `- **Total Spending:** ${formatSEK(analysis.summary.totalSpending)}\n`;
  md += `- **Total Items Purchased:** ${analysis.summary.totalItems}\n`;
  md += `- **Average Basket Size:** ${formatSEK(analysis.summary.averageBasket)}\n`;
  md += `- **Average Item Price:** ${formatSEK(analysis.summary.totalSpending / analysis.summary.totalItems)}\n\n`;

  // Store vs E-commerce
  md += '## Store vs E-commerce\n\n';
  md += '| Channel | Receipts | Total Spending | Average Basket |\n';
  md += '|---------|----------|----------------|----------------|\n';
  md += `| In-Store | ${analysis.storeStats.store.receiptCount} | ${formatSEK(analysis.storeStats.store.totalSpending)} | ${formatSEK(analysis.storeStats.store.averageBasket)} |\n`;
  md += `| E-commerce | ${analysis.storeStats.ecommerce.receiptCount} | ${formatSEK(analysis.storeStats.ecommerce.totalSpending)} | ${formatSEK(analysis.storeStats.ecommerce.averageBasket)} |\n\n`;

  // Spending by Category
  md += '## Spending by Category\n\n';
  md += '| Category | Total | Percentage | Items | Avg Price |\n';
  md += '|----------|-------|------------|-------|----------|\n';

  for (const cat of analysis.categorySpending.categories) {
    md += `| ${cat.category} | ${formatSEK(cat.total)} | ${formatPercent(cat.percentage)} | ${cat.itemCount} | ${formatSEK(cat.averagePrice)} |\n`;
  }
  md += '\n';

  // Top Items by Frequency
  md += '## Top 20 Items by Purchase Frequency\n\n';
  md += '| Rank | Item | Times Purchased | Total Spent | Avg Price |\n';
  md += '|------|------|-----------------|-------------|----------|\n';

  analysis.topItems.topByFrequency.slice(0, 20).forEach((item, idx) => {
    md += `| ${idx + 1} | ${item.name} | ${item.totalQuantity} | ${formatSEK(item.totalSpending)} | ${formatSEK(item.averagePrice)} |\n`;
  });
  md += '\n';

  // Top Items by Spending
  md += '## Top 20 Items by Total Spending\n\n';
  md += '| Rank | Item | Total Spent | Times Purchased | Avg Price |\n';
  md += '|------|------|-------------|-----------------|----------|\n';

  analysis.topItems.topBySpending.slice(0, 20).forEach((item, idx) => {
    md += `| ${idx + 1} | ${item.name} | ${formatSEK(item.totalSpending)} | ${item.totalQuantity} | ${formatSEK(item.averagePrice)} |\n`;
  });
  md += '\n';

  // Monthly Trends
  md += '## Monthly Spending Trends\n\n';
  md += '| Month | Receipts | Total Spending | Avg Basket | Items | Avg Item Price |\n';
  md += '|-------|----------|----------------|------------|-------|-----------------|\n';

  for (const month of analysis.monthlyTrends) {
    md += `| ${month.month} | ${month.receiptCount} | ${formatSEK(month.totalSpending)} | ${formatSEK(month.averageBasket)} | ${month.itemCount} | ${formatSEK(month.averageItemPrice)} |\n`;
  }
  md += '\n';

  // Uncategorized Items
  if (uncategorizedItems.length > 0) {
    md += '## Uncategorized Items\n\n';
    md += `Found ${uncategorizedItems.length} unique items that could not be categorized. Consider adding keywords for these items:\n\n`;
    uncategorizedItems.slice(0, 50).forEach(item => {
      md += `- ${item}\n`;
    });
    if (uncategorizedItems.length > 50) {
      md += `\n... and ${uncategorizedItems.length - 50} more.\n`;
    }
    md += '\n';
  }

  // Insights
  md += '## Key Insights\n\n';

  const topCategory = analysis.categorySpending.categories[0];
  md += `- **Highest spending category:** ${topCategory.category} (${formatSEK(topCategory.total)}, ${formatPercent(topCategory.percentage)} of total)\n`;

  const topItem = analysis.topItems.topByFrequency[0];
  md += `- **Most frequently purchased item:** ${topItem.name} (${topItem.totalQuantity} times)\n`;

  const expensiveItem = analysis.topItems.topBySpending[0];
  md += `- **Highest spending on single item:** ${expensiveItem.name} (${formatSEK(expensiveItem.totalSpending)} total)\n`;

  if (analysis.monthlyTrends.length > 0) {
    const avgMonthlySpending = analysis.monthlyTrends.reduce((sum, m) => sum + m.totalSpending, 0) / analysis.monthlyTrends.length;
    md += `- **Average monthly spending:** ${formatSEK(avgMonthlySpending)}\n`;
  }

  const outputPath = path.join(outputDir, 'spending-report.md');
  await fs.writeFile(outputPath, md, 'utf8');

  return outputPath;
}

/**
 * Generate error log
 */
async function generateErrorLog(errors, warnings, outputDir) {
  const errorData = {
    generatedAt: new Date().toISOString(),
    extractionErrors: errors,
    parsingWarnings: warnings
  };

  const outputPath = path.join(outputDir, 'error-log.json');
  await fs.writeFile(outputPath, JSON.stringify(errorData, null, 2), 'utf8');

  return outputPath;
}

/**
 * Generate all reports
 */
async function generateAllReports(categorizedReceipts, analysis, uncategorizedItems, errors, warnings, outputDir) {
  console.log('Generating reports...');

  // Ensure output directory exists
  await fs.mkdir(outputDir, { recursive: true });

  const files = await Promise.all([
    generateJSON(categorizedReceipts, analysis, outputDir),
    generateCategoryCSV(analysis, outputDir),
    generateAllItemsCSV(categorizedReceipts, outputDir),
    generateTopItemsCSV(analysis, outputDir),
    generateMarkdownReport(categorizedReceipts, analysis, uncategorizedItems, outputDir),
    generateErrorLog(errors, warnings, outputDir)
  ]);

  console.log('✓ Generated reports:');
  files.forEach(file => console.log(`  - ${path.basename(file)}`));

  return files;
}

module.exports = {
  generateAllReports
};
