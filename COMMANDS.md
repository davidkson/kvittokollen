# 🚀 Snabbreferens - Kommandon

## 📥 Synkronisera (Fetch + Update)

Dessa kommandon hämtar nya kvitton OCH uppdaterar analysdata i ett steg:

```bash
npm run sync-willys   # Willys: Hämta nya kvitton → Uppdatera analysis.json
npm run sync-ica      # ICA: Hämta nya kvitton → Uppdatera analysis.json (kräver BankID)
npm run sync-all      # Kör både Willys och ICA i sekvens
```

**Rekommendation:** Kör `npm run sync-all` varje vecka för att hålla data uppdaterad!

---

## 🔄 Separata kommandon

### Hämta kvitton (Fetch)
```bash
npm run willys        # Hämta Willys-kvitton (PDF) via Playwright
npm run ica           # Hämta ICA-kvitton (PDF) via Kivra + BankID
```

### Uppdatera analysdata (Update)
```bash
npm run update-willys # Parsera PDF:er → output/willys-analysis.json
npm run update-ica    # Parsera PDF:er → output/ica-analysis.json
```

---

## 📊 Rapporter

### Från root:
```bash
node reports/top-products.cjs
node reports/analyze-coke-zero.cjs
node reports/total-spending-monthly.cjs
node reports/catfood-summary.cjs
node reports/analyze-milk.cjs
```

### Från reports/:
```bash
cd reports
node top-products.cjs
node analyze-coke-zero.cjs
```

### Via run-report menyn:
```bash
node run-report.cjs 1    # Topp produkter
node run-report.cjs 3    # Coca Cola Zero
```

---

## 🔧 Hjälpskript

### Dubbletter
```bash
node scripts/check-willys-duplicates.cjs   # Kontrollera dubbletter
node scripts/remove-willys-duplicates.cjs  # Ta bort dubbletter automatiskt
```

### Visa kvitton
```bash
node scripts/show-latest-willys.cjs        # Visa senaste Willys-kvittot
node scripts/check-dates.cjs               # Kolla datumfält
```

---

## 🎯 Vanliga arbetsflöden

### Första gången
```bash
npm install
npm run install-browser
# Skapa .env med WILLYS_USERNAME, WILLYS_PASSWORD, KIVRA_SSN
npm run sync-all
```

### Veckovis uppdatering
```bash
npm run sync-all
```

### Snabb analys
```bash
npm run sync-willys  # Bara Willys (snabbare)
cd reports
node top-products.cjs
```

### Debug dubbletter
```bash
node scripts/check-willys-duplicates.cjs
node scripts/remove-willys-duplicates.cjs
npm run update-willys
```

---

## 📝 Tips

- **Willys**: Automatisk inloggning med .env credentials, men kräver manuell lösenordsinmatning
- **ICA**: Kräver alltid manuell BankID-autentisering (QR-kod)
- **Duplikatkontroll**: Båda skripten skippar automatiskt redan nedladdade kvitton
- **Backup**: `remove-willys-duplicates.cjs` skapar automatisk backup innan borttagning

---

## ⚙️ Miljövariabler (.env)

```bash
# Willys
WILLYS_USERNAME=ÅÅMMDDXXXX  # Ditt personnummer
WILLYS_PASSWORD=ditt-lösenord

# ICA/Kivra
KIVRA_SSN=ÅÅMMDDXXXX        # Ditt personnummer
```
