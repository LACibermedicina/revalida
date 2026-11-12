// E2E: escolha inicial (trilha × plataforma), trilha guiada, ciclo randômico, chamado à comunidade, bloqueio/denúncia e gráficos de desempenho.
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
writeFileSync(join(saida, 'stub-video10.js'), "export async function criarSalaVideo() { return { modo: 'demo', pode: {}, alternarCam: async (l) => l, alternarMic: async (l) => l, sincronizar: async () => {}, sair: async () => {}, aoMudar() {}, aoRemoto() {} }; }");
await esbuild.build({ entryPoints: [join(web, 'src/main.jsx')], bundle: true, outdir: pub, format: 'esm', target: 'es2022', logLevel: 'error', nodePaths: [NPM],
  alias: { 'socket.io-client': join(saida, 'stub-io10.js') }, plugins: [{ name: 'v', setup: (b) => b.onResolve({ filter: /\/video\.js$/ }, () => ({ path: join(saida, 'stub-video10.js') })) }],
  define: { 'process.env.NODE_ENV': '"production"' }, loader: { '.css': 'css' } });
writeFileSync(join(pub, 'index.html'), readFileSync(join(web, 'index.html'), 'utf8')
  .replace('<script type="module" src="/src/main.jsx"', '<script type="module" src="/main.js"').replace('</head>', '<link rel="stylesheet" href="/main.css">\n</head>'));

const srv = await iniciar({ pastaWeb: pub });
const nav = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
const falhas = [];
const passo = async (n, fn) => { try { await fn(); console.log('✔', n); } catch (e) { falhas.push(n); console.log('✘', n, '\n   ', e.message.split('\n')[0]); } };

for (const t of ['Dor torácica', 'Apendicite', 'Pré-natal', 'Febre infantil']) {
  const id = (await srv.q(`insert into estacoes (titulo, area, status, duracao_min, script_ator) values ($1,'clinica_medica','aprovada',10,'x') returning id`, [t])).rows[0].id;
  await srv.q(`insert into pep_itens (estacao_id, secao, ordem, descricao, pontos_total, critico) values ($1,'Anamnese',1,'Pergunta a queixa',1,false), ($1,'Conduta',2,'Prescreve',2,true)`, [id]);
}
await srv.mkUser('Bia Lima', 'bia@x.com', 'senhaforte123'); await srv.mkUser('Caio Reis', 'caio@x.com', 'senhaforte123');
await srv.mkUser('Dora Melo', 'dora@x.com', 'senhaforte123'); await srv.mkUser('Admin Geral', 'adm@x.com', 'senhaforte123', 'admin');
const u = async (email) => (await srv.q(`select id, nome, sessao_versao, papel_app from usuarios where email=$1`, [email])).rows[0];
const sessao = (x) => ({ token: srv.assinar({ id: x.id, nome: x.nome, papel_app: x.papel_app, sessao_versao: x.sessao_versao }), usuario: { id: x.id, nome: x.nome, papel_app: x.papel_app } });
const U = { ana: await u('ana@x.com'), bia: await u('bia@x.com'), caio: await u('caio@x.com'), dora: await u('dora@x.com'), adm: await u('adm@x.com') };
await srv.q(`update usuarios set visto_em = now()`);
const chamar = (quem, metodo, caminho, corpo) => fetch(srv.url + caminho, { method: metodo, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sessao(U[quem]).token}` }, body: corpo ? JSON.stringify(corpo) : undefined }).then(async (r) => ({ status: r.status, corpo: await r.json().catch(() => ({})) }));

const abrir = async (quem, { escolha = false, w = 1280, h = 900 } = {}) => {
  const c = await nav.newContext({ viewport: { width: w, height: h } });
  await c.addInitScript(() => { try { localStorage.setItem('rv_shell', 'classico'); } catch { /* sem storage */ } });   // estes testes cobrem o menu clássico; a mesa tem mesa.e2e.mjs
  await c.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  await c.addInitScript((s) => { localStorage.setItem('rv_shell', 'classico'); localStorage.setItem('rp-auth', JSON.stringify(s)); }, sessao(U[quem]));
  const p = await c.newPage(); p.on('pageerror', (e) => falhas.push(`erro de página: ${e.message}`));
  await p.goto(srv.url + (escolha ? '/?escolha=1' : '/'));
  return p;
};
const ir = async (p, rot) => { await p.locator(`nav button:has-text("${rot}")`).click(); };
const esperaTexto = (p, sel, re, ms = 8000) => p.waitForFunction(([s, r]) => new RegExp(r).test(document.querySelector(s)?.textContent ?? ''), [sel, re.source], { timeout: ms });

await passo('início: pergunta trilha × plataforma; trilha pede só o tempo (dias opcionais) e entra na fila', async () => {
  const p = await abrir('ana', { escolha: true });
  await p.waitForSelector('[data-testid=escolha-inicial]');
  assert.ok(await p.locator('[data-testid=escolha-trilha]').isVisible()); assert.ok(await p.locator('[data-testid=escolha-plataforma]').isVisible());
  await p.click('[data-testid=escolha-trilha]');
  await p.click('[data-testid=min-30]');
  assert.equal(await p.locator('[data-testid^=dia-]').count(), 7);
  assert.equal(await p.locator('[data-testid^=dia-][aria-pressed=true]').count(), 0, 'sem dias marcados = todos os dias');
  await p.click('[data-testid=comecar-trilha]');
  await p.waitForSelector('[data-testid=espera-randomica]');
  const t = (await chamar('ana', 'GET', '/api/trilha')).corpo;
  assert.equal(t.minutos_dia, 30); assert.equal(t.dias.length, 7);
  await p.click('[data-testid=sair-da-fila]'); await p.waitForSelector('[data-testid=escolha-trilha]');
  await p.context().close();
});

await passo('outra sessão: a trilha recupera a configuração; "plataforma" libera o app', async () => {
  const p = await abrir('ana', { escolha: true });
  await p.waitForSelector('[data-testid=escolha-trilha]');
  assert.match(await p.locator('[data-testid=escolha-trilha]').textContent(), /30 min por dia/);
  await p.click('[data-testid=escolha-plataforma]');
  await p.waitForSelector('nav'); assert.equal(await p.locator('[data-testid=escolha-inicial]').count(), 0);
  await p.context().close();
});

await passo('trilha: com alguém disponível, a sala abre direto com o ciclo randômico e o plano', async () => {
  await chamar('bia', 'PUT', '/api/trilha', { minutos_dia: 30 });
  assert.equal((await chamar('bia', 'POST', '/api/trilha/iniciar', {})).corpo.estado, 'aguardando');
  const p = await abrir('ana', { escolha: true });
  await p.waitForSelector('[data-testid=escolha-trilha]'); await p.click('[data-testid=escolha-trilha]');
  await p.click('[data-testid=seguir-trilha]');
  await p.waitForSelector('[data-testid=banner-randomico]', { timeout: 15000 });
  const tx = await p.locator('[data-testid=banner-randomico]').textContent();
  assert.match(tx, /Trilha guiada/); assert.match(tx, /estação 1 de \d/); assert.match(tx, /volta 1 de 2/);
  await p.screenshot({ path: join(saida, 'social-trilha-sala.png') });
  await p.context().close();
});

await passo('chamado público: a pessoa inicia um ciclo direto com quem abriu o chamado', async () => {
  await srv.q(`update chamados set estado='cancelado'`);
  await chamar('bia', 'POST', '/api/chamados', { mensagem: 'Treino de clínica hoje' });
  const p = await abrir('ana'); await p.waitForSelector('nav'); await ir(p, 'Comunidade');
  await p.click('[data-testid=cm-chamados]');
  await p.waitForSelector('[data-testid=chamado-aberto]');
  assert.match(await p.locator('[data-testid=chamado-aberto]').first().textContent(), /Bia Lima/);
  await p.click('[data-testid=iniciar-ciclo]');
  await p.waitForSelector('.sl-bloco', { timeout: 15000 });
  assert.equal((await srv.q(`select estado from chamados where usuario_id=$1 order by criado_em desc limit 1`, [U.bia.id])).rows[0].estado, 'atendido');
  await p.context().close();
});

await passo('bloquear pela lista: some nos dois sentidos; desbloquear traz de volta', async () => {
  await srv.q(`update chamados set estado='cancelado'`);
  await chamar('caio', 'POST', '/api/chamados', { mensagem: 'Alguém?' });
  const p = await abrir('ana'); await p.waitForSelector('nav'); await ir(p, 'Comunidade'); await p.click('[data-testid=cm-chamados]');
  await p.waitForSelector('[data-testid=chamado-aberto]');
  await p.click('[data-testid=chamado-aberto] [data-testid=bloquear]');
  await p.click('[data-testid=confirmar-acao]');
  await p.waitForFunction(() => document.querySelectorAll('[data-testid=chamado-aberto]').length === 0, null, { timeout: 15000 });
  // vice-versa: Ana abre chamado, Caio não vê
  await chamar('ana', 'POST', '/api/chamados', {});
  assert.equal((await chamar('caio', 'GET', '/api/chamados')).corpo.length, 0);
  await p.click('[data-testid=cm-seguranca]'); await p.waitForSelector('[data-testid=painel-seguranca]');
  await p.waitForFunction(() => /Caio Reis/.test(document.querySelector('[data-testid=painel-seguranca]').textContent));
  await p.getByRole('button', { name: 'Desbloquear' }).click();
  await p.waitForFunction(() => !/Caio Reis/.test(document.querySelector('[data-testid=painel-seguranca]').textContent));
  await p.context().close();
});

await passo('denúncia: notifica o denunciado e o admin; direito de resposta; admin suspende por 7 dias', async () => {
  await srv.q(`update chamados set estado='cancelado'`);
  await chamar('dora', 'POST', '/api/chamados', {});
  const p = await abrir('ana'); await p.waitForSelector('nav'); await ir(p, 'Comunidade'); await p.click('[data-testid=cm-chamados]');
  await p.waitForSelector('[data-testid=chamado-aberto]');
  await p.click('[data-testid=chamado-aberto] [data-testid=denunciar]');
  await p.selectOption('[data-testid=denuncia-motivo]', 'assedio');
  await p.fill('[data-testid=denuncia-detalhe]', 'Mensagens insistentes fora da estação.');
  await p.click('[data-testid=confirmar-acao]');
  await p.waitForFunction(() => document.querySelectorAll('[data-testid=chamado-aberto]').length === 0, null, { timeout: 15000 });
  assert.ok((await chamar('dora', 'GET', '/api/notificacoes')).corpo.itens.some((n) => n.tipo === 'denuncia_recebida'));
  assert.ok((await chamar('adm', 'GET', '/api/notificacoes')).corpo.itens.some((n) => n.tipo === 'denuncia_nova'));
  await p.context().close();
  // a denunciada vê o motivo (nunca quem denunciou) e responde
  const d = await abrir('dora'); await d.waitForSelector('nav'); await ir(d, 'Comunidade'); await d.click('[data-testid=cm-seguranca]');
  await d.waitForSelector('[data-testid=denuncia-recebida]');
  const tx = await d.locator('[data-testid=denuncia-recebida]').textContent();
  assert.match(tx, /Assédio/); assert.ok(!/Ana Souza/.test(tx), 'não revela quem denunciou');
  await d.fill('[data-testid=denuncia-resposta]', 'Foi um mal-entendido, posso explicar.'); await d.click('[data-testid=enviar-resposta]');
  await d.waitForFunction(() => /Sua resposta/.test(document.querySelector('[data-testid=denuncia-recebida]').textContent));
  await d.context().close();
  // o admin lê, vê a resposta e decide
  const a = await abrir('adm'); await a.waitForSelector('nav'); await ir(a, 'Admin'); await a.getByRole('tab', { name: 'Denúncias' }).click();
  await a.waitForSelector('[data-testid=denuncia-admin]');
  const ta = await a.locator('[data-testid=denuncia-admin]').textContent();
  assert.match(ta, /Ana Souza/); assert.match(ta, /Dora Melo/); assert.match(ta, /mal-entendido/);
  assert.equal((await srv.q(`select suspenso_ate from usuarios where id=$1`, [U.dora.id])).rows[0].suspenso_ate, null, 'padrão: sem suspensão');
  await a.click('[data-testid=decidir-suspender]');
  await a.waitForSelector('[role=alert]:has-text("Explique")');
  await a.fill('[data-testid=decisao-nota]', 'Reincidência comprovada.'); await a.click('[data-testid=decidir-suspender]');
  await a.waitForFunction(() => /Suspenso por 7 dias/.test(document.querySelector('[data-testid=admin-denuncias]').textContent), null, { timeout: 15000 });
  assert.ok((await srv.q(`select suspenso_ate > now() + interval '6 days' ok from usuarios where id=$1`, [U.dora.id])).rows[0].ok);
  assert.equal((await chamar('dora', 'GET', '/api/chamados')).status, 401, 'a sessão da suspensa cai na hora');
  await a.context().close();
});

await passo('desempenho: gráficos por bloco do PEP, filtros de área/período/geral e visão em tabela', async () => {
  const sala = (await srv.q(`insert into salas (dono_id, admin_id) values ($1,$1) returning id`, [U.bia.id])).rows[0].id;
  const ests = (await srv.q(`select id from estacoes order by titulo limit 2`)).rows;
  await srv.q(`update estacoes set area='cirurgia' where id=$1`, [ests[1].id]);
  const feito = async (est, dias, itens) => {
    const ciclo = (await srv.q(`insert into ciclos (sala_id, admin_id, candidato_id, estado) values ($1,$2,$3,'encerrado') returning id`, [sala, U.bia.id, U.ana.id])).rows[0].id;
    const it = (await srv.q(`insert into ciclo_itens (ciclo_id, estacao_id, posicao) values ($1,$2,1) returning id`, [ciclo, est])).rows[0].id;
    await srv.q(`insert into execucoes (sala_id, ciclo_id, item_id, estado, avaliador_id, candidato_id, iniciada_em, finalizada_em, nota, checklist) values ($1,$2,$3,'finalizada',$4,$5, now() - ($6 * interval '1 day') - interval '10 minutes', now() - ($6 * interval '1 day'), 3, $7)`, [sala, ciclo, it, U.bia.id, U.ana.id, dias, JSON.stringify({ itens })]);
  };
  const I = (secao, descricao, pontos, tot, resultado, critico = false) => ({ secao, descricao, pontos, pontos_total: tot, resultado, critico });
  await feito(ests[0].id, 3, [I('Anamnese', 'Pergunta a queixa', 1, 1, 'sim'), I('Conduta', 'Prescreve', 0, 2, 'nao', true)]);
  await feito(ests[1].id, 60, [I('Anamnese', 'Pergunta a queixa', 1, 1, 'sim'), I('Conduta', 'Prescreve', 2, 2, 'sim', true)]);
  const p = await abrir('ana'); await p.waitForSelector('nav'); await ir(p, 'Desempenho');
  await p.waitForSelector('[data-testid=grafico-blocos]');
  const kpi = async () => (await p.locator('[data-testid=kpis] div').first().locator('b').textContent()).trim();
  assert.equal(await kpi(), '2');
  assert.match(await p.locator('[data-testid=grafico-blocos]').textContent(), /Anamnese.*100%/);
  assert.match(await p.locator('[data-testid=grafico-blocos]').textContent(), /Conduta e tratamento.*50%/);
  await p.waitForTimeout(1200); await p.screenshot({ path: join(saida, 'social-desempenho.png'), fullPage: true });
  await p.selectOption('[data-testid=f-area]', 'cirurgia'); await p.waitForFunction(() => document.querySelector('[data-testid=kpis] b').textContent.trim() === '1');
  await p.selectOption('[data-testid=f-area]', ''); await p.selectOption('[data-testid=f-periodo]', '30');
  await p.waitForFunction(() => document.querySelector('[data-testid=kpis] b').textContent.trim() === '1');
  assert.match(await p.locator('[data-testid=grafico-blocos]').textContent(), /Conduta e tratamento.*0%/, 'só a de 3 dias entra');
  await p.selectOption('[data-testid=f-periodo]', ''); await p.selectOption('[data-testid=f-modalidade]', 'randomico');
  await p.waitForSelector('[data-testid=desempenho-vazio]');
  await p.selectOption('[data-testid=f-modalidade]', ''); await p.click('[data-testid=alterna-tabela]');
  await p.waitForSelector('[data-testid=tabela-desempenho]');
  assert.match(await p.locator('[data-testid=tabela-desempenho]').textContent(), /Anamnese/);
  await p.context().close();
});

await nav.close(); srv.fechar();
console.log(falhas.length ? `\n${falhas.length} falha(s)` : '\nTudo certo');
process.exit(falhas.length ? 1 : 0);
