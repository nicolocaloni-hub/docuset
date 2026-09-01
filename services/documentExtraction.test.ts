import assert from 'node:assert/strict';
import test from 'node:test';
import {
  normalizePhone,
  parseCrewTables,
  parsePositionedPdfPages,
  splitPersonName,
} from './documentExtraction';

test('normalizza i numeri italiani senza alterare i prefissi esteri', () => {
  assert.equal(normalizePhone('349 456 1834'), '+393494561834');
  assert.equal(normalizePhone('39 349 456 1834'), '+393494561834');
  assert.equal(normalizePhone('+34 617 981 248'), '+34617981248');
  assert.equal(normalizePhone('0033 612345678'), '+33612345678');
});

test('estrae le righe valide dalle tabelle DOCX e ignora quelle incomplete', () => {
  const members = parseCrewTables([[
    ['REPARTI', 'NOME', 'RUOLO', 'NUMERO', 'NOTE'],
    ['REGIA', '', '', '', ''],
    ['', 'Marta Fiore', 'Assistente alla regia', '334 884 2096', ''],
    ['', '', 'Ass. Montatore', '', ''],
    ['', 'Julia Callis', '2° Ass. operatore', '+34 617981248', ''],
  ]]);

  assert.deepEqual(members, [
    { name: 'Marta Fiore', role: 'Assistente alla regia', phone: '334 884 2096', department: 'REGIA' },
    { name: 'Julia Callis', role: '2° Ass. operatore', phone: '+34 617981248', department: 'REGIA' },
  ]);
});

test('ricostruisce celle PDF su più righe usando intestazioni e coordinate', () => {
  const item = (text: string, x: number, top: number) => ({ text, x, top, width: text.length * 5, height: 10 });
  const members = parsePositionedPdfPages([{
    width: 500,
    height: 300,
    items: [
      item('REPARTI', 20, 10), item('NOME', 120, 10), item('RUOLO', 230, 10), item('NUMERO', 330, 10), item('NOTE', 420, 10),
      item('Gaia Caputo', 105, 40), item('Organizzatrice', 215, 40), item('di produzione', 215, 54.5), item('345 674 7690', 320, 40),
      item('Valerio Uda', 105, 69), item('Ass. Produzione', 215, 69), item('377 949', 320, 69), item('7102', 320, 83),
    ],
  }]);

  assert.deepEqual(members, [
    { name: 'Gaia Caputo', role: 'Organizzatrice di produzione', phone: '345 674 7690' },
    { name: 'Valerio Uda', role: 'Ass. Produzione', phone: '377 949 7102' },
  ]);
});

test('separa nome e cognome per il modulo pubblico', () => {
  assert.deepEqual(splitPersonName('Francesco de Simone'), { firstName: 'Francesco', lastName: 'de Simone' });
});

