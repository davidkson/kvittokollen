# Kvitto-analys

Analysverktyg för matinköp från Willys och ICA.

## Struktur

```
kvitto-analys/
├── receipts/
│   ├── willys/          # Willys kvitton (PDF + JSON)
│   │   ├── kvitto_*.pdf
│   │   ├── willys-receipts.json
│   │   └── .last-fetch-willys.json
│   └── ica/             # ICA kvitton (PDF + JSON)
│       ├── ica_*.pdf
│       ├── ica-receipts.json
│       └── .last-fetch-ica.json
├── output/              # Bearbetade analysdata
│   ├── willys-analysis.json
│   └── ica-analysis.json
├── reports/             # Alla analysrapporter
│   ├── analyze-coke-zero.cjs
│   ├── total-spending-monthly.cjs
│   ├── top-products.cjs
│   ├── catfood-summary.cjs
│   └── ... (fler rapporter)
├── scripts/             # Bearbetningsskript
│   ├── update-ica.cjs
│   ├── update-receipts.cjs
│   ├── check-duplicates.cjs
│   └── remove-duplicates.cjs
└── menu.cjs             # Huvudmeny
```

## Installation

```bash
npm install
npm run install-browser  # Installera Playwright Chromium för kvittohämtning
```

### Miljövariabler

För att hämta nya kvitton, skapa en `.env` fil (se `.env.example`):

```bash
# Willys inloggning
WILLYS_USERNAME=ditt-personnummer
WILLYS_PASSWORD=ditt-lösenord

# ICA/Kivra (kräver även BankID)
KIVRA_SSN=ÅÅMMDDXXXX
```

## Användning

### 🚀 Snabbkommandon (rekommenderat)

```bash
# Hämta nya kvitton OCH uppdatera analysdata i ett kommando
npm run sync-willys  # Willys: fetch + update
npm run sync-ica     # ICA: fetch + update (kräver BankID)
npm run sync-all     # Både Willys och ICA
```

### Separata kommandon

**Hämta kvitton:**
```bash
npm run willys  # Hämta Willys-kvitton
npm run ica     # Hämta ICA-kvitton (kräver BankID)
```

**Uppdatera analysdata:**
```bash
npm run update-willys  # Bearbeta Willys PDF:er → output/willys-analysis.json
npm run update-ica     # Bearbeta ICA PDF:er → output/ica-analysis.json
```

### Köra rapporter

```bash
cd reports
node top-products.cjs
node analyze-coke-zero.cjs
node total-spending-monthly.cjs
```

## Tillgängliga rapporter

- **top-products.cjs** - Mest köpta & dyraste produkter
- **total-spending-monthly.cjs** - Total matbudget månad för månad
- **analyze-coke-zero.cjs** - Coca Cola Zero konsumtion
- **catfood-summary.cjs** - Kattmat sammanställning
- **analyze-milk.cjs** - Mjölk analys

## Data

- **203 kvitton** från Willys (101) och ICA (102)
- **Period**: 2025-02 till 2026-02 (13 månader)
- **Total utgift**: 138,627 SEK
- **Genomsnitt**: 10,664 SEK/månad

### Dublikatkontroll

Både Willys och ICA fetch-skripten har automatisk dublikatkontroll:
- Laddar befintliga kvitton vid start
- Skippar automatiskt redan nedladdade kvitton
- Persistent mellan körningar

**Hjälpskript:**
```bash
node scripts/check-willys-duplicates.cjs  # Kontrollera dubbletter
node scripts/remove-willys-duplicates.cjs # Ta bort dubbletter
```
