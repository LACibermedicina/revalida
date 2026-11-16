// "Me mostre como": destaca, passo a passo, o botão que a pessoa precisa usar. Tudo em volta fica desfocado e escurecido,
// uma seta de desenho animado aponta para o alvo e um balão diz o que fazer. O alvo continua clicável: clicar nele
// avança para o próximo passo (ou "Próximo" avança sem clicar). Esc ou "Fechar" encerra.
import React, { useEffect, useLayoutEffect, useState } from 'react';
import { createPortal } from 'react-dom';

/** Acha o elemento do passo: seletor CSS e, se houver, o texto que ele precisa conter. */
export function acharAlvo(p) {
  const lista = [...document.querySelectorAll(p.seletor)].filter((el) => el.offsetParent !== null || el.getClientRects().length);
  const el = p.textoAlvo ? lista.find((e) => e.textContent.toLowerCase().includes(p.textoAlvo.toLowerCase())) : lista[0];
  return el ?? null;
}

export default function Holofote({ passos, aoFim }) {
  const [i, setI] = useState(0);
  const [r, setR] = useState(null);
  const p = passos[i];
  // procura o alvo (ele pode aparecer um instante depois, quando a caixa do grupo ou a janela abre)
  useLayoutEffect(() => {
    if (!p) return undefined;
    let vivo = true; let tent = 0; let el = null; let t;
    const medir = () => {
      if (!vivo) return;
      el = acharAlvo(p);
      if (el) { el.scrollIntoView?.({ block: 'nearest', inline: 'nearest' }); const b = el.getBoundingClientRect(); setR({ x: b.left, y: b.top, w: b.width, h: b.height }); }
      else if (tent++ < 25) { setR(null); t = setTimeout(medir, 160); }
      else setR(null);
    };
    medir();
    const re = () => { if (el) { const b = el.getBoundingClientRect(); setR({ x: b.left, y: b.top, w: b.width, h: b.height }); } };
    addEventListener('resize', re); const iv = setInterval(re, 400);
    // clicar no próprio alvo avança
    const clique = (e) => { if (el && el.contains(e.target)) setTimeout(() => setI((n) => n + 1), 250); };
    addEventListener('click', clique, true);
    return () => { vivo = false; clearTimeout(t); clearInterval(iv); removeEventListener('resize', re); removeEventListener('click', clique, true); };
  }, [i, p]);
  useEffect(() => { if (i >= passos.length) aoFim(); }, [i, passos.length, aoFim]);
  useEffect(() => { const esc = (e) => e.key === 'Escape' && aoFim(); addEventListener('keydown', esc); return () => removeEventListener('keydown', esc); }, [aoFim]);
  if (!p) return null;
  const m = 8;
  const buraco = r ? { x: r.x - m, y: r.y - m, w: r.w + 2 * m, h: r.h + 2 * m } : null;
  // seta: vem de cima-esquerda se houver espaço; senão, de baixo
  const deCima = buraco ? buraco.y > 150 : true;
  const seta = buraco ? { x: buraco.x + buraco.w / 2, y: deCima ? buraco.y - 8 : buraco.y + buraco.h + 8 } : null;
  const balao = buraco
    ? { left: Math.min(Math.max(12, buraco.x + buraco.w / 2 - 150), innerWidth - 312), top: deCima ? Math.max(12, buraco.y - 190) : Math.min(innerHeight - 140, buraco.y + buraco.h + 96) }
    : { left: innerWidth / 2 - 150, top: innerHeight / 2 - 60 };
  const veus = buraco ? [
    { left: 0, top: 0, width: '100vw', height: Math.max(0, buraco.y) },
    { left: 0, top: buraco.y + buraco.h, width: '100vw', height: `calc(100vh - ${buraco.y + buraco.h}px)` },
    { left: 0, top: buraco.y, width: Math.max(0, buraco.x), height: buraco.h },
    { left: buraco.x + buraco.w, top: buraco.y, width: `calc(100vw - ${buraco.x + buraco.w}px)`, height: buraco.h },
  ] : [{ left: 0, top: 0, width: '100vw', height: '100vh' }];
  return createPortal(
    <div className="hf" data-testid="holofote">
      {veus.map((s, k) => <div key={k} className="hf-veu" style={s} onClick={(e) => e.stopPropagation()} />)}
      {buraco && <div className="hf-anel" style={{ left: buraco.x, top: buraco.y, width: buraco.w, height: buraco.h }} />}
      {seta && (
        <svg className={`hf-seta${deCima ? '' : ' de-baixo'}`} style={{ left: seta.x - 34, top: deCima ? seta.y - 92 : seta.y }} width="68" height="92" viewBox="0 0 68 92" aria-hidden="true">
          <path d="M34 6c-10 18-6 38 0 58" fill="none" stroke="#1C2B4A" strokeWidth="13" strokeLinecap="round" />
          <path d="M34 6c-10 18-6 38 0 58" fill="none" stroke="#FFC93C" strokeWidth="8" strokeLinecap="round" />
          <path d="M14 56l20 30 20-30z" fill="#FFC93C" stroke="#1C2B4A" strokeWidth="4" strokeLinejoin="round" />
          <path d="M28 18c-2 8-2 16 0 24" stroke="#fff" strokeWidth="3" strokeLinecap="round" opacity=".7" />
        </svg>
      )}
      <div className="hf-balao" style={balao} role="dialog" aria-live="polite">
        <small>Passo {Math.min(i + 1, passos.length)} de {passos.length}</small>
        <p>{p.texto}{!r && <em> (procurando o botão…)</em>}</p>
        <div className="acoes">
          <button type="button" className="btn mini menta" onClick={() => setI((n) => n + 1)}>{i + 1 < passos.length ? 'Próximo' : 'Entendi'}</button>
          <button type="button" className="btn mini" onClick={aoFim}>Fechar</button>
        </div>
      </div>
    </div>, document.body);
}
