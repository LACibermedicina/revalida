import React, { useCallback, useEffect, useRef, useState } from 'react';
import Logo, { Wordmark } from './Logo.jsx';
import { Icone } from './Icones.jsx';
import Notas, { criarNota } from './Notas.jsx';
import Central from './Central.jsx';
import Mascote3D from './Mascote3D.jsx';
import { GRADE, TELAS, TELAS_FAVORITAVEIS } from './useMesa.js';

const FRASES = [
  ['Cada estação treinada é um passo a mais até o seu CRM.', 'Bora para a próxima fase!'],
  ['Hoje você treina; amanhã você atende.', 'Constância vence talento.'],
  ['Errar no treino é o jeito mais barato de acertar na prova.', 'Anote, revise, repita.'],
  ['Um paciente bem acolhido começa com um bom-dia.', 'Comunicação também pontua.'],
  ['Pequenos plantões de estudo, grandes conquistas.', 'Você está mais perto do que imagina.'],
];

/** Frase inspiradora da mesa: troca sozinha a cada 14 s (sem interação). */
function FraseMesa() {
  const [i, setI] = useState(() => new Date().getDate() % FRASES.length);
  const [on, setOn] = useState(true);
  useEffect(() => {
    const t = setInterval(() => { setOn(false); setTimeout(() => { setI((k) => (k + 1) % FRASES.length); setOn(true); }, 500); }, 14000);
    return () => clearInterval(t);
  }, []);
  return <p className={`mesa-frase${on ? ' on' : ''}`} aria-live="off"><b>{FRASES[i][0]}</b><small>{FRASES[i][1]}</small></p>;
}

const DOCK = ['painel', 'ciclos', 'estacoes', 'comunidade', 'solo', 'podcast', 'desempenho', 'estudo'];

/* ---------- janela (caixa que se arrasta, redimensiona, minimiza e fecha) ---------- */
function Janela({ w, foco, titulo, icone, jan, children }) {
  const arrasto = useRef(null);
  const iniciar = (e) => {
    if (e.target.closest('button') || w.max || e.button > 0) return;
    arrasto.current = { px: e.clientX, py: e.clientY, x: w.x, y: w.y };
    e.currentTarget.setPointerCapture(e.pointerId); document.body.classList.add('arrastando');
  };
  const mexer = (e) => { const a = arrasto.current; if (a) jan.mover(w.tela, a.x + e.clientX - a.px, a.y + e.clientY - a.py); };
  const soltar = () => { if (arrasto.current) { arrasto.current = null; document.body.classList.remove('arrastando'); jan.soltar(w.tela); } };
  const redim = useRef(null);
  const iniciarR = (e) => { redim.current = { px: e.clientX, py: e.clientY, w: w.w, h: w.h }; e.currentTarget.setPointerCapture(e.pointerId); document.body.classList.add('arrastando'); e.stopPropagation(); };
  const mexerR = (e) => { const r = redim.current; if (r) jan.redimensionar(w.tela, r.w + e.clientX - r.px, r.h + e.clientY - r.py); };
  const soltarR = () => { if (redim.current) { redim.current = null; document.body.classList.remove('arrastando'); jan.soltar(w.tela); } };
  const teclas = (e) => {
    if (e.key === 'Escape' && !e.target.closest('input,textarea,select')) jan.minimizar(w.tela);
    else if (e.altKey && e.key.startsWith('Arrow') && !w.max) { e.preventDefault(); const d = { ArrowLeft: [-24, 0], ArrowRight: [24, 0], ArrowUp: [0, -24], ArrowDown: [0, 24] }[e.key]; jan.mover(w.tela, w.x + d[0], w.y + d[1]); jan.soltar(w.tela); }
  };
  return (
    <section className={`jan${foco ? ' foco' : ''}${w.max ? ' max' : ''}`} hidden={w.min} data-tela={w.tela} aria-label={titulo}
      style={w.max ? { zIndex: w.z } : { left: w.x, top: w.y, width: w.w, height: w.h, zIndex: w.z }}
      onPointerDownCapture={() => jan.focar(w.tela)} onKeyDown={teclas}>
      <header className="jan-barra" onPointerDown={iniciar} onPointerMove={mexer} onPointerUp={soltar} onPointerCancel={soltar} onDoubleClick={(e) => { if (!e.target.closest('button')) jan.alternarMax(w.tela); }}>
        <div className="semaforo">
          <button type="button" className="v" aria-label={`Fechar ${titulo}`} title="Fechar" data-testid="jan-fechar" onClick={() => jan.fechar(w.tela)} />
          <button type="button" className="a" aria-label={`Minimizar ${titulo}`} title="Minimizar (vai para o dock)" data-testid="jan-minimizar" onClick={() => jan.minimizar(w.tela)} />
          <button type="button" className="g" aria-label={w.max ? `Restaurar ${titulo}` : `Maximizar ${titulo}`} title={w.max ? 'Restaurar' : 'Maximizar'} data-testid="jan-maximizar" onClick={() => jan.alternarMax(w.tela)} />
        </div>
        <h2><span className="jan-ic" aria-hidden="true"><Icone nome={icone} /></span>{titulo}</h2>
      </header>
      <div className="jan-corpo">{children}</div>
      {!w.max && <i className="jan-grip" aria-hidden="true" onPointerDown={iniciarR} onPointerMove={mexerR} onPointerUp={soltarR} onPointerCancel={soltarR} />}
    </section>
  );
}

/* ---------- ícone da mesa (favorito) ---------- */
function IconeMesa({ f, i, aoAbrir, aoRemover, aoMover, aoMenu }) {
  const [p, setP] = useState(null);
  const a = useRef(null);
  const [nome, ic] = f.tipo === 'tela' ? [TELAS[f.ref]?.[0] ?? f.ref, TELAS[f.ref]?.[1] ?? 'inicio'] : [f.rotulo, f.tipo === 'estacao' ? 'catalogo' : 'estudo'];
  const pos = p ?? { x: f.x, y: f.y };
  return (
    <div className={`ic-mesa${p ? ' movendo' : ''}`} style={{ left: pos.x, top: pos.y }} data-testid="fav" data-ref={f.ref}
      role="button" tabIndex={0} aria-label={`${f.rotulo}${f.tipo === 'estacao' ? ' (estação favorita)' : f.tipo === 'tema' ? ' (tema para revisão)' : ''}. Enter abre; Delete remove.`}
      onDoubleClick={() => aoAbrir(f)} onContextMenu={(e) => { e.preventDefault(); aoMenu(f, e.clientX, e.clientY); }}
      onKeyDown={(e) => { if (e.key === 'Enter') aoAbrir(f); else if (e.key === 'Delete' || e.key === 'Backspace') aoRemover(i); else if (e.key === 'ContextMenu' || (e.shiftKey && e.key === 'F10')) { const r = e.currentTarget.getBoundingClientRect(); aoMenu(f, r.left + 20, r.top + 20); } }}
      onPointerDown={(e) => { if (e.button > 0 || e.target.closest('.rm')) return; a.current = { px: e.clientX, py: e.clientY, x: f.x, y: f.y, mov: false }; e.currentTarget.setPointerCapture(e.pointerId); }}
      onPointerMove={(e) => { const s = a.current; if (!s) return; const dx = e.clientX - s.px, dy = e.clientY - s.py; if (!s.mov && Math.hypot(dx, dy) < 5) return; s.mov = true; setP({ x: Math.max(0, s.x + dx), y: Math.max(0, s.y + dy) }); }}
      onPointerUp={() => { const s = a.current; a.current = null; if (s?.mov && p) { aoMover(i, Math.round(p.x / GRADE) * GRADE, Math.round(p.y / GRADE) * GRADE); } setP(null); }}>
      <span className="ic-img"><Icone nome={ic} />{f.tipo !== 'tela' && <b className="estrela" aria-hidden="true">★</b>}</span>
      <span className="ic-nome">{nome === f.ref ? f.rotulo : (f.tipo === 'tela' ? nome : f.rotulo)}</span>
      <button type="button" className="rm" aria-label={`Remover ${f.rotulo} dos favoritos`} title="Remover dos favoritos" tabIndex={-1} onClick={() => aoRemover(i)}>✕</button>
    </div>
  );
}

/* ---------- diálogo: adicionar favoritos (recurso, estação ou tema) ---------- */
function AdicionarFavorito({ api, token, favoritos, aoAdicionar, aoFechar, inicio = 'recurso' }) {
  const [aba, setAba] = useState(inicio);
  const [est, setEst] = useState(null);
  const [busca, setBusca] = useState('');
  const [tema, setTema] = useState('');
  useEffect(() => { if (aba === 'estacao' && !est) api('/api/estacoes', { token }).then(setEst).catch(() => setEst([])); }, [aba, est, api, token]);
  useEffect(() => { const t = (e) => { if (e.key === 'Escape') aoFechar(); }; window.addEventListener('keydown', t); return () => window.removeEventListener('keydown', t); }, [aoFechar]);
  const tem = (tipo, ref) => favoritos.some((f) => f.tipo === tipo && f.ref === ref);
  const b = busca.trim().toLowerCase();
  const vistas = (est ?? []).filter((e) => !b || e.titulo.toLowerCase().includes(b)).slice(0, 80);
  return (
    <div className="modal-fundo" onPointerDown={(e) => { if (e.target === e.currentTarget) aoFechar(); }}>
      <div className="modal" role="dialog" aria-modal="true" aria-label="Adicionar aos favoritos da mesa" data-testid="add-fav">
        <header><h3>Adicionar à mesa</h3><button type="button" className="fechar" aria-label="Fechar" onClick={aoFechar}>✕</button></header>
        <div className="seg" role="tablist">
          {[['recurso', 'Recurso'], ['estacao', 'Estação'], ['tema', 'Tema para revisão']].map(([k, r]) => <button key={k} type="button" role="tab" aria-selected={aba === k} onClick={() => setAba(k)}>{r}</button>)}
        </div>
        {aba === 'recurso' && <ul className="modal-lista">{TELAS_FAVORITAVEIS.map((t) => (
          <li key={t}><span>{TELAS[t][0]}</span><button type="button" className="btn mini" disabled={tem('tela', t)} onClick={() => aoAdicionar({ tipo: 'tela', ref: t, rotulo: TELAS[t][0] })}>{tem('tela', t) ? 'Na mesa' : 'Adicionar'}</button></li>))}</ul>}
        {aba === 'estacao' && (<>
          <input type="search" aria-label="Buscar estação" placeholder="Buscar estação pelo título" value={busca} onChange={(e) => setBusca(e.target.value)} />
          <ul className="modal-lista">{est === null ? <li className="sub">Carregando…</li> : vistas.length === 0 ? <li className="sub">Nenhuma estação encontrada.</li> : vistas.map((e) => (
            <li key={e.id}><span>{e.titulo}</span><button type="button" className="btn mini" disabled={tem('estacao', e.id)} onClick={() => aoAdicionar({ tipo: 'estacao', ref: e.id, rotulo: e.titulo })}>{tem('estacao', e.id) ? 'Na mesa' : 'Adicionar'}</button></li>))}</ul>
        </>)}
        {aba === 'tema' && (
          <form className="modal-tema" onSubmit={(e) => { e.preventDefault(); const t = tema.trim(); if (t) { aoAdicionar({ tipo: 'tema', ref: t, rotulo: t }); setTema(''); } }}>
            <label className="campo"><span>Tema para revisão</span><input value={tema} maxLength={100} placeholder="ex.: Sepse, Pré-eclâmpsia, Asma na infância" onChange={(e) => setTema(e.target.value)} data-testid="fav-tema" /></label>
            <p className="sub">O ícone abre o Estudo (cartões de revisão) já neste tema.</p>
            <button type="submit" className="btn menta" disabled={!tema.trim() || tem('tema', tema.trim())}>Adicionar tema</button>
          </form>
        )}
      </div>
    </div>
  );
}

/* ---------- menu suspenso da barra superior ---------- */
function Menu({ id, rotulo, aberto, setAberto, children, dir }) {
  const on = aberto === id;
  return (
    <div className={`mb-menu${on ? ' on' : ''}`} onMouseEnter={() => { if (aberto) setAberto(id); }}>
      <button type="button" aria-haspopup="menu" aria-expanded={on} onClick={() => setAberto(on ? null : id)}>{rotulo}</button>
      {on && <div className={`mb-pop${dir ? ` ${dir}` : ''}`} role="menu" onClick={(e) => { if (e.target.closest('[role=menuitem]')) setAberto(null); }}>{children}</div>}
    </div>
  );
}
const It = ({ children, ...p }) => <button type="button" role="menuitem" {...p}>{children}</button>;

/** Shell estilo macOS: barra de menu no topo, mesa com favoritos, janelas e dock na base. */
export default function Mesa({ usuario, token, api, jan, estado, salvar, avisos, renderTela, ehAdmin, aoFavorito, aoSair, aoClassico, aoSobrepor, areaRef, temSala }) {
  const [aberto, setAberto] = useState(null);
  const [dialogo, setDialogo] = useState(null);
  const [menuFav, setMenuFav] = useState(null);
  const [agora, setAgora] = useState(() => new Date());
  const [focoNota, setFocoNota] = useState(false);
  const [dockVisivel, setDockVisivel] = useState(() => { try { return localStorage.getItem('rv_dock') !== '0'; } catch { return true; } });
  useEffect(() => { const t = setInterval(() => setAgora(new Date()), 30000); return () => clearInterval(t); }, []);
  useEffect(() => {
    if (!aberto && !menuFav) return undefined;
    const fora = (e) => { if (!e.target.closest('.mb-menu,.menu-fav')) { setAberto(null); setMenuFav(null); } };
    const esc = (e) => { if (e.key === 'Escape') { setAberto(null); setMenuFav(null); } };
    document.addEventListener('pointerdown', fora); document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('pointerdown', fora); document.removeEventListener('keydown', esc); };
  }, [aberto, menuFav]);
  const alternarDock = () => setDockVisivel((v) => { try { localStorage.setItem('rv_dock', v ? '0' : '1'); } catch { /* sem storage */ } return !v; });

  const abrir = useCallback((t) => { setFocoNota(false); jan.abrir(t); }, [jan]);
  const novaNota = () => { salvar((e) => ({ ...e, notas: [criarNota(), ...e.notas].slice(0, 50) })); setFocoNota(true); jan.abrir('notas'); };
  const add = (fav) => salvar((e) => (e.favoritos.length >= 60 ? e : { ...e, favoritos: [...e.favoritos, { ...fav, x: 0, y: 0, ...proximo(e.favoritos) }] }));
  const rm = (i) => salvar((e) => ({ ...e, favoritos: e.favoritos.filter((_, k) => k !== i) }));
  const mover = (i, x, y) => salvar((e) => ({ ...e, favoritos: e.favoritos.map((f, k) => (k === i ? { ...f, x, y } : f)) }));
  const titulo = (t) => TELAS[t]?.[0] ?? t;
  const conteudo = (t) => (t === 'notas' ? <Notas notas={estado.notas} salvar={salvar} foco={focoNota} />
    : t === 'notificacoes' ? <Central api={api} token={token} aoMudou={avisos.atualizar} />
      : renderTela(t));

  const abertas = jan.lista.map((w) => w.tela);
  const dockFixos = [...DOCK, ...(ehAdmin ? ['admin'] : [])];
  const dockExtras = abertas.filter((t) => !dockFixos.includes(t) && !['notas', 'notificacoes', 'conta'].includes(t));
  const item = (t) => {
    const w = jan.lista.find((x) => x.tela === t);
    return (
      <button key={t} type="button" className={`dk-item${w ? ' aberto' : ''}${w?.min ? ' min' : ''}${jan.topo === t ? ' ativo' : ''}`} aria-current={jan.topo === t ? 'page' : undefined}
        title={titulo(t)} data-tela={t} onClick={() => (w && jan.topo === t ? jan.minimizar(t) : abrir(t))}>
        <span className="dk-ic" aria-hidden="true"><Icone nome={TELAS[t][1]} /></span>
        {t === 'notificacoes' && avisos.total > 0 && <b className="dk-pil">{avisos.total > 9 ? '9+' : avisos.total}</b>}
        <span className="dk-rot">{titulo(t)}</span>
      </button>
    );
  };
  const relogio = agora.toLocaleString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).replace('.', '');
  return (
    <div className={`mesa${dockVisivel ? '' : ' sem-dock'}`} data-testid="mesa">
      <header className="mesa-barra">
        <button type="button" className="mesa-marca" aria-label="REVALIDA.M3D: abrir o Início" onClick={() => abrir('painel')}><Logo tamanho={48} /><Wordmark /></button>
        <nav className="mb-menus" aria-label="Menus">
          <Menu id="recursos" rotulo="Recursos" aberto={aberto} setAberto={setAberto}>
            {[...TELAS_FAVORITAVEIS.filter((t) => !['notas', 'notificacoes'].includes(t)), ...(ehAdmin ? ['admin'] : [])].map((t) => <It key={t} onClick={() => abrir(t)}>{titulo(t)}</It>)}
            {temSala && <It onClick={() => abrir('sala')}>Sala em andamento</It>}
          </Menu>
          <Menu id="janela" rotulo="Janela" aberto={aberto} setAberto={setAberto}>
            <It onClick={() => jan.minimizarTodas()}>Minimizar todas</It>
            <It onClick={() => jan.organizar('cascata')}>Organizar em cascata</It>
            <It onClick={() => jan.organizar('lado')}>Organizar lado a lado</It>
            <It onClick={() => jan.fecharTodas()}>Fechar todas</It>
            {jan.lista.length > 0 && <hr />}
            {jan.lista.map((w) => <It key={w.tela} onClick={() => abrir(w.tela)}>{jan.topo === w.tela ? '✓ ' : ''}{titulo(w.tela)}{w.min ? ' (minimizada)' : ''}</It>)}
          </Menu>
          <Menu id="favoritos" rotulo="Favoritos" aberto={aberto} setAberto={setAberto}>
            <It onClick={() => setDialogo('estacao')}>Adicionar estação…</It>
            <It onClick={() => setDialogo('tema')}>Adicionar tema para revisão…</It>
            <It onClick={() => setDialogo('recurso')}>Adicionar recurso…</It>
            {estado.favoritos.length > 0 && <hr />}
            {estado.favoritos.map((f, i) => <It key={`${f.tipo}${f.ref}`} onClick={() => aoFavorito(f)}>{f.tipo === 'tela' ? titulo(f.ref) : `★ ${f.rotulo}`}</It>)}
          </Menu>
          <Menu id="exibir" rotulo="Exibir" aberto={aberto} setAberto={setAberto}>
            <It onClick={alternarDock}>{dockVisivel ? 'Ocultar o dock' : 'Mostrar o dock'}</It>
            <It onClick={aoClassico}>Usar o menu clássico</It>
          </Menu>
        </nav>
        <div className="mb-dir">
          <button type="button" className="mb-ic" aria-label="Nota rápida" title="Nota rápida" data-testid="nota-rapida" onClick={novaNota}><Icone nome="notas" /></button>
          <button type="button" className="mb-ic" aria-label={`Central de notificações${avisos.total ? `, ${avisos.total} novas` : ''}`} title="Notificações e mensagens" data-testid="sino" onClick={() => abrir('notificacoes')}>
            <Icone nome="sino" />{avisos.total > 0 && <b className="pil">{avisos.total > 9 ? '9+' : avisos.total}</b>}
          </button>
          <time className="mb-hora" dateTime={agora.toISOString()}>{relogio}</time>
          <Menu id="usuario" rotulo={(usuario?.nome || 'Conta').split(' ')[0]} aberto={aberto} setAberto={setAberto} dir="dir">
            <It onClick={() => abrir('conta')}>Minha conta</It>
            <It onClick={aoClassico}>Menu clássico</It>
            <hr />
            <It onClick={aoSair}>Sair</It>
          </Menu>
        </div>
      </header>

      <main className="mesa-area" ref={areaRef} aria-label="Mesa de trabalho">
        <div className="mesa-icones">
          {estado.favoritos.map((f, i) => <IconeMesa key={`${f.tipo}-${f.ref}`} f={f} i={i} aoAbrir={aoFavorito} aoRemover={rm} aoMover={mover} aoMenu={(fv, x, y) => setMenuFav({ f: fv, i, x, y })} />)}
        </div>
        {estado.favoritos.length === 0 && jan.lista.length === 0 && <p className="mesa-vazia">Sua mesa está vazia. Use <b>Favoritos</b> para fixar recursos, estações e temas aqui.</p>}
        <FraseMesa />
        <div className="mesa-bot" aria-hidden="true">
          <Mascote3D fluido pose="wave" titulo="" />
          <figure className="mesa-placa"><img src="/marca/avatar.png" alt="" width="52" height="52" /><figcaption>REVALIDA.M3D<small>Estudos preparatórios</small></figcaption></figure>
        </div>
        {jan.lista.map((w) => <Janela key={w.tela} w={w} foco={jan.topo === w.tela} titulo={titulo(w.tela)} icone={TELAS[w.tela]?.[1] ?? 'inicio'} jan={jan}>{conteudo(w.tela)}</Janela>)}
        {menuFav && (
          <div className="menu-fav" role="menu" style={{ left: menuFav.x, top: menuFav.y }} onClick={() => setMenuFav(null)}>
            <It onClick={() => aoFavorito(menuFav.f)}>Abrir</It>
            {menuFav.f.tipo === 'estacao' && <It onClick={() => aoFavorito(menuFav.f, 'sala')}>Praticar em sala (Ciclos)</It>}
            {menuFav.f.tipo === 'estacao' && <It onClick={() => aoFavorito(menuFav.f, 'ia')}>Praticar com paciente IA</It>}
            <It onClick={() => rm(menuFav.i)}>Remover dos favoritos</It>
          </div>
        )}
      </main>

      {dockVisivel && (
        <nav className="dock" aria-label="Navegação" data-testid="dock">
          <div className="dk-grupo">{dockFixos.map(item)}</div>
          {dockExtras.length > 0 && <><i className="dk-sep" /><div className="dk-grupo">{dockExtras.map(item)}</div></>}
          <i className="dk-sep" />
          <div className="dk-grupo">{item('notas')}{item('notificacoes')}{item('conta')}</div>
        </nav>
      )}
      {avisos.toast && (
        <button type="button" className="toast" key={avisos.toast.id} role="status" onClick={() => { abrir(avisos.toast.alvo); avisos.limparToast(); }}>
          <Icone nome="sino" /><span>{avisos.toast.t}<small>Toque para abrir</small></span>
        </button>
      )}
      {dialogo && <AdicionarFavorito api={api} token={token} favoritos={estado.favoritos} inicio={dialogo} aoAdicionar={add} aoFechar={() => setDialogo(null)} />}
      {aoSobrepor}
    </div>
  );
}

/** próxima célula livre da grade (coluna a coluna, de cima para baixo) */
function proximo(favs) {
  const ocupado = new Set(favs.map((f) => `${Math.round(f.x / GRADE)},${Math.round(f.y / GRADE)}`));
  for (let c = 0; c < 12; c += 1) for (let l = 0; l < 5; l += 1) if (!ocupado.has(`${c},${l}`)) return { x: c * GRADE, y: l * GRADE };
  return { x: 0, y: 0 };
}
