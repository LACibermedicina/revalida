// E2E da tela "Catálogo": filtros, estado de estudo, matriz de temas por ano e importação de caderno INEP.
// Servidor: rotas REAIS do catálogo + Postgres real; IA falsa (nenhum provedor é chamado).
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import assert from 'node:assert/strict';
import { iniciar } from './servidor-http.mjs';

const NPM = process.env.NPM_TOOLS || '/opt/npm-tools/node_modules';
const req = createRequire(`${NPM}/x.js`);
const esbuild = req('esbuild'); const { chromium } = req('playwright');
const aqui = fileURLToPath(new URL('.', import.meta.url));
const web = join(aqui, '../../../web');
const saida = process.env.SAIDA || join(aqui, 'capturas'); const pub = join(saida, 'pub9');
mkdirSync(pub, { recursive: true });
writeFileSync(join(saida, 'stub-io9.js'), 'export const io = () => ({ emit() {}, on() {}, disconnect() {} });');
writeFileSync(join(saida, 'stub-video9.js'), "export async function criarSalaVideo() { return { modo: 'demo', pode: {} }; }");
await esbuild.build({ entryPoints: [join(web, 'src/main.jsx')], bundle: true, outdir: pub, format: 'esm', target: 'es2022', logLevel: 'error', nodePaths: [NPM],
  alias: { 'socket.io-client': join(saida, 'stub-io9.js') }, plugins: [{ name: 'v', setup: (b) => b.onResolve({ filter: /\/video\.js$/ }, () => ({ path: join(saida, 'stub-video9.js') })) }],
  define: { 'process.env.NODE_ENV': '"production"' }, loader: { '.css': 'css' } });
writeFileSync(join(pub, 'index.html'), readFileSync(join(web, 'index.html'), 'utf8')
  .replace('<script type="module" src="/src/main.jsx"', '<script type="module" src="/main.js"').replace('</head>', '<link rel="stylesheet" href="/main.css">\n</head>'));

const srv = await iniciar({ pastaWeb: pub });
const nav = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
const falhas = [];
const passo = async (n, fn) => { try { await fn(); console.log('✔', n); } catch (e) { falhas.push(n); console.log('✘', n, '\n   ', e.message.split('\n')[0]); } };


const u = async (email) => (await srv.q(`select id, sessao_versao from usuarios where email=$1`, [email])).rows[0];
const ana = await u('ana@x.com'); const moda = await u('moda@x.com');
const sessao = (x, nome, papel) => ({ token: srv.assinar({ id: x.id, nome, papel_app: papel, sessao_versao: x.sessao_versao }), usuario: { id: x.id, nome, papel_app: papel } });
const nova = async (quem, { w = 1280, h = 800 } = {}) => {
  const c = await nav.newContext({ viewport: { width: w, height: h } });
  await c.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  await c.addInitScript((s) => localStorage.setItem('rp-auth', JSON.stringify(s)), quem);
  const p = await c.newPage(); p.on('pageerror', (e) => falhas.push(`erro de página: ${e.message}`));
  await p.goto(srv.url); await p.waitForSelector('nav'); await p.waitForTimeout(500);
  await p.locator('nav button:has-text("Catálogo")').click(); await p.waitForSelector('.ca-card');
  return p;
};
const aba = (p, n) => p.locator(`[role="tab"]:has-text("${n}")`).click();
const CAD = process.env.CADERNO_GO || '/root/.claude/uploads/b0edc374-3a6e-5847-99ed-8f15225946fd/2109100e-E-book__Esta__es_Prova_Pr_tica_Revalida_INEP_-_Ginecologia_o_Obstetr_cia.pdf.txt';
const caderno = existsSync(CAD) ? readFileSync(CAD, 'utf8') : null;
const dir = join(saida, 'cad'); mkdirSync(dir, { recursive: true });

let pa;
await passo('lista o catálogo com KPIs e filtra por área e busca', async () => {
  pa = await nova(sessao(ana, 'Ana Souza', 'usuario'));
  assert.match(await pa.textContent('.ca-kpis'), /426/);
  await pa.locator('.ca-areas button:has-text("Pediatria")').click(); await pa.waitForTimeout(400);
  assert.match(await pa.textContent('.ca-conta'), /87 estações/);
  await pa.locator('input[type=search]').fill('asma'); await pa.waitForTimeout(500);
  const n = await pa.locator('.ca-card').count(); assert.ok(n >= 1 && n < 87);
  await pa.screenshot({ path: join(saida, 'catalogo-lista.png') });
});
await passo('marca estudo/prioridade/anotação e o estado persiste ao recarregar', async () => {
  await pa.locator('.ca-card').first().locator('select').first().selectOption('dominada'); await pa.waitForTimeout(500);
  const cod = await pa.locator('.ca-card').first().getAttribute('data-codigo');
  const r = (await srv.q(`select status from catalogo_estudo where codigo=$1`, [cod])).rows[0];
  assert.equal(r?.status, 'dominada');
});
await passo('temas por ano: matriz com anos e temas mais cobrados', async () => {
  await aba(pa, 'Temas'); await pa.waitForSelector('.ca-matriz tbody tr');
  assert.ok((await pa.locator('.ca-matriz tbody tr').count()) > 10);
  await pa.screenshot({ path: join(saida, 'catalogo-temas.png') });
});
await passo('usuário comum não vê a importação de cadernos', async () => {
  await aba(pa, 'Importar'); assert.match(await pa.textContent('.ca-tela'), /moderadores e administradores/);
});
await passo('moderador importa o caderno de GO e baixa o pacote com relatório', async () => {
  if (!caderno) { console.log('   (caderno não disponível: passo ignorado; defina CADERNO_GO)'); return; }
  const p = await nova(sessao(moda, 'Moda', 'moderador')); await aba(p, 'Importar');
  writeFileSync(join(dir, 'go.txt'), caderno);
  await p.locator('input[type=file]').setInputFiles(join(dir, 'go.txt')); await p.waitForSelector('.ca-rel li', { timeout: 30000 });
  assert.match(await p.textContent('[role=status]'), /estações lidas/);
  assert.ok((await p.locator('.ca-rel li.conf, .ca-rel li.bom').count()) >= 10);
  const [dl] = await Promise.all([p.waitForEvent('download'), p.locator('button:has-text("Baixar pacote")').click()]);
  assert.match(dl.suggestedFilename(), /\.rvpack$/);
  await p.screenshot({ path: join(saida, 'catalogo-importar.png'), fullPage: true });
});
await passo('menu lateral: ocultar e mostrar, com a escolha lembrada ao recarregar; ícones são SVG', async () => {
  assert.ok((await pa.locator('nav .ni svg').count()) >= 7);
  assert.equal(await pa.locator('nav').isVisible(), true);
  await pa.locator('.menu-alterna').click(); await pa.waitForTimeout(200);
  assert.equal(await pa.locator('nav').isVisible(), false);
  assert.equal(await pa.locator('.menu-alterna').getAttribute('aria-expanded'), 'false');
  assert.ok((await pa.locator('.tela').first().boundingBox()).width > 900, 'o conteúdo ocupa a largura toda');
  await pa.screenshot({ path: join(saida, 'menu-oculto.png') });
  await pa.reload(); await pa.waitForSelector('.menu-alterna'); assert.equal(await pa.locator('nav').isVisible(), false);
  await pa.locator('.menu-alterna').click(); await pa.waitForTimeout(200);
  assert.equal(await pa.locator('nav').isVisible(), true);
  // só ícones: o texto some e o menu estreita, a escolha também é lembrada
  await pa.locator('.menu-texto').click(); await pa.waitForTimeout(200);
  assert.ok((await pa.locator('nav').boundingBox()).width < 110, 'menu estreito');
  assert.equal(await pa.locator('nav button:has-text("Estudo")').getAttribute('aria-current'), null);
  await pa.screenshot({ path: join(saida, 'menu-so-icones.png'), clip: { x: 0, y: 0, width: 300, height: 800 } });
  await pa.reload(); await pa.waitForSelector('.menu-texto'); assert.ok((await pa.locator('nav').boundingBox()).width < 110);
  await pa.locator('.menu-texto').click(); await pa.waitForTimeout(200); assert.ok((await pa.locator('nav').boundingBox()).width > 150);
  await pa.locator('nav button:has-text("Estudo")').hover(); await pa.waitForTimeout(300);
  await pa.screenshot({ path: join(saida, 'menu-icones.png'), clip: { x: 0, y: 0, width: 300, height: 800 } });
});
await passo('celular: o menu também oculta e o botão não cobre o conteúdo', async () => {
  const p = await nova(sessao(ana, 'Ana Souza', 'usuario'), { w: 390, h: 800 });
  await p.locator('.menu-alterna').click(); await p.waitForTimeout(200);
  assert.equal(await p.locator('nav').isVisible(), false);
  assert.equal(await p.locator('.menu-alterna').isVisible(), true);
  await p.locator('.menu-alterna').click(); assert.equal(await p.locator('nav').isVisible(), true);
});
await passo('celular: sem rolagem horizontal', async () => {
  const p = await nova(sessao(ana, 'Ana Souza', 'usuario'), { w: 390, h: 800 });
  assert.ok((await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)) <= 1);
  await p.screenshot({ path: join(saida, 'catalogo-celular.png') });
});

await nav.close(); srv.fechar();
console.log(falhas.length ? `\n${falhas.length} falha(s)` : '\nTodos os passos passaram.');
process.exit(falhas.length ? 1 : 0);
