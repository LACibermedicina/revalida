import test from 'node:test';
import assert from 'node:assert/strict';
import { layout3D, projetar, escolherNo, faixaDesempenho } from '../src/grafo3d.js';

const nos = ['a', 'b', 'c', 'd', 'e', 'f'].map((id) => ({ id, relevancia: 3 }));
const arestas = [['a', 'b'], ['b', 'c'], ['c', 'a'], ['d', 'e'], ['e', 'f'], ['c', 'd']].map(([de, para]) => ({ de, para, peso: 0.5 }));

test('layout: determinístico, finito, dentro da esfera unitária e sem nós sobrepostos', () => {
  const p1 = layout3D(nos, arestas), p2 = layout3D(nos, arestas);
  assert.deepEqual(p1, p2);
  for (const v of Object.values(p1)) { assert.equal(v.length, 3); assert.ok(v.every(Number.isFinite)); assert.ok(Math.hypot(...v) <= 1.0001); }
  const ids = Object.keys(p1);
  for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) assert.ok(Math.hypot(...p1[ids[i]].map((v, c) => v - p1[ids[j]][c])) > 0.05, `${ids[i]} e ${ids[j]} muito juntos`);
});

test('layout: nós ligados ficam mais perto do que nós sem ligação (média)', () => {
  const p = layout3D(nos, arestas, { iteracoes: 300 });
  const dist = (a, b) => Math.hypot(...p[a].map((v, c) => v - p[b][c]));
  const lig = arestas.map((a) => dist(a.de, a.para)).reduce((s, x) => s + x, 0) / arestas.length;
  const set = new Set(arestas.map((a) => [a.de, a.para].sort().join()));
  const outros = []; for (const a of nos) for (const b of nos) if (a.id < b.id && !set.has([a.id, b.id].join())) outros.push(dist(a.id, b.id));
  assert.ok(lig < outros.reduce((s, x) => s + x, 0) / outros.length, 'as arestas puxam os vizinhos');
});

test('layout: casos de borda (vazio, um nó, aresta para nó que não existe, 300 nós no tempo)', () => {
  assert.deepEqual(layout3D([], []), {});
  assert.equal(Object.keys(layout3D([{ id: 'x' }], [{ de: 'x', para: 'fantasma' }])).length, 1);
  const muitos = Array.from({ length: 300 }, (_, i) => ({ id: `n${i}` })); const t0 = Date.now();
  const p = layout3D(muitos, muitos.slice(1).map((n, i) => ({ de: `n${i}`, para: n.id })));
  assert.equal(Object.keys(p).length, 300); assert.ok(Date.now() - t0 < 5000, `demorou ${Date.now() - t0}ms`);
});

test('projeção: perspectiva (mais perto = maior), rotação muda a tela e o toque acerta o nó da frente', () => {
  const pos = { perto: [0, 0, 0.8], longe: [0, 0, -0.8], dir: [0.8, 0, 0] };
  const pr = projetar(pos, { largura: 400, altura: 300 });
  assert.ok(pr.perto.s > pr.longe.s); assert.ok(pr.perto.z > pr.longe.z); assert.equal(Math.round(pr.perto.x), 200);
  const girado = projetar(pos, { rotY: Math.PI / 2, largura: 400, altura: 300 });
  assert.ok(Math.abs(girado.dir.x - pr.dir.x) > 50);
  const lista = [{ id: 'perto', relevancia: 3 }, { id: 'longe', relevancia: 3 }];
  assert.equal(escolherNo(pr, lista, 200, 150), 'perto', 'sobrepostos: vence o da frente');
  assert.equal(escolherNo(pr, lista, 5, 5), null);
  assert.ok(projetar(pos, { zoom: 2, largura: 400, altura: 300 }).dir.x > pr.dir.x);
});

test('faixas de desempenho', () => { assert.deepEqual([null, 0.2, 0.7, 0.95].map(faixaDesempenho), ['sem', 'baixo', 'medio', 'alto']); });
