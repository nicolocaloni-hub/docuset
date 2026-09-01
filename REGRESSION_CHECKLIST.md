
# DocuSet Regression Checklist

## Navigation & Core UI
- [x] Sidebar is visible even if no production is selected.
- [x] **Production Switcher**: Sidebar list shows all productions and allows switching.
- [x] **Rename Production**: Header title is editable and saves correctly.
- [x] Menu items click leads to correct sections.

## Dashboard
- [x] **3-Card Layout**: Grid shows Crew count, Template count, and Pending count.
- [x] All 3 dashboard cards are clickable and navigate to correct tabs.

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

## Public Form
- [x] Public signing link renders correctly.
- [x] Signature canvas allows drawing.
- [x] Form submission marked as successful.
