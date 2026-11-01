import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { criarApp, criarBanco, criarQ } from './ajuda.mjs';
import { registrarDesempenho, classificar } from '../src/desempenho.js';

const bd = criarBanco('rv_desemp'); const q = criarQ(bd.nome); const { app, chamar } = criarApp();
before(() => registrarDesempenho(app, { q, autenticar: (req, _r, p) => { req.usuario = { id: req.headers.authorization.split(' ')[1] }; p(); } }));
after(() => bd.derrubar());

test('classificação em blocos gerais do PEP: seção primeiro, descrição depois, sem pista = outros', () => {
  assert.equal(classificar('Anamnese', 'x'), 'anamnese');
  assert.equal(classificar('Geral', 'Realiza ausculta cardíaca'), 'exame_fisico');
  assert.equal(classificar('Conduta', 'Prescreve analgesia'), 'conduta');
  assert.equal(classificar('Comunicação', 'Usa linguagem acessível'), 'comunicacao');
  assert.equal(classificar('Geral', 'Item qualquer'), 'outros');
});

test('desempenho agrega por bloco, modalidade, área e semana, com filtros', async () => {
  const [a, b] = await Promise.all([0, 1].map(async (i) => (await q(`insert into usuarios (nome,email,senha_hash) values ($1,$2,'x') returning id`, [`U${i}`, `u${i}${Math.random()}@x.com`])).rows[0].id));
  const e1 = (await q(`insert into estacoes (titulo, area, status) values ('E1','cirurgia','aprovada') returning id`)).rows[0].id;
  const e2 = (await q(`insert into estacoes (titulo, area, status) values ('E2','pediatria','aprovada') returning id`)).rows[0].id;
  for (const e of [e1, e2]) await q(`insert into pep_itens (estacao_id, secao, descricao, pontos_total, ordem) values ($1,'Anamnese','Pergunta a queixa',4,1), ($1,'Conduta','Prescreve',6,2)`, [e]);
  const sala = (await q(`insert into salas (dono_id, admin_id) values ($1,$1) returning id`, [b])).rows[0].id;
  const ciclo = (await q(`insert into ciclos (sala_id, admin_id, candidato_id, estado) values ($1,$2,$3,'encerrado') returning id`, [sala, b, a])).rows[0].id;
  let pos = 1;
  for (const [e, dias, anam, cond] of [[e1, 40, 'sim', 'nao'], [e2, 2, 'sim', 'sim']]) {
    const it = (await q(`insert into ciclo_itens (ciclo_id, estacao_id, posicao) values ($1,$2,$3) returning id`, [ciclo, e, pos++])).rows[0].id;
    const nota = (anam === 'sim' ? 4 : 0) + (cond === 'sim' ? 6 : 0);
    const chk = { itens: [{ secao: 'Anamnese', descricao: 'Pergunta a queixa', resultado: anam, pontos: anam === 'sim' ? 4 : 0, pontos_total: 4 }, { secao: 'Conduta', descricao: 'Prescreve', resultado: cond, pontos: cond === 'sim' ? 6 : 0, pontos_total: 6, critico: true }] };
    await q(`insert into execucoes (sala_id, ciclo_id, item_id, estado, avaliador_id, candidato_id, finalizada_em, nota, checklist) values ($1,$2,$3,'finalizada',$4,$5, now() - make_interval(days => ${dias}), $6, $7::jsonb)`, [sala, ciclo, it, b, a, nota, JSON.stringify(chk)]);
  }
  const g = (await chamar('GET', '/api/desempenho', { token: a })).corpo;
  assert.equal(g.resumo.estacoes, 2); assert.equal(g.resumo.percentual, 70); // (4+10)/(10+10) pelo checklist = 70
  const bl = (r, id) => r.por_bloco.find((x) => x.bloco === id);
  assert.equal(bl(g, 'anamnese').percentual, 100);
  assert.equal(bl(g, 'conduta').percentual, 50); assert.equal(bl(g, 'conduta').criticos_falhos, 1);
  assert.deepEqual(g.pontos_fracos, ['conduta'], 'abaixo de 60% = onde focar');
  assert.equal(g.por_modalidade.find((m) => m.modalidade === 'sala').como_candidato, 2); assert.equal(g.por_area.length, 2); assert.equal(g.evolucao.length, 2);
  const p = (await chamar('GET', '/api/desempenho?periodo=30', { token: a })).corpo; assert.equal(p.resumo.estacoes, 1); assert.equal(p.resumo.percentual, 100);
  const ar = (await chamar('GET', '/api/desempenho?area=cirurgia', { token: a })).corpo; assert.equal(ar.resumo.estacoes, 1); assert.equal(ar.resumo.percentual, 40);
  assert.deepEqual(ar.pontos_fracos, ['conduta']);
  assert.equal((await chamar('GET', '/api/desempenho?modalidade=trilha', { token: a })).corpo.resumo.estacoes, 0);
  assert.equal((await chamar('GET', '/api/desempenho?de=2020-01-01&ate=2020-02-01', { token: a })).corpo.resumo.estacoes, 0);
  const gb = (await chamar('GET', '/api/desempenho', { token: b })).corpo;
  assert.equal(gb.resumo.estacoes, 0, 'só o próprio desempenho'); assert.equal(gb.resumo.avaliadas, 2);
});
