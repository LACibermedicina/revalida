// Feedback gráfico geral de desempenho: blocos generalizados do PEP, modalidades, áreas e evolução, com filtros.
// Uma só cor de magnitude (azul-mar); a identidade vem do rótulo, nunca só da cor. Há visão em tabela para leitores de tela.
import React, { useCallback, useEffect, useState } from 'react';
import './social.css';

const AREAS = { clinica_medica: 'Clínica médica', cirurgia: 'Cirurgia', ginecologia_obstetricia: 'Ginecologia e obstetrícia', pediatria: 'Pediatria', mfc: 'Medicina de família' };
const MODS = { sala: 'Sala (chefe/convite)', randomico: 'Ciclo randômico', trilha: 'Trilha guiada', solo: 'Prática solo com IA', comunidade: 'Chamado da comunidade' };
const PERIODOS = [['', 'Geral (todo o período)'], ['7', 'Últimos 7 dias'], ['30', 'Últimos 30 dias'], ['90', 'Últimos 90 dias'], ['365', 'Último ano'], ['x', 'Intervalo…']];
const p1 = (n) => (n === null || n === undefined ? '—' : `${String(n).replace('.', ',')}%`);

function Barras({ linhas, rotuloFn, id }) {
  if (!linhas.length) return <p className="sub">Sem dados neste filtro.</p>;
  return (
    <ul className="dv-barras" data-testid={id}>
      {linhas.map((l) => (
        <li key={l.chave} title={`${l.rotulo}: ${p1(l.pct)}${l.nota ? ` · ${l.nota}` : ''}`}>
          <span className="dv-rot">{l.rotulo}</span>
          <span className="dv-trilho" role="img" aria-label={`${l.rotulo}: ${p1(l.pct)}`}><span className={`dv-fill${l.pct !== null && l.pct < 50 ? ' baixo' : ''}`} style={{ width: `${Math.max(0, Math.min(100, l.pct ?? 0))}%` }} /></span>
          <span className="dv-val">{p1(l.pct)}</span>
          {l.nota && <span className="dv-nota">{l.nota}</span>}
        </li>))}
    </ul>
  );
}

function Linha({ pontos }) {
  if (pontos.length < 2) return <p className="sub">Precisa de pelo menos 2 semanas de prática para mostrar a evolução.</p>;
  const L = 320, A = 120, px = 30, py = 10;
  const xy = pontos.map((p, i) => [px + (i * (L - px - 8)) / (pontos.length - 1), A - 18 - ((p.percentual ?? 0) / 100) * (A - 18 - py)]);
  const d = xy.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
  return (
    <svg className="dv-linha" viewBox={`0 0 ${L} ${A}`} role="img" aria-label={`Evolução semanal: de ${p1(pontos[0].percentual)} para ${p1(pontos.at(-1).percentual)}`} data-testid="grafico-evolucao">
      {[0, 50, 100].map((v) => { const y = A - 18 - (v / 100) * (A - 18 - py); return <g key={v}><line x1={px} x2={L - 8} y1={y} y2={y} className="dv-grade" /><text x={px - 4} y={y + 3} textAnchor="end" className="dv-eixo">{v}%</text></g>; })}
      <path d={d} className="dv-curva" />
      {xy.map(([x, y], i) => <g key={i}><circle cx={x} cy={y} r="4" className="dv-pt"><title>{`Semana de ${pontos[i].semana}: ${p1(pontos[i].percentual)} (${pontos[i].estacoes} estação(ões))`}</title></circle></g>)}
      <text x={px} y={A - 4} className="dv-eixo">{pontos[0].semana.slice(5).split('-').reverse().join('/')}</text>
      <text x={L - 8} y={A - 4} textAnchor="end" className="dv-eixo">{pontos.at(-1).semana.slice(5).split('-').reverse().join('/')}</text>
    </svg>
  );
}

export default function TelaDesempenho({ token, api }) {
  const [f, setF] = useState({ area: '', periodo: '', modalidade: '', de: '', ate: '' });
  const [d, setD] = useState(null); const [erro, setErro] = useState(''); const [tabela, setTabela] = useState(false);
  const carregar = useCallback(async () => {
    const qs = new URLSearchParams();
    if (f.area) qs.set('area', f.area); if (f.modalidade) qs.set('modalidade', f.modalidade);
    if (f.periodo === 'x') { if (f.de) qs.set('de', f.de); if (f.ate) qs.set('ate', f.ate); } else if (f.periodo) qs.set('periodo', f.periodo);
    try { setErro(''); setD(await api(`/api/desempenho?${qs}`, { token })); } catch (e) { setErro(e.message); }
  }, [api, token, f]);
  useEffect(() => { carregar(); }, [carregar]);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const vazio = d && d.resumo.estacoes === 0;
  return (
    <div className="tela dv" data-testid="tela-desempenho">
      <h2>Meu desempenho</h2>
      <p className="sub">Resultado das estações que você fez como candidato, organizado pelos blocos que compõem um PEP.</p>
      <div className="dv-filtros" role="group" aria-label="Filtros">
        <label className="campo"><span>Área</span><select value={f.area} onChange={set('area')} data-testid="f-area"><option value="">Todas</option>{Object.entries(AREAS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
        <label className="campo"><span>Período</span><select value={f.periodo} onChange={set('periodo')} data-testid="f-periodo">{PERIODOS.map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
        {f.periodo === 'x' && <><label className="campo"><span>De</span><input type="date" value={f.de} onChange={set('de')} data-testid="f-de" /></label><label className="campo"><span>Até</span><input type="date" value={f.ate} onChange={set('ate')} data-testid="f-ate" /></label></>}
        <label className="campo"><span>Modalidade</span><select value={f.modalidade} onChange={set('modalidade')} data-testid="f-modalidade"><option value="">Todas</option>{Object.entries(MODS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
      </div>
      {erro && <p className="aviso" role="alert">{erro}</p>}
      {!d ? <p className="sub">Carregando…</p> : (
        <>
          <div className="dv-kpis" data-testid="kpis">
            <div><b>{d.resumo.estacoes}</b><span>estações feitas</span></div>
            <div><b>{p1(d.resumo.percentual)}</b><span>aproveitamento</span></div>
            <div><b>{d.resumo.minutos}</b><span>minutos praticados</span></div>
            <div><b>{d.resumo.avaliadas}</b><span>estações que você avaliou</span></div>
            <div><b>{d.resumo.criticos_falhos}</b><span>itens críticos falhos</span></div>
          </div>
          {vazio ? <p className="sub" data-testid="desempenho-vazio">Nenhuma estação neste filtro. Faça uma estação ou amplie o período.</p> : (
            <>
              {d.pontos_fracos.length > 0 && <p className="dv-foco" data-testid="pontos-fracos">Onde focar: {d.pontos_fracos.map((b) => d.por_bloco.find((x) => x.bloco === b)?.rotulo).join(' · ')}</p>}
              <div className="acoes"><button type="button" className="btn mini" aria-pressed={tabela} onClick={() => setTabela(!tabela)} data-testid="alterna-tabela">{tabela ? 'Ver gráficos' : 'Ver como tabela'}</button></div>
              {tabela ? (
                <table className="dv-tabela" data-testid="tabela-desempenho"><caption>Desempenho por bloco do PEP</caption>
                  <thead><tr><th>Bloco</th><th>Pontos</th><th>Aproveitamento</th><th>Críticos falhos</th></tr></thead>
                  <tbody>{d.por_bloco.map((b) => <tr key={b.bloco}><td>{b.rotulo}</td><td>{b.obtido}/{b.maximo}</td><td>{p1(b.percentual)}</td><td>{b.criticos_falhos}</td></tr>)}</tbody></table>
              ) : (
                <>
                  <section className="dv-card"><h3>Por bloco do PEP</h3>
                    <Barras id="grafico-blocos" linhas={d.por_bloco.filter((b) => b.itens > 0).map((b) => ({ chave: b.bloco, rotulo: b.rotulo, pct: b.percentual, nota: b.criticos_falhos ? `${b.criticos_falhos} crítico(s) falho(s)` : '' }))} /></section>
                  <section className="dv-card"><h3>Evolução semanal</h3><Linha pontos={d.evolucao} /></section>
                  <div className="dv-duas">
                    <section className="dv-card"><h3>Por modalidade</h3>
                      <Barras id="grafico-modalidades" linhas={d.por_modalidade.filter((m) => m.como_candidato || m.como_avaliador).map((m) => ({ chave: m.modalidade, rotulo: MODS[m.modalidade], pct: m.percentual, nota: `${m.como_candidato} como candidato · ${m.como_avaliador} avaliando` }))} /></section>
                    <section className="dv-card"><h3>Por área</h3>
                      <Barras id="grafico-areas" linhas={d.por_area.map((a) => ({ chave: a.area, rotulo: AREAS[a.area], pct: a.percentual, nota: `${a.estacoes} estação(ões)` }))} /></section>
                  </div>
                </>)}
            </>)}
        </>)}
    </div>
  );
}
