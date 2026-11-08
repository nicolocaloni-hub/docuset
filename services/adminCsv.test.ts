import { test } from 'node:test';
import assert from 'node:assert/strict';
import { usersCsv } from '../views/Admin';

test('usersCsv: BOM, separatore ; e virgolette raddoppiate', () => {
  const csv = usersCsv([{ id: '1', email: 'a@b.it', full_name: 'Anna "Nina" Re', created_at: '2026-11-08T10:00:00Z',
    last_sign_in_at: null, productions: 2, people: 5, forms_sent: 4, forms_received: 1 }]);
  assert.ok(csv.startsWith('﻿"Nome";"Email"'));
  assert.equal(csv.split('\r\n')[1], '"Anna ""Nina"" Re";"a@b.it";"2026-11-08";"";"2";"5";"4";"1"');
});
