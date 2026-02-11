/**
 * PDF text extraction module
 * Batch processes all receipt PDFs and extracts text content
 */

const fs = require('fs').promises;
const path = require('path');
const { PDFParse } = require('pdf-parse');

/**
 * Extract text from a single PDF file
 */
async function extractPdfText(filePath) {
  try {
    const dataBuffer = await fs.readFile(filePath);
    const uint8Array = new Uint8Array(dataBuffer);
    const parser = new PDFParse(uint8Array);
    await parser.load();
    const result = await parser.getText();
    await parser.destroy();
    return {
      success: true,
      text: result.text,
      pages: result.total,
      filePath
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      filePath
    };
  }
}

/**
 * Extract text from all PDFs in a directory
 */
async function extractAllReceipts(receiptsDir) {
  const results = [];
  const errors = [];

  try {
    const files = await fs.readdir(receiptsDir);
    const pdfFiles = files.filter(f => f.toLowerCase().endsWith('.pdf'));

    console.log(`Found ${pdfFiles.length} PDF files to process...`);

    let processed = 0;
    for (const file of pdfFiles) {
      const filePath = path.join(receiptsDir, file);
      const result = await extractPdfText(filePath);

      if (result.success) {
        results.push({
          filename: file,
          text: result.text,
          pages: result.pages
        });
      } else {
        errors.push({
          filename: file,
          error: result.error
        });
      }

      processed++;
      if (processed % 10 === 0) {
        console.log(`  Processed ${processed}/${pdfFiles.length} PDFs...`);
      }
    }

    console.log(`✓ Successfully extracted ${results.length} receipts`);
    if (errors.length > 0) {
      console.log(`✗ Failed to extract ${errors.length} receipts`);
      if (errors.length > 0 && errors.length <= 3) {
        console.log('Sample errors:');
        errors.slice(0, 3).forEach(err => {
          console.log(`  ${err.filename}: ${err.error}`);
        });
      }
    }

    return { results, errors };

  } catch (error) {
    throw new Error(`Failed to read receipts directory: ${error.message}`);
  }
}

module.exports = {
  extractPdfText,
  extractAllReceipts
};
