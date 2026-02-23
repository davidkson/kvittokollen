#!/usr/bin/env node

const readline = require('readline');
const { spawn } = require('child_process');

console.clear();
console.log('╔════════════════════════════════════════════════════════════════╗');
console.log('║          🛒 KVITTHANTERING - WILLYS & ICA 🛒                  ║');
console.log('╚════════════════════════════════════════════════════════════════╝\n');

const options = [
  {
    key: '1',
    label: '🚀 Sync Willys (REKOMMENDERAT)',
    command: 'npm run sync-willys',
    description: 'Hämtar nya kvitton + uppdaterar analys automatiskt'
  },
  {
    key: '2',
    label: '🚀 Sync ICA (REKOMMENDERAT)',
    command: 'npm run sync-ica',
    description: 'Hämtar nya kvitton + uppdaterar analys automatiskt (kräver BankID)'
  },
  {
    key: '3',
    label: '🚀 Sync Allt (REKOMMENDERAT)',
    command: 'npm run sync-all',
    description: 'Synkar både Willys och ICA i ett kommando'
  },
  {
    key: '4',
    label: '📥 Hämta Willys-kvitton',
    command: 'npm run willys',
    description: 'Bara hämta kvitton från Willys.se (utan uppdatering)'
  },
  {
    key: '5',
    label: '📥 Hämta ICA-kvitton',
    command: 'npm run ica',
    description: 'Bara hämta kvitton från Kivra/ICA (utan uppdatering)'
  },
  {
    key: '6',
    label: '⚡ Uppdatera Willys',
    command: 'npm run update-willys',
    description: 'Bara uppdatera Willys-analys från befintliga PDF:er'
  },
  {
    key: '7',
    label: '⚡ Uppdatera ICA',
    command: 'npm run update-ica',
    description: 'Bara uppdatera ICA-analys från befintliga PDF:er'
  },
  {
    key: '8',
    label: '📊 Kombinerad analys',
    command: 'npm run analyze-combined',
    description: 'Kombinerar Willys + ICA → combined-analysis.json'
  },
  {
    key: '9',
    label: '📊 Visa rapporter',
    command: 'node run-report.cjs',
    description: 'Interaktiv meny med 22 analysrapporter'
  },
  {
    key: 'd',
    label: '🧹 Ta bort dubbletter',
    command: 'node scripts/remove-duplicates.cjs',
    description: 'Rensar bort dubbla kvitton från analysfilerna'
  },
  {
    key: 'i',
    label: '🔧 Installera webbläsare',
    command: 'npm run install-browser',
    description: 'Installerar Chromium för Playwright (endast första gången)'
  },
  {
    key: 'h',
    label: '❓ Hjälp',
    command: 'help',
    description: 'Visar detaljerad hjälp och kommandon'
  },
  {
    key: 'q',
    label: '❌ Avsluta',
    command: 'exit',
    description: 'Stänger menyn'
  }
];

function showMenu() {
  console.log('📋 VÄLJ ETT ALTERNATIV:\n');

  options.forEach(opt => {
    console.log(`  ${opt.key}. ${opt.label}`);
    console.log(`     ${opt.description}`);
    console.log('');
  });

  console.log('═══════════════════════════════════════════════════════════════');
}

function showHelp() {
  console.clear();
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║                    📖 HJÄLP & DOKUMENTATION                   ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  console.log('🚀 SYNC (REKOMMENDERAT - Fetch + Update i ett steg):\n');
  console.log('  npm run sync-willys         # Hämta + uppdatera Willys');
  console.log('  npm run sync-ica            # Hämta + uppdatera ICA (BankID krävs)');
  console.log('  npm run sync-all            # Synka både Willys och ICA\n');

  console.log('🛒 HÄMTA KVITTON (Separata steg):\n');
  console.log('  npm run willys              # Hämta Willys-kvitton');
  console.log('  npm run willys -- 6         # Hämta 6 månader (första gången)');
  console.log('  npm run ica                 # Hämta ICA-kvitton');
  console.log('  npm run ica -- 3            # Hämta 3 månader (första gången)\n');

  console.log('⚡ UPPDATERA ANALYS (Separata steg):\n');
  console.log('  npm run update-willys       # Uppdatera Willys (bara nya)');
  console.log('  npm run update-ica          # Uppdatera ICA (bara nya)');
  console.log('  npm run analyze-combined    # Kombinerad analys (båda)\n');

  console.log('📊 RAPPORTER:\n');
  console.log('  node run-report.cjs                 # Interaktiv meny med 22 rapporter\n');

  console.log('🔍 SPECIALANALYSER (direkta):\n');
  console.log('  node reports/compare-cat-food.cjs   # Jämför kattmat Willys vs ICA');
  console.log('  node reports/compare-monthly.cjs    # Jämför per månad Willys vs ICA');
  console.log('  node reports/analyze-catfood.cjs    # Kattmatanalys');
  console.log('  node reports/analyze-milk.cjs       # Mjölkanalys');
  console.log('  node reports/analyze-coke-zero.cjs  # Coca Cola Zero analys\n');

  console.log('🧹 DATAUNDERHÅLL:\n');
  console.log('  node scripts/check-willys-duplicates.cjs   # Kontrollera Willys-dubbletter');
  console.log('  node scripts/remove-willys-duplicates.cjs  # Ta bort Willys-dubbletter');
  console.log('  npm run remove-duplicates                  # Ta bort alla dubbletter\n');

  console.log('🔧 HJÄLPSKRIPT:\n');
  console.log('  node scripts/show-latest-willys.cjs        # Visa senaste Willys-kvittot');
  console.log('  node scripts/check-dates.cjs               # Inspektera datumfält\n');

  console.log('📁 GENERERADE FILER:\n');
  console.log('  output/willys-analysis.json');
  console.log('  output/ica-analysis.json');
  console.log('  output/combined-analysis.json');
  console.log('  receipts/.last-fetch-willys.json');
  console.log('  receipts/.last-fetch-ica.json\n');

  console.log('💡 TIPS:\n');
  console.log('  • 🚀 Använd sync-kommandon (1-3) för enklast uppdatering!');
  console.log('  • Första gången: "npm run sync-all" eller menyn');
  console.log('  • Veckovis: "npm run sync-all" för att hålla data fräsch');
  console.log('  • Dublikatkontroll: Automatisk i fetch-skript (skippar redan nedladdade)');
  console.log('  • Ta bort .last-fetch för att börja om från början\n');

  console.log('Tryck ENTER för att återgå till menyn...');
}

async function executeCommand(command) {
  if (command === 'exit') {
    console.log('\n👋 Hejdå!\n');
    process.exit(0);
  }

  if (command === 'help') {
    showHelp();
    return;
  }

  if (command === 'update-all') {
    console.log('\n🔄 Kör komplett uppdatering...\n');

    const commands = [
      'npm run willys',
      'npm run ica',
      'npm run update-willys',
      'npm run update-ica',
      'node scripts/remove-duplicates.cjs',
      'npm run analyze-combined'
    ];

    for (const cmd of commands) {
      console.log(`\n▶️  ${cmd}\n`);
      await runCommand(cmd);
    }

    console.log('\n✅ Komplett uppdatering klar!\n');
    console.log('Tryck ENTER för att återgå till menyn...');
    return;
  }

  console.log(`\n▶️  ${command}\n`);
  await runCommand(command);
  console.log('\nTryck ENTER för att återgå till menyn...');
}

function runCommand(command) {
  return new Promise((resolve, reject) => {
    const [cmd, ...args] = command.split(' ');
    const child = spawn(cmd, args, {
      stdio: 'inherit',
      shell: true
    });

    child.on('close', (code) => {
      if (code !== 0) {
        console.log(`\n⚠️  Kommandot avslutades med kod ${code}`);
      }
      resolve(code);
    });

    child.on('error', (error) => {
      console.error(`\n❌ Fel: ${error.message}`);
      reject(error);
    });
  });
}

async function promptUser() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    rl.question('Välj (1-9, d, i, h, q): ', (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase());
    });
  });
}

async function main() {
  while (true) {
    showMenu();

    const choice = await promptUser();
    const selected = options.find(opt => opt.key === choice);

    if (selected) {
      console.clear();
      await executeCommand(selected.command);

      // Vänta på ENTER
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });

      await new Promise((resolve) => {
        rl.question('', () => {
          rl.close();
          resolve();
        });
      });

      console.clear();
    } else {
      console.log('\n⚠️  Ogiltigt val. Försök igen.\n');
      await new Promise(resolve => setTimeout(resolve, 1500));
      console.clear();
    }
  }
}

// Kör menyn
main().catch(error => {
  console.error('❌ Ett fel uppstod:', error);
  process.exit(1);
});
