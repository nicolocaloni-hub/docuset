import test from 'node:test';
import assert from 'node:assert/strict';
import { buildMessage, missingVariables, whatsappUrl } from './whatsapp';
import type { Person, Production } from '../types';

const production: Production = { id: 'p1', title: 'Film Demo', createdAt: '2026-01-01T00:00:00.000Z' };
const person = (over: Partial<Person> = {}): Person => ({
  id: 'per-1', productionId: 'p1', name: 'Mario Rossi', role: 'DOP', department: 'Camera',
  whatsapp: '+390000000000', hubToken: 'h', ...over,
});

test('buildMessage fills first name, title and personal link', () => {
  const message = buildMessage('invite', production, person(), 'https://app.example/m/abc');
  assert.match(message, /^Ciao Mario!/);
  assert.match(message, /Film Demo/);
  assert.match(message, /\/m\/abc/);
});

test('missingVariables lists required placeholders absent from the text', () => {
  assert.deepEqual(missingVariables('Ciao {{nome}} {{link_form}}'), ['{{titolo_produzione}}']);
  assert.deepEqual(missingVariables('{{nome}}{{titolo_produzione}}{{link_form}}'), []);
});

test('whatsappUrl uses the Android intent only on Android', () => {
  assert.ok(whatsappUrl('+39 333', 'hi', 'Mozilla Android').startsWith('intent://send?phone=+39333'));
  assert.ok(whatsappUrl('+39 333', 'hi', 'iPhone').startsWith('https://api.whatsapp.com/send?phone=+39333'));
});

test('buildMessage uses the personal DocuSet link when given', () => {
  const message = buildMessage('invite', production, person(), 'https://app.example/m/abc');
  assert.match(message, /https:\/\/app\.example\/m\/abc/);
  assert.doesNotMatch(message, /pid=/);
});

test('applySubmissions marks only people with a new submission', async () => {
  const { applySubmissions } = await import('../lib/forms');
  const people = [person(), person({ id: 'per-2', deliveredAt: '2026-11-01T00:00:00Z' }), person({ id: 'per-3' })];
  const result = applySubmissions(people, [
    { person_id: 'per-1', production_id: 'p1', data: { CF: 'X' }, submitted_at: '2026-11-08T10:00:00Z' },
    { person_id: 'per-2', production_id: 'p1', data: {}, submitted_at: '2026-11-01T00:00:00Z' },
    { person_id: 'per-3', production_id: 'altra', data: {}, submitted_at: '2026-11-08T10:00:00Z' },
  ]);
  assert.equal(result.changed, 1);
  assert.equal(result.people[0].deliveredAt, '2026-11-08T10:00:00Z');
  assert.equal(result.people[0].fieldsJSON, '{"CF":"X"}');
  assert.equal(result.people[2].deliveredAt, undefined);
  assert.equal(people[0].deliveredAt, undefined, 'input must not be mutated');
});
