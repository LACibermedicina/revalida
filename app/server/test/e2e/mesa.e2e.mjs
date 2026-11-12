// E2E: shell estilo macOS (Mesa): dock, janelas, favoritos, notas rápidas, notificações e mensagens.
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync, readFileSync, cpSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import assert from 'node:assert/strict';
import { iniciar } from './servidor-http.mjs';

const NPM = process.env.NPM_TOOLS || '/opt/npm-tools/node_modules';
const req = createRequire(`${NPM}/x.js`);
const esbuild = req('esbuild'); const { chromium } = req('playwright');
const aqui = fileURLToPath(new URL('.', import.meta.url));
const web = join(aqui, '../../../web');
const saida = process.env.SAIDA || join(aqui, 'capturas'); const pub = join(saida, 'pub12');
mkdirSync(pub, { recursive: true });
writeFileSync(join(saida, 'stub-io12.js'), 'export const io = () => ({ emit() {}, on() {}, disconnect() {} });');
writeFileSync(join(saida, 'stub-video12.js'), "export async function criarSalaVideo() { return { modo: 'demo', pode: {}, alternarCam: async (l) => l, alternarMic: async (l) => l, sincronizar: async () => {}, sair: async () => {}, aoMudar() {}, aoRemoto() {} }; }");
await esbuild.build({ entryPoints: [join(web, 'src/main.jsx')], bundle: true, outdir: pub, format: 'esm', target: 'es2022', logLevel: 'error', nodePaths: [NPM],
  alias: { 'socket.io-client': join(saida, 'stub-io12.js') }, plugins: [{ name: 'v', setup: (b) => b.onResolve({ filter: /\/video\.js$/ }, () => ({ path: join(saida, 'stub-video12.js') })) }],
  define: { 'process.env.NODE_ENV': '"production"' }, loader: { '.css': 'css' } });
writeFileSync(join(pub, 'index.html'), readFileSync(join(web, 'index.html'), 'utf8')
  .replace('<script type="module" src="/src/main.jsx"', '<script type="module" src="/main.js"').replace('</head>', '<link rel="stylesheet" href="/main.css">\n</head>'));

cpSync(join(web, 'public'), pub, { recursive: true });
const srv = await iniciar({ pastaWeb: pub });
const nav = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
const falhas = [];
const passo = async (n, fn) => { try { await fn(); console.log('✔', n); } catch (e) { falhas.push(n); console.log('✘', n, '\n   ', e.message.split('\n')[0], '\n   ', (e.stack.split('\n').find((l) => l.includes('mesa.e2e')) || '').trim()); } };


for (const t of ['Dor torácica', 'Apendicite', 'Pré-natal', 'Febre infantil']) {
  const id = (await srv.q(`insert into estacoes (titulo, area, status, duracao_min, script_ator) values ($1,'clinica_medica','aprovada',10,'x') returning id`, [t])).rows[0].id;
  await srv.q(`insert into pep_itens (estacao_id, secao, ordem, descricao, pontos_total, critico) values ($1,'Anamnese',1,'Pergunta a queixa',1,false), ($1,'Conduta',2,'Prescreve',2,true)`, [id]);
}
const u = async (email) => (await srv.q(`select id, nome, sessao_versao, papel_app from usuarios where email=$1`, [email])).rows[0];
const sessao = (x) => ({ token: srv.assinar({ id: x.id, nome: x.nome, papel_app: x.papel_app, sessao_versao: x.sessao_versao }), usuario: { id: x.id, nome: x.nome, papel_app: x.papel_app } });
await srv.mkUser('Bia Lima', 'bia@x.com', 'senhaforte123');
const bia = await u('bia@x.com');
const abrir = async ({ w = 1280, h = 900 } = {}) => {
  const c = await nav.newContext({ viewport: { width: w, height: h } });
  await c.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  await c.addInitScript((s) => localStorage.setItem('rp-auth', JSON.stringify(s)), sessao(bia));
  const p = await c.newPage(); p.on('pageerror', (e) => falhas.push(`erro de página: ${e.message}`));
  await p.goto(srv.url + '/');
  return p;
};
const ir = async (p, rot) => { await p.locator(`nav button:has-text("${rot}")`).click(); };


await passo('menu: logo grande com só REVALIDA.M3D (sem "Revalida Prático") na barra e no menu clássico', async () => {
  const p = await abrir();
  await p.waitForSelector('[data-testid=mesa]');
  const marca = p.locator('.mesa-marca');
  assert.equal((await marca.innerText()).replace(/\s+/g, ''), 'REVALIDA.M3D');
  assert.ok(!(await p.locator('.mesa-barra').innerText()).includes('Prático'));
  const lg = await marca.locator('svg.logo').boundingBox(); assert.ok(lg.width >= 48, `logo ${lg.width}px`);
  const wm = await marca.locator('.wordmark').boundingBox(); assert.ok(wm.height >= 20);
  await p.locator('.mb-menu:has-text("Exibir") > button').click(); await p.locator('[role=menuitem]:has-text("Usar o menu clássico")').click();
  await p.waitForSelector('nav.nav .nav-marca');
  assert.equal((await p.locator('nav.nav .nav-marca').innerText()).replace(/\s+/g, ''), 'REVALIDA.M3D');
  assert.ok(!(await p.locator('nav.nav').innerText()).includes('Revalida Prático'));
  assert.ok((await p.locator('nav.nav .nav-marca svg.logo').boundingBox()).width >= 80);
  await p.context().close();
});

await passo('dock e janelas: abrir, focar, minimizar, restaurar, maximizar, mover e fechar', async () => {
  const p = await abrir(); await p.waitForSelector('[data-testid=dock]');
  await p.locator('.dock [data-tela=estudo]').click(); await p.waitForSelector('.jan[data-tela=estudo]');
  await p.locator('.dock [data-tela=desempenho]').click(); await p.waitForSelector('.jan[data-tela=desempenho]');
  assert.equal(await p.locator('.jan:not([hidden])').count() >= 2, true);
  const j = p.locator('.jan[data-tela=desempenho]'); await p.waitForTimeout(400);   // fim da animação de abertura
  const antes = await j.boundingBox();
  const barra = await j.locator('.jan-barra').boundingBox();
  await p.mouse.move(barra.x + barra.width / 2, barra.y + 20); await p.mouse.down(); await p.mouse.move(barra.x + barra.width / 2 + 90, barra.y + 60, { steps: 5 }); await p.mouse.up();
  const depois = await j.boundingBox(); assert.ok(Math.abs(depois.x - antes.x - 90) < 6 && Math.abs(depois.y - antes.y - 40) < 6, `a janela foi arrastada: dx=${depois.x - antes.x} dy=${depois.y - antes.y}`);
  await j.locator('[data-testid=jan-minimizar]').click(); assert.equal(await j.isHidden(), true);
  assert.ok((await p.locator('.dock [data-tela=desempenho]').getAttribute('class')).includes('min'));
  await p.locator('.dock [data-tela=desempenho]').click(); assert.equal(await j.isVisible(), true);
  await j.locator('[data-testid=jan-maximizar]').click();
  const mx = await j.boundingBox(); const area = await p.locator('.mesa-area').boundingBox(); assert.ok(mx.width >= area.width - 2, `maximizada ${mx.width} x área ${area.width}`);
  await j.locator('[data-testid=jan-maximizar]').click();
  await j.locator('[data-testid=jan-fechar]').click(); assert.equal(await p.locator('.jan[data-tela=desempenho]').count(), 0);
  await p.locator('.mb-menu:has-text("Janela") > button').click(); await p.locator('[role=menuitem]:has-text("Fechar todas")').click();
  assert.equal(await p.locator('.jan').count(), 0);
  await p.context().close();
});

await passo('favoritos na mesa: recurso, estação e tema para revisão (abrem, persistem na conta, removem)', async () => {
  const p = await abrir(); await p.waitForSelector('[data-testid=mesa]');
  const n0 = await p.locator('[data-testid=fav]').count(); assert.ok(n0 >= 3, 'favoritos padrão');
  await p.locator('.mb-menu:has-text("Favoritos") > button').click(); await p.locator('[role=menuitem]:has-text("Adicionar tema")').click();
  await p.locator('[data-testid=add-fav] input').first().fill('Sepse'); await p.locator('[data-testid=add-fav] button:has-text("Adicionar tema")').click();
  await p.locator('[data-testid=add-fav] .fechar').click();
  await p.locator('.mb-menu:has-text("Favoritos") > button').click(); await p.locator('[role=menuitem]:has-text("Adicionar estação")').click();
  await p.locator('[data-testid=add-fav] input[type=search]').fill('Apendicite'); await p.locator('[data-testid=add-fav] li:has-text("Apendicite") button').click();
  await p.keyboard.press('Escape');
  assert.equal(await p.locator('[data-testid=fav]').count(), n0 + 2);
  await p.locator('[data-testid=fav][data-ref=Sepse]').dblclick(); await p.waitForSelector('.jan[data-tela=estudo]');
  await p.waitForTimeout(1200);                                              // o salvamento na conta tem 700 ms de atraso
  const salvo = (await srv.q(`select estado from mesa_usuario where usuario_id=$1`, [bia.id])).rows[0].estado;
  assert.ok(salvo.favoritos.some((f) => f.tipo === 'tema' && f.ref === 'Sepse') && salvo.favoritos.some((f) => f.tipo === 'estacao'), 'favoritos salvos na conta');
  const p2 = await abrir(); await p2.waitForSelector('[data-testid=fav][data-ref=Sepse]');           // outro aparelho/sessão lê da conta
  await p2.locator('[data-testid=fav][data-ref=Sepse]').hover(); await p2.locator('[data-testid=fav][data-ref=Sepse] .rm').click();
  assert.equal(await p2.locator('[data-testid=fav][data-ref=Sepse]').count(), 0);
  await p.context().close(); await p2.context().close();
});

await passo('notas rápidas: criar pela barra, editar, fixar, buscar, apagar e salvar na conta', async () => {
  const p = await abrir(); await p.waitForSelector('[data-testid=mesa]');
  await p.locator('[data-testid=nota-rapida]').click(); await p.waitForSelector('.jan[data-tela=notas] [data-testid=nota]');
  await p.locator('[data-testid=nota] textarea').first().fill('Sepse: lactato, hemocultura e antibiótico na 1ª hora');
  await p.locator('[data-testid=nota] .nota-titulo').first().fill('Macete');
  await p.locator('[data-testid=nota] button[title*="Fixar"]').first().click();
  await p.locator('[data-testid=notas] input[type=search]').fill('lactato'); assert.equal(await p.locator('[data-testid=nota]').count(), 1);
  await p.locator('[data-testid=notas] input[type=search]').fill('xyz'); assert.equal(await p.locator('[data-testid=nota]').count(), 0);
  await p.locator('[data-testid=notas] input[type=search]').fill('');
  await p.waitForTimeout(1200);
  const salvo = (await srv.q(`select estado from mesa_usuario where usuario_id=$1`, [bia.id])).rows[0].estado;
  assert.ok(salvo.notas.some((n) => n.titulo === 'Macete' && n.fixada && n.texto.includes('lactato')));
  p.once('dialog', (d) => d.accept()); await p.locator('[data-testid=nota] .apagar').first().click();
  assert.equal(await p.locator('[data-testid=nota]').count(), 0);
  await p.context().close();
});

await passo('notificações: sino com contagem, aviso do sistema, mensagem entre colegas de sala', async () => {
  await srv.q(`insert into notificacoes (usuario_id, tipo, dados) values ($1,'denuncia_recebida','{}')`, [bia.id]);
  const p = await abrir(); await p.waitForSelector('[data-testid=sino]');
  await p.waitForSelector('[data-testid=sino] .pil'); assert.equal((await p.locator('[data-testid=sino] .pil').innerText()).trim(), '1');
  await p.locator('[data-testid=sino]').click(); await p.waitForSelector('.jan[data-tela=notificacoes] [data-testid=central]');
  assert.ok((await p.locator('.central-lista li.nova').count()) >= 1);
  await p.locator('.central button:has-text("Marcar todas")').click(); await p.waitForFunction(() => !document.querySelector('[data-testid=sino] .pil'));
  // colegas: só quem dividiu sala; sem sala em comum a lista fica vazia
  await p.locator('[data-testid=aba-mensagens]').click();
  assert.match(await p.locator('.central-msg').innerText(), /dividir uma sala/);
  await p.context().close();
});

await passo('mesa só em tela larga: no celular continua o menu clássico', async () => {
  const p = await abrir({ w: 390, h: 800 }); await p.waitForSelector('nav.nav');
  assert.equal(await p.locator('[data-testid=mesa]').count(), 0);
  await p.context().close();
});

await nav.close(); await srv.fechar?.();
if (falhas.length) { console.log(`\n${falhas.length} falha(s):`); falhas.forEach((f) => console.log('-', f)); process.exit(1); }
console.log('\nTudo certo'); process.exit(0);
