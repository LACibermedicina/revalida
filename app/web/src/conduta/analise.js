// Análise dinâmica da conduta (puro, sem DOM): lê o texto falado/anotado e devolve achados, hipótese mais provável, fluxo esperado,
// desempenho no PEP genérico e o grafo (nós + arestas) em 2D e em 3D. Portado de app.js, pep.js e board.js do script anexado.
import { N, P, F, has, PEP, OUT } from './base.js';

export const ROTULO = { done: 'feito', next: 'próximo passo', ind: 'indicada pelo quadro', cond: 'condicional', dis: 'descartada', pend: 'pendente' };

/** Achados, ranking de hipóteses e passos da conduta (feito, próximo, indicada, condicional, descartada). `forcada` fixa a hipótese. */
export function analisar(bruto, forcada = null) {
  const t = N(String(bruto ?? '')); const sc = {}; const hit = [];
  F.forEach((f) => { if (has(f[1], t)) { hit.push(f); for (const p in f[2]) sc[p] = (sc[p] || 0) + f[2][p]; } });
  const rank = Object.keys(P).sort((a, b) => (sc[b] || 0) - (sc[a] || 0));
  const top = forcada && P[forcada] ? forcada : ((sc[rank[0]] || 0) > 0 ? rank[0] : null);
  let steps = [];
  if (top) {
    steps = P[top].s.map((s) => {
      let st = 'pend'; let why = '';
      if (has(s.k, t)) st = 'done';
      else if (s.alt) { if (s.off && s.off.test(t)) { st = 'dis'; why = s.why; } else if (has(s.on, t)) st = 'ind'; else st = 'cond'; }
      return { ...s, st, why };
    });
    const nx = steps.find((s) => !s.alt && s.st === 'pend'); if (nx) nx.st = 'next';
  }
  return { sc, hit, rank, top, steps, vazio: !t.trim() };
}

/** Desempenho no PEP genérico (preparação → desfecho). Sem o checklist real da estação: só a estrutura esperada de um atendimento. */
export function avaliarPEP(bruto, r) {
  const t = N(String(bruto ?? '')); const feitos = r.steps.filter((s) => !s.alt && s.st === 'done'); const dn = feitos.length;
  const outc = OUT.find((o) => o[1].test(t)) || null;
  const sp = feitos.map((s) => t.search(s.k)).sort((a, b) => a - b);
  const ph = PEP.map((p) => ({ id: p.id, n: p.n, its: p.items.map((it, i) => {
    let ok; let pos = -1;
    if (it[1] === null) { ok = p.id === 'p6' ? (!!r.top && dn >= 2) : !!outc; pos = p.id === 'p6' ? (ok ? sp[1] : -1) : (outc ? t.search(outc[1]) : -1); }
    else { const m = t.match(it[1]); ok = !!m; pos = m ? m.index : -1; }
    return { l: it[0], ok, pos, k: `${p.id}${i}` };
  }) }));
  return { ph, outc };
}

const quebrar = (s, n, m) => { const L = []; let c = ''; String(s).split(' ').forEach((x) => { if ((`${c} ${x}`).trim().length > n && c) { L.push(c); c = x; } else c = (`${c} ${x}`).trim(); }); if (c) L.push(c); if (L.length > m) { L.length = m; L[m - 1] = `${L[m - 1].slice(0, n - 1)}…`; } return L; };
const mmss = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

/**
 * Monta o grafo: coluna 0 = achados → hipóteses; colunas seguintes = fases do PEP (realizado × esperado, ordem em que foi dito);
 * faixa inferior = ramificação da conduta clínica da hipótese. `tempos` = { chaveDoItem: segundos } (opcional).
 * Devolve nós com posição 2D (x,y,w,h), camada e coluna (para o 3D), arestas com caminho 2D e o resumo.
 */
export function montarGrafo(r, e, tempos = {}) {
  const CW = 206; const NW = 172; const NH = 52; const RG = 62; const X0 = 20; const Y0 = 72;
  const pos = {}; const nos = []; const E = []; const cab = [];
  const add = (id, x, y, w, h, txt, n, cls, st, inf, extra = {}) => { pos[id] = { x, y, w, h }; nos.push({ id, x, y, w, h, linhas: quebrar(txt, n, 2), rotulo: txt, cls, st, info: inf, ...extra }); return nos[nos.length - 1]; };
  const bp = (a, b) => {
    const A = pos[a]; const B = pos[b];
    if (A.x === B.x) { const dn = B.y > A.y; return `M${A.x + A.w / 2},${A.y + (dn ? A.h : 0)}L${B.x + B.w / 2},${B.y + (dn ? 0 : B.h)}`; }
    const f = B.x > A.x; const x1 = f ? A.x + A.w : A.x; const x2 = f ? B.x : B.x + B.w; const y1 = A.y + A.h / 2; const y2 = B.y + B.h / 2; const d = Math.max(30, Math.abs(x2 - x1) / 2) * (f ? 1 : -1);
    return `M${x1},${y1}C${x1 + d},${y1} ${x2 - d},${y2} ${x2},${y2}`;
  };
  const aresta = (de, para, cls, d, peso = 0.5) => E.push({ id: `${de}>${para}${cls}`, de, para, cls, peso, d: d || bp(de, para) });
  const flat = []; e.ph.forEach((p, pi) => p.its.forEach((it, ii) => flat.push({ it, pi, ii, id: `i${pi}_${ii}`, ei: flat.length })));
  const lastOk = Math.max(-1, ...flat.filter((f) => f.it.ok).map((f) => f.pi));
  const perf = flat.filter((f) => f.it.ok && f.it.pos >= 0).sort((a, b) => a.it.pos - b.it.pos); const rank = {}; const oo = new Set(); let mx = -1;
  perf.forEach((f, i) => { rank[f.id] = i + 1; if (f.ei < mx) oo.add(f.id); mx = Math.max(mx, f.ei); });
  const nxt = flat.find((f) => !f.it.ok && f.pi >= Math.max(lastOk, 0));

  r.hit.forEach((f, i) => add(`f${i}`, X0, Y0 + i * 42, NW, 34, f[0], 26, 'fd', '', `${f[0]} — achado detectado na fala.`, { camada: 'achado', col: 0, lin: i }));
  const hb = Y0 + r.hit.length * 42 + 22; const hyp = r.rank.slice(0, 3).filter((p) => (r.sc[p] || 0) > 0 || p === r.top);
  hyp.forEach((p, j) => { const top = p === r.top; add(`h${p}`, X0, hb + j * 54, NW, 46, `${top ? '★ ' : ''}${P[p].n.split(' — ')[0]}`, 26, `hy${top ? ' top' : ''}`, `${top ? 'mais provável' : 'alternativa'} · peso ${r.sc[p] || 0}`, `${P[p].n}${top ? ' — hipótese principal.' : ' — hipótese alternativa.'} Toque para comparar/fixar este fluxo.`, { camada: 'hipotese', col: 0, lin: r.hit.length + j, hip: p }); });
  const bottom0 = hb + hyp.length * 54;
  cab.push({ x: X0, t: 'Achados → hipótese' });
  r.hit.forEach((f, i) => hyp.forEach((p) => { if (f[2][p]) { const A = pos[`f${i}`]; const B = pos[`h${p}`]; const y1 = A.y + A.h / 2; const y2 = B.y + B.h / 2; aresta(`f${i}`, `h${p}`, p === r.top ? 'fht' : 'fh', `M${X0 + NW},${y1}C${X0 + NW + 34},${y1} ${X0 + NW + 34},${y2} ${X0 + NW},${y2}`, f[2][p] / 3); } }));

  let maxRows = 0;
  flat.forEach((f) => {
    const x = X0 + (f.pi + 1) * CW; const y = Y0 + f.ii * RG; const it = f.it; maxRows = Math.max(maxRows, f.ii + 1);
    const cls = it.ok ? 'done' : f === nxt ? 'next' : (f.pi < lastOk ? 'omit' : 'pend'); const tm = tempos[it.k] != null ? mmss(tempos[it.k]) : '';
    const st = { done: `✔ realizado${tm ? ` ${tm}` : ''}`, next: '▶ próximo esperado', omit: '✖ omitido', pend: 'previsto' }[cls];
    const inf = `${it.l} — ${{ done: `realizado${tm ? ` aos ${tm}` : ''}, ordem ${rank[f.id]} na fala${oo.has(f.id) ? ' (fora da sequência esperada)' : ''}.`, next: 'próximo item esperado de um atendimento.', omit: 'omitido: não foi citado, embora fases posteriores já tenham ocorrido.', pend: 'previsto; ainda não citado.' }[cls]}`;
    add(f.id, x, y, NW, NH, it.l, 26, cls, st, inf, { camada: 'pep', col: f.pi + 1, lin: f.ii, ordem: it.ok && rank[f.id] ? rank[f.id] : null, foraSeq: oo.has(f.id) });
  });
  e.ph.forEach((p, pi) => cab.push({ x: X0 + (pi + 1) * CW, t: p.n, c: `${p.its.filter((i) => i.ok).length}/${p.its.length}` }));
  for (let i = 0; i < flat.length - 1; i++) aresta(flat[i].id, flat[i + 1].id, 'ex', null, 0.15);
  if (hyp.includes(r.top) && pos.i3_0) aresta(`h${r.top}`, 'i3_0', 'hp', null, 0.4);
  perf.forEach((f, i) => { if (i) aresta(perf[i - 1].id, f.id, oo.has(f.id) ? 'oo' : 'pf', null, 0.9); });

  const top0 = Math.max(bottom0, Y0 + maxRows * RG); let H = top0 + 20; let W = X0 + (e.ph.length + 1) * CW;
  if (r.top) {
    const Yb = top0 + 70; const main = r.steps.map((s, i) => ({ s, i })).filter((o) => !o.s.alt); let ma = 0; let prevId = null;
    cab.push({ x: X0, y: Yb - 30, t: `Ramificação da conduta clínica · ${P[r.top].n}`, larga: true });
    main.forEach((o, mi) => {
      const s = o.s; const id = `m${o.i}`; const x = X0 + mi * CW; const cls = s.st === 'done' ? 'done' : s.st === 'next' ? 'next' : 'pend';
      add(id, x, Yb, NW, NH, s.t, 26, cls, { done: '✔ realizado', next: '▶ próximo passo', pend: 'previsto' }[cls], `${s.t} — ${ROTULO[s.st]}.`, { camada: 'conduta', col: mi, lin: 0 });
      if (prevId) { const feito = cls === 'done' && r.steps[+prevId.slice(1)].st === 'done'; aresta(prevId, id, feito ? 'pf' : 'ex', null, feito ? 0.9 : 0.2); }
      prevId = id;
      let j = 0;
      for (let k = o.i + 1; k < r.steps.length && r.steps[k].alt; k++, j++) {
        const a = r.steps[k]; const ax = x + 22; const ay = Yb + NH + 22 + j * 66; const c2 = { ind: 'ind', dis: 'dis', cond: 'cond', done: 'done' }[a.st];
        add(`a${k}`, ax, ay, NW - 22, 56, a.t, 22, c2, a.st === 'dis' ? `⛔ ${quebrar(a.why, 24, 1)[0]}` : a.st === 'ind' ? '⚠ indicada' : a.st === 'done' ? '✔ realizado' : '◌ condicional',
          `${a.t} — ${ROTULO[a.st]}${a.st === 'dis' ? `. Interrompido: ${a.why}` : a.st === 'ind' ? '. Os achados justificam esta conduta.' : a.st === 'cond' ? '. Só entra se surgir achado que a justifique.' : '.'}`, { camada: 'ramo', col: mi, lin: j + 1 });
        aresta(id, `a${k}`, { ind: 'br', dis: 'brd', cond: 'brc', done: 'pf' }[a.st], `M${x + 11},${Yb + NH}V${ay + 28}H${ax}`, a.st === 'ind' ? 0.8 : 0.3);
        ma = Math.max(ma, j + 1);
      }
    });
    const l6 = flat.find((f) => f.it.l.startsWith('Executa o fluxo'));
    if (l6 && main.length) { const A = pos[l6.id]; const B = pos[`m${main[0].i}`]; aresta(l6.id, `m${main[0].i}`, 'hp', `M${A.x + A.w / 2},${A.y + A.h}C${A.x + A.w / 2},${Yb - 20} ${B.x + B.w / 2},${Yb - 50} ${B.x + B.w / 2},${Yb}`, 0.5); }
    H = Yb + NH + 22 + ma * 66 + 30; W = Math.max(W, X0 + main.length * CW);
  }
  const feitos = flat.filter((f) => f.it.ok).length; const omitidos = flat.filter((f) => !f.it.ok && f.pi < lastOk).length;
  return { nos, arestas: E, cabecalhos: cab, W, H, resumo: { feitos, omitidos, foraSeq: oo.size, total: flat.length, fluxo: r.top ? P[r.top].n.split(' — ')[0] : null } };
}

const Z = { achado: -0.9, hipotese: -0.45, pep: 0, conduta: 0.55, ramo: 0.9 };
/**
 * Posições 3D determinísticas (mesma fala = mesmo desenho): x = coluna, y = linha, z = camada (achados na frente → conduta ao fundo).
 * Valores em ~[-1, 1], prontos para `projetar` de grafo3d.js.
 */
export function posicoes3D(g) {
  const colMax = Math.max(1, ...g.nos.map((n) => n.col)); const linMax = Math.max(1, ...g.nos.map((n) => n.lin));
  const out = {};
  for (const n of g.nos) {
    const ondeY = n.camada === 'conduta' || n.camada === 'ramo' ? 0.75 + n.lin * 0.28 : -0.8 + (n.lin / linMax) * 1.5;
    out[n.id] = [(n.col / colMax) * 2 - 1, Math.max(-1, Math.min(1.1, ondeY)) * 0.8, Z[n.camada] ?? 0];
  }
  return out;
}
