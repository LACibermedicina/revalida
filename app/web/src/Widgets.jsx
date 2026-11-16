// Widgets da mesa (Início no modo mesa): caixas translúcidas no estilo das notificações do macOS, soltas sobre o fundo.
// Cada uma pode ser arrastada (posição salva no aparelho) e ocultada no ✕; "Exibir › Mostrar o Início" traz todas de volta.
// Somem sozinhas quando alguma janela está aberta na frente.
import React, { useEffect, useRef, useState } from 'react';

const CHAVE = 'rv_widgets';
const ler = () => { try { return JSON.parse(localStorage.getItem(CHAVE)) || {}; } catch { return {}; } };
let estado = ler();
const ouvintes = new Set();
const gravar = (novo) => { estado = novo; try { localStorage.setItem(CHAVE, JSON.stringify(novo)); } catch { /* sem storage */ } ouvintes.forEach((f) => f(novo)); };

export const widgets = {
  mover: (id, x, y, w) => gravar({ ...estado, [id]: { ...estado[id], x, y, w } }),
  ocultar: (id) => gravar({ ...estado, [id]: { ...estado[id], oculto: true } }),
  mostrarTodos: () => gravar(Object.fromEntries(Object.entries(estado).map(([k, v]) => [k, k.startsWith('grupo-') ? v : { ...v, oculto: false }]))),
  mostrar: (id) => gravar({ ...estado, [id]: { ...estado[id], oculto: false } }),
  alternar: (id, padraoOculto) => gravar({ ...estado, [id]: { ...estado[id], oculto: !(estado[id]?.oculto ?? padraoOculto) } }),
  reorganizar: () => gravar(Object.fromEntries(Object.entries(estado).filter(([k]) => k.startsWith('grupo-')).map(([k, v]) => [k, { oculto: v.oculto }]))),
  algumOculto: () => Object.values(estado).some((v) => v.oculto),
};
export function useWidgets() {
  const [e, setE] = useState(estado);
  useEffect(() => { ouvintes.add(setE); return () => ouvintes.delete(setE); }, []);
  return e;
}

const largura = new WeakMap();   // largura da caixa no momento em que começou a ser arrastada
const a0 = (ref) => largura.get(ref.current);
const INTERATIVO = 'button,a,input,select,textarea,label,[role=button],[contenteditable]';

/** Uma caixa do Início na mesa. */
export function Widget({ id, rotulo, children, className = '', padraoOculto = false, titulo = null }) {
  const e = useWidgets()[id] || {};
  const ref = useRef(null);
  const arr = useRef(null);
  const [p, setP] = useState(null);
  if (e.oculto ?? padraoOculto) return null;
  // sem posição salva, a caixa fica no fluxo (colunas automáticas); depois de arrastada, fica onde a pessoa soltou
  const solto = p || e.x != null;
  const pos = p ?? { x: e.x, y: e.y };
  const limitar = (x, y) => {
    const pai = ref.current?.parentElement?.getBoundingClientRect(); const eu = ref.current?.getBoundingClientRect();
    if (!pai || !eu) return { x, y };
    return { x: Math.min(Math.max(x, 0), Math.max(0, pai.width - eu.width)), y: Math.min(Math.max(y, 0), Math.max(0, pai.height - 60)) };
  };
  return (
    <section ref={ref} className={`wd ${className}${p ? ' movendo' : ''}${solto ? ' solto' : ''}`} style={solto ? { left: pos.x, top: pos.y, width: e.w ?? a0(ref) } : undefined} aria-label={rotulo} data-widget={id}
      onPointerDown={(ev) => {
        if (ev.button > 0 || ev.target.closest(INTERATIVO)) return;
        const el = ev.currentTarget;
        arr.current = { px: ev.clientX, py: ev.clientY, x: solto ? pos.x : el.offsetLeft, y: solto ? pos.y : el.offsetTop, w: el.offsetWidth, mov: false };
        ev.currentTarget.setPointerCapture(ev.pointerId);
      }}
      onPointerMove={(ev) => {
        const a = arr.current; if (!a) return;
        const dx = ev.clientX - a.px, dy = ev.clientY - a.py;
        if (!a.mov && Math.hypot(dx, dy) < 5) return;
        if (!a.mov) largura.set(ref.current, a.w);
        a.mov = true; setP(limitar(a.x + dx, a.y + dy));
      }}
      onPointerUp={() => { const a = arr.current; arr.current = null; if (a?.mov && p) widgets.mover(id, Math.round(p.x), Math.round(p.y), a.w); setP(null); }}
      onPointerCancel={() => { arr.current = null; setP(null); }}>
      <button type="button" className="wd-x" aria-label={`Fechar ${rotulo}`} title={titulo ?? 'Ocultar (Exibir › Mostrar o Início traz de volta)'} onClick={() => widgets.ocultar(id)}>×</button>
      {children}
    </section>
  );
}
