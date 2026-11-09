// E2E: prática solo com IA, cartas RPG com paginação, podcast/playlist e rádio Revalida (pool de exportação).
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
const saida = process.env.SAIDA || join(aqui, 'capturas'); const pub = join(saida, 'pubv');
mkdirSync(pub, { recursive: true });
writeFileSync(join(saida, 'stub-iov.js'), 'export const io = () => ({ emit() {}, on() {}, disconnect() {} });');
writeFileSync(join(saida, 'stub-videov.js'), "export async function criarSalaVideo() { return { modo: 'demo', pode: {}, alternarCam: async (l) => l, alternarMic: async (l) => l, sincronizar: async () => {}, sair: async () => {}, aoMudar() {}, aoRemoto() {} }; }");
await esbuild.build({ entryPoints: [join(web, 'src/main.jsx')], bundle: true, outdir: pub, format: 'esm', target: 'es2022', logLevel: 'error', nodePaths: [NPM],
  alias: { 'socket.io-client': join(saida, 'stub-iov.js') }, plugins: [{ name: 'v', setup: (b) => b.onResolve({ filter: /\/video\.js$/ }, () => ({ path: join(saida, 'stub-videov.js') })) }],
  define: { 'process.env.NODE_ENV': '"production"' }, loader: { '.css': 'css' } });
writeFileSync(join(pub, 'index.html'), readFileSync(join(web, 'index.html'), 'utf8')
  .replace('<script type="module" src="/src/main.jsx"', '<script type="module" src="/main.js"').replace('</head>', '<link rel="stylesheet" href="/main.css">\n</head>'));

cpSync(join(web, 'public'), pub, { recursive: true });
const srv = await iniciar({ pastaWeb: pub });
const nav = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
const falhas = [];
const passo = async (n, fn) => { try { await fn(); console.log('✔', n); } catch (e) { falhas.push(n); if (process.env.DBG) console.log('   TELA:', ((await globalThis.__p?.textContent('body').catch(()=>''))||'').replace(/\s+/g,' ').slice(0,600)); console.log('✘', n, '\n   ', e.message.split('\n')[0]); } };


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


const SAIDA = join(saida, 'vis'); mkdirSync(SAIDA, { recursive: true });
const foto = async (p, nome) => { if (/inicio|celular/.test(nome)) { await p.waitForSelector('[data-testid=painel] .pn-topo'); await p.waitForTimeout(3500); } else await p.waitForTimeout(1800); await p.screenshot({ path: join(SAIDA, nome + '.png') }); console.log('📷', nome); };
{ const c = await nav.newContext({ viewport: { width: 1280, height: 860 } }); await c.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  const p = await c.newPage(); await p.goto(srv.url + '/'); await p.waitForSelector('.mascote3d'); await foto(p, '1-login'); await c.close(); }
for (const [rot, nome, esc] of [['Início','2-inicio'],['Estações','3-estacoes'],['Praticar com IA','4-solo'],['Podcast','5-podcast'],['Estudo','6-estudo']]) {
  const p = await abrir({ w: 1280, h: 860 }); if (rot !== 'Início') await ir(p, rot); await foto(p, nome); await p.context().close(); }
{ const c = await nav.newContext({ viewport: { width: 1280, height: 860 }, colorScheme: 'dark' }); await c.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  await c.addInitScript((s) => localStorage.setItem('rp-auth', JSON.stringify(s)), sessao(bia)); const p = await c.newPage(); await p.goto(srv.url + '/'); await foto(p, '7-inicio-escuro'); await c.close(); }
{ const p = await abrir({ w: 390, h: 800 }); await foto(p, '8-celular'); await p.context().close(); }
await nav.close(); srv.fechar();
