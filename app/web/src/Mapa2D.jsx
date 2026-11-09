// Vistas 2D do mapa de temas (SVG, sem biblioteca): gráfico de rede, plano 2D, fluxograma e mapa mental.
// Navegação como em um mapa online (arrastar, roda/pinça, duplo clique, +/−, setas) reaproveitando nav3d.js; o conteúdo cabe no quadro (sem rolagem lateral).
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { criarEntrada, estadoInicial, zoomEm, resetar } from './nav3d.js';
import { layoutPlano, layoutGrafo, layoutFluxo, layoutMental, ajustarAoQuadro } from './layouts2d.js';
import { faixaDesempenho } from './grafo3d.js';
import './mapa2d.css';

export const VISTAS = [['3d', 'Mapa 3D'], ['grafo', 'Gráfico'], ['plano', 'Plano 2D'], ['fluxo', 'Fluxograma'], ['mental', 'Mapa mental']];
const rotulo = (t, n = 22) => (t.length > n ? `${t.slice(0, n - 1)}…` : t);

export default function Mapa2D({ vista, nos, arestas, sel, aoSel }) {
  const ref = useRef(null);
  const est = useRef(estadoInicial({ arrasto: null }));
  const [caixa, setCaixa] = useState({ w: 640, h: 420 });
  const [, forca] = useState(0);
  const lay = useMemo(() => (vista === 'fluxo' ? layoutFluxo(nos, arestas) : vista === 'mental' ? layoutMental(nos, arestas) : vista === 'plano' ? layoutPlano(nos, arestas) : layoutGrafo(nos, arestas)), [vista, nos, arestas]);
  const porId = useMemo(() => new Map(nos.map((n) => [n.id, n])), [nos]);
  const { pts } = useMemo(() => ajustarAoQuadro(lay.pos, caixa.w, caixa.h, vista === 'fluxo' ? 70 : 44), [lay, caixa, vista]);
  const reduz = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  useEffect(() => { resetar(est.current); est.current.rotY = 0; est.current.rotX = 0; forca((x) => x + 1); }, [vista, nos]);
  useEffect(() => {
    const el = ref.current; if (!el) return undefined;
    const ajustar = () => { const r = el.getBoundingClientRect(); const w = Math.max(240, Math.round(r.width)); const h = Math.max(260, Math.round(r.height)); est.current.w = w; est.current.h = h; setCaixa({ w, h }); };
    ajustar(); const ro = new ResizeObserver(ajustar); ro.observe(el); return () => ro.disconnect();
  }, []);

  const s = est.current;
  // quadro de tela → coordenada do desenho (inverte pan/zoom) para achar o nó tocado
  const noEm = (x, y) => {
    const dx = (x - s.w / 2 - s.panX) / s.zoom + s.w / 2; const dy = (y - s.h / 2 - s.panY) / s.zoom + s.h / 2; let melhor = null;
    for (const n of nos) { const p = pts[n.id]; if (!p) continue; const meia = vista === 'fluxo' ? 70 : 16; const d = vista === 'fluxo' ? (Math.abs(p.x - dx) <= meia && Math.abs(p.y - dy) <= 15 ? Math.abs(p.x - dx) : null) : (Math.hypot(p.x - dx, p.y - dy) <= meia ? Math.hypot(p.x - dx, p.y - dy) : null); if (d !== null && (!melhor || d < melhor.d)) melhor = { id: n.id, d }; }
    return melhor?.id ?? null;
  };
  const entrada = useMemo(() => criarEntrada({ canvas: () => ref.current, est: est.current, aoToque: (x, y) => aoSel(noEm(x, y)), aoPassar: () => {} }), [pts, vista, nos, aoSel]);   // eslint-disable-line react-hooks/exhaustive-deps
  const moldura = useRef(0);
  useEffect(() => { let vivo = true; const loop = () => { if (!vivo) return; const a = ref.current; if (a) { const g = a.querySelector('g.m2-cam'); if (g) g.setAttribute('transform', `translate(${est.current.w / 2 + est.current.panX} ${est.current.h / 2 + est.current.panY}) scale(${est.current.zoom}) translate(${-est.current.w / 2} ${-est.current.h / 2})`); a.dataset.zoom = est.current.zoom.toFixed(3); a.dataset.pan = `${Math.round(est.current.panX)},${Math.round(est.current.panY)}`; } moldura.current = requestAnimationFrame(loop); }; loop(); return () => { vivo = false; cancelAnimationFrame(moldura.current); }; }, []);
  useEffect(() => { const el = ref.current; if (!el) return undefined; el.addEventListener('wheel', entrada.roda, { passive: false }); return () => el.removeEventListener('wheel', entrada.roda); }, [entrada]);
  const zoom = (f) => zoomEm(est.current, est.current.w / 2, est.current.h / 2, f);

  const viz = useMemo(() => { const v = new Set(); if (sel) for (const a of arestas) { if (a.de === sel) v.add(a.para); if (a.para === sel) v.add(a.de); } return v; }, [arestas, sel]);
  const linhas = vista === 'fluxo' ? (lay.arestas ?? []) : vista === 'mental' ? (lay.ramos ?? []) : arestas;
  const corRamo = (i) => `var(--ramo-${((i ?? 0) % 6 + 6) % 6})`;
  const caminho = (a, b) => {
    if (vista === 'fluxo') { const mx = (a.x + b.x) / 2; return `M ${a.x + 62} ${a.y} C ${mx} ${a.y}, ${mx} ${b.y}, ${b.x - 62} ${b.y}`; }
    if (vista === 'mental') { const mx = (a.x + b.x) / 2; const my = (a.y + b.y) / 2; return `M ${a.x} ${a.y} Q ${mx + (b.y - a.y) * 0.12} ${my - (b.x - a.x) * 0.12} ${b.x} ${b.y}`; }
    return `M ${a.x} ${a.y} L ${b.x} ${b.y}`;
  };
  return (
    <div className="m2" data-testid="mapa-2d-caixa">
      <svg ref={ref} className={`m2-svg v-${vista}`} data-testid="mapa-2d" data-vista={vista} role="img" tabIndex={0}
        aria-label={`${VISTAS.find((v) => v[0] === vista)?.[1] ?? 'Mapa'} com ${nos.length} temas. Use Ver como lista para navegar por teclado.`}
        onPointerDown={entrada.baixar} onPointerMove={entrada.mover} onPointerUp={entrada.soltar} onPointerCancel={entrada.cancelar} onDoubleClick={entrada.duplo} onKeyDown={entrada.tecla} onContextMenu={entrada.menu}>
        <defs><marker id="m2-seta" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill="var(--suave)" /></marker></defs>
        <g className="m2-cam">
          {linhas.map((a, i) => { const p = pts[a.de]; const q = pts[a.para]; if (!p || !q) return null; const dest = sel && (a.de === sel || a.para === sel);
            return <path key={`${a.de}-${a.para}-${i}`} className={`m2-aresta${dest ? ' on' : ''}${a.tipo ? ` t-${a.tipo}` : ''}`} d={caminho(p, q)} style={vista === 'mental' ? { stroke: corRamo(a.ramo) } : undefined} markerEnd={vista === 'fluxo' ? 'url(#m2-seta)' : undefined} />; })}
          {nos.map((n) => { const p = pts[n.id]; if (!p) return null; const f = faixaDesempenho(n.desempenho); const on = sel === n.id; const perto = viz.has(n.id);
            const raiz = (lay.raizes ?? []).includes(n.id);
            const r = vista === 'mental' ? (raiz ? 15 : 9) : 6 + (n.relevancia ?? 3) * 1.4;
            return (
              <g key={n.id} className={`m2-no f-${f}${on ? ' sel' : ''}${perto ? ' perto' : ''}${raiz ? ' raiz' : ''}`} transform={`translate(${p.x} ${p.y})`} data-id={n.id} style={reduz ? undefined : { animationDelay: `${(String(n.id).length % 7) * 60}ms` }}>
                {vista === 'fluxo'
                  ? <><rect x="-62" y="-15" width="124" height="30" rx="9" /><text y="4" textAnchor="middle">{rotulo(n.nome, 19)}</text></>
                  : <><circle r={r} /><text y={r + 13} textAnchor="middle">{rotulo(n.nome)}</text></>}
              </g>
            ); })}
        </g>
      </svg>
      <div className="es-zoom">
        <button type="button" className="btn mini" onClick={() => zoom(1.25)} aria-label="Aproximar">+</button>
        <button type="button" className="btn mini" onClick={() => zoom(0.8)} aria-label="Afastar">−</button>
        <button type="button" className="btn mini" onClick={() => { resetar(est.current); est.current.rotY = 0; est.current.rotX = 0; }} aria-label="Centralizar">◎</button>
      </div>
    </div>
  );
}
