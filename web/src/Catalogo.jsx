// Catálogo: lista de referência de estações com estado de estudo, geração por IA a partir do item, matriz de temas por ano
// e (moderador) importação de caderno INEP em texto → pacote .rvpack de rascunhos.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import './catalogo.css';

const AREAS = { clinica_medica: 'Clínica Médica', cirurgia: 'Cirurgia', ginecologia_obstetricia: 'Ginecologia e Obstetrícia', pediatria: 'Pediatria', mfc: 'Medicina de Família e Comunidade' };
const CLASSE = { inep: ['INEP', 'c-inep'], inep_modificado: ['INEP modificada', 'c-mod'], sem_inep: ['Sem INEP', 'c-sem'] };
const STATUS = { nao_estudada: 'Não estudada', estudando: 'Estudando', dominada: 'Dominada' };
const PRIO = ['Sem prioridade', 'Baixa', 'Média', 'Alta'];

function Card({ e, aoSalvar, aoGerar, aoAbrir, aoTema, ocupado, ia }) {
  const [obs, setObs] = useState(e.estudo.observacoes ?? '');
  useEffect(() => setObs(e.estudo.observacoes ?? ''), [e.estudo.observacoes]);
  const [rotulo, cls] = CLASSE[e.classificacao];
  return (
    <li className={`ca-card s-${e.estudo.status}`} data-codigo={e.codigo}>
      <div className="ca-topo">
        <h3>{aoTema ? <button type="button" className="ln" data-testid="tema-detalhe" onClick={() => aoTema({ nome: e.titulo, area: e.area })} title="Abrir o quadro explicativo do tema">{e.titulo}</button> : e.titulo}</h3>
        <span className={`ca-selo ${cls}`}>{rotulo}{e.inep_edicao ? ` ${e.inep_edicao}` : ''}</span>
      </div>
      <p className="ca-meta">{AREAS[e.area]}{e.especialidade && e.especialidade !== AREAS[e.area] ? ` · ${e.especialidade}` : ''}{e.procedimento ? ' · procedimento' : ''}{e.didatica ? ' · didática' : ''} · {e.duracao_min} min</p>
      <div className="ca-controles">
        <label>Estudo
          <select value={e.estudo.status} onChange={(ev) => aoSalvar(e.codigo, { status: ev.target.value })}>
            {Object.entries(STATUS).map(([k, n]) => <option key={k} value={k}>{n}</option>)}
          </select>
        </label>
        <label>Prioridade
          <select value={e.estudo.prioridade} onChange={(ev) => aoSalvar(e.codigo, { prioridade: Number(ev.target.value) })}>
            {PRIO.map((n, i) => <option key={i} value={i}>{n}</option>)}
          </select>
        </label>
      </div>
      <label className="ca-obs">Anotações
        <textarea rows={2} maxLength={2000} value={obs} onChange={(ev) => setObs(ev.target.value)} onBlur={() => obs !== (e.estudo.observacoes ?? '') && aoSalvar(e.codigo, { observacoes: obs })} />
      </label>
      <div className="ca-acoes">
        {e.estudo.estacao_id
          ? <button type="button" className="btn mini" onClick={() => aoAbrir(e.estudo.estacao_id)}>Abrir estação</button>
          : <button type="button" className="btn mini menta" disabled={ocupado || !ia} onClick={() => aoGerar(e)} title={ia ? '' : 'A IA não está configurada neste servidor'}>{ocupado ? 'Gerando…' : 'Gerar estação'}</button>}
      </div>
    </li>
  );
}

export function CatalogoLista({ token, api, aoAbrir, aoTema }) {
  const [f, setF] = useState({ area: '', classificacao: '', status: '', busca: '', procedimento: '' });
  const [d, setD] = useState(null); const [erro, setErro] = useState(''); const [msg, setMsg] = useState(''); const [gerando, setGerando] = useState(null); const [ia, setIa] = useState(true);
  const carregar = useCallback(() => {
    const qs = new URLSearchParams(Object.entries(f).filter(([, v]) => v)).toString();
    return api(`/api/catalogo${qs ? `?${qs}` : ''}`, { token }).then(setD).catch((e) => setErro(e.message));
  }, [f, api, token]);
  useEffect(() => { const t = setTimeout(carregar, f.busca ? 250 : 0); return () => clearTimeout(t); }, [carregar]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { api('/api/ia/estado', { token }).then((r) => setIa(!!r.configurado)).catch(() => {}); }, [api, token]);
  const salvar = async (codigo, corpo) => { setErro(''); try { await api(`/api/catalogo/${codigo}/estudo`, { metodo: 'PUT', token, corpo }); await carregar(); } catch (e) { setErro(e.message); } };
  const gerar = async (e) => {
    setErro(''); setMsg(''); setGerando(e.codigo);
    try {
      const g = await api('/api/estacoes/gerar', { metodo: 'POST', token, corpo: { area: e.area, subtema: e.titulo, instrucoes: `Estação do catálogo (${CLASSE[e.classificacao][0]}${e.inep_edicao ? ` ${e.inep_edicao}` : ''}). ${e.procedimento ? 'Inclui procedimento prático. ' : ''}${e.didatica ? 'Foco didático. ' : ''}` } });
      await api(`/api/catalogo/${e.codigo}/estudo`, { metodo: 'PUT', token, corpo: { estacao_id: g.id } });
      setMsg(`Rascunho criado para “${e.titulo}”. Revise antes de publicar.`); await carregar();
    } catch (x) {
      const ex = x.dados?.existente;
      setErro(ex ? `Já existe a estação «${ex.titulo}» ${x.dados.tipo === 'conteudo' ? 'com este mesmo conteúdo' : 'com este título'}. Abra-a em vez de gerar outra.` : x.message);
    } finally { setGerando(null); }
  };
  const k = d?.kpis;
  const set = (c) => (ev) => setF((a) => ({ ...a, [c]: ev.target.type === 'checkbox' ? (ev.target.checked ? '1' : '') : ev.target.value }));
  return (
    <>
      {k && (
        <div className="ca-kpis" aria-label="Resumo do catálogo">
          <div><b>{k.total}</b><span>estações</span></div><div><b>{k.inep}</b><span>com base INEP</span></div>
          <div><b>{k.dominadas}</b><span>dominadas</span></div><div><b>{k.estudando}</b><span>estudando</span></div><div><b>{k.com_estacao}</b><span>com estação</span></div>
        </div>
      )}
      {k && <div className="ca-areas">{k.por_area.map((a) => <button key={a.area} type="button" className={f.area === a.area ? 'on' : ''} onClick={() => setF((x) => ({ ...x, area: x.area === a.area ? '' : a.area }))}>
        <span>{AREAS[a.area]}</span><i><u style={{ width: `${a.total ? Math.round((a.dominadas / a.total) * 100) : 0}%` }} /></i><em>{a.dominadas}/{a.total}</em></button>)}</div>}
      <div className="ca-filtros">
        <label className="campo">Buscar<input type="search" value={f.busca} onChange={set('busca')} placeholder="título da estação" /></label>
        <label className="campo">Origem<select value={f.classificacao} onChange={set('classificacao')}><option value="">Todas</option>{Object.entries(CLASSE).map(([c, [n]]) => <option key={c} value={c}>{n}</option>)}</select></label>
        <label className="campo">Estudo<select value={f.status} onChange={set('status')}><option value="">Todos</option>{Object.entries(STATUS).map(([c, n]) => <option key={c} value={c}>{n}</option>)}</select></label>
        <label className="ca-chk"><input type="checkbox" checked={f.procedimento === '1'} onChange={set('procedimento')} />Só com procedimento</label>
      </div>
      {erro && <p className="erro" role="alert">{erro}</p>}{msg && <p className="ca-ok" role="status">{msg}</p>}
      {!d ? <p>Carregando…</p> : d.itens.length === 0 ? <p className="ca-vazio">Nenhuma estação com esses filtros.</p> : (
        <>
          <p className="ca-conta" aria-live="polite">{d.itens.length} estações</p>
          <ul className="ca-lista">{d.itens.slice(0, 120).map((e) => <Card key={e.codigo} e={e} aoSalvar={salvar} aoGerar={gerar} aoAbrir={aoAbrir} aoTema={aoTema} ocupado={gerando === e.codigo} ia={ia} />)}</ul>
          {d.itens.length > 120 && <p className="ca-conta">Mostrando as 120 primeiras. Refine a busca ou os filtros.</p>}
        </>
      )}
    </>
  );
}

export function CatalogoTemas({ token, api, aoTema }) {
  const [area, setArea] = useState(''); const [d, setD] = useState(null); const [erro, setErro] = useState('');
  useEffect(() => { setD(null); api(`/api/catalogo/temas-prova${area ? `?area=${area}` : ''}`, { token }).then(setD).catch((e) => setErro(e.message)); }, [area, api, token]);
  const max = useMemo(() => Math.max(1, ...(d?.linhas ?? []).map((l) => l.vezes)), [d]);
  return (
    <>
      <label className="campo">Área<select value={area} onChange={(e) => setArea(e.target.value)}><option value="">Todas</option>{Object.entries(AREAS).map(([k, n]) => <option key={k} value={k}>{n}</option>)}</select></label>
      {erro && <p className="erro" role="alert">{erro}</p>}
      {!d ? <p>Carregando…</p> : (
        <div className="ca-matriz" role="region" aria-label="Temas cobrados por ano" tabIndex={0}>
          <table>
            <thead><tr><th scope="col">Tema</th><th scope="col">×</th>{d.anos.map((a) => <th key={a} scope="col">{a.replace(/^20/, '')}</th>)}</tr></thead>
            <tbody>{d.linhas.slice(0, 150).map((l) => (
              <tr key={l.tema + l.area}><th scope="row">{aoTema ? <button type="button" className="ln" data-testid="tema-detalhe" onClick={() => aoTema({ nome: l.tema, area: l.area })} title="Abrir o quadro explicativo do tema">{l.tema}</button> : l.tema}</th><td><b>{l.vezes}</b></td>
                {d.anos.map((a) => { const n = l.anos.filter((x) => x === a).length; return <td key={a} className={n ? 'on' : ''} style={n ? { opacity: 0.45 + 0.55 * (l.vezes / max) } : undefined} aria-label={n ? `${l.tema}, ${a}: cobrado` : undefined}>{n ? '●' : ''}</td>; })}</tr>))}</tbody>
          </table>
        </div>
      )}
    </>
  );
}

export function ImportarCaderno({ token, usuario, api }) {
  const [area, setArea] = useState('ginecologia_obstetricia'); const [res, setRes] = useState(null); const [erro, setErro] = useState(''); const [carregando, setCarregando] = useState(false);
  if (!['moderador', 'admin', 'root'].includes(usuario.papel_app)) return <p className="ca-vazio">A importação de cadernos é feita por moderadores e administradores.</p>;
  const enviar = async (ev) => {
    const arq = ev.target.files?.[0]; if (!arq) return; setErro(''); setRes(null); setDentro(null); setCarregando(true);
    try { const texto = await arq.text(); setRes(await api('/api/catalogo/importar-ebook', { metodo: 'POST', token, corpo: { area, texto } })); } catch (e) { setErro(e.message); } finally { setCarregando(false); }
  };
  const baixar = () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(res.pacote, null, 1)], { type: 'application/json' }));
    const a = document.createElement('a'); a.href = url; a.download = `caderno-inep-${area}.rvpack`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const [dentro, setDentro] = useState(null);
  const importarAgora = async () => {
    setErro(''); setCarregando(true);
    try { setDentro(await api('/api/estacoes/importar-pacote', { metodo: 'POST', token, corpo: { pacote: res.pacote } })); } catch (e) { setErro(e.message); } finally { setCarregando(false); }
  };
  const ok = res?.relatorio.filter((r) => r.importada) ?? []; const nao = res?.relatorio.filter((r) => !r.importada) ?? [];
  return (
    <div className="ca-imp">
      <p>Envie o <b>texto</b> (.txt) de um caderno de estações INEP. Cada estação com pontuação por item vira um rascunho, que você importa direto ou baixa como pacote. Estações que já existem não são repetidas. Nada é publicado automaticamente: trechos que o leitor não conseguiu confirmar ficam marcados para conferência.</p>
      <label className="campo">Área do caderno<select value={area} onChange={(e) => setArea(e.target.value)}>{Object.entries(AREAS).map(([k, n]) => <option key={k} value={k}>{n}</option>)}</select></label>
      <label className="campo">Arquivo de texto<input type="file" accept=".txt,text/plain" onChange={enviar} /></label>
      {carregando && <p>Lendo o caderno…</p>}{erro && <p className="erro" role="alert">{erro}</p>}
      {res && (
        <>
          <p role="status"><b>{ok.length}</b> estações lidas · <b>{nao.length}</b> não importadas.</p>
          {res.pacote && <div className="acoes">
            <button type="button" className="btn mini menta" disabled={carregando || Boolean(dentro)} onClick={importarAgora}>Importar estas estações agora</button>
            <button type="button" className="btn mini" onClick={baixar}>Baixar pacote (.rvpack)</button></div>}
          {dentro && <p role="status" data-testid="caderno-importado"><b>{dentro.importadas}</b> entraram como rascunho · <b>{dentro.duplicadas ?? 0}</b> já existiam e foram ignoradas{dentro.rejeitadas - (dentro.duplicadas ?? 0) > 0 ? ` · ${dentro.rejeitadas - (dentro.duplicadas ?? 0)} rejeitadas` : ''}.</p>}
          <ul className="ca-rel">
            {ok.map((r) => <li key={r.edicao + r.titulo} className={r.a_conferir.length ? 'conf' : 'bom'}><b>{r.titulo}</b> <em>{r.edicao}</em> — {r.itens} itens, soma {r.soma}{r.a_conferir.length ? ` · conferir: ${r.a_conferir.join(', ')}` : ''}</li>)}
            {nao.map((r) => <li key={r.edicao + r.titulo} className="nao"><b>{r.titulo}</b> <em>{r.edicao}</em> — {r.motivo}</li>)}
          </ul>
        </>
      )}
    </div>
  );
}
