// Peças compartilhadas de interface: quadro flutuante (arrasta e minimiza), lista reordenável por arrastar e soltar
// e preferências simples guardadas no navegador. Posições e ordens são relativas à janela e sempre reajustadas ao redimensionar.
import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import './quadros.css';

export const lerPref = (chave, padrao) => { try { const v = localStorage.getItem(chave); return v === null ? padrao : JSON.parse(v); } catch { return padrao; } };
export const gravarPref = (chave, valor) => { try { localStorage.setItem(chave, JSON.stringify(valor)); } catch { /* sem storage */ } };
export function usePref(chave, padrao) {
  const [v, setV] = useState(() => lerPref(chave, padrao));
  const mudar = useCallback((x) => setV((atual) => { const n = typeof x === 'function' ? x(atual) : x; gravarPref(chave, n); return n; }), [chave]);
  return [v, mudar];
}

/** Aplica a ordem guardada aos ids atuais: o que sumiu sai, o que é novo entra no fim. Assim a ordem sobrevive a mudanças de papel e de tela. */
export function ordenar(ids, guardada) {
  const ok = (Array.isArray(guardada) ? guardada : []).filter((x) => ids.includes(x));
  return [...ok, ...ids.filter((x) => !ok.includes(x))];
}
const mover = (lista, de, para) => { const l = [...lista]; const [x] = l.splice(de, 1); l.splice(para, 0, x); return l; };

/**
 * Reordenação por arrastar e soltar (mouse e, nos navegadores que suportam, toque) com alternativa de teclado (Alt + setas).
 * Devolve props para o item e a ordem corrente. Não depende de posição na tela: só da ordem dos ids.
 */
export function useReordenar(chave, ids) {
  const [guardada, setGuardada] = usePref(chave, []);
  const ordem = ordenar(ids, guardada);
  const [arrastando, setArrastando] = useState(null);
  const [sobre, setSobre] = useState(null);
  const soltar = (alvo) => { if (arrastando && alvo && arrastando !== alvo) setGuardada(mover(ordem, ordem.indexOf(arrastando), ordem.indexOf(alvo))); setArrastando(null); setSobre(null); };
  const propsDe = (id) => ({
    draggable: true,
    'data-arrastando': arrastando === id ? 'sim' : undefined,
    'data-sobre': sobre === id && arrastando !== id ? 'sim' : undefined,
    onDragStart: (e) => { setArrastando(id); e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', id); } catch { /* ok */ } },
    onDragOver: (e) => { if (arrastando) { e.preventDefault(); setSobre(id); } },
    onDragLeave: () => setSobre((s) => (s === id ? null : s)),
    onDrop: (e) => { e.preventDefault(); soltar(id); },
    onDragEnd: () => { setArrastando(null); setSobre(null); },
    onKeyDown: (e) => {
      if (!e.altKey || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;
      e.preventDefault();
      const i = ordem.indexOf(id); const j = i + (['ArrowLeft', 'ArrowUp'].includes(e.key) ? -1 : 1);
      if (j < 0 || j >= ordem.length) return;
      setGuardada(mover(ordem, i, j));
      const el = e.currentTarget; requestAnimationFrame(() => document.querySelector(`[data-ordem-id="${CSS.escape(id)}"]`)?.focus?.() ?? el.focus?.());
    },
  });
  // fonte = quem se arrasta (cabeçalho); alvo = onde se solta (o quadro inteiro). propsDe junta os dois (ícones da barra).
  const propsFonte = (id) => { const { onDragOver, onDragLeave, onDrop, 'data-sobre': _s, ...resto } = propsDe(id); return resto; };
  const propsAlvo = (id) => { const { onDragOver, onDragLeave, onDrop, 'data-sobre': ds } = propsDe(id); return { onDragOver, onDragLeave, onDrop, 'data-sobre': ds }; };
  return { ordem, propsDe, propsFonte, propsAlvo, restaurar: () => setGuardada([]), personalizada: guardada.length > 0 };
}

/**
 * Quadro flutuante: arrasta pelo cabeçalho (mouse, caneta ou toque), minimiza, fecha. A posição é guardada e SEMPRE
 * reajustada para caber na janela quando ela muda de tamanho; em telas estreitas vira uma folha fixa embaixo (sem arrastar).
 */
export function QuadroFlutuante({ id, titulo, aoFechar, children, largura = 420, inicial }) {
  const ref = useRef(null);
  const [pos, setPos] = usePref(`rv_quadro_${id}`, null);
  const [min, setMin] = useState(false);
  const [estreito, setEstreito] = useState(() => typeof window !== 'undefined' && window.innerWidth < 700);
  const arr = useRef(null);

  const caber = useCallback((p) => {
    const el = ref.current; const w = el?.offsetWidth ?? largura; const h = el?.offsetHeight ?? 200;
    const x = Math.min(Math.max(8, p.x), Math.max(8, window.innerWidth - w - 8));
    const y = Math.min(Math.max(8, p.y), Math.max(8, window.innerHeight - Math.min(h, 80) - 8));   // ao menos o cabeçalho precisa ficar visível
    return { x, y };
  }, [largura]);

  useLayoutEffect(() => {
    const ini = pos ?? inicial ?? { x: Math.max(8, window.innerWidth - largura - 24), y: 72 };
    setPos(caber(ini));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const aoRedimensionar = () => { setEstreito(window.innerWidth < 700); setPos((p) => (p ? caber(p) : p)); };
    window.addEventListener('resize', aoRedimensionar);
    return () => window.removeEventListener('resize', aoRedimensionar);
  }, [caber, setPos]);
  useEffect(() => { const fx = (e) => { if (e.key === 'Escape') aoFechar?.(); }; window.addEventListener('keydown', fx); return () => window.removeEventListener('keydown', fx); }, [aoFechar]);

  const comecar = (e) => {
    if (estreito || e.target.closest('button')) return;
    const r = ref.current.getBoundingClientRect();
    arr.current = { dx: e.clientX - r.left, dy: e.clientY - r.top };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const levar = (e) => { if (arr.current) setPos(caber({ x: e.clientX - arr.current.dx, y: e.clientY - arr.current.dy })); };
  const largar = () => { arr.current = null; };
  const teclas = (e) => {
    if (estreito || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key) || !e.altKey) return;
    e.preventDefault(); const p = pos ?? { x: 0, y: 0 }; const d = 24;
    setPos(caber({ x: p.x + (e.key === 'ArrowLeft' ? -d : e.key === 'ArrowRight' ? d : 0), y: p.y + (e.key === 'ArrowUp' ? -d : e.key === 'ArrowDown' ? d : 0) }));
  };

  return (
    <aside ref={ref} className={`qf${min ? ' min' : ''}${estreito ? ' folha' : ''}`} role="dialog" aria-label={titulo} data-testid="quadro-flutuante"
      style={estreito || !pos ? undefined : { left: pos.x, top: pos.y, width: Math.min(largura, window.innerWidth - 16) }}>
      <header className="qf-cab" onPointerDown={comecar} onPointerMove={levar} onPointerUp={largar} onPointerCancel={largar} onKeyDown={teclas} tabIndex={0} aria-label={`${titulo}. Arraste para mover; Alt e setas movem pelo teclado.`}>
        <span className="qf-alca" aria-hidden="true">⠿</span><b>{titulo}</b>
        <span className="qf-bts">
          <button type="button" onClick={() => setMin((m) => !m)} aria-expanded={!min} aria-label={min ? 'Expandir quadro' : 'Minimizar quadro'} data-testid="quadro-minimizar">{min ? '▢' : '–'}</button>
          <button type="button" onClick={aoFechar} aria-label="Fechar quadro" data-testid="quadro-fechar">✕</button>
        </span>
      </header>
      {!min && <div className="qf-corpo">{children}</div>}
    </aside>
  );
}


/**
 * Painel de quadros com dois jeitos de ver:
 *  - compacto (padrão): um índice de quadros resumidos; clicar abre o quadro detalhado abaixo. Quadros abertos arrastam (reordenam) e minimizam.
 *  - sequência: todos os quadros, um abaixo do outro (também reordenáveis e minimizáveis).
 * quadros: [{ id, titulo, resumo, corpo, testid, largo }]. Escolhas (modo, abertos, minimizados, ordem) ficam guardadas no navegador.
 */
export function PainelQuadros({ chave, quadros, abertosPadrao }) {
  const ids = quadros.map((q) => q.id);
  const [linear, setLinear] = usePref(`rv_${chave}_linear`, false);
  const [abertos, setAbertos] = usePref(`rv_${chave}_abertos`, abertosPadrao ?? ids.slice(0, 1));
  const [minimizados, setMinimizados] = usePref(`rv_${chave}_min`, []);
  const { ordem, propsFonte, propsAlvo, restaurar, personalizada } = useReordenar(`rv_${chave}_ordem`, ids);
  const por = Object.fromEntries(quadros.map((q) => [q.id, q]));
  const abertosOk = abertos.filter((x) => ids.includes(x));
  const visiveis = ordem.filter((id) => linear || abertosOk.includes(id));
  const alternarAberto = (id) => setAbertos((a) => (a.includes(id) ? a.filter((x) => x !== id) : [...a, id]));
  const alternarMin = (id) => setMinimizados((m) => (m.includes(id) ? m.filter((x) => x !== id) : [...m, id]));

  return (
    <div className="pq" data-modo={linear ? 'sequencia' : 'compacto'} data-testid="painel-quadros">
      <div className="pq-barra">
        <label className="pq-chave"><input type="checkbox" role="switch" checked={linear} onChange={(e) => setLinear(e.target.checked)} data-testid="modo-linear" />
          <span>Ver o conteúdo em sequência (um quadro abaixo do outro)</span></label>
        {!linear && <span className="pq-acoes">
          <button type="button" className="btn mini" onClick={() => setAbertos(ids)}>Abrir todos</button>
          <button type="button" className="btn mini" onClick={() => setAbertos([])}>Recolher todos</button>
        </span>}
        {personalizada && <button type="button" className="btn mini" onClick={restaurar}>Restaurar a ordem</button>}
      </div>

      {!linear && (
        <ul className="pq-indice" aria-label="Índice dos quadros" data-testid="indice-quadros">
          {quadros.map((q) => {
            const aberto = abertosOk.includes(q.id);
            return (
              <li key={q.id}><button type="button" className={`pq-tile${aberto ? ' on' : ''}`} aria-expanded={aberto} data-testid={`tile-${q.id}`} onClick={() => alternarAberto(q.id)}>
                <b>{q.titulo}</b><span>{q.resumo}</span><i aria-hidden="true">{aberto ? 'aberto' : 'abrir'}</i></button></li>
            );
          })}
        </ul>
      )}
      {!linear && abertosOk.length === 0 && <p className="sub" role="status">Escolha um quadro do índice para ver o detalhe.</p>}

      <div className="pq-area">
        {visiveis.map((id) => {
          const q = por[id]; const min = minimizados.includes(id);
          return (
            <section key={id} className={`an-bloco pq-quadro${q.largo ? ' largo' : ''}${min ? ' min' : ''}`} aria-label={q.titulo} data-testid={q.testid} {...propsAlvo(id)}>
              <header className="pq-cab" {...propsFonte(id)} data-ordem-id={`q-${id}`} tabIndex={0} aria-label={`${q.titulo}. Arraste o cabeçalho ou use Alt e setas para mudar a ordem.`}>
                <span className="pq-alca" aria-hidden="true">⠿</span><h3>{q.titulo}</h3>
                {min && <span className="pq-res">{q.resumo}</span>}
                <span className="pq-bts">
                  <button type="button" onClick={() => alternarMin(id)} aria-expanded={!min} aria-label={min ? `Expandir ${q.titulo}` : `Minimizar ${q.titulo}`}>{min ? '▢' : '–'}</button>
                  {!linear && <button type="button" onClick={() => alternarAberto(id)} aria-label={`Fechar ${q.titulo}`}>✕</button>}
                </span>
              </header>
              {!min && <div className="pq-corpo">{q.corpo}</div>}
            </section>
          );
        })}
      </div>
    </div>
  );
}
