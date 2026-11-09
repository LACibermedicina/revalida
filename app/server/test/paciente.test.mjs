// Prática solo com paciente IA: sala com a IA como ator/avaliador, conversa pelo script, correção, registro e script como estudo.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { criarApp, criarBanco, criarQ } from './ajuda.mjs';
import { registrarSalas } from '../src/salas.js';
import { registrarExecucao } from '../src/execucao.js';
import { registrarDesempenho } from '../src/desempenho.js';
import { ErroIA } from '../src/ia.js';
import { respostaHeuristica, validarPaciente } from '../src/paciente-ia.js';

const bd = criarBanco('rv_pac');
const q = criarQ(bd.nome);
const { app, chamar } = criarApp();
const ia = {
  on: true, falha: null, chamadas: [],
  configurado() { return this.on; },
  async responderPaciente(p) { this.chamadas.push(p); if (this.falha) throw this.falha;
    return { fala: 'Começou há dois dias, doutor.', liberar: /gasometria/i.test(p.pergunta) ? [p.materiais[0].id] : [] }; },
  async analisarTranscricao({ itens }) { return { itens: itens.map((i, n) => ({ pep_item_id: i.id, resultado: n < 2 ? 'sim' : 'nao', evidencia: 'x', justificativa: 'ok', fonte: 'ia', confiavel: true })), resumo: { pontos_fortes: ['Boa anamnese'] }, rebaixados: 0, modelo: 'fake' }; },
};
const autenticar = (req, _res, prox) => { req.usuario = { id: String(req.headers.authorization).split(' ')[1] }; prox(); };
let exec;
before(() => {
  exec = registrarExecucao(app, { q, autenticar, ia, difundir: async () => {}, intervaloAoVivoMs: 0 });
  registrarSalas(app, { q, autenticar, agora: { configurado: () => false }, cfg: { obter: () => '' }, difundir: async () => {}, aoFinalizar: exec.analisarFinal });
  registrarDesempenho(app, { q, autenticar });
});
after(() => bd.derrubar());

const uid = async (n) => (await q(`insert into usuarios (nome,email,senha_hash) values ($1,$2,'x') returning id`, [n, `${n}${Math.random()}@x.com`])).rows[0].id;
const api = (m, token, url, corpo) => chamar(m, url, { token, corpo });
async function estacao({ titulo = 'Asma na UBS', script = 'Paciente de 30 anos, falta de ar há dois dias, tosse seca à noite. Nega tabagismo. Usa bombinha às vezes.', origem = 'comunidade' } = {}) {
  const e = (await q(`insert into estacoes (titulo, area, status, instrucoes_candidato, cenario, duracao_min, script_ator, origem) values ($1,'clinica_medica','aprovada','Atenda.','UBS.',10,$2,$3) returning id`, [titulo, script, origem])).rows[0].id;
  for (const [i, d] of ['Pergunta o início', 'Investiga tabagismo', 'Prescreve salbutamol'].entries())
    await q(`insert into pep_itens (estacao_id, secao, ordem, descricao, pontos_total, critico) values ($1,'Geral',$2,$3,1,$4)`, [e, i, d, i === 2]);
  const m = (await q(`insert into estacao_materiais (estacao_id, ordem, tipo, titulo, conteudo, gatilho) values ($1,0,'laboratorial','Gasometria','pH 7,38','solicitar gasometria') returning id`, [e])).rows[0].id;
  return { e, m };
}

test('heurística e validação do paciente: só usa o script; ids de material desconhecidos são descartados', () => {
  assert.match(respostaHeuristica('Nega tabagismo. Tosse seca à noite.', 'Você fuma? tabagismo?'), /tabagismo/i);
  assert.match(respostaHeuristica('Nega tabagismo.', 'Qual sua cor favorita?'), /Não sei dizer/);
  const v = validarPaciente({ fala: 'Oi', liberar: ['a', 'zzz', 'a'] }, ['a']); assert.deepEqual(v.liberar, ['a']);
});

test('praticar: sorteia estação do banco com script, IA vira avaliador e o gabarito não chega ao candidato', async () => {
  const u = await uid('Ana'); const { e } = await estacao();
  const r = await api('POST', u, '/api/solo/praticar', {});
  assert.equal(r.status, 201, JSON.stringify(r.corpo)); assert.equal(r.corpo.estacao_id, e);
  const ex = (await q('select * from execucoes where id=$1', [r.corpo.execucao_id])).rows[0];
  assert.equal(ex.candidato_id, u); assert.equal(ex.estado, 'em_andamento');
  assert.equal((await q('select sistema from usuarios where id=$1', [ex.avaliador_id])).rows[0].sistema, true);
  assert.equal((await api('GET', u, `/api/execucoes/${ex.id}/pep`)).status, 403, 'candidato não vê o PEP nem o script');
  const cartas = (await api('GET', u, `/api/execucoes/${ex.id}/cartas`)).corpo; assert.equal(cartas.materiais.length, 0);
  assert.equal((await api('POST', u, '/api/solo/praticar', {})).corpo.retomada, true, 'prática aberta é retomada');
});

test('conversa: IA responde pelo script; pedido libera o material; sem IA responde só com trechos do script', async () => {
  const u = await uid('Bia'); const { m } = await estacao({ titulo: 'Outra estação' });
  const r = (await api('POST', u, '/api/solo/praticar', { estacao_id: (await q(`select id from estacoes where titulo='Outra estação'`)).rows[0].id })).corpo;
  const a = await api('POST', u, `/api/execucoes/${r.execucao_id}/paciente`, { texto: 'Quando começou a falta de ar?' });
  assert.equal(a.status, 201); assert.equal(a.corpo.fala, 'Começou há dois dias, doutor.');
  assert.ok(ia.chamadas.at(-1).estacao.script_ator.includes('falta de ar'));
  const b = await api('POST', u, `/api/execucoes/${r.execucao_id}/paciente`, { texto: 'Vou solicitar gasometria' });
  assert.deepEqual(b.corpo.liberados.map((x) => x.id), [m]);
  assert.equal((await api('GET', u, `/api/execucoes/${r.execucao_id}/cartas`)).corpo.materiais.length, 1);
  ia.on = false;
  const c = await api('POST', u, `/api/execucoes/${r.execucao_id}/paciente`, { texto: 'O senhor tem tabagismo?' });
  assert.equal(c.corpo.fonte, 'script'); assert.match(c.corpo.fala, /tabagismo/i); ia.on = true;
  const t = (await api('GET', u, `/api/execucoes/${r.execucao_id}/paciente`)).corpo.turnos; assert.equal(t.length, 6);
  assert.equal((await q('select count(*)::int n from transcricoes where execucao_id=$1', [r.execucao_id])).rows[0].n, 3, 'a fala do candidato alimenta a correção');
  const outro = await uid('Intruso'); assert.equal((await api('POST', outro, `/api/execucoes/${r.execucao_id}/paciente`, { texto: 'oi' })).status, 403);
  ia.falha = new ErroIA('IA_FALHA', 'x');
  assert.equal((await api('POST', u, `/api/execucoes/${r.execucao_id}/paciente`, { texto: 'Algum remédio?' })).corpo.fonte, 'script');
  ia.falha = null;
});

test('corrigir pela IA: nota, checklist, autocorreção, desempenho "solo", registro com IA e script liberado para estudo', async () => {
  const u = await uid('Caio'); const { e } = await estacao({ titulo: 'Estação IA', origem: 'ia' });
  await q(`update estacoes set variacao_tema = 'Crise asmática' where id = $1`, [e]);
  const r = (await api('POST', u, '/api/solo/praticar', { estacao_id: e })).corpo;
  assert.equal(r.fonte, 'ia'); assert.equal(r.variacao_tema, 'Crise asmática');
  assert.equal((await api('POST', u, `/api/execucoes/${r.execucao_id}/corrigir-ia`)).status, 400, 'sem fala não corrige');
  assert.equal((await api('GET', u, `/api/estacoes/${e}/script-ator`)).status, 403, 'antes de fazer, sem gabarito');
  await api('POST', u, `/api/execucoes/${r.execucao_id}/paciente`, { texto: 'Há quanto tempo? Fuma? Tem asma?' });
  const f = await api('POST', u, `/api/execucoes/${r.execucao_id}/corrigir-ia`);
  assert.equal(f.status, 200, JSON.stringify(f.corpo)); assert.equal(f.corpo.nota, 2); assert.equal(f.corpo.max, 3); assert.equal(f.corpo.criticos_falhos, 1);
  assert.equal((await q('select estado from execucoes where id=$1', [r.execucao_id])).rows[0].estado, 'finalizada');
  assert.equal((await api('POST', u, `/api/execucoes/${r.execucao_id}/paciente`, { texto: 'mais' })).status, 409);
  const ac = (await api('GET', u, `/api/execucoes/${r.execucao_id}/autocorrecao`)).corpo; assert.equal(ac.estado, 'pronta'); assert.equal(ac.itens.length, 3);
  const st = await api('GET', u, `/api/estacoes/${e}/script-ator`); assert.equal(st.status, 200); assert.match(st.corpo.script_ator, /falta de ar/); assert.equal(st.corpo.materiais.length, 1);
  const d = (await api('GET', u, '/api/desempenho')).corpo; assert.equal(d.por_modalidade.find((m) => m.modalidade === 'solo').como_candidato, 1);
  const h = (await api('GET', u, '/api/historico/estacoes')).corpo; assert.equal(h.total, 1);
  const it = h.itens[0]; assert.equal(it.modalidade, 'solo_ia'); assert.equal(it.feita_com_ia, true); assert.equal(it.estacao_gerada_por_ia, true); assert.equal(it.variacao_tematica, 'Crise asmática');
  assert.deepEqual(it.participantes.map((p) => [p.nome, p.papel, p.ia]), [['Caio', 'candidato', false], ['Paciente IA', 'avaliador_ator', true]]);
  assert.equal((await q('select estado from salas where id=$1', [r.sala_id])).rows[0].estado, 'encerrada');
});

test('sem script do ator não pratica com IA; desistir cancela e libera nova prática; registro de sala com duas pessoas', async () => {
  const u = await uid('Duda'); const sem = await estacao({ titulo: 'Sem script', script: '' });
  const r = await api('POST', u, '/api/solo/praticar', { estacao_id: sem.e }); assert.equal(r.status, 409); assert.equal(r.corpo.codigo, 'SEM_SCRIPT');
  const { e } = await estacao({ titulo: 'Para desistir' });
  const p = (await api('POST', u, '/api/solo/praticar', { estacao_id: e })).corpo;
  assert.equal((await api('POST', u, `/api/execucoes/${p.execucao_id}/desistir-ia`)).status, 200);
  assert.equal((await q('select estado from execucoes where id=$1', [p.execucao_id])).rows[0].estado, 'abandonada');
  // sala normal com duas pessoas: histórico mostra quem participou e a modalidade "sala"
  const av = await uid('Avaliadora'); const cand = await uid('Candidato');
  const sid = (await q('select rv_sala_criar($1) id', [av])).rows[0].id;
  await api('POST', cand, `/api/salas/${sid}/entrar`, {});
  assert.equal((await api('PATCH', av, `/api/salas/${sid}/candidato`, { usuario_id: cand })).status, 200);
  assert.equal((await api('POST', av, `/api/salas/${sid}/ciclos`, { estacoes: [e] })).status, 200);
  const ciclo = (await q('select ciclo_ativo_id c from salas where id=$1', [sid])).rows[0].c;
  const ex = (await api('POST', av, `/api/ciclos/${ciclo}/execucoes`, {})).corpo; const eid = ex.execucao_id ?? ex.r?.execucao_id;
  const fim = await api('POST', av, `/api/execucoes/${eid}/finalizar`, { marcas: {} }); assert.equal(fim.status, 200);
  for (const quem of [av, cand]) {
    const h = (await api('GET', quem, '/api/historico/estacoes')).corpo; const it = h.itens.find((x) => x.execucao_id === eid);
    assert.ok(it, 'aparece no histórico dos dois'); assert.equal(it.modalidade, 'sala'); assert.equal(it.feita_com_ia, false);
    assert.deepEqual(it.participantes.map((p) => [p.papel, p.ia]).sort(), [['avaliador_ator', false], ['candidato', false]]);
  }
});
