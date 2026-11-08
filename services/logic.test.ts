import test from 'node:test';
import assert from 'node:assert/strict';
import { buildFormLink, buildMessage, missingVariables, whatsappUrl } from './whatsapp';
import { mergeTallySubmissions } from './tallyMerge';
import type { Person, Production } from '../types';

const production: Production = { id: 'p1', title: 'Film Demo', createdAt: '2026-01-01T00:00:00.000Z', formLink: 'https://tally.so/r/abc' };
const person = (over: Partial<Person> = {}): Person => ({
  id: 'per-1', productionId: 'p1', name: 'Mario Rossi', role: 'DOP', department: 'Camera',
  whatsapp: '+390000000000', hubToken: 'h', ...over,
});

test('buildFormLink appends pid and mid with the right separator', () => {
  assert.equal(buildFormLink('https://tally.so/r/abc', 'p1', 'per-1'), 'https://tally.so/r/abc?pid=p1&mid=per-1');
  assert.equal(buildFormLink('https://tally.so/r/abc?x=1', 'p1', 'per-1'), 'https://tally.so/r/abc?x=1&pid=p1&mid=per-1');
});

test('buildMessage fills first name, title and personal link', () => {
  const message = buildMessage('invite', production, person());
  assert.match(message, /^Ciao Mario!/);
  assert.match(message, /Film Demo/);
  assert.match(message, /pid=p1&mid=per-1/);
});

test('missingVariables lists required placeholders absent from the text', () => {
  assert.deepEqual(missingVariables('Ciao {{nome}} {{link_form}}'), ['{{titolo_produzione}}']);
  assert.deepEqual(missingVariables('{{nome}}{{titolo_produzione}}{{link_form}}'), []);
});

test('whatsappUrl uses the Android intent only on Android', () => {
  assert.ok(whatsappUrl('+39 333', 'hi', 'Mozilla Android').startsWith('intent://send?phone=+39333'));
  assert.ok(whatsappUrl('+39 333', 'hi', 'iPhone').startsWith('https://api.whatsapp.com/send?phone=+39333'));
});

test('mergeTallySubmissions links by mid, then by name, else creates a member', () => {
  const people = [person(), person({ id: 'per-2', name: 'Anna Bianchi' }), person({ id: 'per-3', productionId: 'p2', name: 'Altro' })];
  const base = { submittedAt: '2026-02-01T10:00:00.000Z', role: '', phone: '', productionId: 'p1', formData: { a: '1' } };
  const result = mergeTallySubmissions(people, [
    { ...base, name: 'Nome Diverso', personId: 'per-1' },
    { ...base, name: '  anna   BIANCHI ', personId: '' },
    { ...base, name: 'Nuovo Membro', personId: 'per-3' },
  ], 'p1', () => 'per-new');

  assert.equal(result.updated, 2);
  assert.equal(result.created, 1);
  assert.equal(result.people.find(p => p.id === 'per-1')?.deliveredAt, base.submittedAt);
  assert.equal(result.people.find(p => p.id === 'per-2')?.fieldsJSON, '{"a":"1"}');
  // per-3 esiste in un'altra produzione: l'id non va riusato.
  const created = result.people.find(p => p.name === 'Nuovo Membro');
  assert.equal(created?.id, 'per-new');
  assert.equal(created?.productionId, 'p1');
  assert.equal(people[0].deliveredAt, undefined, 'input must not be mutated');
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
