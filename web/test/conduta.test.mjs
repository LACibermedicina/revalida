import test from 'node:test';
import assert from 'node:assert/strict';
import { analisar, avaliarTrilha, montarGrafo, posicoes3D, construir, tem, N, TRILHA } from '../src/conduta.js';

const TRAUMA = 'Bom dia, meu nome é Lucas, sou médico. Qual o seu nome? Paciente vítima de colisão de moto, hipotensão e murmúrio vesicular abolido com desvio de traqueia. Mantenho via aérea com colar cervical, ausculta, oxigênio em máscara, dois acessos calibrosos e cristaloide. FAST negativo, paciente estável. Transferência para o centro cirúrgico.';

test('negação simples não conta o achado ("sem febre")', () => {
  assert.equal(tem(/febre/, N('paciente sem febre')), false);
  assert.equal(tem(/febre/, N('paciente com febre alta')), true);
  assert.equal(analisar('sem febre, sem dor no peito').top, null);
});

test('sem achados: sem hipótese nem conduta; com achados: hipótese e conduta ordenadas', () => {
  const vazio = analisar('bom dia'); assert.equal(vazio.top, null); assert.equal(vazio.steps.length, 0);
  const r = analisar(TRAUMA); assert.equal(r.top, 'tr'); assert.ok(r.hit.some((f) => f[0] === 'trauma/colisão/queda'));
  const por = Object.fromEntries(r.steps.map((s) => [s.t.slice(0, 12), s.st]));
  assert.equal(r.steps[0].st, 'done'); // via aérea
  const cc = r.steps.find((s) => s.t.startsWith('Centro cirúrgico')); assert.equal(cc.st, 'done', 'o candidato citou o centro cirúrgico');
  const tc = r.steps.find((s) => s.t.startsWith('TC de corpo inteiro')); assert.equal(tc.st, 'ind', 'estável: a TC passa a ser indicada');
  const so = analisar('colisão de moto, hipotensão, FAST negativo, hemodinamicamente estável').steps.find((s) => s.t.startsWith('Centro cirúrgico'));
  assert.equal(so.st, 'dis'); assert.match(so.why, /FAST negativo/);
  assert.ok(r.steps.filter((s) => !s.alt && s.st === 'next').length <= 1, 'no máximo um próximo passo');
  assert.ok(por);
});

test('hipótese pode ser fixada à mão', () => {
  assert.equal(analisar('febre e vômitos', 'de').top, 'de');
  assert.equal(analisar('febre', 'inexistente').top, 'se' in {} ? null : analisar('febre').top);
});

test('a trilha genérica marca o que foi dito, a ordem e o desfecho', () => {
  const r = analisar(TRAUMA); const e = avaliarTrilha(r, TRAUMA);
  assert.equal(e.ph.length, TRILHA.length);
  const ok = (fase, i) => e.ph[fase].its[i].ok;
  assert.ok(ok(0, 1), 'apresentação'); assert.ok(ok(0, 2), 'identificação'); assert.equal(ok(0, 0), false, 'não lavou as mãos');
  assert.ok(ok(5, 1), 'executou ≥2 etapas do fluxo'); assert.equal(e.outc[0], 'Centro cirúrgico');
});

test('o grafo tem nós e arestas coerentes, ordem de execução e itens omitidos', () => {
  const { grafo, r } = construir({ fala: TRAUMA });
  const ids = new Set(grafo.nos.map((n) => n.id));
  assert.equal(ids.size, grafo.nos.length, 'ids únicos');
  for (const a of grafo.arestas) { assert.ok(ids.has(a.de) && ids.has(a.para), `aresta ${a.id} liga nós existentes`); assert.match(a.d, /^M/); }
  assert.ok(grafo.nos.some((n) => n.cls === 'hy top'), 'hipótese principal destacada');
  assert.ok(grafo.nos.some((n) => n.cls === 'done' && n.ordem >= 1), 'itens realizados numerados pela ordem em que foram ditos');
  assert.ok(grafo.nos.some((n) => n.cls === 'omit'), 'o que ficou para trás aparece como omitido');
  assert.ok(grafo.resumo.feitos > 5 && grafo.resumo.fluxo === 'Trauma' && grafo.resumo.desfecho === 'Centro cirúrgico');
  assert.equal(r.top, 'tr');
});

test('fala fora da sequência é marcada; os tempos aparecem no nó', () => {
  const fala = 'Faço ausculta e dou oxigênio. Depois me apresento: bom dia, meu nome é Ana, sou médica. Colisão de carro, hipotensão.';
  const { grafo } = construir({ fala, tempos: { p11: 65 } });
  assert.ok(grafo.nos.some((n) => n.foraDeSeq), 'apresentação depois da conduta fica fora de sequência');
  assert.ok(grafo.nos.find((n) => n.id === 'i0_1').st.includes('01:05'));
});

test('as anotações do candidato (o que o ator informou) entram na análise junto com a fala', () => {
  const so = construir({ fala: 'Vou examinar a paciente.' }); assert.equal(so.r.top, null);
  const com = construir({ fala: 'Vou examinar a paciente.', anotacoes: 'gestante de 34 semanas, PA 170x110, cefaleia' }); assert.equal(com.r.top, 'pe');
});

test('posições 3D: uma por nó, dentro de ~[-1.3,1.3], com a profundidade vinda da camada; estável ao recalcular', () => {
  const g1 = construir({ fala: TRAUMA }).grafo; const p1 = posicoes3D(g1); const p2 = posicoes3D(construir({ fala: TRAUMA }).grafo);
  assert.equal(Object.keys(p1).length, g1.nos.length); assert.deepEqual(p1, p2);
  for (const [x, y, z] of Object.values(p1)) assert.ok(Math.abs(x) <= 1.4 && Math.abs(y) <= 1.4 && Math.abs(z) <= 1);
  const z = (id) => p1[id][2]; assert.ok(z('i0_0') === 0 && z(g1.nos.find((n) => n.camada === 1).id) > 0 && z(g1.nos.find((n) => n.camada === -1).id) < 0);
});

test('a trilha de referência é genérica: nenhum item da estação real entra no módulo', async () => {
  const fonte = await import('node:fs').then((fs) => fs.readFileSync(new URL('../src/conduta.js', import.meta.url), 'utf8'));
  assert.doesNotMatch(fonte, /pep_item|\/api\/|fetch\(/, 'o módulo não lê nem chama o checklist da estação');
});
