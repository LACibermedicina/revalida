// Painel de análise de uma estação já feita: resumo de desempenho, pontos fortes e fracos por seção contra o seu histórico,
// comparação com outras estações, fala transcrita × marcação do avaliador, revisão da nota, cartões de revisão, trilha
// e uma nova estação com outra abordagem. Abre a partir do Início, do fim da estação na sala e do caderno de erros.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { PainelQuadros } from './Quadros.jsx';
import './quadros.css';
import './analise.css';

const AREAS = { clinica_medica: 'Clínica Médica', cirurgia: 'Cirurgia', ginecologia_obstetricia: 'Ginecologia e Obstetrícia', pediatria: 'Pediatria', mfc: 'Medicina de Família e Comunidade' };
const pts = (n) => (n === null || n === undefined ? '—' : Number(n).toLocaleString('pt-BR', { maximumFractionDigits: 2 }));
const fmt = (s) => `${String(Math.floor(Math.max(0, s || 0) / 60)).padStart(2, '0')}:${String(Math.max(0, Math.floor((s || 0) % 60))).padStart(2, '0')}`;
const faixa = (p) => (p === null || p === undefined ? 'sem' : p >= 80 ? 'alto' : p >= 60 ? 'medio' : 'baixo');
const ICONE = { sim: '✔', parcial: '◐', nao: '✘' };
const ROTULO = { sim: 'Sim', parcial: 'Parcial', nao: 'Não' };
const DIVERGE = { avaliador_mais_generoso: 'Marcação acima do que a fala sustenta', avaliador_mais_rigoroso: 'A fala sustenta mais do que foi marcado' };
const data = (d) => (d ? new Date(d).toLocaleDateString('pt-BR') : '');

function Barra({ valor, marca, rotulo }) {
  return (
    <span className={`an-barra f-${faixa(valor)}`} role="img" aria-label={`${rotulo}: ${valor ?? 'sem dados'}%${marca != null ? `; sua média nas outras estações ${marca}%` : ''}`}>
      <i style={{ width: `${Math.min(100, Math.max(0, valor ?? 0))}%` }} />
      {marca != null && <u style={{ left: `${Math.min(100, Math.max(0, marca))}%` }} title={`média anterior ${marca}%`} />}
    </span>
  );
}

/** Linha com as notas (%) das tentativas desta estação. */
function Tentativas({ lista }) {
  if (lista.length < 2) return <p className="sub">Faça a estação de novo para ver a evolução entre tentativas.</p>;
  const W = 280; const H = 70; const x = (i) => 12 + (i * (W - 24)) / (lista.length - 1); const y = (p) => H - 10 - ((p ?? 0) / 100) * (H - 20);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="an-linha" role="img" aria-label={`Evolução nas tentativas: ${lista.map((t) => `${t.percentual}%`).join(', ')}`}>
      <polyline fill="none" stroke="var(--mar)" strokeWidth="2.5" points={lista.map((t, i) => `${x(i)},${y(t.percentual)}`).join(' ')} />
      {lista.map((t, i) => <g key={t.id}><circle cx={x(i)} cy={y(t.percentual)} r={t.atual ? 5 : 3.5} fill={t.atual ? 'var(--coral)' : 'var(--mar)'} /><text x={x(i)} y={y(t.percentual) - 8} textAnchor="middle" fontSize="9" fill="currentColor">{t.percentual}%</text></g>)}
    </svg>
  );
}

function Destaque({ texto, trechos }) {
  const partes = useMemo(() => {
    const t = trechos.filter((x) => x && x.length > 3).map((x) => x.toLowerCase());
    if (!t.length) return [{ s: texto, h: false }];
    const baixo = texto.toLowerCase(); const marcas = [];
    for (const f of t) { const i = baixo.indexOf(f); if (i >= 0) marcas.push([i, i + f.length]); }
    marcas.sort((a, b) => a[0] - b[0]);
    const out = []; let pos = 0;
    for (const [a, b] of marcas) { if (a < pos) continue; if (a > pos) out.push({ s: texto.slice(pos, a), h: false }); out.push({ s: texto.slice(a, b), h: true }); pos = b; }
    if (pos < texto.length) out.push({ s: texto.slice(pos), h: false });
    return out;
  }, [texto, trechos]);
  return <>{partes.map((p, i) => (p.h ? <mark key={i}>{p.s}</mark> : <span key={i}>{p.s}</span>))}</>;
}

export default function TelaAnalise({ execId, token, api, aoVoltar, aoPraticar, aoCartoes, aoNovaEstacao }) {
  const [d, setD] = useState(null);
  const [erro, setErro] = useState('');
  const [sel, setSel] = useState(new Set());
  const [msg, setMsg] = useState({ t: '', e: false });
  const [ocupado, setOcupado] = useState('');
  const [revisando, setRevisando] = useState(null);     // marcas em edição (só avaliador)
  const [abordagem, setAbordagem] = useState('');
  const [cartoes, setCartoes] = useState(null);

  const carregar = useCallback(async () => {
    try {
      const r = await api(`/api/estudo/execucoes/${execId}/analise`, { token });
      setD(r); setErro('');
      setSel((atual) => (atual.size ? atual : new Set(r.itens.filter((i) => i.resultado !== 'sim').map((i) => i.id))));
    } catch (e) { setErro(e.message); }
  }, [api, token, execId]);
  useEffect(() => { setD(null); carregar(); }, [carregar]);

  if (!d) return <div className="tela an-tela"><div className="an-topo"><h2>Análise da estação</h2><button type="button" className="ln" onClick={aoVoltar}>Voltar</button></div>{erro ? <div className="msg e" role="alert">{erro}</div> : <p className="sub" role="status">Montando a análise…</p>}</div>;

  const { execucao: e, itens } = d;
  const euCandidato = d.meu_papel === 'candidato';
  const alternarLiberacao = async () => {
    setOcupado('liberar');
    try { await api(`/api/execucoes/${execId}/transcricao/liberar`, { metodo: 'POST', token, corpo: { liberada: !d.transcricao.liberada } }); await carregar(); }
    catch (x) { setMsg({ t: x.message, e: true }); } finally { setOcupado(''); }
  };
  const alternar = (id) => setSel((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const escolhidos = itens.filter((i) => sel.has(i.id));
  const trechos = itens.map((i) => i.sugestao?.evidencia).filter(Boolean);
  const acao = (nome, fn) => async () => { setOcupado(nome); setMsg({ t: '', e: false }); try { await fn(); } catch (x) { setMsg({ t: x.message, e: true }); } finally { setOcupado(''); } };

  const gerarCartoes = (modo, todos = false) => acao(`cartoes-${modo}${todos ? '-todos' : ''}`, async () => {
    const r = await api(`/api/estudo/execucoes/${execId}/cartoes`, { metodo: 'POST', token, corpo: todos ? { todos: true, modo } : { itens: [...sel], modo } });
    setCartoes(r); setMsg({ t: r.total ? `${r.total} cartão(ões) criado(s) e já na sua repetição espaçada${r.sem_diretriz ? ' (sem diretriz de referência: confira o conteúdo)' : ''}.` : (r.aviso || 'Nada novo para criar.'), e: false });
    carregar();
  });
  const novaEstacao = acao('nova', async () => {
    const r = await api(`/api/estacoes/${e.estacao_id}/variar`, { metodo: 'POST', token, corpo: { abordagem, foco: escolhidos.map((i) => i.descricao) } });
    aoNovaEstacao?.(r.id);
  });
  const salvarRevisao = acao('revisao', async () => {
    const r = await api(`/api/execucoes/${execId}/revisao-nota`, { metodo: 'PUT', token, corpo: { marcas: revisando } });
    setRevisando(null); setMsg({ t: `Nota revisada: ${pts(r.nota)} de ${pts(r.max)} (era ${pts(r.nota_original)}).`, e: false }); await carregar();
  });
  const iniciarRevisao = () => setRevisando(Object.fromEntries(itens.map((i) => [i.id, i.resultado])));

  const fortes = d.resumo.pontos_fortes.length ? d.resumo.pontos_fortes.length : d.fortes.length;
  const fracos = d.resumo.pontos_fracos.length ? d.resumo.pontos_fracos.length : d.fracos.length;
  const nTrechos = d.transcricao.total ?? d.transcricao.segmentos.length;
  const quadros = [
    { id: 'resumo', titulo: 'Resumo de desempenho', testid: 'resumo', resumo: `${fortes} ponto(s) forte(s) · ${fracos} a melhorar`, corpo: (
      <>
        <div className="an-cols">
          <div><h4>Pontos fortes</h4>{(d.resumo.pontos_fortes.length ? d.resumo.pontos_fortes : d.fortes.map((s) => `${s.secao} (${s.percentual}%)`)).map((t) => <p key={t} className="an-forte">✔ {t}</p>)}{!d.resumo.pontos_fortes.length && !d.fortes.length && <p className="sub">Nenhuma seção acima de 80% desta vez.</p>}</div>
          <div><h4>A melhorar</h4>{(d.resumo.pontos_fracos.length ? d.resumo.pontos_fracos : d.fracos.map((s) => `${s.secao} (${s.percentual}%)`)).map((t) => <p key={t} className="an-fraco">✘ {t}</p>)}{!d.resumo.pontos_fracos.length && !d.fracos.length && <p className="sub">Nenhuma seção abaixo de 60%.</p>}</div>
        </div>
        {d.resumo.desempenho && <p data-testid="desempenho-ia">{d.resumo.desempenho}</p>}
        <h4>Sugestões</h4>
        <ul>{d.resumo.sugestoes.map((s) => <li key={s}>{s}</li>)}</ul>
        <p className="sub">{d.transcricao.analise_fonte === 'ia' ? 'Resumo e conferência feitos por IA a partir da transcrição' : d.transcricao.analise_fonte ? 'Conferência feita por palavras do item (IA indisponível)' : 'Sem transcrição'}; confira sempre com o PEP oficial.</p>
      </>
    ) },
    { id: 'secoes', titulo: 'Por seção do checklist', testid: 'secoes', resumo: `${d.secoes.length} seção(ões)${d.secoes.length ? `; pior: ${[...d.secoes].sort((a, b) => (a.percentual ?? 101) - (b.percentual ?? 101))[0].secao}` : ''}`, corpo: (
      <>
        {d.secoes.map((s) => (
          <div key={s.secao} className="an-linha-barra"><span>{s.secao}</span><Barra valor={s.percentual} marca={s.media_historica} rotulo={s.secao} /><b>{s.percentual ?? '—'}%</b>{s.diferenca !== null && <em className={s.diferenca >= 0 ? 'sobe' : 'desce'}>{s.diferenca >= 0 ? '+' : ''}{s.diferenca} vs. média</em>}</div>
        ))}
        <p className="sub">A marca vertical é a sua média nessa seção nas outras estações.</p>
      </>
    ) },
    { id: 'comparacao', titulo: 'Comparação com outras estações', testid: 'comparacao', resumo: d.comparacao.media_area !== null ? `Sua média na área: ${d.comparacao.media_area}%` : `${d.comparacao.tentativas.length} tentativa(s)`, corpo: (
      <>
        {d.comparacao.recentes.map((r) => (
          <div key={r.id} className={`an-linha-barra${r.atual ? ' atual' : ''}`}><span>{r.titulo}{r.atual ? ' (esta)' : ''}</span><Barra valor={r.percentual} marca={d.comparacao.media_area} rotulo={r.titulo} /><b>{r.percentual ?? '—'}%</b></div>
        ))}
        {d.comparacao.media_area !== null && <p className="sub">Marca: sua média nas outras estações de {AREAS[e.area] ?? e.area} ({d.comparacao.media_area}%).</p>}
        <h4>Evolução nesta estação</h4>
        <Tentativas lista={d.comparacao.tentativas} />
      </>
    ) },
    { id: 'itens', titulo: 'Itens do checklist × o que foi falado', testid: 'itens', largo: true, resumo: `${itens.length} itens · ${d.divergentes} divergência(s) · ${itens.filter((i) => i.resultado !== 'sim').length} a trabalhar`, corpo: (
      <>
        <p className="sub">Marque os pontos que quer trabalhar: eles viram cartões de revisão, trilha e a nova estação.</p>
        {itens.map((i) => (
          <div key={i.id} className={`an-item r-${i.resultado}${i.divergencia ? ' div' : ''}`} data-item={i.id}>
            <label className="an-sel"><input type="checkbox" checked={sel.has(i.id)} onChange={() => alternar(i.id)} aria-label={`Trabalhar: ${i.descricao}`} /><span>{i.descricao}{i.critico && <em className="crit"> crítico</em>}</span></label>
            <div className="an-item-meta">
              <span className="an-chip">Avaliador: {ICONE[i.resultado]} {ROTULO[i.resultado]} · {pts(i.pontos)}/{pts(i.pontos_total)}</span>
              {i.sugestao && i.sugestao.confiavel !== false && <span className={`an-chip fala r-${i.sugestao.resultado}`}>Fala: {ICONE[i.sugestao.resultado]} {ROTULO[i.sugestao.resultado]}</span>}
              {i.divergencia && <span className="an-chip alerta" role="note">{DIVERGE[i.divergencia]}</span>}
            </div>
            {i.sugestao?.evidencia && <blockquote>“{i.sugestao.evidencia}”</blockquote>}
            {i.sugestao?.justificativa && <p className="sub">{i.sugestao.justificativa}</p>}
            {i.sugestao?.equivalencia && <p className="sub"><b>Equivalência com o critério:</b> {i.sugestao.equivalencia}</p>}
            {i.sugestao?.termo_confuso && <p className="sub"><b>Termo:</b> {i.sugestao.termo_confuso}</p>}
            {i.sugestao?.feedback && <p className="an-fb"><b>Feedback:</b> {i.sugestao.feedback}{i.sugestao.referencia && d.resumo.referencias?.find((r) => r.ref === i.sugestao.referencia) ? <em> — {d.resumo.referencias.find((r) => r.ref === i.sugestao.referencia).titulo}</em> : null}</p>}
            {i.criterio && <p className="sub">Critério: {i.criterio}</p>}
            {revisando && (
              <span className="an-rev" role="group" aria-label={`Nova marcação: ${i.descricao}`}>
                {['sim', 'parcial', 'nao'].map((v) => <button key={v} type="button" className={`sl-m${revisando[i.id] === v ? ' on' : ''}`} aria-pressed={revisando[i.id] === v} onClick={() => setRevisando((m) => ({ ...m, [i.id]: v }))}>{ROTULO[v]}</button>)}
                {i.sugestao?.confiavel !== false && i.sugestao && revisando[i.id] !== i.sugestao.resultado && <button type="button" className="ln" onClick={() => setRevisando((m) => ({ ...m, [i.id]: i.sugestao.resultado }))}>usar o da fala</button>}
              </span>
            )}
          </div>
        ))}
        {d.pode_revisar_nota && !revisando && <button type="button" className="btn mini" onClick={iniciarRevisao}>Revisar a nota com base na fala</button>}
        {revisando && <div className="acoes"><button type="button" className="btn mini menta" disabled={!!ocupado} onClick={salvarRevisao}>Salvar nova nota</button><button type="button" className="btn mini" onClick={() => setRevisando(null)}>Cancelar</button></div>}
      </>
    ) },
    { id: 'transcricao', titulo: `Transcrição da fala (${nTrechos} trecho${nTrechos === 1 ? '' : 's'})`, testid: 'transcricao', largo: true, resumo: d.transcricao.oculta ? 'Aguardando liberação do avaliador' : `${nTrechos} trecho(s) transcrito(s)`, corpo: (
      <>
        {d.pode_liberar_transcricao && (d.transcricao.total ?? 0) > 0 && (
          <div className="acoes" data-testid="liberar-transcricao-analise">
            <span className="sub">{d.transcricao.liberada ? 'O candidato pode reler esta transcrição.' : 'O candidato ainda não pode reler a transcrição.'}</span>
            <button type="button" className={`btn mini${d.transcricao.liberada ? '' : ' menta'}`} disabled={!!ocupado} onClick={alternarLiberacao}>{d.transcricao.liberada ? 'Retirar a liberação' : 'Liberar transcrição ao candidato'}</button>
          </div>)}
        {d.transcricao.oculta
          ? <p className="sub" data-testid="transcricao-oculta" role="note">{d.transcricao.total > 0 ? 'O avaliador ainda não liberou a transcrição da sua fala. A análise abaixo (acertos, lacunas e feedback) já está disponível; quando ele liberar, o texto aparece aqui, minuto a minuto.' : 'Esta estação não teve fala transcrita.'}</p>
          : d.transcricao.segmentos.length === 0
            ? <p className="sub">Esta estação não teve fala transcrita. A conferência pela fala só funciona com a transcrição ligada.</p>
            : <ol className="an-fala an-minutos" data-testid="fala-por-minuto">{(d.por_minuto?.length ? d.por_minuto : [{ minuto: 0, segmentos: d.transcricao.segmentos.map((x) => ({ ...x, ms: 0 })), itens: [] }]).map((m) => (
              <li key={m.minuto}><h4>{m.minuto}º minuto <small>{m.segmentos.length} trecho(s)</small></h4>
                <ul>{m.segmentos.map((x) => <li key={x.ordem}><time>{fmt(Math.floor((x.ms || 0) / 1000))}</time> <Destaque texto={x.texto} trechos={trechos} /></li>)}</ul>
                {m.itens.length > 0 && <p className="sub">Itens do checklist sustentados neste minuto: {m.itens.map((i) => i.descricao).join('; ')}</p>}</li>))}</ol>}
        {d.transcricao.rebaixados > 0 && <p className="sub" role="note">{d.transcricao.rebaixados} ponto(s) que a IA deu como feitos foram rebaixados por não terem trecho correspondente na fala.</p>}
        <p className="sub">A transcrição parou quando a estação foi encerrada.</p>
      </>
    ) },
    ...(euCandidato ? [{ id: 'acoes', titulo: `Revisar e praticar (${escolhidos.length} ponto${escolhidos.length === 1 ? '' : 's'} escolhido${escolhidos.length === 1 ? '' : 's'})`, testid: 'acoes', largo: true, resumo: 'Cartões, resumo, nova tentativa e nova estação', corpo: (
      <>
          <ol className="an-trilha">
            <li><b>Cartões de revisão</b><span>Um cartão por ponto escolhido, ligado a esta estação e ao tema, na sua repetição espaçada.</span>
              <div className="acoes"><button type="button" className="btn mini menta" disabled={!!ocupado || escolhidos.length === 0} onClick={gerarCartoes('pep')}>Cartões do checklist</button>
                <button type="button" className="btn mini" disabled={!!ocupado || escolhidos.length === 0} onClick={gerarCartoes('ia')}>{ocupado === 'cartoes-ia' ? 'Gerando…' : 'Cartões por IA'}</button>
                <button type="button" className="btn mini" disabled={!!ocupado} onClick={gerarCartoes('pep', true)}>Cartões da estação inteira</button>
                {cartoes?.tema_id && cartoes.total > 0 && aoCartoes && <button type="button" className="btn mini" onClick={() => aoCartoes(cartoes.tema_id)}>Estudar agora</button>}
                {aoCartoes && <button type="button" className="btn mini" onClick={() => aoCartoes(null, 'biblioteca')}>Biblioteca de revisão</button>}</div></li>
            <li><b>Resumo específico</b><span>{d.temas[0] ? `Gere um resumo de “${d.temas[0].nome}” com foco em: ${escolhidos[0]?.descricao ?? 'seus pontos fracos'}.` : 'Cadastre ou gere o tema desta estação no mapa.'}</span>
              {d.temas[0] && aoCartoes && <div className="acoes"><button type="button" className="btn mini" onClick={() => aoCartoes(d.temas[0].id, 'mapa')}>Abrir no mapa</button></div>}</li>
            <li><b>Refazer agora</b><span>A correção termina com uma nova tentativa, sem consultar o checklist.</span>
              {aoPraticar && <div className="acoes"><button type="button" className="btn mini" onClick={() => aoPraticar(e.estacao_id)}>Praticar de novo</button></div>}</li>
            <li><b>Outra abordagem</b><span>A IA cria uma estação nova com o mesmo conteúdo, dando ênfase aos pontos escolhidos.</span>
              <label className="campo"><span>Como mudar o caso (opcional)</span><input value={abordagem} maxLength={300} onChange={(ev) => setAbordagem(ev.target.value)} placeholder="Ex.: paciente chega pelo pronto-socorro, com acompanhante" /></label>
              <div className="acoes"><button type="button" className="btn mini" disabled={!!ocupado} onClick={novaEstacao}>{ocupado === 'nova' ? 'Criando…' : 'Gerar nova estação'}</button></div></li>
            <li><b>Voltar depois</b><span>{d.trilha.passos.find((p) => p.tipo === 'reteste')?.em ? `Reteste sugerido a partir de ${data(d.trilha.passos.find((p) => p.tipo === 'reteste').em)}.` : 'Reteste depois de alguns dias para confirmar a consolidação.'}</span></li>
          </ol>
          <p className="sub">{d.cartoes_da_estacao} cartão(ões) desta estação já estão na sua trilha de estudo.</p>
      </>
    ) }] : []),
  ];

  return (
    <div className="tela an-tela" data-testid="painel-analise">
      <div className="an-topo"><div><h2>{e.titulo}</h2><p className="sub">{AREAS[e.area] ?? e.area} · {data(e.finalizada_em)}</p></div><button type="button" className="ln" onClick={aoVoltar}>Voltar</button></div>
      {msg.t && <div className={`msg${msg.e ? ' e' : ''}`} role={msg.e ? 'alert' : 'status'}>{msg.t}</div>}

      <section className="an-kpis" aria-label="Resultado">
        <div className={`an-kpi f-${faixa(e.percentual)}`}><b>{pts(e.nota)}</b><span>de {pts(e.maximo)} pts · {e.percentual ?? '—'}%</span>{e.nota_original !== null && <em>revisada (era {pts(e.nota_original)})</em>}</div>
        <div className="an-kpi"><b>{fmt(e.duracao_s)}</b><span>de {e.duracao_min} min</span></div>
        <div className="an-kpi"><b>{d.divergentes}</b><span>itens em que a fala e a marcação divergem</span></div>
        <div className="an-kpi"><b>{d.comparacao.tentativas.length}</b><span>tentativa(s) nesta estação</span></div>
      </section>

      <PainelQuadros chave="analise" quadros={quadros} abertosPadrao={['resumo']} />
    </div>
  );
}
