// Estudo: revisão por estação (lacunas), desempenho, trilha, cartões com repetição espaçada, resumos, mapa de temas e diretrizes.
// O que a IA gera entra com a origem marcada e as diretrizes cadastradas como contexto; sem diretriz, a resposta diz isso.
import fs from 'node:fs';
import { idValido, Limitador, rota } from './seguranca.js';
import { ErroIA } from './ia.js';
import { AREAS } from './estacao-esquema.js';
import { CATEGORIAS, ERROS_TIPO, agruparErros, complexidadeDoTema, pesoEstacao, sortearPonderado, diasParaReteste, ordenarTrilha, proximoPasso, sm2 } from './estudo-logica.js';
import { desempenhoTemas, diretrizesDoTema, garantirTema, semearBase } from './temas.js';

/** array do Postgres como literal ({a,b}): é a convenção do projeto (igual a salas.js) e funciona no node-pg e no psql dos testes */
const lit = (l) => `{${l.join(',')}}`;
const ERROS_IA = { IA_NAO_CONFIGURADA: 503, IA_CHAVE_INVALIDA: 502, IA_LIMITE: 429, IA_DEMORA: 504, IA_FALHA: 502, IA_ESQUEMA: 502 };

const normTema = (s) => String(s ?? '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const lerDados = (nome) => { try { return JSON.parse(fs.readFileSync(new URL(`../data/${nome}`, import.meta.url), 'utf8')); } catch { return []; } };

export function registrarEstudo(app, { q, autenticar, ia, rng = Math.random, limitador = new Limitador({ max: 30, janelaMs: 3_600_000 }), temasProvas = lerDados('temas-provas.json') }) {
  const moderador = (u) => ['moderador', 'admin', 'root'].includes(u.papel_app);
  const admin = (u) => ['admin', 'root'].includes(u.papel_app);
  const ID = (req, res, prox) => (idValido(req.params.id) ? prox() : res.status(400).json({ erro: 'Identificador inválido.' }));
  const U = (req) => req.usuario.id;
  const ia503 = (res) => res.status(503).json({ erro: 'A IA não está configurada neste servidor.', codigo: 'IA_NAO_CONFIGURADA' });
  const limite = (req, res) => {
    if (limitador.excedeu(U(req))) { res.status(429).json({ erro: 'Muitos pedidos à IA. Tente de novo mais tarde.', codigo: 'LIMITE' }); return true; }
    limitador.registrar(U(req)); return false;
  };
  const erroIA = (res, e) => { if (e instanceof ErroIA) return res.status(ERROS_IA[e.codigo] ?? 502).json({ erro: e.message, codigo: e.codigo }); throw e; };
  let semeado = false;
  const base = async () => { if (!semeado) { await semearBase(q); semeado = true; } };
  const tema = async (id) => (await q('select id, nome, area, relevancia, descricao from temas where id=$1', [id])).rows[0];

  /* ---------- diretrizes ---------- */
  app.get('/api/diretrizes', autenticar, rota(async (_req, res) => {
    res.json((await q('select id, titulo, fonte, url, area, categoria, obrigatoria, length(texto)::int tamanho, criado_em from diretrizes order by obrigatoria desc, criado_em desc limit 200')).rows);
  }));
  app.post('/api/diretrizes', autenticar, rota(async (req, res) => {
    if (!moderador(req.usuario)) return res.status(403).json({ erro: 'Só moderação e administração cadastram diretrizes.' });
    const b = req.body ?? {}; const t = (v, n) => String(v ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim().slice(0, n);
    const titulo = t(b.titulo, 160); const texto = t(b.texto, 60_000); const url = t(b.url, 400);
    if (titulo.length < 3 || texto.length < 40) return res.status(400).json({ erro: 'Informe o título e o texto da diretriz (mínimo de 40 caracteres).' });
    if (url && !/^https?:\/\//i.test(url)) return res.status(400).json({ erro: 'O link precisa começar com http:// ou https://.' });
    const r = await q('insert into diretrizes (titulo, fonte, url, area, texto, criado_por, categoria, obrigatoria) values ($1,$2,$3,$4,$5,$6,$7,$8) returning id',
      [titulo, t(b.fonte, 200), url || null, AREAS.includes(b.area) ? b.area : null, texto, U(req), ['ministerio', 'oms', 'sociedade'].includes(b.categoria) ? b.categoria : 'outra', b.obrigatoria === true]);
    res.status(201).json({ id: r.rows[0].id });
  }));
  app.delete('/api/diretrizes/:id', autenticar, ID, rota(async (req, res) => {
    if (!admin(req.usuario)) return res.status(403).json({ erro: 'Só a administração remove diretrizes.' });
    await q('delete from diretrizes where id=$1', [req.params.id]); res.json({ ok: true });
  }));

  /* ---------- revisão por estação (caderno de erros) ---------- */
  app.get('/api/estudo/execucoes', autenticar, rota(async (req, res) => {
    const r = await q(`select e.id, t.titulo, t.area, e.nota, e.finalizada_em,
        (select coalesce(sum(p.pontos_total),0) from pep_itens p where p.estacao_id = i.estacao_id) maximo,
        (select count(*)::int from lacunas l where l.execucao_id = e.id and l.usuario_id = $1) lacunas
      from execucoes e join ciclo_itens i on i.id = e.item_id join estacoes t on t.id = i.estacao_id
      where e.candidato_id = $1 and e.estado = 'finalizada' order by e.finalizada_em desc limit 30`, [U(req)]);
    res.json(r.rows.map((x) => ({ ...x, nota: x.nota === null ? null : Number(x.nota), maximo: Number(x.maximo) })));
  }));

  app.get('/api/estudo/execucoes/:id/revisao', autenticar, ID, rota(async (req, res) => {
    const x = (await q(`select e.id, e.nota, e.checklist, e.finalizada_em, i.estacao_id, t.titulo, t.area, t.duracao_min
        from execucoes e join ciclo_itens i on i.id = e.item_id join estacoes t on t.id = i.estacao_id
        where e.id = $1 and e.candidato_id = $2 and e.estado = 'finalizada'`, [req.params.id, U(req)])).rows[0];
    if (!x) return res.status(404).json({ erro: 'Execução não encontrada.' });
    const lac = (await q('select pep_item_id, categoria, erro_tipo, descricao from lacunas where execucao_id=$1 and usuario_id=$2', [x.id, U(req)])).rows;
    const porItem = new Map(lac.map((l) => [l.pep_item_id, l]));
    const itens = (x.checklist?.itens ?? []).map((i) => ({ id: i.id, secao: i.secao, descricao: i.descricao, critico: Boolean(i.critico), resultado: i.resultado, pontos: i.pontos, pontos_total: i.pontos_total, lacuna: porItem.get(i.id) ?? null }));
    const max = itens.reduce((s, i) => s + Number(i.pontos_total ?? 0), 0);
    res.json({ id: x.id, estacao_id: x.estacao_id, titulo: x.titulo, area: x.area, nota: x.nota === null ? null : Number(x.nota), maximo: max, percentual: x.nota !== null && max > 0 ? Math.round((Number(x.nota) / max) * 100) : null,
      itens, categorias: CATEGORIAS, tipos_erro: ERROS_TIPO,
      regra: 'A correção termina com uma nova tentativa: refaça a estação logo depois de registrar as lacunas.' });
  }));

  // Salva as lacunas da execução (substitui as anteriores do mesmo aluno nesta execução). Só itens da própria estação.
  app.put('/api/estudo/execucoes/:id/lacunas', autenticar, ID, rota(async (req, res) => {
    const x = (await q(`select e.id, i.estacao_id from execucoes e join ciclo_itens i on i.id = e.item_id
        where e.id = $1 and e.candidato_id = $2 and e.estado = 'finalizada'`, [req.params.id, U(req)])).rows[0];
    if (!x) return res.status(404).json({ erro: 'Execução não encontrada.' });
    const lista = req.body?.lacunas;
    if (!Array.isArray(lista) || lista.length > 80) return res.status(400).json({ erro: 'Informe a lista de lacunas (até 80).' });
    const itensValidos = new Set((await q('select id from pep_itens where estacao_id=$1', [x.estacao_id])).rows.map((r) => r.id));
    const limpas = [];
    for (const l of lista) {
      if (!CATEGORIAS.includes(l?.categoria)) return res.status(400).json({ erro: 'Categoria inválida.' });
      if (l.erro_tipo !== undefined && l.erro_tipo !== null && !(l.erro_tipo in ERROS_TIPO)) return res.status(400).json({ erro: 'Tipo de erro inválido.' });
      if (l.pep_item_id !== undefined && l.pep_item_id !== null && !itensValidos.has(l.pep_item_id)) return res.status(400).json({ erro: 'Item que não pertence a esta estação.' });
      limpas.push({ pep_item_id: l.pep_item_id ?? null, categoria: l.categoria, erro_tipo: l.erro_tipo ?? null, descricao: String(l.descricao ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim().slice(0, 300) });
    }
    // dois comandos: o índice único não enxerga a remoção feita no mesmo comando
    await q('delete from lacunas where execucao_id=$1 and usuario_id=$2', [x.id, U(req)]);
    await q(`insert into lacunas (usuario_id, execucao_id, estacao_id, pep_item_id, categoria, erro_tipo, descricao)
      select $2, $1, $3, x.pep_item_id, x.categoria, x.erro_tipo, x.descricao
        from jsonb_to_recordset($4::jsonb) as x(pep_item_id uuid, categoria text, erro_tipo text, descricao text)`, [x.id, U(req), x.estacao_id, JSON.stringify(limpas)]);
    res.json({ ok: true, salvas: limpas.length });
  }));

  app.get('/api/estudo/erros', autenticar, rota(async (req, res) => {
    const l = (await q('select l.categoria, l.erro_tipo, l.estacao_id, l.descricao, l.criada_em, t.titulo from lacunas l join estacoes t on t.id = l.estacao_id where l.usuario_id=$1 order by l.criada_em desc limit 500', [U(req)])).rows;
    const por_categoria = Object.fromEntries(CATEGORIAS.map((c) => [c, l.filter((x) => x.categoria === c).length]));
    res.json({ total: l.length, por_categoria, ...agruparErros(l), recentes: l.slice(0, 10).map((x) => ({ categoria: x.categoria, erro_tipo: x.erro_tipo, descricao: x.descricao, titulo: x.titulo, em: x.criada_em })) });
  }));

  /* ---------- desempenho e trilha ---------- */
  app.get('/api/estudo/trilha', autenticar, rota(async (req, res) => {
    await base();
    const ordem = req.query?.ordem === 'fortes' ? 'fortes' : 'fracos';
    const ts = await desempenhoTemas(q, U(req));
    const praticados = ts.filter((t) => t.execucoes > 0 || t.cartoes_total > 0 || t.lacunas > 0 || t.origem !== 'base');
    const escolhidos = ordenarTrilha(praticados.length ? praticados : ts, ordem).slice(0, 30);
    const ids = escolhidos.map((t) => t.id);
    const est = ids.length ? (await q(`select et.tema_id, s.id, s.titulo from estacao_temas et join estacoes s on s.id = et.estacao_id where et.tema_id = any($1::uuid[]) and s.status='aprovada' order by s.titulo`, [lit(ids)])).rows : [];
    const alvos = ids.length ? (await q(`select et.tema_id, l.descricao from lacunas l join estacao_temas et on et.estacao_id = l.estacao_id where l.usuario_id=$2 and et.tema_id = any($1::uuid[]) and l.descricao <> '' order by l.criada_em desc`, [lit(ids), U(req)])).rows : [];
    const retestes = (await q(`select ue.estacao_id, s.titulo, ue.ultima_em, ue.melhor_nota,
        (select coalesce(sum(p.pontos_total),0) from pep_itens p where p.estacao_id = ue.estacao_id) maximo,
        (select e.nota from execucoes e join ciclo_itens i on i.id = e.item_id where e.candidato_id = ue.usuario_id and i.estacao_id = ue.estacao_id and e.estado='finalizada' and e.nota is not null order by e.finalizada_em desc limit 1) ultima_nota
        from usuario_estacao ue join estacoes s on s.id = ue.estacao_id
        where ue.usuario_id=$1 and ue.ultima_em is not null`, [U(req)])).rows;
    res.json({
      ordem,
      temas: escolhidos.map((t) => ({ ...t, ...proximoPasso(t),
        estacoes: est.filter((e) => e.tema_id === t.id).slice(0, 3).map((e) => ({ id: e.id, titulo: e.titulo })),
        alvos: alvos.filter((a) => a.tema_id === t.id).slice(0, 3).map((a) => a.descricao) })),
      retestes: retestes.map((r) => {
        const pct = Number(r.maximo) > 0 && r.ultima_nota !== null ? Number(r.ultima_nota) / Number(r.maximo) : null;
        if (pct === null) return null;
        const vence = new Date(new Date(r.ultima_em).getTime() + diasParaReteste(pct) * 86_400_000);
        return { estacao_id: r.estacao_id, titulo: r.titulo, percentual: Math.round(pct * 100), vence_em: vence, vencido: vence <= new Date() };
      }).filter(Boolean).sort((a, b) => new Date(a.vence_em) - new Date(b.vence_em)).slice(0, 10),
    });
  }));

  app.get('/api/estudo/desempenho', autenticar, rota(async (req, res) => {
    const r = await q(`select t.area, count(*)::int execucoes, sum(e.nota) pontos,
        sum((select coalesce(sum(p.pontos_total),0) from pep_itens p where p.estacao_id = i.estacao_id)) maximo
      from execucoes e join ciclo_itens i on i.id = e.item_id join estacoes t on t.id = i.estacao_id
      where e.candidato_id=$1 and e.estado='finalizada' and e.nota is not null group by t.area order by t.area`, [U(req)]);
    res.json(r.rows.map((x) => ({ area: x.area, execucoes: x.execucoes, percentual: Number(x.maximo) > 0 ? Math.round((Number(x.pontos) / Number(x.maximo)) * 100) : null })));
  }));

  /* ---------- mapa de temas ---------- */
  app.get('/api/estudo/grafo', autenticar, rota(async (req, res) => {
    await base();
    const ts = await desempenhoTemas(q, U(req));
    const arestas = (await q('select de, para, tipo, peso::float peso, motivo from tema_relacoes')).rows;
    const comLigacao = new Set(arestas.flatMap((a) => [a.de, a.para]));
    const grau = new Map(); for (const a of arestas) { grau.set(a.de, (grau.get(a.de) ?? 0) + 1); grau.set(a.para, (grau.get(a.para) ?? 0) + 1); }
    const est = new Map((await q(`select et.tema_id, count(*)::int n, avg(case s.dificuldade when 'básica' then 1 when 'intermediária' then 2 when 'avançada' then 3 end)::float dif
        from estacao_temas et join estacoes s on s.id = et.estacao_id where s.status='aprovada' group by 1`)).rows.map((r) => [r.tema_id, r]));
    const def = new Map((await q('select id, complexidade from temas where complexidade is not null')).rows.map((r) => [r.id, r.complexidade]));
    // nós: os ligados + os já praticados; os temas da base sem nenhuma ligação ficam fora (poluiriam o mapa)
    const nos = ts.filter((t) => comLigacao.has(t.id) || t.execucoes > 0 || t.cartoes_total > 0 || t.origem !== 'base').slice(0, 400)
      .map((t) => ({ ...t, ligacoes: grau.get(t.id) ?? 0, estacoes: est.get(t.id)?.n ?? 0, complexidade: complexidadeDoTema({ definida: def.get(t.id) ?? null, difMedia: est.get(t.id)?.dif ?? null, grau: grau.get(t.id) ?? 0 }) }));
    const vivos = new Set(nos.map((n) => n.id));
    res.json({ nos, arestas: arestas.filter((a) => vivos.has(a.de) && vivos.has(a.para)), tipos: [...new Set(arestas.map((a) => a.tipo))].sort() });
  }));

  /* ---------- sugestão de estações e biblioteca de revisão ---------- */
  // 5 estações aprovadas, sorteadas com peso: temas de pior desempenho e nível mais alto pesam mais; o que já foi bem feito, menos.
  app.get('/api/estudo/sugestoes-estacoes', autenticar, rota(async (req, res) => {
    await base();
    const n = Math.min(10, Math.max(1, Number.parseInt(req.query?.n, 10) || 5));
    const area = AREAS.includes(req.query?.area) ? req.query.area : null;
    const ts = new Map((await desempenhoTemas(q, U(req))).map((t) => [t.id, t.desempenho]));
    const lig = new Map();
    for (const r of (await q('select et.estacao_id, et.tema_id from estacao_temas et')).rows) { if (!lig.has(r.estacao_id)) lig.set(r.estacao_id, []); lig.get(r.estacao_id).push({ desempenho: ts.get(r.tema_id) ?? null }); }
    const feitas = new Map((await q(`select ue.estacao_id, ue.vezes_realizada vezes, ue.ultima_em,
        (ue.melhor_nota / nullif((select sum(p.pontos_total) from pep_itens p where p.estacao_id = ue.estacao_id), 0))::float melhor
      from usuario_estacao ue where ue.usuario_id = $1`, [U(req)])).rows.map((r) => [r.estacao_id, r]));
    const cand = (await q(`select id, titulo, area, duracao_min, dificuldade from estacoes where status='aprovada' and ($1::text is null or area = $1)
        and not exists (select 1 from execucoes e join ciclo_itens i on i.id = e.item_id where i.estacao_id = estacoes.id and e.candidato_id = $2 and e.estado = 'em_andamento')`, [area, U(req)])).rows;
    const agora = Date.now();
    const itens = cand.map((e) => {
      const f = feitas.get(e.id);
      const { peso, motivo } = pesoEstacao({ temas: lig.get(e.id) ?? [], dificuldade: e.dificuldade, feita: f ? { vezes: f.vezes, melhor: f.melhor === null ? null : Number(f.melhor), dias: f.ultima_em ? (agora - new Date(f.ultima_em).getTime()) / 86_400_000 : null } : null });
      return { ...e, peso, motivo };
    });
    res.json({ total_disponiveis: cand.length, sugestoes: sortearPonderado(itens, n, rng).map(({ peso: _p, ...e }) => e) });
  }));

  // Cartões criados a partir das estações da pessoa, por estação: pendentes (nunca revisados ou vencidos) e executados.
  app.get('/api/estudo/biblioteca', autenticar, rota(async (req, res) => {
    const estado = ['pendente', 'executada'].includes(req.query?.estado) ? req.query.estado : null;
    const r = await q(`select c.id, c.frente, c.verso, c.estacao_id, es.titulo estacao_titulo, t.nome tema,
        case when p.cartao_id is null or p.proximo_em <= now() then 'pendente' else 'executada' end situacao, p.ultima_em, p.proximo_em, coalesce(p.acertos,0)::int acertos, coalesce(p.erros,0)::int erros
      from cartoes c join estacoes es on es.id = c.estacao_id join temas t on t.id = c.tema_id
      left join cartao_progresso p on p.cartao_id = c.id and p.usuario_id = $1
     where c.criado_por = $1 order by es.titulo, c.criado_em limit 600`, [U(req)]);
    const por = new Map();
    for (const c of r.rows) {
      if (!por.has(c.estacao_id)) por.set(c.estacao_id, { estacao_id: c.estacao_id, titulo: c.estacao_titulo, pendentes: 0, executadas: 0, cartoes: [] });
      const g = por.get(c.estacao_id); if (c.situacao === 'pendente') g.pendentes++; else g.executadas++;
      if (!estado || estado === c.situacao) g.cartoes.push({ id: c.id, frente: c.frente, verso: c.verso, tema: c.tema, situacao: c.situacao, ultima_em: c.ultima_em, proximo_em: c.proximo_em, acertos: c.acertos, erros: c.erros });
    }
    const estacoes = [...por.values()].filter((g) => !estado || g.cartoes.length);
    res.json({ total: r.rows.length, pendentes: r.rows.filter((c) => c.situacao === 'pendente').length, executadas: r.rows.filter((c) => c.situacao === 'executada').length, estacoes });
  }));

  // Qualquer nome de tema (catálogo, matriz por ano, trilha) vira um tema do mapa, para poder abrir o quadro explicativo.
  app.post('/api/estudo/temas/resolver', autenticar, rota(async (req, res) => {
    const nome = String(req.body?.nome ?? '').replace(/[\u0000-\u001F]/g, ' ').trim().slice(0, 120);
    if (nome.length < 2) return res.status(400).json({ erro: 'Informe o nome do tema.' });
    await base();
    const id = await garantirTema(q, nome, { area: AREAS.includes(req.body?.area) ? req.body.area : null, origem: 'manual' });
    res.json({ id });
  }));

  app.get('/api/estudo/temas/:id', autenticar, ID, rota(async (req, res) => {
    const t = await tema(req.params.id); if (!t) return res.status(404).json({ erro: 'Tema não encontrado.' });
    const dir = await diretrizesDoTema(q, t);
    const resumos = (await q('select id, foco, titulo, corpo, origem, diretriz_id, criado_em from resumos where tema_id=$1 order by criado_em desc limit 10', [t.id])).rows;
    const c = (await q(`select c.serie, count(*)::int total, count(*) filter (where p.cartao_id is null or p.proximo_em <= now())::int vencidos
        from cartoes c left join cartao_progresso p on p.cartao_id = c.id and p.usuario_id = $2 where c.tema_id=$1 group by c.serie order by c.serie`, [t.id, U(req)])).rows;
    const rel = (await q(`select r.tipo, r.motivo, case when r.de = $1 then r.para else r.de end outro, t2.nome
        from tema_relacoes r join temas t2 on t2.id = case when r.de = $1 then r.para else r.de end where r.de=$1 or r.para=$1 order by r.peso desc limit 20`, [t.id])).rows;
    const estacoes = (await q(`select s.id, s.titulo from estacao_temas et join estacoes s on s.id = et.estacao_id where et.tema_id=$1 and s.status='aprovada' order by s.titulo limit 10`, [t.id])).rows;
    // contexto do argumento: quantas vezes e em que anos caiu em prova (matriz INEP) e como a pessoa está nele
    const alvo = normTema(t.nome);
    const anos = alvo.length < 4 ? [] : [...new Set(temasProvas.filter((x) => { const n = normTema(x.tema); return n === alvo || (n.length >= 5 && (n.includes(alvo) || alvo.includes(n))); }).map((x) => x.ano))].sort();
    const meu = (await desempenhoTemas(q, U(req))).find((x) => x.id === t.id);
    res.json({ tema: t, diretrizes: dir.map((d) => ({ id: d.id, titulo: d.titulo, fonte: d.fonte, url: d.url })), sem_diretriz: dir.length === 0,
      resumos, series: c, relacoes: rel, estacoes,
      contexto: { relevancia: t.relevancia, anos_prova: anos, desempenho: meu?.desempenho ?? null, execucoes: meu?.execucoes ?? 0, cartoes_total: meu?.cartoes_total ?? 0, lacunas: meu?.lacunas ?? 0 } });
  }));

  // IA propõe temas ligados ao tema; entram no mapa com origem 'ia' (relações fracas até alguém confirmar na prática).
  app.post('/api/estudo/temas/:id/expandir', autenticar, ID, rota(async (req, res) => {
    const t = await tema(req.params.id); if (!t) return res.status(404).json({ erro: 'Tema não encontrado.' });
    if (!ia.configurado()) return ia503(res);
    if (limite(req, res)) return;
    try {
      const existentes = (await q('select nome from temas order by criado_em desc limit 80')).rows.map((x) => x.nome);
      const dir = await diretrizesDoTema(q, t);
      const r = await ia.expandirTema({ tema: t.nome, area: t.area, existentes, diretrizes: dir });
      const criados = [];
      for (const x of r.relacionados) {
        const id = await garantirTema(q, x.nome, { area: x.area ?? t.area, origem: 'ia' });
        if (!id || id === t.id) continue;
        const [de, para] = x.tipo === 'pre_requisito' ? [id, t.id] : (id < t.id ? [id, t.id] : [t.id, id]);
        await q(`insert into tema_relacoes (de, para, tipo, peso, motivo, origem) values ($1,$2,$3,0.6,$4,'ia') on conflict (de, para, tipo) do update set motivo = excluded.motivo`, [de, para, x.tipo, x.motivo]);
        criados.push({ id, nome: x.nome, tipo: x.tipo, motivo: x.motivo });
      }
      res.status(201).json({ criados, sem_diretriz: dir.length === 0 });
    } catch (e) { erroIA(res, e); }
  }));

  app.post('/api/estudo/temas/:id/resumo', autenticar, ID, rota(async (req, res) => {
    const t = await tema(req.params.id); if (!t) return res.status(404).json({ erro: 'Tema não encontrado.' });
    if (!ia.configurado()) return ia503(res);
    const foco = String(req.body?.foco ?? '').replace(/[\u0000-\u001F]/g, ' ').trim().slice(0, 120);
    if (limite(req, res)) return;
    try {
      const dir = await diretrizesDoTema(q, t);
      const r = await ia.gerarResumo({ tema: t.nome, area: t.area, foco, diretrizes: dir });
      const id = (await q('insert into resumos (tema_id, foco, titulo, corpo, diretriz_id, criado_por) values ($1,$2,$3,$4,$5,$6) returning id',
        [t.id, foco, r.resumo.titulo, r.resumo.corpo, dir[0]?.id ?? null, U(req)])).rows[0].id;
      res.status(201).json({ id, ...r.resumo, foco, sem_diretriz: dir.length === 0 });
    } catch (e) { erroIA(res, e); }
  }));

  /* ---------- cartões ---------- */
  // Nova série de cartões do tema (a IA recebe o que já existe e os seus erros recentes neste tema, para não repetir e para corrigir).
  app.post('/api/estudo/temas/:id/cartoes/gerar', autenticar, ID, rota(async (req, res) => {
    const t = await tema(req.params.id); if (!t) return res.status(404).json({ erro: 'Tema não encontrado.' });
    if (!ia.configurado()) return ia503(res);
    const n = Number.isInteger(req.body?.quantidade) ? Math.min(15, Math.max(3, req.body.quantidade)) : 8;
    if (limite(req, res)) return;
    try {
      const existentes = (await q('select frente from cartoes where tema_id=$1 order by criado_em desc limit 40', [t.id])).rows.map((x) => x.frente);
      const lacunas = (await q(`select l.descricao from lacunas l join estacao_temas et on et.estacao_id = l.estacao_id where l.usuario_id=$1 and et.tema_id=$2 and l.descricao <> '' order by l.criada_em desc limit 8`, [U(req), t.id])).rows.map((x) => x.descricao);
      const dir = await diretrizesDoTema(q, t);
      const lista = (v, max, tam) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string').map((x) => x.replace(/[\u0000-\u001F]/g, ' ').trim().slice(0, tam)).filter(Boolean).slice(0, max) : []);
      const foco = String(req.body?.foco ?? '').replace(/[\u0000-\u001F]/g, ' ').trim().slice(0, 160);
      const pontos = lista(req.body?.pontos, 8, 220);
      // com argumento ou pontos escolhidos, os cartões aprofundam o escolhido (camadas), em vez de repetir o básico
      const r = await ia.gerarCartoes({ tema: t.nome, area: t.area, diretrizes: dir, quantidade: n, existentes, lacunas, foco, pontos, aprofundar: req.body?.aprofundar !== false && Boolean(foco || pontos.length) });
      const serie = ((await q('select coalesce(max(serie),0)+1 s from cartoes where tema_id=$1', [t.id])).rows[0].s);
      await q(`insert into cartoes (tema_id, serie, frente, verso, origem, diretriz_id, criado_por)
        select $1, $2, x.frente, x.verso, 'ia', $3, $4 from jsonb_to_recordset($5::jsonb) as x(frente text, verso text)`, [t.id, serie, dir[0]?.id ?? null, U(req), JSON.stringify(r.cartoes)]);
      res.status(201).json({ serie, total: r.cartoes.length, sem_diretriz: dir.length === 0, aprofundado: Boolean(foco || pontos.length) });
    } catch (e) { erroIA(res, e); }
  }));

  // Cartões para estudar agora: vencidos primeiro, depois os novos. Opcional: um tema só.
  app.get('/api/estudo/cartoes/hoje', autenticar, rota(async (req, res) => {
    const tema_id = idValido(req.query?.tema) ? req.query.tema : null;
    const r = await q(`select c.id, c.frente, c.verso, c.serie, c.diretriz_id is null sem_diretriz, t.id tema_id, t.nome tema, c.estacao_id, es.titulo estacao_titulo, p.cartao_id is null novo, p.proximo_em
        from cartoes c join temas t on t.id = c.tema_id left join estacoes es on es.id = c.estacao_id left join cartao_progresso p on p.cartao_id = c.id and p.usuario_id = $1
       where ($2::uuid is null or c.tema_id = $2) and (p.cartao_id is null or p.proximo_em <= now())
       order by p.proximo_em nulls last, c.criado_em limit 20`, [U(req), tema_id]);
    res.json(r.rows);
  }));

  app.post('/api/estudo/cartoes/:id/revisar', autenticar, ID, rota(async (req, res) => {
    const nota = req.body?.qualidade;
    if (![0, 3, 4, 5].includes(nota)) return res.status(400).json({ erro: 'Qualidade inválida (use 0, 3, 4 ou 5).' });
    if (!(await q('select 1 from cartoes where id=$1', [req.params.id])).rows[0]) return res.status(404).json({ erro: 'Cartão não encontrado.' });
    const atual = (await q('select facilidade, intervalo_dias, repeticoes from cartao_progresso where usuario_id=$1 and cartao_id=$2', [U(req), req.params.id])).rows[0];
    const n = sm2(atual, nota);
    await q(`insert into cartao_progresso (usuario_id, cartao_id, facilidade, intervalo_dias, repeticoes, proximo_em, ultima_em, acertos, erros)
        values ($1,$2,$3,$4::int,$5, now() + make_interval(days => $4::int), now(), $6, $7)
      on conflict (usuario_id, cartao_id) do update set facilidade=$3, intervalo_dias=$4::int, repeticoes=$5, proximo_em=now() + make_interval(days => $4::int), ultima_em=now(),
        acertos = cartao_progresso.acertos + $6, erros = cartao_progresso.erros + $7`, [U(req), req.params.id, n.facilidade, n.intervalo_dias, n.repeticoes, n.acertou ? 1 : 0, n.acertou ? 0 : 1]);
    res.json({ proxima_em_dias: n.intervalo_dias, acertou: n.acertou });
  }));

  /* ---------- nível 3: bloco misto ---------- */
  // Sorteia N estações aprovadas alternando as áreas (o tema não é mostrado a quem vai fazer: a fila já esconde as futuras).
  app.post('/api/estudo/bloco-misto', autenticar, rota(async (req, res) => {
    const n = Number.isInteger(req.body?.quantidade) ? Math.min(8, Math.max(2, req.body.quantidade)) : 5;
    const todas = (await q(`select id, area from estacoes where status='aprovada' order by random()`)).rows;
    const porArea = new Map(); for (const e of todas) { if (!porArea.has(e.area)) porArea.set(e.area, []); porArea.get(e.area).push(e.id); }
    const areas = [...porArea.keys()].sort(() => Math.random() - 0.5);
    const escolhidas = [];
    while (escolhidas.length < n && areas.some((a) => porArea.get(a).length)) {
      for (const a of areas) { const x = porArea.get(a).shift(); if (x && escolhidas.length < n) escolhidas.push(x); }
    }
    if (escolhidas.length < 2) return res.status(409).json({ erro: 'São necessárias pelo menos 2 estações aprovadas para um bloco misto.', codigo: 'POUCAS_ESTACOES' });
    res.json({ estacoes: escolhidas });
  }));
}
