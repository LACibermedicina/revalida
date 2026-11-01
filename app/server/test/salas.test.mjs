// Salas, ciclos, papéis dinâmicos, pausa/retomada, visibilidade da fila e concorrência. Postgres real (psql).
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { criarBanco, criarQ } from './ajuda.mjs';

const exec = promisify(execFile);
const bd = criarBanco('rv_salas');
const q = criarQ(bd.nome);
test.after(() => bd.derrubar());

const uid = async (nome) => (await q(`insert into usuarios (nome,email,senha_hash) values ($1,$2,'x') returning id`, [nome, `${nome.toLowerCase().replace(/\s/g, '')}@x.com`])).rows[0].id;
const est = async (titulo) => (await q(`insert into estacoes (titulo, area) values ($1,'clinica_medica') returning id`, [titulo])).rows[0].id;
const lista = (ids) => `{${ids.join(',')}}`;
const chama = async (sql, params) => (await q(`select ${sql} as r`, params)).rows[0].r;
/** Executa e devolve o CÓDIGO da regra violada (ou null). */
const erro = async (fn) => { try { await fn(); return null; } catch (e) { return (String(e.stderr ?? e.message).match(/ERROR:\s+([A-Z_]+)/) ?? [])[1] ?? `outro: ${String(e.stderr ?? e.message).slice(0, 200)}`; } };
/** Roda SQL em processo psql separado (concorrência real: cada um é uma conexão própria). */
const par = (sql) => exec('psql', ['-X', '-q', '-t', '-A', '-v', 'ON_ERROR_STOP=1', '-d', bd.nome, '-c', sql]).then((r) => ({ ok: true, saida: r.stdout.trim() }), (e) => ({ ok: false, codigo: (String(e.stderr).match(/ERROR:\s+([A-Z_]+)/) ?? [])[1] ?? String(e.stderr).slice(0, 200) }));

/** Cenário-base: sala com admin, um candidato presente e dois observadores, ciclo ativo com 3 estações. */
async function cenario() {
  const [ana, bia, caio, duda] = [await uid(`Ana${Math.random()}`), await uid(`Bia${Math.random()}`), await uid(`Caio${Math.random()}`), await uid(`Duda${Math.random()}`)];
  const sala = await chama('rv_sala_criar($1)', [ana]);
  for (const u of [bia, caio, duda]) await chama('rv_sala_entrar($1,$2)', [sala, u]);
  await chama('rv_candidato_definir($1,$2,$3)', [sala, ana, bia]);
  const [e1, e2, e3] = [await est('Dor torácica'), await est('Pré-natal'), await est('Febre em criança')];
  const ciclo = await chama('rv_ciclo_criar($1,$2,$3::uuid[])', [sala, ana, lista([e1, e2, e3])]);
  return { ana, bia, caio, duda, sala, ciclo, e1, e2, e3 };
}
const estado = async (sala, u) => chama('rv_sala_estado($1,$2)', [sala, u]);
const papeis = async (sala) => Object.fromEntries((await q(`select u.nome, sp.papel, sp.e_avaliador from sala_participantes sp join usuarios u on u.id=sp.usuario_id where sp.sala_id=$1 and sp.saiu_em is null`, [sala])).rows.map((r) => [r.nome.replace(/[\d.]+$/, ''), `${r.papel}${r.e_avaliador ? '+aval' : ''}`]));

test('sala: criador vira admin+avaliador; entrar vira observador; entrar de novo não duplica', async () => {
  const a = await uid('Ana1'); const b = await uid('Bia1');
  const sala = await chama('rv_sala_criar($1)', [a]);
  assert.equal((await chama('rv_sala_entrar($1,$2)', [sala, b])).papel, 'observador');
  assert.equal((await chama('rv_sala_entrar($1,$2)', [sala, b])).papel, 'observador');
  assert.deepEqual(await papeis(sala), { Ana: 'admin+aval', Bia: 'observador' });
  assert.equal((await q(`select count(*)::int n from sala_participantes where sala_id=$1`, [sala])).rows[0].n, 2);
});

test('unicidade: definir outro candidato rebaixa o anterior; admin não pode ser candidato; ausente não pode', async () => {
  const c = await cenario();
  assert.deepEqual(await papeis(c.sala), { Ana: 'admin+aval', Bia: 'candidato', Caio: 'observador', Duda: 'observador' });
  await chama('rv_candidato_definir($1,$2,$3)', [c.sala, c.ana, c.caio]);
  assert.deepEqual(await papeis(c.sala), { Ana: 'admin+aval', Bia: 'observador', Caio: 'candidato', Duda: 'observador' });
  assert.equal(await erro(() => chama('rv_candidato_definir($1,$2,$3)', [c.sala, c.ana, c.ana])), 'PARTICIPANTE_INVALIDO');
  assert.equal(await erro(() => chama('rv_candidato_definir($1,$2,$3)', [c.sala, c.bia, c.caio])), 'NAO_ADMIN');
});

test('o banco recusa dois candidatos/avaliadores/admins mesmo se a lógica falhar (índices únicos)', async () => {
  const c = await cenario();
  const falha = (sql) => erro(() => q(sql, [c.sala, c.caio]));
  assert.match(await falha(`update sala_participantes set papel='candidato' where sala_id=$1 and usuario_id=$2`) ?? 'NAO_FALHOU', /outro.*duplicate key/s);
  assert.match(await falha(`update sala_participantes set e_avaliador=true where sala_id=$1 and usuario_id=$2`) ?? 'NAO_FALHOU', /outro.*duplicate key/s);
  assert.match(await falha(`update sala_participantes set papel='admin' where sala_id=$1 and usuario_id=$2`) ?? 'NAO_FALHOU', /outro.*duplicate key/s);
});

test('uma estação por vez: iniciar com outra em curso falha; admin não cria ciclo com ciclo ativo', async () => {
  const c = await cenario();
  const ini = await chama('rv_execucao_iniciar($1,$2)', [c.ciclo, c.ana]);
  assert.ok(ini.execucao_id);
  assert.equal(await erro(() => chama('rv_execucao_iniciar($1,$2)', [c.ciclo, c.ana])), 'EXECUCAO_EM_ANDAMENTO');
  assert.equal(await erro(() => chama('rv_ciclo_criar($1,$2,$3::uuid[])', [c.sala, c.ana, lista([c.e1])])), 'CICLO_ATIVO');
  assert.equal(await erro(() => chama('rv_ciclo_proximo($1,$2,$3)', [c.ciclo, c.ana, 'avancar'])), 'EXECUCAO_EM_ANDAMENTO');
  assert.equal(await erro(() => chama('rv_execucao_iniciar($1,$2)', [c.ciclo, c.caio])), 'NAO_ADMIN');
});

test('fim de estação: contador de vezes sobe, quatro caminhos funcionam', async () => {
  const c = await cenario();
  const e1 = await chama('rv_execucao_iniciar($1,$2)', [c.ciclo, c.ana]);
  assert.equal(await erro(() => chama('rv_execucao_finalizar($1,$2,7.5)', [e1.execucao_id, c.caio])), 'NAO_PERMITIDO');
  const f1 = await chama(`rv_execucao_finalizar($1,$2,7.5,'{"itens":3}'::jsonb)`, [e1.execucao_id, c.ana]);
  assert.equal(f1.vezes_realizada, 1);
  assert.equal(await erro(() => chama('rv_execucao_finalizar($1,$2,7.5)', [e1.execucao_id, c.ana])), 'EXECUCAO_INATIVA');
  // manter: repete a mesma estação; o contador vira 2 e a melhor nota é preservada
  const m = await chama(`rv_ciclo_proximo($1,$2,'manter')`, [c.ciclo, c.ana]);
  assert.equal(m.proximo_item_id, e1.item_id);
  const e1b = await chama('rv_execucao_iniciar($1,$2,$3)', [c.ciclo, c.ana, m.proximo_item_id]);
  const f2 = await chama('rv_execucao_finalizar($1,$2,6.0)', [e1b.execucao_id, c.ana]);
  assert.equal(f2.vezes_realizada, 2);
  assert.equal((await q(`select melhor_nota::float n from usuario_estacao where usuario_id=$1 and estacao_id=$2`, [c.bia, c.e1])).rows[0].n, 7.5);
  // avançar: a próxima da fila é a 2ª estação
  const av = await chama(`rv_ciclo_proximo($1,$2,'avancar')`, [c.ciclo, c.ana]);
  assert.equal((await q(`select estacao_id from ciclo_itens where id=$1`, [av.proximo_item_id])).rows[0].estacao_id, c.e2);
  // encerrar: ciclo pausado, sem ciclo ativo, ponto de retomada guardado
  const en = await chama(`rv_ciclo_proximo($1,$2,'encerrar')`, [c.ciclo, c.ana]);
  assert.equal(en.estado, 'pausado');
  assert.equal((await q(`select ciclo_ativo_id from salas where id=$1`, [c.sala])).rows[0].ciclo_ativo_id, null);
  assert.equal((await q(`select motivo_pausa from ciclos where id=$1`, [c.ciclo])).rows[0].motivo_pausa, 'manual');
  assert.equal(await erro(() => chama(`rv_ciclo_proximo($1,$2,'xpto')`, [c.ciclo, c.ana])), 'CICLO_INATIVO');
});

test('retomar: admin ou candidato do ciclo voltam; quem não participou não volta; exige nenhum ciclo ativo', async () => {
  const c = await cenario();
  await chama(`rv_ciclo_proximo($1,$2,'encerrar')`, [c.ciclo, c.ana]);
  assert.equal(await erro(() => chama('rv_ciclo_retomar($1,$2)', [c.ciclo, c.caio])), 'NAO_PERMITIDO');
  const nova = await chama('rv_ciclo_criar($1,$2,$3::uuid[])', [c.sala, c.ana, lista([c.e1])]);
  assert.equal(await erro(() => chama('rv_ciclo_retomar($1,$2)', [c.ciclo, c.bia])), 'CICLO_ATIVO');
  await chama(`rv_ciclo_proximo($1,$2,'encerrar')`, [nova, c.ana]);
  const r = await chama('rv_ciclo_retomar($1,$2)', [c.ciclo, c.bia]);   // o candidato retoma
  assert.equal(r.ciclo_id, c.ciclo);
  assert.equal((await estado(c.sala, c.ana)).ciclo.id, c.ciclo);
});

test('visibilidade: candidato e observador só veem concluídas/pausadas/em curso/liberadas; admin vê a fila toda', async () => {
  const c = await cenario();
  const adm = await estado(c.sala, c.ana);
  assert.equal(adm.fila.length, 3);
  for (const quem of [c.bia, c.caio]) {
    const e = await estado(c.sala, quem);
    assert.deepEqual(e.fila, [], 'nada da fila futura aparece');
    const texto = JSON.stringify(e);
    for (const t of ['Pré-natal', 'Febre em criança', 'Dor torácica']) assert.ok(!texto.includes(t), `não vaza "${t}"`);
  }
  const i1 = await chama('rv_execucao_iniciar($1,$2)', [c.ciclo, c.ana]);
  let eb = await estado(c.sala, c.bia);
  assert.equal(eb.fila.length, 1); assert.equal(eb.fila[0].titulo, 'Dor torácica'); assert.equal(eb.execucao.id, i1.execucao_id);
  await chama('rv_execucao_finalizar($1,$2,8)', [i1.execucao_id, c.ana]);
  // liberar explicitamente a 3ª
  const itens = (await q(`select id from ciclo_itens where ciclo_id=$1 order by posicao`, [c.ciclo])).rows;
  await chama('rv_item_liberar($1,$2,$3,true)', [c.ciclo, itens[2].id, c.ana]);
  eb = await estado(c.sala, c.bia);
  assert.deepEqual(eb.fila.map((i) => i.titulo), ['Dor torácica', 'Febre em criança']);
  assert.ok(!JSON.stringify(eb).includes('Pré-natal'), 'a 2ª continua oculta');
  assert.equal(await erro(() => chama('rv_item_liberar($1,$2,$3,true)', [c.ciclo, itens[1].id, c.bia])), 'NAO_ADMIN');
});

test('agregar novo grupo de estações ao fim de uma estação, sem sair da sala', async () => {
  const c = await cenario();
  const i1 = await chama('rv_execucao_iniciar($1,$2)', [c.ciclo, c.ana]);
  await chama('rv_execucao_finalizar($1,$2,5)', [i1.execucao_id, c.ana]);
  const e4 = await est('Asma'); const e5 = await est('Diabetes');
  await chama(`rv_ciclo_itens_adicionar($1,$2,$3::uuid[],'Grupo B')`, [c.ciclo, c.ana, lista([e4, e5])]);
  const adm = await estado(c.sala, c.ana);
  assert.equal(adm.fila.length, 5);
  assert.deepEqual(adm.fila.slice(3).map((i) => [i.posicao, i.grupo]), [[4, 'Grupo B'], [5, 'Grupo B']]);
});

test('pedido de candidato aceito durante a estação: pausa estação e ciclo, novo ciclo, anterior volta depois', async () => {
  const c = await cenario();
  const ex = await chama('rv_execucao_iniciar($1,$2)', [c.ciclo, c.ana]);
  const ped = await chama(`rv_solicitar_papel($1,$2,'candidato')`, [c.sala, c.caio]);
  assert.equal(await erro(() => chama(`rv_solicitar_papel($1,$2,'candidato')`, [c.sala, c.caio])), 'PEDIDO_PENDENTE');
  assert.equal(await erro(() => chama(`rv_solicitar_papel($1,$2,'admin')`, [c.sala, c.bia])), 'NAO_E_OBSERVADOR');
  assert.equal((await estado(c.sala, c.ana)).solicitacoes.length, 1);
  assert.equal((await estado(c.sala, c.duda)).solicitacoes.length, 0, 'pedido dos outros não aparece para observador');
  assert.equal(await erro(() => chama('rv_solicitacao_decidir($1,$2,true)', [ped.solicitacao_id, c.bia])), 'NAO_ADMIN');

  const r = await chama(`rv_solicitacao_decidir($1,$2,true,'{"tempo_restante_s":240}'::jsonb)`, [ped.solicitacao_id, c.ana]);
  assert.equal(r.estado, 'aceita');
  assert.deepEqual(await papeis(c.sala), { Ana: 'admin+aval', Bia: 'observador', Caio: 'candidato', Duda: 'observador' });
  const velho = (await q(`select estado, motivo_pausa from ciclos where id=$1`, [c.ciclo])).rows[0];
  assert.deepEqual(velho, { estado: 'pausado', motivo_pausa: 'transferencia' });
  assert.equal((await q(`select estado from execucoes where id=$1`, [ex.execucao_id])).rows[0].estado, 'pausada');
  const pc = (await q(`select snapshot, retomavel_por from paused_cycles where ciclo_id=$1`, [c.ciclo])).rows[0];
  assert.equal(pc.snapshot.tempo_restante_s, 240);
  const novo = (await q(`select admin_id, candidato_id, origem_id, estado from ciclos where id=$1`, [r.ciclo_id])).rows[0];
  assert.deepEqual(novo, { admin_id: c.ana, candidato_id: c.caio, origem_id: c.ciclo, estado: 'ativo' });
  // o candidato anterior vê o ciclo pausado no painel e a nova fila vazia
  const eb = await estado(c.sala, c.bia);
  assert.equal(eb.ciclos_pausados.length, 1); assert.equal(eb.ciclos_pausados[0].execucao_pausada, true);
  // não dá para voltar enquanto o ciclo novo está ativo
  assert.equal(await erro(() => chama('rv_ciclo_retomar($1,$2)', [c.ciclo, c.bia])), 'CICLO_ATIVO');
  await chama(`rv_ciclo_proximo($1,$2,'encerrar')`, [r.ciclo_id, c.ana]);
  const volta = await chama('rv_ciclo_retomar($1,$2)', [c.ciclo, c.bia]);
  assert.equal(volta.execucao_id, ex.execucao_id); assert.equal(volta.snapshot.tempo_restante_s, 240);
  assert.deepEqual(await papeis(c.sala), { Ana: 'admin+aval', Bia: 'candidato', Caio: 'observador', Duda: 'observador' });
  assert.equal((await q(`select estado from execucoes where id=$1`, [ex.execucao_id])).rows[0].estado, 'em_andamento');
  // histórico de eventos marcou a transferência
  const ev = (await q(`select tipo from sala_eventos where sala_id=$1 order by id`, [c.sala])).rows.map((x) => x.tipo);
  assert.ok(ev.includes('papel_transferido') && ev.includes('ciclo_retomado'));
});

test('pedido de admin aceito: observador vira admin e avaliador; admin anterior vira observador e pode voltar ao seu ciclo', async () => {
  const c = await cenario();
  const ped = await chama(`rv_solicitar_papel($1,$2,'admin')`, [c.sala, c.duda]);
  const r = await chama('rv_solicitacao_decidir($1,$2,true)', [ped.solicitacao_id, c.ana]);
  assert.deepEqual(await papeis(c.sala), { Ana: 'observador', Bia: 'candidato', Caio: 'observador', Duda: 'admin+aval' });
  assert.equal((await q(`select admin_id from salas where id=$1`, [c.sala])).rows[0].admin_id, c.duda);
  assert.equal(await erro(() => chama(`rv_ciclo_proximo($1,$2,'encerrar')`, [r.ciclo_id, c.ana])), 'NAO_ADMIN');
  await chama(`rv_ciclo_proximo($1,$2,'encerrar')`, [r.ciclo_id, c.duda]);
  await chama('rv_ciclo_retomar($1,$2)', [c.ciclo, c.ana]);   // admin anterior volta ao ciclo em que estava
  assert.deepEqual(await papeis(c.sala), { Ana: 'admin+aval', Bia: 'candidato', Caio: 'observador', Duda: 'observador' });
});

test('recusar não muda nada; aceitar um candidato recusa os outros pedidos pelo mesmo papel', async () => {
  const c = await cenario();
  const p1 = await chama(`rv_solicitar_papel($1,$2,'candidato')`, [c.sala, c.caio]);
  const p2 = await chama(`rv_solicitar_papel($1,$2,'candidato')`, [c.sala, c.duda]);
  assert.equal((await chama('rv_solicitacao_decidir($1,$2,false)', [p1.solicitacao_id, c.ana])).estado, 'recusada');
  assert.deepEqual(await papeis(c.sala), { Ana: 'admin+aval', Bia: 'candidato', Caio: 'observador', Duda: 'observador' });
  const p3 = await chama(`rv_solicitar_papel($1,$2,'candidato')`, [c.sala, c.caio]);
  await chama('rv_solicitacao_decidir($1,$2,true)', [p2.solicitacao_id, c.ana]);
  const st = Object.fromEntries((await q(`select id, estado from solicitacoes_papel where sala_id=$1`, [c.sala])).rows.map((r) => [r.id, r.estado]));
  assert.equal(st[p2.solicitacao_id], 'aceita'); assert.equal(st[p3.solicitacao_id], 'recusada');
  assert.equal(await erro(() => chama('rv_solicitacao_decidir($1,$2,true)', [p3.solicitacao_id, c.ana])), 'SOLICITACAO_INATIVA');
});

test('inverter papéis: candidato vira admin do ciclo novo, admin vira candidato; o ciclo antigo fica retomável', async () => {
  const c = await cenario();
  const e = await chama('rv_execucao_iniciar($1,$2)', [c.ciclo, c.ana]);
  await chama('rv_execucao_finalizar($1,$2,9)', [e.execucao_id, c.ana]);
  const r = await chama(`rv_ciclo_proximo($1,$2,'inverter')`, [c.ciclo, c.ana]);
  assert.deepEqual(await papeis(c.sala), { Ana: 'candidato', Bia: 'admin+aval', Caio: 'observador', Duda: 'observador' });
  assert.equal((await q(`select admin_id from salas where id=$1`, [c.sala])).rows[0].admin_id, c.bia);
  assert.equal(await erro(() => chama('rv_execucao_iniciar($1,$2)', [r.ciclo_id, c.ana])), 'NAO_ADMIN');
  // a nova admin monta a fila e roda; a antiga admin (agora candidata) só vê o que for liberado
  const nova = await est('Abdome agudo');
  await chama('rv_ciclo_itens_adicionar($1,$2,$3::uuid[])', [r.ciclo_id, c.bia, lista([nova])]);
  assert.deepEqual((await estado(c.sala, c.ana)).fila, []);
  const velho = (await q(`select estado, motivo_pausa from ciclos where id=$1`, [c.ciclo])).rows[0];
  assert.deepEqual(velho, { estado: 'pausado', motivo_pausa: 'inversao' });
  assert.equal((await estado(c.sala, c.ana)).ciclos_pausados.length, 1);
});

test('delegar avaliador: 1 por vez, candidato não pode, não durante a estação', async () => {
  const c = await cenario();
  await chama('rv_avaliador_delegar($1,$2,$3)', [c.sala, c.ana, c.caio]);
  assert.deepEqual(await papeis(c.sala), { Ana: 'admin', Bia: 'candidato', Caio: 'observador+aval', Duda: 'observador' });
  assert.equal(await erro(() => chama('rv_avaliador_delegar($1,$2,$3)', [c.sala, c.ana, c.bia])), 'CANDIDATO_NAO_AVALIA');
  const e = await chama('rv_execucao_iniciar($1,$2)', [c.ciclo, c.ana]);
  assert.equal((await q(`select avaliador_id from execucoes where id=$1`, [e.execucao_id])).rows[0].avaliador_id, c.caio);
  assert.equal(await erro(() => chama('rv_avaliador_delegar($1,$2,$3)', [c.sala, c.ana, c.ana])), 'EXECUCAO_EM_ANDAMENTO');
  await chama('rv_execucao_finalizar($1,$2,5)', [e.execucao_id, c.caio]);   // o avaliador delegado também finaliza
});

test('pausar o vídeo de qualquer usuário: só o admin', async () => {
  const c = await cenario();
  await chama('rv_video_pausar($1,$2,$3,true)', [c.sala, c.ana, c.caio]);
  assert.equal((await estado(c.sala, c.ana)).participantes.find((p) => p.usuario_id === c.caio).video_pausado, true);
  assert.equal(await erro(() => chama('rv_video_pausar($1,$2,$3,true)', [c.sala, c.bia, c.duda])), 'NAO_ADMIN');
  await chama('rv_video_pausar($1,$2,$3,false)', [c.sala, c.ana, c.caio]);
  assert.equal((await estado(c.sala, c.ana)).participantes.find((p) => p.usuario_id === c.caio).video_pausado, false);
});

test('saída: após o tempo de graça, a falta do candidato pausa o ciclo; quem volta retoma', async () => {
  const c = await cenario();
  const e = await chama('rv_execucao_iniciar($1,$2)', [c.ciclo, c.ana]);
  await chama('rv_sala_sair($1,$2)', [c.sala, c.bia]);
  assert.equal(await chama('rv_sala_pausar_por_saida($1)', [c.sala]), true);
  assert.equal((await q(`select motivo_pausa from ciclos where id=$1`, [c.ciclo])).rows[0].motivo_pausa, 'saida');
  assert.equal(await chama('rv_sala_pausar_por_saida($1)', [c.sala]), false, 'sem ciclo ativo não faz nada');
  assert.equal(await erro(() => chama('rv_ciclo_retomar($1,$2)', [c.ciclo, c.ana])), 'PARTICIPANTE_AUSENTE');
  await chama('rv_sala_entrar($1,$2)', [c.sala, c.bia]);
  const r = await chama('rv_ciclo_retomar($1,$2)', [c.ciclo, c.ana]);
  assert.equal(r.execucao_id, e.execucao_id);
  assert.equal((await papeis(c.sala)).Bia, 'candidato');
});

test('quem voltou antes do tempo de graça não derruba o ciclo', async () => {
  const c = await cenario();
  await chama('rv_sala_sair($1,$2)', [c.sala, c.bia]);
  await chama('rv_sala_entrar($1,$2)', [c.sala, c.bia]);       // o candidato do ciclo ativo recupera a vaga
  assert.equal((await papeis(c.sala)).Bia, 'candidato');
  assert.equal(await chama('rv_sala_pausar_por_saida($1)', [c.sala]), false);
});

test('estado: quem não está na sala não lê nada', async () => {
  const c = await cenario(); const fora = await uid('Fora');
  assert.equal(await erro(() => estado(c.sala, fora)), 'NAO_ESTA_NA_SALA');
});

/* ---------------- concorrência real: conexões simultâneas ---------------- */

// Uma conexão A abre a transação, executa e SEGURA o commit por 1 s; as outras chegam no meio. Só a trava da sala
// (select ... for update) obriga B a esperar A e enxergar o resultado dela; sem trava, B decide em cima de estado velho.
const segura = (sql, ms = 1000) => par(`begin; ${sql}; select pg_sleep(${ms / 1000}); commit`);
const chega = (ms, sql) => new Promise((r) => setTimeout(r, ms)).then(() => par(sql));

test('CORRIDA: decidir o mesmo pedido enquanto o 1º ainda não confirmou → o 2º vê "já decidido"', async () => {
  const c = await cenario();
  const ped = await chama(`rv_solicitar_papel($1,$2,'candidato')`, [c.sala, c.caio]);
  const q1 = `select rv_solicitacao_decidir('${ped.solicitacao_id}','${c.ana}',true)`;
  const [a, b, d] = await Promise.all([segura(q1), chega(300, q1), chega(400, q1)]);
  assert.equal(a.ok, true, JSON.stringify(a));
  assert.deepEqual([b.codigo, d.codigo], ['SOLICITACAO_INATIVA', 'SOLICITACAO_INATIVA'], JSON.stringify([b, d]));
  assert.equal((await q(`select count(*)::int n from ciclos where sala_id=$1`, [c.sala])).rows[0].n, 2);
});

test('CORRIDA: dois pedidos pelo mesmo papel: aceitar o 1º enquanto o 2º é aceito → o 2º já foi recusado', async () => {
  const c = await cenario();
  const p1 = await chama(`rv_solicitar_papel($1,$2,'candidato')`, [c.sala, c.caio]);
  const p2 = await chama(`rv_solicitar_papel($1,$2,'candidato')`, [c.sala, c.duda]);
  const [a, b] = await Promise.all([
    segura(`select rv_solicitacao_decidir('${p1.solicitacao_id}','${c.ana}',true)`),
    chega(300, `select rv_solicitacao_decidir('${p2.solicitacao_id}','${c.ana}',true)`)]);
  assert.equal(a.ok, true);
  assert.equal(b.codigo, 'SOLICITACAO_INATIVA', JSON.stringify(b));
  assert.deepEqual(await papeis(c.sala), { Ana: 'admin+aval', Bia: 'observador', Caio: 'candidato', Duda: 'observador' });
});

test('CORRIDA: iniciar estação enquanto uma transferência ainda não confirmou → a estação não nasce no ciclo pausado', async () => {
  const c = await cenario();
  const ped = await chama(`rv_solicitar_papel($1,$2,'candidato')`, [c.sala, c.caio]);
  const [a, b] = await Promise.all([
    segura(`select rv_solicitacao_decidir('${ped.solicitacao_id}','${c.ana}',true)`),
    chega(300, `select rv_execucao_iniciar('${c.ciclo}','${c.ana}')`)]);
  assert.equal(a.ok, true);
  assert.equal(b.codigo, 'CICLO_INATIVO', JSON.stringify(b));
  assert.equal((await q(`select count(*)::int n from execucoes where ciclo_id=$1`, [c.ciclo])).rows[0].n, 0);
});

test('CORRIDA: finalizar a estação enquanto a inversão não confirmou → ninguém finaliza em ciclo já pausado', async () => {
  const c = await cenario();
  const e = await chama('rv_execucao_iniciar($1,$2)', [c.ciclo, c.ana]);
  await chama('rv_execucao_finalizar($1,$2,5)', [e.execucao_id, c.ana]);
  const e2 = await chama('rv_execucao_iniciar($1,$2)', [c.ciclo, c.ana]);
  const ped = await chama(`rv_solicitar_papel($1,$2,'admin')`, [c.sala, c.duda]);
  const [a, b] = await Promise.all([
    segura(`select rv_solicitacao_decidir('${ped.solicitacao_id}','${c.ana}',true)`),
    chega(300, `select rv_execucao_finalizar('${e2.execucao_id}','${c.ana}',9)`)]);
  assert.equal(a.ok, true);
  assert.equal(b.codigo, 'EXECUCAO_INATIVA', JSON.stringify(b));     // a execução foi pausada pela transferência
  assert.equal((await q(`select estado from execucoes where id=$1`, [e2.execucao_id])).rows[0].estado, 'pausada');
});

test('CORRIDA: dois "iniciar estação" com o 1º ainda aberto → só um', async () => {
  const c = await cenario();
  const sql = `select rv_execucao_iniciar('${c.ciclo}','${c.ana}')`;
  const [a, b, d] = await Promise.all([segura(sql), chega(300, sql), chega(400, sql)]);
  assert.equal(a.ok, true);
  assert.deepEqual([b.codigo, d.codigo], ['EXECUCAO_EM_ANDAMENTO', 'EXECUCAO_EM_ANDAMENTO']);
});

test('SIMULTÂNEO (sem segurar): rajada de operações conflitantes mantém as invariantes', async () => {
  const c = await cenario();
  const e = await chama('rv_execucao_iniciar($1,$2)', [c.ciclo, c.ana]);
  const ops = [
    `select rv_execucao_finalizar('${e.execucao_id}','${c.ana}',7)`,
    `select rv_ciclo_proximo('${c.ciclo}','${c.ana}','inverter')`,
    `select rv_execucao_iniciar('${c.ciclo}','${c.ana}')`,
    `select rv_ciclo_proximo('${c.ciclo}','${c.ana}','encerrar')`,
    `select rv_solicitar_papel('${c.sala}','${c.caio}','admin')`,
    `select rv_solicitar_papel('${c.sala}','${c.caio}','admin')`,
    `select rv_solicitar_papel('${c.sala}','${c.caio}','admin')`,
  ];
  const rs = await Promise.all(ops.map(par));
  assert.equal(rs.slice(4).filter((r) => r.ok).length, 1, 'o mesmo observador não tem 2 pedidos pendentes');
  const inv = async (sql) => (await q(sql, [c.sala])).rows[0].n;
  assert.ok(await inv(`select count(*)::int n from execucoes where sala_id=$1 and estado='em_andamento'`) <= 1);
  assert.ok(await inv(`select count(*)::int n from ciclos where sala_id=$1 and estado='ativo'`) <= 1);
  assert.equal(await inv(`select count(*)::int n from sala_participantes where sala_id=$1 and papel='admin' and saiu_em is null`), 1);
  assert.ok(await inv(`select count(*)::int n from sala_participantes where sala_id=$1 and papel='candidato' and saiu_em is null`) <= 1);
  assert.ok(await inv(`select count(*)::int n from sala_participantes where sala_id=$1 and e_avaliador and saiu_em is null`) <= 1);
  const s = (await q(`select s.admin_id, s.ciclo_ativo_id, (select usuario_id from sala_participantes where sala_id=s.id and papel='admin' and saiu_em is null) adm from salas s where s.id=$1`, [c.sala])).rows[0];
  assert.equal(s.admin_id, s.adm);
  if (s.ciclo_ativo_id) assert.equal((await q(`select estado from ciclos where id=$1`, [s.ciclo_ativo_id])).rows[0].estado, 'ativo');
});
