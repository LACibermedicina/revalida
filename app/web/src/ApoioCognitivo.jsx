// Apoio cognitivo do candidato durante a estação: quadro móvel e redimensionável com o grafo da conduta
// (achados → hipótese → trilha esperada × realizada → ramificação da conduta), montado ao vivo a partir da fala do próprio candidato
// (e do que ele anotar do que o paciente informou). Pode ser visto em 2D ou convertido para 3D.
// É só uma referência visual: usa a trilha genérica das estações e protocolos resumidos (ver conduta.js), nunca o checklist real
// da estação, e não altera a nota.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { QuadroFlutuante, usePref } from './Quadros.jsx';
import { construir, posicoes3D, ROTULO } from './conduta.js';
import { projetar, escolherNo } from './grafo3d.js';
import { criarEntrada, zoomEm, resetar } from './nav3d.js';
import './apoio.css';

/** Fala do candidato guardada só no navegador: o que já foi reconhecido (final) + o trecho em andamento. */
export function useFalaLocal(execId) {
  const [finais, setFinais] = useState('');
  const [parcial, setParcial] = useState('');
  useEffect(() => { setFinais(''); setParcial(''); }, [execId]);
  const registrar = useCallback((texto, ehParcial) => {
    if (ehParcial) { setParcial(texto); return; }
    setParcial(''); setFinais((f) => `${f}${f ? ' ' : ''}${texto}`.slice(-12000));
  }, []);
  return { fala: `${finais}${parcial ? ` ${parcial}` : ''}`.trim(), registrar, vazia: !finais && !parcial };
}

const COR_NO = { fd: '--mar', hy: '--suave', 'hy top': '--coral', done: '--menta', next: '--mar', omit: '--vermelho', pend: '--suave', ind: '--coral', dis: '--suave', cond: '--sol' };
const COR_ARESTA = { ex: '--suave', pf: '--menta', oo: '--sol', br: '--coral', brd: '--suave', brc: '--sol', fh: '--suave', fht: '--coral', hp: '--coral' };

function Grafo2D({ grafo, sel, aoSel }) {
  const caixa = useRef(null);
  const [largura, setLargura] = useState(600);
  const [zoom, setZoom] = useState(null);     // null = legível (cabe na largura, mas nunca menor que 60%); 'fit' = tudo na largura; número = zoom escolhido
  useEffect(() => {
    const el = caixa.current; if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(() => setLargura(el.clientWidth || 600)); ro.observe(el); setLargura(el.clientWidth || 600);
    return () => ro.disconnect();
  }, []);
  const ajuste = Math.max(0.2, Math.min(1, (largura - 4) / grafo.W));
  const z = zoom === 'fit' ? ajuste : zoom ?? Math.max(0.6, ajuste);
  const pan = useRef(null);
  const aoBaixar = (e) => { if (e.pointerType === 'mouse' && !e.target.closest('[data-id]')) pan.current = { x: e.clientX, y: e.clientY, l: caixa.current.scrollLeft, t: caixa.current.scrollTop }; };
  const aoMover = (e) => { const g = pan.current; if (g) { caixa.current.scrollLeft = g.l - (e.clientX - g.x); caixa.current.scrollTop = g.t - (e.clientY - g.y); } };
  const abrir = (n) => aoSel(n.id);   // hipótese também só abre o detalhe; "Fixar este fluxo" fica no painel
  return (
    <div className="ap-2d">
      <div className="ap-zoom">
        <button type="button" className="btn mini" onClick={() => setZoom(Math.max(0.2, z / 1.25))} aria-label="Diminuir zoom">−</button>
        <button type="button" className="btn mini" onClick={() => setZoom(Math.min(2.2, z * 1.25))} aria-label="Aumentar zoom">+</button>
        <button type="button" className="btn mini" onClick={() => setZoom('fit')}>Ver tudo</button>
        <button type="button" className="btn mini" onClick={() => setZoom(null)}>Legível</button>
      </div>
      <div className="ap-rolagem" ref={caixa} onPointerDown={aoBaixar} onPointerMove={aoMover} onPointerUp={() => { pan.current = null; }} onPointerLeave={() => { pan.current = null; }}>
        <svg data-testid="apoio-2d" role="group" aria-label="Grafo da conduta em 2D" viewBox={`0 0 ${grafo.W} ${grafo.H}`} width={Math.round(grafo.W * z)} height={Math.round(grafo.H * z)}>
          <defs>{[['a1', '--menta'], ['a2', '--sol'], ['a3', '--coral']].map(([i, c]) => <marker key={i} id={`ap-${i}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0L10,5L0,10z" style={{ fill: `var(${c})` }} /></marker>)}</defs>
          {grafo.cab.map((h, i) => <text key={i} className="ap-cab" x={h.x} y={h.y ?? grafo.Y0 - 34}>{h.t.length > (h.largo ? 90 : 27) ? `${h.t.slice(0, h.largo ? 89 : 26)}…` : h.t}{h.c ? ` · ${h.c}` : ''}</text>)}
          {grafo.arestas.map((a) => <path key={a.id} className={`ap-e ${a.cls}`} d={a.d} markerEnd={a.mk ? `url(#ap-${a.mk})` : undefined} />)}
          {grafo.nos.map((n) => (
            <g key={n.id} className={`ap-n ${n.cls}${sel === n.id ? ' sel' : ''}`} data-id={n.id} tabIndex={0} role="button" aria-label={`${n.linhas.join(' ')} — ${n.st}`}
              onClick={() => abrir(n)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); abrir(n); } }}>
              <title>{grafo.info[n.id]}</title>
              <rect x={n.x} y={n.y} width={n.w} height={n.h} rx="9" />
              {n.linhas.map((l, i) => <text key={i} x={n.x + 8} y={n.y + 16 + i * 14}>{l}</text>)}
              {n.st && <text className="st" x={n.x + 8} y={n.y + 16 + n.linhas.length * 14}>{n.st}</text>}
              {n.ordem && <><circle className={`bd${n.foraDeSeq ? ' oo' : ''}`} cx={n.x} cy={n.y} r="11" /><text className="bt" x={n.x} y={n.y + 4} textAnchor="middle">{n.ordem}</text></>}
            </g>
          ))}
        </svg>
      </div>
    </div>
  );
}

function Grafo3D({ grafo, sel, aoSel }) {
  const ref = useRef(null);
  const est = useRef({ rotY: 0.5, rotX: 0.25, zoom: 1, panX: 0, panY: 0, arrasto: null, auto: true, proj: {}, hover: null, w: 500, h: 320 });
  const pos = useMemo(() => posicoes3D(grafo), [grafo]);
  const reduz = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const [auto, setAuto] = useState(false);
  const nosRef = useRef(grafo.nos); nosRef.current = grafo.nos;

  useEffect(() => {
    const cv = ref.current; if (!cv) return undefined;
    const ctx = cv.getContext('2d'); const s = est.current; let raf = 0; let vivo = true;
    const css = getComputedStyle(document.documentElement);
    const cor = (v) => (v === '--vermelho' ? '#e5484d' : css.getPropertyValue(v).trim() || '#888');
    const ajustar = () => {
      const r = cv.getBoundingClientRect(); const dpr = window.devicePixelRatio || 1;
      s.w = Math.max(200, r.width); s.h = Math.max(200, r.height);
      cv.width = Math.round(s.w * dpr); cv.height = Math.round(s.h * dpr); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    const desenhar = () => {
      if (!vivo) return;
      if (s.auto && !s.arrasto && !reduz) s.rotY += 0.004;
      const proj = projetar(pos, { rotY: s.rotY, rotX: s.rotX, zoom: s.zoom * (Math.min(s.w / 2 / 1.4, s.h / 2 / 0.7) / (Math.min(s.w, s.h) * 0.42)), largura: s.w, altura: s.h, panX: s.panX ?? 0, panY: s.panY ?? 0 }); s.proj = proj;
      ctx.clearRect(0, 0, s.w, s.h);
      for (const a of grafo.arestas) {
        const p = proj[a.de]; const q = proj[a.para]; if (!p || !q) continue;
        const dest = sel && (a.de === sel || a.para === sel);
        ctx.globalAlpha = dest ? 0.95 : a.cls === 'ex' ? 0.18 : 0.55; ctx.strokeStyle = cor(COR_ARESTA[a.cls] ?? '--suave'); ctx.lineWidth = dest ? 3 : a.cls === 'pf' || a.cls === 'br' ? 2.2 : 1.2;
        ctx.setLineDash(['oo', 'brc', 'brd', 'ex', 'hp'].includes(a.cls) ? [5, 4] : []);
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke();
      }
      ctx.setLineDash([]);
      const ordem = [...grafo.nos].sort((a, b) => (proj[a.id]?.z ?? 0) - (proj[b.id]?.z ?? 0));
      ctx.font = '11px system-ui, sans-serif'; ctx.textAlign = 'center';
      for (const n of ordem) {
        const p = proj[n.id]; if (!p) continue;
        const r = (n.cls.startsWith('hy') ? 9 : n.camada === 0 ? 7 : 6.5) * p.s; const dest = n.id === sel || n.id === s.hover;
        ctx.globalAlpha = sel && !dest ? 0.55 : Math.min(1, 0.6 + p.s * 0.3);
        ctx.fillStyle = cor(COR_NO[n.cls] ?? '--suave'); ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fill();
        if (n.cls === 'omit' || n.cls === 'dis' || n.cls === 'pend' || n.cls === 'cond') { ctx.strokeStyle = cor('--fg'); ctx.lineWidth = 1; ctx.setLineDash([3, 2]); ctx.stroke(); ctx.setLineDash([]); }
        if (n.id === sel) { ctx.strokeStyle = cor('--fg'); ctx.lineWidth = 2.5; ctx.stroke(); }
        if (n.ordem) { ctx.globalAlpha = 1; ctx.fillStyle = '#fff'; ctx.fillText(String(n.ordem), p.x, p.y + 4); }
        if (dest || n.cls === 'hy top' || n.cls === 'next' || n.cls === 'ind') { ctx.globalAlpha = 1; ctx.fillStyle = cor('--fg'); const t = n.rotulo.length > 26 ? `${n.rotulo.slice(0, 25)}…` : n.rotulo; ctx.fillText(t, p.x, p.y - r - 5); }
      }
      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(desenhar);
    };
    ajustar(); const ro = new ResizeObserver(ajustar); ro.observe(cv); raf = requestAnimationFrame(desenhar);
    return () => { vivo = false; cancelAnimationFrame(raf); ro.disconnect(); };
  }, [pos, grafo, sel, reduz]);

  const entrada = useMemo(() => criarEntrada({ canvas: () => ref.current, est: est.current,
    aoToque: (x, y, e) => aoSel(escolherNo(est.current.proj, nosRef.current, x, y, { raioBase: e.pointerType === 'touch' ? 22 : 14 })),
    aoPassar: (x, y) => { const s = est.current; s.hover = escolherNo(s.proj, nosRef.current, x, y); if (ref.current) ref.current.style.cursor = s.hover ? 'pointer' : 'grab'; } }), [aoSel]);
  useEffect(() => { const cv = ref.current; if (!cv) return undefined; cv.addEventListener('wheel', entrada.roda, { passive: false }); return () => cv.removeEventListener('wheel', entrada.roda); }, [entrada]);
  const zoomar = (f) => zoomEm(est.current, est.current.w / 2, est.current.h / 2, f);
  const girar = (d) => { est.current.rotY += d; };
  return (
    <div className="ap-3d">
      <canvas ref={ref} data-testid="apoio-3d" role="img" aria-label={`Grafo da conduta em 3D com ${grafo.nos.length} nós. A visão 2D tem a mesma informação com navegação por teclado.`} tabIndex={0}
        onPointerDown={entrada.baixar} onPointerMove={entrada.mover} onPointerUp={entrada.soltar} onPointerCancel={entrada.cancelar} onPointerLeave={() => { est.current.hover = null; }}
        onDoubleClick={entrada.duplo} onKeyDown={entrada.tecla} onContextMenu={entrada.menu}
        onKeyDown={(e) => { if (e.key === 'ArrowLeft') girar(-0.12); else if (e.key === 'ArrowRight') girar(0.12); else if (e.key === '+') zoomar(1.2); else if (e.key === '-') zoomar(0.8); }} />
      <div className="ap-zoom">
        <button type="button" className="btn mini" onClick={() => zoomar(1.25)} aria-label="Aproximar">+</button>
        <button type="button" className="btn mini" onClick={() => zoomar(0.8)} aria-label="Afastar">−</button>
        <button type="button" className="btn mini" onClick={() => girar(-0.3)} aria-label="Girar para a esquerda">⟲</button>
        <button type="button" className="btn mini" onClick={() => girar(0.3)} aria-label="Girar para a direita">⟳</button>
        <button type="button" className="btn mini" onClick={() => resetar(est.current)} aria-label="Centralizar o grafo">◎</button>
        <button type="button" className="btn mini" aria-pressed={auto} onClick={() => { est.current.auto = !auto; setAuto(!auto); }}>{auto ? 'Parar' : 'Girar sozinho'}</button>
      </div>
    </div>
  );
}

/**
 * Quadro flutuante. `fala` vem da transcrição local do candidato (useFalaLocal). `inicio` = quando a estação começou (para o tempo de cada item).
 */
export default function ApoioCognitivo({ fala, inicio, aoFechar, anotacoes, aoAnotar }) {
  const [modo, setModo] = usePref('rv_apoio_modo', '2d');           // '2d' | '3d'
  const [forcada, setForcada] = useState(null);
  const [sel, setSel] = useState(null);
  const [tempos, setTempos] = useState({});
  const [notasAbertas, setNotasAbertas] = useState(false);

  const { r, e, grafo } = useMemo(() => construir({ fala, anotacoes, forcada, tempos }), [fala, anotacoes, forcada, tempos]);
  // marca quando cada item da trilha apareceu pela primeira vez (segundos desde o início da estação)
  useEffect(() => {
    const dec = Math.max(0, Math.round((Date.now() - (inicio ? new Date(inicio).getTime() : Date.now())) / 1000));
    setTempos((t) => {
      const novo = { ...t }; let mudou = false; const ok = new Set();
      e.ph.forEach((p) => p.its.forEach((i) => { if (i.ok) { ok.add(i.k); if (novo[i.k] == null) { novo[i.k] = dec; mudou = true; } } }));
      Object.keys(novo).forEach((k) => { if (!ok.has(k)) { delete novo[k]; mudou = true; } });
      return mudou ? novo : t;
    });
  }, [e, inicio]);
  useEffect(() => { if (sel && !grafo.nos.some((n) => n.id === sel)) setSel(null); }, [grafo, sel]);

  const alternarHipotese = (p) => { setForcada((f) => (f === p ? null : p)); setSel(null); };
  const no = grafo.nos.find((n) => n.id === sel);
  const s = grafo.resumo;
  const semAchados = r.hit.length === 0;   // a trilha esperada já aparece; as hipóteses e a conduta surgem com os achados

  return (
    <QuadroFlutuante id="apoio_cognitivo" titulo="Apoio cognitivo · grafo da conduta" aoFechar={aoFechar} largura={680} altura={520} inicial={{ x: Math.max(8, (typeof window !== 'undefined' ? window.innerWidth : 1200) - 704), y: 128 }} redimensionavel testid="apoio-cognitivo">
      <div className="ap" data-modo={modo}>
        <p className="ap-aviso" role="note">Apoio ao raciocínio, montado com o que você fala e anota. Não é o checklist desta estação e não altera a nota.</p>
        <div className="ap-barra">
          <div className="ap-modos" role="group" aria-label="Forma de ver o grafo">
            <button type="button" className={modo === '2d' ? 'on' : ''} aria-pressed={modo === '2d'} onClick={() => setModo('2d')} data-testid="apoio-modo-2d">2D</button>
            <button type="button" className={modo === '3d' ? 'on' : ''} aria-pressed={modo === '3d'} onClick={() => setModo('3d')} data-testid="apoio-modo-3d">Converter para 3D</button>
          </div>
          <span className="ap-resumo" aria-live="polite" data-testid="apoio-resumo">{semAchados ? `${s.feitos}/${s.total} itens da trilha · aguardando achados` : `${s.feitos}/${s.total} itens · ${s.omitidos} omitidos · ${s.foraDeSeq} fora de sequência${s.fluxo ? ` · ${s.fluxo}` : ''}`}</span>
        </div>
        {forcada && <p className="ap-fixa">Fluxo fixado em <b>{s.fluxo ?? '—'}</b>. <button type="button" className="ln" onClick={() => setForcada(null)}>Voltar ao automático</button></p>}

        {semAchados && (
          <div className="ap-vazio" data-testid="apoio-vazio">
            <b>As hipóteses e a conduta aparecem quando houver achados.</b>
            <span className="sub"> Fale ou anote queixa, sinais vitais e achados (ex.: “colisão de moto, hipotensão, murmúrio vesicular abolido”). Enquanto isso, a trilha esperada da estação já está no grafo.</span>
          </div>
        )}
        {modo === '2d'
          ? <Grafo2D grafo={grafo} sel={sel} aoSel={setSel} />
          : <Grafo3D grafo={grafo} sel={sel} aoSel={setSel} />}

        {no && (
          <div className="ap-det" role="status" data-testid="apoio-detalhe">
            <b>{no.rotulo}</b> <span className="sub">— {no.st || ROTULO[no.cls] || ''}</span>
            <p>{grafo.info[no.id]}</p>
            {no.hyp && <button type="button" className="btn mini" onClick={() => alternarHipotese(no.hyp)}>{forcada === no.hyp ? 'Voltar ao automático' : 'Fixar este fluxo'}</button>}
          </div>
        )}

        <details className="ap-notas" open={notasAbertas} onToggle={(ev) => setNotasAbertas(ev.currentTarget.open)}>
          <summary>Anotações do que o paciente informou</summary>
          <textarea value={anotacoes} onChange={(ev) => aoAnotar(ev.target.value)} maxLength={2000} rows={3} aria-label="Anotações" data-testid="apoio-notas"
            placeholder="O que o ator/paciente respondeu ou mostrou: PA 80x50, FC 130, murmúrio vesicular abolido à direita…" />
          <p className="sub">Ficam só neste navegador, durante a estação.</p>
        </details>

        <ul className="ap-leg" aria-label="Legenda">
          <li className="l-done">realizado (nº = ordem em que você disse)</li><li className="l-next">próximo esperado</li><li className="l-omit">omitido</li>
          <li className="l-oo">fora de sequência</li><li className="l-ind">ramo indicado</li><li className="l-dis">ramo descartado</li>
        </ul>
      </div>
    </QuadroFlutuante>
  );
}
