// Registro das estações feitas: com quem, quem participou, em que modalidade e, se foi com IA, a variação temática do caso clínico.
import React, { useEffect, useState } from 'react';
import './solo.css';

export const MODALIDADE_ROTULO = { solo_ia: 'Solo com IA', sala: 'Sala com outra pessoa', randomico: 'Ciclo randômico', trilha: 'Trilha guiada', comunidade: 'Chamado da comunidade' };
const PAPEL = { candidato: 'candidato', avaliador_ator: 'avaliador/ator', observador: 'observador' };

export default function HistoricoEstacoes({ token, api }) {
  const [d, setD] = useState(null); const [pagina, setPagina] = useState(1); const [erro, setErro] = useState('');
  useEffect(() => { api(`/api/historico/estacoes?pagina=${pagina}`, { token }).then(setD).catch((e) => setErro(e.message)); }, [api, token, pagina]);
  if (erro) return <p className="sub">{erro}</p>;
  if (!d) return null;
  const paginas = Math.max(1, Math.ceil(d.total / d.por));
  return (
    <section data-testid="historico-estacoes">
      <h3>Estações que você fez</h3>
      {d.itens.length === 0 ? <p className="sub" data-testid="historico-vazio">Ainda não há estações finalizadas.</p> : (
        <ul className="pia-hist">{d.itens.map((h) => (
          <li key={h.execucao_id} data-testid="historico-item" data-modalidade={h.modalidade}>
            <span><b>{h.titulo}</b> <span className="sub">· {new Date(h.data).toLocaleDateString('pt-BR')}{h.nota !== null ? ` · ${h.nota}/${h.maximo}` : ''}</span></span>
            <span><span className="pia-sel">{MODALIDADE_ROTULO[h.modalidade] ?? h.modalidade}</span>{h.feita_com_ia && <span className="pia-sel" style={{ background: 'var(--coral)' }}>feita com IA</span>}
              {h.estacao_gerada_por_ia && <span className="pia-sel" style={{ background: 'var(--menta)' }}>estação gerada por IA</span>}</span>
            {h.variacao_tematica && <span className="sub">Variação temática principal: <b>{h.variacao_tematica}</b></span>}
            <span className="sub">Participantes: {h.participantes.map((p) => `${p.eu ? 'você' : p.nome} (${PAPEL[p.papel] ?? p.papel}${p.ia ? ', IA' : ''})`).join(' · ')}</span>
          </li>))}</ul>)}
      {paginas > 1 && <div className="pia-acoes"><button type="button" className="btn mini" disabled={pagina <= 1} onClick={() => setPagina(pagina - 1)}>‹</button><span>{pagina}/{paginas}</span><button type="button" className="btn mini" disabled={pagina >= paginas} onClick={() => setPagina(pagina + 1)}>›</button></div>}
    </section>
  );
}
