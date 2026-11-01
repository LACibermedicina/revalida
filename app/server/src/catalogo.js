// Catálogo: lista de referência de estações (dados em server/data) + estado de estudo por pessoa + matriz de temas por ano.
// A geração da estação continua em /api/estacoes/gerar; aqui só se guarda o vínculo (estacao_id).
import fs from 'node:fs';
import { AREAS } from './estacao-esquema.js';
import { rota } from './seguranca.js';
import { extrairEstacoesInep } from './importar-inep.js';
import { montarPacote } from './estacoes.js';

const ler = (nome) => JSON.parse(fs.readFileSync(new URL(`../data/${nome}`, import.meta.url), 'utf8'));
const STATUS = ['nao_estudada', 'estudando', 'dominada'];
const CLASSES = ['inep', 'inep_modificado', 'sem_inep'];
const norm = (s) => String(s ?? '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

export function registrarCatalogo(app, { q, autenticar, estacoes = ler('catalogo.json'), temas = ler('temas-provas.json') }) {
  const porCodigo = new Map(estacoes.map((e) => [e.codigo, e]));
  const moderador = (u) => ['moderador', 'admin', 'root'].includes(u.papel_app);

  app.get('/api/catalogo', autenticar, rota(async (req, res) => {
    const f = req.query ?? {};
    const est = await q(`select codigo, status, prioridade, observacoes, estacao_id from catalogo_estudo where usuario_id=$1`, [req.usuario.id]);
    const mine = new Map(est.rows.map((r) => [r.codigo, r]));
    const busca = norm(f.busca);
    const todas = estacoes.map((e) => ({ ...e, estudo: mine.get(e.codigo) ?? { status: 'nao_estudada', prioridade: 0, observacoes: '', estacao_id: null } }));
    const itens = todas.filter((e) =>
      (!f.area || e.area === f.area) && (!f.classificacao || e.classificacao === f.classificacao) && (!f.status || e.estudo.status === f.status)
      && (f.procedimento !== '1' || e.procedimento) && (!busca || norm(e.titulo).includes(busca)));
    const conta = (fn) => todas.filter(fn).length;
    const kpis = { total: todas.length, inep: conta((e) => e.classificacao !== 'sem_inep'), dominadas: conta((e) => e.estudo.status === 'dominada'),
      estudando: conta((e) => e.estudo.status === 'estudando'), com_estacao: conta((e) => e.estudo.estacao_id),
      por_area: AREAS.map((a) => ({ area: a, total: conta((e) => e.area === a), dominadas: conta((e) => e.area === a && e.estudo.status === 'dominada') })) };
    res.json({ kpis, itens });
  }));

  app.put('/api/catalogo/:codigo/estudo', autenticar, rota(async (req, res) => {
    const e = porCodigo.get(req.params.codigo);
    if (!e) return res.status(404).json({ erro: 'Estação do catálogo não encontrada.' });
    const b = req.body ?? {};
    if (b.status !== undefined && !STATUS.includes(b.status)) return res.status(400).json({ erro: 'Status inválido.' });
    if (b.prioridade !== undefined && !(Number.isInteger(b.prioridade) && b.prioridade >= 0 && b.prioridade <= 3)) return res.status(400).json({ erro: 'Prioridade inválida (0 a 3).' });
    if (b.observacoes !== undefined && (typeof b.observacoes !== 'string' || b.observacoes.length > 2000)) return res.status(400).json({ erro: 'Observações: até 2000 caracteres.' });
    if (b.estacao_id !== undefined && b.estacao_id !== null) {
      const ok = await q(`select 1 from estacoes where id=$1 and criado_por=$2`, [b.estacao_id, req.usuario.id]).catch(() => ({ rows: [] }));
      if (!ok.rows.length) return res.status(400).json({ erro: 'Estação inválida (só é possível vincular uma estação sua).' });
    }
    const r = await q(
      `insert into catalogo_estudo (usuario_id, codigo, status, prioridade, observacoes, estacao_id)
       values ($1,$2,coalesce($3,'nao_estudada'),coalesce($4::int,0),coalesce($5,''),$6)
       on conflict (usuario_id, codigo) do update set status=coalesce($3,catalogo_estudo.status), prioridade=coalesce($4::int,catalogo_estudo.prioridade),
         observacoes=coalesce($5,catalogo_estudo.observacoes), estacao_id=case when $7 then $6 else catalogo_estudo.estacao_id end, atualizado_em=now()
       returning codigo, status, prioridade::int prioridade, observacoes, estacao_id`,
      [req.usuario.id, e.codigo, b.status ?? null, b.prioridade ?? null, b.observacoes ?? null, b.estacao_id ?? null, b.estacao_id !== undefined]);
    res.json(r.rows[0]);
  }));

  // Matriz tema × ano (frequência por área) para ver o que mais cai
  app.get('/api/catalogo/temas-prova', autenticar, rota(async (req, res) => {
    const area = req.query?.area;
    const lista = temas.filter((t) => !area || t.area === area);
    const anos = [...new Set(lista.map((t) => t.ano))].sort();
    const freq = new Map();
    for (const t of lista) { const k = norm(t.tema); const o = freq.get(k) ?? { tema: t.tema, area: t.area, anos: [] }; o.anos.push(t.ano); freq.set(k, o); }
    const linhas = [...freq.values()].map((o) => ({ ...o, vezes: o.anos.length })).sort((a, b) => b.vezes - a.vezes || a.tema.localeCompare(b.tema, 'pt'));
    res.json({ anos, linhas });
  }));

  // Moderador: texto do caderno (e-book INEP) → pacote .rvpack de rascunhos para conferir e importar. Não grava nada.
  app.post('/api/catalogo/importar-ebook', autenticar, rota(async (req, res) => {
    if (!moderador(req.usuario)) return res.status(403).json({ erro: 'Apenas moderadores e administradores.' });
    const { texto, area } = req.body ?? {};
    if (!AREAS.includes(area)) return res.status(400).json({ erro: 'Área inválida.' });
    if (typeof texto !== 'string' || texto.length < 200 || texto.length > 8_000_000) return res.status(400).json({ erro: 'Envie o texto do caderno (até 8 MB).' });
    const r = extrairEstacoesInep(texto, { area });
    res.json({ relatorio: r.relatorio, pacote: r.estacoes.length ? montarPacote(r.estacoes.map((x) => ({ ...x.estacao, incertos: x.incertos }))) : null });
  }));
}
