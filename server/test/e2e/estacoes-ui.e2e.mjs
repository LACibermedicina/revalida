// E2E da tela "Criar" (web e desktop): gerar por IA, revisar, publicar, exportar/importar .rvpack, PDF/imagem, IA desligada, menu do desktop.
// Servidor: rotas REAIS de estações + Postgres real; IA falsa controlável (nenhum provedor é chamado).
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
const saida = process.env.SAIDA || join(aqui, 'capturas'); const pub = join(saida, 'pub6');
mkdirSync(pub, { recursive: true });
writeFileSync(join(saida, 'stub-io6.js'), 'export const io = () => ({ emit() {}, on() {}, disconnect() {} });');
writeFileSync(join(saida, 'stub-video6.js'), "export async function criarSalaVideo() { return { modo: 'demo', pode: {} }; }");
await esbuild.build({ entryPoints: [join(web, 'src/main.jsx')], bundle: true, outdir: pub, format: 'esm', target: 'es2022', logLevel: 'error', nodePaths: [NPM],
  alias: { 'socket.io-client': join(saida, 'stub-io6.js') }, plugins: [{ name: 'v', setup: (b) => b.onResolve({ filter: /\/video\.js$/ }, () => ({ path: join(saida, 'stub-video6.js') })) }],
  define: { 'process.env.NODE_ENV': '"production"' }, loader: { '.css': 'css' } });
writeFileSync(join(pub, 'index.html'), readFileSync(join(web, 'index.html'), 'utf8')
  .replace('<script type="module" src="/src/main.jsx"', '<script type="module" src="/main.js"').replace('</head>', '<link rel="stylesheet" href="/main.css">\n</head>'));

const srv = await iniciar({ pastaWeb: pub });
const nav = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
const falhas = [];
const passo = async (n, fn) => { try { await fn(); console.log('✔', n); } catch (e) { falhas.push(n); console.log('✘', n, '\n   ', e.message.split('\n')[0]); } };

const ana = (await srv.q(`select id, sessao_versao from usuarios where email='ana@x.com'`)).rows[0];
const moda = (await srv.q(`select id, sessao_versao from usuarios where email='moda@x.com'`)).rows[0];
const sessao = (u, nome, papel) => ({ token: srv.assinar({ id: u.id, nome, papel_app: papel, sessao_versao: u.sessao_versao }), usuario: { id: u.id, nome, papel_app: papel } });
const nova = async ({ w = 1280, h = 800, quem = sessao(ana, 'Ana Souza', 'usuario'), desktop = false } = {}) => {
  const c = await nav.newContext({ viewport: { width: w, height: h }, acceptDownloads: true });
  await c.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  await c.addInitScript(([s, d]) => {
    localStorage.setItem('rp-auth', JSON.stringify(s));
    if (d) window.revalidaDesktop = { aoComando(cb) { window.__cmd = cb; return () => {}; } };
  }, [quem, desktop]);
  const p = await c.newPage(); p.on('pageerror', (e) => falhas.push(`erro de página: ${e.message}`));
  await p.goto(srv.url); await p.waitForSelector('nav'); await p.waitForTimeout(500);
  await p.locator('nav button:has-text("Criar")').click(); await p.waitForSelector('h2:has-text("Estações")');
  return p;
};
const status = async (titulo) => (await srv.q(`select status, origem, incertos::text i from estacoes where titulo=$1`, [titulo])).rows[0];

let paginaAna; let baixado;
await passo('lista vazia e acesso à IA informado', async () => {
  paginaAna = await nova();
  assert.match(await paginaAna.textContent('.est-tela'), /ainda não criou nenhuma estação/);
  assert.equal(await paginaAna.locator('button:has-text("Gerar com IA")').isEnabled(), true);
});

await passo('gerar por IA: espera visível, sorteio informado, editor preenchido, publicar exige conferência', async () => {
  const p = paginaAna; srv.ia.atrasoMs = 700;
  await p.locator('button:has-text("Gerar com IA")').click();
  await p.locator('button:has-text("Gerar estação")').click();
  await p.waitForSelector('.est-espera');                                  // indicador de espera enquanto a IA trabalha
  await p.waitForSelector('.est-editor', { timeout: 8000 }); srv.ia.atrasoMs = 0;
  assert.match(await p.textContent('.aviso'), /sorteou a área, o tema, a dificuldade/);
  const titulo = await p.getByLabel('Título', { exact: true }).first().inputValue();
  assert.match(titulo, /^Gerada: /);
  assert.equal(await p.locator('.est-pep').count(), 3); assert.equal(await p.locator('.est-mat').count(), 1);
  const enviar = p.locator('button:has-text("Enviar para revisão")');
  assert.equal(await enviar.isDisabled(), true, 'sem conferir, não envia');
  await p.locator('.est-check:has-text("Li e conferi") input').check();
  await enviar.click(); await p.waitForSelector('text=fila de revisão da moderação');
  const e = (await srv.q(`select status, origem from estacoes where titulo=$1`, [titulo])).rows[0];
  assert.deepEqual([e.status, e.origem], ['revisao', 'ia']);
  assert.ok(await p.locator('.est-leitura').count(), 'depois de enviada a estação vira só leitura');
  await p.screenshot({ path: join(saida, '60-estacao-gerada.png') });
});

await passo('variação por IA: muda só o pedido, abre o rascunho novo e não altera a base', async () => {
  const p = paginaAna; const antes = (await srv.q(`select count(*)::int n from estacoes where titulo like 'Gerada: %'`)).rows[0].n;
  await p.locator('.est-variacao summary').click();
  await p.fill('.est-variacao input[placeholder="Criança de 6 anos"]', 'Criança de 6 anos');
  await p.locator('.est-variacao button:has-text("Criar variação")').click();
  await p.waitForFunction(() => document.querySelector('.aviso')?.textContent.includes('Variação criada pela IA'));
  assert.match(await p.getByLabel('Título', { exact: true }).first().inputValue(), /^Variação: Gerada: /);
  assert.equal(srv.ia.chamadas.at(-1)[1].perfil, 'Criança de 6 anos');
  assert.equal((await srv.q(`select count(*)::int n from estacoes where titulo like 'Gerada: %'`)).rows[0].n, antes, 'a base continua igual');
  assert.equal((await srv.q(`select status, origem, perfil_paciente from estacoes where titulo like 'Variação: %'`)).rows[0].status, 'rascunho');
  await srv.q(`delete from estacoes where titulo like 'Variação: %'`);   // limpa para os passos seguintes (lista, exportação)
});

await passo('lista mostra origem e status; voltar atualiza', async () => {
  const p = paginaAna; await p.locator('button:has-text("Voltar")').click(); await p.waitForSelector('.est-item');
  const t = await p.locator('.est-item', { hasText: 'Gerada: ' }).first().textContent();
  assert.match(t, /Gerada por IA/); assert.match(t, /Em revisão/);
});

await passo('estação manual: digitar não perde o foco; publicar incompleta mostra o que falta', async () => {
  const p = paginaAna; await p.locator('button:has-text("Nova")').first().click(); await p.waitForSelector('.est-editor');
  const campo = p.getByLabel('Título', { exact: true }).first();
  await campo.click(); await campo.pressSequentially('Estação manual de teste', { delay: 8 });
  assert.equal(await campo.inputValue(), 'Estação manual de teste', 'todas as letras entraram (campo não remonta)');
  await p.locator('button:has-text("+ Item do checklist")').click();
  await p.locator('.est-pep textarea').first().fill('Cumprimenta o paciente');
  assert.match(await p.textContent('.est-soma'), /1 pontos/);
  await p.locator('button:has-text("Enviar para revisão")').click(); await p.waitForSelector('ul[role=alert] li');
  const itens = await p.locator('ul[role=alert] li').allTextContents();
  assert.ok(itens.some((x) => /script_ator/.test(x)) && itens.some((x) => /pelo menos 3 itens/.test(x)), itens.join(' | '));
  assert.equal((await status('Estação manual de teste')).status, 'rascunho', 'ficou salva como rascunho');
  await p.locator('button:has-text("Voltar")').click();
});

await passo('exportar .rvpack e importar de volta (relatório por estação; soma adulterada é recusada)', async () => {
  const p = paginaAna; await p.waitForSelector('.est-item');
  await p.locator('.est-item', { hasText: 'Gerada:' }).locator('input[type=checkbox]').check();
  const [d] = await Promise.all([p.waitForEvent('download'), p.locator('button:has-text("Exportar selecionadas (1)")').click()]);
  assert.match(d.suggestedFilename(), /^revalida-estacoes-\d{4}-\d{2}-\d{2}\.rvpack$/);
  baixado = join(saida, 'pacote.rvpack'); await d.saveAs(baixado);
  const pacote = JSON.parse(readFileSync(baixado, 'utf8'));
  assert.equal(pacote.formato, 'rvpack'); assert.equal(pacote.estacoes.length, 1); assert.match(pacote.sha256, /^[0-9a-f]{64}$/);
  await p.locator('button:has-text("Importar")').first().click();
  await p.locator('input[type=file]').setInputFiles(baixado);
  await p.waitForSelector('.est-relatorio');
  assert.match(await p.textContent('.est-form'), /1 importada\(s\), 0 rejeitada\(s\)/);
  assert.match(await p.textContent('.est-form'), /fila de revisão/);
  pacote.estacoes[0].titulo = 'Adulterada'; writeFileSync(join(saida, 'adulterado.rvpack'), JSON.stringify(pacote));
  await p.locator('input[type=file]').setInputFiles(join(saida, 'adulterado.rvpack'));
  await p.waitForSelector('[role=alert]:has-text("corrompido")');
  writeFileSync(join(saida, 'lixo.rvpack'), 'isto não é json');
  await p.locator('input[type=file]').setInputFiles(join(saida, 'lixo.rvpack'));
  await p.waitForSelector('[role=alert]:has-text("não é um pacote")');
  await p.screenshot({ path: join(saida, '61-importar.png') });
});

await passo('importar PDF: campos incertos em destaque; editar e salvar limpa a marcação', async () => {
  const p = paginaAna;
  await p.locator('input[type=file]').setInputFiles({ name: 'estacao.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj') });
  await p.waitForSelector('.est-editor');
  assert.match(await p.textContent('.aviso'), /marcou 2 campo/);
  assert.ok((await p.locator('.campo.incerto').count()) >= 1 && (await p.locator('.est-pep.incerto').count()) === 1, 'campos a conferir em destaque');
  assert.equal((await status('Importada do PDF')).origem, 'importada');
  await p.waitForTimeout(900); await p.screenshot({ path: join(saida, '62-pdf-conferir.png') });
  await p.getByLabel(/^Título/).first().fill('Importada do PDF (revisada)');   // o rótulo inclui "conferir" enquanto o campo está marcado
  await p.locator('button:has-text("Salvar rascunho")').click(); await p.waitForSelector('text=Rascunho salvo');
  assert.equal(await p.locator('.est-pep.incerto').count(), 0, 'após revisar, nada fica marcado');
  assert.equal((await status('Importada do PDF (revisada)')).i, '[]');
  await p.locator('button:has-text("Voltar")').click();
});

await passo('formato não aceito e arquivo falso são recusados', async () => {
  const p = paginaAna; await p.locator('button:has-text("Importar")').first().click();
  await p.locator('input[type=file]').setInputFiles({ name: 'x.pdf', mimeType: 'application/pdf', buffer: Buffer.from('MZ isto é um executável') });
  await p.waitForSelector('[role=alert]:has-text("não corresponde")');
  await p.locator('input[type=file]').setInputFiles({ name: 'x.exe', mimeType: 'application/octet-stream', buffer: Buffer.from('MZ') });
  await p.waitForSelector('[role=alert]:has-text("Formato não aceito")');
  await p.locator('button:has-text("Voltar")').click();
});

await passo('IA desligada: avisa e bloqueia gerar e PDF, mas manual e pacote seguem', async () => {
  srv.ia.on = false; const p = await nova();
  await p.locator('button:has-text("Gerar com IA")').click();
  assert.match(await p.textContent('[role=alert]'), /IA não está configurada/);
  assert.equal(await p.locator('button:has-text("Gerar estação")').isDisabled(), true);
  await p.locator('button:has-text("Voltar")').click(); await p.locator('button:has-text("Importar")').first().click();
  await p.locator('input[type=file]').setInputFiles({ name: 'a.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4') });
  await p.waitForSelector('[role=alert]:has-text("IA não está configurada")');
  await p.locator('input[type=file]').setInputFiles(baixado); await p.waitForSelector('.est-relatorio');   // pacote não depende da IA
  srv.ia.on = true;
});

await passo('falha da IA vira mensagem clara (nunca tela travada)', async () => {
  const { ErroIA } = await import('../../src/ia.js');
  srv.ia.falha = new ErroIA('IA_LIMITE', 'A IA está com muitas requisições agora. Tente em instantes.');
  const p = await nova(); await p.locator('button:has-text("Gerar com IA")').click(); await p.locator('button:has-text("Gerar estação")').click();
  await p.waitForSelector('[role=alert]:has-text("muitas requisições")');
  assert.equal(await p.locator('button:has-text("Gerar estação")').isEnabled(), true, 'dá para tentar de novo');
  srv.ia.falha = null;
});

await passo('moderação publica direto (aprovada) e vê o texto completo', async () => {
  const p = await nova({ quem: sessao(moda, 'Moda Dora', 'moderador') });
  await p.locator('button:has-text("Gerar com IA")').click(); await p.locator('button:has-text("Gerar estação")').click();
  await p.waitForSelector('.est-editor'); await p.locator('.est-check:has-text("Li e conferi") input').check();
  await p.locator('button:has-text("Publicar")').click(); await p.waitForSelector('text=Estação publicada');
  assert.equal((await srv.q(`select count(*)::int n from estacoes where status='aprovada' and origem='ia'`)).rows[0].n, 1);
});

await passo('desktop: layout largo em duas colunas, sem estouro; comandos do menu abrem as telas', async () => {
  const p = await nova({ w: 1440, h: 900, desktop: true });
  await p.locator('.est-item button.abrir').first().click(); await p.waitForSelector('.est-editor');
  const g = await p.evaluate(() => ({ disp: getComputedStyle(document.querySelector('.est-editor')).display, cols: getComputedStyle(document.querySelector('.est-editor')).gridTemplateColumns.split(' ').length, sw: document.scrollingElement.scrollWidth, w: innerWidth }));
  assert.equal(g.disp, 'grid'); assert.equal(g.cols, 2); assert.ok(g.sw <= g.w, 'sem rolagem lateral');
  await p.waitForTimeout(900); await p.screenshot({ path: join(saida, '63-desktop-editor.png') });
  await p.locator('button:has-text("Voltar")').click();
  await p.evaluate(() => window.__cmd({ tela: 'estacoes', aba: 'gerar' })); await p.waitForSelector('h2:has-text("Gerar com IA")');
  await p.evaluate(() => window.__cmd({ tela: 'estacoes', aba: 'importar' })); await p.waitForSelector('h2:has-text("Importar")');
  await p.evaluate(() => window.__cmd({ tela: 'estacoes', aba: 'novo' })); await p.waitForSelector('h2:has-text("Nova estação")');
  await p.locator('button:has-text("Voltar")').click();
  await p.evaluate(() => window.__cmd({ tela: 'estacoes', aba: 'exportar' }));
  await p.waitForSelector('.est-item');
  assert.match(await p.textContent('button:has-text("Exportar selecionadas")'), /\([1-9]/, 'exportar seleciona todas');
  await p.screenshot({ path: join(saida, '64-desktop-lista.png') });
});

await passo('celular: editor cabe na tela, sem rolagem lateral', async () => {
  const p = await nova({ w: 390, h: 844 });
  await p.locator('.est-item button.abrir').first().click(); await p.waitForSelector('.est-editor');
  const g = await p.evaluate(() => ({ sw: document.scrollingElement.scrollWidth, w: innerWidth, fora: [...document.querySelectorAll('.est-editor input,.est-editor textarea,.est-editor select,.est-editor button')].filter((e) => e.getBoundingClientRect().right > innerWidth + 1).length }));
  assert.ok(g.sw <= g.w && g.fora === 0, JSON.stringify(g));
  await p.screenshot({ path: join(saida, '65-celular-editor.png') });
});

await nav.close(); srv.fechar();
if (falhas.length) { console.log(falhas); process.exit(1); }
console.log('\nTodos os passos passaram.');
