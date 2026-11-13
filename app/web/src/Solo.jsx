// Praticar com IA sozinho: a IA sorteia o tema onde você mais precisa treinar; você escolhe só dificuldade e tempo.
// Sem escolha: dificuldade média, tempo da estação e 15 itens de checklist.
import React, { useCallback, useEffect, useState } from 'react';
import PraticaIA from './PraticaIA.jsx';
import Mascote from './Mascote.jsx';
import HistoricoEstacoes from './Historico.jsx';
import './solo.css';

const NIVEIS = [['facil', 'Fácil', '🌱'], ['medio', 'Médio', '⚡'], ['dificil', 'Difícil', '🔥']];
const TEMPOS = [[null, 'Padrão (10 min)'], [8, '8 min'], [10, '10 min'], [15, '15 min'], [20, '20 min']];
const AREAS = { clinica_medica: 'Clínica médica', cirurgia: 'Cirurgia', ginecologia_obstetricia: 'Ginecologia e obstetrícia', pediatria: 'Pediatria', mfc: 'Medicina de família' };

export default function TelaSolo({ token, api, aoPraticarEstacao, estacaoInicial = null, aoConsumir }) {
  const [exec, setExec] = useState(null);   // estação em andamento com o paciente IA
  const [info, setInfo] = useState(null);
  const [dif, setDif] = useState('medio');
  const [tempo, setTempo] = useState(null);
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState('');
  const [pronta, setPronta] = useState(null);
  const [hist, setHist] = useState([]);
  const [girando, setGirando] = useState(false);

  const sortear = useCallback(async () => {
    setGirando(true); setErro('');
    try { setInfo(await api('/api/solo/sugestao', { token })); } catch (e) { setErro(e.message); }
    setTimeout(() => setGirando(false), 500);
  }, [api, token]);
  const carregarHist = useCallback(() => api('/api/solo/historico', { token }).then((r) => setHist(r.itens)).catch(() => setHist([])), [api, token]);
  useEffect(() => { sortear(); carregarHist(); }, [sortear, carregarHist]);

  const iniciar = async () => {
    setGerando(true); setErro(''); setPronta(null);
    try {
      const s = info?.sugestao;
      const corpo = { dificuldade: dif, ...(tempo ? { tempo } : {}), ...(s ? { tema: s.tema, area: s.area } : {}) };
      setPronta(await api('/api/solo/iniciar', { metodo: 'POST', token, corpo }));
      carregarHist();
    } catch (e) { setErro(e.message); }
    setGerando(false);
  };

  const comPaciente = async (corpo) => {
    setErro(''); setGerando(true);
    try { const r = await api('/api/solo/praticar', { metodo: 'POST', token, corpo }); setExec(r.execucao_id); } catch (e) { setErro(e.message); }
    setGerando(false);
  };
  useEffect(() => { if (estacaoInicial) { aoConsumir?.(); comPaciente({ estacao_id: estacaoInicial }); } }, [estacaoInicial]); // eslint-disable-line react-hooks/exhaustive-deps
  const s = info?.sugestao;
  if (exec) return <PraticaIA execId={exec} token={token} api={api} aoSair={() => { setExec(null); carregarHist(); }} aoNova={() => { setExec(null); setPronta(null); carregarHist(); }} />;
  return (
    <div className="solo" data-testid="tela-solo">
      <div className="solo-revi"><Mascote tamanho={56} titulo="Epi, o paciente IA" /><h2>Praticar com IA sozinho</h2></div>
      <p className="sub">A IA escolhe o tema entre os que você mais precisa treinar. Você só decide a dificuldade e o tempo.</p>

      <section className={`solo-sorteio${girando ? ' girando' : ''}`} aria-live="polite">
        <span className="solo-dado" aria-hidden="true">🎲</span>
        {s ? (<div><p className="solo-area">{s.area_nome}</p><h3 data-testid="solo-tema">{s.tema}</h3><p className="sub">{s.motivo}</p></div>)
          : (<div><h3>Tema surpresa</h3><p className="sub">Ainda sem histórico: a IA escolhe um tema para começar.</p></div>)}
        <button type="button" className="btn mini" onClick={sortear} disabled={gerando || girando} data-testid="solo-sortear">Sortear outro</button>
      </section>

      <fieldset className="solo-niveis">
        <legend>Dificuldade</legend>
        {NIVEIS.map(([v, r, ic]) => (
          <button key={v} type="button" className={`solo-nivel${dif === v ? ' on' : ''}`} aria-pressed={dif === v} onClick={() => setDif(v)} data-testid={`solo-dif-${v}`}><span aria-hidden="true">{ic}</span>{r}</button>))}
      </fieldset>
      <label className="campo"><span>Tempo</span>
        <select value={tempo ?? ''} onChange={(e) => setTempo(e.target.value ? Number(e.target.value) : null)} data-testid="solo-tempo">
          {TEMPOS.map(([v, r]) => <option key={r} value={v ?? ''}>{r}</option>)}</select></label>
      <p className="sub">Checklist: {info?.padroes?.itens ?? 15} itens.</p>

      {erro && <p className="erro" role="alert">{erro}</p>}
      {info && info.ia === false && <p className="erro" role="alert">A IA não está configurada neste servidor. Peça ao administrador para configurá-la.</p>}
      <button type="button" className="btn menta solo-ir" onClick={iniciar} disabled={gerando || (info && info.ia === false)} data-testid="solo-iniciar">{gerando ? 'A IA está montando a estação…' : 'Gerar e praticar'}</button>

      <button type="button" className="btn" onClick={() => comPaciente({})} disabled={gerando} data-testid="solo-banco">🎲 Estação aleatória do banco com paciente IA</button>

      {pronta && (
        <section className="solo-pronta" data-testid="solo-pronta">
          <h3>{pronta.titulo}</h3>
          <p className="sub">{AREAS[pronta.area]} · {pronta.tempo_min} min · {pronta.itens} itens de checklist</p>
          {pronta.avisos?.map((a) => <p key={a} className="sub">⚠ {a}</p>)}
          <button type="button" className="btn menta" onClick={() => comPaciente({ estacao_id: pronta.estacao_id })} disabled={gerando} data-testid="solo-praticar">Praticar agora com paciente IA</button>{' '}
          <button type="button" className="btn" onClick={() => aoPraticarEstacao?.(pronta.estacao_id)} data-testid="solo-sala">Praticar com outra pessoa</button>
        </section>)}

      {hist.length > 0 && (
        <section><h3>Últimas práticas solo</h3>
          <ul className="solo-hist">{hist.map((h) => (
            <li key={h.id}><b>{h.tema}</b> <span className="sub">{AREAS[h.area]} · {h.dificuldade} · {h.tempo_min} min · {new Date(h.criado_em).toLocaleDateString('pt-BR')}</span>
              <button type="button" className="btn mini" onClick={() => aoPraticarEstacao?.(h.estacao_id)}>Praticar de novo</button></li>))}</ul></section>)}
      <HistoricoEstacoes token={token} api={api} />
    </div>
  );
}
