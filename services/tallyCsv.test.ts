import test from 'node:test';
import assert from 'node:assert/strict';
import { extractCsvFileUrl, keepLatestTallySubmissions, parseTallyCsv } from './tallyCsv';

test('parses a standard Tally CSV and preserves form answers and signature URL', () => {
  const csv = '\uFEFFSubmission ID,Respondent ID,Submitted at,Nome e Cognome,Data di Nascita,Luogo di Nascita,Firma Qui,pid,mid,Ruolo,Telefono\r\n' +
    'sub-demo,res-demo,"Jun 3, 2026, 10:34 PM",Persona Esempio,2000-01-01,Città Demo,https://example.com/signature-demo.png,p1,per-demo,Reparto Demo,000 000 0000\r\n';

  const result = parseTallyCsv(csv);
  assert.equal(result.delimiter, ',');
  assert.equal(result.submissions.length, 1);
  assert.equal(result.submissions[0].name, 'Persona Esempio');
  assert.equal(result.submissions[0].personId, 'per-demo');
  assert.equal(result.submissions[0].productionId, 'p1');
  assert.equal(result.submissions[0].role, 'Reparto Demo');
  assert.equal(result.submissions[0].phone, '000 000 0000');
  assert.equal(result.submissions[0].formData.nome, 'Persona Esempio');
  assert.equal(result.submissions[0].formData.dataNascita, '2000-01-01');
  assert.equal(result.submissions[0].formData['Luogo di Nascita'], 'Città Demo');
  assert.equal(result.submissions[0].formData['Firma Qui'], 'https://example.com/signature-demo.png');
  assert.equal(result.submissions[0].formData['Submission ID'], undefined);
});

test('supports semicolon delimiters, separate first and last name, and quoted new lines', () => {
  const csv = 'Submitted at;Nome;Cognome;Data nascita;Luogo nascita;Note\n' +
    '2026-08-01T12:00:00Z;Nome;Esempio;2000-01-01;Città Demo;"Riga uno\nRiga due"\n';

  const result = parseTallyCsv(csv);
  assert.equal(result.delimiter, ';');
  assert.equal(result.submissions[0].name, 'Nome Esempio');
  assert.equal(result.submissions[0].formData['Note'], 'Riga uno\nRiga due');
  assert.equal(result.submissions[0].formData.luogoNascita, 'Città Demo');
});

test('accepts a single generic Name column', () => {
  const result = parseTallyCsv('Submitted at,Name,Place of birth\n2026-08-01T12:00:00Z,Example Person,Demo City\n');
  assert.equal(result.submissions[0].name, 'Example Person');
  assert.equal(result.submissions[0].formData.luogoNascita, 'Demo City');
});

test('extracts signature links from common exported cell formats', () => {
  assert.equal(
    extractCsvFileUrl('[firma-demo.png](https://example.com/signature-demo.png?token=test)'),
    'https://example.com/signature-demo.png?token=test'
  );
  assert.equal(
    extractCsvFileUrl('[{"name":"firma-demo.png","url":"https://example.com/signature-demo.png"}]'),
    'https://example.com/signature-demo.png'
  );
  assert.equal(extractCsvFileUrl('javascript:alert(1)'), '');
});

test('keeps only the newest response for the same member', () => {
  const parsed = parseTallyCsv(
    'Submitted at,Nome e Cognome,mid,Luogo di Nascita\n' +
    '2026-01-01T12:00:00Z,Persona Esempio,per-demo,Città Uno\n' +
    '2026-02-01T12:00:00Z,Persona Esempio,per-demo,Città Due\n'
  );

  const latest = keepLatestTallySubmissions(parsed.submissions);
  assert.equal(latest.length, 1);
  assert.equal(latest[0].formData['Luogo di Nascita'], 'Città Due');
});

test('reports a clear error when the CSV has no name column', () => {
  assert.throws(
    () => parseTallyCsv('Submitted at,Email\n2026-01-01,user@example.com\n'),
    /colonna per il nome/
  );
});
