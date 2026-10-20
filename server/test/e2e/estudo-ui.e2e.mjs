// E2E da tela "Estudo" (web e desktop): trilha por desempenho, cartões com repetição espaçada, resumo específico, mapa de temas e diretrizes.
// Servidor: rotas REAIS de estudo + Postgres real; IA falsa (nenhum provedor é chamado).
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import assert from 'node:assert/strict';
import { iniciar } from './servidor-http.mjs';

const NPM = process.env.NPM_TOOLS || '/opt/npm-tools/node_modules';
const req = createRequire(`${NPM}/x.js`);
const esbuild = req('esbuild'); const { chromium } = req('playwright');
const aqui = fileURLToPath(new URL('.', import.meta.url));
const web = join(aqui, '../../../web');
const saida = process.env.SAIDA || join(aqui, 'capturas'); const pub = join(saida, 'pub8');
mkdirSync(pub, { recursive: true });
writeFileSync(join(saida, 'stub-io8.js'), 'export const io = () => ({ emit() {}, on() {}, disconnect() {} });');
writeFileSync(join(saida, 'stub-video8.js'), "export async function criarSalaVideo() { return { modo: 'demo', pode: {} }; }");
await esbuild.build({ entryPoints: [join(web, 'src/main.jsx')], bundle: true, outdir: pub, format: 'esm', target: 'es2022', logLevel: 'error', nodePaths: [NPM],
  alias: { 'socket.io-client': join(saida, 'stub-io8.js') }, plugins: [{ name: 'v', setup: (b) => b.onResolve({ filter: /\/video\.js$/ }, () => ({ path: join(saida, 'stub-video8.js') })) }],
  define: { 'process.env.NODE_ENV': '"production"' }, loader: { '.css': 'css' } });
writeFileSync(join(pub, 'index.html'), readFileSync(join(web, 'index.html'), 'utf8')
  .replace('<script type="module" src="/src/main.jsx"', '<script type="module" src="/main.js"').replace('</head>', '<link rel="stylesheet" href="/main.css">\n</head>'));

const srv = await iniciar({ pastaWeb: pub });
const nav = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
const falhas = [];
const passo = async (n, fn) => { try { await fn(); console.log('✔', n); } catch (e) { falhas.push(n); console.log('✘', n, '\n   ', e.message.split('\n')[0]); } };

// uma estação aprovada com dois temas ligados (é assim que o mapa nasce: dos conceitos das estações)
const est = (await srv.q(`insert into estacoes (titulo, area, status, duracao_min, conceitos) values ('Crise convulsiva febril aos 18 meses','pediatria','aprovada',10,'["Crise convulsiva febril","Febre na criança"]') returning id`)).rows[0].id;
const t1 = (await srv.q(`insert into temas (nome, nome_norm, area, origem) values ('Crise convulsiva febril','crise convulsiva febril','pediatria','estacao') returning id`)).rows[0].id;
const t2 = (await srv.q(`insert into temas (nome, nome_norm, area, origem) values ('Febre na criança','febre na crianca','pediatria','estacao') returning id`)).rows[0].id;
await srv.q(`insert into estacao_temas (estacao_id, tema_id) values ($1,$2),($1,$3)`, [est, t1, t2]);
await srv.q(`insert into tema_relacoes (de, para, tipo, peso, origem) values ($1,$2,'relacionado',0.5,'estacao')`, [t1 < t2 ? t1 : t2, t1 < t2 ? t2 : t1]);

const u = async (email) => (await srv.q(`select id, sessao_versao from usuarios where email=$1`, [email])).rows[0];
const ana = await u('ana@x.com'); const moda = await u('moda@x.com');
const sessao = (x, nome, papel) => ({ token: srv.assinar({ id: x.id, nome, papel_app: papel, sessao_versao: x.sessao_versao }), usuario: { id: x.id, nome, papel_app: papel } });
const nova = async (quem, { w = 1280, h = 800 } = {}) => {
  const c = await nav.newContext({ viewport: { width: w, height: h } });
  await c.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  await c.addInitScript((s) => localStorage.setItem('rp-auth', JSON.stringify(s)), quem);
  const p = await c.newPage(); p.on('pageerror', (e) => falhas.push(`erro de página: ${e.message}`));
  await p.goto(srv.url); await p.waitForSelector('nav'); await p.waitForTimeout(500);
  await p.locator('nav button:has-text("Estudo")').click(); await p.waitForSelector('h2:has-text("Estudo")');
  return p;
};
const aba = (p, n) => p.locator(`[role="tab"]:has-text("${n}")`).click();

let pa;
await passo('trilha lista os temas das estações e permite inverter a ordem (fraco→forte / forte→fraco)', async () => {
  pa = await nova(sessao(ana, 'Ana Souza', 'usuario'));
  await pa.waitForSelector('[data-testid="trilha"] li');
  assert.ok((await pa.locator('[data-testid="trilha"] li').count()) >= 2);
  assert.match(await pa.textContent('[data-testid="trilha"]'), /Crise convulsiva febril/);
  await pa.locator('button:has-text("Do mais forte")').click(); await pa.waitForSelector('[data-testid="trilha"] li');
  assert.equal(await pa.locator('button:has-text("Do mais forte")').getAttribute('aria-pressed'), 'true');
  await pa.screenshot({ path: join(saida, 'estudo-trilha.png') });
});

await passo('mapa: lista alternativa, seleção do tema e painel com a origem das diretrizes', async () => {
  await aba(pa, 'Mapa 3D'); await pa.waitForSelector('canvas, [data-testid="lista-temas"]');
  assert.equal(await pa.locator('canvas').count(), 1, 'o mapa 3D desenha num canvas');
  await pa.locator('button:has-text("Ver como lista")').click(); await pa.waitForSelector('[data-testid="lista-temas"]');
  await pa.locator('[data-testid="lista-temas"] button:has-text("Crise convulsiva febril")').click();
  await pa.waitForSelector('section[aria-label="Tema Crise convulsiva febril"]');
  assert.match(await pa.textContent('section[aria-label^="Tema"]'), /sem diretriz de referência/);
});

await passo('nova série de cartões por IA e estudo com repetição espaçada', async () => {
  await pa.locator('button:has-text("Nova série")').click(); await pa.waitForSelector('text=Nova série 1 com 2 cartões');
  await pa.locator('button:has-text("Estudar cartões")').click(); await pa.waitForSelector('[data-testid="cartao"]');
  assert.match(await pa.textContent('[data-testid="cartao"]'), /Qual a conduta inicial/);
  assert.equal(await pa.locator('[data-testid="verso"]').count(), 0, 'a resposta só aparece depois de pedir');
  await pa.locator('button:has-text("Mostrar resposta")').click(); await pa.waitForSelector('[data-testid="verso"]');
  assert.match(await pa.textContent('[data-testid="cartao"]'), /sem diretriz de referência/i);
  await pa.locator('button:has-text("Errei")').click();
  await pa.locator('button:has-text("Mostrar resposta")').click(); await pa.locator('button:has-text("Fácil")').click();
  await pa.waitForSelector('[data-testid="cartoes-fim"]');
  assert.match(await pa.textContent('[data-testid="cartoes-fim"]'), /2 cartões revisados/);
  const prog = (await srv.q(`select intervalo_dias, erros, acertos from cartao_progresso where usuario_id=$1 order by intervalo_dias`, [ana.id])).rows;
  assert.equal(prog.length, 2); assert.equal(prog[0].intervalo_dias, 1); assert.equal(prog[0].erros, 1);   // errou: volta amanhã
  await pa.screenshot({ path: join(saida, 'estudo-cartoes.png') });
});

await passo('resumo específico por foco (IA recebe o foco)', async () => {
  await aba(pa, 'Mapa 3D'); await pa.locator('button:has-text("Ver como lista")').click();
  await pa.locator('[data-testid="lista-temas"] button:has-text("Crise convulsiva febril")').click();
  await pa.fill('input[placeholder^="Ex.: conduta"]', 'conduta na crise prolongada'); await pa.locator('button:has-text("Gerar resumo")').click();
  await pa.waitForSelector('text=Resumo gerado.');
  assert.equal(srv.ia.chamadas.filter((c) => c[0] === 'resumo').at(-1)[1].foco, 'conduta na crise prolongada');
  await pa.locator('.es-resumo button.ln').first().click(); await pa.waitForSelector('.es-corpo');
  assert.match(await pa.textContent('.es-corpo'), /O que reconhecer/);
});

await passo('expandir o mapa por IA cria temas ligados', async () => {
  await pa.locator('button:has-text("Expandir o mapa")').click(); await pa.waitForSelector('text=2 temas ligados ao mapa.');
  await pa.waitForFunction(() => document.querySelector('section[aria-label^="Tema"]')?.textContent.includes('Meningite bacteriana'));
  const n = (await srv.q(`select count(*)::int n from temas where origem='ia'`)).rows[0].n; assert.equal(n, 2);
  await pa.screenshot({ path: join(saida, 'estudo-mapa.png') });
});

await passo('diretriz cadastrada pela moderação vira contexto da IA; usuário comum não cadastra', async () => {
  await aba(pa, 'Diretrizes'); await pa.waitForSelector('text=Só moderação e administração cadastram');
  const pm = await nova(sessao(moda, 'Moda Dora', 'moderador'));
  await aba(pm, 'Diretrizes'); await pm.fill('input[maxlength="160"]', 'Manejo da crise convulsiva febril'); await pm.fill('input[placeholder^="Ministério"]', 'Ministério da Saúde');
  await pm.fill('textarea', 'Crise febril simples dura menos de 15 minutos, é generalizada e não recorre em 24 horas. Não se indica anticonvulsivante contínuo.');
  await pm.locator('button:has-text("Cadastrar")').click(); await pm.waitForSelector('text=Diretriz cadastrada.');
  await aba(pm, 'Mapa 3D'); await pm.locator('button:has-text("Ver como lista")').click();
  await pm.locator('[data-testid="lista-temas"] button:has-text("Crise convulsiva febril")').click();
  await pm.waitForFunction(() => document.querySelector('section[aria-label^="Tema"]')?.textContent.includes('diretriz: Manejo da crise convulsiva febril'));
  await pm.locator('button:has-text("Nova série")').click(); await pm.waitForSelector('text=Nova série 2');
  const dir = srv.ia.chamadas.filter((c) => c[0] === 'cartoes').at(-1)[1].diretrizes;
  assert.equal(dir.length, 1); assert.match(dir[0].texto, /Crise febril simples/);
});

await passo('guia de treino: níveis, roteiro universal, erros e semana (conteúdo fixo, não substitui o PEP)', async () => {
  await aba(pa, 'Guia de treino'); await pa.waitForSelector('[data-testid="guia"]');
  const t = await pa.textContent('[data-testid="guia"]');
  assert.match(t, /Estação guiada/); assert.match(t, /Estação cronometrada/); assert.match(t, /Bloco misto/); assert.match(t, /não substitui o PEP/);
  await pa.locator('summary:has-text("Roteiro universal")').click(); assert.match(await pa.textContent('[data-testid="guia"]'), /Abertura e segurança/);
  await pa.locator('summary:has-text("Como montar a semana")').click(); assert.match(await pa.textContent('[data-testid="guia"]'), /Dia 7/);
});

await passo('celular: sem rolagem horizontal na trilha e no mapa', async () => {
  const p = await nova(sessao(ana, 'Ana Souza', 'usuario'), { w: 390, h: 800 });
  await p.waitForSelector('[data-testid="trilha"] li');
  assert.ok((await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)) <= 1);
  await aba(p, 'Mapa 3D'); await p.waitForSelector('canvas');
  assert.ok((await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)) <= 1);
  await p.screenshot({ path: join(saida, 'estudo-celular.png') });
});

await nav.close(); srv.fechar();
console.log(falhas.length ? `\n${falhas.length} falha(s)` : '\nTodos os passos passaram.');
process.exit(falhas.length ? 1 : 0);
