// Migrações automáticas: banco antigo (sem as tabelas novas) é atualizado na partida, uma vez só; e a cópia embarcada no servidor é igual a db/migracoes.
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { criarBanco } from './ajuda.mjs';
import { aplicarMigracoes } from '../src/migrar.js';

const DB = fileURLToPath(new URL('../../db/migracoes/', import.meta.url));
const COPIA = fileURLToPath(new URL('../migracoes/', import.meta.url));
const mudo = { log() {}, warn() {}, error() {} };

test('server/migracoes é idêntica a db/migracoes (rode scripts/sincronizar-migracoes.sh se falhar)', () => {
  const a = readdirSync(DB).filter((f) => f.endsWith('.sql')); const b = readdirSync(COPIA).filter((f) => f.endsWith('.sql'));
  assert.deepEqual(b, a);
  for (const f of a) assert.equal(readFileSync(COPIA + f, 'utf8'), readFileSync(DB + f, 'utf8'), f);
});

test('banco antigo ganha as tabelas novas na partida; segunda partida não reaplica nada', async () => {
  const b = criarBanco('rv_migrar');
  try {
    const sql = (t) => execFileSync('psql', ['-X', '-q', '-A', '-t', '-v', 'ON_ERROR_STOP=1', '-d', b.nome], { input: t, encoding: 'utf8' });
    const q = async (t) => { const out = sql(t.trim().endsWith(';') ? t : `${t};`); return { rows: /select/i.test(t) && !/insert|create|pg_advisory/i.test(t) ? out.split('\n').filter(Boolean).map((l) => (/\bok\b/.test(t) ? { ok: l === 't' } : { nome: l })) : [] }; };
    sql('drop table podcast_posicoes, podcast_tokens, podcast_itens, podcast_playlists, radia_pool cascade');   // simula volume antigo sem a migração 015
    assert.equal(sql("select to_regclass('public.podcast_itens') is null").trim(), 't');
    const r1 = await aplicarMigracoes({ q, dir: COPIA, log: mudo });
    assert.ok(!r1.erro, r1.erro); assert.ok(r1.aplicadas.length >= 15, `aplicou ${r1.aplicadas.length}`);
    assert.equal(sql("select to_regclass('public.podcast_itens') is not null").trim(), 't');
    const r2 = await aplicarMigracoes({ q, dir: COPIA, log: mudo });
    assert.deepEqual(r2.aplicadas, []); assert.equal(r2.ja_estavam, r1.aplicadas.length);
  } finally { b.derrubar(); }
});
