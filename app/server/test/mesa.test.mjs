// Mesa: estado saneado (favoritos/notas/dock) e mensagens diretas só entre colegas de sala, sem bloqueio. Postgres real.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { criarApp, criarBanco, criarQ } from './ajuda.mjs';
import { registrarMesa, sanearEstado } from '../src/mesa.js';

const bd = criarBanco('rv_mesa'); const q = criarQ(bd.nome); const { app, chamar } = criarApp();
const autenticar = async (req, _res, prox) => { const id = String(req.headers.authorization).split(' ')[1]; req.usuario = { id, nome: 'x', papel_app: 'usuario' }; prox(); };
before(() => registrarMesa(app, { q, autenticar })); after(() => bd.derrubar());
const uid = async (n) => (await q(`insert into usuarios (nome,email,senha_hash,visto_em,papel_app) values ($1,$2,'x',now(),'usuario') returning id`, [n, `${n}${Math.random()}@x.com`])).rows[0].id;
const api = (m, u, t, corpo) => chamar(m, u, { token: t, corpo });
const juntar = async (a, b) => { const s = (await q('select rv_sala_criar($1) as id', [a])).rows[0].id; await q('select rv_sala_entrar($1,$2)', [s, b]); };

test('estado: salva, relê e saneia (rótulos, tipos, limites, telas inexistentes)', async () => {
  const a = await uid('Ana');
  assert.equal((await api('GET', '/api/mesa', a)).corpo.estado, null);
  const grande = 'x'.repeat(9000);
  const r = await api('PUT', '/api/mesa', a, { estado: {
    favoritos: [{ tipo: 'tela', ref: 'podcast', rotulo: 'Podcast', x: 10, y: 20 }, { tipo: 'tela', ref: 'nao-existe' }, { tipo: 'estacao', ref: 'abc', rotulo: 'Dor torácica', x: -5, y: 99999 }, { tipo: 'hack', ref: 'x' }],
    notas: [{ id: 'n1', titulo: 'Rever', texto: grande, cor: 'neon' }, { id: 'n1', texto: 'duplicada' }, { id: 'n 2<script>', texto: 'ok' }],
    dock: ['painel', 'xx', 'painel', 'notas'], tema: 'roxo' } });
  assert.equal(r.status, 200);
  const e = (await api('GET', '/api/mesa', a)).corpo.estado;
  assert.deepEqual(e.favoritos.map((f) => f.ref), ['podcast', 'abc']);
  assert.equal(e.favoritos[1].x, 0); assert.equal(e.favoritos[1].y, 4000);
  assert.equal(e.notas.length, 2); assert.equal(e.notas[0].texto.length, 4000); assert.equal(e.notas[0].cor, 'amarela'); assert.equal(e.notas[1].id, 'n2script');
  assert.deepEqual(e.dock, ['painel', 'notas']); assert.equal(e.tema, 'auto');
  assert.equal((await api('PUT', '/api/mesa', a, { estado: [] })).status, 400);
  assert.throws(() => sanearEstado(null));
});

test('estado é por usuário', async () => {
  const a = await uid('A1'), b = await uid('B1');
  await api('PUT', '/api/mesa', a, { estado: { notas: [{ id: 'z', texto: 'só da A1' }] } });
  assert.equal((await api('GET', '/api/mesa', b)).corpo.estado, null);
});

test('mensagens: só entre colegas de sala; lidas; bloqueio corta; limite de envio', async () => {
  const a = await uid('Ana2'), b = await uid('Beto2'), c = await uid('Caio2');
  assert.equal((await api('POST', `/api/mensagens/${b}`, a, { texto: 'oi' })).status, 403, 'sem sala em comum');
  await juntar(a, b);
  const col = (await api('GET', '/api/mesa/colegas', a)).corpo; assert.deepEqual(col.colegas.map((x) => x.nome), ['Beto2']);
  assert.equal((await api('POST', `/api/mensagens/${b}`, a, { texto: '  ' })).status, 400);
  assert.equal((await api('POST', `/api/mensagens/${b}`, a, { texto: 'Bora treinar amanhã?' })).status, 201);
  assert.equal((await api('POST', `/api/mensagens/${c}`, a, { texto: 'oi' })).status, 403);
  const cb = (await api('GET', '/api/mesa/colegas', b)).corpo; assert.equal(cb.nao_lidas, 1); assert.equal(cb.colegas[0].nao_lidas, 1);
  const conv = (await api('GET', `/api/mensagens/${a}`, b)).corpo.itens; assert.equal(conv.length, 1); assert.equal(conv[0].minha, false);
  assert.equal((await api('GET', '/api/mesa/colegas', b)).corpo.nao_lidas, 0, 'abrir a conversa marca como lida');
  await api('POST', `/api/mensagens/${a}`, b, { texto: 'Bora!' });
  assert.deepEqual((await api('GET', `/api/mensagens/${b}`, a)).corpo.itens.map((m) => m.minha), [true, false]);
  await q('insert into bloqueios (bloqueador_id, bloqueado_id) values ($1,$2)', [b, a]);
  assert.equal((await api('POST', `/api/mensagens/${b}`, a, { texto: 'x' })).status, 403);
  assert.equal((await api('GET', `/api/mensagens/${a}`, b)).status, 403);
  assert.equal((await api('GET', '/api/mesa/colegas', a)).corpo.colegas.length, 0);
  assert.equal((await api('GET', '/api/mensagens/xx', a)).status, 400);
});

test('limite de 30 mensagens por minuto', async () => {
  const a = await uid('Ana3'), b = await uid('Beto3'); await juntar(a, b);
  let ultimo; for (let i = 0; i < 31; i++) ultimo = (await api('POST', `/api/mensagens/${b}`, a, { texto: `m${i}` })).status;
  assert.equal(ultimo, 429);
});
