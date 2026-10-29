// Camada HTTP das salas (rotas, tradução de erros, token de vídeo com pausa, presença com tempo de graça).
// Postgres real; express/jwt falsos. A regra de negócio em si é testada em salas.test.mjs.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { criarApp, criarBanco, criarQ } from './ajuda.mjs';
import { registrarSalas, criarPresenca, traduzirErro } from '../src/salas.js';

const bd = criarBanco('rv_salashttp');
const q = criarQ(bd.nome);
const { app, chamar } = criarApp();
const eventos = [];
const tokens = [];
const agoraFalso = { on: true, configurado() { return this.on; }, appId: () => 'app123', gerarToken: async (a) => { tokens.push(a); return { token: '007x', expiraEm: 1, audioExpiraEm: null }; } };
const cfgFalso = { obter: () => '' };
const autenticar = (req, _res, prox) => { req.usuario = { id: String(req.headers.authorization).split(' ')[1] }; prox(); };
before(() => registrarSalas(app, { q, autenticar, agora: agoraFalso, cfg: cfgFalso, difundir: async (sala, ev) => { eventos.push([sala, ev]); } }));
after(() => bd.derrubar());

const uid = async (n) => (await q(`insert into usuarios (nome,email,senha_hash) values ($1,$2,'x') returning id`, [n, `${n}${Math.random()}@x.com`])).rows[0].id;
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

test('HTTP: fluxo básico, erros traduzidos e eventos difundidos', async () => {
  const c = await montar();
  const ini = await api('POST', `/api/ciclos/${c.ciclo}/execucoes`, c.ana, {});
  assert.equal(ini.status, 200);
  const dois = await api('POST', `/api/ciclos/${c.ciclo}/execucoes`, c.ana, {});
  assert.equal(dois.status, 409); assert.equal(dois.corpo.codigo, 'EXECUCAO_EM_ANDAMENTO');
  assert.equal((await api('POST', `/api/ciclos/${c.ciclo}/execucoes`, c.bia, {})).status, 403, 'só o admin');
  assert.equal((await api('POST', `/api/ciclos/nao-e-id/execucoes`, c.ana, {})).status, 400);
  assert.equal((await api('POST', `/api/salas/${c.sala}/ciclos`, c.ana, { estacoes: [] })).status, 400, 'lista vazia');
  assert.ok(eventos.some(([s, e]) => s === c.sala && e === 'estacao_iniciada'), 'difundiu a mudança');
  assert.equal((await api('GET', `/api/salas/${c.sala}/estado`, (await uid('Fora')))).status, 403, 'quem não está na sala não vê o estado');
});

test('HTTP: o candidato e os observadores nunca recebem a fila futura; o admin recebe tudo', async () => {
  const c = await montar();
  const ver = async (u) => (await api('GET', `/api/salas/${c.sala}/estado`, u)).corpo;
  assert.equal((await ver(c.ana)).fila.length, 3);
  for (const u of [c.bia, c.caio]) {
    const s = await ver(u);
    assert.equal(s.fila.length, 0, 'nenhuma estação futura vaza');
    assert.ok(!JSON.stringify(s).includes('Pré-natal') && !JSON.stringify(s).includes('Febre'), 'nem o título');
  }
  const item = (await ver(c.ana)).fila[1].id;
  await api('PATCH', `/api/ciclos/${c.ciclo}/itens/${item}/liberar`, c.ana, { liberada: true });
  assert.deepEqual((await ver(c.bia)).fila.map((i) => i.titulo), ['Pré-natal'], 'só a que o admin liberou');
  assert.equal((await api('PATCH', `/api/ciclos/${c.ciclo}/itens/${item}/liberar`, c.ana, { liberada: 'sim' })).status, 400);
});

test('HTTP: token de vídeo — pausa do admin tira o privilégio de vídeo; observador sem áudio por padrão', async () => {
  const c = await montar();
  tokens.length = 0;
  const t = async (u) => (await api('GET', `/api/salas/${c.sala}/agora-token`, u)).corpo;
  const obs = await t(c.caio);
  assert.equal(obs.pode.audio, false); assert.equal(tokens.at(-1).audio, 'nenhum');
  assert.equal(tokens.at(-1).video, 'curto', 'token curto: a pausa vale em poucos minutos');
  assert.equal((await t(c.bia)).pode.audio, true); assert.equal(tokens.at(-1).audio, 'sempre');
  await api('PATCH', `/api/salas/${c.sala}/audio-observadores`, c.ana, { liberado: true });
  assert.equal((await t(c.caio)).pode.audio, true); assert.equal(tokens.at(-1).audio, 'curto');
  // admin pausa o vídeo do Caio
  assert.equal((await api('PATCH', `/api/salas/${c.sala}/participantes/${c.caio}/video`, c.bia, { pausado: true })).status, 403, 'só o admin pausa');
  assert.equal((await api('PATCH', `/api/salas/${c.sala}/participantes/${c.caio}/video`, c.ana, { pausado: true })).status, 200);
  const pausado = await t(c.caio);
  assert.equal(pausado.videoPausado, true); assert.equal(pausado.pode.video, false); assert.equal(tokens.at(-1).video, 'nenhum');
  await api('PATCH', `/api/salas/${c.sala}/participantes/${c.caio}/video`, c.ana, { pausado: false });
  assert.equal((await t(c.caio)).pode.video, true);
  agoraFalso.on = false; assert.equal((await t(c.bia)).modo, 'demo'); agoraFalso.on = true;
  assert.equal((await api('PATCH', `/api/salas/${c.sala}/audio-observadores`, c.bia, { liberado: false })).status, 403);
});

test('HTTP: pedido de papel pelo observador e decisão do admin pausam o ciclo e geram novo', async () => {
  const c = await montar();
  await api('POST', `/api/ciclos/${c.ciclo}/execucoes`, c.ana, {});
  const ped = await api('POST', `/api/salas/${c.sala}/solicitacoes`, c.caio, { papel: 'candidato' });
  assert.equal(ped.status, 200);
  assert.equal((await api('POST', `/api/salas/${c.sala}/solicitacoes`, c.caio, { papel: 'candidato' })).corpo.codigo, 'PEDIDO_PENDENTE');
  const pend = (await api('GET', `/api/salas/${c.sala}/estado`, c.ana)).corpo.solicitacoes;
  assert.equal(pend.length, 1);
  assert.equal((await api('GET', `/api/salas/${c.sala}/estado`, c.bia)).corpo.solicitacoes.length, 0, 'candidato não vê pedidos alheios');
  assert.equal((await api('POST', `/api/solicitacoes/${pend[0].id}/decidir`, c.bia, { aceitar: true })).status, 403);
  assert.equal((await api('POST', `/api/solicitacoes/${pend[0].id}/decidir`, c.ana, { aceitar: true })).status, 200);
  const s = (await api('GET', `/api/salas/${c.sala}/estado`, c.ana)).corpo;
  assert.equal(s.ciclo.candidato_id, c.caio, 'novo ciclo com o novo candidato');
  assert.equal(s.execucao, null, 'a estação em curso foi pausada');
  assert.equal(s.ciclos_pausados.length, 1);
});

test('traduzirErro: só erros de regra viram resposta; o resto sobe', () => {
  assert.equal(traduzirErro({ code: 'RV001', message: 'NAO_ADMIN' }).status, 403);
  assert.equal(traduzirErro({ code: '23505' }).codigo, 'CONFLITO');
  assert.equal(traduzirErro(new Error('boom')), null);
});

test('presença: sair libera a vaga na hora; passado o tempo de graça o ciclo pausa; o retorno a tempo é testado abaixo', async () => {
  const c = await montar();
  const avisos = []; const timers = [];
  const pres = criarPresenca({ q, difundir: async (s, e) => { avisos.push(e); }, gracaMs: 60_000, setT: (fn) => { timers.push(fn); return { unref() {} }; }, clearT: (t) => { t.cancelado = true; } });
  await q(`select rv_sala_entrar($1,$2)`, [c.sala, c.bia]);
  await pres.sair(c.sala, c.bia);
  assert.equal(pres.pendentes(), 1);
  assert.equal((await q(`select count(*)::int n from sala_participantes where sala_id=$1 and usuario_id=$2 and saiu_em is null`, [c.sala, c.bia])).rows[0].n, 0, 'vaga liberada');
  assert.equal((await q(`select estado from ciclos where id=$1`, [c.ciclo])).rows[0].estado, 'ativo', 'ainda no prazo de graça');
  await timers.at(-1)();                       // o prazo acabou e o candidato não voltou
  assert.equal((await q(`select estado, motivo_pausa from ciclos where id=$1`, [c.ciclo])).rows[0].estado, 'pausado');
  assert.ok(avisos.includes('ciclo_pausado'));
});

test('presença: o candidato volta dentro do prazo → o temporizador atrasado não pausa nada', async () => {
  const c = await montar();
  const timers = [];
  const pres = criarPresenca({ q, difundir: async () => {}, setT: (fn) => { timers.push(fn); return { unref() {} }; }, clearT() {} });
  await pres.sair(c.sala, c.bia);
  await q(`select rv_sala_entrar($1,$2)`, [c.sala, c.bia]);
  const papel = (await q(`select papel from sala_participantes where sala_id=$1 and usuario_id=$2 and saiu_em is null`, [c.sala, c.bia])).rows[0]?.papel;
  assert.ok(papel, 'voltou à sala');
  await timers.at(-1)();
  assert.equal((await q(`select estado from ciclos where id=$1`, [c.ciclo])).rows[0].estado, 'ativo', 'ciclo segue ativo');
});

test('HTTP: checklist só para quem avalia; nota calculada no servidor; estatísticas para todos da sala', async () => {
  const c = await montar();
  const pep = [['Anamnese', 'Caracteriza a dor', 1, null, false], ['Exame', 'Solicita ECG', 2, 1, true], ['Conduta', 'Prescreve AAS', 1.5, null, false]];
  for (const [i, [secao, d, t, parc, crit]] of pep.entries()) await q(`insert into pep_itens (estacao_id, secao, ordem, descricao, pontos_total, pontos_parcial, critico) values ($1,$2,$3,$4,$5,$6,$7)`, [c.e1, secao, i, d, t, parc, crit]);
  const ini = await api('POST', `/api/ciclos/${c.ciclo}/execucoes`, c.ana, { item_id: (await api('GET', `/api/salas/${c.sala}/estado`, c.ana)).corpo.fila[0].id });
  const exec = (await api('GET', `/api/salas/${c.sala}/estado`, c.ana)).corpo.execucao.id;
  assert.equal(ini.status, 200);
  assert.equal((await api('GET', `/api/execucoes/${exec}/pep`, c.bia)).status, 403, 'o candidato nunca recebe o gabarito');
  assert.equal((await api('GET', `/api/execucoes/${exec}/pep`, c.caio)).status, 403, 'nem o observador');
  const p = await api('GET', `/api/execucoes/${exec}/pep`, c.ana);
  assert.equal(p.status, 200); assert.equal(p.corpo.itens.length, 3);
  const [a, e, d] = p.corpo.itens.map((x) => x.id);
  // marca inválida, item de outra estação e nota forjada
  assert.equal((await api('POST', `/api/execucoes/${exec}/finalizar`, c.ana, { marcas: { [a]: 'talvez' } })).status, 400);
  assert.equal((await api('POST', `/api/execucoes/${exec}/finalizar`, c.ana, { marcas: { '00000000-0000-4000-8000-000000000000': 'sim' } })).status, 400);
  assert.equal((await api('POST', `/api/execucoes/${exec}/finalizar`, c.bia, { marcas: {} })).status, 403, 'candidato não finaliza');
  const f = await api('POST', `/api/execucoes/${exec}/finalizar`, c.ana, { marcas: { [a]: 'sim', [e]: 'parcial' }, nota: 999 });
  assert.equal(f.status, 200);
  assert.equal(f.corpo.nota, 2, '1 (sim) + 1 (parcial) + 0 (sem marca): a nota 999 enviada é ignorada');
  assert.equal(f.corpo.max, 4.5); assert.equal(f.corpo.criticos_falhos, 1, 'o item crítico só foi parcial');
  // estatísticas: quem está na sala vê; quem não está, não
  const st = await api('GET', `/api/salas/${c.sala}/ultima-execucao`, c.caio);
  assert.equal(st.status, 200);
  const u = st.corpo.ultima;
  assert.deepEqual([u.nota, u.max, u.percentual, u.vezes_realizada, u.criticos_falhos], [2, 4.5, 44, 1, 1]);
  assert.equal(u.itens.length, 3); assert.equal(u.itens.find((x) => x.id === d).resultado, 'nao', 'sem marca = não realizado');
  assert.equal(u.candidato, (await q(`select nome from usuarios where id=$1`, [c.bia])).rows[0].nome);
  assert.equal((await api('GET', `/api/salas/${c.sala}/ultima-execucao`, await uid('Fora'))).status, 403);
  assert.equal((await api('GET', `/api/execucoes/${exec}/pep`, c.ana)).corpo.estado, 'finalizada');
  assert.ok(eventos.some(([, ev]) => ev === 'estacao_finalizada'));
});

test('HTTP: sair da sala libera a vaga; quem não está na sala recebe 403', async () => {
  const c = await montar();
  assert.equal((await api('POST', `/api/salas/${c.sala}/sair`, c.caio)).status, 200);
  assert.equal((await api('GET', `/api/salas/${c.sala}/estado`, c.caio)).status, 403, 'saiu');
  assert.equal((await api('POST', `/api/salas/${c.sala}/entrar`, c.caio)).status, 200, 'pode voltar');
  assert.equal((await api('POST', `/api/salas/${c.sala}/sair`, await uid('Fora'))).status, 200, 'sair sem estar é inofensivo');
});

test('HTTP: estação que já está na fila avisa e só repete com confirmação; título só para o admin; fora da fila entra direto', async () => {
  const c = await montar(); const nova = await est('Asma no adulto');
  const dup = await api('POST', `/api/ciclos/${c.ciclo}/itens`, c.ana, { estacoes: [c.e2, nova] });
  assert.equal(dup.status, 409); assert.equal(dup.corpo.codigo, 'ESTACAO_NA_FILA');
  assert.deepEqual(dup.corpo.repetidas.map((r) => [r.id, r.titulo, r.situacao]), [[c.e2, 'Pré-natal', 'na_fila']]);
  assert.match(dup.corpo.erro, /"Pré-natal" já está na fila/);
  assert.equal((await q('select count(*)::int n from ciclo_itens where ciclo_id=$1', [c.ciclo])).rows[0].n, 3, 'nada entrou (nem a nova): a pessoa decide antes');
  // quem não é admin não descobre o título da fila (a regra do banco responde sem detalhes)
  const naoAdmin = await api('POST', `/api/ciclos/${c.ciclo}/itens`, c.bia, { estacoes: [c.e2] });
  assert.equal(naoAdmin.status, 403); assert.equal(naoAdmin.corpo.repetidas, undefined);
  // confirmada: duplica a prática
  const ok = await api('POST', `/api/ciclos/${c.ciclo}/itens`, c.ana, { estacoes: [c.e2], repetir: true });
  assert.equal(ok.status, 200);
  assert.equal((await q('select count(*)::int n from ciclo_itens where ciclo_id=$1 and estacao_id=$2', [c.ciclo, c.e2])).rows[0].n, 2);
  // estação fora da fila entra sem perguntar
  assert.equal((await api('POST', `/api/ciclos/${c.ciclo}/itens`, c.ana, { estacoes: [nova] })).status, 200);
  // a regra também vale no banco (corrida entre dois pedidos): sem a confirmação a função recusa
  await assert.rejects(() => q(`select rv_ciclo_itens_adicionar($1,$2,$3::uuid[],null,false)`, [c.ciclo, c.ana, `{${nova}}`]), /ESTACAO_NA_FILA/);
  // repetida já realizada também é avisada com a situação
  await api('POST', `/api/ciclos/${c.ciclo}/execucoes`, c.ana, {});
  const feita = await api('POST', `/api/ciclos/${c.ciclo}/itens`, c.ana, { estacoes: [c.e1] });
  assert.equal(feita.corpo.repetidas[0].situacao, 'em_andamento');
});
