// Ciclos de estações: salas permanentes, papéis, fim de estação, pedidos de papel, ciclos pausados.
// O servidor decide tudo (regras no banco); aqui só mostramos o estado que ele nos manda e chamamos as ações.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { chamada, useChamada } from './chamada.js';
import CartasTrilho, { PainelEstacao } from './CartasTrilho.jsx';
import RoteiroAtor from './RoteiroAtor.jsx';
import TextoEstacao from './TextoEstacao.jsx';
import { CartasEstacao, useCartas, TranscricaoCandidato, FalaDoCandidato, Sugestao, AnaliseDaFala, useAoVivo } from './SalaExecucao.jsx';
import ApoioCognitivo, { useFalaLocal } from './ApoioCognitivo.jsx';
import { Autocorrecao, BannerRandomico, ConvidarOnline, LiberarTranscricao } from './SalaExtras.jsx';
import { AcoesUsuario } from './Seguranca.jsx';
import { PainelSalas, ConfigurarSala, SalaChat, Solucionar, PRAZOS } from './SalaPainel.jsx';
import { diagnosticarMidia, midiaDesconectada, mostrarSolucionar } from './midia.js';
import './salas.css';
import Seletor from './Seletor.jsx';

const PAPEL = { admin: 'Chefe', candidato: 'Candidato', observador: 'Observador' };
const PAPEIS_PEDIDO = [['admin', 'Ser o chefe'], ['candidato', 'Ser o candidato']];
const MARCAS = [['sim', 'Sim'], ['parcial', 'Parcial'], ['nao', 'Não']];
const fmt = (s) => `${String(Math.floor(Math.max(0, s) / 60)).padStart(2, '0')}:${String(Math.max(0, Math.floor(s % 60))).padStart(2, '0')}`;
const AREAS = { clinica_medica: 'Clínica Médica', cirurgia: 'Cirurgia', ginecologia_obstetricia: 'Ginecologia e Obstetrícia', pediatria: 'Pediatria', mfc: 'Medicina de Família e Comunidade' };
const pts = (n) => (n === null || n === undefined ? '—' : Number(n).toLocaleString('pt-BR', { maximumFractionDigits: 2 }));
const rotaToken = (id) => `/api/salas/${id}/agora-token`;

/** Relógio que conta desde `inicio` (o relógio é do servidor: quem entra no meio vê o tempo certo). */
const ROTULO_SITUACAO = { na_fila: 'ainda na fila', em_andamento: 'em andamento agora', pausada: 'pausada', finalizada: 'já feita neste ciclo', abandonada: 'cancelada' };

function Relogio({ inicio, limiteMin, pausaSeg = 0 }) {
  const [, forca] = useState(0);
  useEffect(() => { const t = setInterval(() => forca((n) => n + 1), 1000); return () => clearInterval(t); }, []);
  const dec = Math.max(0, (Date.now() - new Date(inicio).getTime()) / 1000 - pausaSeg);   // o tempo em que a estação ficou pausada não conta
  const resta = limiteMin ? limiteMin * 60 - dec : null;
  return <span className={`sl-relogio${resta !== null && resta < 60 ? ' fim' : ''}`} role="timer" aria-label="tempo da estação">{resta !== null ? fmt(resta) : fmt(dec)}</span>;
}

export default function TelaCiclos({ token, usuario, api, sugestao, aoRevisar, aoAnalise }) {
  // a sala fica guardada também fora da aba: quem fechou o app volta e cai na mesma sala (e na mesma estação)
  const [salaId, setSalaId] = useState(() => { try { return sessionStorage.getItem('rv_sala') || localStorage.getItem('rv_sala') || null; } catch { return null; } });
  const [codigo, setCodigo] = useState('');
  const [nomeNova, setNomeNova] = useState('');
  const [prazo, setPrazo] = useState(24);
  const [erro, setErro] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const guardar = (id) => { setSalaId(id); try { if (id) { sessionStorage.setItem('rv_sala', id); localStorage.setItem('rv_sala', id); } else { sessionStorage.removeItem('rv_sala'); localStorage.removeItem('rv_sala'); } } catch { /* sem storage */ } };
  const abrir = async (fn) => { setOcupado(true); setErro(''); try { await fn(); } catch (e) { setErro(e.message); } finally { setOcupado(false); } };
  const criar = () => abrir(async () => { const { id } = await api('/api/salas', { metodo: 'POST', token, corpo: { nome: nomeNova.trim() || undefined, expira_vazia_horas: Number(prazo) } }); await api(`/api/salas/${id}/entrar`, { metodo: 'POST', token }); guardar(id); });
  const entrarEm = (id) => abrir(async () => { await api(`/api/salas/${id}/entrar`, { metodo: 'POST', token }); guardar(id); });
  const entrar = () => entrarEm(codigo.trim());

  if (salaId) return <Sala key={salaId} salaId={salaId} token={token} usuario={usuario} api={api} sugestao={sugestao} aoRevisar={aoRevisar} aoAnalise={aoAnalise} aoSair={() => guardar(null)} />;
  return (
    <div className="tela sl">
      <h2>Salas</h2>
      <p className="sub">Toda sala é aberta: qualquer pessoa entra, sai e volta, e ela segue com tudo em andamento. Ninguém é dono; quem está como chefe é só uma função. A sala vazia é desfeita depois do prazo.</p>
      <PainelSalas api={api} token={token} aoEntrar={entrarEm} desabilitado={ocupado} />
      <section className="sl-bloco" aria-label="Nova sala">
        <h3>Nova sala</h3>
        <label className="campo"><span>Nome da sala</span><input value={nomeNova} onChange={(e) => setNomeNova(e.target.value)} maxLength={60} placeholder="ex.: Treino de sábado" /></label>
        <label className="campo"><span>Desfazer se ficar vazia por</span>
          <Seletor value={prazo} onChange={(e) => setPrazo(e.target.value)}>{PRAZOS.map(([v, r]) => <option key={v} value={v}>{r}</option>)}</Seletor></label>
        <button className="btn" onClick={criar} disabled={ocupado}>Criar sala</button>
        <p className="sub">Os ciclos de estações são criados depois, já dentro da sala.</p>
      </section>
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
  const ch = useChamada();
  const video = { cam: ch.cam, mic: ch.mic, modo: ch.modo, erro: ch.erro };
  const refs = useRef({ socket: null });
  const [tiqueChat, setTiqueChat] = useState(0);
  const [diag, setDiag] = useState(null);
  const [ajudaAberta, setAjudaAberta] = useState(false);
  const [aba, setAba] = useState(null);
  const [painelAberto, setPainelAberto] = useState(true);
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
    // (re)entra na sala no servidor: quem fechou o app ou perdeu a conexão volta ao mesmo ponto; se os dois (chefe e candidato) estiverem
    // aqui de novo, a estação pausada segue sozinha. Se a sala já foi desfeita, o erro aparece e dá para voltar.
    const voltar = () => api(`/api/salas/${salaId}/entrar`, { metodo: 'POST', token }).catch((e) => { if (vivo) setErro(e.message); });
    voltar().then(carregar);
    const socket = io({ auth: { token } });
    refs.current.socket = socket;
    socket.on('connect', async () => { await voltar(); socket.emit('salav2:entrar', { salaId }, () => {}); carregar(); });
    socket.on('sala:estado', (m) => { if (!vivo || !m?.estado) return; setEst(m.estado); if (m.evento === 'chat') setTiqueChat((n) => n + 1); });
    const t = setInterval(carregar, 10000);
    return () => { vivo = false; clearInterval(t); socket.disconnect(); };
  }, [salaId, token, carregar, api]);

  useEffect(() => { api('/api/estacoes', { token }).then(setEstacoes).catch(() => {}); }, [api, token]);

  const meu = est?.meu_papel;
  const exe = est?.execucao;
  const falaLocal = useFalaLocal(exe?.id);                // fala do próprio candidato, guardada só neste navegador (apoio cognitivo)
  const [apoio, setApoio] = useState(false);
  const [notasApoio, setNotasApoio] = useState('');
  const apoioPermitido = est?.sala?.apoio_cognitivo !== false;
  useEffect(() => { if (!apoioPermitido) setApoio(false); }, [apoioPermitido]);
  useEffect(() => { setNotasApoio(''); if (!exe) setApoio(false); }, [exe?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const ciclo = est?.ciclo;
  const euEAvaliador = Boolean(est?.participantes?.find((p) => p.usuario_id === eu)?.e_avaliador);
  // consistência de mídia: UMA verificação automática depois da inversão de papéis ou da troca de chefe/avaliador
  const chaveFuncao = est ? `${meu}|${est.sala.admin_id}|${euEAvaliador}` : null;
  const funcaoAnterior = useRef(null);
  const videoAtual = useRef(video); videoAtual.current = video;
  useEffect(() => {
    if (!chaveFuncao) return;
    const mudou = funcaoAnterior.current !== null && funcaoAnterior.current !== chaveFuncao;
    funcaoAnterior.current = chaveFuncao;
    if (!mudou || !(meu === 'candidato' || meu === 'admin' || euEAvaliador)) return;
    if (!midiaDesconectada(videoAtual.current)) return;       // já está tudo ligado: nada a conferir
    let vivo = true;
    (async () => {
      const d = await diagnosticarMidia();
      if (!vivo) return;
      setDiag(d);
      const livre = d.camera === 'ok' && d.microfone === 'ok';
      if (livre) await religarMidia(); else setAjudaAberta(true);   // o navegador permite → liga; senão mostra o que fazer
    })();
    return () => { vivo = false; };
  }, [chaveFuncao]); // eslint-disable-line react-hooks/exhaustive-deps
  const euAvalio = Boolean(exe && (exe.avaliador_id === eu || est?.sala.admin_id === eu));

  const aoVivo = useAoVivo({ execId: exe?.id, ativo: Boolean(exe && euAvalio), api, token });
  const cartas = useCartas({ execId: exe?.id, api, token });
  useEffect(() => { if (exe?.id) setPainelAberto(true); }, [exe?.id]);   // estação começou: o painel abre sozinho
  // terminou a estação: a lateral mostra o resultado
  useEffect(() => { if (!exe && ultima) setAba((a) => a ?? 'resultado'); }, [exe?.id, ultima?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  // o Epi oferece os próximos passos a quem fez ou avaliou a estação (uma vez por estação)
  const avisado = useRef(null);
  useEffect(() => {
    if (!ultima || exe || avisado.current === ultima.id) return;
    if (meu !== 'candidato' && !euAvaliou(ultima, est, eu)) return;
    avisado.current = ultima.id;
    dispatchEvent(new CustomEvent('rv-epi', { detail: { evento: 'fim-estacao', execId: ultima.id, titulo: ultima.titulo } }));
  }, [ultima?.id, exe?.id]); // eslint-disable-line react-hooks/exhaustive-deps

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

  // vídeo da sala: a chamada vive fora da janela (chamada.js); fechar ou minimizar a janela não derruba o vídeo,
  // que passa para miniaturas flutuantes. Só "Sair da sala" encerra.
  const tiles = ch.salaId === salaId ? ch.tiles : {};
  const ligarVideo = () => chamada.ligar({ salaId, token, rotaToken, nomeSala: est?.sala?.nome || 'Sala' });
  const salaPronta = Boolean(est);
  useEffect(() => { if (salaPronta) ligarVideo(); }, [salaPronta]); // eslint-disable-line react-hooks/exhaustive-deps
  const minhaPausa = est?.participantes?.find((p) => p.usuario_id === eu)?.video_pausado;
  useEffect(() => { if (minhaPausa !== undefined) chamada.sincronizar(); }, [minhaPausa]);
  const alternar = async (que) => { if (ch.salaId !== salaId) await ligarVideo(); await chamada.alternar(que); };
  const verificarMidia = async () => { const d = await diagnosticarMidia(); setDiag(d); return d; };
  const religarMidia = async () => { if (ch.salaId !== salaId) { await ligarVideo(); return; } await chamada.religar(); };

  const sair = async () => { try { await api(`/api/salas/${salaId}/sair`, { metodo: 'POST', token }); } catch { /* sai assim mesmo */ } await chamada.sair(); aoSair(); };

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
  // candidato em estação: a tela mostra SÓ a estação (vídeo, relógio, cartas, fala, apoio); gestão, chat e fila ficam ocultos
  const modoCandidato = meu === 'candidato' && emAndamento && exe.candidato_id === eu;
  const pausadaPorSaida = est.ciclos_pausados.filter((c) => c.execucao_pausada && c.motivo === 'saida');
  const chefeAusente = !est.participantes.some((p) => p.usuario_id === est.sala.admin_id);
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

  const pedidosPendentes = est.solicitacoes.filter((x) => x.solicitante_id !== eu).length;
  const souCand = meu === 'candidato' && emAndamento && exe.candidato_id === eu;
  // abas da lateral (estilo Zoom): só as que o papel e o momento permitem
  const ABAS = [
    ...(!modoCandidato ? [['pessoas', '👥', `Pessoas (${est.participantes.length})`, pedidosPendentes && souAdmin ? pedidosPendentes : 0], ['chat', '💬', 'Chat', 0]] : []),
    ...(!modoCandidato && (ciclo || souAdmin) ? [['ciclo', '🔁', ciclo ? 'Ciclo' : 'Novo ciclo', 0]] : []),
    ...(!emAndamento && ultima && ciclo && !modoCandidato ? [['resultado', '🏁', 'Resultado', 0]] : []),
    ...(souAdmin && !modoCandidato ? [['config', '⚙️', 'Sala', 0]] : []),
    ...(mostrarSolucionar({ papel: meu, eAvaliador: euEAvaliador, video }) ? [['midia', '🛠️', 'Câmera e áudio', 0]] : []),
  ];
  const abaAtual = ABAS.some(([id]) => id === aba) ? aba : null;
  const galeria = Object.entries(tiles);

  const conteudoAba = {
    pessoas: (
      <>
        {est.participantes.map((p) => (
          <div key={p.usuario_id} className="sl-linha">
            <span>{p.nome}{p.usuario_id === eu && ' (você)'} <em className={`sl-papel p-${p.papel}`}>{PAPEL[p.papel]}{p.e_avaliador && p.papel !== 'admin' ? ' · avalia' : ''}</em>{p.video_pausado && <em className="sl-mudo"> vídeo pausado</em>}</span>
            {p.usuario_id !== eu && <AcoesUsuario usuarioId={p.usuario_id} nome={p.nome} api={api} token={token} salaId={salaId} aoFeito={carregar} />}
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
        {chefeAusente && !emAndamento && meu !== 'admin' && <div className="acoes"><button type="button" className="btn mini menta" data-testid="assumir-chefe" onClick={() => agir(`/api/salas/${salaId}/assumir-chefe`)}>O chefe saiu: assumir a chefia</button></div>}
        {minhaSolicitacao && <div className="sl-linha"><span>Seu pedido ({PAPEL[minhaSolicitacao.papel]}) aguarda resposta.</span><button className="btn mini" onClick={() => agir(`/api/solicitacoes/${minhaSolicitacao.id}/cancelar`)}>Cancelar</button></div>}
        {pedidosPendentes > 0 && meu === 'admin' && (
          <div id="sl-pedidos"><h4>Pedidos de papel</h4>
            {est.solicitacoes.filter((x) => x.solicitante_id !== eu).map((x) => (
              <div key={x.id} className="sl-linha"><span>{x.nome} quer ser {PAPEL[x.papel]?.toLowerCase()}</span>
                <span className="acoes"><button className="btn mini menta" onClick={() => agir(`/api/solicitacoes/${x.id}/decidir`, { aceitar: true })}>Aceitar</button><button className="btn mini" onClick={() => agir(`/api/solicitacoes/${x.id}/decidir`, { aceitar: false })}>Recusar</button></span></div>
            ))}
          </div>
        )}
      </>
    ),
    chat: <SalaChat salaId={salaId} api={api} token={token} eu={eu} tique={tiqueChat} />,
    config: (
      <>
        <ConfigurarSala sala={est.sala} api={api} token={token} aoSalvar={carregar} />
        <label className="sl-op"><input type="checkbox" data-testid="opcao-apoio" checked={est.sala.apoio_cognitivo !== false} onChange={(e) => agir(`/api/salas/${salaId}/apoio-cognitivo`, { liberado: e.target.checked }, 'PATCH')} /> Permitir o apoio cognitivo (grafo da conduta) ao candidato</label>
        <label className="sl-op"><input type="checkbox" checked={est.sala.audio_observadores} onChange={(e) => agir(`/api/salas/${salaId}/audio-observadores`, { liberado: e.target.checked }, 'PATCH')} /> Liberar áudio dos observadores</label>
        <button type="button" className="btn mini" onClick={() => { navigator.clipboard?.writeText(salaId); setAviso('Código da sala copiado.'); }}>Copiar o código da sala</button>
      </>
    ),
    midia: <Solucionar resultado={diag} aoVerificar={verificarMidia} aoReligar={religarMidia} aberto setAberto={setAjudaAberta} />,
    resultado: ultima && ciclo ? (
      <div className="sl-fim" id="sl-fim" data-testid="fim-estacao">
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
        ) : (
          <>
            <p className="sub">Aguardando o chefe decidir o próximo passo. O vídeo continua aberto.</p>
            {meu === 'candidato' && <div className="acoes"><button className="btn mini" data-testid="inverter-candidato" onClick={() => agir(`/api/ciclos/${ciclo.id}/proximo`, { acao: 'inverter' })}>Inverter papéis</button></div>}
          </>
        )}
        {(meu === 'candidato' || euAvaliou(ultima, est, eu)) && <Autocorrecao key={ultima.id} execId={ultima.id} api={api} token={token} aoAdotar={async () => { await carregar(); try { const r = await api(`/api/salas/${salaId}/ultima-execucao`, { token }); setUltima(r.ultima ?? null); } catch { /* mantém */ } }} />}
        {euAvaliou(ultima, est, eu) && <LiberarTranscricao key={`lib-${ultima.id}`} execId={ultima.id} api={api} token={token} />}
        {aoAnalise && (meu === 'candidato' || euAvaliou(ultima, est, eu)) && <button className="btn mini menta" onClick={() => aoAnalise(ultima.id)}>Ver análise completa da estação</button>}
        {meu === 'candidato' && aoRevisar && <button className="btn mini menta" onClick={aoRevisar}>Registrar o que faltou (revisão)</button>}
      </div>
    ) : null,
    ciclo: (
      <>
        {est.ciclos_pausados.length > 0 && est.ciclos_pausados.map((c) => (
          <div key={c.ciclo_id} className="sl-linha">
            <span>{c.execucao_pausada ? 'Estação pausada' : 'Ciclo pausado'} · {c.motivo ?? 'troca de papéis'}</span>
            <button className="btn mini menta" onClick={() => agir(`/api/ciclos/${c.ciclo_id}/retomar`)}>Retomar</button>
          </div>
        ))}
        <BannerRandomico salaId={salaId} api={api} token={token} versao={est?.sala?.versao} souAdmin={souAdmin} podeSeguir={souAdmin && !emAndamento && Boolean(ultima)} aoMudou={carregar} />
        {ciclo ? (
          <div id="sl-fila">
            {fila.length === 0 && <p className="sub">Nenhuma estação visível ainda.</p>}
            {fila.map((i) => (
              <div key={i.id} className="sl-linha" data-estado={i.estado}>
                <span>{i.posicao}. {meu === 'candidato' && ['pendente', 'em_andamento'].includes(i.estado) ? 'Estação surpresa' : i.titulo}{i.grupo && <em> · {i.grupo}</em>} <em className={`sl-est e-${i.estado}`}>{i.estado.replace('_', ' ')}</em></span>
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
          </div>
        ) : souAdmin ? (
          <>{seletor}<button className="btn" disabled={escolhidas.length === 0} onClick={criarCiclo}>Criar ciclo com {escolhidas.length || ''} estação(ões)</button></>
        ) : <p className="sub">Aguardando o chefe montar o ciclo.</p>}
      </>
    ),
  };

  return (
    <div className={`tela sl sl-zoom${abaAtual ? ' com-lateral' : ''}`} data-testid="sala-zoom">
      <div className="sl-principal">
        <header className="sl-cab">
          <div className="sl-cab-nome"><h2 data-testid="nome-sala">{est.sala.nome || 'Sala'}</h2>{!modoCandidato && <button className="sl-cod" onClick={() => { navigator.clipboard?.writeText(salaId); setAviso('Código da sala copiado.'); }} title="Copiar código">copiar código</button>}</div>
          {emAndamento && <Relogio inicio={exe.iniciada_em} pausaSeg={exe.pausa_seg ?? 0} limiteMin={pep?.duracao_min} />}
          <span className={`sl-papel p-${meu}`} data-testid="meu-papel">{PAPEL[meu] ?? meu}</span>
        </header>
        {aviso && <p className="aviso" role="alert">{aviso}</p>}
        {pausadaPorSaida.length > 0 && (
          <p className="sl-pausa-aviso" role="status" data-testid="pausa-aviso"><b>Estação pausada.</b> Ela segue sozinha quando o chefe e o candidato estiverem conectados ao mesmo tempo.{chefeAusente ? ' O chefe não está na sala.' : ''}</p>
        )}
        <section className={`sl-palco n-${Math.min(galeria.length, 4)}`} id="sl-video" aria-label="Vídeo" ref={(el) => chamada.definirPalco(el)}>
          {galeria.map(([uid, t]) => <Tile key={`${uid}-${ch.visao}`} track={ch.visao === 'palco' ? t.track : null} rotulo={t.local ? 'Você' : 'Participante'} />)}
          {galeria.length === 0 && <div className="sl-palco-vazio"><span aria-hidden="true">🎥</span><p>{video.modo === 'demo' ? 'Modo demonstração: sem vídeo real neste servidor.' : 'Ligue a câmera para aparecer aqui.'}</p></div>}
          {video.erro && <p className="aviso sl-palco-erro">{video.erro}</p>}
        </section>
        <nav className="sl-zbarra" aria-label="Controles da sala">
          <button type="button" className={`zb${video.mic ? '' : ' off'}`} data-testid="botao-mic" aria-pressed={video.mic} onClick={() => alternar('mic')}><span aria-hidden="true">{video.mic ? '🎙️' : '🔇'}</span><small>{video.mic ? 'Mudo' : 'Áudio'}</small></button>
          <button type="button" className={`zb${video.cam ? '' : ' off'}`} data-testid="botao-camera" aria-pressed={video.cam} onClick={() => alternar('cam')}><span aria-hidden="true">{video.cam ? '📹' : '🚫'}</span><small>{video.cam ? 'Parar vídeo' : 'Vídeo'}</small></button>
          {emAndamento && <button type="button" className={`zb${painelAberto ? ' on' : ''}`} onClick={() => setPainelAberto((v) => !v)} data-testid="botao-painel"><span aria-hidden="true">📋</span><small>Estação</small></button>}
          <i className="zb-sep" />
          {ABAS.map(([id, ic, rot, n]) => (
            <button key={id} type="button" className={`zb${abaAtual === id ? ' on' : ''}`} onClick={() => setAba(abaAtual === id ? null : id)} aria-pressed={abaAtual === id}>
              <span aria-hidden="true">{ic}</span><small>{rot}</small>{n > 0 && <b className="zb-n">{n}</b>}
            </button>
          ))}
          <i className="zb-sep" />
          {!modoCandidato && <button type="button" className="zb sair" onClick={sair}><span aria-hidden="true">🚪</span><small>Sair</small></button>}
        </nav>
      </div>

      {abaAtual && (
        <aside className="sl-lateral" aria-label={ABAS.find(([id]) => id === abaAtual)?.[2]}>
          <header><b>{ABAS.find(([id]) => id === abaAtual)?.[2]}</b><button type="button" onClick={() => setAba(null)} aria-label="Fechar">×</button></header>
          <div className="sl-lateral-corpo" id={`sl-${abaAtual === 'pessoas' ? 'participantes' : abaAtual}`}>{conteudoAba[abaAtual]}</div>
        </aside>
      )}

      {emAndamento && (
        <>
          <CartasTrilho dados={cartas.dados} />
          <PainelEstacao aberto={painelAberto} aoAlternar={() => setPainelAberto((v) => !v)}
            titulo={souCand ? 'Estação em andamento' : exe.titulo} subtitulo={`Candidato: ${nome(exe.candidato_id)} · Avalia: ${nome(exe.avaliador_id)}`}
            extra={<Relogio inicio={exe.iniciada_em} pausaSeg={exe.pausa_seg ?? 0} limiteMin={pep?.duracao_min} />}>
            <div id="sl-estacao" className="sl-exec">
              {euAvalio && <CartasEstacao cartas={cartas} papel="avaliador" segmentos={aoVivo.segmentos} />}
              <span id="sl-transcricao" />
              {souCand && <TranscricaoCandidato execId={exe.id} api={api} token={token} aoFala={falaLocal.registrar} />}
              {apoioPermitido && souCand && (
                <div className="ap-abrir" data-testid="apoio-oferta"><span className="sub">Quer uma ajuda visual? O apoio cognitivo monta, ao vivo, o grafo da conduta a partir do que você fala.</span>
                  <button type="button" className="btn mini menta" aria-pressed={apoio} onClick={() => setApoio((v) => !v)} data-testid="abrir-apoio">{apoio ? 'Fechar apoio cognitivo' : 'Abrir apoio cognitivo'}</button></div>)}
              {euAvalio && <FalaDoCandidato segmentos={aoVivo.segmentos} info={aoVivo.info} aoAnalisar={aoVivo.analisar} />}
              {euAvalio && <AnaliseDaFala info={aoVivo.info} />}
              {euAvalio && pep && (
                <>
                  <span id="sl-checklist" />
                  {pep.script_ator && <RoteiroAtor corpo={pep.script_ator} />}
                  <h4 className="pe-sec">Checklist do PEP</h4>
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
              <CancelarEstacao execId={exe.id} euAvalio={euAvalio} souCandidato={souCand} agir={agir} salaId={salaId} />
              {!euAvalio && <p className="sub">{meu === 'candidato' ? 'Conduza o atendimento. Os cartões liberados aparecem à direita da tela; toque para abrir e arrastar.' : 'Acompanhe em silêncio.'}</p>}
            </div>
          </PainelEstacao>
          {apoio && apoioPermitido && souCand && <ApoioCognitivo fala={falaLocal.fala} inicio={exe.iniciada_em} anotacoes={notasApoio} aoAnotar={setNotasApoio} aoFechar={() => setApoio(false)} />}
        </>
      )}
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
