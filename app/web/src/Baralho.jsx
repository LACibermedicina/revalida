// Baralho: cartas soltas numa mesa que o usuário arrasta, empilha (soltando uma sobre a outra) e abre em leque.
// "Agrupar parecidos" junta temas semelhantes. O arranjo fica guardado no navegador, por mesa (chave).
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import './baralho.css';
import { abrirTodas, agrupar, alternar, altura, desagrupar, destacar, empilhar, estadoInicial, hidratar, mover, pilhaSob, posicoes, reorganizar, serializar, sincronizar } from './baralho.js';

const guardar = (k, v) => { try { localStorage.setItem(k, v); } catch { /* sem storage */ } };
const ler = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const INTERATIVO = 'button, a, input, select, textarea, summary, label, [role=tab]';

/**
 * itens: [{ id, titulo, area, classe? }]; renderizar(item) devolve o conteúdo da carta.
 * como: 'div' | 'ol' (a carta vira <li>). larg/alt: tamanho da carta. rotuloPilha(itens da pilha) → texto do selo.
 */
export default function Baralho({ chave, itens, renderizar, como = 'div', larg = 250, alt = 340, testid, testidCarta, rotuloPilha, vazio = null }) {
  const Mesa = como; const Carta = como === 'ol' ? 'li' : 'div';
  const raiz = useRef(null);
  const [largura, setLargura] = useState(640);
  const chaveSalva = `rp-baralho:${chave}`;
  const dim = useMemo(() => ({ largura, larg: Math.min(larg, Math.max(160, largura)), alt }), [largura, larg, alt]);
  const [estado, setEstado] = useState(() => hidratar(ler(chaveSalva) ?? '') ?? { manual: false, pilhas: [] });
  const [arrasto, setArrasto] = useState(null);     // { pilha, carta, x, y, alvo }
  const porId = useMemo(() => new Map(itens.map((i) => [i.id, i])), [itens]);
  const reduz = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  useLayoutEffect(() => {
    const el = raiz.current; if (!el) return undefined;
    const medir = () => setLargura(Math.max(200, Math.floor(el.getBoundingClientRect().width)));
    medir(); const ro = new ResizeObserver(medir); ro.observe(el); return () => ro.disconnect();
  }, []);
  useEffect(() => { setEstado((e) => sincronizar(e, itens, dim)); }, [itens, dim]);
  useEffect(() => { if (estado.pilhas.length) guardar(chaveSalva, serializar(estado)); }, [estado, chaveSalva]);

  const pos = useMemo(() => posicoes(estado, dim), [estado, dim]);
  const ponto = (e) => { const r = raiz.current.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };

  const baixar = (e, id) => {
    if (e.button !== 0 || e.target.closest(INTERATIVO)) return;
    const p = pos[id]; if (!p.topo) return;
    const [px, py] = ponto(e);
    e.currentTarget.setPointerCapture?.(e.pointerId);
    setArrasto({ id, pilha: p.pilha, dx: px - p.x, dy: py - p.y, x: p.x, y: p.y, moveu: false, alvo: null, aberta: p.n > 1 && estado.pilhas.find((q) => q.id === p.pilha)?.aberta, ix: px, iy: py });
  };
  const andar = (e) => {
    if (!arrasto) return;
    const [px, py] = ponto(e);
    const moveu = arrasto.moveu || Math.abs(px - arrasto.ix) + Math.abs(py - arrasto.iy) > 5;
    if (!moveu) return;
    const x = Math.max(0, Math.min(px - arrasto.dx, dim.largura - dim.larg)); const y = Math.max(0, py - arrasto.dy);
    setArrasto({ ...arrasto, moveu: true, x, y, alvo: pilhaSob(estado, px, py, dim, arrasto.pilha) });
  };
  const soltar = (e) => {
    if (!arrasto) return; const a = arrasto; setArrasto(null);
    e.currentTarget.releasePointerCapture?.(e.pointerId);
    if (!a.moveu) { if (pos[a.id].n > 1) setEstado((s) => alternar(s, a.pilha, dim)); return; }
    setEstado((s) => {
      let n = a.aberta ? destacar(s, a.id, a.x, a.y, dim) : mover(s, a.pilha, a.x, a.y, dim);
      if (a.alvo) { const de = n.pilhas.find((p) => p.ids.includes(a.id)).id; n = empilhar(n, de, a.alvo); }
      return n;
    });
  };
  const tecla = (e, id) => {
    if (e.target !== e.currentTarget) return;
    if (e.key === 'Enter' || e.key === ' ') { if (pos[id].n > 1) { e.preventDefault(); setEstado((s) => alternar(s, pos[id].pilha, dim)); } }
  };

  const grupos = estado.pilhas.filter((p) => p.ids.length > 1).length;
  const aplicar = useCallback((fn) => setEstado((s) => fn(s)), []);
  if (!itens.length) return vazio;
  const alturaMesa = Math.max(altura(estado, dim), arrasto ? arrasto.y + alt + 20 : 0);
  return (
    <div className="bj-tudo">
      <div className="bj-barra" role="toolbar" aria-label="Organizar cartas">
        <button type="button" className="btn mini menta" onClick={() => aplicar((s) => agrupar(s, itens, dim))} data-testid="bj-agrupar" title="Junta numa pilha os temas parecidos">🗂 Agrupar parecidos</button>
        <button type="button" className="btn mini" onClick={() => aplicar((s) => desagrupar(s, dim))} data-testid="bj-desagrupar" disabled={!grupos}>Desfazer pilhas</button>
        <button type="button" className="btn mini" onClick={() => aplicar((s) => abrirTodas(s, true, dim))} disabled={!grupos}>Abrir pilhas</button>
        <button type="button" className="btn mini" onClick={() => aplicar((s) => abrirTodas(s, false, dim))} disabled={!grupos}>Fechar pilhas</button>
        <button type="button" className="btn mini" onClick={() => aplicar((s) => reorganizar(s, dim))} data-testid="bj-organizar">Organizar</button>
        <span className="sub bj-dica" aria-live="polite">{grupos ? `${grupos} pilha(s) · ` : ''}arraste uma carta; solte sobre outra para empilhar; toque numa pilha para abrir.</span>
      </div>
      <Mesa ref={raiz} className={`bj${arrasto?.moveu ? ' arrastando' : ''}`} style={{ height: alturaMesa }} data-testid={testid} onPointerMove={andar}>
        {itens.map((it) => {
          const p = pos[it.id]; if (!p) return null;
          const eu = arrasto?.moveu && arrasto.id === it.id; const naPilha = arrasto?.moveu && arrasto.pilha === p.pilha && !arrasto.aberta;
          const x = eu || naPilha ? arrasto.x + (p.x - (pos[arrasto.id]?.x ?? p.x)) : p.x; const y = eu || naPilha ? arrasto.y + (p.y - (pos[arrasto.id]?.y ?? p.y)) : p.y;
          const alvo = arrasto?.alvo === p.pilha && p.topo;
          const pilhaItens = p.n > 1 ? estado.pilhas.find((q) => q.id === p.pilha).ids.map((id) => porId.get(id)).filter(Boolean) : [];
          return (
            <Carta key={it.id} className={`bj-carta${p.topo ? '' : ' fundo'}${eu || naPilha ? ' voando' : ''}${alvo ? ' alvo' : ''}${p.n > 1 ? ' pilha' : ''}${reduz ? ' sem-anim' : ''} ${it.classe ?? ''}`}
              data-testid={testidCarta} data-pilha={p.pilha} data-n={p.n}
              style={{ width: dim.larg, height: dim.alt, transform: `translate(${x}px, ${y}px) rotate(${p.rot}deg)${eu ? ' scale(1.04)' : ''}`, zIndex: eu || naPilha ? 1000 + p.z : p.z }}
              onPointerDown={(e) => baixar(e, it.id)} onPointerUp={soltar} onPointerCancel={() => setArrasto(null)} onKeyDown={(e) => tecla(e, it.id)}
              tabIndex={p.topo && p.n > 1 ? 0 : undefined} aria-label={p.n > 1 && p.topo ? `Pilha de ${p.n} cartas. Enter abre ou fecha.` : undefined}>
              <div className="bj-conteudo">{renderizar(it)}</div>
              {p.n > 1 && p.topo && <span className="bj-selo" aria-hidden="true">⧉ {p.n}{rotuloPilha ? ` · ${rotuloPilha(pilhaItens)}` : ''}</span>}
            </Carta>
          );
        })}
      </Mesa>
    </div>
  );
}
