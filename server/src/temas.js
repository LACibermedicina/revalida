// Temas (nós do mapa), relações, diretrizes de referência e desempenho por tema. Funções recebem `q` (consulta ao banco).
import { SUBTEMAS, AREAS } from './estacao-esquema.js';
import { norm, desempenhoTema } from './estudo-logica.js';

const nomeOk = (n) => String(n ?? '').replace(/[\u0000-\u001F]/g, '').trim().slice(0, 80);

/** Cria (ou acha) o tema; devolve o id. Área só é gravada se o tema ainda não tinha. */
export async function garantirTema(q, nome, { area = null, origem = 'estacao', relevancia = 3 } = {}) {
  const n = nomeOk(nome); if (n.length < 2) return null;
  const r = await q(`insert into temas (nome, nome_norm, area, origem, relevancia) values ($1,$2,$3,$4,$5)
    on conflict (nome_norm) do update set area = coalesce(temas.area, excluded.area) returning id`, [n, norm(n), AREAS.includes(area) ? area : null, origem, relevancia]);
  return r.rows[0].id;
}

/** Temas de partida (base de referência editável): os subtemas usados no sorteio, com relevância média. Idempotente. */
export async function semearBase(q) {
  for (const [area, lista] of Object.entries(SUBTEMAS)) for (const nome of lista) await garantirTema(q, nome, { area, origem: 'base' });
}

/** Liga a estação aos seus conceitos e relaciona entre si os conceitos que aparecem juntos (relação fraca, origem 'estacao'). */
export async function sincronizarTemas(q, estacaoId) {
  const e = (await q('select area, conceitos, diagnostico_alvo from estacoes where id=$1', [estacaoId])).rows[0];
  if (!e) return;
  const nomes = [...new Set([...(Array.isArray(e.conceitos) ? e.conceitos : []), e.diagnostico_alvo].map(nomeOk).filter((n) => n.length >= 2))].slice(0, 13);
  const ids = [];
  for (const n of nomes) { const id = await garantirTema(q, n, { area: e.area }); if (id && !ids.includes(id)) ids.push(id); }
  await q('delete from estacao_temas where estacao_id=$1', [estacaoId]);
  for (const id of ids) await q('insert into estacao_temas (estacao_id, tema_id) values ($1,$2) on conflict do nothing', [estacaoId, id]);
  for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
    const [de, para] = ids[i] < ids[j] ? [ids[i], ids[j]] : [ids[j], ids[i]];
    await q(`insert into tema_relacoes (de, para, tipo, peso, origem) values ($1,$2,'relacionado',0.4,'estacao') on conflict do nothing`, [de, para]);
  }
}

/** Desempenho do usuário por tema (estações finalizadas com nota + acerto dos cartões). */
export async function desempenhoTemas(q, usuarioId) {
  const r = await q(`
    with ex as (
      select i.estacao_id, e.nota, (select coalesce(sum(p.pontos_total),0) from pep_itens p where p.estacao_id = i.estacao_id) mx, e.finalizada_em
        from execucoes e join ciclo_itens i on i.id = e.item_id
       where e.candidato_id = $1 and e.estado = 'finalizada' and e.nota is not null),
    por_tema as (
      select et.tema_id, sum(ex.nota) pontos, sum(ex.mx) maximo, count(*) n, max(ex.finalizada_em) ultima
        from estacao_temas et join ex on ex.estacao_id = et.estacao_id group by et.tema_id),
    cart as (
      select c.tema_id, count(*) total, coalesce(sum(p.acertos),0) acertos, coalesce(sum(p.erros),0) erros,
             count(*) filter (where p.cartao_id is null or p.proximo_em <= now()) vencidos
        from cartoes c left join cartao_progresso p on p.cartao_id = c.id and p.usuario_id = $1 group by c.tema_id),
    lac as (
      select et.tema_id, count(*) n from lacunas l join estacao_temas et on et.estacao_id = l.estacao_id where l.usuario_id = $1 group by et.tema_id)
    select t.id, t.nome, t.area, t.relevancia, t.origem, pt.pontos, pt.maximo, pt.n execucoes, pt.ultima,
           coalesce(c.total,0)::int cartoes_total, coalesce(c.vencidos,0)::int cartoes_vencidos, c.acertos, c.erros, coalesce(l.n,0)::int lacunas
      from temas t left join por_tema pt on pt.tema_id = t.id left join cart c on c.tema_id = t.id left join lac l on l.tema_id = t.id`, [usuarioId]);
  return r.rows.map((t) => ({
    id: t.id, nome: t.nome, area: t.area, relevancia: t.relevancia, origem: t.origem, execucoes: Number(t.execucoes ?? 0), ultima: t.ultima,
    cartoes_total: t.cartoes_total, cartoes_vencidos: t.cartoes_vencidos, lacunas: t.lacunas,
    desempenho: desempenhoTema({ pontos: Number(t.pontos ?? 0), maximo: Number(t.maximo ?? 0), acertos: Number(t.acertos ?? 0), erros: Number(t.erros ?? 0) }),
  }));
}

/** Candidatos ponderados para o sorteio de estações: relevância (1–5) ou, para "fracos", o quanto o desempenho está abaixo. */
export async function candidatosPorPrioridade(q, prioridade, usuarioId) {
  const temas = await desempenhoTemas(q, usuarioId);
  return temas.filter((t) => t.area).map((t) => ({
    nome: t.nome, area: t.area,
    peso: prioridade === 'fracos' ? (t.desempenho === null ? 2.5 : 0.5 + (1 - t.desempenho) * 5) : t.relevancia,
  }));
}

/** Diretrizes cadastradas que mencionam o tema (título ou texto) na área; até 3, com texto limitado. */
export async function diretrizesDoTema(q, { nome, area }) {
  const n = nomeOk(nome); if (n.length < 3) return [];
  const r = await q(`select id, titulo, fonte, url, left(texto, 3500) texto from diretrizes
      where (titulo ilike '%'||$1||'%' or texto ilike '%'||$1||'%') and ($2::text is null or area is null or area = $2)
      order by (titulo ilike '%'||$1||'%') desc, criado_em desc limit 3`, [n.replace(/[%_\\]/g, ' '), AREAS.includes(area) ? area : null]);
  return r.rows;
}
