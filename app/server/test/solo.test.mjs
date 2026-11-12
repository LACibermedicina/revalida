// Prática solo com IA: sorteio por necessidade, padrões (medio, 15 itens), estação criada e modalidade "solo" no desempenho.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { criarApp, criarBanco, criarQ } from './ajuda.mjs';
import { registrarSolo, escolherTema, necessidade, sortearPonderado } from '../src/solo.js';
import { registrarDesempenho } from '../src/desempenho.js';
import { validarEstacao } from '../src/estacao-esquema.js';
import { ErroIA } from '../src/ia.js';
import { garantirTema } from '../src/temas.js';

const bd = criarBanco('rv_solo');
const q = criarQ(bd.nome);
const { app, chamar } = criarApp();
let rnd = 0;                                // aleatório controlado pelo teste
const iaFalsa = {
  on: true, falha: null, chamadas: [], itensFixos: null,
  configurado() { return this.on; },
  async gerarEstacao(p) {
    this.chamadas.push(p); if (this.falha) throw this.falha;
    const n = this.itensFixos ?? Number(/exatamente (\d+) itens/.exec(p.instrucoes)?.[1] ?? 6);
    const pep = Array.from({ length: n }, (_, i) => ({ secao: ['Anamnese', 'Exame', 'Conduta'][i % 3], descricao: `Item observável ${i + 1} sobre ${p.subtema}`, pontos_total: 0.5 }));
    const e = validarEstacao({ titulo: `Solo: ${p.subtema || 'livre'}`, area: p.area, duracao_min: 10, instrucoes_candidato: 'Atenda o paciente e explique a conduta.', cenario: 'Unidade de saúde.',
      script_ator: `Paciente colaborativo; responde só ao perguntado. Tema ${p.subtema}.`, pep, materiais: [], conceitos: [p.subtema || 'x'] }, { completa: true });
    assert.ok(e.ok, JSON.stringify(e.erros));
    return { estacao: e.estacao, avisos: [], sorteio: { semente: 1, dificuldade: p.dificuldade } };
  },
};
const autenticar = async (req, _res, prox) => { const id = String(req.headers.authorization).split(' ')[1]; req.usuario = { id, nome: 'x', papel_app: 'usuario' }; prox(); };
before(() => { registrarSolo(app, { q, autenticar, ia: iaFalsa, aleatorio: () => rnd }); registrarDesempenho(app, { q, autenticar }); });
after(() => bd.derrubar());

const uid = async (n) => (await q(`insert into usuarios (nome,email,senha_hash,visto_em) values ($1,$2,'x',now()) returning id`, [n, `${n}${Math.random()}@x.com`])).rows[0].id;
const tema = (nome, area) => garantirTema(q, nome, { area });

test('necessidade: sem histórico > desempenho bom; cartões vencidos e lacunas somam', () => {
  assert.ok(necessidade({ desempenho: 0.2 }) > necessidade({ desempenho: 0.9 }));
  assert.ok(necessidade({ desempenho: null }) > necessidade({ desempenho: 0.9 }));
  assert.ok(necessidade({ desempenho: 0.5, cartoes_vencidos: 4, lacunas: 2 }) > necessidade({ desempenho: 0.5 }));
});

test('escolherTema: sorteio ponderado entre os piores; evita recentes; vazio = null', () => {
  const temas = [
    { nome: 'Fraco', area: 'pediatria', desempenho: 0.1 }, { nome: 'Medio', area: 'pediatria', desempenho: 0.6 }, { nome: 'Forte', area: 'cirurgia', desempenho: 0.95 },
    { nome: 'Outro', area: 'mfc', desempenho: 0.4 },
  ];
  assert.equal(escolherTema(temas, { aleatorio: () => 0 }).nome, 'Fraco', 'aleatório 0 cai na maior necessidade');
  assert.equal(escolherTema(temas, { aleatorio: () => 0, recentes: ['fraco'] }).nome !== 'Fraco', true, 'tema recente é evitado');
  assert.equal(escolherTema([{ nome: 'Só', area: 'pediatria', desempenho: 0.5 }], { aleatorio: () => 0.5, recentes: ['Só'] }).nome, 'Só', 'sem alternativa, repete');
  assert.equal(escolherTema([], {}), null);
  assert.equal(sortearPonderado([1, 2, 3], () => 1, () => 0.99), 3);
});

test('sugestão usa o desempenho do usuário e explica o motivo', async () => {
  const u = await uid('Ana');
  await tema('Asma na infância', 'pediatria'); await tema('Apendicite aguda', 'cirurgia');
  rnd = 0;
  const r = await chamar('GET', '/api/solo/sugestao', { token: u });
  assert.equal(r.status, 200);
  assert.ok(r.corpo.sugestao.tema && r.corpo.sugestao.area && /Sugerido porque/.test(r.corpo.sugestao.motivo));
  assert.deepEqual([r.corpo.padroes.dificuldade, r.corpo.padroes.itens], ['medio', 15]);
});

test('iniciar sem escolhas: dificuldade média, tempo da estação e 15 itens; grava a prática e a estação', async () => {
  const u = await uid('Bia'); rnd = 0;
  const r = await chamar('POST', '/api/solo/iniciar', { token: u, corpo: {} });
  assert.equal(r.status, 201, JSON.stringify(r.corpo));
  assert.deepEqual([r.corpo.dificuldade, r.corpo.tempo_min, r.corpo.itens, r.corpo.itens_pedidos], ['medio', 10, 15, 15]);
  assert.equal(iaFalsa.chamadas.at(-1).dificuldade, 'intermediária');
  const e = (await q('select status, origem, criado_por, duracao_min from estacoes where id=$1', [r.corpo.estacao_id])).rows[0];
  assert.deepEqual([e.status, e.origem, e.criado_por], ['rascunho', 'ia', u]);
  assert.equal((await q('select count(*)::int n from pep_itens where estacao_id=$1', [r.corpo.estacao_id])).rows[0].n, 15);
  assert.equal((await q('select count(*)::int n from praticas_solo where usuario_id=$1', [u])).rows[0].n, 1);
  assert.equal((await chamar('GET', '/api/solo/historico', { token: u })).corpo.itens.length, 1);
});

test('iniciar com dificuldade, tempo e tema confirmado; valida entradas', async () => {
  const u = await uid('Caio');
  const r = await chamar('POST', '/api/solo/iniciar', { token: u, corpo: { dificuldade: 'dificil', tempo: 15, itens: 12, tema: 'Pré-eclâmpsia', area: 'ginecologia_obstetricia' } });
  assert.equal(r.status, 201, JSON.stringify(r.corpo));
  assert.deepEqual([r.corpo.dificuldade, r.corpo.tempo_min, r.corpo.itens, r.corpo.tema], ['dificil', 15, 12, 'Pré-eclâmpsia']);
  assert.equal(iaFalsa.chamadas.at(-1).dificuldade, 'avançada'); assert.equal(iaFalsa.chamadas.at(-1).subtema, 'Pré-eclâmpsia');
  assert.equal((await q('select duracao_min from estacoes where id=$1', [r.corpo.estacao_id])).rows[0].duracao_min, 15);
  assert.equal((await chamar('POST', '/api/solo/iniciar', { token: u, corpo: { dificuldade: 'absurda' } })).status, 400);
  assert.equal((await chamar('POST', '/api/solo/iniciar', { token: u, corpo: { tempo: 'abc' } })).status, 400);
  assert.equal((await chamar('POST', '/api/solo/iniciar', { token: u, corpo: { itens: 'x' } })).status, 400);
});

test('IA fora do ar, com erro e itens diferentes do pedido', async () => {
  const u = await uid('Davi');
  iaFalsa.on = false; assert.equal((await chamar('POST', '/api/solo/iniciar', { token: u, corpo: {} })).corpo.codigo, 'IA_NAO_CONFIGURADA'); iaFalsa.on = true;
  iaFalsa.falha = new ErroIA('IA_LIMITE', 'limite'); const f = await chamar('POST', '/api/solo/iniciar', { token: u, corpo: {} });
  assert.equal(f.status, 429); iaFalsa.falha = null;
  assert.equal((await q('select count(*)::int n from praticas_solo where usuario_id=$1', [u])).rows[0].n, 0, 'falha não grava prática');
  iaFalsa.itensFixos = 7; const r = await chamar('POST', '/api/solo/iniciar', { token: u, corpo: { tema: 'Sepse', area: 'clinica_medica' } }); iaFalsa.itensFixos = null;
  assert.equal(r.status, 201); assert.equal(r.corpo.itens, 7); assert.ok(r.corpo.avisos.some((a) => /7 itens/.test(a)));
});

test('execução finalizada de uma estação solo conta na modalidade "solo" do desempenho', async () => {
  const u = await uid('Eva');
  const r = await chamar('POST', '/api/solo/iniciar', { token: u, corpo: { tema: 'Dengue', area: 'clinica_medica' } });
  const est = r.corpo.estacao_id;
  const sala = (await q(`insert into salas (dono_id, admin_id) values ($1,$1) returning id`, [u])).rows[0].id;
  const ciclo = (await q(`insert into ciclos (sala_id, admin_id, candidato_id, estado) values ($1,$2,$2,'encerrado') returning id`, [sala, u])).rows[0].id;
  const item = (await q(`insert into ciclo_itens (ciclo_id, estacao_id, posicao) values ($1,$2,1) returning id`, [ciclo, est])).rows[0].id;
  await q(`insert into execucoes (sala_id, ciclo_id, item_id, estado, avaliador_id, candidato_id, finalizada_em, nota, checklist) values ($1,$2,$3,'finalizada',$4,$4,now(),3,'{"itens":[]}'::jsonb)`, [sala, ciclo, item, u]);
  const g = (await chamar('GET', '/api/desempenho', { token: u })).corpo;
  assert.equal(g.por_modalidade.find((m) => m.modalidade === 'solo').como_candidato, 1);
  assert.equal((await chamar('GET', '/api/desempenho?modalidade=solo', { token: u })).corpo.resumo.estacoes, 1);
  assert.equal((await chamar('GET', '/api/desempenho?modalidade=sala', { token: u })).corpo.resumo.estacoes, 0);
});
