// Servidor de e-mail (SMTP) em campos separados <-> SMTP_URL (o formato que o servidor guarda).
// Aceita colar um bloco no formato .env (SMTP_HOST=…, SMTP_PORT=…, SMTP_SECURE=…, SMTP_USER=…, SMTP_PASS=…, MAIL_FROM=…);
// linhas de IMAP e outras são ignoradas (o app só envia e-mail).

export const SMTP_VAZIO = { host: '', porta: '465', seguranca: 'ssl', usuario: '', senha: '', remetente: '' };

/** seguranca: 'ssl' (SSL/TLS direto, porta 465), 'starttls' (porta 587), 'nenhuma' (porta 25, só redes internas) */
export function montarSmtpUrl(s) {
  const host = String(s.host || '').trim();
  if (!host) return '';
  if (!/^[A-Za-z0-9.-]+$/.test(host)) throw new Error('Servidor SMTP inválido (use só o nome, ex.: smtp.hostinger.com).');
  const porta = String(s.porta || '').trim() || (s.seguranca === 'ssl' ? '465' : '587');
  if (!/^\d{1,5}$/.test(porta) || +porta < 1 || +porta > 65535) throw new Error('Porta SMTP inválida.');
  const proto = s.seguranca === 'ssl' ? 'smtps' : 'smtp';
  const u = String(s.usuario || '').trim();
  const auth = u ? `${encodeURIComponent(u)}:${encodeURIComponent(String(s.senha ?? ''))}@` : '';
  const extra = s.seguranca === 'nenhuma' ? '?ignoreTLS=true' : '';
  return `${proto}://${auth}${host}:${porta}${extra}`;
}

/** Lê um SMTP_URL de volta para os campos (para exibir; a senha não volta do servidor). */
export function lerSmtpUrl(url) {
  try {
    const x = new URL(url);
    const ssl = x.protocol === 'smtps:';
    return { ...SMTP_VAZIO, host: x.hostname, porta: x.port || (ssl ? '465' : '587'),
      seguranca: ssl ? 'ssl' : (x.searchParams.get('ignoreTLS') === 'true' ? 'nenhuma' : 'starttls'),
      usuario: decodeURIComponent(x.username), senha: decodeURIComponent(x.password) };
  } catch { return { ...SMTP_VAZIO }; }
}

const sim = (v) => /^(1|true|sim|yes|ssl|tls)$/i.test(String(v).trim());

/** Interpreta um bloco colado (KEY=VALOR por linha; aspas e "export" opcionais). Devolve só os campos encontrados. */
export function lerBlocoSmtp(texto) {
  const v = {};
  for (const linha of String(texto).split(/\r?\n/)) {
    const m = linha.match(/^\s*(?:export\s+)?([A-Z_][A-Z0-9_]*)\s*[=:]\s*(.*?)\s*$/i);
    if (!m) continue;
    let val = m[2];
    if (/^(['"]).*\1$/.test(val)) val = val.slice(1, -1);
    v[m[1].toUpperCase()] = val;
  }
  let r = {};
  if (v.SMTP_URL) r = lerSmtpUrl(v.SMTP_URL);
  if (v.SMTP_HOST) r.host = v.SMTP_HOST;
  if (v.SMTP_PORT) r.porta = v.SMTP_PORT;
  if (v.SMTP_USER ?? v.SMTP_USERNAME) r.usuario = v.SMTP_USER ?? v.SMTP_USERNAME;
  if (v.SMTP_PASS ?? v.SMTP_PASSWORD) r.senha = v.SMTP_PASS ?? v.SMTP_PASSWORD;
  if (v.SMTP_SECURE !== undefined) r.seguranca = sim(v.SMTP_SECURE) ? 'ssl' : (String(r.porta || v.SMTP_PORT) === '25' ? 'nenhuma' : 'starttls');
  else if (v.SMTP_PORT) r.seguranca = v.SMTP_PORT === '465' ? 'ssl' : v.SMTP_PORT === '25' ? 'nenhuma' : 'starttls';
  const de = v.MAIL_FROM ?? v.EMAIL_DE ?? v.SMTP_FROM;
  if (de) r.remetente = de;
  return r;
}

/** "info@m3d.pro" vira "Nome <info@m3d.pro>"; um remetente já com nome fica como está. */
export function formatarRemetente(remetente, nome = 'Revalida Prático') {
  const r = String(remetente || '').trim();
  if (!r) return '';
  if (/<[^>]+>/.test(r)) return r;
  return /^[^\s@<>]+@[^\s@<>]+$/.test(r) ? `${nome || 'Revalida Prático'} <${r}>` : r;
}
