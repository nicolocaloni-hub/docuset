import assert from 'node:assert/strict';
import test from 'node:test';
import {
  normalizePhone,
  parseCrewTables,
  parsePositionedPdfPages,
  splitPersonName,
} from './documentExtraction';

test('normalizza i numeri italiani senza alterare i prefissi esteri', () => {
  assert.equal(normalizePhone('333 000 0001'), '+393330000001');
  assert.equal(normalizePhone('39 333 000 0001'), '+393330000001');
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
      item('Anna Bassi', 105, 40), item('Organizzatrice', 215, 40), item('di produzione', 215, 54.5), item('345 674 7690', 320, 40),
      item('Valerio Uda', 105, 69), item('Ass. Produzione', 215, 69), item('377 949', 320, 69), item('7102', 320, 83),
    ],
  }]);

  assert.deepEqual(members, [
    { name: 'Anna Bassi', role: 'Organizzatrice di produzione', phone: '345 674 7690' },
    { name: 'Valerio Uda', role: 'Ass. Produzione', phone: '377 949 7102' },
  ]);
});

test('lista troupe con celle centrate: righe sopra il numero, reparto e persona su due reparti', () => {
  const item = (text: string, x: number, top: number, height = 11) => ({ text, x, top, width: text.length * 5, height });
  const members = parsePositionedPdfPages([
    {
      width: 596,
      height: 842,
      items: [
        item('REPARTO', 86, 185), item('NOME', 173, 185), item('RUOLO', 249, 185), item('NUMERO', 320, 185), item('TRASPORTI', 385, 185),
        item('PRODUZIONE', 77, 218),
        item('Produttore', 232, 231.5), item('no set', 77, 241.5), item('Marco Neri', 158, 244.15), item('esecutivo', 232, 244.15), item('3330000001', 317, 244.15),
        item('Laura', 158, 257.55), item('Organizzatrice', 232, 257.55),
        item('Verdi', 158, 270.2), item('di produzione', 232, 270.2), item('3330000002', 317, 270.2),
        item('3330000003', 317, 282.66, 10), item('Anna Bassi', 158, 283.6), item('Direttrice di', 232, 283.6), item('produzione', 232, 296.24),
        item('Sofia', 158, 309.64), item('(considerare', 232, 309.64), item('3330000004', 317, 309.64),
        item('Martini', 158, 322.29), item('ringraziamenti)', 232, 322.29),
        item('SCENEGG.', 77, 360), item('Paolo', 158, 372), item('Sceneggiatore', 232, 372), item('3330000005', 317, 372), item('Ferri', 158, 384.6),
        item('AUDIO', 77, 760),
      ],
    },
    {
      width: 596,
      height: 842,
      items: [item('Luca', 158, 83), item('Fonico di presa', 232, 87), item('3330000006', 317, 83), item('Gallo', 158, 95.7), item('diretta', 232, 99.6),
        item('REGIA', 77, 150), item('Paolo', 158, 170), item('Regista', 232, 170), item('3330000005', 317, 170), item('Ferri', 158, 182.6)],
    },
  ]);

  assert.deepEqual(members.map(m => [m.department, m.name, m.role, m.phone]), [
    ['PRODUZIONE', 'Marco Neri', 'Produttore esecutivo', '3330000001'],
    ['PRODUZIONE', 'Laura Verdi', 'Organizzatrice di produzione', '3330000002'],
    ['PRODUZIONE', 'Anna Bassi', 'Direttrice di produzione', '3330000003'],
    ['PRODUZIONE', 'Sofia Martini', '(considerare ringraziamenti)', '3330000004'],
    ['SCENEGG.', 'Paolo Ferri', 'Sceneggiatore / Regista', '3330000005'],
    ['AUDIO', 'Luca Gallo', 'Fonico di presa diretta', '3330000006'],
  ]);
});

test('separa nome e cognome per il modulo pubblico', () => {
  assert.deepEqual(splitPersonName('Francesco de Simone'), { firstName: 'Francesco', lastName: 'de Simone' });
});

