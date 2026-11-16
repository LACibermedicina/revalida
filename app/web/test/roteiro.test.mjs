import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lerRoteiro } from '../src/roteiro.js';

test('roteiro novo: argumentos e uma resposta por pergunta', () => {
  const r = lerRoteiro('## Identificação\nP: Nome?\nR: José.\nP: Idade?\nR: 58 anos.\n## Sintomas associados\nP: Febre?\nR: Não.\nP: Vômito?\nR: Não.');
  assert.deepEqual(r.map((a) => a.nome), ['Identificação', 'Sintomas associados']);
  assert.deepEqual(r[0].itens, [{ p: 'Nome?', r: 'José.' }, { p: 'Idade?', r: '58 anos.' }]);
  assert.equal(r[1].itens.length, 2);
});

test('roteiro antigo em texto corrido não perde conteúdo', () => {
  const r = lerRoteiro('Identificação:\nJosé, 58 anos, motorista.\nSe perguntado sobre febre: nega.\nFuma 1 maço por dia.');
  assert.equal(r[0].nome, 'Identificação');
  assert.deepEqual(r[0].itens[1], { p: 'febre', r: 'nega.' });
  assert.equal(r[0].itens.length, 3);
});
