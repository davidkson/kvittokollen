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

### Hämta nya kvitton

```bash
npm run willys  # Hämta Willys-kvitton (automatisk)
npm run ica     # Hämta ICA-kvitton (kräver BankID)
```

### Köra rapporter

Från reports/ katalogen:
```bash
cd reports
node top-products.cjs
node analyze-coke-zero.cjs
node total-spending-monthly.cjs
```

### Uppdatera data

```bash
cd scripts
node update-ica.cjs      # Hämta nya ICA-kvitton
node update-receipts.cjs # Bearbeta Willys-kvitton
```

## Tillgängliga rapporter

- **top-products.cjs** - Mest köpta & dyraste produkter
- **total-spending-monthly.cjs** - Total matbudget månad för månad
- **analyze-coke-zero.cjs** - Coca Cola Zero konsumtion
- **catfood-summary.cjs** - Kattmat sammanställning
- **analyze-milk.cjs** - Mjölk analys

## Data

~195 unika kvitton från Willys och ICA (2025-02 till 2026-02)
