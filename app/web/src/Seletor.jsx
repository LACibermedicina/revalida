// Substitui o <select> por uma escolha visual: poucas opções viram fichas com ícone (clique escolhe, com animação);
// muitas opções viram um botão que abre uma grade de fichas flutuante (não empurra o layout).
// Aceita os mesmos props e <option> filhos de um <select>, e chama onChange({ target: { value } }) como ele.
import React, { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

const AREA = {
  clinica_medica: ['CM', '#3D9BFF'], cirurgia: ['CI', '#9B6BFF'], ginecologia_obstetricia: ['GO', '#FF6FA8'], pediatria: ['PE', '#2FCB78'], mfc: ['MF', '#FF9B3D'],
};
const NIVEL = { basica: 1, básica: 1, basico: 1, básico: 1, intermediaria: 2, intermediária: 2, avancada: 3, avançada: 3, facil: 1, fácil: 1, medio: 2, médio: 2, media: 2, média: 2, dificil: 3, difícil: 3, avancado: 3, avançado: 3 };
const CORES = ['#3D9BFF', '#2FCB78', '#FF9B3D', '#9B6BFF', '#FF6FA8', '#22C7B0', '#FF5A4E', '#E5A100'];

function texto(n) {
  if (n == null || typeof n === 'boolean') return '';
  if (typeof n === 'string' || typeof n === 'number') return String(n);
  if (Array.isArray(n)) return n.map(texto).join('');
  return texto(n.props?.children);
}
function opcoes(children) {
  const out = [];
  const varrer = (c) => React.Children.forEach(c, (el) => {
    if (!el) return;
    if (el.type === React.Fragment) return varrer(el.props.children);
    if (el.type === 'optgroup') return varrer(el.props.children);
    if (el.type === 'option') {
      const rot = texto(el.props.children);
      out.push({ valor: String(el.props.value ?? rot), rotulo: rot, desativada: !!el.props.disabled });
    }
  });
  varrer(children);
  return out;
}

/** Ícone da ficha: área (sigla colorida), nível (barrinhas), "todas/qualquer" (estrela) ou a inicial. */
function IconeOpcao({ o, i }) {
  const v = o.valor.toLowerCase();
  if (AREA[v]) return <i className="sel-ic" style={{ '--c': AREA[v][1] }}>{AREA[v][0]}</i>;
  const n = NIVEL[v] ?? NIVEL[o.rotulo.toLowerCase()];
  if (n) return <i className="sel-ic sel-nivel" style={{ '--c': ['#2FCB78', '#FFB020', '#FF5A4E'][n - 1] }}>{[1, 2, 3].map((k) => <b key={k} className={k <= n ? 'on' : ''} />)}</i>;
  if (v === '') return <i className="sel-ic sel-todas" style={{ '--c': '#8C9BB3' }}>✦</i>;
  if (/^\d+$/.test(v)) return <i className="sel-ic sel-num" style={{ '--c': CORES[i % CORES.length] }}>{v.length > 3 ? '#' : v}</i>;
  const l = (o.rotulo.trim()[0] || '?').toUpperCase();
  return <i className="sel-ic" style={{ '--c': CORES[i % CORES.length] }}>{l}</i>;
}

export default function Seletor({ value, defaultValue, onChange, children, disabled, id, className = '', style, ...resto }) {
  const lista = opcoes(children);
  const [interno, setInterno] = useState(defaultValue ?? lista[0]?.valor ?? '');
  const atual = String(value ?? interno ?? '');
  const [aberto, setAberto] = useState(false);
  const [pos, setPos] = useState(null);
  const botao = useRef(null); const grade = useRef(null);
  const uid = useId();
  const testid = resto['data-testid'];
  const aria = resto['aria-label'];
  const escolher = (v) => {
    if (disabled) return;
    setInterno(v); setAberto(false);
    const ev = { target: { value: v, name: resto.name }, currentTarget: { value: v } };
    onChange?.(ev);
  };
  const sel = lista.find((o) => o.valor === atual) ?? lista[0];
  const muitas = lista.length > 6 || lista.some((o) => o.rotulo.length > 26);

  useLayoutEffect(() => {
    if (!aberto || !botao.current) return;
    const r = botao.current.getBoundingClientRect();
    const larg = Math.min(460, Math.max(260, r.width));
    const left = Math.min(Math.max(8, r.left), innerWidth - larg - 8);
    const abaixo = innerHeight - r.bottom > 260 || r.top < 260;
    setPos({ left, width: larg, ...(abaixo ? { top: r.bottom + 6 } : { bottom: innerHeight - r.top + 6 }) });
  }, [aberto]);
  useEffect(() => {
    if (!aberto) return undefined;
    const fora = (e) => { if (!grade.current?.contains(e.target) && !botao.current?.contains(e.target)) setAberto(false); };
    const tecla = (e) => { if (e.key === 'Escape') { setAberto(false); botao.current?.focus(); } };
    const rolar = () => setAberto(false);
    addEventListener('pointerdown', fora, true); addEventListener('keydown', tecla); addEventListener('scroll', rolar, true);
    setTimeout(() => grade.current?.querySelector('[aria-checked=true]')?.focus(), 0);
    return () => { removeEventListener('pointerdown', fora, true); removeEventListener('keydown', tecla); removeEventListener('scroll', rolar, true); };
  }, [aberto]);

  // setas movem a escolha dentro do grupo de fichas (como um rádio)
  const setas = (e) => {
    const k = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    if (!k) return;
    e.preventDefault();
    const ativas = lista.filter((o) => !o.desativada);
    if (muitas) {
      const bts = [...e.currentTarget.querySelectorAll('[role=radio]:not(:disabled)')];
      bts[(bts.indexOf(document.activeElement) + k + bts.length) % bts.length]?.focus(); return;
    }
    const i = ativas.findIndex((o) => o.valor === atual);
    const prox = ativas[(i + k + ativas.length) % ativas.length];
    escolher(prox.valor);
    setTimeout(() => e.target.closest('[role=radiogroup]')?.querySelector('[aria-checked=true]')?.focus(), 0);
  };
  const ficha = (o, i, extra = {}) => (
    <button key={o.valor + i} type="button" role="radio" aria-checked={o.valor === atual} tabIndex={o.valor === atual ? 0 : -1}
      className={`sel-ficha${o.valor === atual ? ' on' : ''}`} disabled={disabled || o.desativada} onClick={() => escolher(o.valor)} {...extra}>
      <IconeOpcao o={o} i={i} /><span>{o.rotulo}</span>
    </button>
  );

  return (
    <span className={`sel${muitas ? ' sel-muitas' : ''}${disabled ? ' desativado' : ''} ${className}`} style={style} data-testid={testid}>
      {/* âncora: um <label> em volta aponta para cá, e clicar no texto do rótulo não escolhe nenhuma opção sem querer */}
      <output className="sel-ancora" aria-hidden="true" />
      {!muitas ? (
        <span className="sel-fichas" role="radiogroup" id={id} aria-label={aria} aria-disabled={disabled || undefined} onKeyDown={setas}>
          {lista.map((o, i) => ficha(o, i))}
        </span>
      ) : (
        <>
          <button ref={botao} type="button" id={id} className={`sel-botao${aberto ? ' aberto' : ''}`} disabled={disabled} aria-haspopup="dialog" aria-expanded={aberto}
            aria-label={aria ? `${aria}: ${sel?.rotulo ?? ''}` : undefined} onClick={() => setAberto((a) => !a)}>
            {sel && <IconeOpcao o={sel} i={lista.indexOf(sel)} />}<span>{sel?.rotulo ?? 'Escolher'}</span><i className="sel-seta" aria-hidden="true" />
          </button>
          {aberto && pos && createPortal(
            <div ref={grade} className="sel-grade" role="radiogroup" aria-label={aria || 'Escolha uma opção'} id={`${uid}-g`} style={pos} onKeyDown={setas}>
              {lista.map((o, i) => ficha(o, i, { tabIndex: 0 }))}
            </div>, document.body)}
        </>
      )}
    </span>
  );
}
