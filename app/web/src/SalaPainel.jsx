// Painel de salas abertas, chat interno, configuração da sala e "solucionar problemas" de câmera/microfone.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { diagnosticarMidia, problemasDe } from './midia.js';

export const PRAZOS = [[6, '6 horas'], [12, '12 horas'], [24, '24 horas'], [48, '2 dias'], [168, '7 dias'], [720, '30 dias']];
const prazoTxt = (h) => PRAZOS.find(([v]) => v === h)?.[1] ?? `${h} h`;
const restante = (iso) => {
  const min = Math.max(0, Math.round((new Date(iso).getTime() - Date.now()) / 60000));
  return min >= 120 ? `${Math.round(min / 60)} h` : `${min} min`;
};

/** Salas abertas: qualquer pessoa vê e entra; sala vazia some depois do prazo definido ao criar. */
export function PainelSalas({ api, token, aoEntrar, desabilitado }) {
  const [lista, setLista] = useState(null);
  const [erro, setErro] = useState('');
  const carregar = useCallback(async () => {
    try { setLista(await api('/api/salas', { token })); setErro(''); } catch (e) { setErro(e.message); }
  }, [api, token]);
  useEffect(() => { carregar(); const t = setInterval(carregar, 8000); return () => clearInterval(t); }, [carregar]);
  return (
    <section className="sl-bloco" aria-label="Salas abertas" data-testid="salas-abertas">
      <h3>Salas abertas</h3>
      {erro && <p className="aviso" role="alert">{erro}</p>}
      {lista && lista.length === 0 && <p className="sub">Nenhuma sala aberta agora. Crie a primeira.</p>}
      {(lista ?? []).map((s) => (
        <div key={s.id} className="sl-linha sl-sala-card" data-testid="sala-aberta">
          <span>
            <b>{s.nome}</b>
            <em className="sl-meta"> · {s.pessoas} {s.pessoas === 1 ? 'pessoa' : 'pessoas'} · chefe: {s.chefe ?? '—'}{s.candidato ? ` · candidato: ${s.candidato}` : ''}</em>
            {s.em_estacao && <em className="sl-sel-tag"> em estação</em>}
            {s.pausada && <em className="sl-sel-tag pausa"> pausada</em>}
            {s.expira_em && <em className="sl-meta"> · vazia: será desfeita em {restante(s.expira_em)}</em>}
          </span>
          <button className="btn mini menta" disabled={desabilitado} onClick={() => aoEntrar(s.id)}>{s.estou_na_sala ? 'Voltar' : 'Entrar'}</button>
        </div>
      ))}
    </section>
  );
}

/** Nome e prazo de sala vazia. O chefe (ou quem criou) muda a qualquer momento; ninguém é "dono". */
export function ConfigurarSala({ sala, api, token, aoSalvar }) {
  const [nome, setNome] = useState(sala.nome ?? '');
  const [horas, setHoras] = useState(sala.expira_vazia_horas ?? 24);
  const [msg, setMsg] = useState('');
  useEffect(() => { setNome(sala.nome ?? ''); setHoras(sala.expira_vazia_horas ?? 24); }, [sala.nome, sala.expira_vazia_horas]);
  const salvar = async (e) => {
    e.preventDefault();
    try { await api(`/api/salas/${sala.id}`, { metodo: 'PATCH', token, corpo: { nome, expira_vazia_horas: Number(horas) } }); setMsg('Salvo.'); aoSalvar?.(); }
    catch (er) { setMsg(er.message); }
  };
  return (
    <details className="sl-config" data-testid="configurar-sala"><summary>Nome e prazo da sala</summary>
      <form onSubmit={salvar}>
        <label className="campo"><span>Nome</span><input value={nome} onChange={(e) => setNome(e.target.value)} maxLength={60} /></label>
        <label className="campo"><span>Desfazer a sala se ficar vazia por</span>
          <select value={horas} onChange={(e) => setHoras(e.target.value)}>{PRAZOS.map(([v, r]) => <option key={v} value={v}>{r}</option>)}{!PRAZOS.some(([v]) => v === Number(horas)) && <option value={horas}>{prazoTxt(Number(horas))}</option>}</select></label>
        <button className="btn mini" type="submit">Salvar</button> {msg && <span className="sub" role="status">{msg}</span>}
      </form>
    </details>
  );
}

/** Chat interno. `bloqueado`: o candidato não escreve durante a estação (e a tela dele nem mostra o chat). */
export function SalaChat({ salaId, api, token, eu, tique, bloqueado }) {
  const [msgs, setMsgs] = useState([]);
  const [texto, setTexto] = useState('');
  const [erro, setErro] = useState('');
  const ultimo = useRef(0);
  const fim = useRef(null);
  const ler = useCallback(async () => {
    try {
      const novas = await api(`/api/salas/${salaId}/chat?apos=${ultimo.current}`, { token });
      if (novas.length) { ultimo.current = novas[novas.length - 1].id; setMsgs((m) => [...m, ...novas].slice(-200)); }
    } catch { /* a tela principal já mostra o erro da sala */ }
  }, [api, salaId, token]);
  useEffect(() => { ler(); const t = setInterval(ler, 8000); return () => clearInterval(t); }, [ler]);
  useEffect(() => { if (tique) ler(); }, [tique, ler]);
  useEffect(() => { fim.current?.scrollTo?.({ top: fim.current.scrollHeight }); }, [msgs.length]);
  const enviar = async (e) => {
    e.preventDefault(); const t = texto.trim(); if (!t) return;
    try { await api(`/api/salas/${salaId}/chat`, { metodo: 'POST', token, corpo: { texto: t } }); setTexto(''); setErro(''); await ler(); }
    catch (er) { setErro(er.message); }
  };
  return (
    <section className="sl-bloco sl-chat" id="sl-chat" aria-label="Chat da sala" data-testid="chat-sala">
      <h3>Chat</h3>
      <div className="sl-chat-lista" ref={fim} role="log" aria-live="polite">
        {msgs.length === 0 && <p className="sub">Nenhuma mensagem ainda.</p>}
        {msgs.map((m) => <p key={m.id} className={m.autor_id === eu ? 'eu' : ''}><b>{m.autor_id === eu ? 'Você' : m.nome}</b> {m.texto}</p>)}
      </div>
      <form onSubmit={enviar} className="sl-chat-form">
        <input value={texto} onChange={(e) => setTexto(e.target.value)} maxLength={1000} placeholder="Escreva para a sala" aria-label="Mensagem" disabled={bloqueado} />
        <button className="btn mini" type="submit" disabled={bloqueado || !texto.trim()}>Enviar</button>
      </form>
      {erro && <p className="aviso" role="alert">{erro}</p>}
    </section>
  );
}

/** Botão discreto: só existe quando a mídia está desconectada. Abre o diagnóstico do navegador. */
export function Solucionar({ resultado, aoVerificar, aoReligar, aberto, setAberto }) {
  const [ocupado, setOcupado] = useState(false);
  const rodar = async (fn) => { setOcupado(true); try { await fn(); } finally { setOcupado(false); } };
  const problemas = resultado ? problemasDe(resultado) : null;
  return (
    <div className="sl-solucionar" data-testid="solucionar">
      <button type="button" className="sl-discreto" onClick={() => { setAberto(!aberto); if (!aberto && !resultado) rodar(aoVerificar); }} aria-expanded={aberto}>Solucionar problemas</button>
      {aberto && (
        <div className="sl-bloco" role="region" aria-label="Solucionar problemas de câmera e microfone">
          {ocupado && <p className="sub" role="status">Verificando o navegador…</p>}
          {problemas && problemas.length === 0 && <p role="status" data-testid="midia-ok">O navegador permite câmera e microfone. Toque em "Religar" para entrar de novo no vídeo.</p>}
          {problemas?.map((p) => <p key={p.item} className="aviso" data-testid="midia-problema"><b>{p.texto}</b> {p.como}</p>)}
          <div className="acoes">
            <button type="button" className="btn mini" disabled={ocupado} onClick={() => rodar(aoVerificar)}>Verificar de novo</button>
            <button type="button" className="btn mini menta" disabled={ocupado} onClick={() => rodar(aoReligar)}>Religar câmera e microfone</button>
          </div>
        </div>
      )}
    </div>
  );
}

export { diagnosticarMidia };
