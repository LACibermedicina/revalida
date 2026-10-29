// E2E da tela "Ciclos" (web e desktop): duas pessoas, sala, ciclo, pedido de papel, estação com checklist, fim de estação, inversão de papéis.
// Servidor: rotas REAIS de salas/estações + Postgres real. Socket.IO e Agora são substituídos por stubs (a tela também consulta o estado sozinha).
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
const saida = process.env.SAIDA || join(aqui, 'capturas'); const pub = join(saida, 'pub7');
mkdirSync(pub, { recursive: true });
writeFileSync(join(saida, 'stub-io7.js'), 'export const io = () => ({ emit() {}, on() {}, disconnect() {} });');
writeFileSync(join(saida, 'stub-video7.js'), "export async function criarSalaVideo() { return { modo: 'demo', pode: {}, alternarCam: async (l) => l, alternarMic: async (l) => l, sincronizar: async () => ({}), sair() {} }; }");
await esbuild.build({ entryPoints: [join(web, 'src/main.jsx')], bundle: true, outdir: pub, format: 'esm', target: 'es2022', logLevel: 'error', nodePaths: [NPM],
  alias: { 'socket.io-client': join(saida, 'stub-io7.js') }, plugins: [{ name: 'v', setup: (b) => b.onResolve({ filter: /\/video\.js$/ }, () => ({ path: join(saida, 'stub-video7.js') })) }],
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
const nova = async (quem, { w = 1280, h = 800 } = {}) => {
  const c = await nav.newContext({ viewport: { width: w, height: h } });
  await c.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  await c.addInitScript((s) => localStorage.setItem('rp-auth', JSON.stringify(s)), quem);
  const p = await c.newPage(); p.on('pageerror', (e) => falhas.push(`erro de página: ${e.message}`));
  await p.goto(srv.url); await p.waitForSelector('nav'); await p.waitForTimeout(500);
  await p.locator('nav button:has-text("Ciclos")').click(); await p.waitForSelector('h2:has-text("Ciclos de estações")');
  return p;
};
const recarregar = async (p) => { await p.reload(); await p.waitForSelector('nav'); await p.locator('nav button:has-text("Ciclos")').click(); await p.waitForSelector('[data-testid="meu-papel"]'); };
const papel = (p) => p.textContent('[data-testid="meu-papel"]');

let pa; let pm; let codigo;
await passo('Ana cria a sala e vira chefe; o código aparece', async () => {
  pa = await nova(sessao(ana, 'Ana Souza', 'usuario'));
  await pa.locator('button:has-text("Criar sala")').click(); await pa.waitForSelector('[data-testid="meu-papel"]');
  assert.equal(await papel(pa), 'Chefe');
  codigo = (await pa.textContent('.sl-cod')).trim(); assert.match(codigo, /^[0-9a-f-]{36}$/);
});

await passo('Moda entra pelo código como observador', async () => {
  pm = await nova(sessao(moda, 'Moda Dora', 'moderador'));
  await pm.fill('input[placeholder="cole o código aqui"]', codigo); await pm.locator('button:has-text("Entrar na sala")').click();
  await pm.waitForSelector('[data-testid="meu-papel"]'); assert.equal(await papel(pm), 'Observador');
});

await passo('nível 3: bloco misto sorteia estações de áreas diferentes e marca o grupo', async () => {
  await pa.locator('button:has-text("Sortear bloco misto")').click();
  await pa.waitForFunction(() => document.querySelectorAll('.sl-sel input[type=checkbox]:checked').length === 2);
  assert.equal(await pa.inputValue('input[list="sl-niveis"]'), 'Nível 3 · bloco misto');
  while (await pa.locator('.sl-sel input[type=checkbox]:checked').count()) await pa.locator('.sl-sel input[type=checkbox]:checked').first().uncheck();
  await pa.fill('input[list="sl-niveis"]', '');
});

await passo('chefe monta o ciclo; observador não vê a fila futura', async () => {
  await pa.locator('label.sl-op:has-text("Dor torácica")').locator('input').check();
  await pa.locator('label.sl-op:has-text("Apendicite")').locator('input').check();
  await pa.locator('button:has-text("Criar ciclo com 2")').click();
  await pa.waitForSelector('[aria-label="Fila do ciclo"]');
  assert.equal(await pa.locator('[aria-label="Fila do ciclo"] [data-estado]').count(), 2);
  await recarregar(pm);
  assert.equal(await pm.locator('[aria-label="Fila do ciclo"] [data-estado]').count(), 0, 'o gabarito da ordem não vaza para quem não é chefe');
  await pa.screenshot({ path: join(saida, 'salas-chefe-ciclo.png') });
});

await passo('estação que já está na fila: aviso com a situação, "só as outras", e duplicar só com confirmação', async () => {
  const fila = '[aria-label="Fila do ciclo"] [data-estado]';
  await mk('Pré-natal de risco habitual', 'ginecologia_obstetricia'); await recarregar(pa);   // uma estação fora da fila para o 'só as outras'
  await pa.locator('label.sl-op:has-text("Dor torácica") .tag:has-text("na fila")').waitFor();   // o seletor já marca o que está na fila
  await pa.locator('label.sl-op:has-text("Dor torácica")').locator('input').check();
  await pa.locator('label.sl-op:has-text("Pré-natal")').locator('input').check();
  await pa.locator('button:has-text("Adicionar ao ciclo")').click(); await pa.waitForSelector('[data-testid="aviso-na-fila"]');
  assert.match(await pa.textContent('[data-testid="aviso-na-fila"]'), /«Dor torácica na UBS».*ainda na fila/);
  assert.equal(await pa.locator(fila).count(), 2, 'nada entrou antes da decisão');
  await pa.screenshot({ path: join(saida, 'salas-aviso-na-fila.png') });
  await pa.locator('[data-testid="aviso-na-fila"] button:has-text("Só as outras")').click();
  await pa.locator('button:has-text("Adicionar ao ciclo")').click(); await pa.waitForFunction((n) => document.querySelectorAll('[aria-label="Fila do ciclo"] [data-estado]').length === n, 3);
  await pa.locator('label.sl-op:has-text("Dor torácica")').locator('input').check();
  await pa.locator('button:has-text("Adicionar ao ciclo")').click(); await pa.waitForSelector('[data-testid="aviso-na-fila"]');
  await pa.locator('[data-testid="aviso-na-fila"] button:has-text("Duplicar a prática")').click();
  await pa.waitForFunction((n) => document.querySelectorAll('[aria-label="Fila do ciclo"] [data-estado]').length === n, 4);
  assert.equal((await srv.q(`select count(*)::int n from ciclo_itens i join estacoes e on e.id=i.estacao_id where e.titulo='Dor torácica na UBS'`)).rows[0].n, 2);
});

await passo('observador pede para ser candidato; chefe aceita', async () => {
  await pm.locator('button:has-text("Ser o candidato")').click();
  await pm.waitForSelector('text=aguarda resposta');
  await recarregar(pa);
  await pa.locator('[aria-label="Pedidos de papel"] button:has-text("Aceitar")').click();
  await pa.waitForFunction(() => document.querySelector('[aria-label="Participantes"]')?.textContent.includes('Candidato'));
  await recarregar(pm); assert.equal(await papel(pm), 'Candidato');
});

await passo('chefe libera uma estação ao candidato e inicia; só quem avalia vê o checklist', async () => {
  // a troca de candidato pausa o ciclo e abre um novo, vazio (regra do sistema): o chefe vê o ciclo pausado e adiciona estações ao novo
  assert.match(await pa.textContent('[aria-label="Ciclos pausados"]'), /Ciclo pausado/);
  await pa.locator('label.sl-op:has-text("Dor torácica")').locator('input').check();
  await pa.locator('button:has-text("Adicionar ao ciclo")').click();
  await pa.waitForSelector('[data-estado="pendente"]');
  await pa.locator('[data-estado="pendente"]:has-text("Dor torácica") button:has-text("Iniciar")').click();
  await pa.waitForSelector('[aria-label="Estação em andamento"] .sl-pep');
  assert.equal(await pa.locator('.sl-pep').count(), 3);
  await recarregar(pm);
  assert.equal(await pm.locator('.sl-pep').count(), 0, 'o candidato nunca recebe o gabarito');
  assert.match(await pm.textContent('[aria-label="Estação em andamento"]'), /Conduza o atendimento/);
  assert.match(await pa.textContent('.sl-relogio'), /^\d\d:\d\d$/);
});

await passo('barra de ferramentas da sala: fixa no topo, ícones reordenáveis por arrastar, ordem guardada e proporcional ao redimensionar', async () => {
  const barra = pa.locator('[data-testid="ferramentas-sala"]'); await barra.waitFor();
  const ordem = () => barra.locator('[data-testid^="ferramenta-"]').evaluateAll((ns) => ns.map((n) => n.dataset.testid));
  const antes = await ordem(); assert.ok(antes.length >= 6, 'ferramentas da sala disponíveis');
  const rolou = await pa.evaluate(() => { const t = document.querySelector('[data-testid="ferramentas-sala"]').closest('.tela'); t.scrollTop = 600; return { st: t.scrollTop, topo: t.getBoundingClientRect().top, rolavel: t.scrollHeight > t.clientHeight }; });
  const y = (await barra.boundingBox()).y - rolou.topo; assert.ok(!rolou.rolavel || (rolou.st > 0 && y >= 0 && y < 20), `a barra fica no topo ao rolar (y=${y}, rolou=${rolou.st})`);
  await barra.locator(`[data-testid="${antes[0]}"]`).dragTo(barra.locator(`[data-testid="${antes[2]}"]`));
  const depois = await ordem(); assert.notDeepEqual(depois, antes, 'a ordem mudou');
  await recarregar(pa); await pa.locator('[data-testid="ferramentas-sala"]').waitFor();
  assert.deepEqual(await pa.locator('[data-testid="ferramentas-sala"] [data-testid^="ferramenta-"]').evaluateAll((ns) => ns.map((n) => n.dataset.testid)), depois, 'ordem guardada');
  for (const w of [1280, 700, 390]) {
    await pa.setViewportSize({ width: w, height: 800 }); await pa.waitForTimeout(250);
    const m = await pa.evaluate(() => { const b = document.querySelector('[data-testid="ferramentas-sala"]').getBoundingClientRect(); return { dir: b.right, w: window.innerWidth, sobra: document.documentElement.scrollWidth - window.innerWidth }; });
    assert.ok(m.dir <= m.w + 1 && m.sobra <= 1, `barra cabe a ${w}px (${JSON.stringify(m)})`);
  }
  await pa.screenshot({ path: join(saida, 'salas-ferramentas-390.png') });
  await pa.setViewportSize({ width: 1280, height: 800 });
  await pa.locator('[data-testid="ferramenta-estacao"]').click();
});

await passo('finalizar calcula a nota no servidor e mostra o fim da estação a todos', async () => {
  const marcar = (desc, v) => pa.locator(`.sl-pep:has-text("${desc}") button:has-text("${v}")`).click();
  await marcar('início dos sintomas', 'Sim'); await marcar('exame adequado', 'Não'); await marcar('Prescreve', 'Parcial');
  await pa.locator('button:has-text("Finalizar estação")').click();
  await pa.waitForSelector('[data-testid="fim-estacao"]');
  const t = await pa.textContent('[data-testid="fim-estacao"]');
  assert.match(t, /1,75/); assert.match(t, /de 4,5 pts/); assert.match(t, /1ª/); assert.match(t, /itens críticos falhos/);
  assert.match(t, /Próxima estação/); assert.match(t, /Inverter papéis/);
  await recarregar(pm); await pm.waitForSelector('[data-testid="fim-estacao"]');
  assert.match(await pm.textContent('[data-testid="fim-estacao"]'), /Aguardando o chefe/);
  assert.equal(await pm.locator('[data-testid="fim-estacao"] button:has-text("Inverter")').count(), 0, 'candidato não decide');
  await pa.screenshot({ path: join(saida, 'salas-fim-estacao.png') });
});

await passo('inverter papéis: Moda vira chefe e Ana candidata', async () => {
  await pa.locator('button:has-text("Inverter papéis")').click();
  await pa.waitForFunction(() => document.querySelector('[data-testid="meu-papel"]')?.textContent === 'Candidato');
  await recarregar(pm); assert.equal(await papel(pm), 'Chefe');
  await pm.screenshot({ path: join(saida, 'salas-pos-inversao.png') });
});

await passo('celular: sem rolagem horizontal', async () => {
  const p = await nova(sessao(ana, 'Ana Souza', 'usuario'), { w: 390, h: 800 });
  await p.evaluate((c) => sessionStorage.setItem('rv_sala', c), codigo); await recarregar(p);
  const sobra = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  assert.ok(sobra <= 1, `sobra ${sobra}px`);
  await p.screenshot({ path: join(saida, 'salas-celular.png') });
});

await nav.close(); srv.fechar();
console.log(falhas.length ? `\n${falhas.length} falha(s)` : '\nTodos os passos passaram.');
process.exit(falhas.length ? 1 : 0);
