// Podcast de estudo e Rádio Revalida (radIA.m3d): playlists com transcrição e áudio, posição salva, links para apps de podcast,
// programa da rádio e pacote de exportação (pool). Sem voz do servidor, o navegador lê a transcrição em voz alta (SpeechSynthesis).
import React, { useCallback, useEffect, useRef, useState } from 'react';
import './podcast.css';

const fmt = (s) => `${Math.floor((s || 0) / 60)}:${String(Math.floor((s || 0) % 60)).padStart(2, '0')}`;
const data = (d) => (d ? new Date(d).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—');
const ESTADO = { pendente: 'Na fila', roteiro: 'Só transcrição', pronto: 'Áudio pronto', erro: 'Falhou' };
const STATUS_POOL = { pendente: 'Aguardando sincronização', sincronizado: 'Sincronizado', erro: 'Erro (será tentado de novo)' };

/** Ícone da rádia: onda sonora dentro de um aparelho, com pulso animado. */
export function IconeRadia({ tocando }) {
  return (
    <svg className={`pc-radia${tocando ? ' on' : ''}`} viewBox="0 0 48 48" role="img" aria-label="radIA Revalida">
      <rect x="5" y="14" width="38" height="26" rx="7" fill="currentColor" opacity=".14" stroke="currentColor" strokeWidth="2" />
      <path d="M14 14 32 5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
      <circle cx="17" cy="27" r="6.5" fill="none" stroke="currentColor" strokeWidth="2" />
      <path className="pc-onda" d="M29 23v8M33 20v14M37 24v6" stroke="var(--coral)" strokeWidth="2.6" strokeLinecap="round" />
    </svg>
  );
}

/** Player: áudio do servidor quando existe; senão lê a transcrição em voz alta. Salva a posição e continua de onde parou. */
function Player({ item, api, token, publico, aoFechar }) {
  const audio = useRef(null);
  const [src, setSrc] = useState('');
  const [erro, setErro] = useState('');
  const [falando, setFalando] = useState(false);
  const ultimo = useRef(0);
  const texto = item.roteiro || item.transcricao || '';
  const temVoz = typeof window !== 'undefined' && 'speechSynthesis' in window;

  useEffect(() => {
    let url = ''; let vivo = true;
    setSrc(''); setErro('');
    if (!item.tem_audio) return undefined;
    if (publico) { setSrc(`/api/radia/audio/${item.id}`); return undefined; }
    fetch(`/api/podcast/itens/${item.id}/audio`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => { if (!r.ok) throw new Error('Não foi possível carregar o áudio.'); return r.blob(); })
      .then((b) => { if (vivo) { url = URL.createObjectURL(b); setSrc(url); } })
      .catch((e) => vivo && setErro(e.message));
    return () => { vivo = false; if (url) URL.revokeObjectURL(url); };
  }, [item.id, item.tem_audio, publico, token]);

  useEffect(() => () => { try { window.speechSynthesis?.cancel(); } catch { /* sem voz */ } }, [item.id]);

  const salvar = useCallback((concluido = false) => {
    const a = audio.current; if (!a) return;
    api(`/api/podcast/itens/${item.id}/posicao`, { metodo: 'PUT', token, corpo: { posicao_s: a.currentTime, concluido } }).catch(() => {});
  }, [api, item.id, token]);
  const aoCarregar = () => { const a = audio.current; if (a && item.posicao_s > 5 && item.posicao_s < (a.duration || 1e9) - 3) a.currentTime = item.posicao_s; };
  const aoTempo = () => { const a = audio.current; if (a && Math.abs(a.currentTime - ultimo.current) >= 10) { ultimo.current = a.currentTime; salvar(); } };

  const ler = () => {
    const s = window.speechSynthesis; if (!s) return;
    s.cancel();
    const u = new SpeechSynthesisUtterance(texto); u.lang = 'pt-BR'; u.rate = 1;
    u.onend = () => setFalando(false); u.onerror = () => setFalando(false);
    setFalando(true); s.speak(u);
  };
  const parar = () => { try { window.speechSynthesis.cancel(); } catch { /* sem voz */ } setFalando(false); };

  return (
    <div className="pc-player" role="region" aria-label={`Tocando: ${item.titulo}`}>
      <div className="pc-player-topo">
        <strong>{item.titulo}</strong>
        <button type="button" className="pc-x" onClick={() => { salvar(); parar(); aoFechar(); }} aria-label="Fechar player">✕</button>
      </div>
      {item.tem_audio ? (
        src ? <audio ref={audio} src={src} controls autoPlay onLoadedMetadata={aoCarregar} onTimeUpdate={aoTempo} onPause={() => salvar()} onEnded={() => salvar(true)} />
          : <p className="sub">{erro || 'Carregando áudio…'}</p>
      ) : temVoz && texto ? (
        <div className="pc-voz">
          <p className="sub">Sem voz gerada no servidor: o navegador lê a transcrição em voz alta.</p>
          <button type="button" className="botao" onClick={falando ? parar : ler}>{falando ? '■ Parar' : '▶ Ler em voz alta'}</button>
        </div>
      ) : <p className="sub">Este episódio só tem transcrição (seu navegador não tem leitura em voz alta).</p>}
      {texto && <details className="pc-transc"><summary>Transcrição</summary><p>{texto}</p></details>}
    </div>
  );
}

function Itens({ itens, aoTocar, aoMudar, api, token, publico }) {
  return (
    <ol className="pc-itens">
      {itens.map((i) => (
        <li key={i.id} className={`pc-item s-${i.status}`}>
          <button type="button" className="pc-play" onClick={() => aoTocar(i)} aria-label={`Tocar ${i.titulo}`} disabled={!i.roteiro && !i.transcricao}>▶</button>
          <div className="pc-info">
            <b>{i.titulo}</b>
            <span className="sub">{[i.area, i.topico, i.duracao_s ? fmt(i.duracao_s) : null, publico ? i.autor : ESTADO[i.status]].filter(Boolean).join(' · ')}</span>
            {!publico && i.erro && <span className="pc-erro">{i.erro}</span>}
            {!publico && i.posicao_s > 5 && !i.concluido && <span className="pc-cont">Parou em {fmt(i.posicao_s)}</span>}
          </div>
          {!publico && (
            <div className="pc-acoes">
              {i.tem_audio && <a className="botao ghost" href="#baixar" onClick={async (e) => { e.preventDefault(); const r = await fetch(`/api/podcast/itens/${i.id}/audio?baixar=1`, { headers: { Authorization: `Bearer ${token}` } }); if (r.ok) { const u = URL.createObjectURL(await r.blob()); const a = document.createElement('a'); a.href = u; a.download = `${i.titulo}.mp3`; a.click(); URL.revokeObjectURL(u); } }}>Baixar áudio</a>}
              {i.roteiro && <a className="botao ghost" href="#transc" onClick={async (e) => { e.preventDefault(); const r = await fetch(`/api/podcast/itens/${i.id}/transcricao`, { headers: { Authorization: `Bearer ${token}` } }); if (r.ok) { const u = URL.createObjectURL(await r.blob()); const a = document.createElement('a'); a.href = u; a.download = `${i.titulo}.txt`; a.click(); URL.revokeObjectURL(u); } }}>Transcrição</a>}
              {i.roteiro && <button type="button" className={`botao ghost${i.publico ? ' on' : ''}`} onClick={async () => { await api(`/api/podcast/itens/${i.id}/radia`, { metodo: 'PUT', token, corpo: { publico: !i.publico } }).catch(() => {}); aoMudar(); }}>{i.publico ? '📻 Na rádio' : 'Enviar à rádio'}</button>}
              {i.status !== 'pronto' && <button type="button" className="botao ghost" onClick={async () => { await api(`/api/podcast/itens/${i.id}/gerar`, { metodo: 'POST', token, corpo: {} }).catch(() => {}); aoMudar(); }}>{i.roteiro ? 'Gerar áudio' : 'Tentar de novo'}</button>}
              <button type="button" className="botao ghost perigo" onClick={async () => { if (window.confirm('Apagar este episódio?')) { await api(`/api/podcast/itens/${i.id}`, { metodo: 'DELETE', token }).catch(() => {}); aoMudar(); } }}>Apagar</button>
            </div>
          )}
        </li>))}
    </ol>
  );
}

function MinhasPlaylists({ api, token, cfg, aoTocar }) {
  const [lista, setLista] = useState([]); const [sel, setSel] = useState(null); const [det, setDet] = useState(null);
  const [msg, setMsg] = useState(''); const [ocupado, setOcupado] = useState(false); const [cont, setCont] = useState([]);
  const [np, setNp] = useState({ titulo: '', prompt: '' });
  const [ne, setNe] = useState({ tipo: 'tema', tema: '', topico: '', prompt: '', minutos: 5 });
  const [sugest, setSugest] = useState([]); const [feed, setFeed] = useState(null);

  const carregar = useCallback(async () => {
    setLista(await api('/api/podcast/playlists', { token }).catch(() => []));
    setCont(await api('/api/podcast/continuar', { token }).catch(() => []));
    if (sel) setDet(await api(`/api/podcast/playlists/${sel}`, { token }).catch(() => null));
  }, [api, token, sel]);
  useEffect(() => { void carregar(); }, [carregar]);
  useEffect(() => { if (ne.tema.length < 2) { setSugest([]); return undefined; } const t = setTimeout(() => api(`/api/podcast/temas?busca=${encodeURIComponent(ne.tema)}`, { token }).then(setSugest).catch(() => {}), 250); return () => clearTimeout(t); }, [ne.tema, api, token]);

  const criar = async (e) => { e.preventDefault(); setMsg(''); try { const p = await api('/api/podcast/playlists', { metodo: 'POST', token, corpo: np }); setNp({ titulo: '', prompt: '' }); setSel(p.id); await carregar(); } catch (er) { setMsg(er.message); } };
  const addItem = async (e) => {
    e.preventDefault(); setMsg(''); setOcupado(true);
    try { const r = await api(`/api/podcast/playlists/${sel}/itens`, { metodo: 'POST', token, corpo: ne }); setMsg(r.aviso || 'Episódio criado.'); setNe({ ...ne, tema: '', topico: '', prompt: '' }); await carregar(); }
    catch (er) { setMsg(er.message); } finally { setOcupado(false); }
  };
  const publicar = async (liga) => { const r = await api(`/api/podcast/playlists/${sel}/publicar`, { metodo: 'POST', token, corpo: { publica: liga } }); setFeed(r.feed_publico || null); await carregar(); };
  const linkPrivado = async () => { if (!window.confirm('Gerar a credencial dos seus links privados? A anterior deixa de valer.')) return; const r = await api('/api/podcast/token/renovar', { metodo: 'POST', token }); setFeed(r.feeds.find((f) => f.playlist_id === sel)?.url || null); };
  const copiar = (t) => navigator.clipboard?.writeText(t).then(() => setMsg('Link copiado.')).catch(() => setMsg(t));

  return (
    <div className="pc-grid">
      <aside className="pc-lado">
        {cont.length > 0 && <div className="pc-cont-box"><b>Continuar de onde parou</b>{cont.map((c) => <button key={c.item_id} type="button" className="pc-cont-i" onClick={async () => { const d = await api(`/api/podcast/playlists/${c.playlist_id}`, { token }); const it = d.itens.find((x) => x.id === c.item_id); setSel(c.playlist_id); if (it) aoTocar(it); }}>▶ {c.titulo} <span className="sub">{fmt(c.posicao_s)}</span></button>)}</div>}
        <h3>Minhas playlists</h3>
        <ul className="pc-lista">{lista.map((p) => <li key={p.id}><button type="button" aria-current={sel === p.id ? 'true' : undefined} onClick={() => { setSel(p.id); setFeed(null); }}>{p.titulo}<span className="sub">{p.itens} ep. · {fmt(p.duracao_s)}{p.publica ? ' · pública' : ''}</span></button></li>)}</ul>
        <form onSubmit={criar} className="pc-form">
          <label>Nova playlist<input value={np.titulo} onChange={(e) => setNp({ ...np, titulo: e.target.value })} maxLength={120} placeholder="Ex.: Urgências da semana" /></label>
          <label>Prompt de detalhamento (opcional)<textarea value={np.prompt} onChange={(e) => setNp({ ...np, prompt: e.target.value })} maxLength={1500} rows={3} placeholder="Ex.: tom de plantão, foco em conduta e dicas de prova" /></label>
          <button className="botao" type="submit" disabled={np.titulo.trim().length < 2}>Criar playlist</button>
        </form>
      </aside>
      <section className="pc-main">
        {msg && <p className="pc-msg" role="status">{msg}</p>}
        {!det ? <p className="sub">Escolha ou crie uma playlist para adicionar episódios de aprofundamento ou revisão de cartões.</p> : (
          <>
            <h3>{det.titulo}</h3>
            {det.prompt && <p className="sub">Prompt: {det.prompt}</p>}
            {!cfg.tts && <p className="pc-aviso">O servidor não tem voz configurada: os episódios ficam com a transcrição e o navegador a lê em voz alta. Um administrador pode configurar a voz (TTS) para gerar áudio baixável.</p>}
            <Itens itens={det.itens} aoTocar={aoTocar} aoMudar={carregar} api={api} token={token} />
            <form onSubmit={addItem} className="pc-form pc-novo">
              <h4>Novo episódio</h4>
              <div className="pc-linha">
                <label>Tipo<select value={ne.tipo} onChange={(e) => setNe({ ...ne, tipo: e.target.value })}><option value="tema">Aprofundamento de tema</option><option value="revisao_cards">Revisão dos cartões do tema</option></select></label>
                <label>Duração<select value={ne.minutos} onChange={(e) => setNe({ ...ne, minutos: Number(e.target.value) })}>{[3, 5, 8, 12, 20].map((m) => <option key={m} value={m}>{m} min</option>)}</select></label>
              </div>
              <label>Tema<input value={ne.tema} onChange={(e) => setNe({ ...ne, tema: e.target.value })} list="pc-temas" maxLength={80} placeholder="Ex.: Pré-eclâmpsia" /></label>
              <datalist id="pc-temas">{sugest.map((s) => <option key={s.id} value={s.nome} />)}</datalist>
              <label>Tópico específico (opcional)<input value={ne.topico} onChange={(e) => setNe({ ...ne, topico: e.target.value })} maxLength={160} placeholder="Ex.: sulfato de magnésio" /></label>
              <label>Prompt deste episódio (opcional)<textarea value={ne.prompt} onChange={(e) => setNe({ ...ne, prompt: e.target.value })} maxLength={1500} rows={2} /></label>
              <button className="botao" type="submit" disabled={ocupado || ne.tema.trim().length < 2}>{ocupado ? 'Gerando… pode levar um minuto' : 'Gerar episódio'}</button>
            </form>
            <div className="pc-links">
              <h4>Ouvir em outro aplicativo de podcast</h4>
              <p className="sub">O link privado usa a sua credencial (renová-la revoga os links anteriores). O link público deixa qualquer pessoa com o endereço assinar a playlist.</p>
              <div className="pc-linha">
                <button type="button" className="botao ghost" onClick={linkPrivado}>Gerar link privado</button>
                {det.publica ? <button type="button" className="botao ghost" onClick={() => publicar(false)}>Desligar link público</button> : <button type="button" className="botao ghost" onClick={() => publicar(true)}>Criar link público</button>}
                <button type="button" className="botao ghost perigo" onClick={async () => { if (window.confirm('Apagar a playlist e seus episódios?')) { await api(`/api/podcast/playlists/${sel}`, { metodo: 'DELETE', token }); setSel(null); setDet(null); await carregar(); } }}>Apagar playlist</button>
              </div>
              {feed && <div className="pc-feed"><code>{feed}</code><button type="button" className="botao" onClick={() => copiar(feed)}>Copiar</button></div>}
            </div>
          </>)}
      </section>
    </div>
  );
}

function Radio({ api, token, cfg, aoTocar, tocando }) {
  const [canal, setCanal] = useState(null); const [prog, setProg] = useState({ itens: [], total: 0, pagina: 1 }); const [pagina, setPagina] = useState(1);
  useEffect(() => { api('/api/radia/canal', { token }).then(setCanal).catch(() => {}); }, [api, token]);
  useEffect(() => { api(`/api/radia/programa?pagina=${pagina}&por=10`, { token }).then(setProg).catch(() => {}); }, [api, token, pagina]);
  const paginas = Math.max(1, Math.ceil(prog.total / 10));
  return (
    <div className="pc-radio">
      <div className="pc-radio-topo">
        <IconeRadia tocando={tocando} />
        <div><h3>{canal?.nome || 'radIA.m3d · Revalida'}</h3><p className="sub">Rádio online de temas de revisão. Canal: <a href={canal?.site || 'https://radia.m3d.pro/revalida'} target="_blank" rel="noreferrer">radia.m3d.pro/revalida</a></p>
          {canal?.feed && <p className="sub">Feed do programa para apps de podcast: <code>{canal.feed}</code></p>}</div>
      </div>
      {prog.itens.length ? <Itens itens={prog.itens.map((i) => ({ ...i, status: 'pronto' }))} aoTocar={(i) => aoTocar(i, true)} aoMudar={() => {}} api={api} token={token} publico /> : <p className="sub">Ainda não há episódios no programa. Envie episódios seus da aba Minhas playlists.</p>}
      {paginas > 1 && <div className="pc-pag"><button type="button" className="botao ghost" disabled={pagina <= 1} onClick={() => setPagina(pagina - 1)}>‹</button><span>{pagina}/{paginas}</span><button type="button" className="botao ghost" disabled={pagina >= paginas} onClick={() => setPagina(pagina + 1)}>›</button></div>}
      {!cfg.tts && <p className="sub">Episódios sem áudio são lidos em voz alta pelo navegador.</p>}
    </div>
  );
}

function Exportar({ api, token, cfg, usuario }) {
  const [temas, setTemas] = useState([]); const [busca, setBusca] = useState(''); const [sel, setSel] = useState([]);
  const [titulo, setTitulo] = useState(''); const [pool, setPool] = useState({ pedidos: [] }); const [msg, setMsg] = useState('');
  const admin = ['admin', 'root'].includes(usuario?.papel_app);
  const carregar = useCallback(() => api('/api/radia/pool', { token }).then(setPool).catch(() => {}), [api, token]);
  useEffect(() => { void carregar(); }, [carregar]);
  useEffect(() => { const t = setTimeout(() => api(`/api/podcast/temas?busca=${encodeURIComponent(busca)}`, { token }).then(setTemas).catch(() => {}), 250); return () => clearTimeout(t); }, [busca, api, token]);
  const baixar = async (p) => { const r = await fetch(`/api/radia/pool/${p.id}/pacote`, { headers: { Authorization: `Bearer ${token}` } }); if (r.ok) { const u = URL.createObjectURL(await r.blob()); const a = document.createElement('a'); a.href = u; a.download = `radia-pacote-${p.id.slice(0, 8)}.json`; a.click(); URL.revokeObjectURL(u); } };
  const enviar = async () => { setMsg(''); try { await api('/api/radia/exportar', { metodo: 'POST', token, corpo: { temas: sel, titulo } }); setSel([]); setTitulo(''); setMsg('Pedido guardado no pool, aguardando sincronização.'); await carregar(); } catch (e) { setMsg(e.message); } };
  return (
    <div className="pc-exp">
      <h3>Exportar temas para a Rádio Revalida</h3>
      <p className="sub">O pedido fica em um pool com a data da solicitação e espera a sincronização com a radIA.m3d. {pool.sincronizacao ? 'A sincronização está configurada.' : 'A sincronização com o site ainda não foi configurada pelo administrador; o pacote pode ser baixado enquanto isso.'}</p>
      <div className="pc-linha">
        <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar tema…" aria-label="Buscar tema" />
        <input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Título do pacote (opcional)" maxLength={140} aria-label="Título do pacote" />
      </div>
      <ul className="pc-temas">{temas.map((t) => <li key={t.id}><label><input type="checkbox" checked={sel.includes(t.id)} onChange={(e) => setSel(e.target.checked ? [...sel, t.id].slice(0, 20) : sel.filter((x) => x !== t.id))} /> {t.nome} <span className="sub">{t.area}</span></label></li>)}</ul>
      <button type="button" className="botao" disabled={!sel.length} onClick={enviar}>Enviar {sel.length || ''} tema(s) ao pool</button>
      {msg && <p className="pc-msg" role="status">{msg}</p>}
      <h4>Pedidos (na ordem em que foram solicitados)</h4>
      {pool.pedidos.length === 0 ? <p className="sub">Nenhum pedido ainda.</p> : (
        <table className="pc-tab"><thead><tr><th>Solicitado em</th><th>Pacote</th><th>Itens</th><th>Situação</th><th /></tr></thead>
          <tbody>{pool.pedidos.map((p) => <tr key={p.id}><td>{data(p.solicitado_em)}</td><td>{p.titulo}</td><td>{p.itens}</td><td><span className={`pc-st ${p.status}`}>{STATUS_POOL[p.status]}</span>{p.erro && <div className="sub">{p.erro}</div>}{p.sincronizado_em && <div className="sub">em {data(p.sincronizado_em)}</div>}</td>
            <td className="pc-acoes"><button type="button" className="botao ghost" onClick={() => baixar(p)}>Baixar pacote</button>{p.status !== 'sincronizado' && <button type="button" className="botao ghost perigo" onClick={async () => { await api(`/api/radia/pool/${p.id}`, { metodo: 'DELETE', token }).catch(() => {}); await carregar(); }}>Cancelar</button>}</td></tr>)}</tbody></table>)}
      {admin && <button type="button" className="botao ghost" disabled={!cfg.radia} onClick={async () => { try { const r = await api('/api/radia/sincronizar', { metodo: 'POST', token }); setMsg(`Sincronização: ${JSON.stringify(r)}`); await carregar(); } catch (e) { setMsg(e.message); } }}>Sincronizar agora (administração)</button>}
    </div>
  );
}

export default function TelaPodcast({ token, usuario, api }) {
  const [aba, setAba] = useState('playlists'); const [cfg, setCfg] = useState({}); const [tocando, setTocando] = useState(null);
  useEffect(() => { api('/api/podcast/config', { token }).then(setCfg).catch(() => {}); }, [api, token]);
  const tocar = (item, publico = false) => setTocando({ item, publico });
  return (
    <div className="tela pc-tela">
      <header className="pc-cab"><IconeRadia tocando={Boolean(tocando)} /><div><h2>Podcast e Rádio Revalida</h2><p className="sub">Aprofunde temas e revise cartões em áudio. Pause e continue depois.</p></div></header>
      <nav className="pc-abas" role="tablist">
        {[['playlists', 'Minhas playlists'], ['radio', 'Rádio Revalida'], ['exportar', 'Exportar para a rádio']].map(([k, n]) => <button key={k} type="button" role="tab" aria-selected={aba === k} onClick={() => setAba(k)}>{n}</button>)}
      </nav>
      {aba === 'playlists' && <MinhasPlaylists api={api} token={token} cfg={cfg} aoTocar={(i) => tocar(i, false)} />}
      {aba === 'radio' && <Radio api={api} token={token} cfg={cfg} aoTocar={tocar} tocando={Boolean(tocando)} />}
      {aba === 'exportar' && <Exportar api={api} token={token} cfg={cfg} usuario={usuario} />}
      {tocando && <Player key={tocando.item.id} item={tocando.item} api={api} token={token} publico={tocando.publico} aoFechar={() => setTocando(null)} />}
    </div>
  );
}
