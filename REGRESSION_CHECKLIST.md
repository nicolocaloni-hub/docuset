
# DocuSet Regression Checklist

## Navigation & Core UI
- [x] Sidebar is visible even if no production is selected.
- [x] **Production Switcher**: Sidebar list shows all productions and allows switching.
- [x] **Rename Production**: Header title is editable and saves correctly.
- [x] Menu items click leads to correct sections.

## Dashboard (Situazione)
- [x] Contatore consegnati/totale con barra a strisce per stato.
- [x] Lista "Da sollecitare" con pulsante WhatsApp; avviso se manca il link Tally.

## People (Cast & Crew)
- [x] List of members is visible for the active production.
- [x] "Nuovo" button opens modal and creates member.
- [x] **WhatsApp INVIA**: Send icon opens WhatsApp with the correct Hub link.
- [x] **Tally CSV**: "Importa CSV" legge le risposte senza API key e collega i membri per ID o nome.
- [x] **Import DOCX/PDF**: Button exists and opens import modal.
- [x] Action Column: "Copia Link" works.
- [x] Action Column: "Elimina" works.

## Templates (Library)
- [x] Header: "Importa Template" button is visible and works.
- [x] Action Column: "Visualizza" opens PDF.
- [x] Action Column: "Elimina" removes template.

## Responses
- [x] Il CSV conserva i campi personali e i link alle firme.
- [x] Il pulsante per generare e scaricare il PDF compilato resta disponibile per ogni risposta.

## Productions
- [x] "Nuovo Progetto" modal works.
- [x] Clicking a project card switches the global active production.

## Dati e accesso
- [x] Senza variabili Supabase l'app lavora in locale (localStorage) come prima.
- [x] Con Supabase: login via link email, dati per utente, template in bucket privato.
- [x] Al primo accesso i dati del browser vengono importati online.
- [x] Backup JSON: esporta e ripristina dalle Impostazioni.
- [x] Su telefono: navigazione in basso e pulsante + per aggiungere persone.
