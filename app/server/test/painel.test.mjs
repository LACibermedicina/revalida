// Painel inicial (candidato e avaliador): uma chamada, só dados do próprio usuário. Postgres real.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { criarApp, criarBanco, criarQ } from './ajuda.mjs';
import { registrarPainel } from '../src/painel.js';

const bd = criarBanco('rv_painel'); const q = criarQ(bd.nome);
const { app, chamar } = criarApp();
const autenticar = (req, _res, prox) => { req.usuario = { id: String(req.headers.authorization).split(' ')[1] }; prox(); };
before(() => registrarPainel(app, { q, autenticar }));
after(() => bd.derrubar());
const uid = async (n) => (await q(`insert into usuarios (nome,email,senha_hash) values ($1,$2,'x') returning id`, [n, `${n}${Math.random()}@x.com`])).rows[0].id;

test('painel vazio: tudo zerado, sem erro', async () => {
  const u = await uid('Novo');
  const r = (await chamar('GET', '/api/painel', { token: u })).corpo;
  assert.deepEqual([r.desempenho.estacoes, r.desempenho.nota_media, r.feitas.length, r.salas.length, r.avaliador.feitas], [0, 0, 0, 0, 0]);
  assert.deepEqual([r.revisao.vencidos, r.estacoes.disponiveis], [0, 0]);
});

test('painel: desempenho vem das execuções finalizadas (como candidato), o avaliador vê o que falta liberar e o que está ao vivo', async () => {
  const [ana, bia] = [await uid('Ana'), await uid('Bia')];
  const est = (await q(`insert into estacoes (titulo, area, status) values ('Asma','clinica_medica','aprovada') returning id`)).rows[0].id;
  await q(`insert into pep_itens (estacao_id, descricao, pontos_total) values ($1,'a',2),($1,'b',3)`, [est]);
  const sala = (await q(`insert into salas (dono_id, admin_id) values ($1,$1) returning id`, [ana])).rows[0].id;
  await q(`insert into sala_participantes (sala_id, usuario_id, papel, e_avaliador) values ($1,$2,'admin',true),($1,$3,'candidato',false)`, [sala, ana, bia]);
  const ciclo = (await q(`insert into ciclos (sala_id, admin_id, candidato_id, estado) values ($1,$2,$3,'ativo') returning id`, [sala, ana, bia])).rows[0].id;
  await q(`update salas set ciclo_ativo_id=$2 where id=$1`, [sala, ciclo]);
  const item = (await q(`insert into ciclo_itens (ciclo_id, estacao_id, posicao) values ($1,$2,1) returning id`, [ciclo, est])).rows[0].id;
  const ex = (await q(`insert into execucoes (sala_id, ciclo_id, item_id, estado, avaliador_id, candidato_id, nota, finalizada_em) values ($1,$2,$3,'em_andamento',$4,$5,null,null) returning id`, [sala, ciclo, item, ana, bia])).rows[0].id;
  await q(`insert into transcricoes (execucao_id, ordem, texto) values ($1,1,'oi')`, [ex]);   // o banco só aceita fala enquanto a estação anda
  const ao = (await chamar('GET', '/api/painel', { token: ana })).corpo.avaliador;
  assert.deepEqual([ao.ao_vivo.length, ao.ao_vivo[0].titulo, ao.ao_vivo[0].sala_id], [1, 'Asma', sala], 'avaliador vê a estação em andamento para acompanhar a fala');
  await q(`update execucoes set estado='finalizada', nota=4, finalizada_em=now() where id=$1`, [ex]);
  const c = (await chamar('GET', '/api/painel', { token: bia })).corpo;
  assert.deepEqual([c.desempenho.estacoes, c.desempenho.nota_media], [1, 8], '4 de 5 pontos = 8,0');
  assert.deepEqual(c.tendencia.map((t) => t.percentual), [80]);
  assert.equal(c.feitas[0].titulo, 'Asma'); assert.equal(c.salas[0].papel, 'candidato'); assert.equal(c.avaliador.feitas, 0, 'quem só foi candidato não aparece como avaliador');
  const a = (await chamar('GET', '/api/painel', { token: ana })).corpo;
  assert.equal(a.salas[0].papel, 'admin'); assert.equal(a.avaliador.feitas, 1); assert.equal(a.avaliador.candidatos, 1);
  assert.equal(a.desempenho.estacoes, 0, 'a nota do candidato não vira desempenho do avaliador');
  assert.equal(a.avaliador.recentes[0].candidato, 'Bia');
  assert.deepEqual([a.avaliador.sem_liberar, a.avaliador.recentes[0].tem_fala, a.avaliador.recentes[0].liberada], [1, true, false]);
  await q('update execucoes set transcricao_liberada = true where id=$1', [ex]);
  assert.equal((await chamar('GET', '/api/painel', { token: ana })).corpo.avaliador.sem_liberar, 0);
});
