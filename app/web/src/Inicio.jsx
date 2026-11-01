// Primeira pergunta da sessão: trilha guiada ou plataforma. A trilha só pede o tempo diário (e, se quiser, os dias).
import React, { useEffect, useState } from 'react';
import { EsperaRandomica } from './Comunidade.jsx';
import './social.css';

const DIAS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
const NOME_DIA = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
const TEMPOS = [20, 30, 45, 60, 90, 120];

export default function EscolhaInicial({ api, token, nome, aoPlataforma, aoAbrirSala }) {
  const [t, setT] = useState(null); const [passo, setPasso] = useState('escolha'); // escolha | config | espera
  const [min, setMin] = useState(60); const [dias, setDias] = useState([]); const [erro, setErro] = useState(''); const [forcar, setForcar] = useState(false);
  useEffect(() => { api('/api/trilha', { token }).then((r) => { setT(r); if (r.configurada) { setMin(r.minutos_dia); setDias(r.dias.length === 7 ? [] : r.dias); } }).catch(() => setT({ configurada: false })); }, [api, token]);
  if (!t) return <div className="ini-tela"><p className="sub">Carregando…</p></div>;
  const alternar = (d) => setDias((x) => (x.includes(d) ? x.filter((y) => y !== d) : [...x, d]));
  const plataforma = async () => { if (t.configurada) api('/api/trilha/modo', { metodo: 'POST', token, corpo: { modo: 'plataforma' } }).catch(() => {}); aoPlataforma(); };
  const salvar = async () => { setErro(''); try { const r = await api('/api/trilha', { metodo: 'PUT', token, corpo: { minutos_dia: min, dias } }); setT(r); return true; } catch (e) { setErro(e.message); return false; } };
  const iniciar = async (forca = false) => {
    setErro('');
    try {
      const r = await api('/api/trilha/iniciar', { metodo: 'POST', token, corpo: { forcar: forca } });
      api('/api/trilha/modo', { metodo: 'POST', token, corpo: { modo: 'trilha' } }).catch(() => {});
      if (r.estado === 'pareado') aoAbrirSala(r.sala_id); else setPasso('espera');
    } catch (e) { if (e.codigo === 'HOJE_NAO_E_DIA') setForcar(true); setErro(e.message); }
  };
  const seguir = async () => { if (await salvar()) iniciar(false); };
  return (
    <div className="ini-tela" role="dialog" aria-modal="true" aria-label="Como você quer treinar" data-testid="escolha-inicial">
      <div className="ini-cx">
        <h2>Olá{nome ? `, ${nome.split(' ')[0]}` : ''}! Como quer treinar agora?</h2>
        {passo === 'escolha' && (
          <div className="ini-opcoes">
            <button type="button" className="ini-opcao" data-testid="escolha-trilha" onClick={() => (t.configurada ? setPasso('retorno') : setPasso('config'))}>
              <b>🧭 Trilha guiada</b>{t.configurada ? `Seguir minha trilha: ${t.minutos_dia} min por dia. Hoje: ${t.minutos_feitos} min feitos.` : 'Você só diz quanto tempo tem por dia. A plataforma monta os ciclos e o parceiro.'}
            </button>
            <button type="button" className="ini-opcao" data-testid="escolha-plataforma" onClick={plataforma}><b>🏥 Acessar a plataforma</b>Salas, estações, estudo e comunidade, do seu jeito.</button>
          </div>)}
        {passo === 'retorno' && (
          <>
            <p>Sua trilha: <b>{t.minutos_dia} min por dia</b> em {t.dias.length === 7 ? 'todos os dias' : t.dias.map((d) => NOME_DIA[d]).join(', ')}. Hoje você já fez <b>{t.minutos_feitos} min</b>{t.restante > 0 ? `; faltam ${t.restante}.` : ' — meta cumprida!'}</p>
            <div className="acoes">
              <button type="button" className="btn menta" data-testid="seguir-trilha" onClick={() => iniciar(false)} disabled={t.restante < 10}>Seguir a trilha</button>
              <button type="button" className="btn" onClick={() => setPasso('config')}>Mudar tempo ou dias</button>
              <button type="button" className="btn" onClick={plataforma}>Acessar a plataforma</button>
            </div>
          </>)}
        {passo === 'config' && (
          <>
            <p><b>Quanto tempo você tem por dia para praticar?</b></p>
            <div className="ini-min" role="group" aria-label="Minutos por dia">{TEMPOS.map((m) => <button key={m} type="button" aria-pressed={min === m} onClick={() => setMin(m)} data-testid={`min-${m}`}>{m} min</button>)}</div>
            <p className="sub">Quer escolher os dias? Se não escolher nenhum, valem <b>todos os dias</b>.</p>
            <div className="ini-dias" role="group" aria-label="Dias da semana">{DIAS.map((d, i) => <button key={i} type="button" aria-pressed={dias.includes(i)} aria-label={NOME_DIA[i]} onClick={() => alternar(i)} data-testid={`dia-${i}`}>{d}</button>)}</div>
            <div className="acoes"><button type="button" className="btn menta" data-testid="comecar-trilha" onClick={seguir}>Começar agora</button>
              <button type="button" className="btn" onClick={async () => { if (await salvar()) aoPlataforma(); }}>Só salvar e ir para a plataforma</button>
              <button type="button" className="btn" onClick={() => setPasso('escolha')}>Voltar</button></div>
          </>)}
        {passo === 'espera' && <EsperaRandomica api={api} token={token} onPar={aoAbrirSala} onCancelar={() => setPasso('escolha')} rotulo="Trilha ativa: procurando um parceiro disponível…" />}
        {forcar && <div className="acoes"><button type="button" className="btn" onClick={() => { setForcar(false); iniciar(true); }}>Treinar mesmo assim</button></div>}
        {erro && <p className="aviso" role="alert">{erro}</p>}
      </div>
    </div>
  );
}
