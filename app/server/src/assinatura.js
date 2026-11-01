// Assinatura de uma estação para detectar duplicidade: título normalizado + hash do conteúdo que define a prática.
// "Conteúdo idêntico" = mesma área, mesmo cenário, instruções ao candidato, roteiro do ator e checklist (descrição e pontos),
// ignorando maiúsculas, acentos, pontuação e espaços. Mudar só o título NÃO torna a estação diferente.
import crypto from 'node:crypto';

export const normalizar = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/** Estação em branco (só o título) não tem conteúdo para comparar: devolve null para não acusar duplicidade falsa. */
export function assinatura(e) {
  const texto = [e?.cenario, e?.instrucoes_candidato, e?.script_ator].map(normalizar).join('|');
  const pep = (Array.isArray(e?.pep) ? e.pep : []).map((i) => `${normalizar(i.descricao)}#${Number(i.pontos_total) || 0}`).filter((x) => x.length > 2).sort();
  const util = texto.replace(/\|/g, '').length >= 40 || pep.length >= 2;
  const hash = util ? crypto.createHash('sha256').update(`${e?.area ?? ''}\n${texto}\n${pep.join(';')}`).digest('hex') : null;
  return { titulo_norm: normalizar(e?.titulo), conteudo_hash: hash };
}

/** Procura estação igual. Só enxerga o que o usuário pode ver (aprovadas, as suas, ou tudo para a moderação). */
export async function acharDuplicada(q, estacao, { usuarioId, moderador = false, exceto = null } = {}) {
  const a = assinatura(estacao);
  if (!a.titulo_norm) return null;
  const r = await q(`select id, titulo, status, area, (conteudo_hash is not null and conteudo_hash = $2::text) mesmo_conteudo
      from estacoes
     where ($3::uuid is null or id <> $3::uuid) and (titulo_norm = $1 or (conteudo_hash is not null and conteudo_hash = $2::text))
       and (status = 'aprovada' or criado_por = $4::uuid or $5::boolean)
     order by (conteudo_hash is not null and conteudo_hash = $2::text) desc, (status = 'aprovada') desc limit 1`,
  [a.titulo_norm, a.conteudo_hash, exceto, usuarioId ?? null, moderador]);
  const x = r.rows[0];
  return x ? { tipo: x.mesmo_conteudo ? 'conteudo' : 'titulo', existente: { id: x.id, titulo: x.titulo, status: x.status, area: x.area } } : null;
}

/** "Título", "Título (2)", "Título (3)"… o primeiro livre entre TODAS as estações (só o sufixo vaza, nunca o conteúdo). */
export async function tituloLivre(q, titulo, exceto = null) {
  const base = String(titulo ?? '').replace(/\s*\(\d{1,3}\)\s*$/, '').trim().slice(0, 110);
  for (let n = 1; n < 200; n++) {
    const t = n === 1 ? String(titulo).trim() : `${base} (${n})`;
    const r = await q('select 1 from estacoes where titulo_norm = $1 and ($2::uuid is null or id <> $2::uuid) limit 1', [normalizar(t), exceto]);
    if (!r.rows[0]) return t;
  }
  return `${base} (${Date.now()})`;
}

/** Preenche as assinaturas de estações antigas (roda na subida do servidor; idempotente). */
export async function preencherAssinaturas(q) {
  const r = await q(`select e.id, e.titulo, e.area, e.cenario, e.instrucoes_candidato, e.script_ator,
      coalesce((select jsonb_agg(jsonb_build_object('descricao', p.descricao, 'pontos_total', p.pontos_total)) from pep_itens p where p.estacao_id = e.id), '[]') pep
    from estacoes e where e.titulo_norm is null limit 5000`);
  for (const e of r.rows) {
    const a = assinatura(e);
    await q('update estacoes set titulo_norm=$2, conteudo_hash=$3 where id=$1', [e.id, a.titulo_norm, a.conteudo_hash]);
  }
  return r.rows.length;
}
