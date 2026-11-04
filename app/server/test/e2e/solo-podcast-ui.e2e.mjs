// E2E: prática solo com IA, cartas RPG com paginação, podcast/playlist e rádio Revalida (pool de exportação).
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
const saida = process.env.SAIDA || join(aqui, 'capturas'); const pub = join(saida, 'pub11');
mkdirSync(pub, { recursive: true });
writeFileSync(join(saida, 'stub-io11.js'), 'export const io = () => ({ emit() {}, on() {}, disconnect() {} });');
writeFileSync(join(saida, 'stub-video11.js'), "export async function criarSalaVideo() { return { modo: 'demo', pode: {}, alternarCam: async (l) => l, alternarMic: async (l) => l, sincronizar: async () => {}, sair: async () => {}, aoMudar() {}, aoRemoto() {} }; }");
await esbuild.build({ entryPoints: [join(web, 'src/main.jsx')], bundle: true, outdir: pub, format: 'esm', target: 'es2022', logLevel: 'error', nodePaths: [NPM],
  alias: { 'socket.io-client': join(saida, 'stub-io11.js') }, plugins: [{ name: 'v', setup: (b) => b.onResolve({ filter: /\/video\.js$/ }, () => ({ path: join(saida, 'stub-video11.js') })) }],
  define: { 'process.env.NODE_ENV': '"production"' }, loader: { '.css': 'css' } });
writeFileSync(join(pub, 'index.html'), readFileSync(join(web, 'index.html'), 'utf8')
  .replace('<script type="module" src="/src/main.jsx"', '<script type="module" src="/main.js"').replace('</head>', '<link rel="stylesheet" href="/main.css">\n</head>'));

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

await passo('logomarca nova no cabeçalho (SVG facetado, sem o ✚ antigo)', async () => {
  const p = await abrir(); await p.waitForSelector('svg.logo');
  assert.ok(await p.locator('svg.logo polygon').count() >= 12);
  assert.ok(!(await p.locator('.marca').first().textContent()).includes('✚'));
  await p.context().close();
});

await passo('solo: padrões médio/15 itens, sorteio de tema e início da prática', async () => {
  const p = await abrir(); await ir(p, 'Praticar com IA'); await p.waitForSelector('[data-testid=tela-solo]');
  assert.equal(await p.locator('[data-testid=solo-dif-medio]').getAttribute('aria-pressed'), 'true');
  await p.waitForSelector('[data-testid=solo-tema]', { timeout: 8000 });
  await p.click('[data-testid=solo-iniciar]');
  await p.waitForSelector('[data-testid=solo-pronta]', { timeout: 15000 });
  const ia = srv.ia.chamadas.filter((c) => c[0] === 'gerar').at(-1)[1];
  assert.ok(JSON.stringify(ia).includes('exatamente 15 itens'), 'pediu 15 itens');
  await p.context().close();
});

await passo('cartas: carta RPG e lista paginada de 10 em 10 por área', async () => {
  const t = (await srv.q(`insert into temas (nome, nome_norm, area) values ('Sepse','sepse','clinica_medica') returning id`)).rows[0].id;
  for (let i = 1; i <= 23; i++) await srv.q(`insert into cartoes (tema_id, frente, verso, origem) values ($1,$2,'Resposta','manual')`, [t, `Pergunta ${i}`]);
  const p = await abrir(); globalThis.__p = p; await ir(p, 'Estudo');
  await p.getByRole('button', { name: 'Cartões', exact: true }).first().click();
  await p.locator('button:has-text("Todos os cartões")').first().click();
  await p.waitForSelector('[data-testid=cartao-lista]', { timeout: 8000 });
  assert.equal(await p.locator('[data-testid=cartao-lista]').count(), 10, 'primeira página: 10 cartões');
  await p.waitForSelector('[data-testid=carta-rpg]');
  await p.locator('[data-testid=paginacao] button').last().click();
  await p.waitForFunction(() => /2\s*\/\s*3|2 de 3|página 2/i.test(document.querySelector('[data-testid=pagina-info]')?.textContent ?? ''), null, { timeout: 8000 });
  await p.locator('[data-testid=paginacao] button').last().click();
  await p.waitForFunction(() => document.querySelectorAll('[data-testid=cartao-lista]').length === 3, null, { timeout: 8000 });
  await p.context().close();
});

await passo('paciente IA: estação aleatória do banco, conversa pelo script, correção da IA, script para estudo e registro', async () => {
  const e = (await srv.q(`insert into estacoes (titulo, area, status, duracao_min, script_ator, instrucoes_candidato, cenario) values ('Asma no adulto','clinica_medica','aprovada',10,'Paciente de 30 anos com falta de ar há dois dias, tosse seca à noite. Nega tabagismo.','Atenda o paciente.','UBS.') returning id`)).rows[0].id;
  await srv.q(`insert into pep_itens (estacao_id, secao, ordem, descricao, pontos_total, critico) values ($1,'Anamnese',1,'Pergunta o início dos sintomas',1,false), ($1,'Conduta',2,'Prescreve broncodilatador',2,true)`, [e]);
  await srv.q(`update estacoes set status='rascunho' where titulo <> 'Asma no adulto' and script_ator = 'x'`);
  const p = await abrir(); globalThis.__p = p; await ir(p, 'Praticar com IA'); await p.waitForSelector('[data-testid=solo-banco]');
  await p.click('[data-testid=solo-banco]'); await p.waitForSelector('[data-testid=pratica-ia]', { timeout: 15000 });
  assert.match(await p.textContent('[data-testid=pratica-ia]'), /Asma no adulto/);
  assert.ok(await p.locator('[data-testid=pia-tempo]').isVisible());
  await p.fill('[data-testid=pia-texto]', 'Há quanto tempo o senhor sente falta de ar?'); await p.click('[data-testid=pia-enviar]');
  await p.waitForSelector('[data-testid=msg-paciente]:has-text("dois dias")');
  assert.ok(!(await p.textContent('body')).includes('Nega tabagismo'), 'o script não aparece durante a estação');
  p.once('dialog', (d) => d.accept()); await p.click('[data-testid=pia-corrigir]');
  await p.waitForSelector('[data-testid=pia-nota]', { timeout: 20000 }); await p.waitForSelector('[data-testid=script-estudo]');
  assert.match(await p.textContent('[data-testid=script-estudo]'), /Nega tabagismo/);
  assert.match(await p.textContent('[data-testid=pratica-ia-resultado]'), /Paciente IA/);
  await p.click('[data-testid=pia-outra]'); await p.waitForSelector('[data-testid=historico-item][data-modalidade=solo_ia]');
  const h = await p.textContent('[data-testid=historico-estacoes]'); assert.match(h, /feita com IA/); assert.match(h, /Paciente IA/); assert.match(h, /você \(candidato\)/);
  await p.context().close();
});

await passo('podcast: cria playlist, gera episódio (roteiro), link privado, aba rádio e exportação ao pool', async () => {
  const p = await abrir(); globalThis.__p = p; await ir(p, 'Podcast');
  await p.waitForSelector('text=Podcast e Rádio Revalida');
  await p.fill('input[placeholder^="Ex.: Urgências"]', 'Plantão da semana');
  await p.click('button:has-text("Criar playlist")');
  await p.waitForSelector('h3:has-text("Plantão da semana")');
  await p.fill('input[placeholder^="Ex.: Pré-eclâmpsia"]', 'Pré-eclâmpsia');
  await p.click('button:has-text("Gerar episódio")');
  await p.waitForSelector('button[aria-label^="Tocar"]:not([disabled])', { timeout: 20000 });
  p.on('dialog', (d) => d.accept());
  await p.click('button:has-text("Gerar link privado")');
  await p.waitForSelector('.pc-feed code'); assert.match(await p.textContent('.pc-feed code'), /^https?:\/\//);
  await p.click('[role=tab]:has-text("Rádio Revalida")'); await p.waitForSelector('text=radia.m3d.pro/revalida');
  await p.click('[role=tab]:has-text("Exportar para a rádio")'); await p.waitForSelector('[placeholder="Buscar tema…"]');
  await p.context().close();
});

await nav.close(); srv.fechar();
console.log(falhas.length ? `\n${falhas.length} falha(s)` : '\nTudo certo');
process.exit(falhas.length ? 1 : 0);
