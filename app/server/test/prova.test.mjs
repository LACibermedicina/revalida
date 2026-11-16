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

import { ehAtendimento, TIPOS_MATERIAL } from '../src/estacao-esquema.js';
test('exame físico: tipo próprio, "outro" com título de exame físico vira exame_fisico, aviso quando falta', () => {
  assert.ok(TIPOS_MATERIAL.includes('exame_fisico'));
  assert.equal(ehAtendimento({ titulo: 'Dor torácica', cenario: 'Pronto-socorro', script_ator: 'x' }), true);
  assert.equal(ehAtendimento({ titulo: 'Comunicação de má notícia', sintese: 'comunicação de má notícia à família', cenario: 'enfermaria' }), false);
});

import { validarFluxo } from '../src/estudo-ia.js';
test('fluxograma: ids únicos, ligações só para frente e para passos existentes', () => {
  const v = validarFluxo({ titulo: 'x', passos: [
    { id: 'a', tipo: 'inicio', texto: 'Começo', proximos: [{ para: 'b' }, { para: 'zz' }] },
    { id: 'b', tipo: 'decisao', texto: 'Grave?', proximos: [{ para: 'c', rotulo: 'sim' }, { para: 'a' }] },
    { id: 'c', tipo: 'qualquer', texto: 'Tratar', proximos: [] },
  ] });
  assert.equal(v.ok, true);
  assert.deepEqual(v.passos[0].proximos, [{ para: 'b', rotulo: '' }]);
  assert.deepEqual(v.passos[1].proximos, [{ para: 'c', rotulo: 'sim' }]);
  assert.equal(v.passos[2].tipo, 'acao');
});
