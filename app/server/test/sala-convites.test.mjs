// Convites a usuários online, cancelamento de estação e abandono da vaga de candidato (camada HTTP + regras no Postgres real).
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { criarApp, criarBanco, criarQ } from './ajuda.mjs';
import { registrarSalas, criarPresenca, traduzirErro } from '../src/salas.js';

const bd = criarBanco('rv_convites');
const q = criarQ(bd.nome);
const { app, chamar } = criarApp();
const eventos = [];
const tokens = [];
const agoraFalso = { on: true, configurado() { return this.on; }, appId: () => 'app123', gerarToken: async (a) => { tokens.push(a); return { token: '007x', expiraEm: 1, audioExpiraEm: null }; } };
const cfgFalso = { obter: () => '' };
const autenticar = (req, _res, prox) => { req.usuario = { id: String(req.headers.authorization).split(' ')[1] }; prox(); };
before(() => registrarSalas(app, { q, autenticar, agora: agoraFalso, cfg: cfgFalso, difundir: async (sala, ev) => { eventos.push([sala, ev]); } }));
after(() => bd.derrubar());

const uid = async (n, online = true) => (await q(`insert into usuarios (nome,email,senha_hash,visto_em) values ($1,$2,'x',${online ? 'now()' : 'null'}) returning id`, [n, `${n}${Math.random()}@x.com`])).rows[0].id;
const est = async (t) => (await q(`insert into estacoes (titulo, area) values ($1,'clinica_medica') returning id`, [t])).rows[0].id;
const api = (metodo, url, token, corpo) => chamar(metodo, url, { token, corpo });

async function montar() {
  const [ana, bia, caio] = [await uid('Ana'), await uid('Bia'), await uid('Caio')];
  const sala = (await api('POST', '/api/salas', ana)).corpo.id;
  await api('POST', `/api/salas/${sala}/entrar`, bia); await api('POST', `/api/salas/${sala}/entrar`, caio);
  assert.equal((await api('PATCH', `/api/salas/${sala}/candidato`, ana, { usuario_id: bia })).status, 200);
  const [e1, e2, e3] = [await est('Dor torácica'), await est('Pré-natal'), await est('Febre em criança')];
  const ciclo = (await api('POST', `/api/salas/${sala}/ciclos`, ana, { estacoes: [e1, e2, e3] })).corpo;
  return { ana, bia, caio, sala, ciclo: ciclo.id ?? ciclo, e1, e2, e3 };
}


async function iniciar(c) { const r = await api('POST', `/api/ciclos/${c.ciclo}/execucoes`, c.ana, {}); assert.equal(r.status, 200); return r.corpo.execucao_id; }

test('convites: só quem avalia convida, só quem está online; o convidado escolhe observador ou candidato', async () => {
  const c = await montar();
  const dani = await uid('Dani'); const off = await uid('Off', false);
  assert.equal((await api('GET', `/api/salas/${c.sala}/online`, c.bia)).status, 403, 'candidato não vê a lista');
  const on = (await api('GET', `/api/salas/${c.sala}/online`, c.ana)).corpo;
  assert.ok(on.some((u) => u.id === dani)); assert.ok(!on.some((u) => u.id === off), 'offline não aparece');
  assert.ok(!on.some((u) => u.id === c.bia), 'quem já está na sala não aparece'); assert.equal(on[0].email, undefined, 'sem e-mail');
  assert.equal((await api('POST', `/api/salas/${c.sala}/convites`, c.bia, { usuario_id: dani })).status, 403);
  assert.equal((await api('POST', `/api/salas/${c.sala}/convites`, c.ana, { usuario_id: off })).corpo.codigo, 'NAO_ONLINE');
  const cv = await api('POST', `/api/salas/${c.sala}/convites`, c.ana, { usuario_id: dani });
  assert.equal(cv.status, 201);
  assert.equal((await api('POST', `/api/salas/${c.sala}/convites`, c.ana, { usuario_id: dani })).corpo.codigo, 'CONVITE_PENDENTE');
  const meus = (await api('GET', '/api/convites', dani)).corpo;
  assert.equal(meus.length, 1); assert.equal(meus[0].vaga_candidato, false, 'já há candidato'); assert.equal(meus[0].convidante, 'Ana');
  assert.equal((await api('GET', '/api/convites', c.caio)).corpo.length, 0, 'só o convidado vê');
  assert.equal((await api('POST', `/api/convites/${cv.corpo.convite_id}/responder`, c.caio, { aceitar: true })).status, 403);
  const r1 = await api('POST', `/api/convites/${cv.corpo.convite_id}/responder`, dani, { aceitar: true, papel: 'candidato' });
  assert.equal(r1.status, 409); assert.equal(r1.corpo.codigo, 'CANDIDATO_OCUPADO');
  const r2 = await api('POST', `/api/convites/${cv.corpo.convite_id}/responder`, dani, { aceitar: true, papel: 'observador' });
  assert.equal(r2.status, 200); assert.equal(r2.corpo.papel, 'observador');
  assert.equal((await api('GET', `/api/salas/${c.sala}/estado`, dani)).corpo.meu_papel, 'observador');
  assert.equal((await api('POST', `/api/convites/${cv.corpo.convite_id}/responder`, dani, { aceitar: true })).corpo.codigo, 'CONVITE_INATIVO');
  assert.equal((await api('GET', '/api/convites', dani)).corpo.length, 0);
});

test('convites: recusar e cancelar; convidado pode ser candidato quando a vaga está livre', async () => {
  const c = await montar();
  const eva = await uid('Eva'); const fabi = await uid('Fabi');
  const a = (await api('POST', `/api/salas/${c.sala}/convites`, c.ana, { usuario_id: eva })).corpo.convite_id;
  assert.equal((await api('POST', `/api/convites/${a}/responder`, eva, { aceitar: false })).corpo.estado, 'recusada');
  const b = (await api('POST', `/api/salas/${c.sala}/convites`, c.ana, { usuario_id: fabi })).corpo.convite_id;
  assert.equal((await api('DELETE', `/api/convites/${b}`, c.caio)).status, 409, 'quem não convidou nem administra não cancela');
  assert.equal((await api('DELETE', `/api/convites/${b}`, c.ana)).status, 200);
  assert.equal((await api('POST', `/api/convites/${b}/responder`, fabi, { aceitar: true })).corpo.codigo, 'CONVITE_INATIVO');
  // a candidata sai por escolha própria: a vaga fica livre e o convidado pode assumir
  assert.equal((await api('POST', `/api/salas/${c.sala}/candidato/abandonar`, c.bia)).corpo.papel, 'observador');
  const d = (await api('POST', `/api/salas/${c.sala}/convites`, c.ana, { usuario_id: fabi })).corpo.convite_id;
  assert.equal((await api('GET', '/api/convites', fabi)).corpo[0].vaga_candidato, true);
  const r = await api('POST', `/api/convites/${d}/responder`, fabi, { aceitar: true, papel: 'candidato' });
  assert.equal(r.status, 200); assert.equal(r.corpo.papel, 'candidato');
  const est = (await api('GET', `/api/salas/${c.sala}/estado`, c.ana)).corpo;
  assert.equal(est.ciclo.candidato_id, fabi); assert.equal(est.participantes.find((p) => p.usuario_id === c.bia).papel, 'observador');
});

test('cancelar: não conta como feita, não gera nota nem feedback, apaga a fala e a estação pode ser refeita', async () => {
  const c = await montar();
  const exe = await iniciar(c);
  await q(`insert into transcricoes (execucao_id, ordem, texto) values ($1,1,'oi, bom dia')`, [exe]);
  assert.equal((await api('POST', `/api/execucoes/${exe}/cancelar`, c.caio)).status, 403, 'observador não cancela');
  const r = await api('POST', `/api/execucoes/${exe}/cancelar`, c.ana, {});
  assert.equal(r.status, 200); assert.equal(r.corpo.motivo, 'administrador');
  const x = (await q('select estado, nota, cancelada_motivo from execucoes where id=$1', [exe])).rows[0];
  assert.deepEqual([x.estado, x.nota, x.cancelada_motivo], ['abandonada', null, 'administrador']);
  assert.equal((await q('select count(*)::int n from usuario_estacao where usuario_id=$1', [c.bia])).rows[0].n, 0, 'não conta nas feitas');
  assert.equal((await q('select count(*)::int n from transcricoes where execucao_id=$1', [exe])).rows[0].n, 0);
  assert.equal((await api('POST', `/api/execucoes/${exe}/cancelar`, c.ana, {})).corpo.codigo, 'EXECUCAO_INATIVA');
  // sem feedback: análise e autocorreção não existem
  const est = (await api('GET', `/api/salas/${c.sala}/estado`, c.ana)).corpo;
  assert.equal(est.execucao, null);
  assert.equal(est.fila[0].estado, 'pendente', 'a mesma estação volta como pendente');
  assert.equal(est.ciclo.candidato_id, c.bia, 'cancelado pelo admin sem liberar: a candidata continua');
  const de_novo = await api('POST', `/api/ciclos/${c.ciclo}/execucoes`, c.ana, { item_id: est.fila[0].id });
  assert.equal(de_novo.status, 200, 'pode refazer a mesma estação');
});

test('abandonar: o candidato desiste no meio, vira observador, a estação é cancelada e a vaga fica livre; admin cancela liberando o candidato', async () => {
  const c = await montar();
  const exe = await iniciar(c);
  assert.equal((await api('POST', `/api/salas/${c.sala}/candidato/abandonar`, c.caio)).corpo.codigo, 'NAO_E_CANDIDATO');
  const r = await api('POST', `/api/salas/${c.sala}/candidato/abandonar`, c.bia);
  assert.equal(r.status, 200); assert.equal(r.corpo.papel, 'observador');
  const x = (await q('select estado, cancelada_motivo from execucoes where id=$1', [exe])).rows[0];
  assert.deepEqual([x.estado, x.cancelada_motivo], ['abandonada', 'candidato']);
  assert.equal((await api('GET', `/api/salas/${c.sala}/estado`, c.bia)).corpo.meu_papel, 'observador');
  assert.equal((await api('POST', `/api/ciclos/${c.ciclo}/execucoes`, c.ana, {})).corpo.codigo, 'SEM_CANDIDATO');
  // o admin escolhe outro candidato e a estação recomeça
  assert.equal((await api('PATCH', `/api/salas/${c.sala}/candidato`, c.ana, { usuario_id: c.caio })).status, 200);
  const exe2 = await iniciar(c);
  const r2 = await api('POST', `/api/execucoes/${exe2}/cancelar`, c.ana, { liberar_candidato: true });
  assert.equal(r2.status, 200);
  assert.equal((await api('GET', `/api/salas/${c.sala}/estado`, c.ana)).corpo.participantes.find((p) => p.usuario_id === c.caio).papel, 'observador');
  assert.equal((await q(`select count(*)::int n from execucoes where estado='finalizada' and sala_id=$1`, [c.sala])).rows[0].n, 0);
});
