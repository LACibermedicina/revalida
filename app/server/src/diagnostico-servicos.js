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
  const ia = criarIA({ cfg, timeoutMs: 60_000 });   // o mesmo prazo de uma chamada real
  console.log('IA (ordem do failsafe):');
  let algum = false;
  for (const r of await ia.testar()) {
    if (!r.configurado) { console.log(`   –  ${r.rotulo}: sem chave`); continue; }
    algum ||= r.ok;
    console.log(`   ${r.ok ? '✔' : '✘'}  ${r.rotulo} · ${r.chave}: ${r.ok ? `funciona (${r.ms} ms)` : MOTIVOS[r.motivo] || r.motivo}`);
  }
  console.log(algum ? '   => a IA está disponível (o app usa a primeira que funcionar)' : '   => nenhuma chave de IA funcionou');
  // Gemini que não respondeu a tempo: a chave lista modelos? outro modelo responde? (descobre se o problema é a chave ou o modelo)
  const lento = (await ia.testar().catch(() => [])).find((r) => r.provedor === 'gemini' && r.configurado && r.motivo === 'timeout');
  const chaveG = lento && cfg.obter(lento.chave);
  if (chaveG) {
    const H = { 'x-goog-api-key': chaveG, 'content-type': 'application/json' }, base = 'https://generativelanguage.googleapis.com/v1beta';
    const comPrazo = (ms) => AbortSignal.timeout(ms);
    try {
      const r = await fetch(`${base}/models?pageSize=200`, { headers: H, signal: comPrazo(15_000) });
      const d = await r.json().catch(() => ({}));
      const nomes = (d.models || []).map((m) => m.name.replace('models/', '')).filter((n) => /flash|pro/.test(n) && !/tts|image|embedding|live|audio/.test(n));
      console.log(`   Gemini · ${lento.chave}: lista de modelos ${r.ok ? `ok (${nomes.length}): ${nomes.slice(0, 8).join(', ')}` : `HTTP ${r.status}`}`);
      for (const m of ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-2.5-flash-lite'].filter((x) => !nomes.length || nomes.includes(x))) {
        const t0 = Date.now();
        try {
          const g = await fetch(`${base}/models/${m}:generateContent`, { method: 'POST', headers: H, signal: comPrazo(30_000),
            body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: 'Responda apenas: ok' }] }], generationConfig: { maxOutputTokens: 64 } }) });
          console.log(`   Gemini · ${lento.chave} com o modelo ${m}: ${g.ok ? `✔ responde (${Date.now() - t0} ms)` : `✘ HTTP ${g.status}`}`);
          if (g.ok) { console.log(`   => sugestão: use GEMINI_MODEL=${m} no SERVIDOR_ENV`); break; }
        } catch (e) { console.log(`   Gemini · ${lento.chave} com o modelo ${m}: ✘ ${e.name === 'TimeoutError' ? 'demorou demais' : 'sem conexão'}`); }
      }
    } catch (e) { console.log(`   Gemini · ${lento.chave}: lista de modelos ✘ ${e.name === 'TimeoutError' ? 'demorou demais' : 'sem conexão'}`); }
  }
  const email = criarEmailer({ env: { get SMTP_URL() { return cfg.obter('SMTP_URL'); }, get EMAIL_DE() { return cfg.obter('EMAIL_DE'); }, NODE_ENV: 'production' }, log: { warn() {}, error() {}, log() {} } });
  const ev = await email.verificar();
  console.log(`E-mail (SMTP): ${ev.estado === 'ok' ? '✔ conexão e login confirmados' : ev.estado === 'nao_configurado' ? '– não configurado' : `✘ ${ev.estado}${ev.motivo ? ` (${String(ev.motivo).replace(/[^\w .:-]/g, '').slice(0, 80)})` : ''}`}`);
} finally { await pool.end().catch(() => {}); }
