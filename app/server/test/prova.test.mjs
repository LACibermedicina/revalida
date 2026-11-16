import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validarConfig } from '../src/config.js';

test('data da prova: aceita dia ou dia+hora; recusa lixo; nome curto sem quebras', () => {
  assert.equal(validarConfig('PROVA_DATA', '2027-03-27'), '2027-03-27');
  assert.equal(validarConfig('PROVA_DATA', '2027-03-27T13:30'), '2027-03-27T13:30');
  assert.equal(validarConfig('PROVA_DATA', '2027-03-27 13:30'), '2027-03-27T13:30');
  for (const ruim of ['27/03/2027', '2027-13-45', 'amanhã', '2027-03-27T25']) assert.throws(() => validarConfig('PROVA_DATA', ruim));
  assert.equal(validarConfig('PROVA_NOME', 'Revalida 2026 · 2ª etapa'), 'Revalida 2026 · 2ª etapa');
  assert.throws(() => validarConfig('PROVA_NOME', 'a\nb'));
  assert.throws(() => validarConfig('PROVA_NOME', 'x'.repeat(81)));
});
