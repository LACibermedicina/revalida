import { useCallback, useEffect, useRef, useState } from 'react';

export const GRADE = 112;                                   // tamanho da célula dos ícones da mesa (px)
export const TELAS = {                                      // recursos que viram janela / ícone / item do dock
  painel: ['Início', 'inicio'], ciclos: ['Ciclos', 'ciclos'], estacoes: ['Estações', 'catalogo'], comunidade: ['Comunidade', 'comunidade'],
  solo: ['Praticar com IA', 'solo'], podcast: ['Podcast e Rádio', 'podcast'], desempenho: ['Desempenho', 'desempenho'], estudo: ['Estudo', 'estudo'],
  conta: ['Conta', 'conta'], admin: ['Admin', 'admin'], sala: ['Sala', 'sala'], analise: ['Análise', 'estudo'],
  notas: ['Notas rápidas', 'notas'], notificacoes: ['Central de notificações', 'sino'],
};
export const TELAS_FAVORITAVEIS = ['painel', 'ciclos', 'estacoes', 'comunidade', 'solo', 'podcast', 'desempenho', 'estudo', 'conta', 'notas', 'notificacoes'];
const PADRAO = () => ({
  favoritos: [['solo', 0, 0], ['estudo', 0, 1], ['podcast', 0, 2], ['notas', 0, 3]].map(([ref, c, l]) => ({ tipo: 'tela', ref, rotulo: TELAS[ref][0], x: c * GRADE, y: l * GRADE })),
  notas: [], dock: [], tema: 'auto',
});
const CHAVE = 'rv_mesa_estado';
const lerLocal = () => { try { const e = JSON.parse(localStorage.getItem(CHAVE)); return e && Array.isArray(e.favoritos) ? e : null; } catch { return null; } };
const gravarLocal = (e) => { try { localStorage.setItem(CHAVE, JSON.stringify(e)); } catch { /* sem storage */ } };

/** Estado da mesa (favoritos, notas rápidas): vem da conta (GET /api/mesa), muda na hora e é salvo com atraso (PUT). Sem rede, fica no aparelho. */
export function useEstadoMesa(api, token) {
  const [estado, setEstado] = useState(() => lerLocal() ?? PADRAO());
  const ref = useRef(estado); ref.current = estado;
  const timer = useRef(null);
  useEffect(() => {
    if (!token) return undefined;
    let vivo = true;
    api('/api/mesa', { token }).then((r) => { if (vivo && r.estado) { setEstado(r.estado); gravarLocal(r.estado); } }).catch(() => {});
    return () => { vivo = false; };
  }, [api, token]);
  useEffect(() => () => clearTimeout(timer.current), []);
  const salvar = useCallback((fn) => {
    const n = typeof fn === 'function' ? fn(ref.current) : fn;
    ref.current = n; setEstado(n); gravarLocal(n);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => { api('/api/mesa', { metodo: 'PUT', token, corpo: { estado: n } }).catch(() => {}); }, 700);
  }, [api, token]);
  return { estado, salvar };
}

const TAM = { painel: [1000, 660], notas: [620, 540], notificacoes: [700, 540], conta: [760, 600] };
const GEO = 'rv_janelas';
const lerGeo = () => { try { return JSON.parse(localStorage.getItem(GEO)) || {}; } catch { return {}; } };
const gravarGeo = (g) => { try { localStorage.setItem(GEO, JSON.stringify(g)); } catch { /* sem storage */ } };

/** Gerenciador de janelas: abrir/focar, fechar, minimizar (vai para o dock), maximizar, mover, redimensionar, organizar. */
export function useJanelas(area) {
  const [lista, setLista] = useState([]);
  const z = useRef(10);
  const geo = useRef(lerGeo());
  const dim = () => { const r = area.current?.getBoundingClientRect(); return { W: r?.width || 1200, H: r?.height || 700 }; };
  const guardar = (t, g) => { geo.current = { ...geo.current, [t]: g }; gravarGeo(geo.current); };
  const limitar = (w, { W, H }) => {
    const ww = Math.min(w.w, W - 8), hh = Math.min(w.h, H - 8);
    return { ...w, w: ww, h: hh, x: Math.min(Math.max(w.x, 8 - ww + 80), W - 80), y: Math.min(Math.max(w.y, 0), H - 40) };
  };
  const abrir = useCallback((tela) => {
    setLista((l) => {
      const ex = l.find((w) => w.tela === tela);
      if (ex) return l.map((w) => (w.tela === tela ? { ...w, min: false, z: ++z.current } : w));
      const d = dim(); const [pw, ph] = TAM[tela] || [920, 620]; const g = geo.current[tela];
      const n = l.filter((w) => !w.min).length;
      const base = g ? { x: g.x, y: g.y, w: g.w, h: g.h } : { w: Math.min(pw, d.W - 40), h: Math.min(ph, d.H - 30), x: 120 + (n % 6) * 30, y: 16 + (n % 6) * 30 };
      return [...l, { ...limitar(base, d), tela, min: false, max: !!g?.max, z: ++z.current }];
    });
  }, []);                                                   // eslint-disable-line react-hooks/exhaustive-deps
  const alterar = (tela, f) => setLista((l) => l.map((w) => (w.tela === tela ? f(w) : w)));
  const fechar = useCallback((tela) => setLista((l) => l.filter((w) => w.tela !== tela)), []);
  const minimizar = useCallback((tela) => alterar(tela, (w) => ({ ...w, min: true })), []);
  const focar = useCallback((tela) => setLista((l) => { const t = l.find((w) => w.tela === tela); return !t || t.z === z.current ? l : l.map((w) => (w.tela === tela ? { ...w, z: ++z.current } : w)); }), []);
  const alternarMax = useCallback((tela) => alterar(tela, (w) => { guardar(tela, { x: w.x, y: w.y, w: w.w, h: w.h, max: !w.max }); return { ...w, max: !w.max, z: ++z.current }; }), []);
  const mover = useCallback((tela, x, y) => alterar(tela, (w) => ({ ...w, ...limitar({ ...w, x, y }, dim()) })), []);       // eslint-disable-line react-hooks/exhaustive-deps
  const redimensionar = useCallback((tela, ww, hh) => alterar(tela, (w) => ({ ...w, w: Math.max(420, ww), h: Math.max(280, hh) })), []);
  const soltar = useCallback((tela) => setLista((l) => { const w = l.find((x) => x.tela === tela); if (w) guardar(tela, { x: w.x, y: w.y, w: w.w, h: w.h, max: w.max }); return l; }), []);
  const fecharTodas = useCallback(() => setLista([]), []);
  const minimizarTodas = useCallback(() => setLista((l) => l.map((w) => ({ ...w, min: true }))), []);
  const organizar = useCallback((modo) => setLista((l) => {
    const d = dim(); const vis = l.filter((w) => !w.min); if (!vis.length) return l;
    if (modo === 'cascata') return l.map((w) => { const i = vis.indexOf(w); return i < 0 ? w : { ...w, max: false, x: 24 + i * 34, y: 12 + i * 34, w: Math.min(900, d.W - 80), h: Math.min(600, d.H - 60) }; });
    const cols = Math.ceil(Math.sqrt(vis.length)), rows = Math.ceil(vis.length / cols), cw = Math.floor(d.W / cols), ch = Math.floor(d.H / rows);
    return l.map((w) => { const i = vis.indexOf(w); return i < 0 ? w : { ...w, max: false, x: (i % cols) * cw + 4, y: Math.floor(i / cols) * ch + 4, w: cw - 8, h: ch - 8 }; });
  }), []);                                                  // eslint-disable-line react-hooks/exhaustive-deps
  const topo = lista.filter((w) => !w.min).sort((a, b) => b.z - a.z)[0]?.tela ?? null;
  return { lista, topo, abrir, fechar, minimizar, focar, alternarMax, mover, redimensionar, soltar, fecharTodas, minimizarTodas, organizar };
}

/** Avisos do sino: não lidas do sistema + mensagens de colegas, atualizados a cada 25 s (só com a aba visível). `novos` leva o aumento desde a última leitura. */
export function useAvisos(api, token, ativo) {
  const [c, setC] = useState({ sistema: 0, mensagens: 0 });
  const [toast, setToast] = useState(null);
  const ant = useRef(null);
  const ler = useCallback(async () => {
    try {
      const [a, b] = await Promise.all([api('/api/notificacoes', { token }), api('/api/mesa/colegas', { token })]);
      const n = { sistema: a.nao_lidas || 0, mensagens: b.nao_lidas || 0 };
      if (ant.current) {
        if (n.mensagens > ant.current.mensagens) setToast({ id: Date.now(), t: 'Nova mensagem de um colega.', alvo: 'notificacoes' });
        else if (n.sistema > ant.current.sistema) setToast({ id: Date.now(), t: 'Nova notificação do sistema.', alvo: 'notificacoes' });
      }
      ant.current = n; setC(n);
    } catch { /* sem rede */ }
  }, [api, token]);
  useEffect(() => {
    if (!ativo) return undefined;
    ler(); const t = setInterval(() => { if (document.visibilityState === 'visible') ler(); }, 25000);
    return () => clearInterval(t);
  }, [ativo, ler]);
  return { ...c, total: c.sistema + c.mensagens, atualizar: ler, toast, limparToast: () => setToast(null) };
}
