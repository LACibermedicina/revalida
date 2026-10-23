// Peças da sala: convidar pessoas online, convites recebidos e autocorreção pela transcrição ao fim da estação.
// O servidor decide as regras (vaga de candidato, quem convida, o que conta como estação feita); aqui só mostramos e chamamos.
import React, { useCallback, useEffect, useState } from 'react';

const pts = (n) => (n === null || n === undefined ? '—' : Number(n).toLocaleString('pt-BR', { maximumFractionDigits: 2 }));
const SIT = { acerto: ['Acerto', '✓'], parcial: ['Parcial', '◐'], erro: ['Erro', '✕'], confusao: ['Confusão de termo', '⇄'], omissao: ['Não falou', '∅'] };
const mmss = (ms) => `${Math.floor(ms / 60000)}:${String(Math.floor((ms % 60000) / 1000)).padStart(2, '0')}`;

/** Quem avalia convida alguém que está online. O convidado escolhe observar ou ser candidato (se a vaga estiver livre). */
export function ConvidarOnline({ salaId, convites = [], api, token, aoMudou }) {
  const [aberto, setAberto] = useState(false);
  const [lista, setLista] = useState(null);
  const [busca, setBusca] = useState('');
  const [msg, setMsg] = useState('');
  const carregar = useCallback(() => api(`/api/salas/${salaId}/online?busca=${encodeURIComponent(busca)}`, { token }).then(setLista).catch((e) => setMsg(e.message)), [api, salaId, token, busca]);
  useEffect(() => {
    if (!aberto) return undefined;
    carregar(); const t = setInterval(carregar, 8000); return () => clearInterval(t);
  }, [aberto, carregar]);
  const convidar = async (u) => {
    setMsg('');
    try { await api(`/api/salas/${salaId}/convites`, { metodo: 'POST', token, corpo: { usuario_id: u.id } }); setMsg(`Convite enviado para ${u.nome}.`); await carregar(); aoMudou?.(); }
    catch (e) { setMsg(e.message); }
  };
  const cancelar = async (id) => { try { await api(`/api/convites/${id}`, { metodo: 'DELETE', token }); aoMudou?.(); await carregar(); } catch (e) { setMsg(e.message); } };
  return (
    <div className="sl-conv" data-testid="convidar">
      <div className="acoes">
        <button type="button" className="btn mini" aria-expanded={aberto} onClick={() => setAberto((v) => !v)}>{aberto ? 'Fechar convites' : '＋ Convidar pessoas online'}</button>
      </div>
      {convites.length > 0 && (
        <ul className="sl-conv-pend" aria-label="Convites pendentes">
          {convites.map((c) => <li key={c.id}>{c.nome} <em>aguardando resposta</em> <button type="button" className="ln" onClick={() => cancelar(c.id)}>cancelar</button></li>)}
        </ul>
      )}
      {aberto && (
        <div className="sl-conv-lista">
          <label className="campo"><span>Buscar pelo nome</span><input type="search" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="quem está online agora" /></label>
          {lista === null ? <p className="sub">Procurando quem está online…</p>
            : lista.length === 0 ? <p className="sub">Ninguém mais online no momento. A lista se atualiza sozinha.</p>
              : <ul>{lista.map((u) => (
                <li key={u.id}><span><i className="sl-on" aria-hidden="true" /> {u.nome}</span>
                  {u.convidado ? <em>convidado</em> : <button type="button" className="btn mini menta" onClick={() => convidar(u)}>Convidar</button>}</li>
              ))}</ul>}
          {msg && <p className="sub" role="status">{msg}</p>}
        </div>
      )}
    </div>
  );
}

/** Convites que recebi: aparecem em qualquer tela. Aceita como observador ou, com a vaga livre, como candidato. */
export function ConvitesRecebidos({ api, token, aoEntrar }) {
  const [lista, setLista] = useState([]);
  const [erro, setErro] = useState('');
  useEffect(() => {
    let vivo = true;
    const ler = () => api('/api/convites', { token }).then((l) => vivo && setLista(l)).catch(() => {});
    ler(); const t = setInterval(ler, 10000);
    return () => { vivo = false; clearInterval(t); };
  }, [api, token]);
  const responder = async (c, aceitar, papel) => {
    setErro('');
    try {
      const r = await api(`/api/convites/${c.id}/responder`, { metodo: 'POST', token, corpo: { aceitar, papel } });
      setLista((l) => l.filter((x) => x.id !== c.id));
      if (aceitar && r.sala_id) aoEntrar(r.sala_id);
    } catch (e) { setErro(e.message); setLista((l) => l); }
  };
  if (lista.length === 0 && !erro) return null;
  return (
    <div className="conv-rec" role="region" aria-label="Convites para salas" data-testid="convites-recebidos">
      {lista.map((c) => (
        <div key={c.id} className="conv-card">
          <p><b>{c.convidante}</b> convidou você para uma sala{c.estacao_em_andamento ? ' (estação em andamento)' : ''}.</p>
          <div className="acoes">
            <button type="button" className="btn mini" onClick={() => responder(c, true, 'observador')}>Entrar como observador</button>
            <button type="button" className="btn mini menta" disabled={!c.vaga_candidato} title={c.vaga_candidato ? '' : 'Já há um candidato na sala'} onClick={() => responder(c, true, 'candidato')}>Entrar como candidato</button>
            <button type="button" className="ln" onClick={() => responder(c, false)}>Recusar</button>
          </div>
          {!c.vaga_candidato && <p className="sub">Já há um candidato: você pode entrar como observador e pedir a vaga depois.</p>}
        </div>
      ))}
      {erro && <p className="aviso" role="alert">{erro}</p>}
    </div>
  );
}

/** Autocorreção ao fim da estação: nota que a fala sustenta × nota do avaliador, itens divergentes e fala por minuto. */
export function Autocorrecao({ execId, api, token, aoAdotar }) {
  const [d, setD] = useState(null);
  const [erro, setErro] = useState('');
  const [ocupado, setOcupado] = useState(false);
  useEffect(() => {
    let vivo = true; let n = 0;
    const ler = async () => {
      try {
        const r = await api(`/api/execucoes/${execId}/autocorrecao`, { token });
        if (!vivo) return;
        setD(r);
        if (r.estado === 'processando' && n++ < 40) setTimeout(ler, 2500);
      } catch (e) { if (vivo) setErro(e.message); }
    };
    setD(null); setErro(''); ler();
    return () => { vivo = false; };
  }, [execId, api, token]);
  if (erro) return <p className="aviso" role="alert">{erro}</p>;
  if (!d || d.estado === 'processando') return <p className="sub" role="status" data-testid="autocorrecao-processando">Corrigindo pela transcrição da fala…</p>;
  const adotar = async () => {
    setOcupado(true);
    try { await api(`/api/execucoes/${execId}/revisao-nota`, { metodo: 'PUT', token, corpo: { marcas: d.marcas_sugeridas } }); await aoAdotar?.(); setD(await api(`/api/execucoes/${execId}/autocorrecao`, { token })); }
    catch (e) { setErro(e.message); } finally { setOcupado(false); }
  };
  const div = d.itens.filter((i) => i.divergencia);
  const igual = d.nota_automatica !== null && d.nota_automatica === d.nota_avaliador;
  return (
    <section className="sl-auto" aria-label="Autocorreção pela transcrição" data-testid="autocorrecao">
      <h4>Autocorreção pela transcrição <em>{d.fonte === 'ia' ? 'IA' : 'palavras do item'}</em></h4>
      {d.sem_fala ? <p className="sub">Não houve fala transcrita nesta estação: não há autocorreção. A nota é a do avaliador.</p> : (
        <>
          <div className="sl-stats">
            <div><b>{pts(d.nota_automatica)}</b><span>nota pela fala · de {pts(d.maximo)}{d.percentual_automatico !== null ? ` · ${d.percentual_automatico}%` : ''}</span></div>
            <div><b>{pts(d.nota_avaliador)}</b><span>nota do avaliador{d.nota_original !== null && d.nota_original !== d.nota_avaliador ? ` (antes ${pts(d.nota_original)})` : ''}</span></div>
            <div><b>{d.divergentes}</b><span>{d.divergentes === 1 ? 'item diverge' : 'itens divergem'}</span></div>
          </div>
          {igual && <p className="sub">A fala sustenta a mesma nota do avaliador.</p>}
          {d.pode_adotar && !igual && <button type="button" className="btn mini menta" disabled={ocupado} onClick={adotar}>{ocupado ? 'Aplicando…' : `Adotar a nota pela fala (${pts(d.nota_automatica)})`}</button>}
          {d.pode_adotar && !igual && <p className="sub">A decisão é do avaliador: a nota anterior fica registrada.</p>}
          {div.length > 0 && (
            <ul className="sl-auto-div" aria-label="Itens divergentes">
              {div.map((i) => (
                <li key={i.id} className={`d-${i.divergencia}`}>
                  <b>{i.descricao}</b>
                  <span className="sub">Avaliador: {i.resultado_avaliador} · Fala: {i.resultado_fala}{SIT[i.situacao] ? ` · ${SIT[i.situacao][1]} ${SIT[i.situacao][0]}` : ''}</span>
                  {i.evidencia && <span className="sub">“{i.evidencia}”</span>}
                  {i.feedback && <span className="sub">{i.feedback}</span>}
                </li>
              ))}
            </ul>
          )}
          {d.por_minuto.length > 0 && (
            <details className="sl-minutos"><summary>Fala por minuto ({d.por_minuto.length})</summary>
              <ol>{d.por_minuto.map((m) => (
                <li key={m.minuto}><b>{m.minuto}º minuto</b>
                  <ul>{m.segmentos.map((s) => <li key={s.ordem}><time>{mmss(s.ms)}</time> {s.texto}</li>)}</ul>
                  {m.itens.length > 0 && <p className="sub">Itens sustentados aqui: {m.itens.map((i) => i.descricao).join('; ')}</p>}
                </li>))}
              </ol>
            </details>
          )}
        </>
      )}
    </section>
  );
}
