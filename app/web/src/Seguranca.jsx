// Segurança social: bloquear e denunciar (bilateral e sem exposição de quem bloqueou), notificações, direito de resposta e decisão do administrador.
import React, { useCallback, useEffect, useState } from 'react';
import './social.css';

export const MOTIVOS = { assedio: 'Assédio ou constrangimento', conduta: 'Conduta antiética ou desrespeitosa', conteudo: 'Conteúdo impróprio', fraude: 'Fraude ou falsidade', outro: 'Outro (descreva)' };
const DECISAO = { manter_bloqueio: 'Mantido: só os dois deixam de se relacionar', suspender: 'Suspenso por 7 dias', arquivar: 'Arquivada: sem providência' };
const ESTADO = { aberta: 'Aberta', respondida: 'Respondida', suspensa: 'Em suspensão', resolvida: 'Resolvida', arquivada: 'Arquivada' };
export const dt = (v) => (v ? new Date(v).toLocaleDateString('pt-BR') : '');

/** Botões “Bloquear” e “Denunciar” ao lado de uma pessoa. */
export function AcoesUsuario({ usuarioId, nome, api, token, salaId = null, aoFeito }) {
  const [modo, setModo] = useState(null);           // null | 'bloquear' | 'denunciar'
  const [motivo, setMotivo] = useState('conduta');
  const [detalhe, setDetalhe] = useState('');
  const [msg, setMsg] = useState(''); const [erro, setErro] = useState(''); const [ocupado, setOcupado] = useState(false);
  const enviar = async () => {
    setOcupado(true); setErro('');
    try {
      if (modo === 'bloquear') await api('/api/bloqueios', { metodo: 'POST', token, corpo: { usuario_id: usuarioId } });
      else await api('/api/denuncias', { metodo: 'POST', token, corpo: { usuario_id: usuarioId, motivo, detalhe, sala_id: salaId } });
      setMsg(modo === 'bloquear' ? `${nome} foi bloqueado(a). Vocês não se verão mais.` : 'Denúncia enviada. Vocês dois deixam de se ver; o administrador e a pessoa denunciada foram avisados.');
      setModo(null); aoFeito?.();
    } catch (e) { setErro(e.message); } finally { setOcupado(false); }
  };
  if (msg) return <span className="sg-ok" role="status">{msg}</span>;
  return (
    <span className="sg-acoes">
      <button type="button" className="btn mini" data-testid="bloquear" onClick={() => setModo('bloquear')}>Bloquear</button>
      <button type="button" className="btn mini" data-testid="denunciar" onClick={() => setModo('denunciar')}>Denunciar</button>
      {modo && (
        <div className="sg-dialogo" role="dialog" aria-modal="false" aria-label={modo === 'bloquear' ? `Bloquear ${nome}` : `Denunciar ${nome}`}>
          {modo === 'bloquear' ? (
            <p>Bloquear <b>{nome}</b>? Vocês dois deixam de aparecer um para o outro (listas, convites, chamados e salas). A pessoa não é avisada. Dá para desfazer depois.</p>
          ) : (
            <>
              <p>Denunciar <b>{nome}</b>. Ela será <b>avisada</b> do motivo (sem ver quem denunciou), poderá <b>responder</b>, e o <b>administrador</b> será notificado. Por padrão, só vocês dois deixam de se relacionar; uma suspensão semanal só acontece se o administrador decidir.</p>
              <label className="campo"><span>Motivo</span>
                <select value={motivo} onChange={(e) => setMotivo(e.target.value)} data-testid="denuncia-motivo">{Object.entries(MOTIVOS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
              <label className="campo"><span>O que aconteceu (opcional, exceto em “Outro”)</span>
                <textarea rows={3} maxLength={2000} value={detalhe} onChange={(e) => setDetalhe(e.target.value)} data-testid="denuncia-detalhe" /></label>
            </>
          )}
          {erro && <p className="aviso" role="alert">{erro}</p>}
          <div className="acoes">
            <button type="button" className="btn mini coral" disabled={ocupado} data-testid="confirmar-acao" onClick={enviar}>{modo === 'bloquear' ? 'Bloquear' : 'Enviar denúncia'}</button>
            <button type="button" className="btn mini" onClick={() => setModo(null)}>Cancelar</button>
          </div>
        </div>
      )}
    </span>
  );
}

export const TEXTO_NOTIF = {
  denuncia_recebida: () => 'Você recebeu uma denúncia. Veja o motivo e responda em Comunidade → Segurança.',
  denuncia_decidida: (d) => `Denúncia decidida: ${DECISAO[d.decisao] ?? d.decisao}${d.ate ? ` (até ${dt(d.ate)})` : ''}.`,
  denuncia_nova: (d) => `Nova denúncia (${MOTIVOS[d.motivo] ?? d.motivo}): ${d.denunciante} → ${d.denunciado}.`,
  denuncia_respondida: () => 'Uma denúncia recebeu resposta do denunciado.',
  chamado_atendido: (d) => `${d.por} incluiu você numa sala. Abra em Ciclos.`,
  ciclo_randomico: () => 'Você foi pareado(a) num ciclo randômico. Abra em Ciclos.',
};
export function Notificacoes({ api, token, aoMudou }) {
  const [d, setD] = useState({ nao_lidas: 0, itens: [] });
  const carregar = useCallback(async () => { try { setD(await api('/api/notificacoes', { token })); } catch { /* sem rede */ } }, [api, token]);
  useEffect(() => { carregar(); const t = setInterval(carregar, 30000); return () => clearInterval(t); }, [carregar]);
  const lidas = async () => { await api('/api/notificacoes/lidas', { metodo: 'POST', token }); carregar(); aoMudou?.(); };
  return (
    <section className="sg-bloco" aria-label="Notificações" data-testid="notificacoes">
      <h3>Notificações {d.nao_lidas > 0 && <span className="sg-pilula">{d.nao_lidas}</span>}</h3>
      {d.itens.length === 0 ? <p className="sub">Nada por aqui.</p> : (
        <ul className="sg-lista">{d.itens.slice(0, 8).map((n) => <li key={n.id} className={n.lida_em ? '' : 'nova'}>{(TEXTO_NOTIF[n.tipo] ?? (() => n.tipo))(n.dados)} <em>{dt(n.criada_em)}</em></li>)}</ul>
      )}
      {d.nao_lidas > 0 && <button type="button" className="btn mini" onClick={lidas}>Marcar como lidas</button>}
    </section>
  );
}

/** Bloqueados, denúncias que fiz e denúncias recebidas (com direito de resposta). */
export function PainelSeguranca({ api, token }) {
  const [bl, setBl] = useState([]); const [env, setEnv] = useState([]); const [rec, setRec] = useState([]);
  const [resp, setResp] = useState({}); const [erro, setErro] = useState('');
  const carregar = useCallback(async () => {
    try { const [a, b, c] = await Promise.all([api('/api/bloqueios', { token }), api('/api/denuncias/enviadas', { token }), api('/api/denuncias/recebidas', { token })]); setBl(a); setEnv(b); setRec(c); } catch (e) { setErro(e.message); }
  }, [api, token]);
  useEffect(() => { carregar(); }, [carregar]);
  const desbloquear = async (id) => { try { await api(`/api/bloqueios/${id}`, { metodo: 'DELETE', token }); carregar(); } catch (e) { setErro(e.message); } };
  const responder = async (id) => { try { await api(`/api/denuncias/${id}/responder`, { metodo: 'POST', token, corpo: { resposta: resp[id] ?? '' } }); setResp({ ...resp, [id]: '' }); carregar(); } catch (e) { setErro(e.message); } };
  return (
    <div className="sg" data-testid="painel-seguranca">
      {erro && <p className="aviso" role="alert">{erro}</p>}
      <section className="sg-bloco"><h3>Pessoas bloqueadas ({bl.length})</h3>
        {bl.length === 0 ? <p className="sub">Você não bloqueou ninguém. Para bloquear, use o botão ao lado do nome da pessoa.</p> : bl.map((b) => (
          <div key={b.id} className="sl-linha"><span>{b.nome} {b.origem === 'denuncia' && <em>(por denúncia)</em>}</span>
            {b.origem === 'manual' && <button type="button" className="btn mini" onClick={() => desbloquear(b.id)}>Desbloquear</button>}</div>))}
      </section>
      <section className="sg-bloco"><h3>Denúncias recebidas ({rec.length})</h3>
        {rec.length === 0 ? <p className="sub">Nenhuma. Se alguém denunciar você, aparece aqui e você tem direito de resposta.</p> : rec.map((d) => (
          <div key={d.id} className="sg-card" data-testid="denuncia-recebida">
            <p><b>{MOTIVOS[d.motivo]}</b> · {ESTADO[d.estado]} · {dt(d.criada_em)}</p>
            {d.detalhe && <p className="sub">“{d.detalhe}”</p>}
            {d.resposta && <p><b>Sua resposta:</b> {d.resposta}</p>}
            {d.decisao && <p><b>Decisão:</b> {DECISAO[d.decisao]}</p>}
            {['aberta', 'respondida', 'suspensa'].includes(d.estado) && (
              <><label className="campo"><span>{d.resposta ? 'Complementar a resposta' : 'Sua resposta ao administrador'}</span>
                <textarea rows={3} maxLength={2000} value={resp[d.id] ?? ''} onChange={(e) => setResp({ ...resp, [d.id]: e.target.value })} data-testid="denuncia-resposta" /></label>
              <button type="button" className="btn mini" disabled={(resp[d.id] ?? '').trim().length < 3} onClick={() => responder(d.id)} data-testid="enviar-resposta">Enviar resposta</button></>)}
          </div>))}
      </section>
      <section className="sg-bloco"><h3>Denúncias que fiz ({env.length})</h3>
        {env.length === 0 ? <p className="sub">Nenhuma.</p> : env.map((d) => <div key={d.id} className="sl-linha"><span>{d.denunciado} · {MOTIVOS[d.motivo]}</span><em>{ESTADO[d.estado]}{d.decisao ? ` — ${DECISAO[d.decisao]}` : ''}</em></div>)}
      </section>
    </div>
  );
}

/** Aba do administrador: ler, ver a resposta do denunciado e decidir. */
export function AdminDenuncias({ api, token }) {
  const [lista, setLista] = useState([]); const [todas, setTodas] = useState(false); const [nota, setNota] = useState({}); const [erro, setErro] = useState('');
  const carregar = useCallback(async () => { try { setLista(await api(`/api/admin/denuncias?estado=${todas ? 'todas' : 'abertas'}`, { token })); } catch (e) { setErro(e.message); } }, [api, token, todas]);
  useEffect(() => { carregar(); }, [carregar]);
  const decidir = async (id, decisao) => {
    setErro('');
    try { await api(`/api/admin/denuncias/${id}/decidir`, { metodo: 'POST', token, corpo: { decisao, nota: nota[id] ?? '' } }); carregar(); } catch (e) { setErro(e.message); }
  };
  return (
    <div className="sg" data-testid="admin-denuncias">
      <label className="sg-chk"><input type="checkbox" checked={todas} onChange={(e) => setTodas(e.target.checked)} /> Mostrar também as encerradas</label>
      {erro && <p className="aviso" role="alert">{erro}</p>}
      {lista.length === 0 ? <p className="sub">Nenhuma denúncia em análise.</p> : lista.map((d) => (
        <div key={d.id} className="sg-card" data-testid="denuncia-admin">
          <p><b>{d.denunciante}</b> → <b>{d.denunciado}</b> · {MOTIVOS[d.motivo]} · {ESTADO[d.estado]} · {dt(d.criada_em)}</p>
          {d.detalhe && <p className="sub">Relato: “{d.detalhe}”</p>}
          {d.resposta ? <p><b>Resposta do denunciado:</b> {d.resposta}</p> : <p className="sub">Sem resposta do denunciado ainda.</p>}
          {d.suspenso_ate && new Date(d.suspenso_ate) > new Date() && <p className="aviso">Suspenso até {dt(d.suspenso_ate)}.</p>}
          {d.decisao ? <p><b>Decisão:</b> {DECISAO[d.decisao]}{d.decisao_nota ? ` — ${d.decisao_nota}` : ''}</p> : null}
          {!['resolvida', 'arquivada'].includes(d.estado) && (
            <>
              <label className="campo"><span>Nota da decisão (obrigatória para suspender)</span>
                <input value={nota[d.id] ?? ''} maxLength={1000} onChange={(e) => setNota({ ...nota, [d.id]: e.target.value })} data-testid="decisao-nota" /></label>
              <div className="acoes">
                <button type="button" className="btn mini" onClick={() => decidir(d.id, 'manter_bloqueio')} data-testid="decidir-manter">Resolver (só os dois se afastam)</button>
                <button type="button" className="btn mini" onClick={() => decidir(d.id, 'arquivar')} data-testid="decidir-arquivar">Arquivar</button>
                <button type="button" className="btn mini coral" onClick={() => decidir(d.id, 'suspender')} data-testid="decidir-suspender">Suspender por 7 dias</button>
              </div>
            </>)}
        </div>))}
    </div>
  );
}
