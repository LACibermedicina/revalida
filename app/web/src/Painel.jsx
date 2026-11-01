// Início: painel visual do candidato e do avaliador. Só mostra e leva ao lugar certo; toda função mora no menu
// (Ciclos = salas e estações em prática · Estações = ver, criar e gerir · Estudo = cartões, trilha e mapa).
import React, { useCallback, useEffect, useState } from 'react';
import './painel.css';

const AREAS = { clinica_medica: 'Clínica', cirurgia: 'Cirurgia', ginecologia_obstetricia: 'GO', pediatria: 'Pediatria', mfc: 'MFC' };
const CORES = { clinica_medica: 'var(--mar)', pediatria: 'var(--menta)', cirurgia: 'var(--uva)', ginecologia_obstetricia: 'var(--sol)', mfc: 'var(--coral)' };
const PAPEL = { admin: ['Chefe da sala', 'chefe'], avaliador: ['Avalia', 'chefe'], candidato: ['Candidato', 'cand'], observador: ['Observa', 'obs'] };
const n1 = (n) => String(Number(n).toFixed(Number(n) % 1 ? 1 : 0)).replace('.', ',');

function Anel({ frac, cor, children }) {
  const C = 314.16;
  return (
    <div className="pn-anel">
      <svg viewBox="0 0 120 120" aria-hidden="true"><circle className="trilho" cx="60" cy="60" r="50" /><circle className="arco" cx="60" cy="60" r="50" stroke={cor} strokeDasharray={C} strokeDashoffset={C * (1 - Math.min(1, Math.max(0, frac)))} /></svg>
      <div className="num">{children}</div>
    </div>
  );
}

function Evolucao({ pontos }) {
  if (pontos.length < 2) return <p className="sub">Faça pelo menos 2 estações para ver sua evolução.</p>;
  const L = 220; const A = 70; const dx = L / (pontos.length - 1);
  const xy = pontos.map((p, i) => [4 + i * ((L - 8) / (pontos.length - 1 || 1)), A - 8 - (Math.min(100, p.percentual) / 100) * (A - 16)]);
  const d = xy.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
  const ult = pontos.at(-1).percentual; const pri = pontos[0].percentual;
  return (
    <figure className="pn-evo" data-testid="evolucao">
      <svg viewBox={`0 0 ${L} ${A}`} role="img" aria-label={`Evolução das últimas ${pontos.length} estações: de ${pri}% para ${ult}%`} preserveAspectRatio="none">
        <line x1="0" x2={L} y1={A - 8 - (A - 16) * 0.7} y2={A - 8 - (A - 16) * 0.7} className="meta" />
        <path d={`${d} L${xy.at(-1)[0]} ${A} L${xy[0][0]} ${A} Z`} className="area" />
        <path d={d} className="linha" />
        {xy.map(([x, y], i) => <circle key={i} cx={x} cy={y} r="2.6" className="pt"><title>{pontos[i].titulo}: {pontos[i].percentual}%</title></circle>)}
      </svg>
      <figcaption><b>{ult}%</b> na última <span className={ult >= pri ? 'sobe' : 'desce'}>{ult >= pri ? '▲' : '▼'} {Math.abs(ult - pri)} pts desde a primeira</span></figcaption>
    </figure>
  );
}

export default function TelaPainel({ usuario, token, api, aoCarregar, aoAnalise, aoPraticar, aoIr, aoAbrirSala, aoAbrirSalaAntiga }) {
  const [p, setP] = useState(null);
  const [sugestoes, setSugestoes] = useState(null);
  const [antigas, setAntigas] = useState([]);
  const [erro, setErro] = useState('');
  const carregarSugestoes = useCallback(() => api('/api/estudo/sugestoes-estacoes?n=5', { token }).then(setSugestoes).catch(() => setSugestoes({ sugestoes: [], total_disponiveis: 0 })), [api, token]);
  const carregar = useCallback(() => api('/api/painel', { token }).then(setP).catch((e) => setErro(e.message)), [api, token]);

  useEffect(() => {
    Promise.allSettled([carregar(), carregarSugestoes(), api('/api/sessoes', { token }).then(setAntigas)]).then(() => aoCarregar?.());
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  const liberar = async (id, liberada) => {
    setErro('');
    try { await api(`/api/execucoes/${id}/transcricao/liberar`, { metodo: 'POST', token, corpo: { liberada } }); await carregar(); } catch (e) { setErro(e.message); }
  };

  const d = p?.desempenho; const av = p?.avaliador; const rev = p?.revisao;
  const avalia = Boolean(av && (av.feitas > 0 || av.ao_vivo.length > 0 || (p.salas ?? []).some((s) => s.papel === 'admin' || s.papel === 'avaliador')));
  const nota = d?.nota_media ?? 0;

  return (
    <div className="tela pn-tela" data-testid="painel">
      <div className="pn-topo">
        <div><div className="sub">Bom treino,</div><div className="hello">{usuario.nome.split(' ')[0]} 👋</div></div>
        <div className="pn-atalhos" role="group" aria-label="Atalhos">
          <button type="button" className="btn mini menta" onClick={() => aoIr('ciclos')}>Praticar</button>
          <button type="button" className="btn mini" onClick={() => aoIr('estacoes')}>Estações</button>
          <button type="button" className="btn mini" onClick={() => aoIr('estudo')}>Estudar</button>
        </div>
      </div>
      {erro && <div className="msg e" role="alert">{erro}</div>}

      <div className="pn-kpis" data-testid="kpis">
        <div className="pn-kpi"><Anel frac={nota / 10} cor="var(--menta)"><span>{n1(nota)}</span></Anel><small>nota média</small></div>
        <div className="pn-kpi"><b>{d?.estacoes ?? 0}</b><small>estações feitas</small></div>
        <button type="button" className="pn-kpi clic" onClick={() => aoIr('estudo')} title="Abrir cartões de revisão"><b className={rev?.vencidos ? 'alerta' : ''}>{rev?.vencidos ?? 0}</b><small>cartões para revisar{rev?.novos ? ` · ${rev.novos} novos` : ''}</small></button>
        <button type="button" className="pn-kpi clic" onClick={() => aoIr('ciclos')} title="Abrir salas e ciclos"><b>{(p?.salas?.length ?? 0) + antigas.length}</b><small>salas abertas</small></button>
      </div>

      <div className="pn-duas">
        <section className="cartao" aria-label="Evolução"><div className="sec">Evolução</div><Evolucao pontos={p?.tendencia ?? []} /></section>
        <section className="cartao" aria-label="Por área"><div className="sec">Por área</div>
          {(d?.por_area?.length ? d.por_area : []).map((a) => (
            <div className="barra" key={a.area}><span>{AREAS[a.area] || a.area}</span><i><u style={{ width: `${(a.nota / 10) * 100}%`, background: CORES[a.area] || 'var(--mar)' }} /></i><b>{n1(a.nota)}</b></div>
          ))}
          {d && d.por_area.length === 0 && <p className="sub">Suas notas por área aparecem depois da primeira estação.</p>}
        </section>
      </div>

      {avalia && (
        <section className="cartao pn-aval" data-testid="painel-avaliador" aria-label="Como avaliador">
          <div className="sec">Como avaliador</div>
          <div className="pn-mini"><span><b>{av.feitas}</b> estações avaliadas</span><span><b>{av.candidatos}</b> candidatos</span><span><b className={av.sem_liberar ? 'alerta' : ''}>{av.sem_liberar}</b> transcrições sem liberar</span></div>
          {av.ao_vivo.map((x) => (
            <div className="pn-linha vivo" key={x.id}><span><b>{x.titulo}</b><small>em andamento · fala do candidato em tempo real na sala</small></span>
              <button type="button" className="btn mini coral" data-testid="acompanhar-ao-vivo" onClick={() => aoAbrirSala(x.sala_id)}>Acompanhar ao vivo</button></div>
          ))}
          {av.recentes.length > 0 && <div className="sub" style={{ marginTop: 6 }}>Últimas avaliadas — o candidato só relê a transcrição se você liberar.</div>}
          {av.recentes.map((r) => (
            <div className="pn-linha" key={r.id}><span><b>{r.titulo}</b><small>{r.candidato} · {r.tem_fala ? (r.liberada ? 'transcrição liberada ao candidato' : 'transcrição só com você') : 'sem fala transcrita'}</small></span>
              <span className="acoes">
                <button type="button" className="btn mini" onClick={() => aoAnalise(r.id)}>Análise</button>
                {r.tem_fala && <button type="button" className={`btn mini${r.liberada ? '' : ' menta'}`} data-testid="liberar-transcricao" onClick={() => liberar(r.id, !r.liberada)}>{r.liberada ? 'Retirar' : 'Liberar transcrição'}</button>}
              </span></div>
          ))}
        </section>
      )}

      <section className="cartao sugestoes" data-testid="sugestoes" aria-label="Treinar agora">
        <div className="sec">Treinar agora</div>
        {sugestoes === null ? <p className="sub">Escolhendo pelo seu desempenho…</p>
          : sugestoes.sugestoes.length === 0 ? <p className="sub">Ainda não há estações aprovadas para sugerir.</p>
            : sugestoes.sugestoes.map((e) => (
              <button type="button" key={e.id} className="sug" data-testid="sugestao-estacao" onClick={() => aoPraticar?.(e.id)} title="Abrir nos ciclos para treinar">
                <span><b>{e.titulo}</b><small>{AREAS[e.area] || e.area} · {e.duracao_min} min{e.dificuldade ? ` · ${e.dificuldade}` : ''}</small><small className="why">{e.motivo}</small></span>
                <span className="tag espera">Treinar</span>
              </button>))}
        <div className="acoes">
          <button type="button" className="btn mini" onClick={carregarSugestoes}>🔀 Sortear outras 5</button>
          <button type="button" className="btn mini" onClick={() => aoIr('estacoes', { aba: 'disponiveis' })}>Ver todas as estações disponíveis ({p?.estacoes.disponiveis ?? sugestoes?.total_disponiveis ?? 0})</button>
        </div>
      </section>

      {((p?.salas?.length ?? 0) + antigas.length > 0) && (
        <section aria-label="Minhas salas"><div className="sec">Minhas salas</div>
          <div className="pn-salas">
            {(p?.salas ?? []).map((s) => { const [rot, cls] = PAPEL[s.papel] ?? ['', 'obs']; return (
              <button type="button" key={s.id} className={`pn-sala ${cls}`} data-testid="sala-aberta" onClick={() => aoAbrirSala(s.id)}>
                <span className="tag">{rot}</span><b>{s.ao_vivo ? `Ao vivo: ${s.ao_vivo}` : s.itens ? `Ciclo: ${s.feitos}/${s.itens} estações` : 'Sem ciclo ainda'}</b>
                <small>{s.pessoas} pessoa(s) na sala</small>{s.itens > 0 && <i><u style={{ width: `${Math.round((s.feitos / s.itens) * 100)}%` }} /></i>}
              </button>); })}
            {antigas.map((s) => (
              <button type="button" key={s.id} className="pn-sala obs" onClick={() => aoAbrirSalaAntiga(s.id, s.papel)}>
                <span className="tag">{s.papel === 'avaliador_ator' ? 'Avalia' : s.papel === 'candidato' ? 'Candidato' : 'Observa'}</span><b>{s.titulo}</b><small>sala por link · {s.status === 'em_andamento' ? 'ao vivo' : s.status === 'finalizada' ? 'finalizada' : 'aguardando'}</small>
              </button>))}
          </div>
        </section>
      )}

      {(p?.feitas?.length ?? 0) > 0 && (
        <section aria-label="Estações que fiz"><div className="sec">Estações que fiz</div>
          <div className="cartao" data-testid="estacoes-feitas">
            {p.feitas.map((x) => { const pc = x.maximo > 0 ? Math.round((x.nota / x.maximo) * 100) : null; return (
              <div key={x.id} className="pn-linha"><span><b>{x.titulo}</b><small>{AREAS[x.area] || x.area} · {pc === null ? '—' : `${pc}%`}</small>{pc !== null && <i className="pn-pc"><u style={{ width: `${pc}%`, background: pc >= 70 ? 'var(--menta)' : pc >= 50 ? 'var(--sol)' : 'var(--coral)' }} /></i>}</span>
                <button type="button" className="btn mini menta" onClick={() => aoAnalise(x.id)}>Ver análise</button></div>); })}
          </div>
        </section>
      )}
    </div>
  );
}
