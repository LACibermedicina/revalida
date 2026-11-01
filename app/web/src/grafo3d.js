// Mapa de temas em 3D sem biblioteca: layout de forças determinístico + projeção em perspectiva + escolha de nó por toque/clique.
// Funções puras (testáveis em Node). O desenho em si fica em Estudo.jsx.

function rng(semente) { let a = semente >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

/** Posições {id: [x,y,z]} com raio ~1. Mesmos nós + mesmas arestas = mesmo desenho (não "pula" a cada visita). */
export function layout3D(nos, arestas, { iteracoes, semente = 7 } = {}) {
  const n = nos.length; if (!n) return {};
  const r = rng(semente);
  const idx = new Map(nos.map((x, i) => [x.id, i]));
  const P = nos.map(() => { const u = r() * 2 - 1, t = r() * Math.PI * 2, s = Math.sqrt(1 - u * u); return [s * Math.cos(t), s * Math.sin(t), u].map((v) => v * (0.6 + r() * 0.4)); });
  const arestasIdx = arestas.map((a) => [idx.get(a.de), idx.get(a.para), a.peso ?? 0.5]).filter(([a, b]) => a !== undefined && b !== undefined && a !== b);
  const passos = iteracoes ?? (n > 250 ? 90 : n > 120 ? 150 : 220);
  const k = Math.cbrt(4 / Math.max(n, 1)) * 1.6; // distância ideal entre vizinhos
  for (let it = 0; it < passos; it++) {
    const t = 0.12 * (1 - it / passos) + 0.01;
    const F = P.map(() => [0, 0, 0]);
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
      let dx = P[i][0] - P[j][0], dy = P[i][1] - P[j][1], dz = P[i][2] - P[j][2];
      let d2 = dx * dx + dy * dy + dz * dz; if (d2 < 1e-6) { dx = 1e-3; d2 = 1e-6; }
      const f = (k * k) / d2; const d = Math.sqrt(d2);
      const fx = (dx / d) * f, fy = (dy / d) * f, fz = (dz / d) * f;
      F[i][0] += fx; F[i][1] += fy; F[i][2] += fz; F[j][0] -= fx; F[j][1] -= fy; F[j][2] -= fz;
    }
    for (const [a, b, peso] of arestasIdx) {
      const dx = P[b][0] - P[a][0], dy = P[b][1] - P[a][1], dz = P[b][2] - P[a][2];
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1e-6; const f = (d * d / k) * (0.5 + peso);
      F[a][0] += (dx / d) * f; F[a][1] += (dy / d) * f; F[a][2] += (dz / d) * f; F[b][0] -= (dx / d) * f; F[b][1] -= (dy / d) * f; F[b][2] -= (dz / d) * f;
    }
    for (let i = 0; i < n; i++) {
      for (let c = 0; c < 3; c++) F[i][c] -= P[i][c] * 0.9; // gravidade leve para o centro
      const m = Math.sqrt(F[i][0] ** 2 + F[i][1] ** 2 + F[i][2] ** 2) || 1; const lim = Math.min(m, t * 4);
      for (let c = 0; c < 3; c++) P[i][c] += (F[i][c] / m) * lim * t * 3;
    }
  }
  let maxR = 1e-6; for (const p of P) maxR = Math.max(maxR, Math.hypot(...p));
  return Object.fromEntries(nos.map((x, i) => [x.id, P[i].map((v) => v / maxR)]));
}

/** Projeção em perspectiva depois de girar em Y (rotY) e X (rotX). Devolve {id: {x, y, z, s}}: s = escala por profundidade (0.6–1.4). */
export function projetar(pos, { rotY = 0, rotX = 0, zoom = 1, largura, altura }) {
  const cy = Math.cos(rotY), sy = Math.sin(rotY), cx = Math.cos(rotX), sx = Math.sin(rotX);
  const base = Math.min(largura, altura) * 0.42 * zoom; const cam = 3;
  const saida = {};
  for (const [id, [x0, y0, z0]] of Object.entries(pos)) {
    const x1 = x0 * cy + z0 * sy, z1 = -x0 * sy + z0 * cy;
    const y2 = y0 * cx - z1 * sx, z2 = y0 * sx + z1 * cx;
    const f = cam / (cam - z2);
    saida[id] = { x: largura / 2 + x1 * f * base, y: altura / 2 + y2 * f * base, z: z2, s: Math.max(0.6, Math.min(1.4, f)) };
  }
  return saida;
}

/** Nó sob o ponto (px, py): o mais próximo da câmera dentro do raio de toque. */
export function escolherNo(proj, nos, px, py, { raioBase = 14 } = {}) {
  let melhor = null;
  for (const n of nos) {
    const p = proj[n.id]; if (!p) continue;
    const r = raioBase * p.s * (0.8 + (n.relevancia ?? 3) * 0.08);
    const d = Math.hypot(p.x - px, p.y - py);
    if (d <= r && (!melhor || p.z > melhor.z)) melhor = { id: n.id, z: p.z };
  }
  return melhor?.id ?? null;
}

/** Cor do nó por desempenho (0–1); null = sem dados. Devolve o nome do papel de cor, para o CSS do tema resolver. */
export const faixaDesempenho = (d) => (d === null || d === undefined ? 'sem' : d < 0.6 ? 'baixo' : d < 0.8 ? 'medio' : 'alto');
