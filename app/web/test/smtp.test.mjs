import test from 'node:test';
import assert from 'node:assert/strict';
import { montarSmtpUrl, lerSmtpUrl, lerBlocoSmtp, formatarRemetente } from '../src/smtp.js';

const BLOCO = `SMTP_HOST=smtp.hostinger.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=info@exemplo.com
SMTP_PASS=@2Ab:c/d%
MAIL_FROM=info@exemplo.com
RECOVERY_DEV_TOKEN=false
Servidor de Entrada (IMAP)
IMAP_HOST=imap.hostinger.com
IMAP_PASS=xxx`;

test('bloco .env da Hostinger vira campos (IMAP ignorado)', () => {
  const r = lerBlocoSmtp(BLOCO);
  assert.deepEqual(r, { host: 'smtp.hostinger.com', porta: '465', usuario: 'info@exemplo.com', senha: '@2Ab:c/d%', seguranca: 'ssl', remetente: 'info@exemplo.com' });
});

test('URL montada codifica usuário e senha e volta igual', () => {
  const s = { host: 'smtp.hostinger.com', porta: '465', seguranca: 'ssl', usuario: 'info@exemplo.com', senha: '@2Ab:c/d%' };
  const url = montarSmtpUrl(s);
  assert.equal(url, 'smtps://info%40exemplo.com:%402Ab%3Ac%2Fd%25@smtp.hostinger.com:465');
  assert.ok(!/\s/.test(url) && /^smtps?:\/\//.test(url));          // passa no validador do servidor
  const de = lerSmtpUrl(url);
  assert.equal(de.usuario, s.usuario); assert.equal(de.senha, s.senha); assert.equal(de.host, s.host); assert.equal(de.seguranca, 'ssl');
});

test('STARTTLS 587 e sem segurança', () => {
  assert.equal(montarSmtpUrl({ host: 'smtp-relay.brevo.com', porta: '587', seguranca: 'starttls', usuario: 'a', senha: 'b' }), 'smtp://a:b@smtp-relay.brevo.com:587');
  assert.equal(montarSmtpUrl({ host: 'mail.local', porta: '25', seguranca: 'nenhuma' }), 'smtp://mail.local:25?ignoreTLS=true');
  assert.deepEqual(lerBlocoSmtp('SMTP_HOST=x.com\nSMTP_PORT=587\nSMTP_SECURE=false'), { host: 'x.com', porta: '587', seguranca: 'starttls' });
});

test('servidor vazio = não mexe; valores inválidos avisam', () => {
  assert.equal(montarSmtpUrl({ host: '' }), '');
  assert.throws(() => montarSmtpUrl({ host: 'smtp://x.com', porta: '465' }));
  assert.throws(() => montarSmtpUrl({ host: 'x.com', porta: '99999' }));
});

test('remetente ganha nome', () => {
  assert.equal(formatarRemetente('info@exemplo.com', 'Revalida Prático'), 'Revalida Prático <info@exemplo.com>');
  assert.equal(formatarRemetente('Equipe <a@b.c>'), 'Equipe <a@b.c>');
});
