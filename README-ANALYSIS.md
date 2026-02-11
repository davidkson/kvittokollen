# Willys Receipt Analysis System

A Node.js-based analysis pipeline that processes Swedish Willys grocery receipts (PDF format) to provide spending insights and shopping pattern analysis.

## Features

- **PDF Processing**: Extracts text from PDF receipts using pdf-parse
- **Smart Parsing**: Regex-based parsing of Swedish receipt formats
- **Automatic Categorization**: Classifies items into 12 spending categories
- **Spending Analysis**: Calculates totals, trends, and top items
- **Multiple Output Formats**: JSON, CSV, and Markdown reports

## Installation

```bash
npm install
```

## Usage

### Run the Analysis

```bash
npm run analyze
```

This will:
1. Process all PDF files in the `receipts/` directory
2. Extract and parse receipt data
3. Categorize items automatically
4. Generate spending analysis
5. Create reports in the `output/` directory

### Output Files

The analysis generates the following files in `output/`:

- **willys-analysis.json** - Complete structured data including all receipts, items, and analysis results
- **spending-report.md** - Human-readable Markdown report with insights and trends
- **category-spending.csv** - Category breakdown (total, percentage, item count, avg price)
- **items-all.csv** - All items from all receipts (receipt, date, item, category, price)
- **top-items.csv** - Most frequently purchased and highest spending items
- **error-log.json** - Parsing errors and warnings for troubleshooting

## Analysis Results

### Summary Statistics

Based on the most recent analysis of 152 receipts:

- **Total Spending**: 98,726 SEK (over 8 months)
- **Average Monthly Spending**: 7,573 SEK
- **Average Basket Size**: 649 SEK per receipt
- **Total Items Purchased**: 3,508 items
- **Average Item Price**: 28 SEK
- **Categorization Rate**: 77.9% of items automatically categorized

### Top Spending Categories

1. **Meat & Protein** - 21,399 SEK (21.7%)
2. **Uncategorized** - 20,628 SEK (20.9%)
3. **Dairy** - 15,131 SEK (15.3%)
4. **Fruit & Vegetables** - 12,849 SEK (13.0%)
5. **Beverages** - 11,281 SEK (11.4%)

### Most Frequently Purchased Items

1. SAUCELOVER TONF 85G (110 times)
2. Pappkasse Vit 22l (101 times)
3. PLASTKASSE VIT (80 times)
4. MELLANMJÖLK 1L (66 times)
5. HAVREDRYCK BARISTA (50 times)

## Project Structure

```
willys/
├── analyze-receipts.cjs        # Main orchestration script
├── lib/
│   ├── pdf-extractor.cjs       # PDF text extraction
│   ├── receipt-parser.cjs      # Receipt text parsing
│   ├── categorizer.cjs         # Item categorization
│   ├── analyzer.cjs            # Spending analysis
│   ├── report-generator.cjs    # Report generation
│   └── utils.cjs               # Utility functions
├── receipts/                   # PDF receipts (153 files)
├── output/                     # Generated reports
└── package.json
```

## How It Works

### 1. PDF Text Extraction
- Uses `pdf-parse` library to extract text from all PDF receipts
- Handles errors gracefully (1 failed PDF is acceptable)
- Progress tracking for large batches

### 2. Receipt Parsing
- Regex patterns extract item names, quantities, and prices
- Handles multiple Swedish receipt formats:
  - Simple items: `GURKA IMPORT 19,90`
  - Weight-based: `NÖTFÄRS 12% 0,899kg*149,00kr/kg 133,95`
  - Quantity-based: `MELLANMJÖLK 1L 2st*13,90 27,80`
  - Discounts: `Rabatt:BRÖD -6,00`
- Extracts metadata (store, date, total, payment method)
- Filters out non-item lines (headers, payment info, etc.)

### 3. Item Categorization
- Keyword-based matching for Swedish product names
- 12 categories: Meat & Protein, Dairy, Fruit & Vegetables, Beverages, Pantry Staples, Household, Bread & Bakery, Sauces & Condiments, Snacks & Candy, Frozen, Bags & Deposits, and Uncategorized
- Handles Swedish special characters (å, ä, ö)

### 4. Spending Analysis
- Calculates spending by category, item, and month
- Identifies top items by frequency and spending
- Analyzes monthly trends
- Compares store vs e-commerce shopping

### 5. Report Generation
- JSON for programmatic access
- CSV for spreadsheet analysis
- Markdown for human-readable insights

## Customization

### Adding New Categories

Edit `lib/categorizer.cjs` and add keywords to the `CATEGORIES` object:

```javascript
const CATEGORIES = {
  'Your Category': [
    'keyword1', 'keyword2', 'keyword3'
  ],
  // ...
};
```

### Improving Parsing

If certain receipt lines aren't being parsed correctly, update the regex patterns in `lib/receipt-parser.cjs`:

- `parseItemLine()` - Main item parsing logic
- `extractMetadata()` - Receipt metadata extraction

### Adjusting Output Format

Modify the report templates in `lib/report-generator.cjs`:

- `generateMarkdownReport()` - Customize Markdown report structure
- `generateCategoryCSV()` - Change CSV columns
- `generateJSON()` - Adjust JSON data structure

## Troubleshooting

### Low Categorization Rate
If many items are "Uncategorized", check the uncategorized items list in `spending-report.md` and add relevant Swedish keywords to the categorizer.

### Incorrect Parsing
Review `error-log.json` for parsing warnings. Some receipts may have unusual formats that need special handling in the parser.

### Missing Items
If expected items don't appear in the analysis, they may be filtered as metadata. Check the skip patterns in `parseItemLine()`.

## Future Enhancements

Potential improvements:

- Machine learning-based categorization
- Budget tracking and alerts
- Price history and trend analysis
- Item-level price comparison
- Nutritional category grouping
- Interactive web dashboard
- Receipt photo/scan support

## License

MIT
