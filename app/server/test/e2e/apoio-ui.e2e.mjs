// E2E do apoio cognitivo (grafo da conduta 2D/3D) durante a estação: candidato com voz falsa e avaliador em navegadores separados.
// Reconhecimento de voz FALSO (o teste "fala" por ele); servidor com rotas REAIS de salas/execução/estudo + Postgres real; IA falsa passando pela validação real.
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
const saida = process.env.SAIDA || join(aqui, 'capturas'); const pub = join(saida, 'pub9');
mkdirSync(pub, { recursive: true });
writeFileSync(join(saida, 'stub-io9.js'), 'export const io = () => ({ emit() {}, on() {}, disconnect() {} });');
writeFileSync(join(saida, 'stub-video9.js'), "export async function criarSalaVideo() { return { modo: 'demo', pode: {}, alternarCam: async (l) => l, alternarMic: async (l) => l, sincronizar: async () => ({}), sair() {} }; }");
await esbuild.build({ entryPoints: [join(web, 'src/main.jsx')], bundle: true, outdir: pub, format: 'esm', target: 'es2022', logLevel: 'error', nodePaths: [NPM],
  alias: { 'socket.io-client': join(saida, 'stub-io9.js') }, plugins: [{ name: 'v', setup: (b) => b.onResolve({ filter: /\/video\.js$/ }, () => ({ path: join(saida, 'stub-video9.js') })) }],
  define: { 'process.env.NODE_ENV': '"production"' }, loader: { '.css': 'css' } });
writeFileSync(join(pub, 'index.html'), readFileSync(join(web, 'index.html'), 'utf8')
  .replace('<script type="module" src="/src/main.jsx"', '<script type="module" src="/main.js"').replace('</head>', '<link rel="stylesheet" href="/main.css">\n</head>'));

const srv = await iniciar({ pastaWeb: pub });
const nav = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
const falhas = [];
const passo = async (n, fn) => { try { await fn(); console.log('✔', n); } catch (e) { falhas.push(n); console.log('✘', n, '\n   ', process.env.DEBUG_UI ? e.message : e.message.split('\n').slice(0,4).join(' | ')); } };

const u = async (email) => (await srv.q(`select id, sessao_versao from usuarios where email=$1`, [email])).rows[0];
const ana = await u('ana@x.com'); const moda = await u('moda@x.com');
const sessao = (x, nome, papel) => ({ token: srv.assinar({ id: x.id, nome, papel_app: papel, sessao_versao: x.sessao_versao }), usuario: { id: x.id, nome, papel_app: papel } });
const sAna = sessao(ana, 'Ana Souza', 'usuario'); const sModa = sessao(moda, 'Moda Dora', 'moderador');
const chamar = async (s, metodo, caminho, corpo) => {
  const r = await fetch(srv.url + caminho, { method: metodo, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${s.token}` }, body: corpo ? JSON.stringify(corpo) : undefined });
  return { status: r.status, corpo: await r.json().catch(() => ({})) };
};

await srv.q(`insert into diretrizes (titulo, fonte, area, texto, categoria, obrigatoria) values ('PCDT Asma','Ministério da Saúde','clinica_medica',$1,'ministerio',true)`, ['Asma: conduta inicial com beta-2 agonista inalatório de curta duração, avaliação de gravidade e orientação de retorno. '.repeat(2)]);
// estação aprovada: folha do candidato, cenário, checklist com critério e duas cartas sob demanda
const est = (await srv.q(`insert into estacoes (titulo, area, status, duracao_min, instrucoes_candidato, cenario, script_ator, diagnostico_alvo, conceitos)
  values ('Asma agudizada na UBS','clinica_medica','aprovada',10,'Você atende uma paciente de 45 anos com falta de ar. Realize a anamnese, solicite os exames necessários e oriente a paciente.','Unidade básica de saúde, consultório.','Maria, 45 anos, costureira.','Asma agudizada','["Asma","Tabagismo"]') returning id`)).rows[0].id;
const pep = [['Anamnese', 'Pergunta o início da falta de ar e a tosse', false, 1], ['Anamnese', 'Investiga tabagismo e uso de inalador', false, 1], ['Conduta', 'Prescreve salbutamol inalatório', true, 2], ['Conduta', 'Orienta sinais de alarme e retorno', false, 1]];
for (const [i, [secao, d, c, p]] of pep.entries()) await srv.q(`insert into pep_itens (estacao_id, secao, ordem, descricao, criterio, pontos_total, critico) values ($1,$2,$3,$4,'Adequado: realiza; parcial: em parte',$5,$6)`, [est, secao, i, d, p, c]);
await srv.q(`insert into estacao_materiais (estacao_id, ordem, tipo, titulo, conteudo, gatilho) values ($1,0,'laboratorial','Gasometria arterial','pH 7,38; pCO2 41','solicitar gasometria'), ($1,1,'imagem','Radiografia de tórax','Hiperinsuflação pulmonar','solicitar raio-x')`, [est]);

// sala pronta pelo servidor: Ana chefe e avaliadora, Moda candidata, estação em andamento
const sala = (await chamar(sAna, 'POST', '/api/salas')).corpo.id;
await chamar(sAna, 'POST', `/api/salas/${sala}/entrar`); await chamar(sModa, 'POST', `/api/salas/${sala}/entrar`);
await chamar(sAna, 'PATCH', `/api/salas/${sala}/candidato`, { usuario_id: moda.id });
const ciclo = (await chamar(sAna, 'POST', `/api/salas/${sala}/ciclos`, { estacoes: [est] })).corpo; const cid = ciclo.id ?? ciclo;
assert.equal((await chamar(sAna, 'POST', `/api/ciclos/${cid}/execucoes`, {})).status, 200);
const execId = (await srv.q(`select id from execucoes where sala_id=$1 and estado='em_andamento'`, [sala])).rows[0].id;

const SPEECH = () => {
  window.SpeechRecognition = window.webkitSpeechRecognition = class { constructor() { window.__rec = this; } start() { window.__recIniciou = (window.__recIniciou || 0) + 1; } stop() { window.__recParou = true; } };
  window.__falar = (t, final = true) => window.__rec.onresult({ resultIndex: 0, results: [Object.assign([{ transcript: t }], { isFinal: final })] });
};
const abrir = async (s, { w = 1280, h = 900, voz = false } = {}) => {
  const c = await nav.newContext({ viewport: { width: w, height: h } });
  await c.addInitScript(() => { try { localStorage.setItem('rv_shell', 'classico'); } catch { /* sem storage */ } });   // estes testes cobrem o menu clássico; a mesa tem mesa.e2e.mjs
  await c.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  await c.addInitScript(([a, id]) => { localStorage.setItem('rv_shell', 'classico'); localStorage.setItem('rp-auth', JSON.stringify(a)); sessionStorage.setItem('rv_sala', id); }, [s, sala]);
  if (voz) await c.addInitScript(SPEECH);
  const p = await c.newPage(); p.on('pageerror', (e) => falhas.push(`erro de página: ${e.message}`));
  await p.goto(srv.url); await p.waitForSelector('nav'); await p.waitForTimeout(400);
  await p.locator('nav button:has-text("Ciclos")').click(); await p.waitForSelector('[data-testid="meu-papel"]');
  return p;
};

let pm; let pa;
pm = await abrir(sModa, { voz: true }); pa = await abrir(sAna);
await pm.waitForSelector('[data-carta="descricao"]');

await passo('apoio cognitivo: só o candidato recebe a oferta; o grafo nasce da fala, vira 3D, move, redimensiona e não revela o checklist', async () => {
  assert.equal(await pm.locator('[data-testid="apoio-oferta"]').count(), 1, 'o candidato vê a possibilidade');
  assert.equal(await pa.locator('[data-testid="apoio-oferta"]').count(), 0, 'o avaliador não vê');
  assert.equal(await pa.locator('[data-testid="ferramenta-conduta"]').count(), 0);
  assert.equal(await pm.locator('[data-testid="ferramenta-conduta"]').count(), 1, 'ícone na barra de ferramentas');
  assert.equal(await pm.locator('[data-testid="apoio-cognitivo"]').count(), 0, 'é opcional: não abre sozinho');
  await pm.locator('[data-testid="abrir-apoio"]').click(); await pm.waitForSelector('[data-testid="apoio-cognitivo"]');
  assert.equal(await pm.locator('[data-testid="apoio-vazio"]').count(), 1, 'sem achados ainda');
  await pm.locator('button:has-text("Iniciar transcrição")').click();
  await pm.waitForFunction(() => document.querySelector('[data-testid="transcricao-candidato"]')?.dataset.estado === 'ouvindo');
  await pm.evaluate(() => window.__falar('Colisão de moto, paciente hipotenso, com murmúrio vesicular abolido e desvio de traqueia.'));
  await pm.waitForSelector('[data-testid="apoio-2d"] .ap-n.hy.top');
  assert.match(await pm.textContent('[data-testid="apoio-resumo"]'), /Trauma/);
  assert.ok(await pm.locator('[data-testid="apoio-2d"] .ap-n.fd').count() >= 2, 'achados detectados na fala viram nós');
  await pm.evaluate(() => window.__falar('Bom dia, meu nome é Lucas, sou médico. Mantenho via aérea com colar cervical e faço a ausculta.'));
  await pm.waitForSelector('[data-testid="apoio-2d"] .ap-n.done');
  await pm.locator('[data-testid="apoio-cognitivo"] summary').click();
  await pm.fill('[data-testid="apoio-notas"]', 'FAST negativo, hemodinamicamente estável');
  await pm.waitForSelector('[data-testid="apoio-2d"] .ap-n.dis');
  const feitos = await pm.locator('[data-testid="apoio-2d"] .ap-n.done').count();
  await pm.locator('[data-testid="apoio-2d"] .ap-n.hy.top').first().click();
  await pm.waitForSelector('[data-testid="apoio-detalhe"]');
  await pm.screenshot({ path: join(saida, 'apoio-2d.png') });
  // 3D
  await pm.locator('[data-testid="apoio-modo-3d"]').click(); await pm.waitForSelector('[data-testid="apoio-3d"]');
  assert.equal(await pm.locator('[data-testid="apoio-2d"]').count(), 0);
  await pm.waitForTimeout(500);
  const pintou = await pm.evaluate(() => { const c = document.querySelector('[data-testid="apoio-3d"]'); const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 0) n++; return n; });
  assert.ok(pintou > 500, `o canvas 3D foi desenhado (${pintou} pixels)`);
  await pm.screenshot({ path: join(saida, 'apoio-3d.png') });
  assert.equal(await pm.evaluate(() => localStorage.getItem('rv_apoio_modo')), '"3d"', 'a escolha 2D/3D fica guardada');
  await pm.locator('[data-testid="apoio-modo-2d"]').click(); await pm.waitForSelector('[data-testid="apoio-2d"]');
  assert.equal(await pm.locator('[data-testid="apoio-2d"] .ap-n.done').count(), feitos, 'o grafo continua o mesmo ao alternar');
  // mover
  const q = pm.locator('[data-testid="apoio-cognitivo"]'); const a = await q.boundingBox();
  await pm.mouse.move(a.x + 120, a.y + 16); await pm.mouse.down(); await pm.mouse.move(a.x + 20, a.y + 120, { steps: 6 }); await pm.mouse.up();
  const b = await q.boundingBox(); assert.ok(Math.abs(b.x - a.x) > 40 || Math.abs(b.y - a.y) > 40, 'o quadro se move pelo cabeçalho');
  // redimensionar: o grafo acompanha e o tamanho fica guardado
  await pm.evaluate(() => { const el = document.querySelector('[data-testid="apoio-cognitivo"]'); el.style.width = '700px'; el.style.height = '520px'; });
  await pm.waitForFunction(() => { try { return JSON.parse(localStorage.getItem('rv_quadro_apoio_cognitivo_tam') || 'null')?.w >= 690; } catch { return false; } });
  const c = await q.boundingBox(); assert.ok(c.width >= 690 && c.height >= 500);
  // tela menor: o quadro continua inteiro na janela
  await pm.setViewportSize({ width: 560, height: 700 });
  await pm.waitForTimeout(300);
  const d = await q.boundingBox(); assert.ok(d.x >= 0 && d.x + d.width <= 561 && d.y >= 0 && d.y + d.height <= 701, `cabe na janela estreita: ${JSON.stringify(d)}`);
  await pm.setViewportSize({ width: 1280, height: 900 }); await pm.waitForTimeout(300);
  const e = await q.boundingBox(); assert.ok(e.x + e.width <= 1281 && e.x >= 0, 'e ao voltar a janela grande');
  // não revela o checklist real da estação
  const texto = await q.textContent();
  const itens = (await srv.q(`select descricao from pep_itens where estacao_id=$1`, [est])).rows;
  assert.ok(itens.length > 0);
  for (const i of itens) assert.ok(!texto.includes(i.descricao), `o apoio não mostra o item do checklist: ${i.descricao}`);
  // fechar
  await pm.locator('[data-testid="apoio-cognitivo"] [data-testid="quadro-fechar"]').click();
  assert.equal(await pm.locator('[data-testid="apoio-cognitivo"]').count(), 0);
});

await passo('o chefe da sala pode desligar o apoio: a oferta some para o candidato e o quadro aberto fecha; ao ligar, volta', async () => {
  await pm.locator('[data-testid="abrir-apoio"]').click(); await pm.waitForSelector('[data-testid="apoio-cognitivo"]');
  assert.equal(await pa.locator('[data-testid="opcao-apoio"]').isChecked(), true, 'o chefe vê a opção ligada por padrão');
  await pa.locator('[data-testid="opcao-apoio"]').click();
  await pa.waitForFunction(() => document.querySelector('[data-testid="opcao-apoio"]')?.checked === false);
  await pm.waitForFunction(() => !document.querySelector('[data-testid="apoio-oferta"]') && !document.querySelector('[data-testid="apoio-cognitivo"]'), null, { timeout: 40000 });
  assert.equal(await pm.locator('[data-testid="ferramenta-conduta"]').count(), 0, 'o ícone da barra também some');
  assert.equal((await srv.q(`select apoio_cognitivo a from salas where id=$1`, [sala])).rows[0].a, false);
  await pa.locator('[data-testid="opcao-apoio"]').click();
  await pa.waitForFunction(() => document.querySelector('[data-testid="opcao-apoio"]')?.checked === true);
  await pm.waitForSelector('[data-testid="apoio-oferta"]', { timeout: 40000 });
  assert.equal(await pm.locator('[data-testid="apoio-cognitivo"]').count(), 0, 'volta a oferta, sem abrir sozinho');
});

await passo('celular: o apoio vira folha na parte de baixo, sem rolagem lateral', async () => {
  const c = await nav.newContext({ viewport: { width: 390, height: 780 } });
  await c.addInitScript(() => { try { localStorage.setItem('rv_shell', 'classico'); } catch { /* sem storage */ } });   // estes testes cobrem o menu clássico; a mesa tem mesa.e2e.mjs
  await c.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  await c.addInitScript(([a, id]) => { localStorage.setItem('rv_shell', 'classico'); localStorage.setItem('rp-auth', JSON.stringify(a)); sessionStorage.setItem('rv_sala', id); }, [sModa, sala]);
  await c.addInitScript(SPEECH);
  const p = await c.newPage(); await p.goto(srv.url); await p.waitForSelector('nav'); await p.waitForTimeout(400);
  await p.locator('nav button:has-text("Ciclos")').click(); await p.waitForSelector('[data-testid="meu-papel"]');
  await p.locator('[data-testid="abrir-apoio"]').click(); await p.waitForSelector('[data-testid="apoio-cognitivo"]');
  await p.locator('textarea[data-testid="apoio-notas"]').evaluate((el) => el.closest('details').open = true);
  await p.fill('[data-testid="apoio-notas"]', 'Gestante de 34 semanas, PA 170x110, cefaleia intensa');
  await p.waitForSelector('[data-testid="apoio-2d"] .ap-n.hy.top');
  const sobra = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth); assert.ok(sobra <= 1, `sobra ${sobra}px`);
  const b = await p.locator('[data-testid="apoio-cognitivo"]').boundingBox(); assert.ok(b.x >= 0 && b.x + b.width <= 391, 'folha cabe na largura');
  await p.screenshot({ path: join(saida, 'apoio-celular.png') });
  await c.close();
});

await nav.close(); srv.fechar();
console.log(falhas.length ? `\n${falhas.length} falha(s)` : '\nTodos os passos passaram.');
process.exit(falhas.length ? 1 : 0);
