# ICA Kvittohämtare från Kivra

Automatisk hämtning av ICA-kvitton från Kivra med JavaScript/Playwright.

## Förutsättningar

Du måste ha:
- ICA-kvitton sparade i din Kivra-brevlåda
- BankID för inloggning

## Installation

Samma som för Willys - se [README.md](README.md) för installationsinstruktioner.

## Användning

### Sätt ditt personnummer

**Windows (Command Prompt):**
```cmd
set KIVRA_SSN=ÅÅMMDDXXXX
npm run ica
```

**Windows (PowerShell):**
```powershell
$env:KIVRA_SSN="ÅÅMMDDXXXX"
npm run ica
```

**Linux/Mac:**
```bash
export KIVRA_SSN="ÅÅMMDDXXXX"
npm run ica
```

### Inloggningsprocess

1. Scriptet öppnar Kivra i en webbläsare
2. Fyller i ditt personnummer automatiskt
3. **Du måste själv godkänna inloggningen med BankID** på din telefon eller dator
4. Efter godkänd inloggning fortsätter scriptet automatiskt och hämtar ICA-kvitton

⏱️ **Viktigt:** Du har 2 minuter på dig att godkänna BankID-inloggningen.

## Output

Kvittona sparas i samma `receipts/` mapp som Willys-kvittona:
- `ica-receipts.json` - Sammanfattning med all metadata
- `ica_kvitto_1.pdf` - Varje kvitto som PDF-fil
- `ica_kvitto_2.pdf` - osv.

## Hur det fungerar

Scriptet:
1. Loggar in på Kivra med BankID
2. Navigerar till din ICA-kedja (chains) på Kivra
3. Scrollar för att ladda alla kvitton i listan
4. För varje rad:
   - Klickar på meny-knappen (tre punkter)
   - Klickar på "Ladda ner"
   - Sparar PDF-filen
5. Sparar metadata i JSON-format

### URL-struktur

Scriptet använder en hårdkodad URL till ICA-kedjan:
```
https://inbox.kivra.com/user/{user-id}/chains/{chain-id}
```

Om din URL är annorlunda, uppdatera `CONFIG.icaChainUrl` i `fetch-ica-kivra.js`.

## Felsökning

### Problemlösning

**Problem:** "Inga ICA-dokument hittades"
- Kontrollera att du faktiskt har ICA-kvitton i din Kivra
- ICA måste skicka kvitton till Kivra (kräver att du är medlem och har valt att få digitala kvitton)

**Problem:** "BankID-autentisering misslyckades"
- Kontrollera att du har BankID installerat
- Se till att du godkänner inloggningen inom 2 minuter
- Starta om scriptet och försök igen

**Problem:** Scriptet hittar dokument men kan inte ladda ner dem
- Kivra kan ha ändrat sin webbplats-struktur
- En skärmdump sparas automatiskt: `kivra-error-screenshot.png`

### Debug-läge

Om något går fel:
- Scriptet sparar automatiskt en skärmdump: `kivra-error-screenshot.png`
- Scriptet körs med `headless: false` så du kan se vad som händer i webbläsaren

## Säkerhet

⚠️ **VIKTIGT:**
- Scriptet använder BankID för säker inloggning
- Ditt personnummer lagras bara som miljövariabel (inte i kod)
- `.gitignore` är konfigurerad för att skydda känslig data
- Ladda aldrig upp dina kvitton eller personnummer till Git

## Begränsningar

- Kräver manuell BankID-godkännande (kan inte automatiseras av säkerhetsskäl)
- Fungerar bara om ICA skickar kvitton till din Kivra
- Beroende av Kivras webbplats-struktur (kan behöva uppdateras om Kivra ändrar sin design)

## Jämförelse med Willys

| Funktion | Willys | ICA (Kivra) |
|----------|--------|-------------|
| Inloggning | Personnummer + lösenord | BankID |
| Automatisering | Helt automatisk | Kräver manuell BankID |
| Datumintervall | Kan välja månader bakåt | Alla tillgängliga i Kivra |
| Kvitto-typ | Butiksköp + e-handel | Endast från Kivra |
