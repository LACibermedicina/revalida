// Chaves de IA: validação, gravação cifrada pelo root depois de instalado, nunca devolvidas, e a IA passa a "configurada".
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { bcryptFalso, criarApp, criarBanco, criarQ, jwtFalso } from './ajuda.mjs';
import { criarAssinar, criarAutenticar } from '../src/auth.js';
import { aplicarConfig, criarConfig, validarConfig } from '../src/config.js';
import { registrarInstalacao, registrarManutencao } from '../src/instalacao.js';
import { criarEmailer } from '../src/email.js';
import { criarAgora } from '../src/agora.js';
import { criarIA } from '../src/ia.js';

const banco = criarBanco('rv_cfgia');
const q = criarQ(banco.nome);
after(() => banco.derrubar());
const SEG = 'segredo-de-teste-com-mais-de-32-caracteres!!';
const silencioso = { log() {}, warn() {}, error() {} };
const assinar = criarAssinar({ jwt: jwtFalso, segredo: SEG });
const autenticar = criarAutenticar({ q, jwt: jwtFalso, segredo: SEG });
const mk = async (nome, papel) => (await q(`insert into usuarios (nome,email,senha_hash,papel_app) values ($1,$2,'x',$3) returning id`, [nome, `${nome}@x.com`, papel])).rows[0].id;
const tk = (id) => assinar({ id, papel_app: 'usuario', sessao_versao: 0 });
const CHAVE = 'AIzaSyFAKE-chave-de-teste_1234567890';

test('validarConfig: chaves de IA sem espaço e com tamanho razoável; ordem só com provedores conhecidos', () => {
  assert.equal(validarConfig('GEMINI_API_KEY', `  ${CHAVE}  `), CHAVE);
  assert.throws(() => validarConfig('GEMINI_API_KEY', 'curta'));
  assert.throws(() => validarConfig('OPENAI_API_KEY', 'tem espaço no meio da chave 1234567890'));
  assert.throws(() => validarConfig('ANTHROPIC_API_KEY', 'x'.repeat(401)));
  assert.equal(validarConfig('IA_ORDEM', 'Claude, gemini ,claude'), 'claude,gemini');
  assert.throws(() => validarConfig('IA_ORDEM', 'gemini,skynet'));
  assert.equal(validarConfig('IA_MODELO', 'claude-sonnet-5-5'), 'claude-sonnet-5-5');
  assert.throws(() => validarConfig('IA_MODELO', 'modelo; drop table'));
  assert.equal(validarConfig('AI_INTEGRATIONS_OPENAI_BASE_URL', 'https://proxy.exemplo/v1/'), 'https://proxy.exemplo/v1');
  assert.throws(() => validarConfig('AI_INTEGRATIONS_OPENAI_BASE_URL', 'ftp://x'));
  assert.throws(() => validarConfig('CHAVE_QUE_NAO_EXISTE', 'x'));
});

test('root grava as chaves de IA depois de instalado: cifradas, nunca devolvidas, auditadas sem o valor; a IA passa a configurada', async () => {
  const root = await mk('Raiz', 'root'); const adm = await mk('Adm', 'admin');
  const cfg = criarConfig({ q, env: {}, segredo: SEG });
  const ia = criarIA({ cfg });
  assert.equal(ia.configurado(), false);
  const { app, chamar } = criarApp();
  registrarManutencao(app, { q, autenticar, bcrypt: bcryptFalso, novoCodigo: () => 'X', cfg, log: silencioso });
  const P = (token, corpo) => chamar('POST', '/api/admin/config', { token, corpo });
  assert.equal((await P(tk(adm), { GEMINI_API_KEY: CHAVE })).status, 403, 'admin comum não mexe em chaves');
  assert.equal((await chamar('GET', '/api/admin/config', { token: tk(adm) })).status, 403);
  assert.equal((await P(null, {})).status, 401);
  const ruim = await P(tk(root), { GEMINI_API_KEY: 'curta', IA_ORDEM: 'gemini' });
  assert.equal(ruim.status, 400); assert.deepEqual(ruim.corpo.invalidos, ['GEMINI_API_KEY']);
  const ok = await P(tk(root), { GEMINI_API_KEY: CHAVE, IA_ORDEM: 'gemini,claude', IA_MODELO: 'claude-sonnet-5-5' });
  assert.equal(ok.status, 200); assert.deepEqual(ok.corpo.aplicados.sort(), ['GEMINI_API_KEY', 'IA_MODELO', 'IA_ORDEM']);
  assert.ok(!JSON.stringify(ok.corpo).includes(CHAVE), 'a chave não volta na resposta');
  assert.equal(ok.corpo.config.GEMINI_API_KEY.definido, true); assert.equal('valor' in ok.corpo.config.GEMINI_API_KEY, false);
  assert.equal(ok.corpo.config.IA_ORDEM.valor, 'gemini,claude');
  const guardado = (await q(`select valor, segredo from config_servidor where chave='GEMINI_API_KEY'`)).rows[0];
  assert.equal(guardado.segredo, true); assert.ok(!guardado.valor.includes('AIza'), 'cifrada em repouso');
  const aud = (await q(`select detalhes::text d from auditoria_admin where acao='config_alterada'`)).rows[0].d;
  assert.ok(aud.includes('GEMINI_API_KEY') && !aud.includes(CHAVE), 'a auditoria guarda o nome, não o valor');
  assert.equal(ia.configurado(), true, 'a IA enxerga a chave sem reiniciar o servidor');
  assert.deepEqual(ia.ordem(), ['gemini', 'claude']);
  // segredo vazio = manter; não-segredo vazio = limpar
  await P(tk(root), { GEMINI_API_KEY: '', IA_MODELO: '' });
  assert.equal(cfg.obter('GEMINI_API_KEY'), CHAVE); assert.equal(cfg.obter('IA_MODELO'), undefined);
  // sobrevive a reiniciar o servidor (recarrega do banco)
  const cfg2 = criarConfig({ q, env: {}, segredo: SEG }); await cfg2.carregar();
  assert.equal(criarIA({ cfg: cfg2 }).configurado(), true);
});

test('o ambiente continua mandando: chave vinda do .env não é sobrescrita pelo painel', async () => {
  const cfg = criarConfig({ q, env: { OPENAI_API_KEY: 'sk-proj-DOAMBIENTE-1234567890' }, segredo: SEG });
  const r = await aplicarConfig(cfg, { OPENAI_API_KEY: 'sk-proj-OUTRA-1234567890-xyz' });
  assert.deepEqual(r.ignorados, ['OPENAI_API_KEY']); assert.equal(cfg.obter('OPENAI_API_KEY'), 'sk-proj-DOAMBIENTE-1234567890');
});

test('instalador aceita as chaves de IA (opcionais) pela mesma validação', async () => {
  const cfg = criarConfig({ q, env: {}, segredo: SEG });
  const { app, chamar } = criarApp();
  const agora = criarAgora({ cfg, carregarBuilder: async () => ({}) });
  registrarInstalacao(app, { q, bcrypt: bcryptFalso, cfg, agora, emailer: criarEmailer({ env: { NODE_ENV: 'test' }, log: silencioso }), codigo: () => 'COD-1', segredoJwt: SEG, log: silencioso });
  await q(`delete from config_servidor`);
  const r = await chamar('POST', '/api/instalacao/config', { codigo: 'COD-1', corpo: { ANTHROPIC_API_KEY: 'sk-ant-FAKE-1234567890-abcdef', IA_ORDEM: 'claude' } });
  assert.equal(r.status, 200); assert.deepEqual(r.corpo.aplicados.sort(), ['ANTHROPIC_API_KEY', 'IA_ORDEM']);
  assert.equal(r.corpo.config.ANTHROPIC_API_KEY.definido, true);
  assert.equal((await chamar('POST', '/api/instalacao/config', { codigo: 'COD-1', corpo: { ANTHROPIC_API_KEY: 'curta' } })).status, 400);
});
