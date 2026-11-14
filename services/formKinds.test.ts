import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PRESET_FIELDS, guessFormKind, personFormKind, productionForm } from '../lib/forms';
import type { Person, Production } from '../types';

test('modulo suggerito dal ruolo', () => {
  const kind = (role: string, department = '') => guessFormKind({ role, department });
  assert.equal(kind('Regista'), 'regista');
  assert.equal(kind('Aiuto regista', 'Regia'), 'troupe', 'aiuto regia resta troupe');
  assert.equal(kind('Assistente alla regia'), 'troupe');
  assert.equal(kind('Attrice'), 'attori');
  assert.equal(kind('Protagonista', 'Cast'), 'attori');
  assert.equal(kind('Comparsa'), 'comparse');
  assert.equal(kind('Figurazione speciale'), 'comparse');
  assert.equal(kind('Fonico', 'Suono'), 'troupe');
  assert.equal(kind(''), 'troupe');
});

test('la scelta fatta a mano vince sul ruolo', () => {
  const person = { role: 'Regista', department: '', formKind: 'troupe' } as Person;
  assert.equal(personFormKind(person), 'troupe');
  assert.equal(personFormKind({ ...person, formKind: undefined }), 'regista');
});

test('i moduli mai modificati usano domande e aspetto già salvati', () => {
  const fields = [PRESET_FIELDS[0]];
  const production: Production = {
    id: 'p-1', title: 'Film di prova', createdAt: '2026-01-01T00:00:00.000Z',
    formFields: fields, formAppearance: { theme: 'scuro' },
    forms: { attori: { fields: PRESET_FIELDS, appearance: { theme: 'bianco' } } },
  };
  assert.deepEqual(productionForm(production, 'troupe'), { fields, appearance: { theme: 'scuro' } });
  assert.deepEqual(productionForm(production, 'attori'), { fields: PRESET_FIELDS, appearance: { theme: 'bianco' } });
  assert.deepEqual(productionForm({ id: 'p-2', title: 'Vuota', createdAt: '' }, 'regista'), { fields: PRESET_FIELDS, appearance: {} });
});
