// Epi, o assistente: sempre por perto (na mesa, é o próprio Epi; no menu clássico, a cabecinha no canto). Explica a tela
// em evidência e o passo a passo, responde perguntas (texto ou voz), sugere o próximo passo da conduta quando o microfone
// está ligado numa estação e, no fim de uma estação, oferece os caminhos (revisar o tema, criar cartões…): cada caminho
// tem o atalho direto e o "me mostre como", que destaca onde ele fica no app. O botão de mudo, ao lado do Epi quando
// há um painel aberto, silencia tudo o que ele faria sozinho.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Holofote from './Holofote.jsx';
import { Icone } from './Icones.jsx';
import { TELAS } from './useMesa.js';
import { GUIA, DEPOIS_DA_ESTACAO, caminhoAte } from './guiaEpi.js';

const lerMudo = () => { try { return localStorage.getItem('rv_epi_mudo') === '1'; } catch { return false; } };
const hoje = () => new Date().toISOString().slice(0, 10);
const jaVistas = () => { try { const v = JSON.parse(localStorage.getItem('rv_epi_vistas')) || {}; return v.dia === hoje() ? v : { dia: hoje(), telas: [] }; } catch { return { dia: hoje(), telas: [] }; } };
const Reconhecimento = typeof window !== 'undefined' ? (window.SpeechRecognition || window.webkitSpeechRecognition) : null;

/** Posição do balão: ao lado do Epi da mesa (se houver) ou acima da cabecinha do canto. */
function useAncora(mesa, aberto) {
  const [r, setR] = useState(null);
  useEffect(() => {
    if (!aberto) return undefined;
    const medir = () => {
      const el = mesa ? document.querySelector('[data-testid=epi-mesa]') : document.querySelector('.epi-canto');
      if (el) { const b = el.getBoundingClientRect(); setR({ x: b.left, y: b.top, w: b.width, h: b.height }); }
    };
    medir(); const t = setInterval(medir, 500);
    return () => clearInterval(t);
  }, [mesa, aberto]);
  return r;
}

export default function EpiAssistente({ tela, mesa, temPainel, irPara, api, token, tema }) {
  const [aberto, setAberto] = useState(false);
  const [mudo, setMudo] = useState(lerMudo);
  const [modo, setModo] = useState('guia');            // guia | fim | escolha | resposta
  const [escolha, setEscolha] = useState(null);         // opção escolhida depois da estação
  const [resp, setResp] = useState(null);
  const [pergunta, setPergunta] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState('');
  const [tour, setTour] = useState(null);
  const [ouvindo, setOuvindo] = useState(false);
  const rec = useRef(null); const fala = useRef(''); const ultimaSug = useRef(0);
  const ancora = useAncora(mesa, aberto);
  const telaGuia = GUIA[tela] ? tela : 'painel';
  const g = GUIA[telaGuia];

  const alternarMudo = () => { const n = !mudo; setMudo(n); try { localStorage.setItem('rv_epi_mudo', n ? '1' : '0'); } catch { /* ok */ } if (n) { setAberto(false); pararMic(); } };

  // tocar no Epi abre/fecha o balão
  useEffect(() => {
    const f = () => { setAberto((a) => !a); setModo((m) => (m === 'fim' || m === 'escolha' ? m : 'guia')); };
    addEventListener('rv-epi-alternar', f); return () => removeEventListener('rv-epi-alternar', f);
  }, []);
  // primeira vez que a tela aparece hoje: o Epi explica sozinho (a não ser que esteja no mudo)
  useEffect(() => {
    if (mudo || !tela || !GUIA[tela]) return;
    const v = jaVistas();
    if (v.telas.includes(tela)) return;
    try { localStorage.setItem('rv_epi_vistas', JSON.stringify({ dia: v.dia, telas: [...v.telas, tela] })); } catch { /* ok */ }
    setModo('guia'); setResp(null); setAberto(true);
  }, [tela, mudo]);
  // fim de uma estação: o Epi oferece os caminhos
  useEffect(() => {
    const f = (e) => { if (e.detail?.evento !== 'fim-estacao' || lerMudo()) return; setModo('fim'); setEscolha(null); setAberto(true); };
    addEventListener('rv-epi', f); return () => removeEventListener('rv-epi', f);
  }, []);

  const perguntar = useCallback(async (texto, opcoes = {}) => {
    setOcupado(true); setErro('');
    try {
      const r = await api('/api/epi/perguntar', { metodo: 'POST', token, corpo: { pergunta: texto, tela: telaGuia, tema, ...opcoes } });
      setResp(r); setModo('resposta'); setAberto(true);
    } catch (e) { setErro(e.message); setAberto(true); } finally { setOcupado(false); }
  }, [api, token, telaGuia, tema]);

  // microfone: em estação (sala ou prática com IA), ouve e sugere o próximo passo; fora dela, a fala vira pergunta
  const emEstacao = tela === 'ciclos' || tela === 'solo';
  const pararMic = () => { try { rec.current?.stop(); } catch { /* ok */ } rec.current = null; setOuvindo(false); };
  const ligarMic = () => {
    if (!Reconhecimento) { setErro('Este navegador não reconhece voz. Use o Chrome ou o Edge, ou digite a pergunta.'); setAberto(true); return; }
    const r = new Reconhecimento(); r.lang = 'pt-BR'; r.continuous = true; r.interimResults = false;
    r.onresult = (ev) => {
      const t = [...ev.results].slice(ev.resultIndex).filter((x) => x.isFinal).map((x) => x[0].transcript).join(' ').trim();
      if (!t) return;
      if (!emEstacao) { pararMic(); setPergunta(t); perguntar(t); return; }
      fala.current = `${fala.current} ${t}`.slice(-1500);
      if (!mudo && Date.now() - ultimaSug.current > 25000 && fala.current.length > 80) { ultimaSug.current = Date.now(); perguntar('', { modo: 'conduta', fala: fala.current }); }
    };
    r.onend = () => { if (rec.current === r && emEstacao) { try { r.start(); } catch { setOuvindo(false); } } else setOuvindo(false); };
    r.onerror = (e) => { if (e.error === 'not-allowed') setErro('O navegador bloqueou o microfone. Libere nas permissões do site.'); };
    rec.current = r; fala.current = ''; ultimaSug.current = Date.now();
    try { r.start(); setOuvindo(true); } catch { setOuvindo(false); }
  };
  useEffect(() => () => pararMic(), []); // eslint-disable-line react-hooks/exhaustive-deps

  const mostrarComo = (destino, _aba, dentro = []) => { setAberto(false); setTour(caminhoAte(destino, { mesa, dentro })); };
  const abrirDireto = (destino, aba) => { setAberto(false); irPara(destino, aba); };

  const atalho = (t, aba, dentro) => (
    <div key={`${t}-${aba ?? ''}`} className="epi-atalho">
      <button type="button" className="epi-atalho-ic" onClick={() => abrirDireto(t, aba)} title={`Abrir ${TELAS[t]?.[0] ?? t}`}>
        <Icone nome={TELAS[t]?.[1] ?? 'inicio'} /><span>{TELAS[t]?.[0] ?? t}</span>
      </button>
      <button type="button" className="epi-como" onClick={() => mostrarComo(t, aba, dentro)}>me mostre como</button>
    </div>
  );

  const pos = ancora
    ? (mesa
      ? { left: Math.max(12, Math.min(ancora.x - 340, innerWidth - 352)), top: Math.max(76, Math.min(ancora.y - 40, innerHeight - 580)) }
      : { right: 18, bottom: 108 })
    : { right: 18, bottom: 108 };

  return (
    <>
      {!mesa && (
        <button type="button" className="epi-canto" onClick={() => setAberto((a) => !a)} aria-label="Epi, o assistente" title="Epi: pergunte ou peça ajuda" data-testid="epi-canto">
          <img src="/marca/avatar.png" alt="" width="56" height="56" />
        </button>
      )}
      {temPainel && (
        <button type="button" className={`epi-mudo${mudo ? ' on' : ''}${mesa ? ' na-mesa' : ''}`} onClick={alternarMudo} aria-pressed={mudo} data-testid="epi-mudo"
          title={mudo ? 'Epi silenciado: toque para ele voltar a ajudar' : 'Silenciar o Epi'} style={mesa && ancora ? { left: ancora.x - 6, top: ancora.y - 6 } : undefined}>
          {mudo ? '🔕' : '🔔'}
        </button>
      )}
      {aberto && createPortal(
        <section className="epi-balao" style={pos} role="dialog" aria-label="Epi, o assistente" data-testid="epi-balao">
          <header>
            <span className="epi-nome">Epi</span>
            <button type="button" className="epi-x" onClick={() => setAberto(false)} aria-label="Fechar">×</button>
          </header>
          <div className="epi-corpo">
            {modo === 'guia' && (
              <>
                <p className="epi-tit">{g.titulo}</p>
                <p>{g.faz}</p>
                {g.passos.length > 0 && <ol className="epi-passos">{g.passos.map((p) => <li key={p}>{p}</li>)}</ol>}
                {g.atalhos.length > 0 && <><p className="epi-sub">Atalhos</p><div className="epi-atalhos">{g.atalhos.map((t) => atalho(t))}</div></>}
              </>
            )}
            {modo === 'fim' && (
              <>
                <p className="epi-tit">Estação concluída! 🎉</p>
                <p>O que você quer fazer agora?</p>
                <div className="epi-opcoes">{DEPOIS_DA_ESTACAO.map((o) => <button key={o.id} type="button" className="epi-opcao" onClick={() => { setEscolha(o); setModo('escolha'); }}>{o.rotulo}</button>)}</div>
              </>
            )}
            {modo === 'escolha' && escolha && (
              <>
                <p className="epi-tit">{escolha.rotulo}</p>
                <p>Aqui está o atalho direto. Se quiser aprender onde ele fica no app (para não precisar de mim), toque em “me mostre como”.</p>
                <div className="epi-atalhos">{atalho(escolha.tela, escolha.aba, escolha.dentro)}</div>
                <button type="button" className="epi-voltar" onClick={() => setModo('fim')}>‹ outras opções</button>
              </>
            )}
            {modo === 'resposta' && resp && (
              <>
                <p className="epi-resp">{resp.resposta}</p>
                {resp.passos?.length > 0 && <ol className="epi-passos">{resp.passos.map((p) => <li key={p}>{p}</li>)}</ol>}
                {resp.ir_para && <div className="epi-atalhos">{atalho(resp.ir_para)}</div>}
                <button type="button" className="epi-voltar" onClick={() => setModo('guia')}>‹ sobre esta tela</button>
              </>
            )}
            {erro && <p className="aviso" role="alert">{erro}</p>}
          </div>
          <form className="epi-perg" onSubmit={(e) => { e.preventDefault(); if (pergunta.trim()) perguntar(pergunta.trim()); }}>
            <input value={pergunta} onChange={(e) => setPergunta(e.target.value)} placeholder={ouvindo ? (emEstacao ? 'Ouvindo a estação…' : 'Pode falar…') : 'Pergunte ao Epi…'} aria-label="Pergunta ao Epi" disabled={ocupado} />
            <button type="button" className={`epi-mic${ouvindo ? ' on' : ''}`} onClick={() => (ouvindo ? pararMic() : ligarMic())} aria-pressed={ouvindo}
              title={emEstacao ? 'Ligar o microfone: o Epi ouve e sugere o próximo passo da conduta' : 'Perguntar falando'}>{ouvindo ? '⏹' : '🎙️'}</button>
            <button type="submit" className="btn mini menta" disabled={ocupado || !pergunta.trim()}>{ocupado ? '…' : 'Enviar'}</button>
          </form>
        </section>, document.body)}
      {tour && <Holofote passos={tour} aoFim={() => setTour(null)} />}
    </>
  );
}
