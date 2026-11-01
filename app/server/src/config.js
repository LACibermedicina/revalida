// Parâmetros do servidor: variável de ambiente tem prioridade; senão vale o que o instalador gravou em `config_servidor`.
// Valores secretos são cifrados com AES-256-GCM (chave derivada de JWT_SEGREDO) antes de ir para o banco.
import crypto from 'node:crypto';

/** Chaves aceitas. `segredo` = nunca é devolvido ao navegador, nem ao administrador. */
export const CHAVES = {
  APP_URL: { segredo: false },
  NOME_INSTITUICAO: { segredo: false },
  EMAIL_DE: { segredo: false },
  SMTP_URL: { segredo: true },
  AGORA_APP_ID: { segredo: false },
  AGORA_APP_CERTIFICATE: { segredo: true },
  PHP_TOKEN_URL: { segredo: false },
  ANTHROPIC_API_KEY: { segredo: true },   // IA que cria estações (opcional)
  IA_MODELO: { segredo: false },          // modelo do Claude
  IA_ORDEM: { segredo: false },           // ordem do failsafe, ex.: gemini,openai,pollinations,claude
  GEMINI_API_KEY: { segredo: true }, GOOGLE_API_KEY: { segredo: true }, GEMINI_CURL_API_KEY: { segredo: true }, GEMINI_MODEL: { segredo: false },
  OPENAI_API_KEY: { segredo: true }, OPENAI_MODEL: { segredo: false },
  AI_INTEGRATIONS_OPENAI_BASE_URL: { segredo: false }, AI_INTEGRATIONS_OPENAI_API_KEY: { segredo: true },
  POLLINATIONS_API_KEY: { segredo: true }, POLLINATIONS_MODEL: { segredo: false },
};

const PROVEDORES_IA = ['gemini', 'openai', 'pollinations', 'claude'];
const urlHttp = (v) => { const u = new URL(v); if (!/^https?:$/.test(u.protocol)) throw 0; return u; };
const ehChaveIA = (k) => CHAVES[k]?.segredo && /(_API_KEY)$/.test(k);
const ehModeloIA = (k) => /(_MODEL|^IA_MODELO)$/.test(k);
const VALIDADORES = {
  APP_URL: (v) => urlHttp(v).origin,
  PHP_TOKEN_URL: (v) => urlHttp(v).toString(),
  NOME_INSTITUICAO: (v) => { if (v.length > 120) throw 0; return v; },
  EMAIL_DE: (v) => { if (v.length > 200 || /[\r\n]/.test(v)) throw 0; return v; },
  SMTP_URL: (v) => { if (!/^smtps?:\/\//i.test(v) || v.length > 500 || /\s/.test(v)) throw 0; return v; },
  AGORA_APP_ID: (v) => { if (!/^[0-9a-f]{32}$/i.test(v)) throw 0; return v.toLowerCase(); },
  AGORA_APP_CERTIFICATE: (v) => { if (!/^[0-9a-f]{32}$/i.test(v)) throw 0; return v.toLowerCase(); },
  IA_ORDEM: (v) => { const l = v.split(',').map((x) => x.trim().toLowerCase()).filter(Boolean); if (!l.length || !l.every((x) => PROVEDORES_IA.includes(x))) throw 0; return [...new Set(l)].join(','); },
  AI_INTEGRATIONS_OPENAI_BASE_URL: (v) => { const u = urlHttp(v); return `${u.origin}${u.pathname}`.replace(/\/$/, ''); },
};
/** Valida e normaliza o valor de uma chave de configuração; lança se for inválido. Chaves de IA: sem espaços, tamanho razoável. */
export function validarConfig(chave, valor) {
  const v = String(valor).trim();
  if (VALIDADORES[chave]) return VALIDADORES[chave](v);
  if (ehChaveIA(chave)) { if (!/^[\x21-\x7e]{16,400}$/.test(v)) throw 0; return v; }
  if (ehModeloIA(chave)) { if (!/^[A-Za-z0-9._:\-\/]{1,80}$/.test(v)) throw 0; return v; }
  throw 0;
}
/** Aplica um conjunto de valores: ambiente manda; segredo vazio = manter; não-segredo vazio = limpar. */
export async function aplicarConfig(cfg, corpo = {}) {
  const aplicados = [], ignorados = [], invalidos = [];
  for (const chave of Object.keys(CHAVES)) {
    const bruto = corpo[chave];
    if (bruto === undefined || bruto === null) continue;
    if (cfg.origem(chave) === 'ambiente') { ignorados.push(chave); continue; }
    const v = String(bruto).trim();
    if (v === '') { if (!CHAVES[chave].segredo) { await cfg.definir(chave, null); aplicados.push(chave); } continue; }
    try { await cfg.definir(chave, validarConfig(chave, v)); aplicados.push(chave); } catch { invalidos.push(chave); }
  }
  return { aplicados, ignorados, invalidos };
}

const chaveCifra = (segredo) => crypto.createHash('sha256').update(`config-servidor:${segredo}`).digest();

export function cifrar(texto, segredo) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', chaveCifra(segredo), iv);
  const ct = Buffer.concat([c.update(String(texto), 'utf8'), c.final()]);
  return [iv, c.getAuthTag(), ct].map((b) => b.toString('base64')).join('.');
}

export function decifrar(valor, segredo) {
  try {
    const [iv, tag, ct] = String(valor).split('.').map((p) => Buffer.from(p, 'base64'));
    const d = crypto.createDecipheriv('aes-256-gcm', chaveCifra(segredo), iv);
    d.setAuthTag(tag);
    return Buffer.concat([d.update(ct), d.final()]).toString('utf8');
  } catch {
    return undefined; // JWT_SEGREDO mudou ou dado corrompido: trata como não definido
  }
}

/** Nomes alternativos de variáveis de ambiente aceitos (ex.: SMTP_HOST/PORT/USER/PASS em vez de SMTP_URL). */
export function valorDoAmbiente(env, chave) {
  const v = env[chave];
  if (v !== undefined && v !== '') return v;
  if (chave === 'EMAIL_DE' && env.MAIL_FROM) return env.MAIL_FROM;
  if (chave === 'SMTP_URL' && env.SMTP_HOST) {
    const porta = env.SMTP_PORT || '465';
    const seguro = env.SMTP_SECURE ? env.SMTP_SECURE === 'true' : porta === '465';
    const cred = env.SMTP_USER ? `${encodeURIComponent(env.SMTP_USER)}:${encodeURIComponent(env.SMTP_PASS ?? '')}@` : '';
    return `${seguro ? 'smtps' : 'smtp'}://${cred}${env.SMTP_HOST}:${porta}`;
  }
  return undefined;
}

export function criarConfig({ q, env = process.env, segredo }) {
  const cache = new Map();
  return {
    async carregar() {
      const r = await q('select chave, valor, segredo from config_servidor');
      cache.clear();
      for (const l of r.rows) {
        if (!(l.chave in CHAVES)) continue;
        const v = l.segredo ? decifrar(l.valor, segredo) : l.valor;
        if (v !== undefined) cache.set(l.chave, v);
      }
    },
    /** Valor efetivo (ambiente > banco) ou undefined. */
    obter(chave) {
      return valorDoAmbiente(env, chave) ?? cache.get(chave);
    },
    origem(chave) {
      if (valorDoAmbiente(env, chave) !== undefined) return 'ambiente';
      return cache.has(chave) ? 'instalador' : 'nenhuma';
    },
    async definir(chave, valor) {
      const def = CHAVES[chave];
      if (!def) throw new Error('chave desconhecida');
      if (valor === null || valor === '') {
        await q('delete from config_servidor where chave=$1', [chave]);
        cache.delete(chave);
        return;
      }
      const guardado = def.segredo ? cifrar(valor, segredo) : String(valor);
      await q(
        `insert into config_servidor (chave, valor, segredo) values ($1,$2,$3)
         on conflict (chave) do update set valor=excluded.valor, segredo=excluded.segredo, atualizado_em=now()`,
        [chave, guardado, def.segredo],
      );
      cache.set(chave, String(valor));
    },
    /** Visão segura para o navegador: segredos viram só "definido". */
    visao() {
      return Object.fromEntries(Object.entries(CHAVES).map(([k, d]) => [k, {
        origem: this.origem(k),
        definido: this.obter(k) !== undefined,
        ...(d.segredo ? {} : { valor: this.obter(k) ?? '' }),
      }]));
    },
  };
}
