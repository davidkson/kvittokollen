import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

// Konfiguration
const CONFIG = {
  loginUrl: 'https://www.kivra.se',
  icaChainUrl: 'https://inbox.kivra.com/user/1369137751a3563ebccc425734bd7fcc2c50225a3a/chains/15765665678a499fdd66139b23016615a978111111',
  outputDir: './receipts/ica',
  outputFile: 'ica-receipts.json',
  lastFetchFile: './receipts/ica/.last-fetch-ica.json',
  headless: false,
  timeout: 30000,
  monthsToFetch: 12 // Antal månader tillbaka att hämta (används bara första gången)
};

// Globala variabler för att hålla koll på nedladdade kvitton
const downloadedUrls = new Set();
const allDownloadedReceipts = [];
let globalReceiptCounter = 1;

// Funktion för att läsa senaste hämtningsdatum
function getLastFetchDate() {
  try {
    if (fs.existsSync(CONFIG.lastFetchFile)) {
      const data = JSON.parse(fs.readFileSync(CONFIG.lastFetchFile, 'utf8'));
      console.log(`📅 Senaste hämtning: ${data.lastFetchDate}`);
      return new Date(data.lastFetchDate);
    }
  } catch (error) {
    console.log('⚠️  Kunde inte läsa senaste hämtningsdatum:', error.message);
  }
  return null;
}

// Funktion för att spara senaste hämtningsdatum
function saveLastFetchDate(date) {
  try {
    const data = {
      lastFetchDate: date.toISOString().split('T')[0],
      lastFetchTimestamp: new Date().toISOString()
    };
    fs.writeFileSync(CONFIG.lastFetchFile, JSON.stringify(data, null, 2), 'utf8');
    console.log(`💾 Sparade senaste hämtningsdatum: ${data.lastFetchDate}`);
  } catch (error) {
    console.log('⚠️  Kunde inte spara senaste hämtningsdatum:', error.message);
  }
}

// Funktion för att ladda befintliga kvitton (för att undvika duplikater)
function loadExistingReceipts() {
  const outputPath = path.join(CONFIG.outputDir, CONFIG.outputFile);
  if (fs.existsSync(outputPath)) {
    try {
      const data = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
      if (data.receipts && Array.isArray(data.receipts)) {
        data.receipts.forEach(receipt => {
          if (receipt.url) {
            downloadedUrls.add(receipt.url);
          }
          allDownloadedReceipts.push(receipt);
        });
        globalReceiptCounter = allDownloadedReceipts.length + 1;
        console.log(`📂 Laddade ${allDownloadedReceipts.length} befintliga kvitton`);
      }
    } catch (error) {
      console.log('⚠️  Kunde inte läsa befintliga kvitton:', error.message);
    }
  }
}

// Funktion för att vänta på och hantera BankID-autentisering
async function waitForBankIDAuth(page) {
  console.log('🔐 Väntar på BankID-autentisering...');
  console.log('   📱 Öppna BankID-appen på din telefon');
  console.log('   📷 Klicka på QR-ikonen och scanna QR-koden på skärmen');
  console.log('   ⏱️  Du har 5 minuter på dig');

  // Vänta tills vi är inloggade (URL ändras eller specifikt element dyker upp)
  try {
    await page.waitForFunction(
      () => {
        return window.location.href.includes('/mitt-kivra') ||
               window.location.href.includes('/inbox') ||
               window.location.href.includes('/user/') ||
               document.querySelector('[data-testid*="inbox"]') !== null;
      },
      { timeout: 300000 } // 5 minuters timeout för BankID
    );
    console.log('✅ BankID-autentisering lyckades!');
    return true;
  } catch (error) {
    console.log('❌ BankID-autentisering tog för lång tid eller misslyckades');
    return false;
  }
}

// Funktion för att klicka på "Visa fler" tills vi når februari 2025
async function loadMoreReceipts(page, stopDate = null) {
  const monthMap = {
    'januari': 1, 'februari': 2, 'mars': 3, 'april': 4,
    'maj': 5, 'juni': 6, 'juli': 7, 'augusti': 8,
    'september': 9, 'oktober': 10, 'november': 11, 'december': 12
  };

  // Om inget stopDate anges, använd 12 månader bakåt som standard
  if (!stopDate) {
    const today = new Date();
    stopDate = new Date(today);
    stopDate.setMonth(today.getMonth() - 12);
  }

  const stopStr = stopDate.toISOString().split('T')[0];
  console.log(`📜 Laddar kvitton till ${stopStr}...\n`);

  let clickCount = 0;
  const maxClicks = 50; // Säkerhetsgräns

  while (clickCount < maxClicks) {
    // Scrolla ner till botten
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(1500);

    // Kolla vilken månad den SISTA section visar (= äldsta laddade månad)
    const lastMonth = await page.evaluate(() => {
      const sections = document.querySelectorAll('section');
      if (sections.length === 0) return null;

      const lastSection = sections[sections.length - 1];
      const heading = lastSection.querySelector('h3');
      return heading ? heading.textContent.trim() : null;
    });

    if (lastMonth) {
      console.log(`   📅 Äldsta laddade månad: ${lastMonth}`);

      // Kolla om vi har nått stop-datumet
      const match = lastMonth.toLowerCase().match(/(januari|februari|mars|april|maj|juni|juli|augusti|september|oktober|november|december)\s+(\d{4})/);
      if (match) {
        const year = parseInt(match[2]);
        const monthName = match[1];
        const month = monthMap[monthName];

        // Jämför med stopDate
        const stopYear = stopDate.getFullYear();
        const stopMonth = stopDate.getMonth() + 1;

        // Stoppa om vi når eller passerar stop-datumet
        if (year < stopYear || (year === stopYear && month <= stopMonth)) {
          console.log(`   ✅ Nådde ${lastMonth} - slutar ladda fler`);
          break;
        }
      }
    }

    // Leta efter "Visa fler" knappen
    try {
      const showMoreButton = page.locator('button:has-text("Visa fler"), button:has-text("Show more"), button:has-text("Load more")').first();

      if (await showMoreButton.isVisible({ timeout: 3000 })) {
        console.log(`   🔽 Klickar på "Visa fler" (${clickCount + 1})...`);
        await showMoreButton.click();
        await page.waitForTimeout(2000); // Vänta på att innehållet laddas
        clickCount++;
      } else {
        console.log('   ✅ Ingen "Visa fler" knapp hittades');
        break;
      }
    } catch (error) {
      console.log('   ✅ Inga fler kvitton att ladda');
      break;
    }
  }

  console.log(`\n✅ Klickade ${clickCount} gånger på "Visa fler"\n`);

  // Scrolla långsamt tillbaka till toppen för att låta innehållet rendera
  await page.evaluate(() => {
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(3000); // Vänta längre på att innehållet ska rendera
}

// Global variabel för att spara vilken selector som fungerade
let workingSelector = null;

// Funktion för att extrahera datum från kvittotext + section månad/år
function extractDateFromText(text, sectionMonth) {
  const monthMap = {
    'januari': '01', 'februari': '02', 'mars': '03', 'april': '04',
    'maj': '05', 'juni': '06', 'juli': '07', 'augusti': '08',
    'september': '09', 'oktober': '10', 'november': '11', 'december': '12'
  };

  // Parse section månad/år (t.ex. "februari 2026")
  let sectionYear = null;
  let sectionMonthNum = null;

  if (sectionMonth) {
    const sectionMatch = sectionMonth.toLowerCase().match(/(januari|februari|mars|april|maj|juni|juli|augusti|september|oktober|november|december)\s+(\d{4})/);
    if (sectionMatch) {
      sectionMonthNum = monthMap[sectionMatch[1]];
      sectionYear = sectionMatch[2];
    }
  }

  // Försök hitta dag i texten: "7 Feb", "31 Jan", etc.
  const dayMatch = text.match(/(\d{1,2})\s+(Jan|Feb|Mar|Apr|Maj|Jun|Jul|Aug|Sep|Okt|Nov|Dec)/i);
  if (dayMatch && sectionYear && sectionMonthNum) {
    const day = dayMatch[1].padStart(2, '0');
    return `${sectionYear}-${sectionMonthNum}-${day}`;
  }

  // Fallback: försök hitta komplett datum i texten
  const fullDateMatch = text.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (fullDateMatch) {
    return `${fullDateMatch[1]}-${fullDateMatch[2]}-${fullDateMatch[3]}`;
  }

  return null;
}

// Funktion för att kolla om en månad är februari 2025 eller senare
function isWithinOneYear(monthText) {
  const monthMap = {
    'januari': 0, 'februari': 1, 'mars': 2, 'april': 3,
    'maj': 4, 'juni': 5, 'juli': 6, 'augusti': 7,
    'september': 8, 'oktober': 9, 'november': 10, 'december': 11
  };

  // Parse "februari 2026"
  const match = monthText.toLowerCase().match(/(januari|februari|mars|april|maj|juni|juli|augusti|september|oktober|november|december)\s+(\d{4})/);
  if (!match) return true; // Om vi inte kan avgöra, behåll kvittot

  const monthName = match[1];
  const year = parseInt(match[2]);
  const month = monthMap[monthName];

  const receiptDate = new Date(year, month, 1);
  const cutoffDate = new Date(2025, 1, 1); // Februari 2025 (månader är 0-indexerade)

  return receiptDate >= cutoffDate;
}

// Funktion för att hitta alla kvitto-rader i ICA-kedjan (per section/månad)
async function findICAReceiptRows(page) {
  console.log('🔍 Letar efter kvitto-rader från sections...');

  // Vänta på att innehållet laddas
  await page.waitForTimeout(3000);

  // Extrahera alla rader från sections
  const result = await page.evaluate(() => {
    const results = [];

    // Hitta alla sections (en per månad)
    const sections = document.querySelectorAll('section');
    console.log(`Hittade ${sections.length} sections`);

    sections.forEach((section, sectionIndex) => {
      // Hitta månadshuvud (h3)
      const heading = section.querySelector('h3');
      const monthText = heading ? heading.textContent.trim() : null;

      // Hitta alla li-element i denna section
      const listItems = section.querySelectorAll('ul li');

      console.log(`Section ${sectionIndex + 1}: "${monthText}" har ${listItems.length} kvitton`);

      listItems.forEach((li, liIndex) => {
        const text = li.textContent?.trim() || '';
        const link = li.querySelector('a');

        results.push({
          index: results.length,
          sectionIndex: sectionIndex,
          monthText: monthText,
          text: text,
          hasLink: !!link,
          element: li.outerHTML.substring(0, 200)
        });
      });
    });

    return { rows: results, selector: 'section ul li' };
  });

  // Filtrera bara kvitton från februari 2025 eller senare
  const filteredRows = result.rows.filter(row => {
    if (!row.monthText) return true; // Behåll om vi inte kan avgöra
    return isWithinOneYear(row.monthText);
  });

  workingSelector = result.selector;
  console.log(`✅ Hittade ${result.rows.length} totala rader`);
  console.log(`✅ Filtrerade till ${filteredRows.length} rader (februari 2025 eller senare)`);

  return filteredRows;
}

// Funktion för att ladda ner ett kvitto från en rad
async function downloadReceiptFromRow(page, rowIndex, rowData) {
  console.log(`\n📥 Kvitto ${globalReceiptCounter} (rad ${rowIndex + 1})`);

  // Extrahera datum från raden + section månad/år
  const dateFromRow = extractDateFromText(rowData.text, rowData.monthText);

  // Kolla om filen redan finns
  let fileName;
  if (dateFromRow) {
    fileName = `ica_${dateFromRow}.pdf`;
  } else {
    fileName = `ica_kvitto_${globalReceiptCounter}.pdf`;
  }

  const filePath = path.join(CONFIG.outputDir, fileName);
  if (fs.existsSync(filePath)) {
    console.log(`  ⏭️  Hoppar över (finns redan): ${fileName}`);
    return false;
  }

  try {
    // Hitta rätt rad baserat på section-strukturen
    const downloaded = await page.evaluate(async ({ idx }) => {
      // Hitta alla sections
      const sections = document.querySelectorAll('section');
      let allRows = [];

      // Samla alla li-element från alla sections
      sections.forEach(section => {
        const listItems = section.querySelectorAll('ul li');
        allRows.push(...Array.from(listItems));
      });

      if (idx >= allRows.length) {
        return { success: false, error: `Index utanför räckvidd (${idx} >= ${allRows.length})` };
      }

      const row = allRows[idx];

      // Leta efter meny-knapp eller tre-punkter-knapp
      const menuSelectors = [
        'button[aria-label*="meny"]',
        'button[aria-label*="Meny"]',
        'button[aria-label*="Mer"]',
        'button[class*="menu"]',
        '[role="button"][aria-haspopup="menu"]',
        'button:has([data-icon="ellipsis"])',
        'button:has(svg)'
      ];

      let menuButton = null;
      for (const selector of menuSelectors) {
        menuButton = row.querySelector(selector);
        if (menuButton) break;
      }

      if (!menuButton) {
        return { success: false, error: 'Ingen meny-knapp hittades' };
      }

      // Klicka på meny-knappen
      menuButton.click();

      return { success: true, menuClicked: true };
    }, { idx: rowIndex });

    if (!downloaded.success) {
      console.log(`  ⚠️  ${downloaded.error}`);
      return false;
    }

    if (downloaded.menuClicked) {
      console.log('  ✅ Öppnade menyn');
      await page.waitForTimeout(500);

      // Leta efter "Ladda ner" menyitem
      try {
        // Använd exakt selector för nedladdnings-menyitem
        const downloadOption = page.locator('li[role="menuitem"][data-component-type="menu-item"]:has-text("Ladda ner")').first();

        if (await downloadOption.isVisible({ timeout: 3000 })) {
          // Vänta på nedladdning
          const [download] = await Promise.all([
            page.waitForEvent('download', { timeout: 10000 }),
            downloadOption.click()
          ]);

          // Spara filen (fileName är redan definierat tidigare)
          await download.saveAs(filePath);

          console.log(`  ✅ Sparad: ${fileName}`);

          // Extrahera information om kvittot
          const receiptInfo = await page.evaluate(({ idx }) => {
            const sections = document.querySelectorAll('section');
            let allRows = [];
            sections.forEach(section => {
              const listItems = section.querySelectorAll('ul li');
              allRows.push(...Array.from(listItems));
            });
            if (idx < allRows.length) {
              return { text: allRows[idx].textContent?.trim() || '' };
            }
            return { text: '' };
          }, { idx: rowIndex });

          // Lägg till i listan
          allDownloadedReceipts.push({
            index: globalReceiptCounter,
            fileName: fileName,
            date: dateFromRow,
            rowIndex: rowIndex,
            text: receiptInfo.text.substring(0, 100),
            downloadedAt: new Date().toISOString()
          });

          globalReceiptCounter++;
          return true;
        }
      } catch (error) {
        console.log(`  ⚠️  Kunde inte hitta "Ladda ner": ${error.message}`);
      }

      // Stäng menyn om nedladdning misslyckades
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
    }

    return false;

  } catch (error) {
    console.log(`  ❌ Fel: ${error.message}`);
    return false;
  }
}

async function fetchICAReceipts() {
  console.log('🚀 Startar ICA kvittohämtare från Kivra...\n');

  // Läs antal månader från kommandorad (om angivet)
  let monthsToFetch = CONFIG.monthsToFetch;
  const args = process.argv.slice(2);

  // Stöd för: node fetch-ica-kivra.js 6
  // eller: node fetch-ica-kivra.js --months=6
  for (const arg of args) {
    if (arg.startsWith('--months=')) {
      monthsToFetch = parseInt(arg.split('=')[1]);
    } else if (!arg.startsWith('-') && !isNaN(parseInt(arg))) {
      monthsToFetch = parseInt(arg);
    }
  }

  // Validera antal månader
  if (monthsToFetch < 1 || monthsToFetch > 24) {
    console.error('❌ Antal månader måste vara mellan 1 och 24');
    process.exit(1);
  }

  // Kolla först om det finns nya kvitton att hämta
  const lastFetchDate = getLastFetchDate();
  let stopDate = null;

  if (lastFetchDate) {
    const today = new Date();
    const nextDay = new Date(lastFetchDate);
    nextDay.setDate(lastFetchDate.getDate() + 1);

    if (nextDay > today) {
      console.log(`📅 Inga nya kvitton sedan ${lastFetchDate.toISOString().split('T')[0]}`);
      console.log('ℹ️  Nästa hämtning: imorgon eller senare\n');
      return;
    }

    stopDate = lastFetchDate;
    console.log(`📅 Hämtar nya kvitton från ${nextDay.toISOString().split('T')[0]} till idag\n`);
  } else {
    // Beräkna stop-datum baserat på antal månader bakåt
    const today = new Date();
    stopDate = new Date(today);
    stopDate.setMonth(today.getMonth() - monthsToFetch);

    console.log(`📅 Första hämtningen - hämtar senaste ${monthsToFetch} månaderna (till ${stopDate.toISOString().split('T')[0]})\n`);
  }

  // Läs inloggningsuppgifter
  const ssn = process.env.KIVRA_SSN; // Personnummer

  if (!ssn) {
    console.error('❌ Fel: Saknar personnummer!');
    console.log('\nSätt miljövariabel:');
    console.log('  set KIVRA_SSN=ÅÅMMDDXXXX');
    console.log('\nOBS: Inloggning sker med BankID');
    process.exit(1);
  }

  // Skapa output-mapp
  if (!fs.existsSync(CONFIG.outputDir)) {
    fs.mkdirSync(CONFIG.outputDir, { recursive: true });
  }

  // Ladda befintliga kvitton
  loadExistingReceipts();

  const browser = await chromium.launch({
    headless: CONFIG.headless,
    slowMo: 100
  });

  try {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    });

    const page = await context.newPage();
    page.on('console', msg => console.log('Browser:', msg.text()));

    // Försök navigera direkt till ICA-kedjan (kanske redan inloggad)
    console.log('📄 Navigerar till ICA-kedjan...');
    await page.goto(CONFIG.icaChainUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(3000);

    // Kolla om vi är på inloggningssidan eller redan inne
    const currentUrl = page.url();
    console.log(`📍 Nuvarande URL: ${currentUrl.substring(0, 50)}...`);

    if (currentUrl.includes('auth') || currentUrl.includes('login') || currentUrl.includes('inloggning')) {
      console.log('🔐 Behöver logga in...');
      console.log('\n' + '='.repeat(60));
      console.log('⚠️  MANUELL INLOGGNING KRÄVS');
      console.log('='.repeat(60));
      console.log('1. En webbläsare har öppnats med Kivras inloggningssida');
      console.log('2. Klicka på "Mobilt BankID" knappen');
      console.log('3. Scanna QR-koden med BankID-appen');
      console.log('4. Godkänn inloggningen');
      console.log('5. Vänta tills du ser din Kivra-inkorg');
      console.log('\n⏱️  Scriptet väntar i 5 minuter på att du ska logga in...');
      console.log('='.repeat(60) + '\n');

      // Vänta på BankID-autentisering (användaren gör det manuellt)
      const authSuccess = await waitForBankIDAuth(page);
      if (!authSuccess) {
        // Ta skärmdump för debug
        await page.screenshot({ path: 'kivra-login-timeout.png', fullPage: true });
        console.log('📸 Skärmdump sparad: kivra-login-timeout.png');
        throw new Error('BankID-autentisering misslyckades eller tog för lång tid');
      }

      // Navigera till ICA-kedjan efter inloggning
      console.log('📄 Navigerar till ICA-kedjan efter inloggning...');
      await page.goto(CONFIG.icaChainUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(3000);
    } else {
      console.log('✅ Redan inloggad!');
    }

    console.log('\n✅ Redo att hämta kvitton!');

    // Vänta på att sidan laddar innehåll
    await page.waitForTimeout(5000);

    // Kolla om det finns ett felmeddelande och försök igen
    const errorRetryButton = page.locator('button:has-text("Försök igen"), button:has-text("Try again")').first();
    if (await errorRetryButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      console.log('⚠️  Kivra visade ett fel, klickar på "Försök igen"...');
      await errorRetryButton.click();
      await page.waitForTimeout(5000);
    }

    // Ladda äldre kvitton genom att klicka på "Visa fler"
    await loadMoreReceipts(page, stopDate);

    // Hitta alla kvitto-rader
    const rows = await findICAReceiptRows(page);

    if (rows.length === 0) {
      console.log('⚠️  Inga kvitto-rader hittades');
      console.log('Tips: Kontrollera att URL:en är korrekt och att det finns kvitton');

      // Ta en skärmdump för debug
      await page.screenshot({ path: 'kivra-no-rows-debug.png', fullPage: true });
      console.log('📸 Debug-skärmdump sparad: kivra-no-rows-debug.png');
    } else {
      console.log(`\n⬇️  Laddar ner kvitton från ${rows.length} rader...`);
      console.log(`ℹ️  Hoppar över redan nedladdade filer\n`);

      let successCount = 0;
      let skippedCount = 0;

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const result = await downloadReceiptFromRow(page, i, row);

        if (result === false && fs.existsSync(path.join(CONFIG.outputDir, `ica_${extractDateFromText(row.text, row.monthText)}.pdf`))) {
          skippedCount++;
        } else if (result) {
          successCount++;
        }

        // Scrolla tillbaka till toppen för nästa iteration
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.waitForTimeout(1000);
      }

      console.log(`\n✅ Laddade ner ${successCount} nya kvitton`);
      console.log(`⏭️  Hoppade över ${skippedCount} befintliga kvitton`);
      console.log(`📊 Totalt: ${successCount + skippedCount}/${rows.length}`);
    }

    // Spara sammanfattning
    const outputPath = path.join(CONFIG.outputDir, CONFIG.outputFile);
    const output = {
      fetchedAt: new Date().toISOString(),
      source: 'Kivra',
      sender: 'ICA',
      summary: {
        totalReceipts: allDownloadedReceipts.length
      },
      receipts: allDownloadedReceipts
    };

    fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));

    // Spara dagens datum som senaste hämtning
    saveLastFetchDate(new Date());

    console.log('\n' + '='.repeat(60));
    console.log('✅ KLART!');
    console.log('='.repeat(60));
    console.log(`💾 Sammanfattning: ${outputPath}`);
    console.log(`📊 Totalt kvitton: ${allDownloadedReceipts.length}`);
    console.log(`📁 Kvitton sparade i: ${CONFIG.outputDir}/`);

  } catch (error) {
    console.error('\n❌ Ett fel uppstod:', error.message);

    // Ta skärmdump för debug
    try {
      await page.screenshot({ path: 'kivra-error-screenshot.png', fullPage: true });
      console.log('📸 Skärmdump sparad: kivra-error-screenshot.png');
    } catch (e) {
      // Ignorera fel vid skärmdump
    }

    throw error;
  } finally {
    await browser.close();
  }
}

// Kör scriptet
fetchICAReceipts().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
