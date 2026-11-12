import React, { useMemo, useState } from 'react';

const CORES = [['amarela', 'Amarela'], ['verde', 'Verde'], ['rosa', 'Rosa'], ['azul', 'Azul']];
const novoId = () => `n${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
export const criarNota = (cor = 'amarela') => ({ id: novoId(), titulo: '', texto: '', cor, fixada: false, em: Date.now() });

/** Notas rápidas: post-its que ficam salvos na conta (viajam entre aparelhos). Salvamento automático. */
export default function Notas({ notas, salvar, foco }) {
  const [busca, setBusca] = useState('');
  const [cor, setCor] = useState('amarela');
  const mudar = (id, p) => salvar((e) => ({ ...e, notas: e.notas.map((n) => (n.id === id ? { ...n, ...p, em: Date.now() } : n)) }));
  const nova = () => salvar((e) => ({ ...e, notas: [criarNota(cor), ...e.notas].slice(0, 50) }));
  const apagar = (n) => { if (!n.texto && !n.titulo || window.confirm(`Apagar a nota${n.titulo ? ` “${n.titulo}”` : ''}?`)) salvar((e) => ({ ...e, notas: e.notas.filter((x) => x.id !== n.id) })); };
  const vistas = useMemo(() => {
    const b = busca.trim().toLowerCase();
    return [...notas].filter((n) => !b || `${n.titulo} ${n.texto}`.toLowerCase().includes(b)).sort((a, c) => (c.fixada - a.fixada) || (c.em - a.em));
  }, [notas, busca]);
  return (
    <div className="notas" data-testid="notas">
      <div className="notas-barra">
        <button type="button" className="btn mini menta" data-testid="nota-nova" onClick={nova}>+ Nova nota</button>
        <div className="notas-cores" role="group" aria-label="Cor da próxima nota">
          {CORES.map(([k, n]) => <button key={k} type="button" className={`cor ${k}`} aria-label={n} aria-pressed={cor === k} onClick={() => setCor(k)} />)}
        </div>
        <input type="search" aria-label="Buscar nas notas" placeholder="Buscar" value={busca} onChange={(e) => setBusca(e.target.value)} />
        <span className="sub">{notas.length}/50</span>
      </div>
      {vistas.length === 0 && <p className="sub">{notas.length ? 'Nenhuma nota encontrada.' : 'Nenhuma nota ainda. Use “Nova nota” para anotar um macete, uma conduta ou um lembrete de revisão.'}</p>}
      <div className="notas-grade">
        {vistas.map((n, i) => (
          <article key={n.id} className={`nota ${n.cor}${n.fixada ? ' fixada' : ''}`} data-testid="nota">
            <input className="nota-titulo" aria-label="Título da nota" placeholder="Título" maxLength={80} value={n.titulo} onChange={(e) => mudar(n.id, { titulo: e.target.value })} />
            <textarea aria-label="Texto da nota" placeholder="Escreva aqui…" maxLength={4000} value={n.texto} autoFocus={foco && i === 0} onChange={(e) => mudar(n.id, { texto: e.target.value })} />
            <footer>
              <button type="button" aria-pressed={n.fixada} title={n.fixada ? 'Desafixar' : 'Fixar no topo'} onClick={() => mudar(n.id, { fixada: !n.fixada })}>{n.fixada ? '📌' : '📍'}</button>
              <button type="button" title="Trocar a cor" aria-label="Trocar a cor da nota" onClick={() => mudar(n.id, { cor: CORES[(CORES.findIndex(([k]) => k === n.cor) + 1) % CORES.length][0] })}>◐</button>
              <time>{new Date(n.em).toLocaleDateString('pt-BR')}</time>
              <button type="button" className="apagar" aria-label="Apagar nota" onClick={() => apagar(n)}>✕</button>
            </footer>
          </article>
        ))}
      </div>
    </div>
  );
}
