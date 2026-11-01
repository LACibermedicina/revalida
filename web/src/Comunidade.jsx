// Comunidade: ciclo randômico (fila de disponibilidade), chamado público e segurança (bloqueio/denúncia).
import React, { useCallback, useEffect, useState } from 'react';
import { AcoesUsuario, Notificacoes, PainelSeguranca } from './Seguranca.jsx';
import './social.css';

export const AREAS = { clinica_medica: 'Clínica médica', cirurgia: 'Cirurgia', ginecologia_obstetricia: 'Ginecologia e obstetrícia', pediatria: 'Pediatria', mfc: 'Medicina de família' };

/** Espera na fila randômica: consulta o servidor a cada 3 s; quando há par, avisa com a sala. */
export function EsperaRandomica({ api, token, onPar, onCancelar, rotulo = 'Procurando alguém disponível para treinar com você…' }) {
  const [info, setInfo] = useState(null); const [erro, setErro] = useState('');
  useEffect(() => {
    let vivo = true;
    const ver = async () => {
      try {
        const r = await api('/api/randomico/estado', { token });
        if (!vivo) return; setInfo(r);
        if (r.estado === 'pareado' && r.sala_id) onPar(r.sala_id);
        if (r.estado === 'ocioso') onCancelar?.();
      } catch (e) { if (vivo) setErro(e.message); }
    };
    ver(); const t = setInterval(ver, 3000);
    return () => { vivo = false; clearInterval(t); };
  }, [api, token]); // eslint-disable-line react-hooks/exhaustive-deps
  const cancelar = async () => { try { await api('/api/randomico', { metodo: 'DELETE', token }); } catch { /* segue */ } onCancelar?.(); };
  return (
    <div className="cm-espera" role="status" data-testid="espera-randomica">
      <span className="cm-pulso" aria-hidden="true" />
      <span>{rotulo}{info?.estado === 'pareado' ? ' Par encontrado!' : ''}</span>
      <button type="button" className="btn mini" onClick={cancelar} data-testid="sair-da-fila">Sair da fila</button>
      {erro && <span className="aviso" role="alert">{erro}</span>}
    </div>
  );
}

function Randomico({ api, token, aoAbrirSala }) {
  const [area, setArea] = useState(''); const [esperando, setEsperando] = useState(false); const [fila, setFila] = useState(null); const [erro, setErro] = useState('');
  const contar = useCallback(async () => { try { setFila((await api('/api/randomico/fila', { token })).disponiveis); } catch { /* sem rede */ } }, [api, token]);
  useEffect(() => { contar(); const t = setInterval(contar, 8000); return () => clearInterval(t); }, [contar]);
  const entrar = async () => {
    setErro('');
    try { const r = await api('/api/randomico/entrar', { metodo: 'POST', token, corpo: { area: area || undefined } }); if (r.estado === 'pareado') aoAbrirSala(r.sala_id); else { setEsperando(true); if (r.aviso) setErro(r.aviso); } }
    catch (e) { setErro(e.message); }
  };
  return (
    <section className="cm-bloco" data-testid="aba-randomico">
      <h3>Ciclo randômico</h3>
      <p className="sub">Você fica disponível; a plataforma <b>sorteia a estação</b> e <b>sorteia as funções</b> (chefe/avaliador e candidato). Depois da realização 1×1, as funções <b>se invertem</b> e a mesma estação roda de novo.</p>
      <p className="sub" data-testid="fila-qtd">{fila === null ? '' : fila === 0 ? 'Ninguém na fila agora; você espera até alguém entrar.' : `${fila} pessoa(s) disponível(is) agora.`}</p>
      {esperando ? <EsperaRandomica api={api} token={token} onPar={aoAbrirSala} onCancelar={() => setEsperando(false)} /> : (
        <div className="acoes">
          <label className="campo" style={{ margin: 0 }}><span>Área (opcional)</span>
            <select value={area} onChange={(e) => setArea(e.target.value)} data-testid="randomico-area"><option value="">Qualquer</option>{Object.entries(AREAS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
          <button type="button" className="btn menta" onClick={entrar} data-testid="entrar-randomico">Estou disponível</button>
        </div>)}
      {erro && <p className="aviso" role="alert">{erro}</p>}
    </section>
  );
}

function Chamados({ api, token, aoAbrirSala, usuario }) {
  const [lista, setLista] = useState([]); const [meu, setMeu] = useState(null); const [salas, setSalas] = useState([]);
  const [area, setArea] = useState(''); const [mensagem, setMensagem] = useState(''); const [erro, setErro] = useState('');
  const carregar = useCallback(async () => {
    try {
      const [l, m, p] = await Promise.all([api('/api/chamados', { token }), api('/api/chamados/meu', { token }), api('/api/painel', { token })]);
      setLista(l); setMeu(m); setSalas((p.salas ?? []).filter((s) => s.papel === 'admin'));
    } catch (e) { setErro(e.message); }
  }, [api, token]);
  useEffect(() => { carregar(); const t = setInterval(carregar, 8000); return () => clearInterval(t); }, [carregar]);
  const abrir = async () => { setErro(''); try { await api('/api/chamados', { metodo: 'POST', token, corpo: { area: area || undefined, mensagem } }); setMensagem(''); carregar(); } catch (e) { setErro(e.message); } };
  const cancelar = async () => { try { await api(`/api/chamados/${meu.id}`, { metodo: 'DELETE', token }); carregar(); } catch (e) { setErro(e.message); } };
  const incluir = async (c, corpo) => { setErro(''); try { const r = await api(`/api/chamados/${c.id}/incluir`, { metodo: 'POST', token, corpo }); aoAbrirSala(r.sala_id); } catch (e) { setErro(e.message); carregar(); } };
  return (
    <section className="cm-bloco" data-testid="aba-chamados">
      <h3>Chamado à comunidade</h3>
      <p className="sub">Abra um chamado público: qualquer pessoa pode <b>incluir você numa sala aberta</b> dela ou <b>iniciar direto um ciclo de estações</b> com você.</p>
      {meu?.estado === 'aberto' && (
        <div className="cm-espera" data-testid="meu-chamado"><span className="cm-pulso" aria-hidden="true" /><span>Seu chamado está aberto{meu.mensagem ? `: “${meu.mensagem}”` : ''}. Quando alguém incluir você, avisamos.</span><button type="button" className="btn mini" onClick={cancelar}>Cancelar chamado</button></div>)}
      {meu?.estado === 'atendido' && meu.sala_id && <div className="acoes"><span>Alguém incluiu você numa sala.</span><button type="button" className="btn mini menta" onClick={() => aoAbrirSala(meu.sala_id)} data-testid="abrir-sala-chamado">Abrir a sala</button></div>}
      {meu?.estado !== 'aberto' && (
        <div className="acoes">
          <label className="campo" style={{ margin: 0 }}><span>Área</span><select value={area} onChange={(e) => setArea(e.target.value)}><option value="">Qualquer</option>{Object.entries(AREAS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
          <label className="campo" style={{ margin: 0, flex: 1 }}><span>Mensagem (opcional)</span><input value={mensagem} maxLength={300} onChange={(e) => setMensagem(e.target.value)} data-testid="chamado-msg" /></label>
          <button type="button" className="btn" onClick={abrir} data-testid="abrir-chamado">Abrir chamado</button>
        </div>)}
      <h3 style={{ marginTop: 12 }}>Chamados abertos ({lista.length})</h3>
      {lista.length === 0 && <p className="sub">Nenhum chamado agora.</p>}
      {lista.map((c) => (
        <div key={c.id} className="cm-linha" data-testid="chamado-aberto">
          <span><b>{c.nome}</b>{c.area ? ` · ${AREAS[c.area]}` : ''}{c.mensagem ? ` · “${c.mensagem}”` : ''}{c.estacoes.length ? ` · ${c.estacoes.map((e) => e.titulo).join(', ')}` : ''}</span>
          <span className="acoes">
            {salas.map((s) => <button key={s.id} type="button" className="btn mini" data-testid="incluir-na-sala" onClick={() => incluir(c, { sala_id: s.id })}>Incluir na minha sala{salas.length > 1 ? ` (${s.pessoas} pessoas)` : ''}</button>)}
            <button type="button" className="btn mini menta" data-testid="iniciar-ciclo" onClick={() => incluir(c, {})}>Iniciar ciclo {c.estacoes.length ? 'dessas estações' : 'com estação sorteada'}</button>
            <AcoesUsuario usuarioId={c.usuario_id} nome={c.nome} api={api} token={token} aoFeito={carregar} />
          </span>
        </div>))}
      {erro && <p className="aviso" role="alert">{erro}</p>}
    </section>
  );
}

export default function TelaComunidade({ token, usuario, api, aoAbrirSala, abaInicial = 'randomico' }) {
  const [aba, setAba] = useState(abaInicial);
  const abas = [['randomico', 'Ciclo randômico'], ['chamados', 'Chamados'], ['seguranca', 'Segurança']];
  return (
    <div className="tela cm" data-testid="tela-comunidade">
      <h2>Comunidade</h2>
      <div className="cm-abas" role="tablist">{abas.map(([k, r]) => <button key={k} role="tab" type="button" aria-selected={aba === k} onClick={() => setAba(k)} data-testid={`cm-${k}`}>{r}</button>)}</div>
      {aba === 'randomico' && <Randomico api={api} token={token} aoAbrirSala={aoAbrirSala} />}
      {aba === 'chamados' && <Chamados api={api} token={token} usuario={usuario} aoAbrirSala={aoAbrirSala} />}
      {aba === 'seguranca' && (<><Notificacoes api={api} token={token} /><PainelSeguranca api={api} token={token} /></>)}
    </div>
  );
}
