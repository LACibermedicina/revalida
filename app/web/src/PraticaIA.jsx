// Estação solo com paciente IA: o paciente responde pelo script do ator; ao encerrar, a IA corrige pelo checklist e mostra o feedback.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { criarTranscritor, podeTranscrever } from './transcricao.js';
import TelaAnalise from './Analise.jsx';
import './solo.css';

const mmss = (ms) => { const s = Math.max(0, Math.round(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

export function ScriptEstudo({ estacaoId, api, token }) {
  const [d, setD] = useState(null); const [erro, setErro] = useState('');
  useEffect(() => { api(`/api/estacoes/${estacaoId}/script-ator`, { token }).then(setD).catch((e) => setErro(e.message)); }, [estacaoId, api, token]);
  if (erro) return <p className="sub">{erro}</p>;
  if (!d) return null;
  return (
    <section className="pia-script" data-testid="script-estudo">
      <h3>🎭 Script do ator (para estudar)</h3>
      <p className="sub">É o que o paciente podia responder. Compare com o que você perguntou e volte nas lacunas.</p>
      <pre className="pia-pre">{d.script_ator}</pre>
      {d.materiais.length > 0 && <details><summary>Materiais de apoio ({d.materiais.length})</summary>
        <ul>{d.materiais.map((m) => <li key={m.id}><b>{m.titulo}</b> <span className="sub">(liberado quando: {m.gatilho || 'pedido'})</span><br />{m.conteudo}</li>)}</ul></details>}
    </section>
  );
}

export default function PraticaIA({ execId, token, api, aoSair, aoNova }) {
  const [info, setInfo] = useState(null);
  const [turnos, setTurnos] = useState([]);
  const [texto, setTexto] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState('');
  const [aviso, setAviso] = useState('');
  const [voz, setVoz] = useState(false);       // o paciente fala em voz alta
  const [ouvindo, setOuvindo] = useState(false);
  const [agora, setAgora] = useState(Date.now());
  const [resultado, setResultado] = useState(null);
  const [corrigindo, setCorrigindo] = useState(false);
  const [cartas, setCartas] = useState(null);
  const fim = useRef(null); const tr = useRef(null); const enviarRef = useRef(null);

  const carregar = useCallback(async () => {
    try {
      const r = await api(`/api/execucoes/${execId}/paciente`, { token }); setInfo(r); setTurnos(r.turnos);
      if (r.estado === 'finalizada') setResultado((x) => x ?? { nota: null, max: null });
      setCartas(await api(`/api/execucoes/${execId}/cartas`, { token }));
    } catch (e) { setErro(e.message); }
  }, [api, token, execId]);
  useEffect(() => { carregar(); }, [carregar]);
  useEffect(() => { const t = setInterval(() => setAgora(Date.now()), 1000); return () => clearInterval(t); }, []);
  useEffect(() => { fim.current?.scrollIntoView?.({ block: 'nearest' }); }, [turnos]);

  const falarPaciente = (t) => { if (voz && typeof speechSynthesis !== 'undefined') { try { speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(t); u.lang = 'pt-BR'; speechSynthesis.speak(u); } catch { /* sem voz */ } } };
  const enviar = async (t) => {
    const msg = String(t ?? '').trim(); if (!msg || ocupado) return;
    setOcupado(true); setErro(''); setAviso('');
    setTurnos((x) => [...x, { ordem: x.length + 1, autor: 'candidato', texto: msg }]);
    try {
      const r = await api(`/api/execucoes/${execId}/paciente`, { metodo: 'POST', token, corpo: { texto: msg } });
      setTurnos((x) => [...x, { ordem: r.ordem, autor: 'paciente', texto: r.fala }]); falarPaciente(r.fala);
      if (r.aviso) setAviso(r.aviso);
      if (r.liberados?.length) { setAviso((a) => `${a ? `${a} ` : ''}Material liberado: ${r.liberados.map((m) => m.titulo).join(', ')}.`); setCartas(await api(`/api/execucoes/${execId}/cartas`, { token })); }
    } catch (e) { setErro(e.message); }
    setOcupado(false);
  };
  enviarRef.current = enviar;
  const mandar = (e) => { e.preventDefault(); const t = texto; setTexto(''); enviar(t); };

  const alternarMic = () => {
    if (ouvindo) { tr.current?.parar(); setOuvindo(false); return; }
    if (!tr.current) tr.current = criarTranscritor({ enviarTexto: async (t) => { await enviarRef.current(t); }, enviarAudio: async () => {}, aoEstado: (s) => setOuvindo(s === 'ouvindo') });
    tr.current.iniciar();
  };
  useEffect(() => () => { tr.current?.parar(false); try { speechSynthesis.cancel(); } catch { /* ok */ } }, []);

  const corrigir = async () => {
    if (!window.confirm('Encerrar a estação e pedir a correção da IA?')) return;
    setCorrigindo(true); setErro(''); tr.current?.parar(false); setOuvindo(false);
    try { setResultado(await api(`/api/execucoes/${execId}/corrigir-ia`, { metodo: 'POST', token })); } catch (e) { setErro(e.message); }
    setCorrigindo(false);
  };
  const desistir = async () => {
    if (!window.confirm('Desistir desta estação? Nada fica registrado como feito.')) return;
    try { await api(`/api/execucoes/${execId}/desistir-ia`, { metodo: 'POST', token }); aoSair?.(); } catch (e) { setErro(e.message); }
  };

  if (resultado) {
    return (
      <div className="pia" data-testid="pratica-ia-resultado">
        <h2>Correção da IA</h2>
        {resultado.nota !== null && <p className="pia-nota" data-testid="pia-nota"><b>{resultado.nota}</b> / {resultado.max} pontos{resultado.criticos_falhos ? ` · ${resultado.criticos_falhos} item(ns) crítico(s) faltando` : ''}</p>}
        {resultado.aviso && <p className="aviso">{resultado.aviso}</p>}
        {info && <p className="sub">Registrado: estação feita com <b>Paciente IA</b>{info.variacao_tema ? <> · variação temática principal: <b>{info.variacao_tema}</b></> : null}.</p>}
        <TelaAnalise execId={execId} token={token} api={api} aoVoltar={aoSair} aoPraticar={() => aoNova?.()} aoCartoes={() => {}} aoNovaEstacao={() => aoNova?.()} />
        {info && <ScriptEstudo estacaoId={info.estacao.id} api={api} token={token} />}
        <div className="pia-acoes"><button type="button" className="btn menta" onClick={() => aoNova?.()} data-testid="pia-outra">Praticar outra estação</button><button type="button" className="btn" onClick={aoSair}>Voltar</button></div>
      </div>
    );
  }
  const restante = info ? new Date(info.iniciada_em).getTime() + info.estacao.duracao_min * 60000 - agora : null;
  return (
    <div className="pia" data-testid="pratica-ia">
      <header className="pia-topo">
        <div><h2>{info?.estacao.titulo ?? 'Estação'}</h2><p className="sub">Você é o candidato. O paciente é interpretado pela IA com o script do ator. {info?.variacao_tema ? `Tema: ${info.variacao_tema}.` : ''}</p></div>
        {restante !== null && <span className={`pia-tempo${restante < 60000 ? ' fim' : ''}`} data-testid="pia-tempo" role="timer">⏱ {mmss(restante)}</span>}
      </header>
      {cartas && <details className="pia-cartas" open><summary>Descrição, cenário e materiais liberados</summary>
        {cartas.iniciais.map((c) => <div key={c.tipo}><b>{c.titulo}</b><p>{c.corpo}</p></div>)}
        {cartas.materiais.map((m) => <div key={m.id} className="pia-mat"><b>📎 {m.titulo}</b><p>{m.conteudo}</p></div>)}</details>}
      <div className="pia-chat" role="log" aria-live="polite" data-testid="pia-chat">
        {turnos.length === 0 && <p className="sub">Cumprimente o paciente e comece a anamnese.</p>}
        {turnos.map((t) => <div key={`${t.autor}${t.ordem}`} className={`pia-msg ${t.autor}`} data-testid={`msg-${t.autor}`}><span className="pia-quem">{t.autor === 'paciente' ? '🧑‍⚕️ Paciente' : 'Você'}</span><p>{t.texto}</p></div>)}
        {ocupado && <div className="pia-msg paciente digitando" aria-label="Paciente respondendo"><span className="pia-quem">🧑‍⚕️ Paciente</span><p>…</p></div>}
        <div ref={fim} />
      </div>
      {erro && <p className="erro" role="alert">{erro}</p>}
      {aviso && <p className="aviso" role="status">{aviso}</p>}
      <form className="pia-form" onSubmit={mandar}>
        <input value={texto} onChange={(e) => setTexto(e.target.value)} maxLength={600} placeholder="Fale com o paciente…" aria-label="Fala para o paciente" data-testid="pia-texto" disabled={ocupado} />
        <button type="submit" className="btn menta" disabled={ocupado || !texto.trim()} data-testid="pia-enviar">Enviar</button>
        {podeTranscrever() && <button type="button" className={`btn${ouvindo ? ' menta' : ''}`} aria-pressed={ouvindo} onClick={alternarMic} title="Falar com o microfone">🎤 {ouvindo ? 'Ouvindo' : 'Falar'}</button>}
        <label className="pia-voz"><input type="checkbox" checked={voz} onChange={(e) => setVoz(e.target.checked)} /> Paciente em voz alta</label>
      </form>
      <div className="pia-acoes">
        <button type="button" className="btn menta" onClick={corrigir} disabled={corrigindo || turnos.length === 0} data-testid="pia-corrigir">{corrigindo ? 'A IA está corrigindo…' : 'Encerrar e corrigir'}</button>
        <button type="button" className="btn" onClick={desistir}>Desistir</button>
      </div>
    </div>
  );
}
