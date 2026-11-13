// Diagnóstico dos serviços externos (IA, e-mail) usando a mesma configuração do servidor.
// Uso (no contêiner da API): node src/diagnostico-servicos.js
// Mostra só nomes de chave e se funcionou — nunca os valores.
import 'dotenv/config';
import pool, { q } from './db.js';
import { criarConfig } from './config.js';
import { criarIA } from './ia.js';
import { criarEmailer } from './email.js';

const SEGREDO = process.env.JWT_SEGREDO || 'troque-em-producao';   // o mesmo do servidor (decifra os parâmetros do banco)
const cfg = criarConfig({ q, segredo: SEGREDO });
const MOTIVOS = { sem_chave: 'sem chave', auth: 'chave recusada (inválida ou revogada)', credito: 'sem créditos/cota', limite: 'limite de uso no momento',
  rede: 'sem conexão', timeout: 'demorou demais', formato: 'resposta inesperada', servidor: 'erro no provedor' };
try {
  await cfg.carregar().catch(() => {});
  const ia = criarIA({ cfg, timeoutMs: 25_000 });
  console.log('IA (ordem do failsafe):');
  let algum = false;
  for (const r of await ia.testar()) {
    if (!r.configurado) { console.log(`   –  ${r.rotulo}: sem chave`); continue; }
    algum ||= r.ok;
    console.log(`   ${r.ok ? '✔' : '✘'}  ${r.rotulo} · ${r.chave}: ${r.ok ? `funciona (${r.ms} ms)` : MOTIVOS[r.motivo] || r.motivo}`);
  }
  console.log(algum ? '   => a IA está disponível (o app usa a primeira que funcionar)' : '   => nenhuma chave de IA funcionou');
  const email = criarEmailer({ env: { get SMTP_URL() { return cfg.obter('SMTP_URL'); }, get EMAIL_DE() { return cfg.obter('EMAIL_DE'); }, NODE_ENV: 'production' }, log: { warn() {}, error() {}, log() {} } });
  const ev = await email.verificar();
  console.log(`E-mail (SMTP): ${ev.estado === 'ok' ? '✔ conexão e login confirmados' : ev.estado === 'nao_configurado' ? '– não configurado' : `✘ ${ev.estado}${ev.motivo ? ` (${String(ev.motivo).replace(/[^\w .:-]/g, '').slice(0, 80)})` : ''}`}`);
} finally { await pool.end().catch(() => {}); }
