// Roteiro do ator, prático para usar durante a estação: separado por argumento (abas), cada pergunta com a sua resposta
// (uma por vez), busca rápida e marcação do que já foi respondido. Entende o formato novo ("## Argumento" + "P:"/"R:")
// e também roteiros antigos em texto corrido (vira um item por frase/linha, sem perder conteúdo).
import React, { useMemo, useState } from 'react';
import { lerRoteiro } from './roteiro.js';

export default function RoteiroAtor({ corpo }) {
  const args = useMemo(() => lerRoteiro(corpo), [corpo]);
  const [aba, setAba] = useState(0);
  const [busca, setBusca] = useState('');
  const [feitas, setFeitas] = useState(() => new Set());
  if (!args.length) return null;
  const termo = busca.trim().toLowerCase();
  const visiveis = termo
    ? args.flatMap((a, ai) => a.itens.map((it, ii) => ({ ...it, chave: `${ai}-${ii}`, arg: a.nome }))).filter((it) => `${it.p} ${it.r}`.toLowerCase().includes(termo))
    : args[Math.min(aba, args.length - 1)].itens.map((it, ii) => ({ ...it, chave: `${Math.min(aba, args.length - 1)}-${ii}` }));
  const marcar = (k) => setFeitas((s) => { const n = new Set(s); if (n.has(k)) n.delete(k); else n.add(k); return n; });
  const total = args.reduce((n, a) => n + a.itens.length, 0);
  return (
    <section className="ra" aria-label="Roteiro do ator" data-testid="roteiro-ator">
      <header className="ra-cab">
        <h4 className="pe-sec">Roteiro do ator</h4>
        <span className="ra-prog">{feitas.size}/{total} respondidas</span>
      </header>
      <input className="ra-busca" type="search" placeholder="Buscar pergunta (ex.: febre, alergia)…" value={busca} onChange={(e) => setBusca(e.target.value)} aria-label="Buscar no roteiro" />
      {!termo && (
        <div className="ra-abas" role="tablist">
          {args.map((a, i) => {
            const feitasArg = a.itens.filter((_, ii) => feitas.has(`${i}-${ii}`)).length;
            return (
              <button key={a.nome + i} type="button" role="tab" aria-selected={i === aba} className={`ra-aba${i === aba ? ' on' : ''}${feitasArg === a.itens.length ? ' completa' : ''}`} onClick={() => setAba(i)}>
                {a.nome}<em>{feitasArg}/{a.itens.length}</em>
              </button>
            );
          })}
        </div>
      )}
      <ol className="ra-lista">
        {visiveis.map((it) => (
          <li key={it.chave} className={`ra-item${feitas.has(it.chave) ? ' feita' : ''}`}>
            <button type="button" className="ra-marca" onClick={() => marcar(it.chave)} aria-pressed={feitas.has(it.chave)} title={feitas.has(it.chave) ? 'Desmarcar' : 'Marcar como respondida'}>{feitas.has(it.chave) ? '✓' : ''}</button>
            <div>
              {it.arg && <small className="ra-arg">{it.arg}</small>}
              {it.p && <p className="ra-p"><b>Se perguntar:</b> {it.p}</p>}
              <p className="ra-r">{it.p ? <b>Responda:</b> : null} {it.r || <em>(sem resposta definida: improvise de forma coerente)</em>}</p>
            </div>
          </li>
        ))}
        {visiveis.length === 0 && <li className="sub">Nada encontrado para “{busca}”.</li>}
      </ol>
    </section>
  );
}
