// Baralho: cartas que o usuário move, empilha e espalha, e agrupamento por similaridade de tema.
// Funções puras (testáveis em Node). A tela fica em Baralho.jsx.
const PARADAS = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'em', 'na', 'no', 'a', 'o', 'com', 'para', 'por', 'um', 'uma', 'ou', 'ao', 'aos']);
export const normalizar = (t) => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
const radicais = (t) => new Set(normalizar(t).split(' ').filter((x) => x.length > 2 && !PARADAS.has(x)).map((x) => x.slice(0, 5)));

/** 0–1: quanto dois itens (titulo, area) tratam do mesmo tema. Radicais de 5 letras: "hipertensão"/"hipertensiva" se encontram. */
export function similaridade(a, b) {
  const na = normalizar(a.titulo); const nb = normalizar(b.titulo);
  if (na && na === nb) return 1;
  const A = radicais(a.titulo); const B = radicais(b.titulo);
  if (!A.size || !B.size) return 0;
  let comum = 0; for (const x of A) if (B.has(x)) comum++;
  if (!comum) return 0;
  const j = comum / (A.size + B.size - comum);
  return Math.min(1, j + (a.area && a.area === b.area ? 0.15 : 0));
}

/** Grupos de ids de temas parecidos (união transitiva), na ordem em que aparecem. Itens sem parecido ficam sozinhos. */
export function agruparSimilares(itens, limiar = 0.34) {
  const pai = itens.map((_, i) => i);
  const raiz = (i) => { while (pai[i] !== i) { pai[i] = pai[pai[i]]; i = pai[i]; } return i; };
  for (let i = 0; i < itens.length; i++) for (let j = i + 1; j < itens.length; j++) if (similaridade(itens[i], itens[j]) >= limiar) pai[raiz(j)] = raiz(i);
  const mapa = new Map();
  itens.forEach((it, i) => { const r = raiz(i); if (!mapa.has(r)) mapa.set(r, []); mapa.get(r).push(it.id); });
  return [...mapa.values()];
}

export const GAP = 16;
/** Recoloca as pilhas em grade (uma pilha aberta ocupa a linha inteira). Mantém ordem e conteúdo. */
export function organizar(pilhas, { largura, larg, alt }) {
  const cols = Math.max(1, Math.floor((largura + GAP) / (larg + GAP)));
  let col = 0; let lin = 0; let y = 0; let alturaLinha = alt;
  const quebra = () => { if (col > 0) { y += alturaLinha + GAP; col = 0; alturaLinha = alt; } };
  return pilhas.map((p) => {
    if (p.aberta && p.ids.length > 1) { quebra(); const r = { ...p, x: 0, y }; y += alt + GAP; return r; }
    if (col >= cols) quebra();
    const r = { ...p, x: Math.min(col * (larg + GAP), Math.max(0, largura - larg)), y }; col++; return r;
  });
}

let seq = 0; const novoId = () => `p${Date.now().toString(36)}${(seq++).toString(36)}`;
export function estadoInicial(itens, dim, { agrupar = false } = {}) {
  const grupos = agrupar ? agruparSimilares(itens) : itens.map((i) => [i.id]);
  return { manual: false, pilhas: organizar(grupos.map((ids) => ({ id: novoId(), ids, x: 0, y: 0, aberta: false })), dim) };
}

/** Ajusta o estado salvo aos itens de agora: some o que saiu, entra o que chegou; sem arranjo manual, reorganiza na ordem dos itens. */
export function sincronizar(estado, itens, dim) {
  const existem = new Set(itens.map((i) => i.id));
  let pilhas = (estado?.pilhas ?? []).map((p) => ({ ...p, ids: p.ids.filter((id) => existem.has(id)) })).filter((p) => p.ids.length);
  const vistos = new Set(pilhas.flatMap((p) => p.ids));
  const novos = itens.filter((i) => !vistos.has(i.id));
  if (!estado?.manual) {
    const ordem = new Map(itens.map((i, n) => [i.id, n]));
    pilhas = [...pilhas, ...novos.map((i) => ({ id: novoId(), ids: [i.id], x: 0, y: 0, aberta: false }))].sort((a, b) => ordem.get(a.ids[0]) - ordem.get(b.ids[0]));
    return { manual: false, pilhas: organizar(pilhas, dim) };
  }
  const base = organizar([...pilhas, ...novos.map((i) => ({ id: novoId(), ids: [i.id], x: 0, y: 0, aberta: false }))], dim);
  const mantidas = new Map(pilhas.map((p) => [p.id, p]));
  return { manual: true, pilhas: base.map((p) => (mantidas.has(p.id) ? { ...p, x: mantidas.get(p.id).x, y: mantidas.get(p.id).y } : p)).map((p) => limitar(p, dim)) };
}

export function limitar(p, { largura, larg }) { return { ...p, x: Math.max(0, Math.min(p.x, Math.max(0, largura - larg))), y: Math.max(0, p.y) }; }

export const mover = (estado, pilhaId, x, y, dim) => ({ manual: true, pilhas: estado.pilhas.map((p) => (p.id === pilhaId ? limitar({ ...p, x, y }, dim) : p)) });

/** Põe todas as cartas da pilha `de` em cima da pilha `para`. */
export function empilhar(estado, de, para) {
  if (de === para) return estado;
  const origem = estado.pilhas.find((p) => p.id === de); const alvo = estado.pilhas.find((p) => p.id === para);
  if (!origem || !alvo) return estado;
  return { manual: true, pilhas: estado.pilhas.filter((p) => p.id !== de).map((p) => (p.id === para ? { ...p, ids: [...p.ids, ...origem.ids] } : p)) };
}

/** Tira uma carta da pilha e a deixa solta em (x, y). */
export function destacar(estado, cartaId, x, y, dim) {
  const p = estado.pilhas.find((q) => q.ids.includes(cartaId)); if (!p || p.ids.length === 1) return mover(estado, p?.id, x, y, dim);
  const resto = p.ids.filter((id) => id !== cartaId); const nova = limitar({ id: novoId(), ids: [cartaId], x, y, aberta: false }, dim);
  return { manual: true, pilhas: [...estado.pilhas.map((q) => (q.id === p.id ? { ...q, ids: resto, aberta: resto.length > 1 && q.aberta } : q)), nova] };
}

export const alternar = (estado, pilhaId, dim) => ({ manual: estado.manual, pilhas: organizar(estado.pilhas.map((p) => (p.id === pilhaId ? { ...p, aberta: !p.aberta } : p)), dim).map((p, i) => (estado.manual ? { ...p, x: estado.pilhas[i].x, y: estado.pilhas[i].y } : p)) });
export const abrirTodas = (estado, aberta, dim) => ({ manual: false, pilhas: organizar(estado.pilhas.map((p) => ({ ...p, aberta: p.ids.length > 1 && aberta })), dim) });
export const reorganizar = (estado, dim) => ({ manual: false, pilhas: organizar(estado.pilhas, dim) });
export const desagrupar = (estado, dim) => ({ manual: false, pilhas: organizar(estado.pilhas.flatMap((p) => p.ids.map((id) => ({ id: novoId(), ids: [id], x: 0, y: 0, aberta: false }))), dim) });
export const agrupar = (estado, itens, dim) => ({ manual: false, pilhas: organizar(agruparSimilares(itens).map((ids) => ({ id: novoId(), ids, x: 0, y: 0, aberta: false })), dim) });

/** Posição de cada carta: {x, y, z, rot, topo, pilha, n, i}. Pilha fechada: leve leque; aberta: cartas lado a lado (sempre dentro da largura). */
export function posicoes(estado, { largura, larg }) {
  const r = {};
  for (const p of estado.pilhas) {
    const n = p.ids.length;
    p.ids.forEach((id, i) => {
      if (n > 1 && p.aberta) {
        const dx = n > 1 ? Math.min(larg + 8, Math.max(24, (largura - larg) / (n - 1))) : 0;
        r[id] = { x: p.x + i * dx, y: p.y, z: i + 1, rot: 0, topo: true, pilha: p.id, n, i };
      } else {
        const d = Math.min(i, 4);
        r[id] = { x: p.x + d * 5, y: p.y + d * 4, z: i + 1, rot: n > 1 ? ((i % 3) - 1) * 1.2 : 0, topo: i === n - 1, pilha: p.id, n, i };
      }
    });
  }
  return r;
}

/** Pilha sob o ponto (px, py), ignorando `ignorar`: a de maior z. */
export function pilhaSob(estado, px, py, { larg, alt }, ignorar) {
  let achada = null;
  for (const p of estado.pilhas) {
    if (p.id === ignorar) continue;
    const n = p.ids.length; const aberta = p.aberta && n > 1;
    if (aberta) continue;
    const d = Math.min(n - 1, 4);
    if (px >= p.x && px <= p.x + larg + d * 5 && py >= p.y && py <= p.y + alt + d * 4) achada = p.id;
  }
  return achada;
}

export const altura = (estado, { alt }) => estado.pilhas.reduce((m, p) => Math.max(m, p.y + alt + 20), alt + 20);
export const serializar = (estado) => JSON.stringify(estado);
export function hidratar(txt) {
  try { const e = JSON.parse(txt); if (e && Array.isArray(e.pilhas) && e.pilhas.every((p) => p && Array.isArray(p.ids) && Number.isFinite(p.x) && Number.isFinite(p.y))) return { manual: Boolean(e.manual), pilhas: e.pilhas.map((p) => ({ id: String(p.id), ids: p.ids.map(String), x: p.x, y: p.y, aberta: Boolean(p.aberta) })) }; } catch { /* corrompido */ }
  return null;
}
