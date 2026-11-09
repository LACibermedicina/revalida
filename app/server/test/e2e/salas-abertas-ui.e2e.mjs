// E2E das salas abertas: painel, chat, candidato só vê a estação, saída/retorno com pausa automática, inversão pelo candidato e solução de problemas de mídia.
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
writeFileSync(join(saida, 'stub-video8.js'), `export async function criarSalaVideo() { const falha = window.__midia === 'falha';
  return { modo: falha ? 'agora' : 'demo', pode: {}, cameraLigada: () => false, microfoneLigado: () => false, alternarCam: async (l) => (falha ? false : l), alternarMic: async (l) => (falha ? false : l), sincronizar: async () => ({}), sair: async () => {} }; }`);
await esbuild.build({ entryPoints: [join(web, 'src/main.jsx')], bundle: true, outdir: pub, format: 'esm', target: 'es2022', logLevel: 'error', nodePaths: [NPM],
  alias: { 'socket.io-client': join(saida, 'stub-io8.js') }, plugins: [{ name: 'v', setup: (b) => b.onResolve({ filter: /\/video\.js$/ }, () => ({ path: join(saida, 'stub-video8.js') })) }],
  define: { 'process.env.NODE_ENV': '"production"' }, loader: { '.css': 'css' } });
writeFileSync(join(pub, 'index.html'), readFileSync(join(web, 'index.html'), 'utf8')
  .replace('<script type="module" src="/src/main.jsx"', '<script type="module" src="/main.js"').replace('</head>', '<link rel="stylesheet" href="/main.css">\n</head>'));

const srv = await iniciar({ pastaWeb: pub });
const nav = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
const falhas = [];
const passo = async (n, fn) => { try { await fn(); console.log('✔', n); } catch (e) { falhas.push(n); console.log('✘', n, '\n   ', e.message.split('\n')[0]); } };

// estações aprovadas com checklist
const mk = async (titulo, area) => {
  const id = (await srv.q(`insert into estacoes (titulo, area, status, duracao_min, script_ator) values ($1,$2,'aprovada',10,'Paciente colaborativo.') returning id`, [titulo, area])).rows[0].id;
  await srv.q(`insert into pep_itens (estacao_id, secao, ordem, descricao, pontos_total, critico) values
    ($1,'Anamnese',1,'Pergunta o início dos sintomas',1,false), ($1,'Exame',2,'Solicita o exame adequado',2,true), ($1,'Conduta',3,'Prescreve corretamente',1.5,false)`, [id]);
  return id;
};
await mk('Dor torácica na UBS', 'clinica_medica'); await mk('Apendicite aguda', 'cirurgia');

const u = async (email) => (await srv.q(`select id, sessao_versao from usuarios where email=$1`, [email])).rows[0];
const ana = await u('ana@x.com'); const moda = await u('moda@x.com');
const sessao = (x, nome, papel) => ({ token: srv.assinar({ id: x.id, nome, papel_app: papel, sessao_versao: x.sessao_versao }), usuario: { id: x.id, nome, papel_app: papel } });
const nova = async (quem, { w = 1280, h = 800, ...opcoes } = {}) => {
  const c = await nav.newContext({ viewport: { width: w, height: h } });
  await c.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  await c.addInitScript((s) => { if (!localStorage.getItem('rp-auth')) localStorage.setItem('rp-auth', JSON.stringify(s));
    window.__gum = 0; const md = navigator.mediaDevices; if (md) { const o = md.getUserMedia?.bind(md); md.getUserMedia = async (c) => { window.__gum++; if (o) return o(c); throw new DOMException('x', 'NotFoundError'); }; } }, quem);
  if (opcoes.falha) await c.addInitScript(() => { window.__midia = 'falha'; });
  const p = await c.newPage(); p.on('pageerror', (e) => falhas.push(`erro de página: ${e.message}`));
  await p.goto(srv.url); await p.waitForSelector('nav'); await p.waitForTimeout(500);
  await p.locator('nav button:has-text("Ciclos")').click(); await p.waitForSelector('h2:has-text("Salas")');
  return p;
};
const recarregar = async (p) => { await p.reload(); await p.waitForSelector('nav'); await p.locator('nav button:has-text("Ciclos")').click(); await p.waitForSelector('[data-testid="meu-papel"]'); };
const papel = (p) => p.textContent('[data-testid="meu-papel"]');


const reabrir = async (ctx) => { const p = await ctx.newPage(); p.on('pageerror', (e) => falhas.push(`erro de página: ${e.message}`)); await p.goto(srv.url); await p.waitForSelector('nav'); await p.locator('nav button:has-text("Ciclos")').click(); return p; };
let pa; let pm; let codigo;

await passo('Ana cria a sala com nome e prazo; o nome aparece e o prazo pode ser mudado pelo chefe', async () => {
  pa = await nova(sessao(ana, 'Ana Souza', 'usuario'), { falha: true });
  await pa.fill('input[placeholder="ex.: Treino de sábado"]', 'Treino de sábado'); await pa.selectOption('select', '48');
  await pa.locator('button:has-text("Criar sala")').click(); await pa.waitForSelector('[data-testid="meu-papel"]');
  assert.equal(await papel(pa), 'Chefe'); assert.equal((await pa.textContent('[data-testid="nome-sala"]')).trim(), 'Treino de sábado');
  codigo = (await pa.textContent('.sl-cod')).trim();
  await pa.locator('[data-testid="configurar-sala"] summary').click();
  assert.equal(await pa.inputValue('[data-testid="configurar-sala"] select'), '48');
  assert.equal(await pa.evaluate(() => window.__gum), 0, 'sem troca de função, nenhuma sondagem automática');
});

await passo('Moda vê a sala no painel de salas abertas e entra por ele como observador', async () => {
  pm = await nova(sessao(moda, 'Moda Dora', 'moderador'));
  const card = pm.locator('[data-testid="sala-aberta"]:has-text("Treino de sábado")'); await card.waitFor();
  const t = await card.textContent(); assert.match(t, /1 pessoa/); assert.match(t, /chefe: Ana Souza/);
  await card.locator('button:has-text("Entrar")').click(); await pm.waitForSelector('[data-testid="meu-papel"]');
  assert.equal(await papel(pm), 'Observador');
});

await passo('chat interno: o que Moda escreve chega ao chefe', async () => {
  await pm.fill('input[aria-label="Mensagem"]', 'Olá, chefe!'); await pm.locator('[data-testid="chat-sala"] button:has-text("Enviar")').click();
  await pm.locator('[data-testid="chat-sala"] :text("Olá, chefe!")').first().waitFor();
  await pa.locator('[data-testid="chat-sala"] :text("Olá, chefe!")').first().waitFor({ timeout: 20000 });
});

await passo('só no ciclo criado DENTRO da sala; Moda vira candidata e a estação começa', async () => {
  await pa.locator('#sl-participantes .sl-linha:has-text("Moda") button:has-text("Candidato")').click();
  await pa.waitForFunction(() => /Candidato/.test(document.querySelector('#sl-participantes')?.textContent ?? '') && !document.querySelector('[aria-label="Ciclos pausados"]'));
  await pa.locator('label.sl-op:has-text("Dor torácica")').locator('input').check();
  await pa.locator('button:has-text("Criar ciclo com 1")').click();
  await pa.locator('[data-estado="pendente"]:has-text("Dor torácica") button:has-text("Iniciar")').click();
  await pa.waitForSelector('[aria-label="Estação em andamento"]');
});

await passo('candidato em estação vê SÓ a estação: sem gestão, participantes, chat, fila nem sair; mantém câmera e microfone', async () => {
  await pm.reload(); await pm.waitForSelector('nav'); await pm.locator('nav button:has-text("Ciclos")').click(); await pm.waitForSelector('[aria-label="Estação em andamento"]');
  assert.equal(await papel(pm), 'Candidato');
  for (const alvo of ['#sl-participantes', '[data-testid="chat-sala"]', '[aria-label="Fila do ciclo"]', '.sl-sair', '[data-testid="configurar-sala"]', '[data-testid="opcao-apoio"]']) assert.equal(await pm.locator(alvo).count(), 0, `oculto para o candidato: ${alvo}`);
  assert.equal(await pm.locator('[data-testid="botao-camera"]').count(), 1); assert.equal(await pm.locator('[data-testid="botao-mic"]').count(), 1);
  assert.equal(await pm.locator('button:has-text("Entrar no vídeo")').count(), 0, 'um só botão por aparelho');
  await pa.waitForSelector('#sl-participantes'); assert.equal(await pa.locator('[data-testid="chat-sala"]').count(), 1, 'o chefe segue com tudo');
});

await passo('o candidato fecha o app: a estação pausa; ao voltar (mesmo navegador) segue sozinha na mesma estação', async () => {
  const ctx = pm.context(); await pm.close();
  await srv.q('select rv_sala_sair($1,$2)', [codigo, moda.id]);        // o servidor perdeu a conexão dela
  await pa.locator('[data-testid="pausa-aviso"]').waitFor({ timeout: 20000 });
  assert.equal(await pa.locator('[aria-label="Estação em andamento"]').count(), 0);
  pm = await reabrir(ctx);
  await pm.waitForSelector('[aria-label="Estação em andamento"]', { timeout: 20000 });
  assert.equal(await papel(pm), 'Candidato');
  await pa.waitForSelector('[aria-label="Estação em andamento"]', { timeout: 20000 });
  assert.equal(await pa.locator('[data-testid="pausa-aviso"]').count(), 0);
  assert.equal((await srv.q(`select count(*)::int n from execucoes where estado = 'em_andamento'`)).rows[0].n, 1, 'a MESMA execução continua (não abriu outra)');
});

await passo('fim da estação: o candidato atual inverte os papéis; a opção passa a quem ficou candidato', async () => {
  const exe = (await srv.q('select id from execucoes order by iniciada_em desc limit 1')).rows[0].id;
  await srv.q(`select rv_execucao_finalizar($1,$2,10,'{}'::jsonb)`, [exe, ana.id]);
  const btn = pm.locator('[data-testid="inverter-candidato"]'); await btn.waitFor({ timeout: 20000 });
  await btn.click();
  await pm.waitForFunction(() => document.querySelector('[data-testid="meu-papel"]')?.textContent === 'Chefe', null, { timeout: 20000 });
  await pa.waitForFunction(() => document.querySelector('[data-testid="meu-papel"]')?.textContent === 'Candidato', null, { timeout: 20000 });
});

await passo('depois da inversão: UMA verificação automática de mídia; só quem tem função e mídia desconectada vê "solucionar problemas"', async () => {
  await pa.waitForFunction(() => window.__gum >= 1, null, { timeout: 20000 });
  const n = await pa.evaluate(() => window.__gum); await pa.waitForTimeout(3000);
  assert.equal(await pa.evaluate(() => window.__gum), n, 'a verificação não se repete sozinha');
  const botao = pa.locator('[data-testid="solucionar"] .sl-discreto'); await botao.waitFor();
  assert.equal(await pm.locator('[data-testid="solucionar"]').count(), 0, 'mídia conectada (modo demonstração): o botão nem existe');
  await pa.locator('[data-testid="midia-problema"]').first().waitFor();            // o navegador de teste não tem câmera: o diagnóstico explica
  assert.match(await pa.textContent('[data-testid="solucionar"]'), /câmera|microfone/i);
  await pa.screenshot({ path: join(saida, 'sala-solucionar.png') });
});

await nav.close(); srv.fechar();
console.log(falhas.length ? `\n${falhas.length} falha(s)` : '\nTodos os passos passaram.');
process.exit(falhas.length ? 1 : 0);
