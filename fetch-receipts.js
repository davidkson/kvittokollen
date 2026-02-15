import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

// Konfiguration
const CONFIG = {
  loginUrl: 'https://www.willys.se/anvandare/inloggning',
  receiptsUrl: 'https://www.willys.se/mina-kop',
  outputDir: './receipts/willys',
  outputFile: 'willys-receipts.json',
  lastFetchFile: './receipts/willys/.last-fetch-willys.json',
  headless: false,
  timeout: 30000,
  monthsToFetch: 12 // Antal månader bakåt att hämta (används bara första gången)
};

// Globala variabler för att hålla koll på nedladdade kvitton
const downloadedUrls = new Set();
const allDownloadedReceipts = [];
let globalReceiptCounter = 1;

// Håll koll på förväntat från-datum och till-datum för nästa batch
let expectedFromDate = null;
let expectedToDate = null;

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

// Funktion för att scrolla och ladda alla kvitton
async function scrollToLoadAll(page) {
  console.log('📜 Scrollar ner för att ladda alla kvitton...');

  let previousHeight = 0;
  let scrollAttempts = 0;
  const maxScrollAttempts = 10;

  while (scrollAttempts < maxScrollAttempts) {
    const currentHeight = await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight);
      return document.body.scrollHeight;
    });

    console.log(`   Scroll ${scrollAttempts + 1}: höjd = ${currentHeight}px`);
    await page.waitForTimeout(2000);

    const newHeight = await page.evaluate(() => document.body.scrollHeight);

    if (newHeight === previousHeight) {
      console.log('   ✅ Nådde slutet av sidan');
      break;
    }

    previousHeight = newHeight;
    scrollAttempts++;
  }

  // Scrolla tillbaka till toppen
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(1000);
}

// Funktion för att extrahera alla kvitto-URLs från sidan
async function extractReceiptUrls(page) {
  console.log('🔍 Extraherar kvitton från sidan...');

  const purchases = await page.evaluate(() => {
    const found = {
      directReceiptUrls: [],
      orderDetailLinks: []
    };

    // Hitta direkta kvitto API-länkar (butiksköp)
    const receiptLinks = document.querySelectorAll('a[href*="digitalreceipt"]');
    receiptLinks.forEach((link) => {
      found.directReceiptUrls.push({
        url: link.href,
        text: link.textContent.trim(),
        type: 'store'
      });
    });

    // Sök även i HTML efter digitalreceipt URLs
    const bodyHtml = document.body.innerHTML;
    const urlMatches = bodyHtml.matchAll(/https?:\/\/[^\s"'<>]+digitalreceipt[^\s"'<>]*/g);
    for (const match of urlMatches) {
      const url = match[0];
      if (!found.directReceiptUrls.find(u => u.url === url)) {
        found.directReceiptUrls.push({
          url: url,
          text: 'Found in HTML',
          type: 'store'
        });
      }
    }

    // Hitta länkar till orderdetaljer (e-handelsköp)
    const allLinks = document.querySelectorAll('a');
    allLinks.forEach((link) => {
      const href = link.getAttribute('href');
      if (href && href.match(/\/mina-kop\/\d+$/)) {
        const fullUrl = href.startsWith('http') ? href : `https://www.willys.se${href}`;
        if (!found.orderDetailLinks.find(o => o.url === fullUrl)) {
          found.orderDetailLinks.push({
            url: fullUrl,
            text: link.textContent.trim().substring(0, 50),
            type: 'ecommerce'
          });
        }
      }
    });

    return found;
  });

  console.log(`✅ Hittade ${purchases.directReceiptUrls.length} direkta kvitton (butiksköp)`);
  console.log(`✅ Hittade ${purchases.orderDetailLinks.length} orderdetaljer (e-handel)`);

  return purchases;
}

// Funktion för att hämta e-handelskvitton
async function fetchEcommerceReceipts(page, orderDetailLinks) {
  const ecommerceUrls = [];

  if (orderDetailLinks.length === 0) {
    return ecommerceUrls;
  }

  console.log(`\n🛒 Hämtar kvitton från ${orderDetailLinks.length} e-handelsorder...`);

  for (let i = 0; i < orderDetailLinks.length; i++) {
    const order = orderDetailLinks[i];
    console.log(`\n  📦 Order ${i + 1}/${orderDetailLinks.length}: ${order.url}`);

    let pageLoaded = false;
    const maxRetries = 3;

    for (let retry = 0; retry < maxRetries && !pageLoaded; retry++) {
      try {
        if (retry > 0) {
          console.log(`    🔄 Försök ${retry + 1}/${maxRetries}...`);
        }

        await page.goto(order.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForTimeout(2000);
        pageLoaded = true;
        console.log(`    ✅ Sidan laddad`);
      } catch (error) {
        console.log(`    ⚠️  Försök ${retry + 1} misslyckades: ${error.message}`);
        if (retry < maxRetries - 1) {
          console.log(`    ⏳ Väntar 2 sekunder innan nytt försök...`);
          await page.waitForTimeout(2000);
        }
      }
    }

    if (!pageLoaded) {
      console.log(`    ❌ Kunde inte ladda sidan efter ${maxRetries} försök`);
      continue;
    }

    try {
      const orderNumberMatch = order.url.match(/\/mina-kop\/(\d+)/);
      const orderNumber = orderNumberMatch ? orderNumberMatch[1] : null;

      const receiptInfo = await page.evaluate((orderNum) => {
        const result = { receiptUrl: null };

        // Leta efter e-handelskvitto
        const ecommerceReceiptLink = document.querySelector(`a[href*="/orders/${orderNum}/receipt"]`);
        if (ecommerceReceiptLink) {
          result.receiptUrl = ecommerceReceiptLink.href;
          return result;
        }

        // Sök i HTML
        const html = document.body.innerHTML;
        const ecommerceMatch = html.match(new RegExp(`https?://[^\\s"'<>]+/orders/${orderNum}/receipt[^\\s"'<>]*`));
        if (ecommerceMatch) {
          result.receiptUrl = ecommerceMatch[0];
          return result;
        }

        // Fallback till digitalreceipt
        const receiptLink = document.querySelector('a[href*="digitalreceipt"]');
        if (receiptLink) {
          result.receiptUrl = receiptLink.href;
        }

        return result;
      }, orderNumber);

      // Konstruera URL om ingen hittades
      if (!receiptInfo.receiptUrl && orderNumber) {
        receiptInfo.receiptUrl = `https://www.willys.se/axfood/rest/order/orders/${orderNumber}/receipt`;
        console.log(`    🔧 Konstruerar kvitto-URL`);
      }

      if (receiptInfo.receiptUrl) {
        console.log(`    ✅ Hittade kvitto`);
        ecommerceUrls.push({
          url: receiptInfo.receiptUrl,
          text: order.text,
          type: 'ecommerce',
          orderUrl: order.url
        });
      } else {
        console.log(`    ⚠️  Inget kvitto-URL hittades`);
      }
    } catch (error) {
      console.log(`    ❌ Fel: ${error.message}`);
    }

    await page.waitForTimeout(1000);
  }

  return ecommerceUrls;
}

// Funktion för att ladda ner kvitton
async function downloadReceipts(page, receiptUrls, batchNumber) {
  if (receiptUrls.length === 0) {
    console.log('⚠️  Inga kvitton att ladda ner i denna batch');
    return 0;
  }

  // Filtrera bort redan nedladdade kvitton
  const newReceipts = receiptUrls.filter(r => !downloadedUrls.has(r.url));

  if (newReceipts.length === 0) {
    console.log('✅ Alla kvitton i denna batch är redan nedladdade');
    return 0;
  }

  console.log(`\n⬇️  Laddar ner ${newReceipts.length} nya kvitton (${receiptUrls.length - newReceipts.length} redan nedladdade)...`);

  // Skapa output-mapp
  if (!fs.existsSync(CONFIG.outputDir)) {
    fs.mkdirSync(CONFIG.outputDir, { recursive: true });
  }

  let downloadedCount = 0;

  for (let i = 0; i < newReceipts.length; i++) {
    const receipt = newReceipts[i];
    console.log(`\n📥 Kvitto ${globalReceiptCounter} [${receipt.type}] (batch ${batchNumber})`);

    try {
      // Extrahera datum från URL för filnamn
      const dateMatch = receipt.url.match(/date=(\d{4}-\d{2}-\d{2})/);
      const timeMatch = receipt.url.match(/(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})/);

      let fileName = `kvitto_${globalReceiptCounter}`;
      if (dateMatch) {
        fileName = `kvitto_${dateMatch[1]}_${globalReceiptCounter}`;
      }

      // Hämta kvitto från API:et
      const pdfBuffer = await page.evaluate(async (url) => {
        const response = await fetch(url);
        const blob = await response.blob();
        const arrayBuffer = await blob.arrayBuffer();
        return Array.from(new Uint8Array(arrayBuffer));
      }, receipt.url);

      // Spara som PDF
      const pdfFilePath = path.join(CONFIG.outputDir, `${fileName}.pdf`);
      const buffer = Buffer.from(pdfBuffer);
      fs.writeFileSync(pdfFilePath, buffer);
      console.log(`  ✅ Sparad: ${fileName}.pdf (${buffer.length} bytes)`);

      // Markera som nedladdad
      downloadedUrls.add(receipt.url);

      // Lägg till i globala listan
      const parsedReceipt = {
        index: globalReceiptCounter,
        type: receipt.type,
        fileName: `${fileName}.pdf`,
        apiUrl: receipt.url,
        orderUrl: receipt.orderUrl || null,
        date: dateMatch ? dateMatch[1] : null,
        timestamp: timeMatch ? timeMatch[1] : null,
        batch: batchNumber
      };

      allDownloadedReceipts.push(parsedReceipt);
      globalReceiptCounter++;
      downloadedCount++;

    } catch (error) {
      console.log(`  ❌ Fel: ${error.message}`);
    }

    await page.waitForTimeout(500);
  }

  return downloadedCount;
}

// Funktion för att öppna datepicker och flytta från-datum en månad bakåt
async function adjustDateRange(page, useIncrementalDates = false) {
  console.log(`\n📅 Justerar datumintervall...`);

  let newFromDate, newToDate;

  if (useIncrementalDates && expectedFromDate && expectedToDate) {
    // Använd redan satta datum (inkrementellt läge)
    newFromDate = new Date(expectedFromDate);
    newToDate = new Date(expectedToDate);
  } else {
    // Beräkna nästa från-datum och till-datum
    if (!expectedFromDate) {
      const today = new Date();
      // Första gången - anta att standardintervall är senaste månaden
      expectedFromDate = new Date(today);
      expectedFromDate.setMonth(today.getMonth() - 1);
      expectedToDate = new Date(today);
    }

    // Rullande fönster: gamla från-datumet blir nya till-datumet
    newFromDate = new Date(expectedFromDate);
    newFromDate.setMonth(expectedFromDate.getMonth() - 1);
    newToDate = new Date(expectedFromDate); // Gamla från-datumet
  }

  const formatDate = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const newFromDateStr = formatDate(newFromDate);
  const newToDateStr = formatDate(newToDate);

  console.log(`   🎯 Nytt intervall: ${newFromDateStr} till ${newToDateStr}`);
  console.log(`   ℹ️  (Rullande fönster: gammalt från-datum blir nytt till-datum)`);

  // Öppna datepicker
  const toggleClicked = await page.evaluate(() => {
    const toggleButton = document.querySelector('[data-testid="date-range-picker-toggle"]');
    if (toggleButton) {
      toggleButton.click();
      return true;
    }
    return false;
  });

  if (!toggleClicked) {
    console.log('   ⚠️  Kunde inte öppna datepicker');
    return false;
  }

  console.log('   ✅ Öppnade datepicker');
  await page.waitForTimeout(1000);

  // Vänta på att kalendern ska bli synlig
  try {
    await page.waitForSelector('[data-testid="date-range-picker-container"] .rdp-root', {
      timeout: 5000,
      state: 'visible'
    });
  } catch (e) {
    console.log('   ⚠️  Kalendern blev inte synlig');
    return false;
  }

  // STEG 1: Klicka på det markerade från-datumet (om det finns)
  const fromDateClicked = await page.evaluate(() => {
    // Försök hitta och klicka på range_start
    const rangeStart = document.querySelector('.rdp-range_start');
    if (rangeStart) {
      const button = rangeStart.querySelector('button');
      if (button) {
        console.log(`Klickar på markerat från-datum`);
        button.click();
        return true;
      }
    }

    console.log('Inget markerat från-datum hittades, fortsätter ändå');
    return false;
  });

  if (fromDateClicked) {
    console.log('   ✅ Klickade på markerat från-datum');
    await page.waitForTimeout(500);
  }

  // STEG 2: Navigera till rätt månad med vänsterpil
  // Fortsätt trycka vänsterpil tills vi hittar rätt datum
  let dateFound = false;
  let navigationAttempts = 0;
  const maxNavigationAttempts = 12; // Max 12 månader bakåt

  while (!dateFound && navigationAttempts < maxNavigationAttempts) {
    // Kolla om datumet finns i kalendern
    dateFound = await page.evaluate((date) => {
      const dayButton = document.querySelector(`[data-day="${date}"] button`);
      return dayButton && !dayButton.disabled;
    }, newFromDateStr);

    if (!dateFound) {
      // Tryck vänsterpil för att navigera bakåt
      const navigated = await page.evaluate(() => {
        const prevButton = document.querySelector('.rdp-button_previous');
        if (prevButton) {
          prevButton.click();
          return true;
        }
        return false;
      });

      if (!navigated) {
        console.log('   ⚠️  Kunde inte navigera bakåt');
        return false;
      }

      navigationAttempts++;
      console.log(`   ⏪ Navigerar bakåt (försök ${navigationAttempts})...`);
      await page.waitForTimeout(500);
    }
  }

  if (!dateFound) {
    console.log(`   ⚠️  Kunde inte hitta datum ${newFromDateStr} efter ${navigationAttempts} försök`);
    return false;
  }

  console.log(`   ✅ Hittade rätt månad efter ${navigationAttempts} navigation(er)`);

  // STEG 3: Klicka på det nya från-datumet
  const dateClicked = await page.evaluate((date) => {
    const dayButton = document.querySelector(`[data-day="${date}"] button`);
    if (dayButton && !dayButton.disabled) {
      console.log(`Klickar på datum ${date}`);
      dayButton.click();
      return true;
    }
    return false;
  }, newFromDateStr);

  if (!dateClicked) {
    console.log(`   ⚠️  Kunde inte klicka på datum ${newFromDateStr}`);
    return false;
  }

  console.log(`   ✅ Valde nytt från-datum: ${newFromDateStr}`);
  await page.waitForTimeout(500);

  // STEG 4: Navigera till och välj nytt till-datum (gamla från-datumet)
  console.log(`   📅 Väljer nytt till-datum: ${newToDateStr}...`);

  // Navigera till rätt månad för till-datumet (kan behöva gå framåt)
  let toDateFound = false;
  let toNavigationAttempts = 0;
  const maxToNavigationAttempts = 12;

  while (!toDateFound && toNavigationAttempts < maxToNavigationAttempts) {
    // Kolla om till-datumet finns i kalendern
    toDateFound = await page.evaluate((date) => {
      const dayButton = document.querySelector(`[data-day="${date}"] button`);
      return dayButton && !dayButton.disabled;
    }, newToDateStr);

    if (!toDateFound) {
      // Tryck högerpil för att navigera framåt
      const navigated = await page.evaluate(() => {
        const nextButton = document.querySelector('.rdp-button_next');
        if (nextButton) {
          nextButton.click();
          return true;
        }
        return false;
      });

      if (!navigated) {
        console.log('   ⚠️  Kunde inte navigera framåt till till-datum');
        break;
      }

      toNavigationAttempts++;
      console.log(`   ⏩ Navigerar framåt för till-datum (försök ${toNavigationAttempts})...`);
      await page.waitForTimeout(500);
    }
  }

  if (!toDateFound) {
    console.log(`   ⚠️  Kunde inte hitta till-datum ${newToDateStr}`);
    return false;
  }

  // Klicka på till-datumet
  const toDateClicked = await page.evaluate((date) => {
    const dayButton = document.querySelector(`[data-day="${date}"] button`);
    if (dayButton && !dayButton.disabled) {
      console.log(`Klickar på till-datum ${date}`);
      dayButton.click();
      return true;
    }
    return false;
  }, newToDateStr);

  if (!toDateClicked) {
    console.log(`   ⚠️  Kunde inte klicka på till-datum ${newToDateStr}`);
    return false;
  }

  console.log(`   ✅ Valde nytt till-datum: ${newToDateStr}`);
  await page.waitForTimeout(500);

  // STEG 5: Klicka på "Välj"-knappen
  const confirmClicked = await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const valjButton = buttons.find(btn => btn.textContent.trim() === 'Välj');
    if (valjButton) {
      valjButton.click();
      return true;
    }
    return false;
  });

  if (!confirmClicked) {
    console.log('   ⚠️  Kunde inte hitta "Välj"-knapp');
    return false;
  }

  console.log('   ✅ Klickade på "Välj"');

  // Uppdatera expectedFromDate och expectedToDate för nästa batch
  expectedFromDate = newFromDate;
  expectedToDate = newToDate;

  // Vänta på att sidan laddas om
  try {
    await page.waitForLoadState('networkidle', { timeout: 10000 });
    console.log('   ✅ Sidan omladdad med nytt datumintervall');
  } catch (e) {
    console.log('   ⚠️  Timeout vid omladdning, men fortsätter...');
  }

  await page.waitForTimeout(3000);
  return true;
}

async function fetchWillysReceipts() {
  console.log('🚀 Startar Willys kvittohämtare (batch-mode)...\n');

  // Läs antal månader från kommandorad (om angivet)
  let monthsToFetch = CONFIG.monthsToFetch;
  const args = process.argv.slice(2);

  // Stöd för: node fetch-receipts.js 6
  // eller: node fetch-receipts.js --months=6
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
  if (lastFetchDate) {
    const today = new Date();
    const nextDay = new Date(lastFetchDate);
    nextDay.setDate(lastFetchDate.getDate() + 1);

    if (nextDay > today) {
      console.log(`📅 Inga nya kvitton sedan ${lastFetchDate.toISOString().split('T')[0]}`);
      console.log('ℹ️  Nästa hämtning: imorgon eller senare\n');
      return;
    }

    console.log(`📅 Hämtar nya kvitton från ${nextDay.toISOString().split('T')[0]} till idag\n`);
  } else {
    console.log(`📅 Första hämtningen - hämtar senaste ${monthsToFetch} månaderna\n`);
  }

  // Läs inloggningsuppgifter
  const username = process.env.WILLYS_USERNAME;
  const password = process.env.WILLYS_PASSWORD;

  if (!username || !password) {
    console.error('❌ Fel: Saknar inloggningsuppgifter!');
    console.log('\nSätt miljövariabler:');
    console.log('  set WILLYS_USERNAME=ÅÅMMDDXXXX');
    console.log('  set WILLYS_PASSWORD=ditt-lösenord');
    process.exit(1);
  }

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

    // Logga in
    console.log('📄 Navigerar till inloggningssidan...');
    await page.goto(CONFIG.loginUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(2000);

    // Hantera cookie-dialog
    console.log('🍪 Letar efter cookie-dialog...');
    try {
      const cookieSelectors = [
        '#onetrust-accept-btn-handler',
        'button:has-text("Acceptera alla")',
        'button:has-text("Acceptera")',
        'button:has-text("Accept all")',
        '[id*="accept"][id*="cookie"]',
        '[class*="accept"][class*="cookie"]'
      ];

      let cookieClicked = false;
      for (const selector of cookieSelectors) {
        try {
          const cookieButton = await page.waitForSelector(selector, { timeout: 2000 });
          if (cookieButton && await cookieButton.isVisible()) {
            await cookieButton.click();
            console.log(`✅ Accepterade cookies (${selector})`);
            await page.waitForTimeout(1000);
            cookieClicked = true;
            break;
          }
        } catch (e) {
          continue;
        }
      }

      if (!cookieClicked) {
        console.log('ℹ️  Ingen cookie-dialog hittades');
      }
    } catch (e) {
      console.log('ℹ️  Ingen cookie-dialog');
    }

    // Hitta och fyll i inloggningsformulär
    console.log('🔍 Letar efter inloggningsformulär...');

    const usernameSelectors = ['input[name="username"]', 'input[type="text"]', 'input[type="tel"]'];
    let usernameField = null;
    for (const selector of usernameSelectors) {
      try {
        usernameField = await page.waitForSelector(selector, { timeout: 2000 });
        if (usernameField) break;
      } catch (e) { continue; }
    }

    if (!usernameField) {
      throw new Error('Kunde inte hitta inloggningsformuläret');
    }

    await usernameField.fill(username);
    console.log('✅ Fyllde i användarnamn');

    console.log('\n' + '='.repeat(60));
    console.log('⏸️  MANUELL INLOGGNING');
    console.log('='.repeat(60));
    console.log('👉 Fyll i ditt lösenord i webbläsaren');
    console.log('👉 Klicka på "Logga in"-knappen');
    console.log('👉 Vänta tills du ser "Mina köp"-sidan');
    console.log('='.repeat(60));
    console.log('\nTryck ENTER när du är inloggad...');

    // Vänta på att användaren trycker Enter
    await new Promise((resolve) => {
      process.stdin.once('data', () => {
        resolve();
      });
    });

    console.log('✅ Fortsätter efter manuell inloggning...');

    // Gå till kvittosidan (om vi inte redan är där)
    console.log(`\n📄 Säkerställer att vi är på kvittosidan: ${CONFIG.receiptsUrl}`);
    await page.goto(CONFIG.receiptsUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);
    console.log('✅ På kvittosidan');

    // Kolla om vi ska använda senaste hämtningsdatum
    const lastFetchDate = getLastFetchDate();
    let shouldAdjustDate = false;

    if (lastFetchDate) {
      // Använd senaste hämtningsdatum för att bara hämta nya kvitton
      const today = new Date();
      const nextDay = new Date(lastFetchDate);
      nextDay.setDate(lastFetchDate.getDate() + 1);

      if (nextDay <= today) {
        console.log(`\n📅 Hämtar endast nya kvitton sedan ${lastFetchDate.toISOString().split('T')[0]}`);
        shouldAdjustDate = true;

        // Sätt datum direkt (skip batch 1 med standardintervall)
        expectedFromDate = nextDay;
        expectedToDate = today;

        const adjusted = await adjustDateRange(page, true); // true = använd satta datum
        if (!adjusted) {
          console.log('ℹ️  Inga nya kvitton att hämta.');
          await browser.close();
          return;
        }
      } else {
        console.log(`\n📅 Inga nya kvitton sedan ${lastFetchDate.toISOString().split('T')[0]}`);
        await browser.close();
        return;
      }
    }

    // BATCH 1: Ladda ner kvitton från standardintervall (eller anpassat intervall)
    console.log('\n' + '='.repeat(60));
    if (shouldAdjustDate) {
      const fromStr = expectedFromDate.toISOString().split('T')[0];
      const toStr = expectedToDate.toISOString().split('T')[0];
      console.log(`📦 BATCH 1: Hämtar nya kvitton (${fromStr} till ${toStr})`);
    } else {
      console.log('📦 BATCH 1: Hämtar kvitton från standardintervall');
    }
    console.log('='.repeat(60));

    await scrollToLoadAll(page);
    let purchases = await extractReceiptUrls(page);

    // Hämta e-handelskvitton
    const ecommerceUrls = await fetchEcommerceReceipts(page, purchases.orderDetailLinks);
    await page.goto(CONFIG.receiptsUrl, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    // Kombinera alla kvitto-URLs
    let allReceiptUrls = [...purchases.directReceiptUrls, ...ecommerceUrls];
    let downloadedCount = await downloadReceipts(page, allReceiptUrls, 1);
    console.log(`\n✅ Batch 1 klar: ${downloadedCount} kvitton nedladdade`);

    // Om vi använder inkrementell hämtning (lastFetchDate finns), skippa fler batches
    if (shouldAdjustDate) {
      console.log('\n✅ Inkrementell hämtning klar!');
      // Fortsätt till sammanfattning (skippa loop)
    } else {
      // BATCH 2-N: Expandera datumintervallet bakåt månad för månad (originalbeteende)
      for (let month = 1; month < monthsToFetch; month++) {
      console.log('\n' + '='.repeat(60));
      console.log(`📦 BATCH ${month + 1}: Flyttar från-datum ytterligare 1 månad bakåt`);
      console.log('='.repeat(60));

      // Justera datumintervallet (flyttar från-datum 1 månad bakåt)
      const adjusted = await adjustDateRange(page);

      if (!adjusted) {
        console.log(`⚠️  Kunde inte justera datumintervall, avbryter batch ${month + 1}`);
        break;
      }

      // Ladda alla kvitton
      await scrollToLoadAll(page);
      purchases = await extractReceiptUrls(page);

      // Hämta e-handelskvitton
      const ecommerceUrls = await fetchEcommerceReceipts(page, purchases.orderDetailLinks);
      await page.goto(CONFIG.receiptsUrl, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(2000);

      // Kombinera och ladda ner
      allReceiptUrls = [...purchases.directReceiptUrls, ...ecommerceUrls];
      downloadedCount = await downloadReceipts(page, allReceiptUrls, month + 1);
      console.log(`\n✅ Batch ${month + 1} klar: ${downloadedCount} nya kvitton nedladdade`);

      // Om inga nya kvitton hittades, avbryt
      if (downloadedCount === 0 && purchases.directReceiptUrls.length === 0) {
        console.log('ℹ️  Inga fler kvitton att hämta, avslutar...');
        break;
      }
    }
    } // Slut på else-block för månadsloop

    // Spara sammanfattning
    const outputPath = path.join(CONFIG.outputDir, CONFIG.outputFile);
    const storeReceipts = allDownloadedReceipts.filter(r => r.type === 'store');
    const ecommerceReceipts = allDownloadedReceipts.filter(r => r.type === 'ecommerce');

    const output = {
      fetchedAt: new Date().toISOString(),
      url: CONFIG.receiptsUrl,
      monthsFetched: CONFIG.monthsToFetch,
      summary: {
        totalReceipts: allDownloadedReceipts.length,
        storeReceipts: storeReceipts.length,
        ecommerceReceipts: ecommerceReceipts.length
      },
      receipts: allDownloadedReceipts
    };

    fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));

    console.log('\n' + '='.repeat(60));
    console.log('✅ KLART! Alla batchar färdiga');
    console.log('='.repeat(60));
    console.log(`💾 Sammanfattning: ${outputPath}`);
    console.log(`📊 Totalt kvitton: ${allDownloadedReceipts.length}`);
    console.log(`   🏪 Butiksköp: ${storeReceipts.length}`);
    console.log(`   🛒 E-handel: ${ecommerceReceipts.length}`);
    console.log(`📁 Kvitton sparade i: ${CONFIG.outputDir}/`);

    // Spara dagens datum som senaste hämtning
    saveLastFetchDate(new Date());

  } catch (error) {
    console.error('\n❌ Ett fel uppstod:', error.message);
    throw error;
  } finally {
    await browser.close();
  }
}

// Kör scriptet
fetchWillysReceipts().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
