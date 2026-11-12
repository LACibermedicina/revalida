// Salas abertas (sem dono): nome, expiração por vazio, pausa imediata e retomada automática, chat, inversão e chefia.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { criarApp, criarBanco, criarQ } from './ajuda.mjs';
import { registrarSalas } from '../src/salas.js';

const bd = criarBanco('rv_salasabertas');
const q = criarQ(bd.nome);
const { app, chamar } = criarApp();
const autenticar = (req, _res, prox) => { req.usuario = { id: String(req.headers.authorization).split(' ')[1], papel_app: String(req.headers.authorization).split(' ')[2] }; prox(); };
before(() => registrarSalas(app, { q, autenticar, agora: { configurado: () => false }, cfg: { obter: () => '' }, difundir: async () => {} }));
after(() => bd.derrubar());

const uid = async (n) => (await q(`insert into usuarios (nome,email,senha_hash) values ($1,$2,'x') returning id`, [n, `${n}${Math.random()}@x.com`])).rows[0].id;
const est = async (t) => (await q(`insert into estacoes (titulo, area) values ($1,'clinica_medica') returning id`, [t])).rows[0].id;
const api = (metodo, url, token, corpo) => chamar(metodo, url, { token, corpo });
const sala = async (chefe, corpo) => (await api('POST', '/api/salas', chefe, corpo)).corpo.id;

async function emEstacao() {
  const [ana, bia, caio] = [await uid('Ana'), await uid('Bia'), await uid('Caio')];
  const s = await sala(ana, { nome: 'Treino' });
  await api('POST', `/api/salas/${s}/entrar`, bia); await api('POST', `/api/salas/${s}/entrar`, caio);
  await api('PATCH', `/api/salas/${s}/candidato`, ana, { usuario_id: bia });
  const ciclo = (await api('POST', `/api/salas/${s}/ciclos`, ana, { estacoes: [await est('Dor torácica'), await est('Febre')] })).corpo;
  const cid = ciclo.id ?? ciclo;
  const exe = (await api('POST', `/api/ciclos/${cid}/execucoes`, ana, {})).corpo;
  return { ana, bia, caio, s, cid, exe: exe.id ?? exe.execucao_id };
}
const estadoExe = async (s) => (await q(`select estado, pausa_seg from execucoes where sala_id=$1 order by iniciada_em desc limit 1`, [s])).rows[0];

test('sala nasce aberta com nome e prazo; aparece no painel; prazo inválido é recusado', async () => {
  const ana = await uid('Ana'); const bia = await uid('Bia');
  const a = await sala(ana, { nome: '  Treino de sábado  ', expira_vazia_horas: 48 });
  const b = await sala(ana, {});
  const lista = (await api('GET', '/api/salas', bia)).corpo;
  const sa = lista.find((x) => x.id === a); const sb = lista.find((x) => x.id === b);
  assert.equal(sa.nome, 'Treino de sábado'); assert.equal(sa.expira_vazia_horas, 48);
  assert.match(sb.nome, /^Sala \d\d\/\d\d/); assert.equal(sb.expira_vazia_horas, 24);
  assert.equal(sa.pessoas, 1); assert.equal(sa.estou_na_sala, false);
  assert.equal((await api('POST', '/api/salas', ana, { expira_vazia_horas: 0 })).status, 400);
  assert.equal((await api('POST', '/api/salas', ana, { expira_vazia_horas: 'x' })).status, 400);
});

test('ninguém é dono: nome/prazo só pelo chefe, por quem criou ou por admin do sistema', async () => {
  const ana = await uid('Ana'); const bia = await uid('Bia'); const caio = await uid('Caio');
  const s = await sala(ana, { nome: 'X' });
  await api('POST', `/api/salas/${s}/entrar`, bia);
  assert.equal((await api('PATCH', `/api/salas/${s}`, bia, { nome: 'Y' })).status, 403);
  assert.equal((await api('PATCH', `/api/salas/${s}`, ana, { nome: 'Novo', expira_vazia_horas: 6 })).status, 200);
  assert.equal((await api('PATCH', `/api/salas/${s}`, caio + ' admin', { expira_vazia_horas: 12 })).status, 200, 'admin do sistema');
  const r = (await q('select nome, expira_vazia_horas h from salas where id=$1', [s])).rows[0];
  assert.deepEqual([r.nome, r.h], ['Novo', 12]);
  assert.equal((await api('PATCH', `/api/salas/${s}`, ana, { expira_vazia_horas: 9999 })).status, 400);
});

test('sala vazia além do prazo é desfeita; com gente ou dentro do prazo, não', async () => {
  const ana = await uid('Ana'); const bia = await uid('Bia');
  const vazia24 = await sala(ana, {}); const vazia48 = await sala(ana, { expira_vazia_horas: 48 }); const cheia = await sala(ana, {});
  await api('POST', `/api/salas/${vazia24}/sair`, ana); await api('POST', `/api/salas/${vazia48}/sair`, ana);
  assert.ok((await q('select vazia_desde from salas where id=$1', [vazia24])).rows[0].vazia_desde, 'marcou desde quando está vazia');
  assert.equal((await q('select vazia_desde from salas where id=$1', [cheia])).rows[0].vazia_desde, null);
  await q(`update salas set vazia_desde = now() - interval '25 hours' where id = any($1::uuid[])`, [`{${vazia24},${vazia48}}`]);
  await q(`update salas set vazia_desde = now() - interval '300 hours' where id = $1`, [cheia]);   // não vale: tem gente
  const ids = (await api('GET', '/api/salas', bia)).corpo.map((x) => x.id);
  assert.ok(!ids.includes(vazia24), 'passou de 24 h'); assert.ok(ids.includes(vazia48), '48 h ainda não'); assert.ok(ids.includes(cheia));
  assert.equal((await api('POST', `/api/salas/${vazia24}/entrar`, bia)).status, 409, 'sala desfeita não aceita entrada');
  await q(`update salas set vazia_desde = now() - interval '49 hours' where id = $1`, [vazia48]);
  assert.ok(!(await api('GET', '/api/salas', bia)).corpo.some((x) => x.id === vazia48));
  // voltar antes do prazo reabre a contagem
  const volta = await sala(ana, {}); await api('POST', `/api/salas/${volta}/sair`, ana); await api('POST', `/api/salas/${volta}/entrar`, ana);
  assert.equal((await q('select vazia_desde from salas where id=$1', [volta])).rows[0].vazia_desde, null);
});

test('candidato sai na estação: pausa na hora; volta e, com o chefe presente, segue sozinha com o tempo parado descontado', async () => {
  const c = await emEstacao();
  await api('POST', `/api/salas/${c.s}/sair`, c.bia);
  assert.equal((await estadoExe(c.s)).estado, 'pausada');
  await q(`update execucoes set pausada_em = now() - interval '90 seconds' where sala_id=$1`, [c.s]);
  const r = (await api('POST', `/api/salas/${c.s}/entrar`, c.bia)).corpo;
  assert.ok(r.retomado, 'retomou ao voltar'); assert.equal((await estadoExe(c.s)).estado, 'em_andamento');
  assert.ok((await estadoExe(c.s)).pausa_seg >= 89, 'o relógio não contou o tempo parado');
  const est = (await api('GET', `/api/salas/${c.s}/estado`, c.bia)).corpo;
  assert.equal(est.meu_papel, 'candidato'); assert.equal(est.execucao.id, c.exe); assert.ok(est.execucao.pausa_seg >= 89);
});

test('os dois saem: só retoma quando o chefe e o candidato estiverem de volta', async () => {
  const c = await emEstacao();
  await api('POST', `/api/salas/${c.s}/sair`, c.ana); await api('POST', `/api/salas/${c.s}/sair`, c.bia);
  assert.equal((await api('POST', `/api/salas/${c.s}/entrar`, c.bia)).corpo.retomado, undefined, 'sem o chefe, continua pausada');
  assert.equal((await estadoExe(c.s)).estado, 'pausada');
  const r = (await api('POST', `/api/salas/${c.s}/entrar`, c.ana)).corpo;
  assert.ok(r.retomado); assert.equal((await estadoExe(c.s)).estado, 'em_andamento');
  assert.equal((await api('GET', `/api/salas/${c.s}/estado`, c.ana)).corpo.meu_papel, 'admin');
});

test('observador que sai e volta não mexe na estação', async () => {
  const c = await emEstacao();
  await api('POST', `/api/salas/${c.s}/sair`, c.caio); await api('POST', `/api/salas/${c.s}/entrar`, c.caio);
  assert.equal((await estadoExe(c.s)).estado, 'em_andamento');
});

test('chat: quem está na sala conversa; o candidato não envia durante a estação; fora da sala não lê nem escreve', async () => {
  const c = await emEstacao(); const fora = await uid('Fora');
  assert.equal((await api('POST', `/api/salas/${c.s}/chat`, c.caio, { texto: 'Boa sorte!' })).status, 201);
  assert.equal((await api('POST', `/api/salas/${c.s}/chat`, c.ana, { texto: '  ' })).status, 400);
  assert.equal((await api('POST', `/api/salas/${c.s}/chat`, c.bia, { texto: 'oi' })).corpo.codigo, 'CHAT_BLOQUEADO');
  assert.equal((await api('POST', `/api/salas/${c.s}/chat`, fora, { texto: 'oi' })).status, 403);
  assert.equal((await api('GET', `/api/salas/${c.s}/chat`, fora)).status, 403);
  const l = (await api('GET', `/api/salas/${c.s}/chat`, c.ana)).corpo;
  assert.equal(l.length, 1); assert.equal(l[0].nome, 'Caio'); assert.equal(l[0].texto, 'Boa sorte!');
  assert.equal((await api('GET', `/api/salas/${c.s}/chat?apos=${l[0].id}`, c.ana)).corpo.length, 0);
  await q(`select rv_execucao_finalizar($1,$2,10,'{}'::jsonb)`, [c.exe, c.ana]);
  assert.equal((await api('POST', `/api/salas/${c.s}/chat`, c.bia, { texto: 'obrigada' })).status, 201, 'depois da estação o candidato volta ao chat');
});

test('inverter papéis: o candidato também pode; terceiros não; depois a opção passa para o outro', async () => {
  const c = await emEstacao();
  await q(`select rv_execucao_finalizar($1,$2,10,'{}'::jsonb)`, [c.exe, c.ana]);
  assert.equal((await api('POST', `/api/ciclos/${c.cid}/proximo`, c.caio, { acao: 'inverter' })).status, 403, 'observador não inverte');
  assert.equal((await api('POST', `/api/ciclos/${c.cid}/proximo`, c.bia, { acao: 'avancar' })).status, 403, 'candidato só inverte, não decide o resto');
  const r = await api('POST', `/api/ciclos/${c.cid}/proximo`, c.bia, { acao: 'inverter' });
  assert.equal(r.status, 200);
  const ea = (await api('GET', `/api/salas/${c.s}/estado`, c.ana)).corpo; const eb = (await api('GET', `/api/salas/${c.s}/estado`, c.bia)).corpo;
  assert.equal(eb.meu_papel, 'admin'); assert.equal(ea.meu_papel, 'candidato'); assert.equal(eb.sala.admin_id, c.bia);
  const novo = r.corpo.ciclo_id;
  await api('POST', `/api/ciclos/${novo}/itens`, c.bia, { estacoes: [await est('Pré-natal')] });
  const ex2 = (await api('POST', `/api/ciclos/${novo}/execucoes`, c.bia, {})).corpo;
  await q(`select rv_execucao_finalizar($1,$2,8,'{}'::jsonb)`, [ex2.id ?? ex2.execucao_id, c.bia]);
  // agora quem era candidato (Ana) é quem pode inverter de volta
  assert.equal((await api('POST', `/api/ciclos/${r.corpo.ciclo_id}/proximo`, c.ana, { acao: 'inverter' })).status, 200);
});

test('pedidos de papel: terceiro pede chefia/candidatura e só o chefe decide', async () => {
  const c = await emEstacao();
  const p = (await api('POST', `/api/salas/${c.s}/solicitacoes`, c.caio, { papel: 'admin' })).corpo;
  assert.equal((await api('POST', `/api/solicitacoes/${p.solicitacao_id}/decidir`, c.bia, { aceitar: true })).status, 403, 'candidato não decide');
  assert.equal((await api('POST', `/api/solicitacoes/${p.solicitacao_id}/decidir`, c.ana, { aceitar: false })).status, 200);
});

test('assumir a chefia: só com o chefe fora e sem estação esperando por ele', async () => {
  const ana = await uid('Ana'); const bia = await uid('Bia');
  const s = await sala(ana, {}); await api('POST', `/api/salas/${s}/entrar`, bia);
  assert.equal((await api('POST', `/api/salas/${s}/assumir-chefe`, bia)).corpo.codigo, 'CHEFE_PRESENTE');
  await api('POST', `/api/salas/${s}/sair`, ana);
  assert.equal((await api('POST', `/api/salas/${s}/assumir-chefe`, bia)).status, 200);
  assert.equal((await api('GET', `/api/salas/${s}/estado`, bia)).corpo.meu_papel, 'admin');
  const c = await emEstacao();
  await api('POST', `/api/salas/${c.s}/sair`, c.ana);                       // estação pausada à espera do chefe
  assert.equal((await api('POST', `/api/salas/${c.s}/assumir-chefe`, c.caio)).corpo.codigo, 'AGUARDE_CHEFE');
});

test('salas de prática com IA não aparecem no painel de salas abertas', async () => {
  const ana = await uid('Ana'); const bia = await uid('Bia'); const e = await est('Solo');
  const s = await sala(ana, { nome: 'Solo IA' });
  await q(`insert into salas_ia (sala_id, usuario_id, estacao_id) values ($1,$2,$3)`, [s, ana, e]);
  assert.ok(!(await api('GET', '/api/salas', bia)).corpo.some((x) => x.id === s));
});
