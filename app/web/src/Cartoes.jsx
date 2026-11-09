// Cartões de estudo em formato de carta de RPG: carta com moldura por raridade, ícone da área e atributos;
// listagem de TODOS os cartões (10 por página, por área) e assistente didático tema → gerar → revisar → salvar.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Baralho from './Baralho.jsx';
import './cartoes.css';

export const AREAS_C = { clinica_medica: 'Clínica Médica', cirurgia: 'Cirurgia', ginecologia_obstetricia: 'Ginecologia e Obstetrícia', pediatria: 'Pediatria', mfc: 'Medicina de Família e Comunidade', sem_area: 'Sem área' };
export const ICONE_AREA = { clinica_medica: '🩺', cirurgia: '✂️', ginecologia_obstetricia: '🤰', pediatria: '🧸', mfc: '🏡', sem_area: '📚' };
export const RARIDADES = { comum: 'Comum', incomum: 'Incomum', rara: 'Rara', epica: 'Épica', lendaria: 'Lendária' };
const ESTAGIOS = { novo: 'Nova', aprendendo: 'Aprendendo', revisando: 'Revisando', dominado: 'Dominada' };

/** Estrelas de nível 1–5. */
const Estrelas = ({ n }) => <span className="rc-estrelas" aria-label={`nível ${n} de 5`}>{'★'.repeat(n)}<i>{'★'.repeat(5 - n)}</i></span>;

/** A carta. `virada` controla o verso; `aoVirar` (opcional) a torna clicável. O verso só existe no DOM depois de virada. */
export function CartaRPG({ c, virada = false, aoVirar, compacta = false, children }) {
  const raridade = c.raridade ?? 'comum'; const area = c.area ?? 'sem_area';
  return (
    <article className={`rc rc-${raridade}${virada ? ' virada' : ''}${compacta ? ' compacta' : ''}`} data-area={area} data-testid="carta-rpg" data-raridade={raridade}>
      <div className="rc-moldura">
        <header className="rc-topo">
          <span className="rc-ico" aria-hidden="true">{ICONE_AREA[area] ?? '📚'}</span>
          <span className="rc-nome">{c.tema ?? 'Cartão'}</span>
          <span className="rc-raridade">{RARIDADES[raridade]}</span>
        </header>
        <div className="rc-arte" aria-hidden="true"><span>{ICONE_AREA[area] ?? '📚'}</span></div>
        <div className="rc-corpo">
          <p className="rc-frente">{c.frente}</p>
          {virada
            ? <p className="rc-verso" data-testid="verso">{c.verso}</p>
            : aoVirar && <button type="button" className="btn rc-virar" onClick={aoVirar}>Mostrar resposta</button>}
        </div>
        <footer className="rc-atributos">
          <Estrelas n={c.nivel ?? 1} />
          <span title="Estágio da repetição espaçada">{ESTAGIOS[c.estagio] ?? 'Nova'}</span>
          {'acertos' in c && <span title="Acertos / erros">✔ {c.acertos ?? 0} · ✖ {c.erros ?? 0}</span>}
          {c.intervalo_dias > 0 && <span title="Intervalo atual">⏱ {c.intervalo_dias} d</span>}
        </footer>
        {children}
      </div>
    </article>
  );
}

/* ======================= todos os cartões (10 por página, por área) ======================= */
export function TodosCartoes({ token, api, aoNovo }) {
  const [area, setArea] = useState('');
  const [pagina, setPagina] = useState(1);
  const [busca, setBusca] = useState('');
  const [termo, setTermo] = useState('');
  const [d, setD] = useState(null);
  const [erro, setErro] = useState('');
  const [aberta, setAberta] = useState(null);
  const [edit, setEdit] = useState(null);
  const carregar = useCallback(() => {
    const qs = new URLSearchParams({ pagina: String(pagina), por: '10' }); if (area) qs.set('area', area); if (termo) qs.set('busca', termo);
    return api(`/api/estudo/cartoes?${qs}`, { token }).then((r) => { setD(r); setErro(''); }).catch((e) => setErro(e.message));
  }, [api, token, area, pagina, termo]);
  useEffect(() => { carregar(); }, [carregar]);
  const trocarArea = (a) => { setArea(a); setPagina(1); setAberta(null); };
  const salvar = async () => {
    try { await api(`/api/estudo/cartoes/${edit.id}`, { metodo: 'PUT', token, corpo: { frente: edit.frente, verso: edit.verso } }); setEdit(null); await carregar(); } catch (e) { setErro(e.message); }
  };
  const excluir = async (c) => {
    if (!window.confirm('Excluir este cartão?')) return;
    try { await api(`/api/estudo/cartoes/${c.id}`, { metodo: 'DELETE', token }); await carregar(); } catch (e) { setErro(e.message); }
  };
  const itensMesa = useMemo(() => (d?.itens ?? []).map((c) => ({ id: c.id, titulo: c.tema ?? 'Cartão', area: c.area })), [d]);
  const porId = useMemo(() => new Map((d?.itens ?? []).map((c) => [c.id, c])), [d]);
  const areas = Object.keys(AREAS_C);
  const totalGeral = d ? Object.values(d.por_area).reduce((s, n) => s + n, 0) : 0;
  return (
    <section className="rc-lista" data-testid="todos-cartoes" aria-label="Todos os cartões">
      <form className="rc-busca" onSubmit={(e) => { e.preventDefault(); setPagina(1); setTermo(busca.trim()); }}>
        <input type="search" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por tema, pergunta ou resposta" aria-label="Buscar cartões" />
        <button className="btn mini" type="submit">Buscar</button>
        {aoNovo && <button className="btn mini menta" type="button" onClick={aoNovo}>+ Criar cartões</button>}
      </form>
      <div className="rc-abas" role="tablist" aria-label="Áreas">
        <button role="tab" aria-selected={area === ''} className={area === '' ? 'on' : ''} onClick={() => trocarArea('')}>Todas <b>{totalGeral}</b></button>
        {areas.filter((a) => a !== 'sem_area' || d?.por_area?.sem_area).map((a) => (
          <button key={a} role="tab" aria-selected={area === a} className={area === a ? 'on' : ''} onClick={() => trocarArea(a)}>{ICONE_AREA[a]} {AREAS_C[a]} <b>{d?.por_area?.[a] ?? 0}</b></button>
        ))}
      </div>
      {erro && <p className="aviso" role="alert">{erro}</p>}
      {!d ? <p className="sub" role="status">Carregando cartões…</p> : d.itens.length === 0
        ? <p className="sub" data-testid="sem-cartoes">Nenhum cartão {area ? `em ${AREAS_C[area]}` : 'encontrado'}. Use “Criar cartões” para transformar um tema em cartas.</p>
        : (
          <Baralho chave={`cartoes:${area || 'todas'}:${pagina}`} itens={itensMesa} larg={270} alt={400} testid="cartoes-mesa" testidCarta="cartao-lista"
            rotuloPilha={(g) => g[0]?.titulo ?? ''} renderizar={(it) => {
              const c = porId.get(it.id); if (!c) return null;
              return (<div className="rc-item">
                {edit?.id === c.id ? (
                  <div className="rc-edicao">
                    <label>Frente<textarea value={edit.frente} onChange={(e) => setEdit({ ...edit, frente: e.target.value })} rows={3} /></label>
                    <label>Verso<textarea value={edit.verso} onChange={(e) => setEdit({ ...edit, verso: e.target.value })} rows={4} /></label>
                    <div className="rc-acoes"><button className="btn mini menta" onClick={salvar}>Salvar</button><button className="btn mini" onClick={() => setEdit(null)}>Cancelar</button></div>
                  </div>
                ) : (
                  <>
                    <CartaRPG c={c} compacta virada={aberta === c.id} aoVirar={() => setAberta(c.id)} />
                    <div className="rc-acoes">
                      {aberta === c.id && <button className="btn mini" onClick={() => setAberta(null)}>Virar de volta</button>}
                      {c.meu && <><button className="btn mini" onClick={() => setEdit({ id: c.id, frente: c.frente, verso: c.verso })}>Editar</button><button className="btn mini coral" onClick={() => excluir(c)}>Excluir</button></>}
                    </div>
                  </>
                )}
              </div>);
            }} />
        )}
      {d && d.total > 0 && (
        <nav className="rc-pag" aria-label="Paginação" data-testid="paginacao">
          <button className="btn mini" disabled={pagina <= 1} onClick={() => setPagina(pagina - 1)}>← Anterior</button>
          <span data-testid="pagina-info">Página {d.pagina} de {d.paginas} · {d.total} cartões</span>
          <button className="btn mini" disabled={pagina >= d.paginas} onClick={() => setPagina(pagina + 1)}>Próxima →</button>
        </nav>
      )}
    </section>
  );
}

/* ======================= assistente: tema → gerar → revisar → salvar ======================= */
export function AssistenteCartoes({ token, api, temaInicial, aoSalvo }) {
  const [passo, setPasso] = useState(temaInicial ? 2 : 1);
  const [sugestoes, setSugestoes] = useState([]);
  const [nome, setNome] = useState('');
  const [temaId, setTemaId] = useState(temaInicial ?? null);
  const [temaNome, setTemaNome] = useState('');
  const [foco, setFoco] = useState('');
  const [qtd, setQtd] = useState(8);
  const [rascunho, setRascunho] = useState([]);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState('');
  const [feito, setFeito] = useState(null);
  useEffect(() => { api('/api/estudo/trilha', { token }).then((r) => setSugestoes(r.temas.slice(0, 8))).catch(() => {}); }, [api, token]);
  const tentar = async (fn) => { setOcupado(true); setErro(''); try { await fn(); } catch (e) { setErro(e.message); } finally { setOcupado(false); } };
  const escolher = (id, n) => { setTemaId(id); setTemaNome(n); setPasso(2); };
  const criarTema = () => tentar(async () => { const r = await api('/api/estudo/temas/resolver', { metodo: 'POST', token, corpo: { nome } }); escolher(r.id, nome.trim()); });
  const gerar = () => tentar(async () => {
    const r = await api(`/api/estudo/temas/${temaId}/cartoes/rascunho`, { metodo: 'POST', token, corpo: { quantidade: qtd, foco, aprofundar: Boolean(foco) } });
    setRascunho(r.cartoes.map((c, k) => ({ ...c, k }))); setPasso(3);
  });
  const manual = () => { setRascunho([{ frente: '', verso: '', k: 0 }]); setPasso(3); };
  const salvar = () => tentar(async () => {
    const lista = rascunho.filter((c) => c.frente.trim() && c.verso.trim()).map(({ frente, verso }) => ({ frente, verso }));
    const r = await api(`/api/estudo/temas/${temaId}/cartoes`, { metodo: 'POST', token, corpo: { cartoes: lista, origem: 'ia' } });
    setFeito(r); setPasso(4); aoSalvo?.(r);
  });
  const muda = (k, campo, v) => setRascunho((l) => l.map((c) => (c.k === k ? { ...c, [campo]: v } : c)));
  const passos = ['Tema', 'Gerar', 'Revisar', 'Pronto'];
  return (
    <section className="rc-assist" data-testid="assistente-cartoes" aria-label="Criar cartões">
      <ol className="rc-passos" aria-label="Etapas">{passos.map((p, k) => <li key={p} className={passo === k + 1 ? 'on' : passo > k + 1 ? 'ok' : ''} aria-current={passo === k + 1 ? 'step' : undefined}><b>{passo > k + 1 ? '✓' : k + 1}</b> {p}</li>)}</ol>
      {erro && <p className="aviso" role="alert">{erro}</p>}
      {passo === 1 && (
        <div className="rc-passo">
          <h3>1. Qual tema você quer transformar em cartas?</h3>
          <p className="sub">Escolha um dos temas que mais precisam de você agora ou digite outro.</p>
          <div className="rc-chips">{sugestoes.map((t) => <button key={t.id} className="es-chip" onClick={() => escolher(t.id, t.nome)}>{ICONE_AREA[t.area ?? 'sem_area']} {t.nome}</button>)}</div>
          <form className="rc-busca" onSubmit={(e) => { e.preventDefault(); if (nome.trim().length > 1) criarTema(); }}>
            <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Cetoacidose diabética" aria-label="Nome do tema" maxLength={120} />
            <button className="btn mini menta" type="submit" disabled={ocupado || nome.trim().length < 2}>Usar este tema</button>
          </form>
        </div>
      )}
      {passo === 2 && (
        <div className="rc-passo">
          <h3>2. Como gerar as cartas{temaNome ? ` de “${temaNome}”` : ''}?</h3>
          <label>Argumento ou ponto a aprofundar (opcional)<input value={foco} onChange={(e) => setFoco(e.target.value)} maxLength={160} placeholder="Ex.: conduta inicial e critérios de gravidade" /></label>
          <label>Quantidade de cartas: <b>{qtd}</b><input type="range" min="3" max="15" value={qtd} onChange={(e) => setQtd(Number(e.target.value))} /></label>
          <div className="rc-acoes">
            <button className="btn menta" disabled={ocupado} onClick={gerar}>{ocupado ? 'A IA está criando…' : 'Gerar com IA'}</button>
            <button className="btn" onClick={manual}>Escrever à mão</button>
            <button className="btn mini" onClick={() => setPasso(1)}>Trocar tema</button>
          </div>
          <p className="sub">Nada é salvo ainda: você revisa e edita antes.</p>
        </div>
      )}
      {passo === 3 && (
        <div className="rc-passo">
          <h3>3. Revise e edite</h3>
          <div className="rc-grade">
            {rascunho.map((c) => (
              <div key={c.k} className="rc-edicao" data-testid="rascunho-cartao">
                <label>Frente<textarea rows={2} value={c.frente} onChange={(e) => muda(c.k, 'frente', e.target.value)} /></label>
                <label>Verso<textarea rows={3} value={c.verso} onChange={(e) => muda(c.k, 'verso', e.target.value)} /></label>
                <button className="btn mini coral" onClick={() => setRascunho((l) => l.filter((x) => x.k !== c.k))}>Remover</button>
              </div>
            ))}
          </div>
          <div className="rc-acoes">
            <button className="btn mini" onClick={() => setRascunho((l) => [...l, { frente: '', verso: '', k: Date.now() }])}>+ Mais uma carta</button>
            <button className="btn menta" disabled={ocupado || !rascunho.some((c) => c.frente.trim() && c.verso.trim())} onClick={salvar}>{ocupado ? 'Salvando…' : 'Salvar cartas'}</button>
            <button className="btn mini" onClick={() => setPasso(2)}>Voltar</button>
          </div>
        </div>
      )}
      {passo === 4 && feito && (
        <div className="rc-passo" data-testid="cartoes-salvos">
          <h3>Pronto! {feito.total} carta(s) novas na série {feito.serie}.</h3>
          <p className="sub">Elas já entram na revisão espaçada e na lista de todos os cartões.</p>
          <div className="rc-acoes"><button className="btn mini" onClick={() => { setPasso(1); setFeito(null); setRascunho([]); setFoco(''); }}>Criar para outro tema</button></div>
        </div>
      )}
    </section>
  );
}
