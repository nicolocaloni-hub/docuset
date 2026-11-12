import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formThemeStyle, safeHexColor, textOnColor } from '../lib/forms';

test('colore del modulo: solo #RRGGBB, testo leggibile sopra', () => {
  assert.equal(safeHexColor('#1F6FEB'), '#1F6FEB');
  for (const bad of ['red', '#fff', '#12345g', 'url(x)', '#000000;background:red', undefined]) assert.equal(safeHexColor(bad), '');
  assert.equal(textOnColor('#FFE14D'), '#18181B', 'giallo chiaro: testo scuro');
  assert.equal(textOnColor('#1F3A8A'), '#FFFFFF', 'blu scuro: testo bianco');
});

test('tema del modulo: DocuSet non cambia nulla, Bianco cambia i colori, un colore sbagliato viene ignorato', () => {
  assert.deepEqual(formThemeStyle(undefined), {});
  assert.equal(formThemeStyle({ theme: 'bianco' })['--color-paper'], '#FFFFFF');
  assert.deepEqual(formThemeStyle({ accentColor: 'blue;}' }), {});
  assert.equal(formThemeStyle({ accentColor: '#1F3A8A' })['--form-accent-text'], '#FFFFFF');
});
