// Fluxograma da conduta de um tema: o caminho do raciocínio na estação (perguntar → examinar → pedir → decidir → conduzir).
// Gerado pela IA uma vez por tema (e por estação, quando há contexto) e guardado. Desenho em SVG, sem biblioteca:
// camadas de cima para baixo, losango nas decisões, caixa vermelha nos alertas. Tocar num passo mostra o detalhe.
import React, { useEffect, useMemo, useState } from 'react';

const L = 200, A = 64, GX = 36, GY = 54;   // largura/altura do passo e espaços

/** Posições em camadas: cada passo fica uma camada abaixo do mais fundo que aponta para ele. */
export function arrumarFluxo(passos) {
  const nivel = new Map(passos.map((p) => [p.id, 0]));
  for (let volta = 0; volta < passos.length; volta += 1) {
    let mudou = false;
    for (const p of passos) for (const x of p.proximos) { const n = nivel.get(p.id) + 1; if (n > (nivel.get(x.para) ?? 0)) { nivel.set(x.para, n); mudou = true; } }
    if (!mudou) break;
  }
  const camadas = [];
  for (const p of passos) { const n = nivel.get(p.id); (camadas[n] ||= []).push(p.id); }
  const largura = Math.max(...camadas.map((c) => c.length)) * (L + GX);
  const pos = new Map();
  camadas.forEach((c, n) => c.forEach((id, i) => pos.set(id, { x: (largura - c.length * (L + GX)) / 2 + i * (L + GX) + GX / 2, y: n * (A + GY) + 10 })));
  return { pos, largura: Math.max(largura, L + GX), altura: camadas.length * (A + GY) + 10 };
}

function Passo({ p, x, y, on, aoClicar, i }) {
  const cor = { inicio: ['#DDF6EA', '#14945A'], fim: ['#DDF6EA', '#14945A'], pergunta: ['#E6F1FF', '#1F5FD1'], acao: ['#FFFFFF', '#3A4A68'], decisao: ['#FFF4D6', '#B07A00'], alerta: ['#FFE3E0', '#C2413F'] }[p.tipo] ?? ['#fff', '#3A4A68'];
  const forma = p.tipo === 'decisao'
    ? <path d={`M${x + L / 2} ${y - 6}L${x + L + 6} ${y + A / 2}L${x + L / 2} ${y + A + 6}L${x - 6} ${y + A / 2}Z`} fill={cor[0]} stroke={cor[1]} strokeWidth={on ? 3 : 1.6} />
    : <rect x={x} y={y} width={L} height={A} rx={p.tipo === 'inicio' || p.tipo === 'fim' ? A / 2 : 14} fill={cor[0]} stroke={cor[1]} strokeWidth={on ? 3 : 1.6} />;
  return (
    <g className="fx-passo" style={{ '--i': i }} onClick={aoClicar} role="button" tabIndex={0} aria-label={`${p.texto}${p.detalhe ? `. ${p.detalhe}` : ''}`}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); aoClicar(); } }}>
      {forma}
      <foreignObject x={x + (p.tipo === 'decisao' ? 26 : 10)} y={y + 4} width={L - (p.tipo === 'decisao' ? 52 : 20)} height={A - 8}>
        <div className="fx-txt" style={{ color: cor[1] }}>{p.tipo === 'alerta' ? '⚠ ' : ''}{p.texto}</div>
      </foreignObject>
    </g>
  );
}

export function FluxoDesenho({ passos }) {
  const [sel, setSel] = useState(null);
  const { pos, largura, altura } = useMemo(() => arrumarFluxo(passos), [passos]);
  const p = passos.find((x) => x.id === sel);
  return (
    <div className="fx">
      <div className="fx-tela">
        <svg viewBox={`0 0 ${largura} ${altura}`} width={largura} height={altura} role="img" aria-label="Fluxograma da conduta">
          <defs><marker id="fx-seta" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="#8C9BB3" /></marker></defs>
          {passos.flatMap((a) => a.proximos.map((x) => {
            const o = pos.get(a.id), d = pos.get(x.para); if (!o || !d) return null;
            const x1 = o.x + L / 2, y1 = o.y + A + (a.tipo === 'decisao' ? 6 : 0), x2 = d.x + L / 2, y2 = d.y - (passos.find((q) => q.id === x.para)?.tipo === 'decisao' ? 8 : 2);
            const meio = (y1 + y2) / 2;
            return (
              <g key={`${a.id}-${x.para}`} className="fx-linha">
                <path d={`M${x1} ${y1}C${x1} ${meio} ${x2} ${meio} ${x2} ${y2}`} fill="none" stroke="#8C9BB3" strokeWidth="2" markerEnd="url(#fx-seta)" />
                {x.rotulo && <text x={(x1 + x2) / 2} y={meio - 4} textAnchor="middle" className="fx-rot">{x.rotulo}</text>}
              </g>
            );
          }))}
          {passos.map((q, i) => { const o = pos.get(q.id); return o ? <Passo key={q.id} p={q} x={o.x} y={o.y} i={i} on={sel === q.id} aoClicar={() => setSel(sel === q.id ? null : q.id)} /> : null; })}
        </svg>
      </div>
      <p className="fx-detalhe" role="status">{p ? <><b>{p.texto}.</b> {p.detalhe || 'Sem detalhe adicional.'}</> : 'Toque num passo para ver o detalhe.'}</p>
    </div>
  );
}

/** Carrega (ou cria com a IA) o fluxograma do tema, no contexto da estação se houver. */
export default function FluxoConduta({ temaId, estacaoId = null, api, token }) {
  const [f, setF] = useState(undefined);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState('');
  const q = estacaoId ? `?estacao_id=${estacaoId}` : '';
  useEffect(() => {
    let vivo = true; setF(undefined); setErro('');
    api(`/api/estudo/temas/${temaId}/fluxo${q}`, { token }).then((r) => vivo && setF(r.fluxo)).catch((e) => vivo && (setErro(e.message), setF(null)));
    return () => { vivo = false; };
  }, [temaId, q, api, token]);
  const gerar = async (refazer = false) => {
    setOcupado(true); setErro('');
    try { const r = await api(`/api/estudo/temas/${temaId}/fluxo`, { metodo: 'POST', token, corpo: { estacao_id: estacaoId, refazer } }); setF(r.fluxo); }
    catch (e) { setErro(e.message); } finally { setOcupado(false); }
  };
  if (f === undefined) return <p className="sub" role="status">Abrindo o fluxograma…</p>;
  return (
    <section className="fx-caixa" data-testid="fluxo-conduta">
      {f ? (
        <>
          <div className="fx-cab"><b>{f.titulo}</b><button type="button" className="btn mini" disabled={ocupado} onClick={() => gerar(true)}>{ocupado ? 'Refazendo…' : 'Refazer com a IA'}</button></div>
          <FluxoDesenho passos={f.passos} />
          <p className="fx-leg"><i className="l-ini" />início/fim <i className="l-perg" />perguntar <i className="l-acao" />fazer <i className="l-dec" />decidir <i className="l-alerta" />alerta</p>
        </>
      ) : (
        <div className="fx-vazio">
          <p>Ainda não há fluxograma deste tema{estacaoId ? ' para esta estação' : ''}. A IA monta o caminho simplificado do raciocínio: o que perguntar, examinar, pedir, decidir e orientar.</p>
          <button type="button" className="btn mini menta" disabled={ocupado} onClick={() => gerar(false)}>{ocupado ? 'Desenhando…' : 'Desenhar o fluxograma'}</button>
        </div>
      )}
      {erro && <p className="aviso" role="alert">{erro}</p>}
    </section>
  );
}
