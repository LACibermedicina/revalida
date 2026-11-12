// Migrações automáticas na partida: o banco de uma instalação antiga (volume do Postgres já existente) não recebe o
// schema.sql de novo, então tabelas das versões novas (podcast, solo, paciente IA…) faltavam e a API respondia "Erro interno".
// As migrações em migracoes/ (cópia de db/migracoes, mantida igual por teste) são idempotentes e rodam em ordem, cada uma
// numa transação única, com trava (advisory) para duas instâncias não migrarem ao mesmo tempo. O que já rodou fica em schema_migracoes.
import { readdir, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const aqui = path.dirname(fileURLToPath(import.meta.url));
export const pastaPadrao = () => [process.env.MIGRACOES_DIR, path.resolve(aqui, '../migracoes'), path.resolve(aqui, '../../db/migracoes')].filter(Boolean).find((d) => existsSync(d)) ?? null;
const CHAVE_TRAVA = 727_016;

/** @returns {Promise<{aplicadas: string[], ja_estavam: number, erro?: string, pasta: string|null}>} nunca lança: o servidor sobe mesmo se uma migração falhar (o erro vai no log). */
export async function aplicarMigracoes({ q, dir = pastaPadrao(), log = console }) {
  const r = { aplicadas: [], ja_estavam: 0, pasta: dir };
  if (!dir) { log.warn?.('Migrações: pasta não encontrada; pulei.'); return r; }
  try {
    const base = (await q(`select to_regclass('public.usuarios') is not null as ok`)).rows[0]?.ok;
    if (!base) { log.warn?.('Migrações: banco sem o schema inicial (db/schema.sql); pulei.'); return r; }
    await q(`create table if not exists schema_migracoes (nome text primary key, aplicada_em timestamptz not null default now())`);
    const feitas = new Set((await q('select nome from schema_migracoes')).rows.map((x) => x.nome));
    const arquivos = (await readdir(dir)).filter((f) => /^\d{3}_.+\.sql$/.test(f)).sort();
    for (const f of arquivos) {
      if (feitas.has(f)) { r.ja_estavam++; continue; }
      const sql = await readFile(path.join(dir, f), 'utf8');
      // uma só instrução de rede = uma só transação; o ledger só grava se a migração inteira passou
      await q(`select pg_advisory_xact_lock(${CHAVE_TRAVA});\n${sql}\n;\ninsert into schema_migracoes (nome) values ('${f.replace(/'/g, "''")}') on conflict do nothing;`);
      r.aplicadas.push(f); log.log?.(`Migração aplicada: ${f}`);
    }
  } catch (e) {
    r.erro = String(e?.message ?? e).slice(0, 300);
    log.error?.('Migrações: falhou —', r.erro, '(a API sobe mesmo assim; rode scripts/atualizar.sh)');
  }
  return r;
}
