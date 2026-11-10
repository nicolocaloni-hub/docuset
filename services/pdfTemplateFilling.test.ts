import assert from 'node:assert/strict';
import test from 'node:test';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import {
  detectPdfTemplatePlacements,
  extractPdfTemplatePages,
  fillPdfTemplateAutomatically,
  formatPdfFieldValue,
  getPdfFormDataValue,
  type PdfTemplatePage,
} from './pdfTemplateFilling';

const item = (text: string, x: number, top: number, width = text.length * 5, height = 10) => ({
  text, x, top, width, height,
});

test('associa sinonimi e formatta le date ISO per il PDF', () => {
  const data = {
    nome: 'Persona Esempio',
    dataNascita: '2000-08-05',
    'Codice Fiscale': 'RSSMRA00A01H501Z',
    Cellulare: '3330000000',
  };

  assert.equal(getPdfFormDataValue(data, 'Nome e Cognome'), 'Persona Esempio');
  assert.equal(getPdfFormDataValue(data, 'C.F.'), 'RSSMRA00A01H501Z');
  assert.equal(getPdfFormDataValue(data, 'Telefono'), '3330000000');
  assert.equal(getPdfFormDataValue(data, 'Cognome'), '');
  assert.equal(formatPdfFieldValue('2000-08-05', 'date'), '05/08/2000');
});

test('trova etichette statiche, campi personalizzati e firma usando le coordinate del testo', () => {
  const pages: PdfTemplatePage[] = [{
    width: 595,
    height: 842,
    items: [
      item('Nome e Cognome*:', 40, 100, 90),
      item('Data di nascita*:', 40, 125, 82),
      item('C.F.: ____________________', 40, 150, 160),
      item('Numero documento:', 40, 175, 96),
      item('Firma Partecipante (leggibile):', 260, 220, 155),
      item('Il nome del progetto non deve essere compilato in questa frase.', 40, 260, 280),
    ],
  }];

  const placements = detectPdfTemplatePlacements(pages, {
    nome: 'Persona Esempio',
    dataNascita: '2000-08-05',
    cf: 'RSSMRA00A01H501Z',
    'Numero documento': 'AA123456',
  }, true);

  assert.deepEqual(placements.map(placement => placement.fieldId), [
    'fullName', 'birthDate', 'taxCode', 'custom:numero documento', 'signature',
  ]);
  assert.equal(placements[1].value, '05/08/2000');
  assert.ok(placements[2].x < 130, 'il valore del C.F. deve iniziare prima della lunga sottolineatura');
  assert.equal(placements.some(placement => placement.top === 260), false, 'il testo discorsivo non è un’etichetta');
});

test('la firma va dopo "Firma del collaboratore", non sopra', () => {
  const pages: PdfTemplatePage[] = [{ width: 595, height: 842, items: [item('Firma del collaboratore', 260, 220, 115)] }];
  const [signature] = detectPdfTemplatePlacements(pages, {}, true);
  assert.equal(signature?.fieldId, 'signature');
  assert.ok(signature.x >= 260 + 115 - 1, 'la firma inizia dopo l’intera etichetta');
});

test('compila un PDF statico ed espone nel testo i valori inseriti', async () => {
  const sourceDoc = await PDFDocument.create();
  const page = sourceDoc.addPage([595, 842]);
  const font = await sourceDoc.embedFont(StandardFonts.Helvetica);
  page.drawText('Nome e Cognome*:', { x: 60, y: 700, size: 11, font });
  page.drawLine({ start: { x: 180, y: 698 }, end: { x: 390, y: 698 }, thickness: 0.5, color: rgb(0, 0, 0) });
  page.drawText('Data di nascita*:', { x: 60, y: 670, size: 11, font });
  page.drawText('Codice Fiscale*:', { x: 60, y: 640, size: 11, font });
  const sourceBytes = await sourceDoc.save();

  const result = await fillPdfTemplateAutomatically(sourceBytes, {
    nome: 'Persona Esempio',
    dataNascita: '2000-08-05',
    cf: 'RSSMRA00A01H501Z',
  });

  assert.deepEqual(result.filledLabels, ['Nome e Cognome', 'Data di nascita', 'Codice Fiscale']);
  const extracted = await extractPdfTemplatePages(result.pdfBytes);
  const text = extracted[0].items.map(textItem => textItem.text).join(' ');
  assert.match(text, /Persona Esempio/);
  assert.match(text, /05\/08\/2000/);
  assert.match(text, /RSSMRA00A01H501Z/);
});

