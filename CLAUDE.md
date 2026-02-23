# Kvitto-analys - Claude Context

Detta projekt analyserar matinköp från Willys och ICA baserat på PDF-kvitton.

## Projektstruktur

```
kvitto-analys/
├── receipts/
│   ├── willys/          # Willys kvitton (PDF + willys-receipts.json)
│   └── ica/             # ICA kvitton (PDF + ica-receipts.json)
├── output/              # Bearbetade analysdata
│   ├── willys-analysis.json
│   └── ica-analysis.json
├── reports/             # 22 analysrapporter (.cjs)
├── scripts/             # 5 bearbetningsskript (.cjs)
├── run-report.cjs       # Huvudmeny för att köra rapporter
└── README.md
```

## Viktiga regler

### 🚫 VIKTIGT: Filtrera bort choklad från mjölkanalyser
När användaren frågar om mjölk, **ALDRIG** inkludera chokladprodukter:
```javascript
// Korrekt filter för mjölk
if (/mjölk/i.test(item.name) && !/choklad|helnöt|daim|katt|kex|cookie|snickers|twix|mars|bounty/i.test(item.name)) {
  // Detta är riktig mjölk
}
```

### Kattmat - ICA-specifika mönster
ICA använder generiska namn istället för varumärken. Använd denna funktion:
```javascript
function isLikelyCatFood(name, price) {
  if (/bröd|ost|yoghurt|korv|hamburgare|pizza|soppa|grädde|smör|sallad|pasta|ris/i.test(name)) {
    return false;
  }
  const hasFish = /tonfisk|lax|fisk/i.test(name);
  const hasTexture = /sås|mousse|filet|paté|gelé/i.test(name);
  const lowPrice = price < 100;
  return hasFish && hasTexture && lowPrice;
}
```

## Data-quirks

### Willys kvitton
- ⚠️ **grandTotal är FELAKTIG** - innehåller antal items, inte totalpris
- ✅ Beräkna totalen från items array istället:
```javascript
function calculateTotal(receipt) {
  if (!receipt.items || !Array.isArray(receipt.items)) return 0;
  return receipt.items.reduce((sum, item) => sum + (item.totalPrice || 0), 0);
}
```

### ICA kvitton
- ✅ grandTotal är KORREKT - använd den
- Generiska produktnamn: "*Sås Tonfisk", "Filet Kyck Tonfisk" etc.
- Negativa belopp = kampanjrabatter (filtrera bort: `item.totalPrice >= 0`)

## Dataset

- **Period**: 2025-02 till 2026-02 (13 månader)
- **Kvitton**: 203 totalt
- **Willys**: 101 kvitton (74,368 SEK)
- **ICA**: 102 kvitton (64,259 SEK)
- **Total utgift**: 138,627 SEK
- **Genomsnitt/månad**: 10,664 SEK
- **Genomsnitt/kvitto**: 683 SEK

## Duplikatkontroll

### Content Signature
Dubbletter identifieras med content signature:
```javascript
const signature = `${date}|${total}|${itemCount}|${itemsSignature}`;
```

### Persistent kontroll i fetch-skript
Både `fetch-receipts.js` (Willys) och `fetch-ica-kivra.js` (ICA) har nu persistent dublikatkontroll:
- Laddar befintliga kvitton vid start från tidigare körningar
- Kollar både API-URL och filnamn mot befintliga
- Skippar automatiskt redan nedladdade kvitton
- Förhindrar dubbletter mellan körningar

### Hjälpskript
- `scripts/check-willys-duplicates.cjs` - Kontrollera dubbletter
- `scripts/remove-willys-duplicates.cjs` - Ta bort dubbletter automatiskt

## Miljövariabler

För att hämta nya kvitton behövs följande miljövariabler (se `.env.example`):

### Willys
```bash
WILLYS_USERNAME=ditt-personnummer
WILLYS_PASSWORD=ditt-lösenord
```

Används av: `fetch-receipts.js` (kör med `npm run willys`)

### ICA/Kivra
```bash
KIVRA_SSN=ÅÅMMDDXXXX
```

Används av: `fetch-ica-kivra.js` (kör med `npm run ica`)
**OBS:** Kräver även manuell BankID-autentisering (kan ej automatiseras)

## Köra rapporter

Från root:
```bash
node run-report.cjs 1    # Topp produkter
node run-report.cjs 3    # Coca Cola Zero
```

Från reports/:
```bash
cd reports
node top-products.cjs
node analyze-coke-zero.cjs
```

## Produktmatchning - vanliga mönster

### Coca Cola Zero
```javascript
const cokePattern = /coca.{0,5}cola.{0,10}zero|cola.{0,5}zero|coke.{0,5}zero|koffeinfri.{0,5}zero/i;
```

### Kattmat
```javascript
const catFoodPattern = /kattmat|felix|whiskas|sheba|gourmet|dreamies|perfect fit|catessy|whis|kattstick|kattsnacks/i;
```

### Mjölk (OBS: exkludera choklad!)
```javascript
const milkPattern = /mjölk/i;
const excludePattern = /choklad|helnöt|daim|katt|kex|cookie|snickers|twix|mars|bounty/i;
```

## Historik - viktiga fynd

- **2026-02-23**: Hittade och tog bort 8 Willys-dubbletter (6,323 SEK)
- **Maj 2025**: Såg dyr ut pga 69 duplikat-kvitton (nu fixat)
- **November 2025**: Lägst månad (6,828 SEK) - ingen hemleverans
- **Hemleveranser**: Kostar typiskt 2,000-3,000 SEK per tillfälle
- **Total spending**: 138,627 SEK över 13 månader (avg 10,664 SEK/månad)
- **Coca Cola Zero**: 3,425 SEK totalt (~189 liter)
- **Kattmat**: 4,881 SEK totalt (348 produkter)

## Filsökvägar i skript

Alla skript i `reports/` och `scripts/` använder relativa paths:
```javascript
// I reports/ och scripts/:
const willysData = JSON.parse(fs.readFileSync('../output/willys-analysis.json', 'utf8'));
const icaData = JSON.parse(fs.readFileSync('../output/ica-analysis.json', 'utf8'));
```

## Git

.gitignore ignorerar:
- Alla PDF-kvitton (känslig data)
- Alla JSON-kvittofiler 
- output/ (genererad data)
- .claude/ (session data)

Skript (.cjs) commitas för att bevara analyskoden.
