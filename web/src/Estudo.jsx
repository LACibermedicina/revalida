// Estudo: trilha de aprendizagem (do menor ao maior desempenho, ou o contrário), cartões com repetição espaçada,
// mapa 3D de temas, caderno de erros com revisão por estação e diretrizes de referência.
// A IA gera resumos, cartões e novas ligações do mapa; o que não tem diretriz cadastrada aparece marcado "sem diretriz de referência".
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { layout3D, projetar, escolherNo, faixaDesempenho } from './grafo3d.js';
import './estudo.css';

const AREAS = { clinica_medica: 'Clínica Médica', cirurgia: 'Cirurgia', ginecologia_obstetricia: 'Ginecologia e Obstetrícia', pediatria: 'Pediatria', mfc: 'Medicina de Família e Comunidade' };
const CATEGORIAS = [['conhecimento', 'Conhecimento'], ['sequencia', 'Sequência'], ['comunicacao', 'Comunicação'], ['tempo', 'Tempo']];
const TIPO_REL = { relacionado: 'relacionado', pre_requisito: 'pré-requisito', diagnostico_diferencial: 'diagnóstico diferencial', complicacao: 'complicação', conduta: 'conduta' };
const pct = (d) => (d === null || d === undefined ? '—' : `${Math.round(d * 100)}%`);
const ABAS = [['trilha', 'Trilha'], ['cartoes', 'Cartões'], ['mapa', 'Mapa 3D'], ['erros', 'Caderno de erros'], ['guia', 'Guia de treino'], ['diretrizes', 'Diretrizes']];

function Aviso({ semDiretriz }) {
  return semDiretriz ? <p className="es-sem" role="note">Sem diretriz de referência cadastrada: este conteúdo segue o consenso clínico geral e precisa ser conferido. A administração pode cadastrar a diretriz na aba Diretrizes.</p> : null;
}
function Barra({ valor }) {
  return <span className={`es-barra f-${faixaDesempenho(valor)}`} role="img" aria-label={`desempenho ${pct(valor)}`}><i style={{ width: `${Math.round((valor ?? 0) * 100)}%` }} /></span>;
}

export default function TelaEstudo({ token, usuario, api, comando, aoPraticar, aoAnalise }) {
  const [aba, setAba] = useState('trilha');
  const [temaCartoes, setTemaCartoes] = useState(null);
  const [temaMapa, setTemaMapa] = useState(null);
  useEffect(() => {
    if (!comando?.aba || !ABAS.some(([k]) => k === comando.aba)) return;
    if (comando.tema) { if (comando.aba === 'mapa') setTemaMapa(comando.tema); else if (comando.aba === 'cartoes') setTemaCartoes(comando.tema); }
    setAba(comando.aba);
  }, [comando?.n]); // eslint-disable-line react-hooks/exhaustive-deps
  const abrirCartoes = (id) => { setTemaCartoes(id ?? null); setAba('cartoes'); };
  const abrirMapa = (id) => { setTemaMapa(id ?? null); setAba('mapa'); };
  const comum = { token, usuario, api };
  return (
    <div className="tela es-tela">
      <h2>Estudo</h2>
      <div className="es-abas" role="tablist" aria-label="Seções do estudo">
        {ABAS.map(([k, n]) => <button key={k} role="tab" aria-selected={aba === k} className={aba === k ? 'on' : ''} onClick={() => { setAba(k); if (k === 'cartoes') setTemaCartoes(null); }}>{n}</button>)}
      </div>
      {aba === 'trilha' && <Trilha {...comum} aoCartoes={abrirCartoes} aoMapa={abrirMapa} aoPraticar={aoPraticar} />}
      {aba === 'cartoes' && <Cartoes {...comum} tema={temaCartoes} />}
      {aba === 'mapa' && <Mapa {...comum} inicial={temaMapa} aoCartoes={abrirCartoes} aoPraticar={aoPraticar} />}
      {aba === 'erros' && <Erros {...comum} aoAnalise={aoAnalise} />}
      {aba === 'guia' && <Guia />}
      {aba === 'diretrizes' && <Diretrizes {...comum} />}
    </div>
  );
}

/* ======================= trilha ======================= */
function Trilha({ token, api, aoCartoes, aoMapa, aoPraticar }) {
  const [ordem, setOrdem] = useState('fracos');
  const [d, setD] = useState(null);
  const [erro, setErro] = useState('');
  useEffect(() => { setD(null); api(`/api/estudo/trilha?ordem=${ordem}`, { token }).then(setD).catch((e) => setErro(e.message)); }, [ordem, api, token]);
  if (erro) return <p className="aviso" role="alert">{erro}</p>;
  if (!d) return <p className="sub" role="status">Montando sua trilha…</p>;
  return (
    <>
      <div className="es-linha">
        <p className="sub">Temas das estações que você fez e dos que ainda faltam medir.</p>
        <div className="es-ordem" role="group" aria-label="Ordem da trilha">
          <button aria-pressed={ordem === 'fracos'} className={ordem === 'fracos' ? 'on' : ''} onClick={() => setOrdem('fracos')}>Do mais fraco</button>
          <button aria-pressed={ordem === 'fortes'} className={ordem === 'fortes' ? 'on' : ''} onClick={() => setOrdem('fortes')}>Do mais forte</button>
        </div>
      </div>
      {d.temas.length === 0 && <p className="sub">Ainda não há temas. Faça uma estação em 🔁 Ciclos ou crie uma em ✏️ Criar.</p>}
      <ol className="es-trilha" data-testid="trilha">
        {d.temas.map((t) => (
          <li key={t.id} className={`es-tema f-${faixaDesempenho(t.desempenho)}`}>
            <div className="es-linha"><strong>{t.nome}</strong><span className="es-pct">{pct(t.desempenho)}</span></div>
            <Barra valor={t.desempenho} />
            <p className="sub">{t.area ? `${AREAS[t.area]} · ` : ''}{t.execucoes} estação(ões) · {t.cartoes_total} cartões{t.cartoes_vencidos > 0 ? ` (${t.cartoes_vencidos} para hoje)` : ''}</p>
            <p className="es-passo">{t.texto}</p>
            {t.alvos.length > 0 && <ul className="es-alvos">{t.alvos.map((a, i) => <li key={i}>{a}</li>)}</ul>}
            <div className="es-acoes">
              <button className="btn mini menta" onClick={() => aoCartoes(t.id)}>Cartões</button>
              <button className="btn mini" onClick={() => aoMapa(t.id)}>Ver no mapa</button>
              {t.estacoes.length > 0 && aoPraticar && <button className="btn mini" onClick={() => aoPraticar(t.estacoes[0].id)}>Praticar: {t.estacoes[0].titulo}</button>}
            </div>
          </li>
        ))}
      </ol>
      {d.retestes.length > 0 && (
        <section className="es-bloco" aria-label="Retestes">
          <h3>Refazer</h3>
          <p className="sub">Uma estação feita bem uma vez não consolida: volte nestas.</p>
          {d.retestes.map((r) => <div key={r.estacao_id} className="es-linha"><span>{r.titulo} · {r.percentual}%</span><em className={r.vencido ? 'es-venc' : ''}>{r.vencido ? 'refazer agora' : `a partir de ${new Date(r.vence_em).toLocaleDateString('pt-BR')}`}</em></div>)}
        </section>
      )}
    </>
  );
}

/* ======================= cartões ======================= */
function Cartoes({ token, api, tema }) {
  const [fila, setFila] = useState(null);
  const [i, setI] = useState(0);
  const [virado, setVirado] = useState(false);
  const [feitos, setFeitos] = useState(0);
  const [erro, setErro] = useState('');
  useEffect(() => { setFila(null); setI(0); setVirado(false); setFeitos(0); api(`/api/estudo/cartoes/hoje${tema ? `?tema=${tema}` : ''}`, { token }).then(setFila).catch((e) => setErro(e.message)); }, [tema, api, token]);
  const responder = async (qualidade) => {
    const c = fila[i];
    try { await api(`/api/estudo/cartoes/${c.id}/revisar`, { metodo: 'POST', token, corpo: { qualidade } }); setFeitos((n) => n + 1); setVirado(false); setI((n) => n + 1); } catch (e) { setErro(e.message); }
  };
  if (erro) return <p className="aviso" role="alert">{erro}</p>;
  if (!fila) return <p className="sub" role="status">Buscando cartões…</p>;
  if (i >= fila.length) return (
    <div className="es-bloco" data-testid="cartoes-fim">
      <h3>{fila.length === 0 ? 'Nenhum cartão para hoje' : 'Sessão concluída'}</h3>
      <p className="sub">{fila.length === 0 ? 'Gere uma série de cartões para um tema na Trilha ou no Mapa 3D.' : `${feitos} cartões revisados. Os que você errou voltam amanhã; os outros ficam mais espaçados.`}</p>
    </div>
  );
  const c = fila[i];
  return (
    <div className="es-bloco" data-testid="cartao">
      <p className="sub">{i + 1} de {fila.length} · {c.tema} · série {c.serie}{c.estacao_titulo ? <> · <b data-testid="cartao-estacao">da estação “{c.estacao_titulo}”</b></> : null}</p>
      <div className="es-carta" aria-live="polite">
        <p className="es-frente">{c.frente}</p>
        {virado ? <p className="es-verso" data-testid="verso">{c.verso}</p> : <button className="btn" onClick={() => setVirado(true)}>Mostrar resposta</button>}
      </div>
      {virado && (
        <div className="es-notas" role="group" aria-label="Como foi?">
          <button className="btn mini coral" onClick={() => responder(0)}>Errei</button>
          <button className="btn mini" onClick={() => responder(3)}>Difícil</button>
          <button className="btn mini" onClick={() => responder(4)}>Bom</button>
          <button className="btn mini menta" onClick={() => responder(5)}>Fácil</button>
        </div>
      )}
      <Aviso semDiretriz={c.sem_diretriz} />
    </div>
  );
}

/* ======================= painel do tema (resumos, cartões, expandir) ======================= */
function TemaPainel({ id, token, api, aoCartoes, aoPraticar, aoMudou }) {
  const [t, setT] = useState(null);
  const [ocupado, setOcupado] = useState('');
  const [msg, setMsg] = useState('');
  const [foco, setFoco] = useState('');
  const [aberto, setAberto] = useState(null);
  const carregar = useCallback(() => api(`/api/estudo/temas/${id}`, { token }).then(setT).catch((e) => setMsg(e.message)), [id, api, token]);
  useEffect(() => { setT(null); setMsg(''); setAberto(null); carregar(); }, [carregar]);
  const gerar = async (rotulo, caminho, corpo, ok) => {
    setOcupado(rotulo); setMsg('');
    try { const r = await api(caminho, { metodo: 'POST', token, corpo }); setMsg(ok(r)); await carregar(); aoMudou?.(); } catch (e) { setMsg(e.message); } finally { setOcupado(''); }
  };
  if (!t) return <p className="sub" role="status">{msg || 'Carregando o tema…'}</p>;
  return (
    <section className="es-bloco es-painel" aria-label={`Tema ${t.tema.nome}`}>
      <h3>{t.tema.nome}</h3>
      <p className="sub">{t.tema.area ? AREAS[t.tema.area] : 'Sem área definida'} · {t.diretrizes.length ? `diretriz: ${t.diretrizes.map((d) => d.titulo).join('; ')}` : 'sem diretriz de referência'}</p>
      {t.relacoes.length > 0 && <ul className="es-rels">{t.relacoes.map((r, k) => <li key={k}><em>{TIPO_REL[r.tipo]}</em> {r.nome}{r.motivo ? ` — ${r.motivo}` : ''}</li>)}</ul>}
      <div className="es-acoes">
        <button className="btn mini menta" disabled={!!ocupado} onClick={() => gerar('cartoes', `/api/estudo/temas/${id}/cartoes/gerar`, {}, (r) => `Nova série ${r.serie} com ${r.total} cartões.`)}>{ocupado === 'cartoes' ? 'Gerando…' : 'Nova série de cartões (IA)'}</button>
        <button className="btn mini" disabled={!t.series.length} onClick={() => aoCartoes(id)}>Estudar cartões{t.series.length ? ` (${t.series.reduce((s, x) => s + x.vencidos, 0)} hoje)` : ''}</button>
        <button className="btn mini" disabled={!!ocupado} onClick={() => gerar('expandir', `/api/estudo/temas/${id}/expandir`, {}, (r) => `${r.criados.length} temas ligados ao mapa.`)}>{ocupado === 'expandir' ? 'Expandindo…' : 'Expandir o mapa (IA)'}</button>
      </div>
      <form className="es-foco" onSubmit={(e) => { e.preventDefault(); gerar('resumo', `/api/estudo/temas/${id}/resumo`, { foco }, () => 'Resumo gerado.'); }}>
        <label className="campo"><span>Resumo mais específico (opcional)</span><input value={foco} maxLength={120} onChange={(e) => setFoco(e.target.value)} placeholder="Ex.: conduta na crise prolongada" /></label>
        <button className="btn mini" disabled={!!ocupado}>{ocupado === 'resumo' ? 'Gerando…' : 'Gerar resumo (IA)'}</button>
      </form>
      {ocupado && <p className="sub" role="status">A IA está trabalhando… pode levar até um minuto.</p>}
      {msg && <p className="aviso" role="status">{msg}</p>}
      {t.resumos.map((r) => (
        <article key={r.id} className="es-resumo">
          <button className="ln" aria-expanded={aberto === r.id} onClick={() => setAberto(aberto === r.id ? null : r.id)}>{r.titulo}{r.foco ? ` · ${r.foco}` : ''}</button>
          {aberto === r.id && <><pre className="es-corpo">{r.corpo}</pre><Aviso semDiretriz={!r.diretriz_id} /></>}
        </article>
      ))}
      {t.estacoes.length > 0 && aoPraticar && <div className="es-acoes">{t.estacoes.map((e) => <button key={e.id} className="btn mini" onClick={() => aoPraticar(e.id)}>Praticar: {e.titulo}</button>)}</div>}
    </section>
  );
}

/* ======================= mapa 3D ======================= */
const COR = { sem: '--suave', baixo: '--coral', medio: '--sol', alto: '--menta' };
function Mapa({ token, api, inicial, aoCartoes, aoPraticar }) {
  const [g, setG] = useState(null);
  const [erro, setErro] = useState('');
  const [sel, setSel] = useState(inicial ?? null);
  const [lista, setLista] = useState(false);
  const [filtro, setFiltro] = useState('');
  const carregar = useCallback(() => api('/api/estudo/grafo', { token }).then(setG).catch((e) => setErro(e.message)), [api, token]);
  useEffect(() => { carregar(); }, [carregar]);
  if (erro) return <p className="aviso" role="alert">{erro}</p>;
  if (!g) return <p className="sub" role="status">Montando o mapa…</p>;
  const nos = g.nos.filter((n) => !filtro.trim() || n.nome.toLowerCase().includes(filtro.trim().toLowerCase()));
  return (
    <>
      <div className="es-linha">
        <p className="sub">Cada ponto é um tema; a cor mostra o seu desempenho e as linhas, as relações clínicas. Arraste para girar.</p>
        <button className="btn mini" onClick={() => setLista((v) => !v)} aria-pressed={lista}>{lista ? 'Ver o mapa' : 'Ver como lista'}</button>
      </div>
      {g.nos.length === 0 ? <p className="sub">O mapa começa quando há estações com conceitos. Crie ou publique uma estação.</p> : lista
        ? <>
            <label className="campo"><span>Filtrar temas</span><input value={filtro} onChange={(e) => setFiltro(e.target.value)} /></label>
            <ul className="es-lista" data-testid="lista-temas">{nos.map((n) => <li key={n.id}><button className={`es-item f-${faixaDesempenho(n.desempenho)}${sel === n.id ? ' on' : ''}`} onClick={() => setSel(n.id)}>{n.nome} <em>{pct(n.desempenho)}</em></button></li>)}</ul>
          </>
        : <Canvas3D nos={g.nos} arestas={g.arestas} sel={sel} aoSel={setSel} />}
      <Legenda />
      {sel && <TemaPainel id={sel} token={token} api={api} aoCartoes={aoCartoes} aoPraticar={aoPraticar} aoMudou={carregar} />}
    </>
  );
}
function Legenda() {
  return <p className="es-legenda" aria-label="Legenda">{[['baixo', 'abaixo de 60%'], ['medio', '60–80%'], ['alto', 'acima de 80%'], ['sem', 'sem dados']].map(([k, r]) => <span key={k}><i className={`es-ponto f-${k}`} /> {r}</span>)}</p>;
}

function Canvas3D({ nos, arestas, sel, aoSel }) {
  const ref = useRef(null);
  const est = useRef({ rotY: 0.6, rotX: 0.35, zoom: 1, arrasto: null, auto: true, proj: {}, hover: null, w: 600, h: 420 });
  const pos = useMemo(() => layout3D(nos, arestas), [nos, arestas]);
  const reduz = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const porId = useMemo(() => new Map(nos.map((n) => [n.id, n])), [nos]);

  useEffect(() => {
    const cv = ref.current; if (!cv) return undefined;
    const ctx = cv.getContext('2d'); const s = est.current; let raf = 0; let vivo = true;
    s.auto = !reduz;
    const css = getComputedStyle(document.documentElement);
    const cor = (v) => css.getPropertyValue(v).trim() || '#888';
    const ajustar = () => {
      const r = cv.getBoundingClientRect(); const dpr = window.devicePixelRatio || 1;
      s.w = Math.max(200, r.width); s.h = Math.max(220, r.height);
      cv.width = Math.round(s.w * dpr); cv.height = Math.round(s.h * dpr); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    const desenhar = () => {
      if (!vivo) return;
      if (s.auto && !s.arrasto) s.rotY += 0.003;
      const proj = projetar(pos, { rotY: s.rotY, rotX: s.rotX, zoom: s.zoom, largura: s.w, altura: s.h }); s.proj = proj;
      ctx.clearRect(0, 0, s.w, s.h);
      const vizinhos = new Set(); if (sel) for (const a of arestas) { if (a.de === sel) vizinhos.add(a.para); if (a.para === sel) vizinhos.add(a.de); }
      for (const a of arestas) {
        const p = proj[a.de], q = proj[a.para]; if (!p || !q) continue;
        const dest = sel && (a.de === sel || a.para === sel);
        ctx.globalAlpha = dest ? 0.9 : Math.max(0.12, 0.35 * ((p.s + q.s) / 2 - 0.5)); ctx.strokeStyle = dest ? cor('--mar') : cor('--suave'); ctx.lineWidth = dest ? 2 : 1;
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke();
      }
      const ordem = [...nos].sort((a, b) => (proj[a.id]?.z ?? 0) - (proj[b.id]?.z ?? 0));
      ctx.font = '12px system-ui, sans-serif'; ctx.textAlign = 'center';
      for (const n of ordem) {
        const p = proj[n.id]; if (!p) continue;
        const r = (5 + (n.relevancia ?? 3) * 1.4) * p.s; const dest = n.id === sel || n.id === s.hover || vizinhos.has(n.id);
        ctx.globalAlpha = sel && !dest ? 0.45 : Math.min(1, 0.55 + p.s * 0.35);
        ctx.fillStyle = cor(COR[faixaDesempenho(n.desempenho)]); ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fill();
        if (n.id === sel) { ctx.strokeStyle = cor('--fg'); ctx.lineWidth = 2.5; ctx.stroke(); }
        if (dest || p.s > 1.15) { ctx.globalAlpha = 1; ctx.fillStyle = cor('--fg'); ctx.fillText(n.nome, p.x, p.y - r - 5); }
      }
      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(desenhar);
    };
    ajustar(); const ro = new ResizeObserver(ajustar); ro.observe(cv); raf = requestAnimationFrame(desenhar);
    return () => { vivo = false; cancelAnimationFrame(raf); ro.disconnect(); };
  }, [pos, nos, arestas, sel, reduz]);

  const ponto = (e) => { const r = ref.current.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  const baixar = (e) => { ref.current.setPointerCapture?.(e.pointerId); est.current.arrasto = { x: e.clientX, y: e.clientY, moveu: false }; };
  const mover = (e) => {
    const s = est.current;
    if (s.arrasto) {
      const dx = e.clientX - s.arrasto.x, dy = e.clientY - s.arrasto.y;
      if (Math.abs(dx) + Math.abs(dy) > 3) s.arrasto.moveu = true;
      s.rotY += dx * 0.008; s.rotX = Math.max(-1.3, Math.min(1.3, s.rotX + dy * 0.008)); s.arrasto.x = e.clientX; s.arrasto.y = e.clientY;
    } else { const [x, y] = ponto(e); s.hover = escolherNo(s.proj, nos, x, y); ref.current.style.cursor = s.hover ? 'pointer' : 'grab'; }
  };
  const soltar = (e) => {
    const s = est.current; const a = s.arrasto; s.arrasto = null;
    if (a && !a.moveu) { const [x, y] = ponto(e); const id = escolherNo(s.proj, nos, x, y, { raioBase: e.pointerType === 'touch' ? 22 : 14 }); aoSel(id); }
  };
  const roda = (e) => { e.preventDefault(); est.current.zoom = Math.max(0.5, Math.min(3, est.current.zoom * (e.deltaY < 0 ? 1.1 : 0.9))); };
  const zoom = (f) => { est.current.zoom = Math.max(0.5, Math.min(3, est.current.zoom * f)); };
  const [auto, setAuto] = useState(!reduz);
  return (
    <div className="es-mapa">
      <canvas ref={ref} data-testid="mapa3d" role="img" aria-label={`Mapa 3D com ${nos.length} temas. Use "Ver como lista" para navegar pelo teclado.`}
        onPointerDown={baixar} onPointerMove={mover} onPointerUp={soltar} onPointerLeave={() => { est.current.hover = null; }} onWheel={roda} />
      <div className="es-zoom">
        <button className="btn mini" onClick={() => zoom(1.25)} aria-label="Aproximar">+</button>
        <button className="btn mini" onClick={() => zoom(0.8)} aria-label="Afastar">−</button>
        <button className="btn mini" aria-pressed={auto} onClick={() => { est.current.auto = !auto; setAuto(!auto); }}>{auto ? 'Parar' : 'Girar'}</button>
      </div>
    </div>
  );
}

/* ======================= caderno de erros ======================= */
function Erros({ token, api, aoAnalise }) {
  const [e, setE] = useState(null); const [des, setDes] = useState([]); const [exe, setExe] = useState([]); const [rev, setRev] = useState(null); const [erro, setErro] = useState('');
  const carregar = useCallback(() => {
    api('/api/estudo/erros', { token }).then(setE).catch((x) => setErro(x.message));
    api('/api/estudo/desempenho', { token }).then(setDes).catch(() => {});
    api('/api/estudo/execucoes', { token }).then(setExe).catch(() => {});
  }, [api, token]);
  useEffect(() => { carregar(); }, [carregar]);
  if (erro) return <p className="aviso" role="alert">{erro}</p>;
  if (rev) return <Revisao id={rev} token={token} api={api} aoVoltar={() => { setRev(null); carregar(); }} />;
  if (!e) return <p className="sub" role="status">Carregando…</p>;
  return (
    <>
      <section className="es-bloco" aria-label="Estações para revisar">
        <h3>Revisar uma estação</h3>
        <p className="sub">Depois de executar, registre o que faltou: o comportamento, não só o tema.</p>
        {exe.length === 0 && <p className="sub">Você ainda não tem estações finalizadas como candidato.</p>}
        {exe.slice(0, 8).map((x) => (
          <div key={x.id} className="es-linha"><span>{x.titulo} · {x.maximo > 0 && x.nota !== null ? `${Math.round((x.nota / x.maximo) * 100)}%` : '—'}{x.lacunas > 0 ? ` · ${x.lacunas} lacuna(s)` : ''}</span>
            <span className="acoes"><button className="btn mini" onClick={() => setRev(x.id)}>Revisar</button>{aoAnalise && <button className="btn mini menta" onClick={() => aoAnalise(x.id)}>Ver análise</button>}</span></div>
        ))}
      </section>
      {des.length > 0 && <section className="es-bloco" aria-label="Desempenho por área"><h3>Por área</h3>{des.map((d) => <div key={d.area} className="es-linha"><span>{AREAS[d.area]}</span><span><Barra valor={d.percentual === null ? null : d.percentual / 100} /> {d.percentual ?? '—'}%</span></div>)}</section>}
      <section className="es-bloco" aria-label="Padrões de erro" data-testid="padroes">
        <h3>O que mais custa pontos</h3>
        {e.total === 0 ? <p className="sub">Sem lacunas registradas ainda. Com 10 a 15 estações, os padrões aparecem.</p> : <>
          <p className="sub">{CATEGORIAS.map(([k, n]) => `${n}: ${e.por_categoria[k]}`).join(' · ')}</p>
          <h4>Transversais (3+ estações)</h4>
          {e.transversais.length === 0 ? <p className="sub">Nenhum ainda.</p> : e.transversais.map((x) => <div key={x.chave} className="es-linha es-transv"><span>{x.rotulo}</span><em>{x.total}× em {x.estacoes} estações</em></div>)}
          <h4>De tema</h4>
          {e.de_tema.map((x) => <div key={x.chave} className="es-linha"><span>{x.rotulo}</span><em>{x.total}× em {x.estacoes} estação(ões)</em></div>)}
        </>}
      </section>
    </>
  );
}

function Revisao({ id, token, api, aoVoltar }) {
  const [r, setR] = useState(null); const [m, setM] = useState({}); const [msg, setMsg] = useState(''); const [ocupado, setOcupado] = useState(false);
  useEffect(() => {
    api(`/api/estudo/execucoes/${id}/revisao`, { token }).then((x) => {
      setR(x); setM(Object.fromEntries(x.itens.filter((i) => i.lacuna).map((i) => [i.id, { categoria: i.lacuna.categoria, erro_tipo: i.lacuna.erro_tipo ?? '', descricao: i.lacuna.descricao ?? '' }])));
    }).catch((e) => setMsg(e.message));
  }, [id, api, token]);
  if (!r) return <p className="sub" role="status">{msg || 'Carregando…'}</p>;
  const faltas = r.itens.filter((i) => i.resultado !== 'sim');
  const set = (iid, k, v) => setM((x) => ({ ...x, [iid]: { categoria: 'conhecimento', erro_tipo: '', descricao: '', ...x[iid], [k]: v } }));
  const marcar = (iid, on) => setM((x) => { const n = { ...x }; if (on) n[iid] = { categoria: 'conhecimento', erro_tipo: '', descricao: '' }; else delete n[iid]; return n; });
  const salvar = async () => {
    setOcupado(true); setMsg('');
    try {
      const lacunas = Object.entries(m).map(([pep_item_id, v]) => ({ pep_item_id, categoria: v.categoria, erro_tipo: v.erro_tipo || null, descricao: v.descricao }));
      const x = await api(`/api/estudo/execucoes/${id}/lacunas`, { metodo: 'PUT', token, corpo: { lacunas } }); setMsg(`${x.salvas} lacuna(s) salva(s). ${r.regra}`);
    } catch (e) { setMsg(e.message); } finally { setOcupado(false); }
  };
  return (
    <section className="es-bloco" aria-label="Revisão da estação" data-testid="revisao">
      <div className="es-linha"><h3>{r.titulo}</h3><button className="ln" onClick={aoVoltar}>Voltar</button></div>
      <p className="sub">{r.percentual !== null ? `${r.percentual}% dos pontos.` : ''} Marque o que faltou e diga por quê. Itens lembrados só depois do cronômetro contam como lacuna.</p>
      {faltas.length === 0 && <p className="sub">Você fez todos os itens. Refaça a estação dias depois para consolidar.</p>}
      {faltas.map((i) => (
        <div key={i.id} className={`es-falta r-${i.resultado}`}>
          <label className="es-check"><input type="checkbox" checked={!!m[i.id]} onChange={(e) => marcar(i.id, e.target.checked)} /> <span>{i.descricao}{i.critico ? ' (crítico)' : ''} <em>{i.resultado === 'parcial' ? 'parcial' : 'não feito'}</em></span></label>
          {m[i.id] && (
            <div className="es-grade">
              <label className="campo"><span>Categoria</span><select value={m[i.id].categoria} onChange={(e) => set(i.id, 'categoria', e.target.value)}>{CATEGORIAS.map(([k, n]) => <option key={k} value={k}>{n}</option>)}</select></label>
              <label className="campo"><span>Tipo de erro</span><select value={m[i.id].erro_tipo} onChange={(e) => set(i.id, 'erro_tipo', e.target.value)}><option value="">Outro</option>{Object.entries(r.tipos_erro).map(([k, n]) => <option key={k} value={k}>{n}</option>)}</select></label>
              <label className="campo es-larga"><span>O que faltou (comportamento)</span><input value={m[i.id].descricao} maxLength={300} onChange={(e) => set(i.id, 'descricao', e.target.value)} placeholder="Ex.: não verbalizei a dose do salbutamol" /></label>
            </div>
          )}
        </div>
      ))}
      <button className="btn menta" disabled={ocupado} onClick={salvar}>Salvar lacunas</button>
      {msg && <p className="aviso" role="status">{msg}</p>}
    </section>
  );
}

/* ======================= diretrizes ======================= */
const CATEG = { ministerio: 'Ministério da Saúde', oms: 'OMS', sociedade: 'Sociedade de especialidade', outra: '' };
function Diretrizes({ token, usuario, api }) {
  const [lista, setLista] = useState(null); const [f, setF] = useState({ titulo: '', fonte: '', url: '', area: '', texto: '', categoria: 'ministerio', obrigatoria: false }); const [msg, setMsg] = useState('');
  const pode = ['moderador', 'admin', 'root'].includes(usuario?.papel_app);
  const carregar = useCallback(() => api('/api/diretrizes', { token }).then(setLista).catch((e) => setMsg(e.message)), [api, token]);
  useEffect(() => { carregar(); }, [carregar]);
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const salvar = async (ev) => {
    ev.preventDefault(); setMsg('');
    try { await api('/api/diretrizes', { metodo: 'POST', token, corpo: { ...f, area: f.area || undefined, url: f.url || undefined } }); setF({ titulo: '', fonte: '', url: '', area: '', texto: '', categoria: 'ministerio', obrigatoria: false }); setMsg('Diretriz cadastrada.'); carregar(); } catch (e) { setMsg(e.message); }
  };
  return (
    <>
      <p className="sub">A IA só trata como norma o texto cadastrado aqui (protocolos e cadernos do Ministério da Saúde, por exemplo). O que não tiver diretriz sai marcado "sem diretriz de referência".</p>
      {lista && lista.length === 0 && <p className="sub">Nenhuma diretriz cadastrada.</p>}
      {lista?.map((d) => <div key={d.id} className="es-linha es-bloco"><span><strong>{d.titulo}</strong><br /><em>{d.obrigatoria ? '★ exigida pela administração · ' : ''}{CATEG[d.categoria] ?? ''}{d.categoria && d.categoria !== 'outra' ? ' · ' : ''}{d.fonte || 'sem fonte informada'}{d.area ? ` · ${AREAS[d.area]}` : ''} · {Math.round(d.tamanho / 1000)} mil caracteres</em></span></div>)}
      {pode ? (
        <form className="es-bloco" onSubmit={salvar}>
          <h3>Cadastrar diretriz</h3>
          <label className="campo"><span>Título</span><input value={f.titulo} maxLength={160} onChange={set('titulo')} required /></label>
          <div className="es-grade">
            <label className="campo"><span>Fonte</span><input value={f.fonte} maxLength={200} onChange={set('fonte')} placeholder="Ministério da Saúde, 2022" /></label>
            <label className="campo"><span>Área</span><select value={f.area} onChange={set('area')}><option value="">Todas</option>{Object.entries(AREAS).map(([k, n]) => <option key={k} value={k}>{n}</option>)}</select></label>
          </div>
          <div className="es-grade">
            <label className="campo"><span>Tipo da fonte</span><select value={f.categoria} onChange={set('categoria')}>{Object.entries(CATEG).map(([k, n]) => <option key={k} value={k}>{n}</option>)}</select></label>
            <label className="ca-chk"><input type="checkbox" checked={f.obrigatoria} onChange={(e) => setF((x) => ({ ...x, obrigatoria: e.target.checked }))} />Bibliografia exigida (a análise das estações usa primeiro)</label>
          </div>
          <label className="campo"><span>Link (opcional)</span><input value={f.url} maxLength={400} onChange={set('url')} placeholder="https://…" /></label>
          <label className="campo"><span>Texto da diretriz</span><textarea style={{ minHeight: 180 }} value={f.texto} maxLength={60000} onChange={set('texto')} required placeholder="Cole aqui o trecho do protocolo que deve valer como norma." /></label>
          <button className="btn menta">Cadastrar</button>
        </form>
      ) : <p className="sub">Só moderação e administração cadastram diretrizes.</p>}
      {msg && <p className="aviso" role="status">{msg}</p>}
    </>
  );
}

/* ======================= guia de treino (conteúdo fixo) ======================= */
const NIVEIS = [['Nível 1 · Estação guiada', 'Você aprende o fluxo e pode pausar para corrigir. Use quando o tema ainda é fraco.'], ['Nível 2 · Estação cronometrada', 'Sem ajuda até o fim. É o formato principal para transformar teoria em performance.'], ['Nível 3 · Bloco misto', 'Várias estações seguidas, áreas alternadas e sem saber o tema antes (aba Ciclos, bloco misto).']];
const ROTEIRO = [
  ['Antes de falar com o paciente', 'Leia a tarefa inteira e conte os comandos (realize, explique, demonstre, prescreva, oriente). Decida se há risco imediato.'],
  ['Abertura e segurança', 'Apresentação, higienização quando aplicável, consentimento, privacidade, avaliação rápida de gravidade, acionar ajuda se preciso.'],
  ['Anamnese dirigida', 'Pergunte o que muda hipótese, gravidade ou conduta, não uma história enciclopédica.'],
  ['Exame físico', 'Se puder executar, execute; se for verbalizar, diga o que examina e o que procura.'],
  ['Exames e interpretação', 'Peça só o que muda decisão e interprete o que receber em voz alta.'],
  ['Hipótese e diferenciais', 'Um diagnóstico mais provável e dois diferenciais importantes, em vez de dez possibilidades.'],
  ['Conduta', 'O que fazer agora; medicamento com droga, dose, via e frequência; destino e monitorização; encaminhamento; reavaliação e seguimento.'],
  ['Comunicação e fechamento', 'Explique em linguagem simples, oriente sinais de alarme e retorno, confirme o entendimento e responda todos os comandos.'],
];
const ERROS = [['Não ler todos os comandos', 'Sublinhe mentalmente cada verbo do enunciado.'], ['Ignorar instabilidade', 'Pergunte primeiro: há risco imediato?'], ['Anamnese sem direção', 'Pergunte o que muda hipótese ou conduta.'], ['Não verbalizar', 'Diga achados, hipóteses e decisões essenciais.'], ['Esquecer consentimento/privacidade', 'Automatize a abertura da estação.'], ['Exame genérico', 'Nomeie manobras e achados relevantes.'], ['Pedir exames sem interpretar', 'Treine "peço X porque procuro Y".'], ['Diagnóstico sem conduta', 'Depois da hipótese: o que faço agora?'], ['Medicação incompleta', 'Droga, dose, via e frequência, em voz alta.'], ['Excesso de fala', 'Frases curtas e orientadas à tarefa.'], ['Sem orientação final', 'Retorno, alarme e confirmação de entendimento.'], ['Não treinar sob tempo', 'Use cronômetro nas tentativas finais.']];
const SESSAO = [['10–15 min', 'Estação sem consulta'], ['10 min', 'Correção com o checklist/PEP'], ['5–10 min', 'Reestudo pontual do que causou o erro'], ['10 min', 'Segunda execução, sem olhar o material']];
const SEMANA = [['1', 'Clínica + Pediatria'], ['2', 'Cirurgia + procedimento'], ['3', 'Ginecologia e Obstetrícia'], ['4', 'MFC / Saúde Coletiva'], ['5', 'Misto, sem preparação'], ['6', 'Simulado cronometrado'], ['7', 'Refazer as piores estações']];
function Guia() {
  return (
    <div className="es-guia" data-testid="guia">
      <p className="sub">Este roteiro organiza a sua performance; <b>não substitui o PEP</b> da estação, que define a pontuação real. Consulte o PEP depois de executar, não antes.</p>
      <details open><summary>Três níveis de treino</summary>{NIVEIS.map(([t, d]) => <p key={t}><b>{t}.</b> {d}</p>)}<p className="sub">Regra de ouro: a correção termina com uma nova tentativa.</p></details>
      <details><summary>Roteiro universal da estação</summary><ol>{ROTEIRO.map(([t, d]) => <li key={t}><b>{t}.</b> {d}</li>)}</ol></details>
      <details><summary>Erros mais comuns e como corrigir</summary><ul>{ERROS.map(([e, c]) => <li key={e}><b>{e}.</b> {c}</li>)}</ul></details>
      <details><summary>Separe os erros em quatro categorias</summary>
        <p><b>Conhecimento:</b> não sabia diagnóstico, dose, exame ou conduta. <b>Sequência:</b> sabia, mas fez fora de ordem ou esqueceu um passo. <b>Comunicação:</b> não verbalizou, não explicou ou não confirmou entendimento. <b>Tempo:</b> gastou demais no início e deixou itens para o fim.</p>
        <p className="sub">Registre o comportamento que faltou (ex.: "esqueci sulfato"), não "revisar pré-eclâmpsia". O mesmo erro em vários temas pesa mais que um erro isolado: veja o Caderno de erros.</p></details>
      <details><summary>Uma sessão eficiente</summary><ul>{SESSAO.map(([t, d]) => <li key={d}><b>{t}</b> · {d}</li>)}</ul></details>
      <details><summary>Como montar a semana</summary><ul>{SEMANA.map(([d, f]) => <li key={d}><b>Dia {d}</b> · {f}</li>)}</ul></details>
    </div>
  );
}
