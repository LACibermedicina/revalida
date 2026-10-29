// Quadro móvel que explica o contexto de um tema (argumento): onde cai na prova, como a pessoa está, diretrizes, temas ligados,
// resumo e cartões. Abre ao clicar no tema em Estudo e Catálogo; arrasta, minimiza e acompanha o tamanho da janela.
import React, { useCallback, useEffect, useState } from 'react';
import { QuadroFlutuante } from './Quadros.jsx';
import TextoEstacao from './TextoEstacao.jsx';
import './quadro-tema.css';

const AREAS = { clinica_medica: 'Clínica Médica', cirurgia: 'Cirurgia', ginecologia_obstetricia: 'Ginecologia e Obstetrícia', pediatria: 'Pediatria', mfc: 'Medicina de Família e Comunidade' };
const REL = { pre_requisito: 'pré-requisito', diagnostico_diferencial: 'diagnóstico diferencial', complicacao: 'complicação', conduta_relacionada: 'conduta relacionada', mesma_area: 'mesma área' };

export default function QuadroTema({ temaId, nome, area, token, api, aoFechar, aoCartoes, aoPraticar }) {
  const [id, setId] = useState(temaId ?? null);
  const [t, setT] = useState(null);
  const [msg, setMsg] = useState('');
  const [ocupado, setOcupado] = useState('');
  const [foco, setFoco] = useState('');
  const [aberto, setAberto] = useState(null);

  // tema vindo do catálogo ou da matriz por ano ainda não existe no mapa: o servidor cria/acha pelo nome
  useEffect(() => {
    if (temaId) { setId(temaId); return undefined; }
    let vivo = true; setId(null);
    api('/api/estudo/temas/resolver', { metodo: 'POST', token, corpo: { nome, area } }).then((r) => vivo && setId(r.id)).catch((e) => vivo && setMsg(e.message));
    return () => { vivo = false; };
  }, [temaId, nome, area, api, token]);

  const carregar = useCallback(() => (id ? api(`/api/estudo/temas/${id}`, { token }).then((r) => { setT(r); setAberto((a) => a ?? r.resumos[0]?.id ?? null); }).catch((e) => setMsg(e.message)) : Promise.resolve()), [id, api, token]);
  useEffect(() => { setT(null); setMsg(''); setAberto(null); carregar(); }, [carregar]);

  const gerar = async (rotulo, caminho, corpo, ok) => {
    setOcupado(rotulo); setMsg('');
    try { const r = await api(caminho, { metodo: 'POST', token, corpo }); setMsg(ok(r)); await carregar(); } catch (e) { setMsg(e.message); } finally { setOcupado(''); }
  };
  const titulo = t?.tema.nome ?? nome ?? 'Tema';
  const c = t?.contexto;
  const hoje = t ? t.series.reduce((s, x) => s + x.vencidos, 0) : 0;
  const pctDes = c?.desempenho === null || c?.desempenho === undefined ? null : Math.round(c.desempenho * 100);

  return (
    <QuadroFlutuante id="tema" titulo={titulo} aoFechar={aoFechar} largura={440}>
      {!t ? <p className="sub" role="status">{msg || 'Carregando o tema…'}</p> : (
        <div className="qt" data-testid="quadro-tema">
          <p className="qt-meta">{t.tema.area ? AREAS[t.tema.area] : 'Sem área definida'} · relevância {'★'.repeat(Math.min(5, Math.max(1, c.relevancia ?? 3)))}</p>
          <div className="qt-grade">
            <div><b>{c.anos_prova.length || '—'}</b><span>{c.anos_prova.length ? `edições em que caiu` : 'sem registro na matriz'}</span></div>
            <div><b>{pctDes === null ? '—' : `${pctDes}%`}</b><span>seu desempenho</span></div>
            <div><b>{c.cartoes_total}</b><span>cartões{hoje ? ` (${hoje} hoje)` : ''}</span></div>
          </div>
          {c.anos_prova.length > 0 && <p className="qt-anos" aria-label="Anos em que o tema caiu">{c.anos_prova.map((a) => <span key={a}>{String(a).replace(/^20/, '')}</span>)}</p>}
          {c.lacunas > 0 && <p className="aviso">Você tem {c.lacunas} lacuna(s) registrada(s) neste tema.</p>}

          <section aria-label="Explicação do argumento">
            <h4>O argumento</h4>
            {t.resumos.length === 0 && <p className="sub">Ainda não há resumo deste tema. Gere um abaixo (a IA usa as diretrizes cadastradas).</p>}
            {t.resumos.map((r) => (
              <article key={r.id} className="qt-resumo">
                <button type="button" className="ln" aria-expanded={aberto === r.id} onClick={() => setAberto(aberto === r.id ? null : r.id)}>{r.titulo}{r.foco ? ` · ${r.foco}` : ''}</button>
                {aberto === r.id && <TextoEstacao corpo={r.corpo} compacto />}
              </article>
            ))}
            <form className="qt-foco" onSubmit={(e) => { e.preventDefault(); gerar('resumo', `/api/estudo/temas/${id}/resumo`, { foco }, () => 'Resumo gerado.'); }}>
              <input value={foco} maxLength={120} onChange={(e) => setFoco(e.target.value)} placeholder="Aprofundar em… (opcional)" aria-label="Ponto a aprofundar no resumo" />
              <button className="btn mini" disabled={!!ocupado}>{ocupado === 'resumo' ? 'Gerando…' : 'Explicar (IA)'}</button>
            </form>
          </section>

          <section aria-label="Diretrizes">
            <h4>Referências</h4>
            {t.diretrizes.length === 0 ? <p className="sub">Sem diretriz de referência cadastrada: o conteúdo gerado deve ser conferido.</p>
              : <ul className="qt-lista">{t.diretrizes.map((d) => <li key={d.id}><b>{d.titulo}</b> <small>{d.fonte}</small></li>)}</ul>}
          </section>

          {t.relacoes.length > 0 && (
            <section aria-label="Temas ligados"><h4>Liga com</h4>
              <ul className="qt-lista">{t.relacoes.map((r, k) => <li key={k}><em>{REL[r.tipo] ?? r.tipo}</em> <button type="button" className="ln" onClick={() => { setT(null); setId(r.outro); }}>{r.nome}</button>{r.motivo ? ` — ${r.motivo}` : ''}</li>)}</ul>
            </section>
          )}

          <div className="es-acoes qt-acoes">
            <button type="button" className="btn mini menta" disabled={!!ocupado} data-testid="quadro-criar-cards"
              onClick={() => gerar('cartoes', `/api/estudo/temas/${id}/cartoes/gerar`, { quantidade: 8, foco: foco || t.tema.nome, aprofundar: true }, (r) => `Nova série ${r.serie} com ${r.total} cartões aprofundados.`)}>{ocupado === 'cartoes' ? 'Gerando…' : 'Criar cards do argumento'}</button>
            {aoCartoes && <button type="button" className="btn mini" disabled={!t.series.length} onClick={() => aoCartoes(id)}>Estudar cartões</button>}
            {aoPraticar && t.estacoes.slice(0, 2).map((e) => <button key={e.id} type="button" className="btn mini" onClick={() => aoPraticar(e.id)}>Praticar: {e.titulo}</button>)}
          </div>
          {ocupado && <p className="sub" role="status">A IA está trabalhando… pode levar até um minuto.</p>}
          {msg && <p className="aviso" role="status">{msg}</p>}
        </div>
      )}
    </QuadroFlutuante>
  );
}
