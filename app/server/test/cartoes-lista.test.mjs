// Cartões: raridade, validação, listagem paginada (10 por área), assistente (rascunho → salvar), edição e exclusão.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { criarApp, criarBanco, criarQ } from './ajuda.mjs';
import { registrarEstudo } from '../src/estudo.js';
import { raridadeDoCartao, validarCartoesManuais } from '../src/cartoes-lista.js';

test('raridade da carta segue o estágio da repetição espaçada', () => {
  assert.deepEqual(raridadeDoCartao(null), { estagio: 'novo', raridade: 'comum', nivel: 1 });
  assert.equal(raridadeDoCartao({ repeticoes: 1, intervalo_dias: 1, acertos: 1 }).raridade, 'incomum');
  assert.equal(raridadeDoCartao({ repeticoes: 2, intervalo_dias: 3, acertos: 2 }).raridade, 'rara');
  assert.equal(raridadeDoCartao({ repeticoes: 4, intervalo_dias: 10, acertos: 4 }).raridade, 'epica');
  assert.equal(raridadeDoCartao({ repeticoes: 5, intervalo_dias: 40, acertos: 5 }).raridade, 'lendaria');
  assert.equal(raridadeDoCartao({ repeticoes: 0, intervalo_dias: 1, acertos: 0, erros: 2 }).raridade, 'comum');
});

test('validação dos cartões escritos/revisados', () => {
  assert.ok(validarCartoesManuais([]).erro); assert.ok(validarCartoesManuais([{ frente: 'ab', verso: 'x' }]).erro);
  assert.ok(validarCartoesManuais(Array(31).fill({ frente: 'Pergunta', verso: 'Resposta' })).erro);
  assert.equal(validarCartoesManuais([{ frente: ' Pergunta ok ', verso: 'Resp' }]).cartoes[0].frente, 'Pergunta ok');
});

const bd = criarBanco('rv_cartoes');
const q = criarQ(bd.nome);
const { app, chamar } = criarApp();
const iaFalsa = {
  chamadas: [], configurado: () => true, ordem: () => ['gemini'], modelo: () => 'falsa',
  async gerarCartoes(p) { this.chamadas.push(p); return { cartoes: [{ frente: `Pergunta sobre ${p.tema}?`, verso: 'Resposta A' }, { frente: `Outra sobre ${p.tema}?`, verso: 'Resposta B' }] }; },
};
const autenticar = (req, _res, prox) => { const [id, papel] = String(req.headers.authorization).split(' ')[1].split('|'); req.usuario = { id, papel_app: papel || 'usuario' }; prox(); };
before(() => { registrarEstudo(app, { q, autenticar, ia: iaFalsa }); });
after(() => bd.derrubar());
const uid = async (n) => (await q(`insert into usuarios (nome,email,senha_hash) values ($1,$2,'x') returning id`, [n, `${n}${Math.random()}@x.com`])).rows[0].id;
const api = (m, u, t, c) => chamar(m, u, { token: t, corpo: c });

test('listagem paginada de 10 em 10 por área, com totais por área e busca', async () => {
  const ana = await uid('ana'); const t1 = `${ana}|`;
  const tp = (await api('POST', '/api/estudo/temas/resolver', t1, { nome: 'Bronquiolite', area: 'pediatria' })).corpo.id;
  const tc = (await api('POST', '/api/estudo/temas/resolver', t1, { nome: 'Apendicite', area: 'cirurgia' })).corpo.id;
  const lote = (n, p) => Array.from({ length: n }, (_, k) => ({ frente: `${p} pergunta ${k + 1}?`, verso: `${p} resposta ${k + 1}` }));
  assert.equal((await api('POST', `/api/estudo/temas/${tp}/cartoes`, t1, { cartoes: lote(25, 'Ped') })).status, 201);
  assert.equal((await api('POST', `/api/estudo/temas/${tc}/cartoes`, t1, { cartoes: lote(3, 'Cir') })).status, 201);
  const p1 = (await api('GET', '/api/estudo/cartoes?area=pediatria', t1)).corpo;
  assert.equal(p1.itens.length, 10); assert.equal(p1.total, 25); assert.equal(p1.paginas, 3); assert.equal(p1.por_area.pediatria, 25); assert.equal(p1.por_area.cirurgia, 3);
  const p3 = (await api('GET', '/api/estudo/cartoes?area=pediatria&pagina=3', t1)).corpo; assert.equal(p3.itens.length, 5);
  const ids = new Set([1, 2, 3].flatMap(() => [])); for (const pg of [1, 2, 3]) for (const c of (await api('GET', `/api/estudo/cartoes?area=pediatria&pagina=${pg}`, t1)).corpo.itens) ids.add(c.id);
  assert.equal(ids.size, 25, 'páginas não repetem nem perdem cartões');
  const todas = (await api('GET', '/api/estudo/cartoes', t1)).corpo; assert.equal(todas.total, 28); assert.equal(todas.itens.length, 10);
  assert.equal((await api('GET', '/api/estudo/cartoes?area=marte', t1)).status, 400);
  assert.equal((await api('GET', '/api/estudo/cartoes?busca=Cir%20resposta%202', t1)).corpo.total, 1);
  assert.equal(p1.itens[0].raridade, 'comum'); assert.equal(p1.itens[0].meu, true);
});

test('assistente: rascunho não grava; salvar grava revisado; edição/exclusão só do autor', async () => {
  const bia = await uid('bia'); const cau = await uid('cau'); const tb = `${bia}|`; const tcau = `${cau}|`;
  const t = (await api('POST', '/api/estudo/temas/resolver', tb, { nome: 'Sepse', area: 'clinica_medica' })).corpo.id;
  const r = await api('POST', `/api/estudo/temas/${t}/cartoes/rascunho`, tb, { quantidade: 5, foco: 'bundle de 1 hora' });
  assert.equal(r.status, 200); assert.equal(r.corpo.cartoes.length, 2); assert.equal(r.corpo.aprofundado, true);
  assert.equal(iaFalsa.chamadas.at(-1).foco, 'bundle de 1 hora');
  assert.equal(Number((await q('select count(*) n from cartoes where tema_id=$1', [t])).rows[0].n), 0, 'rascunho não grava');
  const s = await api('POST', `/api/estudo/temas/${t}/cartoes`, tb, { cartoes: [{ frente: 'Qual o lactato de corte?', verso: '> 2 mmol/L' }], origem: 'ia' });
  assert.equal(s.status, 201); assert.equal(s.corpo.total, 1); assert.equal(s.corpo.serie, 1);
  assert.equal((await api('POST', `/api/estudo/temas/${t}/cartoes`, tb, { cartoes: [] })).status, 400);
  const L = await api('GET', '/api/estudo/cartoes?area=clinica_medica', tb); const id = L.corpo.itens[0].id;
  assert.equal((await api('PUT', `/api/estudo/cartoes/${id}`, tcau, { frente: 'Alterado por outro', verso: 'x' })).status, 403);
  assert.equal((await api('PUT', `/api/estudo/cartoes/${id}`, tb, { frente: 'Qual o lactato de corte?', verso: 'Acima de 2 mmol/L' })).status, 200);
  assert.equal((await api('GET', '/api/estudo/cartoes?area=clinica_medica', tcau)).corpo.itens[0].meu, false);
  assert.equal((await api('DELETE', `/api/estudo/cartoes/${id}`, tcau)).status, 403);
  assert.equal((await api('DELETE', `/api/estudo/cartoes/${id}`, `${cau}|moderador`)).status, 200);
});

test('cartões de hoje trazem área e raridade; revisar sobe a carta', async () => {
  const dan = await uid('dan'); const td = `${dan}|`;
  const t = (await api('POST', '/api/estudo/temas/resolver', td, { nome: 'Pré-eclâmpsia', area: 'ginecologia_obstetricia' })).corpo.id;
  await api('POST', `/api/estudo/temas/${t}/cartoes`, td, { cartoes: [{ frente: 'Critério de PA?', verso: '>= 140/90' }] });
  const h = (await api('GET', `/api/estudo/cartoes/hoje?tema=${t}`, td)).corpo;
  assert.equal(h[0].area, 'ginecologia_obstetricia'); assert.equal(h[0].raridade, 'comum');
  await api('POST', `/api/estudo/cartoes/${h[0].id}/revisar`, td, { qualidade: 5 });
  assert.equal((await api('GET', '/api/estudo/cartoes?area=ginecologia_obstetricia', td)).corpo.itens[0].raridade, 'incomum');
});
