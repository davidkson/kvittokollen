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
    label: '📥 Hämta Willys-kvitton',
    command: 'npm run willys',
    description: 'Hämtar kvitton från Willys.se (inkrementellt om .last-fetch finns)'
  },
  {
    key: '2',
    label: '📥 Hämta ICA-kvitton',
    command: 'npm run ica',
    description: 'Hämtar kvitton från Kivra/ICA (inkrementellt om .last-fetch finns)'
  },
  {
    key: '3',
    label: '📊 Analysera Willys',
    command: 'npm run analyze-willys',
    description: 'Analyserar alla Willys-kvitton → willys-analysis.json'
  },
  {
    key: '4',
    label: '📊 Analysera ICA',
    command: 'npm run analyze-ica',
    description: 'Analyserar alla ICA-kvitton → ica-analysis.json'
  },
  {
    key: '5',
    label: '📊 Kombinerad analys',
    command: 'npm run analyze-combined',
    description: 'Kombinerar Willys + ICA → combined-analysis.json'
  },
  {
    key: '6',
    label: '⚡ Uppdatera Willys (snabbt)',
    command: 'npm run update-willys',
    description: 'Uppdaterar Willys-analys med nya kvitton (inkrementellt)'
  },
  {
    key: '7',
    label: '⚡ Uppdatera ICA (snabbt)',
    command: 'npm run update-ica',
    description: 'Uppdaterar ICA-analys med nya kvitton (inkrementellt)'
  },
  {
    key: '8',
    label: '🔄 Komplett uppdatering (allt)',
    command: 'update-all',
    description: 'Hämtar + uppdaterar Willys & ICA + kombinerad analys'
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

  console.log('🛒 HÄMTA KVITTON:\n');
  console.log('  npm run willys              # Hämta Willys-kvitton');
  console.log('  npm run willys -- 6         # Hämta 6 månader (första gången)');
  console.log('  npm run ica                 # Hämta ICA-kvitton');
  console.log('  npm run ica -- 3            # Hämta 3 månader (första gången)\n');

  console.log('📊 ANALYSERA:\n');
  console.log('  npm run analyze-willys      # Analysera alla Willys-kvitton');
  console.log('  npm run analyze-ica         # Analysera alla ICA-kvitton');
  console.log('  npm run analyze-combined    # Kombinerad analys (båda)\n');

  console.log('⚡ SNABB UPPDATERING:\n');
  console.log('  npm run update-willys       # Uppdatera Willys (bara nya)');
  console.log('  npm run update-ica          # Uppdatera ICA (bara nya)\n');

  console.log('📊 RAPPORTER:\n');
  console.log('  node run-report.cjs                 # Interaktiv meny med 22 rapporter\n');

  console.log('🔍 SPECIALANALYSER (direkta):\n');
  console.log('  node reports/compare-cat-food.cjs   # Jämför kattmat Willys vs ICA');
  console.log('  node reports/compare-monthly.cjs    # Jämför per månad Willys vs ICA');
  console.log('  node reports/analyze-catfood.cjs    # Kattmatanalys');
  console.log('  node reports/analyze-milk.cjs       # Mjölkanalys');
  console.log('  node reports/analyze-coke-zero.cjs  # Coca Cola Zero analys\n');

  console.log('🧹 DATAUNDERHÅLL:\n');
  console.log('  npm run remove-duplicates   # Ta bort dubblettkvitton');
  console.log('  node scripts/check-duplicates.cjs   # Kontrollera om dubbletter finns\n');

  console.log('📁 GENERERADE FILER:\n');
  console.log('  output/willys-analysis.json');
  console.log('  output/ica-analysis.json');
  console.log('  output/combined-analysis.json');
  console.log('  receipts/.last-fetch-willys.json');
  console.log('  receipts/.last-fetch-ica.json\n');

  console.log('💡 TIPS:\n');
  console.log('  • Första gången: kör "Hämta" → "Analysera"');
  console.log('  • Daglig uppdatering: använd "Uppdatera" (snabbare!)');
  console.log('  • Komplett uppdatering inkluderar automatisk dubblettborttagning');
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
