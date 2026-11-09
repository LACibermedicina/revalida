import test from 'node:test';
import assert from 'node:assert/strict';
import { similaridade, agruparSimilares, estadoInicial, sincronizar, empilhar, destacar, mover, alternar, posicoes, pilhaSob, organizar, hidratar, serializar, desagrupar, agrupar, altura } from '../src/baralho.js';

const dim = { largura: 700, larg: 200, alt: 300 };
const itens = [
  { id: 'a', titulo: 'Pré-eclâmpsia', area: 'ginecologia_obstetricia' }, { id: 'b', titulo: 'Eclâmpsia e pré-eclâmpsia grave', area: 'ginecologia_obstetricia' },
  { id: 'c', titulo: 'Hipertensão arterial', area: 'clinica_medica' }, { id: 'd', titulo: 'Crise hipertensiva', area: 'clinica_medica' },
  { id: 'e', titulo: 'Apendicite aguda', area: 'cirurgia' },
];

test('similaridade: mesmo tema escrito de formas diferentes, e temas sem relação', () => {
  assert.ok(similaridade(itens[0], itens[1]) >= 0.34);
  assert.ok(similaridade(itens[2], itens[3]) >= 0.34, 'hipertensão ~ hipertensiva (radical)');
  assert.equal(similaridade(itens[0], itens[4]), 0);
  assert.equal(similaridade({ titulo: 'Sepse' }, { titulo: 'sepse' }), 1);
});

test('agruparSimilares junta os parecidos e deixa os outros sozinhos', () => {
  const g = agruparSimilares(itens);
  assert.deepEqual(g, [['a', 'b'], ['c', 'd'], ['e']]);
});

test('organizar: grade que cabe na largura (sem estourar para o lado); pilha aberta usa a linha toda', () => {
  const e = estadoInicial(itens, dim);
  assert.equal(e.pilhas.length, 5);
  assert.ok(e.pilhas.every((p) => p.x + dim.larg <= dim.largura), 'nenhuma carta passa da largura');
  assert.equal(e.pilhas[0].y, 0); assert.equal(e.pilhas[3].y, dim.alt + 16, 'quebra de linha com 3 colunas');
  const estreito = estadoInicial(itens, { ...dim, largura: 220 });
  assert.ok(estreito.pilhas.every((p) => p.x === 0), 'uma coluna em tela estreita');
});

test('empilhar, destacar e abrir: cartas viram pilha, saem da pilha e se espalham', () => {
  let e = estadoInicial(itens, dim);
  const [pa, pb] = [e.pilhas[0].id, e.pilhas[1].id];
  e = empilhar(e, pb, pa);
  assert.equal(e.pilhas.length, 4); assert.deepEqual(e.pilhas[0].ids, ['a', 'b']); assert.equal(e.manual, true);
  const pos = posicoes(e, dim); assert.equal(pos.b.topo, true); assert.equal(pos.a.topo, false); assert.ok(pos.b.z > pos.a.z);
  e = alternar(e, pa, dim);
  const aberta = posicoes(e, dim); assert.ok(aberta.a.x !== aberta.b.x && aberta.a.topo && aberta.b.topo, 'aberta: lado a lado e todas clicáveis');
  assert.ok(aberta.b.x + dim.larg <= dim.largura + 1, 'aberta cabe na largura');
  e = destacar(e, 'a', 400, 500, dim);
  assert.equal(e.pilhas.length, 5); assert.deepEqual(e.pilhas.find((p) => p.ids[0] === 'a'), { ...e.pilhas.find((p) => p.ids[0] === 'a'), x: 400, y: 500 });
  assert.equal(e.pilhas.find((p) => p.ids.includes('b')).ids.length, 1);
});

test('mover mantém a pilha dentro da área; pilhaSob acha o alvo do soltar', () => {
  let e = estadoInicial(itens, dim);
  e = mover(e, e.pilhas[0].id, 9999, -50, dim);
  assert.equal(e.pilhas[0].x, dim.largura - dim.larg); assert.equal(e.pilhas[0].y, 0);
  const alvo = e.pilhas[2]; assert.equal(pilhaSob(e, alvo.x + 10, alvo.y + 10, dim, e.pilhas[0].id), alvo.id);
  assert.equal(pilhaSob(e, 5000, 5000, dim), null);
});

test('sincronizar: itens novos entram, os que saíram somem, o arranjo manual é mantido', () => {
  let e = estadoInicial(itens, dim); e = empilhar(e, e.pilhas[1].id, e.pilhas[0].id);
  const s = sincronizar(e, [...itens.filter((i) => i.id !== 'e'), { id: 'f', titulo: 'Sepse' }], dim);
  const ids = s.pilhas.flatMap((p) => p.ids).sort(); assert.deepEqual(ids, ['a', 'b', 'c', 'd', 'f']);
  assert.deepEqual(s.pilhas.find((p) => p.ids.includes('a')).ids, ['a', 'b'], 'pilha preservada');
  const livre = sincronizar(estadoInicial(itens, dim), itens.slice().reverse(), dim); assert.equal(livre.pilhas[0].ids[0], 'e', 'sem arranjo manual segue a ordem dos itens');
});

test('agrupar/desagrupar e persistência (ida e volta; texto corrompido é ignorado)', () => {
  let e = agrupar(estadoInicial(itens, dim), itens, dim); assert.equal(e.pilhas.length, 3);
  e = desagrupar(e, dim); assert.equal(e.pilhas.length, 5);
  assert.deepEqual(hidratar(serializar(e)).pilhas.map((p) => p.ids), e.pilhas.map((p) => p.ids));
  assert.equal(hidratar('{"pilhas":"x"}'), null); assert.equal(hidratar('nao json'), null);
  assert.ok(altura(e, dim) >= dim.alt + 20);
  assert.ok(organizar([], dim).length === 0);
});
