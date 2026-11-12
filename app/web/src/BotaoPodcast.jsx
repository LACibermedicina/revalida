import React, { useEffect, useRef, useState } from 'react';

/** "Criar podcast" a partir de onde o usuário estuda (estação, trilha, cartões, caderno de erros).
 *  O servidor monta o conteúdo já formatado (POST /api/podcast/rapido); aqui o usuário escolhe o modo e os minutos,
 *  ouve, baixa o MP3 (padrão universal), copia o link público ou envia o episódio à radIA. */
const MINUTOS = [3, 5, 8, 12];

export default function BotaoPodcast({ api, token, origem, estacaoId, execucaoId, temaId, temaIds, cartaoIds, rotulo = 'Criar podcast', titulo, classe = 'btn mini', desabilitado = false }) {
  const [aberto, setAberto] = useState(false);
  const [modo, setModo] = useState(execucaoId ? 'com_desempenho' : 'aprofundar');
  const [min, setMin] = useState(5);
  const [fase, setFase] = useState('opcoes');   // opcoes | gerando | pronto
  const [r, setR] = useState(null); const [erro, setErro] = useState(''); const [msg, setMsg] = useState('');
  const [src, setSrc] = useState(null); const [links, setLinks] = useState(null); const [naRadia, setNaRadia] = useState(false);
  const urlRef = useRef(null);
  useEffect(() => () => { if (urlRef.current) URL.revokeObjectURL(urlRef.current); }, []);

  const fechar = () => { setAberto(false); setFase('opcoes'); setR(null); setErro(''); setMsg(''); setSrc(null); setLinks(null); setNaRadia(false); };
  const criar = async () => {
    setFase('gerando'); setErro('');
    try {
      const corpo = { origem, minutos: min, ...(origem === 'estacao' || origem === 'erros' ? { modo } : {}), ...(estacaoId ? { estacao_id: estacaoId } : {}), ...(execucaoId ? { execucao_id: execucaoId } : {}),
        ...(temaId ? { tema_id: temaId } : {}), ...(temaIds?.length ? { tema_ids: temaIds } : {}), ...(cartaoIds?.length ? { cartao_ids: cartaoIds } : {}) };
      const x = await api('/api/podcast/rapido', { metodo: 'POST', token, corpo });
      setR(x); setFase('pronto');
      if (x.item?.tem_audio) {
        const resp = await fetch(`/api/podcast/itens/${x.item.id}/audio`, { headers: { Authorization: `Bearer ${token}` } });
        if (resp.ok) { const u = URL.createObjectURL(await resp.blob()); urlRef.current = u; setSrc(u); }
      }
    } catch (e) { setErro(e.message); setFase('opcoes'); }
  };
  const baixar = async (rota, nome) => {
    const resp = await fetch(rota, { headers: { Authorization: `Bearer ${token}` } });
    if (!resp.ok) return setErro('Não consegui baixar agora.');
    const u = URL.createObjectURL(await resp.blob()); const a = document.createElement('a'); a.href = u; a.download = nome; a.click(); setTimeout(() => URL.revokeObjectURL(u), 2000);
  };
  const compartilhar = async () => {
    setErro('');
    try { const x = await api(`/api/podcast/itens/${r.item.id}/compartilhar`, { metodo: 'POST', token, corpo: {} }); setLinks(x.links); } catch (e) { setErro(e.message); }
  };
  const copiar = async (t) => { try { await navigator.clipboard.writeText(t); setMsg('Link copiado.'); } catch { setMsg('Copie manualmente o endereço acima.'); } };
  const radia = async () => {
    setErro('');
    try { await api(`/api/podcast/itens/${r.item.id}/radia`, { metodo: 'PUT', token, corpo: { publico: !naRadia } }); setNaRadia(!naRadia); setMsg(!naRadia ? 'Episódio enviado à radIA (programa público).' : 'Episódio retirado da radIA.'); } catch (e) { setErro(e.message); }
  };
  const falar = () => { try { speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(r.item.roteiro || ''); u.lang = 'pt-BR'; speechSynthesis.speak(u); } catch { setErro('Seu navegador não lê textos em voz alta.'); } };
  useEffect(() => () => { try { speechSynthesis.cancel(); } catch { /* ok */ } }, []);

  const item = r?.item;
  return (
    <>
      <button type="button" className={classe} data-testid="criar-podcast" onClick={() => setAberto(true)} disabled={desabilitado} title="Criar um podcast de revisão sobre este conteúdo">🎧 {rotulo}</button>
      {aberto && (
        <div className="modal-fundo" role="dialog" aria-modal="true" aria-label="Criar podcast" data-testid="modal-podcast" onClick={(e) => { if (e.target === e.currentTarget && fase !== 'gerando') fechar(); }}>
          <div className="modal">
            <header><h3>🎧 Criar podcast{titulo ? `: ${titulo}` : ''}</h3><button type="button" className="fechar" aria-label="Fechar" onClick={fechar} disabled={fase === 'gerando'}>✕</button></header>
            {fase === 'opcoes' && (
              <>
                {(origem === 'estacao' || origem === 'erros') && (
                  <fieldset className="pod-modo"><legend>Como quer o episódio?</legend>
                    <label><input type="radio" name="pod-modo" checked={modo === 'com_desempenho'} onChange={() => setModo('com_desempenho')} /> <b>Com comentários sobre o meu desempenho</b><span className="sub"> — o que você fez, o que faltou e o que treinar.</span></label>
                    {origem === 'estacao' && <label><input type="radio" name="pod-modo" checked={modo === 'aprofundar'} onChange={() => setModo('aprofundar')} /> <b>Sem comentários</b><span className="sub"> — só como aprofundar a estação e os elementos técnicos, em resumo.</span></label>}
                  </fieldset>)}
                {origem === 'cartoes' && <p className="sub">O episódio lê as perguntas, dá uma pausa para você pensar e depois explica as respostas.</p>}
                {origem === 'trilha' && <p className="sub">O episódio percorre os temas da trilha, do que mais precisa de reforço ao que menos.</p>}
                <label className="pod-min">Duração aproximada <select value={min} onChange={(e) => setMin(Number(e.target.value))}>{MINUTOS.map((m) => <option key={m} value={m}>{m} minutos</option>)}</select></label>
                {erro && <p className="aviso" role="alert">{erro}</p>}
                <div className="acoes"><button type="button" className="btn menta" data-testid="podcast-gerar" onClick={criar}>Criar podcast</button><button type="button" className="btn" onClick={fechar}>Cancelar</button></div>
              </>)}
            {fase === 'gerando' && <p role="status" className="pod-gerando">Escrevendo o roteiro e gravando o áudio… isso leva alguns instantes.</p>}
            {fase === 'pronto' && item && (
              <div data-testid="podcast-pronto">
                <p><b>{item.titulo}</b><br /><span className="sub">Salvo na playlist “{r.playlist?.titulo}”{item.modo === 'com_desempenho' ? ' · com comentários do seu desempenho' : item.modo === 'aprofundar' ? ' · só aprofundamento' : ''}.</span></p>
                {r.aviso && <p className="aviso" role="status">{r.aviso}</p>}
                {src ? <audio controls src={src} className="pod-audio" /> : item.tem_audio ? <p className="sub">Carregando o áudio…</p> : (
                  <p className="sub">A voz (TTS) não está configurada neste servidor: o episódio ficou com a transcrição. <button type="button" className="btn mini" onClick={falar}>Ler em voz alta no navegador</button></p>)}
                <div className="acoes">
                  {item.tem_audio && <button type="button" className="btn mini" onClick={() => baixar(`/api/podcast/itens/${item.id}/audio?baixar=1`, `${item.titulo.slice(0, 60)}.mp3`)}>Baixar MP3</button>}
                  {item.roteiro && <button type="button" className="btn mini" onClick={() => baixar(`/api/podcast/itens/${item.id}/transcricao`, `${item.titulo.slice(0, 60)}.txt`)}>Baixar transcrição</button>}
                  <button type="button" className="btn mini" data-testid="podcast-compartilhar" onClick={compartilhar}>Criar link para compartilhar</button>
                  <button type="button" className="btn mini" data-testid="podcast-radia" aria-pressed={naRadia} onClick={radia}>{naRadia ? 'Retirar da radIA' : 'Enviar para a radIA'}</button>
                </div>
                {links && <div className="pod-links" data-testid="podcast-links">
                  {links.pagina && <p>Página para ouvir (qualquer pessoa): <input readOnly value={links.pagina} onFocus={(e) => e.target.select()} aria-label="Link da página" /> <button type="button" className="btn mini" onClick={() => copiar(links.pagina)}>Copiar</button></p>}
                  {links.audio && <p>MP3 direto: <input readOnly value={links.audio} onFocus={(e) => e.target.select()} aria-label="Link do MP3" /> <button type="button" className="btn mini" onClick={() => copiar(links.audio)}>Copiar</button></p>}
                </div>}
                {msg && <p className="sub" role="status">{msg}</p>}
                {erro && <p className="aviso" role="alert">{erro}</p>}
                <div className="acoes"><button type="button" className="btn" onClick={fechar}>Fechar</button></div>
              </div>)}
          </div>
        </div>)}
    </>
  );
}
