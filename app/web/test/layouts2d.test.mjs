import test from 'node:test';
import assert from 'node:assert/strict';
import { componentes, layoutPlano, layoutGrafo, layoutFluxo, layoutMental, ajustarAoQuadro } from '../src/layouts2d.js';

const nos = ['A', 'B', 'C', 'D', 'E', 'F', 'Z'].map((id, i) => ({ id, nome: `Tema ${id}`, relevancia: 3 + (i % 2) }));
const arestas = [['A', 'B'], ['A', 'C'], ['B', 'D'], ['C', 'E'], ['E', 'F']].map(([de, para]) => ({ de, para, peso: 0.5 }));   // Z fica solto

test('componentes: grupo maior primeiro e nó solto à parte', () => {
  const c = componentes(nos, arestas); assert.equal(c.length, 2); assert.equal(c[0].length, 6); assert.deepEqual(c[1], ['Z']);
});
test('todos os layouts posicionam todos os nós, finitos e sem sobreposição exata', () => {
  for (const f of [layoutPlano, layoutGrafo, layoutFluxo, layoutMental]) {
    const { pos } = f(nos, arestas); assert.equal(Object.keys(pos).length, nos.length, f.name);
    const vistos = new Set(); for (const [x, y] of Object.values(pos)) { assert.ok(Number.isFinite(x) && Number.isFinite(y), f.name); const k = `${x.toFixed(3)},${y.toFixed(3)}`; assert.ok(!vistos.has(k), `${f.name} sobrepôs ${k}`); vistos.add(k); }
  }
});
test('fluxograma: camadas crescem da raiz para os filhos e as setas vão do nível menor para o maior', () => {
  const r = layoutFluxo(nos, arestas);
  assert.equal(r.niveis.get(r.raizes[0]), 0);
  for (const a of r.arestas) assert.ok(r.niveis.get(a.de) <= r.niveis.get(a.para));
  for (const a of r.arestas) assert.ok(r.pos[a.para][0] >= r.pos[a.de][0], 'x cresce com o nível');
  assert.equal(r.pos[r.raizes[0]][0], 0);
});
test('mapa mental: raiz no centro e filhos em anel crescente; ramos coloridos por filho da raiz', () => {
  const r = layoutMental(nos, arestas); const c = r.raizes[0]; assert.deepEqual(r.pos[c], [0, 0]);
  const dist = (id) => Math.hypot(...r.pos[id]);
  for (const a of r.ramos) assert.ok(dist(a.para) >= dist(a.de) - 1e-9, 'filhos nunca mais perto que o pai');
  assert.ok(r.ramos.length >= 5);
  const filhosDaRaiz = r.ramos.filter((a) => a.de === c).map((a) => r.ramo.get(a.para)); assert.equal(new Set(filhosDaRaiz).size, filhosDaRaiz.length, 'um ramo por filho da raiz');
});
test('ajustar ao quadro cabe na área com margem e preserva a proporção', () => {
  const { pos } = layoutGrafo(nos, arestas); const { pts } = ajustarAoQuadro(pos, 400, 300, 20);
  for (const p of Object.values(pts)) { assert.ok(p.x >= 19.9 && p.x <= 380.1 && p.y >= 19.9 && p.y <= 280.1); }
  assert.deepEqual(layoutGrafo(nos, arestas), layoutGrafo(nos, arestas), 'determinístico');
});
