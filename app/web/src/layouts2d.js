// Layouts 2D do mapa de temas (funções puras, testáveis em Node): plano (projeção do 3D), gráfico de rede, fluxograma em camadas e mapa mental radial.
// Todos devolvem { pos: {id: [x, y]}, ... } em unidades livres; quem desenha ajusta ao quadro (ver ajustarAoQuadro).
import { layout3D } from './grafo3d.js';

const grau = (nos, arestas) => { const g = new Map(nos.map((n) => [n.id, 0])); for (const a of arestas) { if (g.has(a.de)) g.set(a.de, g.get(a.de) + 1); if (g.has(a.para)) g.set(a.para, g.get(a.para) + 1); } return g; };
const vizinhanca = (nos, arestas) => { const v = new Map(nos.map((n) => [n.id, new Set()])); for (const a of arestas) { if (v.has(a.de) && v.has(a.para) && a.de !== a.para) { v.get(a.de).add(a.para); v.get(a.para).add(a.de); } } return v; };
const melhorRaiz = (ids, nos, g) => ids.slice().sort((a, b) => (g.get(b) - g.get(a)) || ((nos.get(b).relevancia ?? 3) - (nos.get(a).relevancia ?? 3)) || String(a).localeCompare(String(b)))[0];

/** Componentes conexos (ordem estável: maiores primeiro). */
export function componentes(nos, arestas) {
  const v = vizinhanca(nos, arestas); const visto = new Set(); const comps = [];
  for (const n of nos) {
    if (visto.has(n.id)) continue; const comp = []; const fila = [n.id]; visto.add(n.id);
    while (fila.length) { const x = fila.shift(); comp.push(x); for (const y of v.get(x)) if (!visto.has(y)) { visto.add(y); fila.push(y); } }
    comps.push(comp);
  }
  return comps.sort((a, b) => b.length - a.length);
}

/** Plano: o mesmo arranjo do 3D visto de cima (x, y), para quem quer o "mesmo mapa" sem profundidade. */
export function layoutPlano(nos, arestas) {
  const p3 = layout3D(nos, arestas); const pos = {};
  for (const [id, [x, y]] of Object.entries(p3)) pos[id] = [x, y];
  return { pos };
}

/** Gráfico de rede: forças em 2D (repulsão entre todos, mola nas arestas, gravidade leve). Determinístico. */
export function layoutGrafo(nos, arestas, { iteracoes = 260 } = {}) {
  const n = nos.length; if (!n) return { pos: {} };
  const idx = new Map(nos.map((x, i) => [x.id, i]));
  let sem = 11; const rnd = () => { sem = (sem * 1664525 + 1013904223) >>> 0; return sem / 4294967296; };
  const P = nos.map((_, i) => { const a = (i / n) * Math.PI * 2 + rnd() * 0.5; const r = 0.4 + rnd() * 0.6; return [Math.cos(a) * r, Math.sin(a) * r]; });
  const E = arestas.map((a) => [idx.get(a.de), idx.get(a.para), a.peso ?? 0.5]).filter(([a, b]) => a !== undefined && b !== undefined && a !== b);
  const k = Math.sqrt(4 / Math.max(n, 1)) * 1.3;
  for (let it = 0; it < iteracoes; it++) {
    const t = 0.1 * (1 - it / iteracoes) + 0.005; const F = P.map(() => [0, 0]);
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
      let dx = P[i][0] - P[j][0], dy = P[i][1] - P[j][1]; let d2 = dx * dx + dy * dy; if (d2 < 1e-6) { dx = 1e-3; d2 = 1e-6; }
      const d = Math.sqrt(d2); const f = (k * k) / d2; F[i][0] += (dx / d) * f; F[i][1] += (dy / d) * f; F[j][0] -= (dx / d) * f; F[j][1] -= (dy / d) * f;
    }
    for (const [a, b, w] of E) { const dx = P[b][0] - P[a][0], dy = P[b][1] - P[a][1]; const d = Math.hypot(dx, dy) || 1e-6; const f = ((d * d) / k) * (0.5 + w); F[a][0] += (dx / d) * f; F[a][1] += (dy / d) * f; F[b][0] -= (dx / d) * f; F[b][1] -= (dy / d) * f; }
    for (let i = 0; i < n; i++) { F[i][0] -= P[i][0] * 0.8; F[i][1] -= P[i][1] * 0.8; const m = Math.hypot(F[i][0], F[i][1]) || 1; const lim = Math.min(m, t * 4); P[i][0] += (F[i][0] / m) * lim * t * 3; P[i][1] += (F[i][1] / m) * lim * t * 3; }
  }
  const pos = {}; nos.forEach((x, i) => { pos[x.id] = P[i]; });
  return { pos };
}

/** Árvore de busca em largura a partir de uma raiz: { pai: Map, nivel: Map, filhos: Map }. */
function arvore(raiz, v) {
  const pai = new Map([[raiz, null]]); const nivel = new Map([[raiz, 0]]); const filhos = new Map([[raiz, []]]); const fila = [raiz];
  while (fila.length) { const x = fila.shift(); for (const y of [...v.get(x)].sort()) if (!nivel.has(y)) { nivel.set(y, nivel.get(x) + 1); pai.set(y, x); filhos.set(y, []); filhos.get(x).push(y); fila.push(y); } }
  return { pai, nivel, filhos };
}

/** Fluxograma: camadas da esquerda para a direita (raiz = tema mais ligado de cada grupo); setas do nível menor para o maior. */
export function layoutFluxo(nos, arestas, { larguraCamada = 1, alturaLinha = 0.42 } = {}) {
  const porId = new Map(nos.map((n) => [n.id, n])); const g = grau(nos, arestas); const v = vizinhanca(nos, arestas);
  const pos = {}; const nivelDe = new Map(); const raizes = []; let yBase = 0; const camadasPorGrupo = [];
  for (const comp of componentes(nos, arestas)) {
    const raiz = melhorRaiz(comp, porId, g); raizes.push(raiz);
    const { nivel, pai } = arvore(raiz, v); const camadas = [];
    for (const id of comp) { const l = nivel.get(id); (camadas[l] ??= []).push(id); }
    // ordem dentro da camada: média da posição vertical dos vizinhos da camada anterior (reduz cruzamentos), depois nome
    const y = new Map();
    camadas.forEach((ids, l) => {
      if (l === 0) ids.forEach((id, i) => y.set(id, i));
      else ids.sort((a, b) => ((y.get(pai.get(a)) ?? 0) - (y.get(pai.get(b)) ?? 0)) || String(porId.get(a).nome).localeCompare(String(porId.get(b).nome)));
      ids.forEach((id, i) => y.set(id, l === 0 ? i : i));
    });
    const maxLinhas = Math.max(...camadas.map((c) => c.length));
    camadas.forEach((ids, l) => ids.forEach((id, i) => { const off = (maxLinhas - ids.length) / 2; pos[id] = [l * larguraCamada, yBase + (i + off) * alturaLinha]; nivelDe.set(id, l); }));
    yBase += (maxLinhas + 0.8) * alturaLinha; camadasPorGrupo.push(camadas.length);
  }
  const dirigidas = arestas.filter((a) => pos[a.de] && pos[a.para] && a.de !== a.para).map((a) => (nivelDe.get(a.de) <= nivelDe.get(a.para) ? a : { ...a, de: a.para, para: a.de }));
  return { pos, raizes, niveis: nivelDe, arestas: dirigidas };
}

/** Mapa mental: raiz no centro e ramos radiais (ângulo proporcional ao tamanho do ramo). Grupos soltos viram ramos de um centro comum. */
export function layoutMental(nos, arestas, { raio = 0.9 } = {}) {
  const porId = new Map(nos.map((n) => [n.id, n])); const g = grau(nos, arestas); const v = vizinhanca(nos, arestas);
  const comps = componentes(nos, arestas); if (!comps.length) return { pos: {}, raizes: [], ramo: new Map() };
  const raizes = comps.map((c) => melhorRaiz(c, porId, g)); const centro = raizes[0]; const pos = {}; const ramo = new Map(); const nivelDe = new Map();
  const pais = new Map(); const filhos = new Map(nos.map((n) => [n.id, []]));
  for (const comp of comps) { const r = melhorRaiz(comp, porId, g); const t = arvore(r, v); for (const [id, f] of t.filhos) filhos.set(id, f); for (const [id, p] of t.pai) pais.set(id, p); for (const [id, l] of t.nivel) nivelDe.set(id, l + (r === centro ? 0 : 1)); }
  const raizesExtra = raizes.slice(1); filhos.set(centro, [...filhos.get(centro), ...raizesExtra]);
  const folhas = (id) => { const f = filhos.get(id) ?? []; return f.length ? f.reduce((s, x) => s + folhas(x), 0) : 1; };
  const total = folhas(centro);
  const colocar = (id, a0, a1, prof, idRamo) => {
    const a = (a0 + a1) / 2; const r = prof * raio; pos[id] = [Math.cos(a) * r, Math.sin(a) * r]; ramo.set(id, idRamo);
    const f = filhos.get(id) ?? []; let acc = a0; const tot = f.reduce((s, x) => s + folhas(x), 0) || 1;
    f.forEach((x, i) => { const fatia = (a1 - a0) * (folhas(x) / tot); colocar(x, acc, acc + fatia, prof + 1, prof === 0 ? i : idRamo); acc += fatia; });
  };
  pos[centro] = [0, 0]; ramo.set(centro, -1);
  const f0 = filhos.get(centro); let acc = -Math.PI / 2; const tot0 = f0.reduce((s, x) => s + folhas(x), 0) || 1;
  f0.forEach((x, i) => { const fatia = Math.PI * 2 * (folhas(x) / tot0); colocar(x, acc, acc + fatia, 1, i); acc += fatia; });
  void total;
  const ramos = []; for (const [id, p] of pais) if (p && pos[id] && pos[p]) ramos.push({ de: p, para: id, ramo: ramo.get(id) });
  for (const r of raizesExtra) ramos.push({ de: centro, para: r, ramo: ramo.get(r) });
  return { pos, raizes: [centro], ramo, ramos, niveis: nivelDe };
}

/** Ajusta posições (unidades livres) ao quadro w×h com margem; devolve {id: {x,y}} e a escala usada. */
export function ajustarAoQuadro(pos, w, h, margem = 36) {
  const ids = Object.keys(pos); if (!ids.length) return { pts: {}, escala: 1 };
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const id of ids) { const [x, y] = pos[id]; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  const lx = Math.max(x1 - x0, 1e-6), ly = Math.max(y1 - y0, 1e-6);
  const escala = Math.min((w - 2 * margem) / lx, (h - 2 * margem) / ly);
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2; const pts = {};
  for (const id of ids) pts[id] = { x: w / 2 + (pos[id][0] - cx) * escala, y: h / 2 + (pos[id][1] - cy) * escala };
  return { pts, escala };
}
