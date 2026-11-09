// E2E de convites a usuários online, abandono da vaga de candidato e cancelamento de estação (web e desktop).
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
const saida = process.env.SAIDA || join(aqui, 'capturas'); const pub = join(saida, 'pub10');
mkdirSync(pub, { recursive: true });
writeFileSync(join(saida, 'stub-io10.js'), 'export const io = () => ({ emit() {}, on() {}, disconnect() {} });');
writeFileSync(join(saida, 'stub-video10.js'), "export async function criarSalaVideo() { return { modo: 'demo', pode: {}, alternarCam: async (l) => l, alternarMic: async (l) => l, sincronizar: async () => ({}), sair() {} }; }");
await esbuild.build({ entryPoints: [join(web, 'src/main.jsx')], bundle: true, outdir: pub, format: 'esm', target: 'es2022', logLevel: 'error', nodePaths: [NPM],
  alias: { 'socket.io-client': join(saida, 'stub-io10.js') }, plugins: [{ name: 'v', setup: (b) => b.onResolve({ filter: /\/video\.js$/ }, () => ({ path: join(saida, 'stub-video10.js') })) }],
  define: { 'process.env.NODE_ENV': '"production"' }, loader: { '.css': 'css' } });
writeFileSync(join(pub, 'index.html'), readFileSync(join(web, 'index.html'), 'utf8')
  .replace('<script type="module" src="/src/main.jsx"', '<script type="module" src="/main.js"').replace('</head>', '<link rel="stylesheet" href="/main.css">\n</head>'));

const srv = await iniciar({ pastaWeb: pub });
const nav = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
const falhas = [];
const passo = async (n, fn) => { try { await fn(); console.log('✔', n); } catch (e) { falhas.push(n); console.log('✘', n, '\n   ', e.message.split('\n')[0]); } };

// estação aprovada com checklist
const estId = (await srv.q(`insert into estacoes (titulo, area, status, duracao_min, script_ator) values ('Dor torácica na UBS','clinica_medica','aprovada',10,'Paciente colaborativo.') returning id`)).rows[0].id;
await srv.q(`insert into pep_itens (estacao_id, secao, ordem, descricao, pontos_total, critico) values ($1,'Anamnese',1,'Pergunta o início dos sintomas',1,false), ($1,'Conduta',2,'Prescreve corretamente',2,true)`, [estId]);
const novoUsuario = async (nome) => (await srv.q(`insert into usuarios (nome, email, senha_hash) values ($1,$2,'x') returning id, sessao_versao`, [nome, `${nome.toLowerCase()}@x.com`])).rows[0];
const u = async (email) => (await srv.q(`select id, sessao_versao from usuarios where email=$1`, [email])).rows[0];
const ana = await u('ana@x.com'); const moda = await u('moda@x.com'); const caio = await novoUsuario('Caio'); const dani = await novoUsuario('Dani');
const sessao = (x, nome, papel = 'usuario') => ({ token: srv.assinar({ id: x.id, nome, papel_app: papel, sessao_versao: x.sessao_versao }), usuario: { id: x.id, nome, papel_app: papel } });
const nova = async (quem, { w = 1280, h = 800, aba = 'Ciclos' } = {}) => {
  const c = await nav.newContext({ viewport: { width: w, height: h } });
  await c.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  await c.addInitScript((s) => localStorage.setItem('rp-auth', JSON.stringify(s)), quem);
  const p = await c.newPage(); p.on('pageerror', (e) => falhas.push(`erro de página: ${e.message}`));
  await p.goto(srv.url); await p.waitForSelector('nav'); await p.waitForTimeout(500);
  if (aba) { await p.locator(`nav button:has-text("${aba}")`).click(); }
  return p;
};
const papel = (p) => p.textContent('[data-testid="meu-papel"]');
const T = { timeout: 25000 };

let pa; let pm; let pc; let pd; let codigo;
await passo('Ana abre a sala, Moda entra e vira candidata; Ana monta o ciclo', async () => {
  pa = await nova(sessao(ana, 'Ana Souza'));
  await pa.locator('button:has-text("Criar sala")').click(); await pa.waitForSelector('[data-testid="meu-papel"]');
  codigo = (await pa.textContent('.sl-cod')).trim();
  pm = await nova(sessao(moda, 'Moda Dora', 'moderador'));
  await pm.fill('input[placeholder="cole o código aqui"]', codigo); await pm.locator('button:has-text("Entrar na sala")').click(); await pm.waitForSelector('[data-testid="meu-papel"]');
  await pa.waitForSelector('.sl-linha:has-text("Moda Dora") button:has-text("Candidato")', T);
  await pa.locator('.sl-linha:has-text("Moda Dora") button:has-text("Candidato")').click();
  await pa.locator('.sl-sel input[type=checkbox]').first().check(); await pa.locator('button:has-text("Criar ciclo")').click();
  await pa.waitForSelector('[aria-label="Fila do ciclo"]');
});

await passo('Ana convida quem está online; o convidado vê o convite e só pode ser observador (já há candidato)', async () => {
  pc = await nova(sessao(caio, 'Caio'), { aba: null }); await pc.waitForTimeout(800);
  await pa.locator('button:has-text("Convidar pessoas online")').click();
  await pa.waitForSelector('.sl-conv-lista li:has-text("Caio")', T);
  assert.equal(await pa.locator('.sl-conv-lista li:has-text("Moda Dora")').count(), 0, 'quem já está na sala não aparece');
  await pa.locator('.sl-conv-lista li:has-text("Caio") button:has-text("Convidar")').click();
  await pa.waitForSelector('.sl-conv-pend li:has-text("Caio")', T);
  await pc.waitForSelector('[data-testid="convites-recebidos"]', T);
  assert.match(await pc.textContent('[data-testid="convites-recebidos"]'), /Ana Souza convidou você/);
  assert.equal(await pc.locator('[data-testid="convites-recebidos"] button:has-text("Entrar como candidato")').isDisabled(), true);
  await pc.screenshot({ path: join(saida, 'convite-recebido.png') });
  await pc.locator('[data-testid="convites-recebidos"] button:has-text("Entrar como observador")').click();
  await pc.waitForSelector('[data-testid="meu-papel"]', T); assert.equal(await papel(pc), 'Observador');
});

await passo('candidato abandona a estação: vira observador, não conta como feita e não gera feedback', async () => {
  await pa.locator('[aria-label="Fila do ciclo"] button:has-text("Iniciar")').click();
  await pa.waitForSelector('[aria-label="Estação em andamento"]');
  await pm.waitForSelector('[aria-label="Estação em andamento"]', T);
  assert.equal(await pc.locator('[data-testid="cancelar-estacao"]').count(), 0, 'observador não cancela');
  await pm.locator('[data-testid="cancelar-estacao"] button:has-text("Abandonar")').click();
  await pm.screenshot({ path: join(saida, 'abandonar-confirmar.png') });
  await pm.locator('button:has-text("Sim, abandonar")').click();
  await pm.waitForFunction(() => document.querySelector('[data-testid="meu-papel"]')?.textContent === 'Observador', null, T);
  await pa.waitForFunction(() => !document.querySelector('[aria-label="Estação em andamento"]'), null, T);
  assert.equal(await pa.locator('[data-testid="fim-estacao"]').count(), 0, 'nada de "estação finalizada" nem de análise');
  const ex = (await srv.q(`select estado, cancelada_motivo, nota from execucoes order by iniciada_em desc limit 1`)).rows[0];
  assert.deepEqual([ex.estado, ex.cancelada_motivo, ex.nota], ['abandonada', 'candidato', null]);
  assert.equal((await srv.q('select count(*)::int n from usuario_estacao')).rows[0].n, 0);
  assert.match(await pa.textContent('[aria-label="Fila do ciclo"]'), /pendente/, 'a estação volta como pendente: pode ser refeita');
});

await passo('com a vaga livre, o convidado pode entrar como candidato; o avaliador cancela e a pessoa vira observador', async () => {
  pd = await nova(sessao(dani, 'Dani'), { aba: null }); await pd.waitForTimeout(800);
  await pa.waitForSelector('.sl-conv-lista li:has-text("Dani")', T);
  await pa.locator('.sl-conv-lista li:has-text("Dani") button:has-text("Convidar")').click();
  await pd.waitForSelector('[data-testid="convites-recebidos"]', T);
  assert.equal(await pd.locator('[data-testid="convites-recebidos"] button:has-text("Entrar como candidato")').isEnabled(), true);
  await pd.locator('[data-testid="convites-recebidos"] button:has-text("Entrar como candidato")').click();
  await pd.waitForSelector('[data-testid="meu-papel"]', T); assert.equal(await papel(pd), 'Candidato');
  await pa.locator('[aria-label="Fila do ciclo"] button:has-text("Iniciar")').click({ timeout: 25000 });
  await pa.waitForSelector('[aria-label="Estação em andamento"]');
  await pa.locator('[data-testid="cancelar-estacao"] button:has-text("Cancelar estação")').click();
  await pa.locator('[role="alertdialog"] input[type=checkbox]').check();
  await pa.screenshot({ path: join(saida, 'cancelar-confirmar.png') });
  await pa.locator('button:has-text("Sim, cancelar")').click();
  await pd.waitForFunction(() => document.querySelector('[data-testid="meu-papel"]')?.textContent === 'Observador', null, T);
  const ex = (await srv.q(`select estado, cancelada_motivo from execucoes order by iniciada_em desc limit 1`)).rows[0];
  assert.deepEqual([ex.estado, ex.cancelada_motivo], ['abandonada', 'administrador']);
  assert.equal((await srv.q(`select count(*)::int n from execucoes where estado='finalizada'`)).rows[0].n, 0);
});

await nav.close(); srv.fechar();
console.log(falhas.length ? `\n${falhas.length} falha(s)` : '\nTodos os passos passaram.');
process.exit(falhas.length ? 1 : 0);
