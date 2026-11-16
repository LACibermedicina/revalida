// Cartões da estação na lateral direita da tela: cada cartão liberado entra na trilha (com animação) e a trilha
// se reorganiza; um toque abre o cartão numa janelinha que pode ser arrastada para qualquer lugar. Vários podem ficar abertos.
import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import TextoEstacao from './TextoEstacao.jsx';

const ICONE = { descricao: '📝', cenario: '🏥', instrucoes: '📌', laboratorial: '🧪', imagem: '🩻', biopsia: '🔬', laudo: '📄', exame_fisico: '🩺', outro: '📋' };
const ehExameFisico = (c) => /exame f[ií]sico|sinais vitais/i.test(`${c.titulo} ${c.tipo}`);

function CartaAberta({ c, indice, aoFechar, aoFrente, z }) {
  const [pos, setPos] = useState(() => ({ x: Math.max(16, innerWidth - 1100 - indice * 26), y: 96 + indice * 30 }));
  const a = useRef(null);
  return (
    <article className="ct-carta-aberta" style={{ left: pos.x, top: pos.y, zIndex: z }} role="dialog" aria-label={c.titulo} onPointerDown={aoFrente} data-testid="carta-aberta">
      <header onPointerDown={(e) => { if (e.target.closest('button')) return; a.current = { px: e.clientX, py: e.clientY, x: pos.x, y: pos.y }; e.currentTarget.setPointerCapture(e.pointerId); }}
        onPointerMove={(e) => { const s = a.current; if (!s) return; setPos({ x: Math.min(Math.max(s.x + e.clientX - s.px, 0), innerWidth - 120), y: Math.min(Math.max(s.y + e.clientY - s.py, 0), innerHeight - 60) }); }}
        onPointerUp={() => { a.current = null; }}>
        <span aria-hidden="true">{c.icone}</span><b>{c.titulo}</b>
        <button type="button" onClick={aoFechar} aria-label="Fechar cartão">×</button>
      </header>
      <div className="ct-carta-corpo"><TextoEstacao corpo={c.corpo} /></div>
    </article>
  );
}

/** `dados` = resposta de /cartas (iniciais + materiais). Mostra só o que o candidato pode ver. */
export default function CartasTrilho({ dados }) {
  const [abertas, setAbertas] = useState([]);   // ids na ordem de abertura (a última fica na frente)
  const vistos = useRef(new Set());
  const [novos, setNovos] = useState(new Set());
  const cartas = !dados ? [] : [
    ...dados.iniciais.map((c) => ({ id: `ini-${c.tipo}`, titulo: c.titulo, corpo: c.corpo, icone: ICONE[c.tipo] ?? '📋', tipo: c.tipo })),
    ...dados.materiais.filter((m) => m.liberado).map((m) => ({ id: `mat-${m.id}`, titulo: m.titulo, corpo: m.conteudo, tipo: m.tipo, icone: ICONE[m.tipo] ?? '📋' })),
  ].map((c) => (ehExameFisico(c) ? { ...c, icone: ICONE.exame_fisico } : c));
  // cartão que acabou de ser liberado: destaque por alguns segundos
  useEffect(() => {
    const chegaram = cartas.filter((c) => !vistos.current.has(c.id)).map((c) => c.id);
    if (!chegaram.length) return undefined;
    const primeira = vistos.current.size === 0;
    chegaram.forEach((id) => vistos.current.add(id));
    if (primeira) return undefined;
    setNovos((n) => new Set([...n, ...chegaram]));
    const t = setTimeout(() => setNovos((n) => { const m = new Set(n); chegaram.forEach((id) => m.delete(id)); return m; }), 6000);
    return () => clearTimeout(t);
  }, [cartas.map((c) => c.id).join('|')]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!cartas.length) return null;
  const abrir = (id) => setAbertas((l) => [...l.filter((x) => x !== id), id]);
  const fechar = (id) => setAbertas((l) => l.filter((x) => x !== id));
  return createPortal(
    <>
      <nav className="ct-trilha" aria-label="Cartões da estação" data-testid="trilha-cartas">
        {cartas.map((c) => (
          <button key={c.id} type="button" className={`ct-ficha${abertas.includes(c.id) ? ' aberta' : ''}${novos.has(c.id) ? ' nova' : ''}`} onClick={() => (abertas.includes(c.id) ? fechar(c.id) : abrir(c.id))} title={c.titulo}>
            <span className="ct-ficha-ic" aria-hidden="true">{c.icone}</span><span className="ct-ficha-t">{c.titulo}</span>
            {novos.has(c.id) && <em className="ct-ficha-novo">novo</em>}
          </button>
        ))}
      </nav>
      {abertas.map((id, i) => { const c = cartas.find((x) => x.id === id); return c ? <CartaAberta key={id} c={c} indice={i} z={260 + i} aoFrente={() => abrir(id)} aoFechar={() => fechar(id)} /> : null; })}
    </>, document.body);
}

/** Painel à parte da estação em andamento: abre sozinho quando a estação começa, pode ser arrastado, recolhido e reaberto. */
export function PainelEstacao({ titulo, subtitulo, aberto, aoAlternar, children, extra }) {
  const [pos, setPos] = useState(null);
  const a = useRef(null);
  if (!aberto) {
    return createPortal(
      <button type="button" className="pe-reabrir" onClick={aoAlternar} data-testid="reabrir-painel"><span aria-hidden="true">📋</span> Painel da estação {extra}</button>, document.body);
  }
  return createPortal(
    <section className="pe" style={pos ? { left: pos.x, top: pos.y, right: 'auto' } : undefined} aria-label="Painel da estação" data-testid="painel-estacao">
      <header className="pe-cab"
        onPointerDown={(e) => { if (e.target.closest('button')) return; const r = e.currentTarget.parentElement.getBoundingClientRect(); a.current = { px: e.clientX, py: e.clientY, x: r.left, y: r.top }; e.currentTarget.setPointerCapture(e.pointerId); }}
        onPointerMove={(e) => { const s = a.current; if (!s) return; setPos({ x: Math.min(Math.max(s.x + e.clientX - s.px, 0), innerWidth - 200), y: Math.min(Math.max(s.y + e.clientY - s.py, 0), innerHeight - 80) }); }}
        onPointerUp={() => { a.current = null; }}>
        <div><b>{titulo}</b>{subtitulo && <small>{subtitulo}</small>}</div>
        {extra}
        <button type="button" className="pe-rec" onClick={aoAlternar} aria-label="Recolher o painel" title="Recolher (o botão Painel da estação traz de volta)">–</button>
      </header>
      <div className="pe-corpo">{children}</div>
    </section>, document.body);
}
