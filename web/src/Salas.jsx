// Ciclos de estações: salas permanentes, papéis, fim de estação, pedidos de papel, ciclos pausados.
// O servidor decide tudo (regras no banco); aqui só mostramos o estado que ele nos manda e chamamos as ações.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { criarSalaVideo } from './video.js';
import TextoEstacao from './TextoEstacao.jsx';
import FerramentasSala from './FerramentasSala.jsx';
import { CartasEstacao, TranscricaoCandidato, FalaDoCandidato, Sugestao, AnaliseDaFala, useAoVivo } from './SalaExecucao.jsx';
import { Autocorrecao, ConvidarOnline, LiberarTranscricao } from './SalaExtras.jsx';
import './salas.css';

const PAPEL = { admin: 'Chefe', candidato: 'Candidato', observador: 'Observador' };
const PAPEIS_PEDIDO = [['admin', 'Ser o chefe'], ['candidato', 'Ser o candidato']];
const MARCAS = [['sim', 'Sim'], ['parcial', 'Parcial'], ['nao', 'Não']];
const fmt = (s) => `${String(Math.floor(Math.max(0, s) / 60)).padStart(2, '0')}:${String(Math.max(0, Math.floor(s % 60))).padStart(2, '0')}`;
const AREAS = { clinica_medica: 'Clínica Médica', cirurgia: 'Cirurgia', ginecologia_obstetricia: 'Ginecologia e Obstetrícia', pediatria: 'Pediatria', mfc: 'Medicina de Família e Comunidade' };
const pts = (n) => (n === null || n === undefined ? '—' : Number(n).toLocaleString('pt-BR', { maximumFractionDigits: 2 }));
const rotaToken = (id) => `/api/salas/${id}/agora-token`;

/** Relógio que conta desde `inicio` (o relógio é do servidor: quem entra no meio vê o tempo certo). */
const ROTULO_SITUACAO = { na_fila: 'ainda na fila', em_andamento: 'em andamento agora', pausada: 'pausada', finalizada: 'já feita neste ciclo', abandonada: 'cancelada' };

function Relogio({ inicio, limiteMin }) {
  const [, forca] = useState(0);
  useEffect(() => { const t = setInterval(() => forca((n) => n + 1), 1000); return () => clearInterval(t); }, []);
  const dec = Math.max(0, (Date.now() - new Date(inicio).getTime()) / 1000);
  const resta = limiteMin ? limiteMin * 60 - dec : null;
  return <span className={`sl-relogio${resta !== null && resta < 60 ? ' fim' : ''}`} role="timer" aria-label="tempo da estação">{resta !== null ? fmt(resta) : fmt(dec)}</span>;
}

export default function TelaCiclos({ token, usuario, api, sugestao, aoRevisar, aoAnalise }) {
  const [salaId, setSalaId] = useState(() => { try { return sessionStorage.getItem('rv_sala') || null; } catch { return null; } });
  const [codigo, setCodigo] = useState('');
  const [erro, setErro] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const guardar = (id) => { setSalaId(id); try { id ? sessionStorage.setItem('rv_sala', id) : sessionStorage.removeItem('rv_sala'); } catch { /* sem storage */ } };
  const abrir = async (fn) => { setOcupado(true); setErro(''); try { await fn(); } catch (e) { setErro(e.message); } finally { setOcupado(false); } };
  const criar = () => abrir(async () => { const { id } = await api('/api/salas', { metodo: 'POST', token }); await api(`/api/salas/${id}/entrar`, { metodo: 'POST', token }); guardar(id); });
  const entrar = () => abrir(async () => { const id = codigo.trim(); await api(`/api/salas/${id}/entrar`, { metodo: 'POST', token }); guardar(id); });

  if (salaId) return <Sala key={salaId} salaId={salaId} token={token} usuario={usuario} api={api} sugestao={sugestao} aoRevisar={aoRevisar} aoAnalise={aoAnalise} aoSair={() => guardar(null)} />;
  return (
    <div className="tela sl">
      <h2>Ciclos de estações</h2>
      <p className="sub">Uma sala reúne o chefe, o candidato e quem observa. Crie uma sala ou entre com o código que o chefe passou.</p>
      <button className="btn" onClick={criar} disabled={ocupado}>Criar sala</button>
      <label className="campo"><span>Código da sala</span>
        <input value={codigo} onChange={(e) => setCodigo(e.target.value)} placeholder="cole o código aqui" autoComplete="off" />
      </label>
      <button className="btn menta" onClick={entrar} disabled={ocupado || !codigo.trim()}>Entrar na sala</button>
      {erro && <p className="aviso" role="alert">{erro}</p>}
    </div>
  );
}

/** Avaliador da última estação (o chefe da sala também avalia). */
const euAvaliou = (ultima, est, eu) => Boolean(ultima && (est?.sala?.admin_id === eu || ultima.avaliador_id === eu));

function Sala({ salaId, token, usuario, api, aoSair, sugestao, aoRevisar, aoAnalise }) {
  const [est, setEst] = useState(null);
  const [erro, setErro] = useState('');
  const [aviso, setAviso] = useState('');
  const [estacoes, setEstacoes] = useState([]);
  const [escolhidas, setEscolhidas] = useState(() => (sugestao ? [sugestao] : []));
  const [grupo, setGrupo] = useState('');
  const [ultima, setUltima] = useState(null);
  const [pep, setPep] = useState(null);
  const [marcas, setMarcas] = useState({});
  const [video, setVideo] = useState({ cam: false, mic: false, modo: null, erro: '' });
  const refs = useRef({ socket: null, video: null });
  const eu = usuario.id;

  const carregar = useCallback(async () => {
    try { setEst(await api(`/api/salas/${salaId}/estado`, { token })); setErro(''); }
    catch (e) { setErro(e.message); }
  }, [api, salaId, token]);

  const agir = useCallback(async (caminho, corpo, metodo = 'POST') => {
    setAviso('');
    try { const r = await api(caminho, { metodo, token, corpo }); await carregar(); return r; }
    catch (e) { setAviso(e.message); await carregar(); return null; }
  }, [api, token, carregar]);

  // estado em tempo real + reserva por consulta (se o socket cair, a tela continua certa)
  useEffect(() => {
    let vivo = true;
    carregar();
    const socket = io({ auth: { token } });
    refs.current.socket = socket;
    socket.on('connect', () => socket.emit('salav2:entrar', { salaId }, () => {}));
    socket.on('sala:estado', (m) => { if (vivo && m?.estado) setEst(m.estado); });
    const t = setInterval(carregar, 10000);
    return () => { vivo = false; clearInterval(t); socket.disconnect(); };
  }, [salaId, token, carregar]);

  useEffect(() => { api('/api/estacoes', { token }).then(setEstacoes).catch(() => {}); }, [api, token]);

  const meu = est?.meu_papel;
  const exe = est?.execucao;
  const ciclo = est?.ciclo;
  const euAvalio = Boolean(exe && (exe.avaliador_id === eu || est?.sala.admin_id === eu));

  const aoVivo = useAoVivo({ execId: exe?.id, ativo: Boolean(exe && euAvalio), api, token });

  // checklist: só quem avalia recebe (o servidor nega para o candidato)
  useEffect(() => {
    setPep(null); setMarcas({});
    if (!exe || !euAvalio) return;
    let vivo = true;
    api(`/api/execucoes/${exe.id}/pep`, { token }).then((p) => vivo && setPep(p)).catch((e) => vivo && setAviso(e.message));
    return () => { vivo = false; };
  }, [exe?.id, euAvalio, api, token]);

  // estatísticas do fim da estação: aparecem para todos quando não há estação rodando
  const idUltima = useRef(null);
  useEffect(() => {
    if (!est || exe) { if (exe) setUltima(null); return; }
    api(`/api/salas/${salaId}/ultima-execucao`, { token }).then((r) => {
      if (!r.ultima) return setUltima(null);
      idUltima.current = r.ultima.id; setUltima(r.ultima);
    }).catch(() => {});
  }, [est?.sala?.versao, exe?.id, salaId, api, token]);   // eslint-disable-line react-hooks/exhaustive-deps

  // vídeo da sala
  const [tiles, setTiles] = useState({});
  const ligarVideo = async () => {
    try {
      const v = await criarSalaVideo({
        sessaoId: salaId, tokenAuth: token, rotaToken,
        aoMudar: (ev) => {
          if (ev.tipo === 'video') setTiles((t) => ({ ...t, [ev.uid]: { track: ev.track, local: ev.local } }));
          if (ev.tipo === 'saiu-video' || ev.tipo === 'saiu') setTiles((t) => { const n = { ...t }; delete n[ev.uid]; return n; });
        },
        aoErro: (m) => setVideo((s) => ({ ...s, erro: m })),
        aoSomBloqueado: () => {}, aoPermissao: () => {},
      });
      refs.current.video = v;
      setVideo((s) => ({ ...s, modo: v.modo, erro: '' }));
    } catch (e) { setVideo((s) => ({ ...s, erro: e.message })); }
  };
  useEffect(() => () => { refs.current.video?.sair?.(); }, []);
  // admin pausou meu vídeo: relê o token (o servidor passa a negar a publicação)
  const minhaPausa = est?.participantes?.find((p) => p.usuario_id === eu)?.video_pausado;
  useEffect(() => { if (minhaPausa !== undefined) refs.current.video?.sincronizar?.(); }, [minhaPausa]);
  const alternar = async (que) => {
    const v = refs.current.video; if (!v) return;
    const ligado = que === 'cam' ? await v.alternarCam(!video.cam) : await v.alternarMic(!video.mic);
    setVideo((s) => ({ ...s, [que]: ligado }));
  };

  const sair = async () => { try { await api(`/api/salas/${salaId}/sair`, { metodo: 'POST', token }); } catch { /* sai assim mesmo */ } refs.current.video?.sair?.(); aoSair(); };

  const nome = (id) => est?.participantes?.find((p) => p.usuario_id === id)?.nome ?? '—';
  const fila = est?.fila ?? [];
  const finalizar = async () => {
    const r = await agir(`/api/execucoes/${exe.id}/finalizar`, { marcas });
    if (r) setMarcas({});
  };
  // Nível 3 do treino: o servidor sorteia estações alternando as áreas; o candidato só as vê quando chegam (a fila futura é escondida)
  const sortearBloco = async () => {
    try { const r = await api('/api/estudo/bloco-misto', { metodo: 'POST', token, corpo: { quantidade: 5 } }); setEscolhidas(r.estacoes); setGrupo('Nível 3 · bloco misto'); setAviso(''); }
    catch (e) { setAviso(e.message); }
  };
  const alternarEscolha = (id) => setEscolhidas((l) => (l.includes(id) ? l.filter((x) => x !== id) : [...l, id]));
  const criarCiclo = async () => { if (await agir(`/api/salas/${salaId}/ciclos`, { estacoes: escolhidas, grupo: grupo || undefined })) { setEscolhidas([]); setGrupo(''); } };
  // Estação que já está na fila: o servidor avisa quais são; aqui a pessoa decide duplicar a prática, adicionar só as outras ou desistir.
  const [repetidas, setRepetidas] = useState(null);
  const adicionar = async (repetir = false) => {
    setAviso(''); setRepetidas(null);
    try {
      await api(`/api/ciclos/${ciclo.id}/itens`, { metodo: 'POST', token, corpo: { estacoes: escolhidas, grupo: grupo || undefined, ...(repetir ? { repetir: true } : {}) } });
      await carregar(); setEscolhidas([]); setGrupo('');
    } catch (e) {
      if (e.codigo === 'ESTACAO_NA_FILA' && e.dados?.repetidas) setRepetidas({ lista: e.dados.repetidas, msg: e.message });
      else setAviso(e.message);
      await carregar();
    }
  };
  const soAsNovas = () => { const ja = new Set((repetidas?.lista ?? []).map((r) => r.id)); setEscolhidas((l) => l.filter((id) => !ja.has(id))); setRepetidas(null); };

  const porArea = useMemo(() => {
    const m = new Map();
    for (const e of estacoes) { if (!m.has(e.area)) m.set(e.area, []); m.get(e.area).push(e); }
    return [...m.entries()];
  }, [estacoes]);

  if (!est) return <div className="tela sl"><p className="sub" role="status">{erro || 'Entrando na sala…'}</p>{erro && <button className="btn mini" onClick={aoSair}>Voltar</button>}</div>;

  const souAdmin = meu === 'admin';
  const podeConvidar = souAdmin || Boolean(est.participantes.find((p) => p.usuario_id === eu)?.e_avaliador);
  const emAndamento = Boolean(exe);
  const pendentes = fila.filter((i) => i.estado === 'pendente');
  const minhaSolicitacao = est.solicitacoes.find((s) => s.solicitante_id === eu);
  const naFila = new Set(fila.map((i) => i.titulo));
  const seletor = (
    <div className="sl-sel">
      {porArea.length === 0 && <p className="sub">Ainda não há estações aprovadas. Crie uma na aba ✏️ Criar.</p>}
      {porArea.map(([area, lista]) => (
        <fieldset key={area}><legend>{AREAS[area] ?? area}</legend>
          {lista.map((e) => (
            <label key={e.id} className="sl-op"><input type="checkbox" checked={escolhidas.includes(e.id)} onChange={() => alternarEscolha(e.id)} /> {e.titulo} <em>{e.duracao_min} min</em>{naFila.has(e.titulo) && <span className="tag espera" title="Já está na fila deste ciclo">na fila</span>}</label>
          ))}
        </fieldset>
      ))}
      <label className="campo"><span>Grupo / nível de treino (opcional)</span><input list="sl-niveis" value={grupo} onChange={(e) => setGrupo(e.target.value)} maxLength={60} placeholder="ex.: Nível 2 · cronometrada" /></label>
      <datalist id="sl-niveis"><option value="Nível 1 · guiada" /><option value="Nível 2 · cronometrada" /><option value="Nível 3 · bloco misto" /></datalist>
      <button type="button" className="btn mini" onClick={sortearBloco}>Sortear bloco misto (5 estações, áreas alternadas)</button>
    </div>
  );

  const irPara = (id) => {
    const el = document.getElementById(id); if (!el) return;
    if (el.tagName === 'DETAILS') el.open = true;
    el.scrollIntoView({ behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
    el.classList.add('sl-realce'); setTimeout(() => el.classList.remove('sl-realce'), 1500);
  };
  const pedidosPendentes = est.solicitacoes.filter((x) => x.solicitante_id !== eu).length;
  // só aparecem as ferramentas que o papel e o momento permitem; a ordem escolhida pela pessoa é aplicada por cima (FerramentasSala)
  const ferramentas = [
    video.modo === null
      ? { id: 'video', rotulo: 'Entrar no vídeo', curto: 'Vídeo', aoClicar: ligarVideo }
      : { id: 'cam', rotulo: video.cam ? 'Desligar câmera' : 'Ligar câmera', curto: 'Câmera', ativo: video.cam, aoClicar: () => alternar('cam') },
    ...(video.modo !== null ? [{ id: 'mic', rotulo: video.mic ? 'Silenciar microfone' : 'Ligar microfone', curto: 'Mic', ativo: video.mic, aoClicar: () => alternar('mic') }] : []),
    ...(souAdmin ? [{ id: 'audio', rotulo: est.sala.audio_observadores ? 'Bloquear áudio dos observadores' : 'Liberar áudio dos observadores', curto: 'Áudio obs.', ativo: est.sala.audio_observadores, aoClicar: () => agir(`/api/salas/${salaId}/audio-observadores`, { liberado: !est.sala.audio_observadores }, 'PATCH') }] : []),
    { id: 'pessoas', rotulo: 'Participantes', curto: 'Pessoas', aoClicar: () => irPara('sl-participantes') },
    ...(podeConvidar ? [{ id: 'convidar', rotulo: 'Convidar pessoas online', curto: 'Convidar', aoClicar: () => irPara('sl-participantes') }] : []),
    ...(pedidosPendentes > 0 && (meu === 'admin' || meu === 'candidato') ? [{ id: 'pedidos', rotulo: 'Pedidos de papel', curto: 'Pedidos', aviso: pedidosPendentes, aoClicar: () => irPara('sl-pedidos') }] : []),
    ...(emAndamento ? [{ id: 'estacao', rotulo: 'Estação em andamento', curto: 'Estação', aoClicar: () => irPara('sl-estacao') },
      { id: 'transcricao', rotulo: euAvalio ? 'Fala do candidato em tempo real' : 'Minha transcrição', curto: 'Fala', aoClicar: () => irPara(euAvalio ? 'sl-transcricao' : 'sl-estacao') }] : []),
    ...(emAndamento && euAvalio && pep ? [{ id: 'checklist', rotulo: 'Checklist do PEP', curto: 'PEP', aoClicar: () => irPara('sl-checklist') }] : []),
    ...(!emAndamento && ultima && ciclo ? [{ id: 'fim', rotulo: 'Resultado da estação', curto: 'Resultado', aoClicar: () => irPara('sl-fim') }] : []),
    ...(ciclo ? [{ id: 'fila', rotulo: 'Fila do ciclo', curto: 'Fila', aoClicar: () => irPara('sl-fila') }] : []),
    { id: 'codigo', rotulo: 'Copiar o código da sala', curto: 'Código', aoClicar: () => { navigator.clipboard?.writeText(salaId); setAviso('Código da sala copiado.'); } },
  ];

  return (
    <div className="tela sl">
      <FerramentasSala ferramentas={ferramentas} />
      <div className="sl-topo">
        <div><h2>Sala</h2><button className="sl-cod" onClick={() => navigator.clipboard?.writeText(salaId)} title="Copiar código">{salaId}</button></div>
        <span className={`sl-papel p-${meu}`} data-testid="meu-papel">{PAPEL[meu] ?? meu}</span>
      </div>
      {aviso && <p className="aviso" role="alert">{aviso}</p>}

      <section className="sl-bloco" id="sl-video" aria-label="Vídeo">
        <div className="sl-tiles">{Object.entries(tiles).map(([uid, t]) => <Tile key={uid} track={t.track} rotulo={t.local ? 'Você' : 'Participante'} />)}</div>
        {video.modo === null
          ? <button className="btn mini" onClick={ligarVideo}>Entrar no vídeo</button>
          : <div className="acoes">
              {video.modo === 'demo' && <span className="sub">Modo demonstração (sem vídeo real)</span>}
              <button className="btn mini" onClick={() => alternar('cam')} aria-pressed={video.cam}>{video.cam ? 'Desligar câmera' : 'Ligar câmera'}</button>
              <button className="btn mini" onClick={() => alternar('mic')} aria-pressed={video.mic}>{video.mic ? 'Silenciar' : 'Ligar microfone'}</button>
            </div>}
        {video.erro && <p className="aviso">{video.erro}</p>}
        {souAdmin && <label className="sl-op"><input type="checkbox" checked={est.sala.audio_observadores} onChange={(e) => agir(`/api/salas/${salaId}/audio-observadores`, { liberado: e.target.checked }, 'PATCH')} /> Liberar áudio dos observadores</label>}
      </section>

      {est.ciclos_pausados.length > 0 && (
        <section className="sl-bloco" aria-label="Ciclos pausados">
          <h3>Ciclos pausados</h3>
          {est.ciclos_pausados.map((c) => (
            <div key={c.ciclo_id} className="sl-linha">
              <span>{c.execucao_pausada ? 'Estação pausada' : 'Ciclo pausado'} · {c.motivo ?? 'troca de papéis'}</span>
              <button className="btn mini menta" onClick={() => agir(`/api/ciclos/${c.ciclo_id}/retomar`)}>Retomar</button>
            </div>
          ))}
        </section>
      )}

      <section className="sl-bloco" id="sl-participantes" aria-label="Participantes">
        <h3>Participantes ({est.participantes.length})</h3>
        {est.participantes.map((p) => (
          <div key={p.usuario_id} className="sl-linha">
            <span>{p.nome}{p.usuario_id === eu && ' (você)'} <em className={`sl-papel p-${p.papel}`}>{PAPEL[p.papel]}{p.e_avaliador && p.papel !== 'admin' ? ' · avalia' : ''}</em>{p.video_pausado && <em className="sl-mudo"> vídeo pausado</em>}</span>
            {souAdmin && p.usuario_id !== eu && (
              <span className="acoes">
                {p.papel !== 'candidato' && <button className="btn mini" disabled={emAndamento} onClick={() => agir(`/api/salas/${salaId}/candidato`, { usuario_id: p.usuario_id }, 'PATCH')}>Candidato</button>}
                {!p.e_avaliador && <button className="btn mini" disabled={emAndamento} onClick={() => agir(`/api/salas/${salaId}/avaliador`, { usuario_id: p.usuario_id }, 'PATCH')}>Avaliador</button>}
                <button className="btn mini" onClick={() => agir(`/api/salas/${salaId}/participantes/${p.usuario_id}/video`, { pausado: !p.video_pausado }, 'PATCH')}>{p.video_pausado ? 'Liberar vídeo' : 'Pausar vídeo'}</button>
              </span>
            )}
          </div>
        ))}
        {podeConvidar && <ConvidarOnline salaId={salaId} convites={est.convites ?? []} api={api} token={token} aoMudou={carregar} />}
        {meu === 'observador' || (meu !== 'admin' && !minhaSolicitacao) ? (
          <div className="acoes">{PAPEIS_PEDIDO.filter(([p]) => p !== meu).map(([p, rot]) => <button key={p} className="btn mini" onClick={() => agir(`/api/salas/${salaId}/solicitacoes`, { papel: p })}>{rot}</button>)}</div>
        ) : null}
        {meu === 'candidato' && !emAndamento && <div className="acoes"><button type="button" className="btn mini" onClick={() => agir(`/api/salas/${salaId}/candidato/abandonar`)}>Deixar de ser candidato (passo a observar)</button></div>}
        {minhaSolicitacao && <div className="sl-linha"><span>Seu pedido ({PAPEL[minhaSolicitacao.papel]}) aguarda resposta.</span><button className="btn mini" onClick={() => agir(`/api/solicitacoes/${minhaSolicitacao.id}/cancelar`)}>Cancelar</button></div>}
      </section>

      {est.solicitacoes.filter((s) => s.solicitante_id !== eu).length > 0 && (meu === 'admin' || meu === 'candidato') && (
        <section className="sl-bloco" id="sl-pedidos" aria-label="Pedidos de papel">
          <h3>Pedidos de papel</h3>
          {est.solicitacoes.filter((s) => s.solicitante_id !== eu).map((s) => (
            <div key={s.id} className="sl-linha"><span>{s.nome} quer ser {PAPEL[s.papel]?.toLowerCase()}</span>
              <span className="acoes"><button className="btn mini menta" onClick={() => agir(`/api/solicitacoes/${s.id}/decidir`, { aceitar: true })}>Aceitar</button><button className="btn mini" onClick={() => agir(`/api/solicitacoes/${s.id}/decidir`, { aceitar: false })}>Recusar</button></span></div>
          ))}
        </section>
      )}

      {emAndamento && (
        <section className="sl-bloco sl-exec" id="sl-estacao" aria-label="Estação em andamento">
          <h3>{exe.titulo}</h3>
          <p className="sub">Candidato: {nome(exe.candidato_id)} · Avalia: {nome(exe.avaliador_id)}</p>
          <Relogio inicio={exe.iniciada_em} limiteMin={pep?.duracao_min} />
          <CartasEstacao execId={exe.id} papel={euAvalio ? 'avaliador' : meu} api={api} token={token} segmentos={aoVivo.segmentos} />
          <span id="sl-transcricao" />
          {meu === 'candidato' && exe.candidato_id === eu && <TranscricaoCandidato execId={exe.id} api={api} token={token} />}
          {euAvalio && <FalaDoCandidato segmentos={aoVivo.segmentos} info={aoVivo.info} aoAnalisar={aoVivo.analisar} />}
          {euAvalio && <AnaliseDaFala info={aoVivo.info} />}
          {euAvalio && pep && (
            <>
              <span id="sl-checklist" />
              {pep.script_ator && <details><summary>Roteiro do ator</summary><TextoEstacao corpo={pep.script_ator} /></details>}
              {pep.itens.map((i) => (
                <div key={i.id} className={`sl-pep${i.critico ? ' crit' : ''}`}>
                  <span>{i.descricao}{i.critico && <em> crítico</em>} <em>{pts(i.pontos_total)} pts</em></span>
                  <Sugestao resumo={aoVivo.info.resumo} s={aoVivo.sugestoes[i.id]} aoUsar={(v) => setMarcas((m) => ({ ...m, [i.id]: v }))} />
                  <span className="sl-marcas" role="group" aria-label={i.descricao}>
                    {MARCAS.map(([v, rot]) => <button key={v} className={`sl-m${marcas[i.id] === v ? ' on' : ''}`} aria-pressed={marcas[i.id] === v} onClick={() => setMarcas((m) => ({ ...m, [i.id]: v }))}>{rot}</button>)}
                  </span>
                </div>
              ))}
              <button className="btn" onClick={finalizar}>Finalizar estação</button>
            </>
          )}
          <CancelarEstacao execId={exe.id} euAvalio={euAvalio} souCandidato={meu === 'candidato' && exe.candidato_id === eu} agir={agir} salaId={salaId} />
          {!euAvalio && <p className="sub">{meu === 'candidato' ? 'Conduza o atendimento. O avaliador registra o checklist.' : 'Acompanhe em silêncio.'}</p>}
        </section>
      )}

      {!emAndamento && ultima && ciclo && (
        <section className="sl-bloco sl-fim" id="sl-fim" aria-label="Fim da estação" data-testid="fim-estacao">
          <h3>Estação finalizada: {ultima.titulo}</h3>
          <div className="sl-stats">
            <div><b>{pts(ultima.nota)}</b><span>de {pts(ultima.max)} pts{ultima.percentual !== null && ` · ${ultima.percentual}%`}</span></div>
            <div><b>{fmt(ultima.duracao_s)}</b><span>de {ultima.duracao_min} min</span></div>
            <div><b>{ultima.vezes_realizada}ª</b><span>vez desta estação</span></div>
            <div><b>{ultima.criticos_falhos ?? 0}</b><span>itens críticos falhos</span></div>
          </div>
          {ultima.historico.length > 1 && <p className="sub">Últimas notas: {ultima.historico.map((h) => h.nota ?? '—').reverse().join(' → ')}</p>}
          <details><summary>Itens</summary>
            {ultima.itens.map((i) => <div key={i.id} className={`sl-it r-${i.resultado}`}>{i.resultado === 'sim' ? '✔' : i.resultado === 'parcial' ? '◐' : '✘'} {i.descricao} <em>{pts(i.pontos)}/{pts(i.pontos_total)}</em></div>)}
          </details>
          {souAdmin ? (
            <>
              <p className="sub">O que fazer agora?</p>
              <div className="acoes">
                <button className="btn mini menta" onClick={() => agir(`/api/ciclos/${ciclo.id}/proximo`, { acao: 'avancar' })} disabled={pendentes.length === 0}>Próxima estação</button>
                <button className="btn mini" onClick={() => agir(`/api/ciclos/${ciclo.id}/proximo`, { acao: 'manter' })}>Manter papéis</button>
                <button className="btn mini" onClick={() => agir(`/api/ciclos/${ciclo.id}/proximo`, { acao: 'inverter' })}>Inverter papéis</button>
                <button className="btn mini" onClick={() => agir(`/api/ciclos/${ciclo.id}/proximo`, { acao: 'encerrar' })}>Encerrar ciclo</button>
              </div>
            </>
          ) : <p className="sub">Aguardando o chefe decidir o próximo passo. O vídeo continua aberto.</p>}
          {(meu === 'candidato' || euAvaliou(ultima, est, eu)) && <Autocorrecao key={ultima.id} execId={ultima.id} api={api} token={token} aoAdotar={async () => { await carregar(); try { const r = await api(`/api/salas/${salaId}/ultima-execucao`, { token }); setUltima(r.ultima ?? null); } catch { /* mantém */ } }} />}
          {euAvaliou(ultima, est, eu) && <LiberarTranscricao key={`lib-${ultima.id}`} execId={ultima.id} api={api} token={token} />}
          {aoAnalise && (meu === 'candidato' || euAvaliou(ultima, est, eu)) && <button className="btn mini menta" onClick={() => aoAnalise(ultima.id)}>Ver análise completa da estação</button>}
          {meu === 'candidato' && aoRevisar && <button className="btn mini menta" onClick={aoRevisar}>Registrar o que faltou (revisão)</button>}
        </section>
      )}

      {ciclo ? (
        <section className="sl-bloco" id="sl-fila" aria-label="Fila do ciclo">
          <h3>Fila do ciclo</h3>
          {fila.length === 0 && <p className="sub">Nenhuma estação visível ainda.</p>}
          {fila.map((i) => (
            <div key={i.id} className="sl-linha" data-estado={i.estado}>
              <span>{i.posicao}. {i.titulo}{i.grupo && <em> · {i.grupo}</em>} <em className={`sl-est e-${i.estado}`}>{i.estado.replace('_', ' ')}</em></span>
              {souAdmin && (
                <span className="acoes">
                  {i.estado === 'pendente' && <button className="btn mini" onClick={() => agir(`/api/ciclos/${ciclo.id}/itens/${i.id}/liberar`, { liberada: !i.liberada }, 'PATCH')}>{i.liberada ? 'Bloquear' : 'Liberar'}</button>}
                  {i.estado === 'pendente' && !emAndamento && <button className="btn mini menta" onClick={() => agir(`/api/ciclos/${ciclo.id}/execucoes`, { item_id: i.id })}>Iniciar</button>}
                </span>
              )}
            </div>
          ))}
          {souAdmin && !emAndamento && !ultima && <button className="btn mini" onClick={() => agir(`/api/ciclos/${ciclo.id}/proximo`, { acao: 'encerrar' })}>Encerrar este ciclo</button>}
          {souAdmin && (<><h4>Adicionar estações</h4>{seletor}<button className="btn mini" disabled={escolhidas.length === 0} onClick={() => adicionar(false)}>Adicionar ao ciclo</button>
            {repetidas && (
              <div className="aviso" role="alert" data-testid="aviso-na-fila">
                <b>{repetidas.msg}</b>
                <ul>{repetidas.lista.map((r) => <li key={`${r.id}-${r.posicao}`}>«{r.titulo}» — {ROTULO_SITUACAO[r.situacao] ?? r.situacao} (posição {r.posicao})</li>)}</ul>
                <div className="acoes"><button type="button" className="btn mini menta" onClick={() => adicionar(true)}>Duplicar a prática</button>
                  {escolhidas.length > repetidas.lista.length && <button type="button" className="btn mini" onClick={soAsNovas}>Só as outras</button>}
                  <button type="button" className="btn mini" onClick={() => setRepetidas(null)}>Cancelar</button></div>
              </div>)}</>)}
        </section>
      ) : souAdmin ? (
        <section className="sl-bloco" aria-label="Novo ciclo">
          <h3>Novo ciclo</h3>
          {seletor}
          <button className="btn" disabled={escolhidas.length === 0} onClick={criarCiclo}>Criar ciclo com {escolhidas.length || ''} estação(ões)</button>
        </section>
      ) : <p className="sub">Aguardando o chefe montar o ciclo.</p>}

      <button className="btn mini sl-sair" onClick={sair}>Sair da sala</button>
    </div>
  );
}

/** Cancelar não finaliza: não conta como feita e não gera nota nem feedback; a estação pode ser refeita. */
function CancelarEstacao({ execId, euAvalio, souCandidato, agir, salaId }) {
  const [passo, setPasso] = useState(0);
  const [liberar, setLiberar] = useState(false);
  if (!euAvalio && !souCandidato) return null;
  const confirmar = async () => {
    const r = souCandidato && !euAvalio ? await agir(`/api/salas/${salaId}/candidato/abandonar`) : await agir(`/api/execucoes/${execId}/cancelar`, { liberar_candidato: liberar });
    if (r) setPasso(0);
  };
  return (
    <div className="sl-cancelar" data-testid="cancelar-estacao">
      {passo === 0
        ? <button type="button" className="btn mini" onClick={() => setPasso(1)}>{euAvalio ? 'Cancelar estação…' : 'Abandonar estação…'}</button>
        : (
          <div role="alertdialog" aria-label="Confirmar cancelamento">
            <p><b>{euAvalio ? 'Cancelar esta estação?' : 'Abandonar a estação?'}</b> Ela <u>não</u> conta como feita, não gera nota nem feedback e a fala transcrita é apagada. Poderá ser refeita.{!euAvalio && ' Você passa a observador.'}</p>
            {euAvalio && <label className="sl-op"><input type="checkbox" checked={liberar} onChange={(e) => setLiberar(e.target.checked)} /> Tirar a pessoa do papel de candidato (passa a observador)</label>}
            <div className="acoes"><button type="button" className="btn mini coral" onClick={confirmar}>Sim, {euAvalio ? 'cancelar' : 'abandonar'}</button><button type="button" className="btn mini" onClick={() => setPasso(0)}>Voltar</button></div>
          </div>
        )}
    </div>
  );
}

function Tile({ track, rotulo }) {
  const ref = useRef(null);
  useEffect(() => { if (track && ref.current && track.play) track.play(ref.current); }, [track]);
  return <div className="sl-tile" ref={ref}><span>{rotulo}</span></div>;
}
