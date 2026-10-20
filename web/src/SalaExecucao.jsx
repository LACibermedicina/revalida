// Peças da estação em andamento: cartas (descrição e cenário já na abertura, materiais liberados pelo avaliador),
// transcrição da fala do candidato e acompanhamento do avaliador (fala transcrita + sugestões de correção do PEP).
// Nada daqui altera a nota: as sugestões só ajudam o avaliador, que continua marcando o checklist.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { criarTranscritor, podeTranscrever } from './transcricao.js';
import { detectarPedidos } from './pedidos.js';

const TIPO_CARTA = { laboratorial: 'Exame laboratorial', imagem: 'Imagem', biopsia: 'Biópsia', laudo: 'Laudo', outro: 'Material' };
const SUGESTAO = { sim: 'Sim', parcial: 'Parcial', nao: 'Não' };
const lerConsentimento = () => { try { return localStorage.getItem('rv_transcricao_ok') === '1'; } catch { return false; } };
const guardarConsentimento = () => { try { localStorage.setItem('rv_transcricao_ok', '1'); } catch { /* sem storage */ } };

/** Fala transcrita e sugestões da análise ao vivo (só para quem avalia). Para sozinho quando a estação acaba (`ativo` = false). */
export function useAoVivo({ execId, ativo, api, token, intervaloMs = 4000, analiseMs = 20000 }) {
  const [segmentos, setSegmentos] = useState([]);
  const [sugestoes, setSugestoes] = useState({});
  const [info, setInfo] = useState({ fonte: null, aviso: '', ocupado: false, em: null });
  const ref = useRef({ analisados: 0, ocupado: false, segs: 0 });

  const analisar = useCallback(async () => {
    if (!execId || ref.current.ocupado) return;
    ref.current.ocupado = true; setInfo((i) => ({ ...i, ocupado: true }));
    try {
      const r = await api(`/api/execucoes/${execId}/analise-ao-vivo`, { metodo: 'POST', token });
      ref.current.analisados = r.segmentos ?? 0;
      setSugestoes(Object.fromEntries((r.itens ?? []).map((x) => [x.pep_item_id, x])));
      setInfo({ fonte: r.fonte, aviso: r.aviso ?? '', ocupado: false, em: Date.now() });
    } catch (e) { setInfo((i) => ({ ...i, ocupado: false, aviso: e.codigo === 'AGUARDE' ? i.aviso : e.message })); }
    finally { ref.current.ocupado = false; }
  }, [api, token, execId]);

  useEffect(() => {
    setSegmentos([]); setSugestoes({}); setInfo({ fonte: null, aviso: '', ocupado: false, em: null }); ref.current = { analisados: 0, ocupado: false, segs: 0 };
    if (!ativo || !execId) return undefined;
    let vivo = true;
    const buscar = () => api(`/api/execucoes/${execId}/transcricao`, { token }).then((r) => { if (vivo) { setSegmentos(r.segmentos); ref.current.segs = r.segmentos.length; } }).catch(() => {});
    buscar();
    const t1 = setInterval(buscar, intervaloMs);
    const t2 = setInterval(() => { if (ref.current.segs > ref.current.analisados) analisar(); }, analiseMs);   // só reanalisa se a fala cresceu
    return () => { vivo = false; clearInterval(t1); clearInterval(t2); };
  }, [execId, ativo, api, token, intervaloMs, analiseMs, analisar]);

  return { segmentos, sugestoes, info, analisar };
}

/** Descrição da estação, cenário e materiais liberados. O avaliador vê todos e libera; os demais só o já liberado. */
export function CartasEstacao({ execId, papel, api, token, segmentos = [], versao = 0 }) {
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState('');
  const carregar = useCallback(() => api(`/api/execucoes/${execId}/cartas`, { token }).then((d) => { setDados(d); setErro(''); }).catch((e) => setErro(e.message)), [api, token, execId]);
  useEffect(() => { setDados(null); carregar(); const t = setInterval(carregar, 5000); return () => clearInterval(t); }, [carregar, versao]);
  const liberar = async (mid) => {
    try { await api(`/api/execucoes/${execId}/cartas/${mid}/liberar`, { metodo: 'POST', token }); await carregar(); } catch (e) { setErro(e.message); }
  };
  const pedidos = useMemo(() => new Set(dados && papel === 'avaliador' ? detectarPedidos(segmentos, dados.materiais) : []), [dados, papel, segmentos]);
  if (!dados) return erro ? <p className="aviso" role="alert">{erro}</p> : null;
  const avaliador = dados.papel === 'avaliador';
  return (
    <div className="sl-cartas" aria-label="Cartas da estação" data-testid="cartas">
      {erro && <p className="aviso" role="alert">{erro}</p>}
      {dados.iniciais.map((c) => (
        <article key={c.tipo} className={`sl-carta ini c-${c.tipo}`} data-carta={c.tipo}><h4>{c.titulo}</h4><p>{c.corpo}</p></article>
      ))}
      {dados.materiais.map((m) => (
        <article key={m.id} className={`sl-carta mat${m.liberado ? ' lib' : ''}`} data-carta="material" data-liberado={m.liberado ? '1' : '0'}>
          <h4>{m.titulo} <em>{TIPO_CARTA[m.tipo] ?? 'Material'}</em></h4>
          {m.liberado || avaliador ? <p className={m.liberado ? '' : 'sl-bloq'}>{m.conteudo}</p> : null}
          {avaliador && (
            <div className="sl-carta-acoes">
              <span className="sub">Libera quando pedirem: “{m.gatilho}”</span>
              {pedidos.has(m.id) && <strong className="sl-dica" role="status">Pedido detectado na fala</strong>}
              {m.liberado ? <em className="sl-ok">Liberada</em> : <button type="button" className="btn mini menta" onClick={() => liberar(m.id)}>Liberar ao candidato</button>}
            </div>
          )}
        </article>
      ))}
      {!avaliador && dados.materiais.length === 0 && <p className="sub">Exames e outros dados aparecem aqui quando o avaliador liberar.</p>}
    </div>
  );
}

/** Controle da transcrição do candidato: precisa do microfone e do consentimento; para sozinho quando a estação termina. */
export function TranscricaoCandidato({ execId, api, token }) {
  const [estado, setEstado] = useState('parada');
  const [fala, setFala] = useState({ texto: '', parcial: false });
  const tr = useRef(null);
  const possivel = podeTranscrever();

  useEffect(() => {
    const t = criarTranscritor({
      enviarTexto: (texto, inicio_ms) => api(`/api/execucoes/${execId}/transcricao`, { metodo: 'POST', token, corpo: { texto, inicio_ms } }),
      enviarAudio: (mime, base64) => api(`/api/execucoes/${execId}/audio`, { metodo: 'POST', token, corpo: { mime, base64 } }),
      aoEstado: setEstado, aoTexto: (texto, parcial) => setFala({ texto, parcial }),
    });
    tr.current = t;
    if (possivel && lerConsentimento()) t.iniciar();       // já autorizou antes: começa junto com a estação
    return () => { t.parar(false); };                      // a estação terminou (ou a pessoa saiu): a transcrição para
  }, [execId, api, token, possivel]);

  const iniciar = () => { guardarConsentimento(); tr.current?.iniciar(); };
  const rotulo = { ouvindo: 'Transcrevendo a sua fala', parada: 'Transcrição parada', negado: 'Microfone bloqueado: libere nas permissões do navegador', encerrada: 'Estação encerrada: a transcrição parou', erro: 'Não foi possível transcrever agora' }[estado];
  return (
    <div className="sl-transc" data-testid="transcricao-candidato" data-estado={estado}>
      <span className={`sl-led ${estado}`} aria-hidden="true" />
      <span role="status">{possivel ? rotulo : 'Este navegador não consegue transcrever a fala.'}</span>
      {possivel && estado !== 'ouvindo' && estado !== 'encerrada' && <button type="button" className="btn mini menta" onClick={iniciar}>Iniciar transcrição</button>}
      {possivel && estado === 'ouvindo' && <button type="button" className="btn mini" onClick={() => tr.current?.parar()}>Parar</button>}
      {fala.texto && estado === 'ouvindo' && <p className={`sub sl-fala${fala.parcial ? ' parcial' : ''}`}>{fala.texto}</p>}
      <p className="sub">Só a sua voz é transcrita, apenas durante a estação, para conferir o que foi dito com o checklist.</p>
    </div>
  );
}

/** Painel do avaliador: fala transcrita e botão de análise. As sugestões por item aparecem junto do checklist (ver `Sugestao`). */
export function FalaDoCandidato({ segmentos, info, aoAnalisar }) {
  return (
    <details className="sl-fala-av" data-testid="fala-candidato" open>
      <summary>Fala do candidato ({segmentos.length} trecho{segmentos.length === 1 ? '' : 's'})</summary>
      {segmentos.length === 0 ? <p className="sub">Nada transcrito ainda.</p> : <ol>{segmentos.slice(-8).map((s) => <li key={s.ordem}>{s.texto}</li>)}</ol>}
      <div className="acoes">
        <button type="button" className="btn mini" disabled={info.ocupado || segmentos.length === 0} onClick={aoAnalisar}>{info.ocupado ? 'Analisando…' : 'Conferir o PEP pela fala'}</button>
        {info.fonte && <span className="sub">Sugestões por {info.fonte === 'ia' ? 'IA' : 'palavras do item (sem IA)'}; a nota é sua.</span>}
      </div>
      {info.aviso && <p className="sub" role="note">{info.aviso}</p>}
    </details>
  );
}

export function Sugestao({ s, aoUsar }) {
  if (!s) return null;
  return (
    <span className={`sl-sug r-${s.resultado}${s.confiavel === false ? ' fraca' : ''}`} data-testid="sugestao">
      Fala sugere: <b>{SUGESTAO[s.resultado]}</b>{s.evidencia ? <> · “{s.evidencia}”</> : null}
      {s.confiavel !== false && <button type="button" className="ln" onClick={() => aoUsar(s.resultado)}>usar</button>}
    </span>
  );
}
