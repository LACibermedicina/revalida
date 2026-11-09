// E2E da estação com cartas, transcrição e análise: candidato e avaliador em navegadores separados.
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
const saida = process.env.SAIDA || join(aqui, 'capturas'); const pub = join(saida, 'pub8');
mkdirSync(pub, { recursive: true });
writeFileSync(join(saida, 'stub-io8.js'), 'export const io = () => ({ emit() {}, on() {}, disconnect() {} });');
writeFileSync(join(saida, 'stub-video8.js'), "export async function criarSalaVideo() { return { modo: 'demo', pode: {}, alternarCam: async (l) => l, alternarMic: async (l) => l, sincronizar: async () => ({}), sair() {} }; }");
await esbuild.build({ entryPoints: [join(web, 'src/main.jsx')], bundle: true, outdir: pub, format: 'esm', target: 'es2022', logLevel: 'error', nodePaths: [NPM],
  alias: { 'socket.io-client': join(saida, 'stub-io8.js') }, plugins: [{ name: 'v', setup: (b) => b.onResolve({ filter: /\/video\.js$/ }, () => ({ path: join(saida, 'stub-video8.js') })) }],
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
  await c.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  await c.addInitScript(([a, id]) => { localStorage.setItem('rp-auth', JSON.stringify(a)); sessionStorage.setItem('rv_sala', id); }, [s, sala]);
  if (voz) await c.addInitScript(SPEECH);
  const p = await c.newPage(); p.on('pageerror', (e) => falhas.push(`erro de página: ${e.message}`));
  await p.goto(srv.url); await p.waitForSelector('nav'); await p.waitForTimeout(400);
  await p.locator('nav button:has-text("Ciclos")').click(); await p.waitForSelector('[data-testid="meu-papel"]');
  return p;
};

let pm; let pa;
const abrirTudo = async (p) => { await p.waitForSelector('[data-testid="painel-quadros"]'); const b = p.locator('[data-testid="painel-quadros"] button:has-text("Abrir todos")'); if (await b.count()) await b.click(); };
await passo('ao iniciar, o candidato já vê a descrição e o cenário; nada de gabarito, gatilho ou carta não liberada', async () => {
  pm = await abrir(sModa, { voz: true });
  await pm.waitForSelector('[data-carta="descricao"]');
  assert.match(await pm.textContent('[data-carta="descricao"]'), /Realize a anamnese/);
  assert.match(await pm.textContent('[data-carta="cenario"]'), /Unidade básica de saúde/);
  assert.equal(await pm.locator('[data-carta="material"]').count(), 0);
  const html = await pm.content();
  assert.ok(!/solicitar gasometria|Maria, 45 anos|Prescreve salbutamol/.test(html), 'gatilho, roteiro do ator e checklist não chegam ao candidato');
  await pm.screenshot({ path: join(saida, 'exec-candidato-cartas.png') });
});

await passo('transcrição do candidato: pede permissão uma vez, grava só a fala e mostra o estado', async () => {
  assert.equal(await pm.getAttribute('[data-testid="transcricao-candidato"]', 'data-estado'), 'parada');
  await pm.locator('button:has-text("Iniciar transcrição")').click();
  await pm.waitForFunction(() => document.querySelector('[data-testid="transcricao-candidato"]')?.dataset.estado === 'ouvindo');
  await pm.evaluate(() => { window.__falar('Boa tarde, quando começou a falta de ar e a tosse?'); window.__falar('Investigo tabagismo e uso de inalador.'); window.__falar('Solicito uma gasometria arterial.'); });
  let t = [];
  for (let i = 0; i < 40 && t.length < 3; i++) { await pm.waitForTimeout(200); t = (await srv.q(`select texto, fonte from transcricoes where execucao_id=$1 order by ordem`, [execId])).rows; }
  assert.equal(t.length, 3); assert.equal(t[0].fonte, 'navegador'); assert.match(t[2].texto, /gasometria/);
  assert.equal(await pm.evaluate(() => localStorage.getItem('rv_transcricao_ok')), '1');
});

await passo('avaliador vê a fala, o pedido detectado e libera a carta; o candidato passa a ver só essa', async () => {
  pa = await abrir(sAna);
  await pa.waitForSelector('[data-testid="fala-candidato"] li', { timeout: 10000 });
  assert.match(await pa.textContent('[data-testid="fala-candidato"]'), /gasometria arterial/);
  const gaso = pa.locator('[data-carta="material"]:has-text("Gasometria")');
  await gaso.waitFor(); assert.match(await gaso.textContent(), /Pedido detectado na fala/);
  assert.equal(await pa.locator('[data-carta="material"]:has-text("Radiografia") .sl-dica').count(), 0, 'o raio-x não foi pedido');
  await gaso.locator('button:has-text("Liberar ao candidato")').click();
  await pa.waitForSelector('[data-carta="material"]:has-text("Gasometria") .sl-ok');
  await pm.waitForSelector('[data-carta="material"]:has-text("pH 7,38")', { timeout: 10000 });
  assert.equal(await pm.locator('[data-carta="material"]').count(), 1);
  assert.equal(await pm.locator('text=Radiografia').count(), 0, 'carta não liberada nem aparece');
  await pa.screenshot({ path: join(saida, 'exec-avaliador.png') });
});

await passo('avaliador vê as informações sob demanda organizadas por tipo, com progresso, e o enunciado do candidato em itens', async () => {
  assert.ok((await pa.locator('[data-testid="cartas"] [data-grupo]').count()) >= 2, 'grupos por tipo (laboratório, imagem…)');
  assert.match(await pa.textContent('[data-grupo="laboratorial"] summary'), /Exames laboratoriais/);
  assert.match(await pa.textContent('[data-grupo="imagem"] summary'), /Estudos de imagem/);
  assert.match(await pa.textContent('.sl-prog'), /1 de 2 liberadas/);
  assert.match(await pa.textContent('[data-grupo="imagem"]'), /Ver o que será mostrado/);
  assert.equal(await pm.locator('[data-grupo]').count(), 0, 'o candidato não vê os grupos nem o que está guardado');
  await pa.screenshot({ path: join(saida, 'exec-cartas-estruturadas.png'), fullPage: true });
});

await passo('conferência do PEP pela fala: sugestões com trecho, o avaliador decide; a nota é a dele', async () => {
  await pa.locator('button:has-text("Conferir o PEP pela fala")').click();
  await pa.waitForSelector('[data-testid="sugestao"]');
  const sugs = await pa.locator('[data-testid="sugestao"]').allTextContents();
  assert.ok(sugs.length >= 2); assert.ok(sugs.some((s) => /tabagismo/.test(s)), 'mostra o trecho que sustenta');
  const it2 = pa.locator('.sl-pep', { hasText: 'Investiga tabagismo e uso de inalador' });
  await it2.locator('button:has-text("usar")').click();
  assert.equal(await it2.locator('.sl-m.on').textContent(), 'Sim');
  await pa.locator('.sl-pep:has-text("início da falta") button:has-text("Sim")').click();      
  await pa.locator('.sl-pep:has-text("salbutamol") button:has-text("Não")').click();
  await pa.locator('.sl-pep:has-text("alarme") button:has-text("Parcial")').click();            // avaliador generoso: a fala nunca falou de sinais de alarme
});

await passo('menu discreto do avaliador: situação por item, equivalência, feedback e referência da bibliografia cadastrada', async () => {
  const bloco = pa.locator('.sl-pep', { hasText: 'salbutamol' });
  await bloco.locator('[data-testid="sugestao"] .sl-sit').waitFor();
  assert.match(await bloco.locator('.sl-sit').textContent(), /Não falou|Erro|Confusão/);
  await bloco.locator('[data-testid="sugestao-detalhe"] summary').click();
  const det = await bloco.locator('[data-testid="sugestao-detalhe"]').textContent();
  assert.match(det, /Equivalência com o critério/); assert.match(det, /Feedback/); assert.match(det, /PCDT Asma — Ministério da Saúde ★/);
  await pa.locator('[data-testid="analise-fala"] summary').click();
  const painel = await pa.locator('[data-testid="analise-fala"]').textContent();
  assert.match(painel, /Boa anamnese/); assert.match(painel, /R1 PCDT Asma/); assert.match(painel, /exigida/); assert.match(painel, /Onde conferir/);
  assert.equal(await pm.locator('[data-testid="analise-fala"]').count(), 0, 'o candidato nunca vê a análise');
  await pa.screenshot({ path: join(saida, 'exec-analise-fala.png'), fullPage: true });
});

await passo('ao finalizar a transcrição para: o reconhecimento é desligado e o servidor recusa fala nova', async () => {
  await pa.locator('button:has-text("Finalizar estação")').click(); await pa.waitForSelector('[data-testid="fim-estacao"]');
  await pm.waitForFunction(() => window.__recParou === true, null, { timeout: 15000 });
  assert.equal(await pm.locator('[data-testid="transcricao-candidato"]').count(), 0, 'o controle some com a estação');
  const antes = (await srv.q(`select count(*)::int n from transcricoes where execucao_id=$1`, [execId])).rows[0].n;
  const r = await chamar(sModa, 'POST', `/api/execucoes/${execId}/transcricao`, { texto: 'fala depois do fim' });
  assert.equal(r.status, 409); assert.equal(r.corpo.codigo, 'TRANSCRICAO_ENCERRADA');
  assert.equal((await srv.q(`select count(*)::int n from transcricoes where execucao_id=$1`, [execId])).rows[0].n, antes);
  assert.equal((await srv.q(`select final from analises_transcricao where execucao_id=$1 and final`, [execId])).rows.length, 1, 'a análise final foi feita ao encerrar');
});

await passo('ao finalizar, a autocorreção pela transcrição aparece sozinha: nota pela fala × nota do avaliador, divergências e fala por minuto', async () => {
  await pa.waitForSelector('[data-testid="autocorrecao"]', { timeout: 20000 });
  const t = await pa.textContent('[data-testid="autocorrecao"]');
  assert.match(t, /nota pela fala/); assert.match(t, /nota do avaliador/); assert.match(t, /diverg/);
  assert.ok((await pa.locator('[data-testid="autocorrecao"] .sl-auto-div li').count()) >= 1, 'lista os itens divergentes com feedback');
  await pa.locator('[data-testid="autocorrecao"] summary:has-text("Fala por minuto")').click();
  assert.match(await pa.textContent('[data-testid="autocorrecao"] .sl-minutos'), /º minuto/);
  await pa.screenshot({ path: join(saida, 'exec-autocorrecao.png'), fullPage: true });
});

await passo('painel de análise do candidato: resumo, seções, comparação, itens × fala e transcrição com trecho destacado', async () => {
  await pm.waitForSelector('[data-testid="fim-estacao"]', { timeout: 15000 });
  await pm.locator('button:has-text("Ver análise completa da estação")').click(); await pm.waitForSelector('[data-testid="painel-analise"]'); await abrirTudo(pm);
  assert.match(await pm.textContent('.an-kpis'), /de 5 pts/);
  if (process.env.DEBUG_UI) console.log(JSON.stringify((await srv.q(`select final, fonte, resumo from analises_transcricao where execucao_id=$1`, [execId])).rows), '\n', (await pm.textContent('[data-testid="resumo"]')).slice(0, 500), srv.ia.chamadas.slice(-6).map((c) => c[0]));
  assert.match(await pm.textContent('[data-testid="resumo"]'), /Verbalize droga, dose e via/);
  assert.equal(await pm.locator('[data-testid="secoes"] .an-linha-barra').count(), 2);
  assert.ok(await pm.locator('[data-testid="comparacao"] .an-linha-barra.atual').count(), 'comparação destaca a estação atual');
  assert.ok(await pm.locator('[data-testid="itens"] .an-item.div').count() >= 1, 'item em que a marcação passou a fala fica destacado');
  // a fala literal só aparece quando o avaliador liberar; a análise (itens × fala, resumo) já está lá
  assert.equal(await pm.locator('[data-testid="transcricao-oculta"]').count(), 1, 'transcrição escondida até a liberação');
  assert.equal(await pm.locator('[data-testid="transcricao"] mark').count(), 0, 'nenhum trecho literal vaza');
  assert.equal(await pm.locator('[data-testid="liberar-transcricao-analise"]').count(), 0, 'candidato não libera');
  assert.equal(await pm.locator('button:has-text("Revisar a nota")').count(), 0, 'só o avaliador revisa a nota');
  await pm.waitForTimeout(900); await pm.locator('[data-testid="painel-analise"]').screenshot({ path: join(saida, 'exec-analise.png') });
});

await passo('cartões de revisão dos pontos escolhidos ficam ligados à estação e entram na repetição espaçada', async () => {
  const pontos = await pm.locator('[data-testid="itens"] input[type=checkbox]:checked').count();
  assert.ok(pontos >= 2, 'os itens não feitos já vêm marcados');
  await pm.locator('button:has-text("Cartões do checklist")').click();
  await pm.waitForSelector('text=criado(s) e já na sua repetição espaçada');
  const c = (await srv.q(`select count(*)::int n, count(estacao_id)::int com from cartoes where estacao_id=$1`, [est])).rows[0];
  assert.equal(c.n, pontos); assert.equal(c.com, pontos);
  await pm.locator('button:has-text("Estudar agora")').click(); await pm.waitForSelector('[data-testid="cartao"]');
  assert.match(await pm.textContent('[data-testid="cartao-estacao"]'), /Asma agudizada na UBS/);
});

await passo('nova estação com outra abordagem: a IA recebe os pontos escolhidos e o rascunho abre em Criar', async () => {
  await pm.locator('nav button:has-text("Início")').click(); await pm.waitForSelector('[data-testid="estacoes-feitas"]');
  await pm.locator('[data-testid="estacoes-feitas"] button:has-text("Ver análise")').first().click(); await abrirTudo(pm); await pm.waitForSelector('[data-testid="acoes"]');
  await pm.fill('input[placeholder^="Ex.: paciente chega pelo pronto-socorro"]', 'paciente chega pelo pronto-socorro');
  await pm.locator('button:has-text("Gerar nova estação")').click();
  await pm.waitForSelector('.est-editor'); assert.match(await pm.textContent('.aviso'), /outra abordagem/);
  const ch = srv.ia.chamadas.filter((c) => c[0] === 'variar').at(-1)[1];
  assert.equal(ch.abordagem, 'paciente chega pelo pronto-socorro'); assert.ok(ch.foco.length >= 2);
  assert.match(await pm.getByLabel('Título', { exact: true }).first().inputValue(), /^Variação: Asma agudizada/);
});

await passo('o avaliador libera a transcrição pelo Início; o candidato passa a reler a fala minuto a minuto', async () => {
  await pa.locator('nav button:has-text("Início")').click(); await pa.waitForSelector('[data-testid="painel-avaliador"]');
  assert.match(await pa.textContent('[data-testid="painel-avaliador"]'), /Asma agudizada na UBS/);
  assert.match(await pa.textContent('[data-testid="painel-avaliador"]'), /transcrição só com você/);
  await pa.screenshot({ path: join(saida, 'exec-inicio-avaliador.png'), fullPage: true });
  await pa.locator('[data-testid="liberar-transcricao"]').first().click();
  await pa.waitForSelector('[data-testid="liberar-transcricao"]:has-text("Retirar")');
  assert.equal((await srv.q(`select transcricao_liberada from execucoes where id=$1`, [execId])).rows[0].transcricao_liberada, true);
  await pm.locator('nav button:has-text("Início")').click(); await pm.waitForSelector('[data-testid="estacoes-feitas"]');
  await pm.locator('[data-testid="estacoes-feitas"] button:has-text("Ver análise")').first().click(); await pm.waitForSelector('[data-testid="painel-analise"]'); await abrirTudo(pm);
  await pm.waitForSelector('[data-testid="fala-por-minuto"]');
  assert.ok(await pm.locator('[data-testid="transcricao"] mark').count() >= 1, 'trecho da fala destacado depois de liberado');
  assert.equal(await pm.locator('[data-testid="transcricao-oculta"]').count(), 0);
  await pm.locator('[data-testid="transcricao"]').screenshot({ path: join(saida, 'exec-transcricao-liberada.png') });
  // o avaliador volta atrás: o texto some para o candidato
  await pa.locator('[data-testid="liberar-transcricao"]').first().click(); await pa.waitForSelector('[data-testid="liberar-transcricao"]:has-text("Liberar transcrição")');
  await pm.reload(); await pm.waitForSelector('nav'); await pm.locator('nav button:has-text("Início")').click(); await pm.waitForSelector('[data-testid="estacoes-feitas"]');
  await pm.locator('[data-testid="estacoes-feitas"] button:has-text("Ver análise")').first().click(); await abrirTudo(pm); await pm.waitForSelector('[data-testid="transcricao-oculta"]');
  await pa.locator('nav button:has-text("Ciclos")').click();
});

await passo('avaliador revisa a nota com base na fala; a nota original fica registrada', async () => {
  await pa.waitForSelector('[data-testid="fim-estacao"]');
  await pa.locator('button:has-text("Ver análise completa da estação")').click(); await pa.waitForSelector('[data-testid="painel-analise"]'); await abrirTudo(pa);
  await pa.locator('button:has-text("Revisar a nota")').click();
  await pa.locator('.an-item:has-text("alarme") button:has-text("usar o da fala")').click();
  await pa.locator('button:has-text("Salvar nova nota")').click();
  await pa.waitForSelector('text=Nota revisada');
  await pa.waitForFunction(() => /revisada \(era/.test(document.querySelector('.an-kpis')?.textContent ?? ''), null, { timeout: 8000 });
  const e = (await srv.q(`select nota, nota_original from execucoes where id=$1`, [execId])).rows[0];
  assert.ok(Number(e.nota) < Number(e.nota_original), 'a fala sustentava menos do que a marcação inicial');
});

await passo('estações já feitas: Início lista e abre o painel; celular sem rolagem lateral', async () => {
  const p = await abrir(sModa, { w: 390, h: 800 });
  await p.locator('nav button:has-text("Início")').click(); await p.waitForSelector('[data-testid="estacoes-feitas"]');
  await p.locator('[data-testid="estacoes-feitas"] button:has-text("Ver análise")').first().click(); await p.waitForSelector('[data-testid="painel-analise"]'); await abrirTudo(p);
  const sobra = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  assert.ok(sobra <= 1, `sobra ${sobra}px`);
  await p.screenshot({ path: join(saida, 'exec-analise-celular.png') });
});

await passo('análise em quadros: índice resumido, minimizar, reordenar por arrastar, modo em sequência e volta ao compacto', async () => {
  const p = await abrir(sModa, { w: 1100, h: 900 });
  await p.evaluate(() => { for (const k of Object.keys(localStorage)) if (k.startsWith('rv_analise')) localStorage.removeItem(k); });
  await p.locator('nav button:has-text("Início")').click(); await p.waitForSelector('[data-testid="estacoes-feitas"]');
  await p.locator('[data-testid="estacoes-feitas"] button:has-text("Ver análise")').first().click(); await p.waitForSelector('[data-testid="painel-quadros"]');
  // compacto: índice com tiles resumidos e só o resumo aberto
  assert.ok(await p.locator('[data-testid="indice-quadros"] li').count() >= 5, 'índice com um quadro resumido por bloco');
  assert.equal(await p.locator('[data-testid="resumo"]').count(), 1); assert.equal(await p.locator('[data-testid="itens"]').count(), 0, 'itens só abrem pelo índice');
  assert.match(await p.textContent('[data-testid="tile-itens"]'), /itens/);
  await p.locator('[data-testid="tile-itens"]').click(); await p.waitForSelector('[data-testid="itens"] .an-item');
  await p.locator('[data-testid="tile-secoes"]').click(); await p.waitForSelector('[data-testid="secoes"]');
  // minimizar esconde o corpo e mostra o resumo no cabeçalho
  await p.locator('[data-testid="secoes"] button[aria-label^="Minimizar"]').click();
  assert.equal(await p.locator('[data-testid="secoes"] .an-linha-barra').count(), 0, 'corpo some ao minimizar');
  await p.locator('[data-testid="secoes"] button[aria-label^="Expandir"]').click(); await p.waitForSelector('[data-testid="secoes"] .an-linha-barra');
  // reordenar arrastando o cabeçalho de "secoes" sobre "resumo"
  const ordem = () => p.$$eval('.pq-quadro', (ns) => ns.map((n) => n.dataset.testid));
  const antes = await ordem();
  await p.locator('[data-testid="secoes"] .pq-cab').dragTo(p.locator('[data-testid="resumo"]'));
  const depois = await ordem(); assert.notDeepEqual(depois, antes, 'a ordem muda ao arrastar');
  await p.reload(); await p.locator('nav button:has-text("Início")').click(); await p.waitForSelector('[data-testid="estacoes-feitas"]');
  await p.locator('[data-testid="estacoes-feitas"] button:has-text("Ver análise")').first().click(); await p.waitForSelector('[data-testid="painel-quadros"]');
  assert.deepEqual(await ordem(), depois, 'a ordem escolhida fica guardada depois de recarregar');
  // modo em sequência: todos os quadros, um abaixo do outro
  await p.locator('[data-testid="modo-linear"]').check();
  assert.ok(await p.locator('.pq-quadro').count() >= 5, 'todos os quadros aparecem');
  assert.equal(await p.locator('[data-testid="indice-quadros"]').count(), 0, 'sem índice em sequência');
  await p.screenshot({ path: join(saida, 'exec-analise-sequencia.png'), fullPage: true });
  await p.locator('[data-testid="modo-linear"]').uncheck();
  await p.waitForSelector('[data-testid="indice-quadros"]');
  await p.screenshot({ path: join(saida, 'exec-analise-compacta.png') });
  const sobra = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth); assert.ok(sobra <= 1);
});

await nav.close(); srv.fechar();
console.log(falhas.length ? `\n${falhas.length} falha(s)` : '\nTodos os passos passaram.');
process.exit(falhas.length ? 1 : 0);
