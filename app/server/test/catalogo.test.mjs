// Catálogo: dados de referência, estado de estudo por pessoa, matriz de temas e importador do caderno INEP.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { criarApp, criarBanco, criarQ } from './ajuda.mjs';
import { registrarCatalogo } from '../src/catalogo.js';
import { registrarEstacoes } from '../src/estacoes.js';
import { lerPEP } from '../src/importar-inep.js';

const bd = criarBanco('rv_catalogo');
const q = criarQ(bd.nome);
const { app, chamar } = criarApp();
const autenticar = (req, _res, prox) => { const [id, papel] = String(req.headers.authorization).split(' ')[1].split('|'); req.usuario = { id, papel_app: papel || 'usuario' }; prox(); };
before(() => { registrarCatalogo(app, { q, autenticar }); registrarEstacoes(app, { q, autenticar, ia: { configurado: () => false } }); });
after(() => bd.derrubar());
const uid = async (n) => (await q(`insert into usuarios (nome,email,senha_hash) values ($1,$2,'x') returning id`, [n + 'xx', `${n}${Math.random()}@x.com`])).rows[0].id;
const api = (m, u, t, c) => chamar(m, u, { token: t, corpo: c });

test('dados de referência: 426 estações únicas, áreas válidas e classificação coerente', () => {
  const c = JSON.parse(fs.readFileSync(new URL('../data/catalogo.json', import.meta.url), 'utf8'));
  assert.equal(c.length, 426); assert.equal(new Set(c.map((e) => e.codigo)).size, 426);
  assert.ok(c.every((e) => ['clinica_medica', 'cirurgia', 'ginecologia_obstetricia', 'pediatria', 'mfc'].includes(e.area)));
  assert.ok(c.every((e) => ['inep', 'inep_modificado', 'sem_inep'].includes(e.classificacao)));
});

test('lista com filtros e KPIs; estado de estudo é só de quem o define', async () => {
  const a = await uid('a'); const b = await uid('b');
  const L = await api('GET', '/api/catalogo', `${a}|usuario`);
  assert.equal(L.status, 200); assert.equal(L.corpo.kpis.total, 426); assert.equal(L.corpo.itens.length, 426);
  const go = await api('GET', '/api/catalogo?area=ginecologia_obstetricia&classificacao=inep', `${a}|usuario`);
  assert.ok(go.corpo.itens.length > 0 && go.corpo.itens.every((e) => e.area === 'ginecologia_obstetricia' && e.classificacao === 'inep'));
  const cod = L.corpo.itens[0].codigo;
  const p = await api('PUT', `/api/catalogo/${cod}/estudo`, `${a}|usuario`, { status: 'dominada', prioridade: 2, observacoes: 'revisar dose' });
  assert.equal(p.status, 200); assert.equal(p.corpo.status, 'dominada'); assert.equal(p.corpo.prioridade, 2);
  const p2 = await api('PUT', `/api/catalogo/${cod}/estudo`, `${a}|usuario`, { prioridade: 3 });
  assert.equal(p2.corpo.status, 'dominada', 'campo omitido não é apagado'); assert.equal(p2.corpo.observacoes, 'revisar dose');
  assert.equal((await api('GET', '/api/catalogo', `${a}|usuario`)).corpo.kpis.dominadas, 1);
  assert.equal((await api('GET', '/api/catalogo', `${b}|usuario`)).corpo.kpis.dominadas, 0, 'outra pessoa não vê');
  assert.equal((await api('GET', '/api/catalogo?status=dominada', `${a}|usuario`)).corpo.itens.length, 1);
});

test('validações do estudo: status, prioridade, código e vínculo com estação alheia', async () => {
  const a = await uid('c'); const b = await uid('d');
  const cod = (await api('GET', '/api/catalogo', `${a}|usuario`)).corpo.itens[0].codigo;
  assert.equal((await api('PUT', `/api/catalogo/${cod}/estudo`, `${a}|usuario`, { status: 'x' })).status, 400);
  assert.equal((await api('PUT', `/api/catalogo/${cod}/estudo`, `${a}|usuario`, { prioridade: 9 })).status, 400);
  assert.equal((await api('PUT', `/api/catalogo/nao-existe/estudo`, `${a}|usuario`, {})).status, 404);
  const alheia = (await q(`insert into estacoes (titulo, area, status, criado_por) values ('X','mfc','rascunho',$1) returning id`, [b])).rows[0].id;
  assert.equal((await api('PUT', `/api/catalogo/${cod}/estudo`, `${a}|usuario`, { estacao_id: alheia })).status, 400);
  const minha = (await q(`insert into estacoes (titulo, area, status, criado_por) values ('Y','mfc','rascunho',$1) returning id`, [a])).rows[0].id;
  const ok = await api('PUT', `/api/catalogo/${cod}/estudo`, `${a}|usuario`, { estacao_id: minha });
  assert.equal(ok.status, 200); assert.equal(ok.corpo.estacao_id, minha);
});

test('matriz de temas por ano: frequência ordenada e filtro por área', async () => {
  const a = await uid('e');
  const r = await api('GET', '/api/catalogo/temas-prova', `${a}|usuario`);
  assert.ok(r.corpo.anos.includes('2011') && r.corpo.anos.length >= 14);
  assert.ok(r.corpo.linhas.every((l, i, v) => i === 0 || v[i - 1].vezes >= l.vezes));
  const g = await api('GET', '/api/catalogo/temas-prova?area=pediatria', `${a}|usuario`);
  assert.ok(g.corpo.linhas.length > 0 && g.corpo.linhas.every((l) => l.area === 'pediatria'));
});

test('importar-ebook: só moderador; área e texto validados', async () => {
  const a = await uid('f');
  assert.equal((await api('POST', '/api/catalogo/importar-ebook', `${a}|usuario`, { area: 'mfc', texto: 'x'.repeat(300) })).status, 403);
  assert.equal((await api('POST', '/api/catalogo/importar-ebook', `${a}|moderador`, { area: 'zzz', texto: 'x'.repeat(300) })).status, 400);
  assert.equal((await api('POST', '/api/catalogo/importar-ebook', `${a}|moderador`, { area: 'mfc', texto: 'curto' })).status, 400);
  const r = await api('POST', '/api/catalogo/importar-ebook', `${a}|moderador`, { area: 'mfc', texto: 'sem sumário '.repeat(40) });
  assert.equal(r.status, 200); assert.equal(r.corpo.pacote, null);
});

const PEP = `1. Apresentação: (1) pede que se sente.
Adequado: realiza. (0,5)
Parcialmente adequado: um. (0,25)
Inadequado: nenhum. (0)
***********
2. Pergunta a DUM.
Adequado: pergunta. (0,5)
Inadequado: não pergunta. (0)
PROPEDÊUTICA
5. Indica beta hCG.
Adequado: indica. (1,5)
Inadequado: não indica. (0)
ITENS DE DESEMPENHO AVALIADOS
DESEMPENHO OBSERVADO
4. Pergunta sobre história familiar.
Adequado: pergunta. (0,0)
Inadequado: não pergunta. (0,3)
3. Pergunta o motivo.
Adequado: pergunta. (0,3)
Inadequado: não pergunta. (0,0)`;
test('lerPEP tolera item perdido, ordem trocada entre páginas e pontuação invertida', () => {
  const it = lerPEP(PEP.split('\n'));
  assert.deepEqual(it.map((x) => x.pontos_total), [0.5, 0.5, 0.3, 0.3, 1.5], 'ordenado pelo número do item');
  assert.equal(it[0].pontos_parcial, 0.25); assert.equal(it[1].pontos_parcial, null);
});

test('pacote com incertos entra como rascunho (nunca aprovado direto, mesmo importado por admin)', async () => {
  const adm = await uid('g');
  const est = { titulo: 'Pacote incerto', area: 'mfc', duracao_min: 10, sintese: 's', instrucoes_candidato: 'Faça a anamnese e o exame.', cenario: 'UBS', script_ator: 'roteiro do ator suficiente',
    pep: [{ descricao: 'Item 1 do PEP', pontos_total: 5, critico: false }, { descricao: 'Item 2 do PEP', pontos_total: 4, critico: false }, { descricao: 'Item 3 do PEP', pontos_total: 1, critico: false }], materiais: [], conceitos: ['x'], objetivos: [], incertos: ['pep'] };
  const { montarPacote } = await import('../src/estacoes.js');
  const r = await api('POST', '/api/estacoes/importar-pacote', `${adm}|admin`, { pacote: montarPacote([est]) });
  assert.equal(r.status, 201, JSON.stringify(r.corpo));
  assert.equal(r.corpo.importadas, 1, JSON.stringify(r.corpo));
  const id = r.corpo.resultado[0].id;
  const e = (await q(`select status, incertos from estacoes where id=$1`, [id])).rows[0];
  assert.equal(e.status, 'rascunho'); assert.deepEqual(typeof e.incertos === 'string' ? JSON.parse(e.incertos) : e.incertos, ['pep']);
});
