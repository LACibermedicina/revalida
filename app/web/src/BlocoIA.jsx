// Bloco de 5 com IA no Início: a lista das 5 estações (uma por grande área) e a janela da estação da vez,
// onde a pessoa escolhe convidar um colega (abre uma sala com o ciclo já montado) ou seguir sozinha com o paciente IA.
import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { bloco, NOME_AREA, proximaDoBloco } from './bloco.js';

const COR = { clinica_medica: 'var(--mar)', pediatria: 'var(--menta)', cirurgia: 'var(--uva)', ginecologia_obstetricia: 'var(--sol)', mfc: 'var(--coral)' };

/** Linhas do bloco dentro do cartão "Treinar agora". */
export function ListaBloco({ b, api, token, aoAbrir }) {
  return (
    <ol className="bl-lista" data-testid="bloco-ia">
      {b.itens.map((i, n) => (
        <li key={i.area + n} className={`bl-item ${i.situacao}${i.iniciada ? ' feita' : ''}`} style={{ '--cor': COR[i.area] }}>
          <span className="bl-num" aria-hidden="true">{i.iniciada ? '✓' : n + 1}</span>
          <span className="bl-txt">
            <small>{NOME_AREA[i.area]}</small>
            {i.situacao === 'pronta' ? <b>{i.titulo}</b> : i.situacao === 'gerando' ? <b className="bl-gerando">A IA está criando…</b> : <b className="bl-falha">{i.erro || 'Não foi possível criar.'}</b>}
          </span>
          {i.situacao === 'pronta' && <button type="button" className="btn mini" onClick={() => aoAbrir(n)}>{i.iniciada ? 'Abrir' : 'Treinar'}</button>}
          {i.situacao === 'falhou' && <button type="button" className="btn mini" onClick={() => bloco.tentarDeNovo(api, token, n)}>Tentar de novo</button>}
        </li>
      ))}
    </ol>
  );
}

/** Janela da estação da vez. `n` = índice escolhido, ou null para "a próxima pronta" (segue a geração). */
export function FocoBloco({ b, n, api, token, aoFechar, aoMudar, aoSozinho, aoAbrirSala }) {
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState('');
  const caixa = useRef(null);
  const k = n ?? proximaDoBloco(b);
  const item = k >= 0 ? b.itens[k] : null;
  const prontas = b.itens.filter((i) => i.situacao === 'pronta').length;
  const gerando = b.itens.some((i) => i.situacao === 'gerando');

  useEffect(() => { caixa.current?.focus(); }, []);
  useEffect(() => { const esc = (e) => e.key === 'Escape' && aoFechar(); addEventListener('keydown', esc); return () => removeEventListener('keydown', esc); }, [aoFechar]);

  const sozinho = () => { bloco.marcarIniciada(k); aoSozinho(item.id); };
  // sala nova com o ciclo já montado (começando pela estação da vez); lá dentro a pessoa convida o colega
  const convidar = async () => {
    setOcupado(true); setErro('');
    try {
      const ordem = [k, ...b.itens.map((_, j) => j).filter((j) => j !== k)].filter((j) => b.itens[j].situacao === 'pronta');
      const { id } = await api('/api/salas', { metodo: 'POST', token, corpo: { nome: 'Bloco IA · 5 áreas', expira_vazia_horas: 24 } });
      await api(`/api/salas/${id}/entrar`, { metodo: 'POST', token });
      try { await api(`/api/salas/${id}/ciclos`, { metodo: 'POST', token, corpo: { estacoes: ordem.map((j) => b.itens[j].id), grupo: 'Bloco IA · 5 áreas' } }); } catch { /* sala aberta mesmo assim; o ciclo pode ser montado lá */ }
      bloco.marcarIniciada(k);
      aoAbrirSala(id);
    } catch (e) { setErro(e.message); setOcupado(false); }
  };
  const ir = (passo) => {
    const prontasIdx = b.itens.map((i, j) => (i.situacao === 'pronta' ? j : -1)).filter((j) => j >= 0);
    const pos = prontasIdx.indexOf(k);
    if (pos >= 0) aoMudar(prontasIdx[(pos + passo + prontasIdx.length) % prontasIdx.length]);
  };

  return createPortal(
    <div className="bl-fundo" onClick={(e) => e.target === e.currentTarget && aoFechar()}>
      <div className="bl-foco" role="dialog" aria-modal="true" aria-labelledby="bl-titulo" tabIndex={-1} ref={caixa} data-testid="bloco-foco">
        <button type="button" className="bl-x" onClick={aoFechar} aria-label="Fechar">×</button>
        <div className="bl-trilha" aria-label={`${prontas} de 5 estações prontas`}>
          {b.itens.map((i, j) => (
            <button type="button" key={j} className={`bl-ponto ${i.situacao}${j === k ? ' atual' : ''}`} style={{ '--cor': COR[i.area] }}
              disabled={i.situacao !== 'pronta'} onClick={() => aoMudar(j)} title={NOME_AREA[i.area]} aria-label={`Estação ${j + 1}: ${NOME_AREA[i.area]}`}>{j + 1}</button>
          ))}
        </div>
        {!item ? (
          <div className="bl-espera" role="status">
            <div className="bl-roda" aria-hidden="true" />
            <h3 id="bl-titulo">O Epi está montando seu bloco</h3>
            <p className="sub">{gerando ? 'Uma estação para cada grande área, criada agora pela IA. A primeira abre aqui assim que ficar pronta.' : 'Nenhuma estação pôde ser criada. Feche e tente de novo em instantes.'}</p>
          </div>
        ) : (
          <>
            <p className="bl-area" style={{ '--cor': COR[item.area] }}>Estação {k + 1} de 5 · {NOME_AREA[item.area]}</p>
            <h3 id="bl-titulo">{item.titulo}</h3>
            <p className="sub">{item.tema ? <>Tema: <b>{item.tema}</b> · </> : null}{item.duracao_min} min</p>
            {item.motivo && <p className="bl-motivo">{item.motivo}</p>}
            <div className="bl-escolha">
              <button type="button" className="btn menta" onClick={sozinho} disabled={ocupado} data-testid="bloco-sozinho">Seguir sozinho com IA<small>o Epi faz o paciente e corrige no final</small></button>
              <button type="button" className="btn" onClick={convidar} disabled={ocupado} data-testid="bloco-convidar">{ocupado ? 'Abrindo a sala…' : 'Convidar um colega'}<small>abre uma sala com as estações prontas</small></button>
            </div>
            {erro && <p className="aviso" role="alert">{erro}</p>}
            {prontas > 1 && <div className="bl-nav"><button type="button" className="btn mini" onClick={() => ir(-1)}>‹ Anterior</button><button type="button" className="btn mini" onClick={() => ir(1)}>Próxima ›</button></div>}
            {gerando && <p className="bl-rodape">Criando as outras: {prontas} de 5 prontas.</p>}
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}
