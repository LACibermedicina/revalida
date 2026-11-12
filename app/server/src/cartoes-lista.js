// Cartões de estudo: listagem de TODOS (paginada de 10 em 10 por área), criação manual / a partir de rascunho da IA,
// edição e exclusão. A raridade da carta (visual RPG) vem do estágio da repetição espaçada de quem consulta.
import { idValido, rota } from './seguranca.js';

export const AREAS_CARTAO = ['clinica_medica', 'cirurgia', 'ginecologia_obstetricia', 'pediatria', 'mfc'];
export const POR_PAGINA = 10;

/** Estágio e raridade a partir do progresso (sem progresso = carta nova/comum). */
export function raridadeDoCartao(p) {
  const rep = Number(p?.repeticoes ?? 0); const dias = Number(p?.intervalo_dias ?? 0); const acertos = Number(p?.acertos ?? 0);
  if (!p || p.repeticoes === null || p.repeticoes === undefined) return { estagio: 'novo', raridade: 'comum', nivel: 1 };
  if (dias >= 30) return { estagio: 'dominado', raridade: 'lendaria', nivel: 5 };
  if (rep >= 4 || dias >= 14) return { estagio: 'dominado', raridade: 'epica', nivel: 4 };
  if (rep >= 2) return { estagio: 'revisando', raridade: 'rara', nivel: 3 };
  if (rep >= 1 || acertos > 0) return { estagio: 'aprendendo', raridade: 'incomum', nivel: 2 };
  return { estagio: 'aprendendo', raridade: 'comum', nivel: 1 };
}

const limpar = (v, n) => String(v ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim().slice(0, n);

/** Valida a lista que chega do assistente (revisada pela pessoa). */
export function validarCartoesManuais(lista) {
  if (!Array.isArray(lista) || !lista.length) return { erro: 'Envie ao menos um cartão.' };
  if (lista.length > 30) return { erro: 'No máximo 30 cartões por vez.' };
  const out = [];
  for (const c of lista) {
    const frente = limpar(c?.frente, 600); const verso = limpar(c?.verso, 1500);
    if (frente.length < 3 || verso.length < 2) return { erro: 'Cada cartão precisa de frente (mín. 3 caracteres) e verso.' };
    out.push({ frente, verso });
  }
  return { cartoes: out };
}

export function registrarCartoesLista(app, { q, autenticar, ID, U, moderador, tema, diretrizesDoTema, rascunhoIA, ia503, erroIA, ia }) {
  /* lista de todos, por área, 10 por página */
  app.get('/api/estudo/cartoes', autenticar, rota(async (req, res) => {
    const area = String(req.query?.area ?? '');
    if (area && area !== 'sem_area' && !AREAS_CARTAO.includes(area)) return res.status(400).json({ erro: 'Área inválida.' });
    const por = Math.min(50, Math.max(1, parseInt(req.query?.por, 10) || POR_PAGINA));
    const pagina = Math.max(1, parseInt(req.query?.pagina, 10) || 1);
    const temaId = idValido(req.query?.tema) ? req.query.tema : null;
    const busca = limpar(req.query?.busca, 80);
    const filtros = `($1::uuid is not null) and ($2::uuid is null or c.tema_id = $2) and ($3 = '' or c.frente ilike '%'||$3||'%' or c.verso ilike '%'||$3||'%' or t.nome ilike '%'||$3||'%')`;
    const arg = [U(req), temaId, busca];
    const areas = (await q(`select coalesce(t.area,'sem_area') area, count(*)::int total from cartoes c join temas t on t.id=c.tema_id where ${filtros} group by 1`, arg)).rows;
    const porArea = Object.fromEntries(areas.map((a) => [a.area, a.total]));
    const filtroArea = area ? ` and coalesce(t.area,'sem_area') = $4` : '';
    const args = area ? [...arg, area] : arg;
    const total = area ? (porArea[area] ?? 0) : areas.reduce((s, a) => s + a.total, 0);
    const lim = args.length;
    const r = await q(`select c.id, c.frente, c.verso, c.serie, c.origem, c.criado_por, t.id tema_id, t.nome tema, coalesce(t.area,'sem_area') area,
        p.cartao_id is not null tem_progresso, p.repeticoes::int, p.intervalo_dias::int, p.acertos::int, p.erros::int, p.facilidade::float8, p.proximo_em
      from cartoes c join temas t on t.id=c.tema_id left join cartao_progresso p on p.cartao_id=c.id and p.usuario_id=$1
      where ${filtros}${filtroArea}
      order by t.nome, c.serie, c.criado_em, c.id limit $${lim + 1} offset $${lim + 2}`, [...args, por, (pagina - 1) * por]);
    const itens = r.rows.map((x) => ({
      id: x.id, frente: x.frente, verso: x.verso, serie: x.serie, origem: x.origem, tema_id: x.tema_id, tema: x.tema, area: x.area,
      acertos: x.acertos ?? 0, erros: x.erros ?? 0, facilidade: x.facilidade ?? 2.5, intervalo_dias: x.intervalo_dias ?? 0, proximo_em: x.proximo_em,
      meu: x.criado_por === U(req), ...raridadeDoCartao(x.tem_progresso ? x : null),
    }));
    res.json({ itens, total, pagina, por, paginas: Math.max(1, Math.ceil(total / por)), por_area: porArea });
  }));

  /* assistente, passo 2: a IA propõe, NADA é salvo ainda (a pessoa revisa e edita) */
  app.post('/api/estudo/temas/:id/cartoes/rascunho', autenticar, ID, rota(async (req, res) => {
    const t = await tema(req.params.id); if (!t) return res.status(404).json({ erro: 'Tema não encontrado.' });
    if (!ia.configurado()) return ia503(res);
    try {
      const r = await rascunhoIA(req, res, t); if (!r) return;
      res.json({ cartoes: r.cartoes, sem_diretriz: r.semDiretriz, aprofundado: r.aprofundado });
    } catch (e) { erroIA(res, e); }
  }));

  /* assistente, passo 3: salva a série revisada (ou cartões escritos à mão) */
  app.post('/api/estudo/temas/:id/cartoes', autenticar, ID, rota(async (req, res) => {
    const t = await tema(req.params.id); if (!t) return res.status(404).json({ erro: 'Tema não encontrado.' });
    const v = validarCartoesManuais(req.body?.cartoes); if (v.erro) return res.status(400).json({ erro: v.erro });
    const origem = req.body?.origem === 'ia' ? 'ia' : 'manual';
    const dir = origem === 'ia' ? await diretrizesDoTema(q, t) : [];
    const serie = (await q('select coalesce(max(serie),0)+1 s from cartoes where tema_id=$1', [t.id])).rows[0].s;
    await q(`insert into cartoes (tema_id, serie, frente, verso, origem, diretriz_id, criado_por)
      select $1, $2, x.frente, x.verso, $3, $4, $5 from jsonb_to_recordset($6::jsonb) as x(frente text, verso text)`, [t.id, serie, origem, dir[0]?.id ?? null, U(req), JSON.stringify(v.cartoes)]);
    res.status(201).json({ serie, total: v.cartoes.length, origem, sem_diretriz: origem === 'ia' && dir.length === 0 });
  }));

  const dono = async (req, res) => {
    const c = (await q('select id, criado_por from cartoes where id=$1', [req.params.id])).rows[0];
    if (!c) { res.status(404).json({ erro: 'Cartão não encontrado.' }); return null; }
    if (c.criado_por !== U(req) && !moderador(req.usuario)) { res.status(403).json({ erro: 'Só quem criou o cartão (ou a moderação) pode alterá-lo.' }); return null; }
    return c;
  };
  app.put('/api/estudo/cartoes/:id', autenticar, ID, rota(async (req, res) => {
    const c = await dono(req, res); if (!c) return;
    const v = validarCartoesManuais([req.body]); if (v.erro) return res.status(400).json({ erro: v.erro });
    await q('update cartoes set frente=$2, verso=$3 where id=$1', [c.id, v.cartoes[0].frente, v.cartoes[0].verso]);
    res.json({ ok: true });
  }));
  app.delete('/api/estudo/cartoes/:id', autenticar, ID, rota(async (req, res) => {
    const c = await dono(req, res); if (!c) return;
    await q('delete from cartoes where id=$1', [c.id]);
    res.json({ ok: true });
  }));
}
