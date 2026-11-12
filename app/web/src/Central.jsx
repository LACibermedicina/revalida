import React, { useCallback, useEffect, useRef, useState } from 'react';
import { TEXTO_NOTIF } from './Seguranca.jsx';

const hora = (v) => new Date(v).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

/** Central de notificações: avisos do sistema e mensagens diretas com colegas de sala (quem já treinou com você e não está bloqueado). */
export default function Central({ api, token, aoMudou, aba: abaInicial = 'sistema' }) {
  const [aba, setAba] = useState(abaInicial);
  const [sis, setSis] = useState({ nao_lidas: 0, itens: [] });
  const [col, setCol] = useState({ colegas: [], nao_lidas: 0 });
  const [com, setCom] = useState(null);                         // colega aberto
  const [conv, setConv] = useState([]);
  const [texto, setTexto] = useState('');
  const [erro, setErro] = useState('');
  const fim = useRef(null);

  const carregarSis = useCallback(async () => { try { setSis(await api('/api/notificacoes', { token })); } catch { /* sem rede */ } }, [api, token]);
  const carregarCol = useCallback(async () => { try { setCol(await api('/api/mesa/colegas', { token })); } catch { /* sem rede */ } }, [api, token]);
  const carregarConv = useCallback(async (id) => { try { const r = await api(`/api/mensagens/${id}`, { token }); setConv(r.itens); setErro(''); carregarCol(); aoMudou?.(); } catch (e) { setErro(e.message); } }, [api, token, carregarCol, aoMudou]);
  useEffect(() => { carregarSis(); carregarCol(); }, [carregarSis, carregarCol]);
  useEffect(() => {
    if (!com) return undefined;
    carregarConv(com.id); const t = setInterval(() => { if (document.visibilityState === 'visible') carregarConv(com.id); }, 8000);
    return () => clearInterval(t);
  }, [com, carregarConv]);
  useEffect(() => { fim.current?.scrollIntoView?.({ block: 'end' }); }, [conv]);

  const lidas = async () => { await api('/api/notificacoes/lidas', { metodo: 'POST', token }); carregarSis(); aoMudou?.(); };
  const enviar = async (e) => {
    e.preventDefault(); const t = texto.trim(); if (!t || !com) return;
    try { const m = await api(`/api/mensagens/${com.id}`, { metodo: 'POST', token, corpo: { texto: t } }); setConv((c) => [...c, m]); setTexto(''); setErro(''); }
    catch (x) { setErro(x.message); }
  };
  return (
    <div className="central" data-testid="central">
      <div className="central-abas" role="tablist" aria-label="Central de notificações">
        <button type="button" role="tab" aria-selected={aba === 'sistema'} onClick={() => setAba('sistema')}>Sistema{sis.nao_lidas > 0 && <b className="pil">{sis.nao_lidas}</b>}</button>
        <button type="button" role="tab" aria-selected={aba === 'mensagens'} data-testid="aba-mensagens" onClick={() => setAba('mensagens')}>Mensagens{col.nao_lidas > 0 && <b className="pil">{col.nao_lidas}</b>}</button>
      </div>
      {aba === 'sistema' && (
        <div className="central-corpo">
          {sis.itens.length === 0 ? <p className="sub">Nada por aqui. Convites, pareamentos e avisos de segurança aparecem nesta lista.</p> : (
            <ul className="central-lista">{sis.itens.map((n) => <li key={n.id} className={n.lida_em ? '' : 'nova'}>{(TEXTO_NOTIF[n.tipo] ?? (() => 'Aviso do sistema.'))(n.dados)} <em>{hora(n.criada_em)}</em></li>)}</ul>
          )}
          {sis.nao_lidas > 0 && <button type="button" className="btn mini" onClick={lidas}>Marcar todas como lidas</button>}
        </div>
      )}
      {aba === 'mensagens' && (
        <div className="central-msg">
          <ul className="colegas" aria-label="Colegas">
            {col.colegas.length === 0 && <li className="sub vazio">Você poderá trocar mensagens com colegas depois de dividir uma sala de treino com eles.</li>}
            {col.colegas.map((c) => (
              <li key={c.id}><button type="button" aria-current={com?.id === c.id ? 'true' : undefined} onClick={() => { setCom(c); setConv([]); }}>
                <i className={`on${c.online ? ' sim' : ''}`} aria-label={c.online ? 'online' : 'offline'} /> <span>{c.nome}</span>{c.nao_lidas > 0 && <b className="pil">{c.nao_lidas}</b>}</button></li>
            ))}
          </ul>
          <div className="conversa">
            {!com ? <p className="sub">Escolha um colega para conversar.</p> : (<>
              <h3>{com.nome}</h3>
              <div className="bolhas" role="log" aria-live="polite">
                {conv.length === 0 && <p className="sub">Nenhuma mensagem ainda. Diga oi!</p>}
                {conv.map((m) => <div key={m.id} className={`bolha${m.minha ? ' minha' : ''}`}><p>{m.texto}</p><time>{hora(m.criada_em)}</time></div>)}
                <span ref={fim} />
              </div>
              {erro && <p className="aviso" role="alert">{erro}</p>}
              <form onSubmit={enviar} className="enviar">
                <input aria-label={`Mensagem para ${com.nome}`} maxLength={1000} placeholder="Escreva uma mensagem" value={texto} onChange={(e) => setTexto(e.target.value)} data-testid="msg-texto" />
                <button type="submit" className="btn mini menta" disabled={!texto.trim()} data-testid="msg-enviar">Enviar</button>
              </form>
            </>)}
          </div>
        </div>
      )}
    </div>
  );
}
