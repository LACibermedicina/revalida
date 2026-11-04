// Podcast, playlists, feeds, rádio radIA.m3d e pool de exportação (Postgres real; IA, TTS e site da rádio são falsos).
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { criarApp, criarBanco, criarQ } from './ajuda.mjs';
import { registrarPodcast } from '../src/podcast.js';
import { dividirTexto } from '../src/tts.js';
import { montarRSS, sincronizarPool } from '../src/radia.js';
import { validarRoteiro, duracaoEstimada } from '../src/podcast-ia.js';
import { validarConfig } from '../src/config.js';
import { ErroIA } from '../src/ia.js';

const bd = criarBanco('rv_podcast');
const q = criarQ(bd.nome);
const { app, chamar } = criarApp();
const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'rv-podcast-'));
const valores = { APP_URL: 'https://app.exemplo.com' };
const cfg = { obter: (k) => valores[k] ?? '' };
const ROTEIRO = Array.from({ length: 80 }, (_, i) => `palavra${i}`).join(' ') + '. Fim do episódio.';
const ia = { chamadas: [], falha: null, configurado: () => true, async gerarRoteiro(p) { this.chamadas.push(p); if (this.falha) throw this.falha; return { titulo: `Episódio sobre ${p.tema}`, roteiro: ROTEIRO }; } };
const ttsChamadas = []; let ttsStatus = 200;
const fetchFalso = async (url, init) => {
  const corpo = JSON.parse(init.body);
  if (String(url).includes('tts.exemplo')) {
    ttsChamadas.push({ url, auth: init.headers.authorization, corpo });
    return { ok: ttsStatus === 200, status: ttsStatus, arrayBuffer: async () => new Uint8Array([0xff, 0xfb, 0x90, 0x00, ...Array(60).fill(7)]).buffer };
  }
  radiaChamadas.push({ url, headers: init.headers, corpo });
  return { ok: radiaStatus === 200, status: radiaStatus, arrayBuffer: async () => new ArrayBuffer(0) };
};
const radiaChamadas = []; let radiaStatus = 200;
const autenticar = async (req, _res, prox) => {
  const id = String(req.headers.authorization).split(' ')[1];
  const u = (await q('select id, nome, papel_app from usuarios where id=$1', [id])).rows[0];
  req.usuario = { id, nome: u.nome, papel_app: u.papel_app }; prox();
};
before(() => { registrarPodcast(app, { q, autenticar, ia, cfg, fetchImpl: fetchFalso, dir, intervaloSyncMin: 0 }); });
after(async () => { bd.derrubar(); await fs.rm(dir, { recursive: true, force: true }); });

const uid = async (n, papel = 'usuario') => (await q(`insert into usuarios (nome,email,senha_hash,visto_em,papel_app) values ($1,$2,'x',now(),$3) returning id`, [n, `${n}${Math.random()}@x.com`, papel])).rows[0].id;
const api = (m, u, t, corpo, extra = {}) => chamar(m, u, { token: t, corpo, ...extra });
const ligarTTS = () => { valores.TTS_URL = 'https://tts.exemplo.com/v1'; valores.TTS_CHAVE = 'chave-tts-secreta-123'; valores.TTS_MODELO = 'tts-1'; valores.TTS_VOZ = 'nova'; };
const desligarTTS = () => { delete valores.TTS_URL; delete valores.TTS_CHAVE; };
const novaPlaylist = async (t, titulo = 'Minha playlist', prompt = '') => (await api('POST', '/api/podcast/playlists', t, { titulo, prompt })).corpo;

test('unidades: roteiro, divisão do texto e configuração do TTS/rádio', () => {
  assert.equal(validarRoteiro({ titulo: 'x', roteiro: 'curto' }).ok, false);
  const v = validarRoteiro({ titulo: 'Crise convulsiva', roteiro: `## Título\n- ponto **forte** ${ROTEIRO}` });
  assert.equal(v.ok, true); assert.ok(!/[#*]/.test(v.roteiro) && !/^-/m.test(v.roteiro), 'markdown some do texto falado');
  assert.equal(duracaoEstimada(Array(150).fill('a').join(' ')), 60);
  const longo = Array.from({ length: 900 }, (_, i) => `Frase número ${i} termina aqui.`).join(' ');
  const partes = dividirTexto(longo, 3800);
  assert.ok(partes.length > 1 && partes.every((p) => p.length <= 3800), 'cada pedaço cabe no limite do TTS');
  assert.equal(partes.join(' ').replace(/\s+/g, ' '), longo.replace(/\s+/g, ' '), 'nada se perde na divisão');
  assert.equal(validarConfig('TTS_URL', 'https://tts.exemplo.com/v1'), 'https://tts.exemplo.com/v1');
  assert.throws(() => validarConfig('TTS_URL', 'ftp://x'));
  assert.throws(() => validarConfig('RADIA_TOKEN', 'curto'));
  assert.equal(validarConfig('TTS_VOZ', 'nova'), 'nova');
  const xml = montarRSS({ titulo: 'A & B', descricao: 'd', link: 'https://x', itens: [{ id: '1', titulo: '<ep>', roteiro: 'texto ]]> fim', data: '2026-11-01T10:00:00Z', duracao_s: 60, audio: { url: 'https://x/a?b=1&c=2', bytes: 10, mime: 'audio/mpeg' } }] });
  assert.ok(xml.includes('A &amp; B') && xml.includes('&lt;ep&gt;') && xml.includes('b=1&amp;c=2') && xml.includes('<enclosure'), 'XML escapado e com enclosure');
});

test('sem TTS: episódio fica só com a transcrição (honesto), com posição e download do texto', async () => {
  desligarTTS();
  const ana = await uid('Ana');
  const cfgR = (await api('GET', '/api/podcast/config', ana)).corpo;
  assert.deepEqual([cfgR.ia, cfgR.tts, cfgR.radia], [true, false, false]);
  const pl = await novaPlaylist(ana, 'Pediatria', 'Fale devagar e use exemplos de plantão.');
  assert.equal((await api('POST', '/api/podcast/playlists', ana, { titulo: '' })).status, 400);
  const r = await api('POST', `/api/podcast/playlists/${pl.id}/itens`, ana, { tema: 'Crise convulsiva febril', area: 'pediatria', topico: 'conduta na crise prolongada', prompt: 'foque em doses', minutos: 4 });
  assert.equal(r.status, 201);
  assert.equal(r.corpo.item.status, 'roteiro'); assert.equal(r.corpo.item.tem_audio, false); assert.match(r.corpo.aviso, /TTS|voz/i);
  assert.equal(r.corpo.item.titulo, 'Episódio sobre Crise convulsiva febril', 'título vem da IA quando a pessoa não informa');
  const ch = ia.chamadas.at(-1);
  assert.equal(ch.promptPlaylist, 'Fale devagar e use exemplos de plantão.'); assert.equal(ch.promptItem, 'foque em doses'); assert.equal(ch.topico, 'conduta na crise prolongada'); assert.equal(ch.minutos, 4);
  assert.equal((await api('GET', `/api/podcast/itens/${r.corpo.item.id}/audio`, ana)).status, 404);
  const tr = await api('GET', `/api/podcast/itens/${r.corpo.item.id}/transcricao`, ana);
  assert.match(tr.headers['content-disposition'], /attachment/); assert.ok(tr.texto.includes('palavra10'));
  // outro usuário não vê
  const bia = await uid('Bia');
  assert.equal((await api('GET', `/api/podcast/playlists/${pl.id}`, bia)).status, 404);
  assert.equal((await api('GET', `/api/podcast/itens/${r.corpo.item.id}/transcricao`, bia)).status, 404);
  // posição: salva, continua depois, concluir tira da lista
  const it = r.corpo.item.id;
  assert.equal((await api('PUT', `/api/podcast/itens/${it}/posicao`, ana, { posicao_s: 42.5 })).status, 200);
  const cont = (await api('GET', '/api/podcast/continuar', ana)).corpo;
  assert.equal(cont.length, 1); assert.equal(cont[0].posicao_s, 42.5); assert.equal(cont[0].titulo, 'Episódio sobre Crise convulsiva febril');
  assert.equal((await api('PUT', `/api/podcast/itens/${it}/posicao`, bia, { posicao_s: 10 })).status, 404, 'episódio privado não aceita posição de outro');
  await api('PUT', `/api/podcast/itens/${it}/posicao`, ana, { posicao_s: 100, concluido: true });
  assert.equal((await api('GET', '/api/podcast/continuar', ana)).corpo.length, 0);
  const det = (await api('GET', `/api/podcast/playlists/${pl.id}`, ana)).corpo;
  assert.equal(det.itens[0].posicao_s, 100); assert.equal(det.itens[0].concluido, true); assert.equal(det.itens[0].tema, 'Crise convulsiva febril');
});

test('com TTS: áudio gerado, baixável com Range; editar o texto invalida o áudio; falha do TTS não perde o texto', async () => {
  ligarTTS(); ttsChamadas.length = 0;
  const ana = await uid('Ana2');
  const pl = await novaPlaylist(ana);
  const r = await api('POST', `/api/podcast/playlists/${pl.id}/itens`, ana, { tema: 'Sepse', titulo: 'Sepse em 5 minutos' });
  const item = r.corpo.item;
  assert.equal(item.status, 'pronto'); assert.equal(item.tem_audio, true); assert.equal(item.titulo, 'Sepse em 5 minutos'); assert.equal(r.corpo.aviso, undefined);
  assert.equal(ttsChamadas.length, 1); assert.equal(ttsChamadas[0].url, 'https://tts.exemplo.com/v1/audio/speech'); assert.equal(ttsChamadas[0].auth, 'Bearer chave-tts-secreta-123');
  assert.equal(ttsChamadas[0].corpo.voice, 'nova'); assert.equal(ttsChamadas[0].corpo.response_format, 'mp3');
  assert.ok(!JSON.stringify(r.corpo).includes('chave-tts'), 'a chave nunca sai');
  const a = await api('GET', `/api/podcast/itens/${item.id}/audio?baixar=1`, ana);
  assert.equal(a.status, 200); assert.equal(a.headers['content-type'], 'audio/mpeg'); assert.match(a.headers['content-disposition'], /Sepse em 5 minutos\.mp3/); assert.equal(a.buffer.length, 64);
  const parc = await api('GET', `/api/podcast/itens/${item.id}/audio`, ana, undefined, { headers: { range: 'bytes=10-19' } });
  assert.equal(parc.status, 206); assert.equal(parc.headers['content-range'], 'bytes 10-19/64'); assert.equal(parc.buffer.length, 10);
  assert.equal((await api('GET', `/api/podcast/itens/${item.id}/audio`, ana, undefined, { headers: { range: 'bytes=500-600' } })).status, 416);
  // editar o texto: áudio antigo some
  const ed = await api('PUT', `/api/podcast/itens/${item.id}`, ana, { roteiro: `${ROTEIRO} Acrescentei uma frase.` });
  assert.equal(ed.corpo.audio_invalidado, true); assert.equal(ed.corpo.item.tem_audio, false); assert.equal(ed.corpo.item.status, 'roteiro');
  assert.equal((await fs.readdir(dir)).filter((f) => f.startsWith(item.id)).length, 0, 'arquivo apagado do disco');
  // TTS fora do ar: texto continua, estado explica
  ttsStatus = 500;
  const g = await api('POST', `/api/podcast/itens/${item.id}/gerar`, ana, {});
  assert.equal(g.corpo.item.status, 'roteiro'); assert.match(g.corpo.aviso, /voz/i); assert.ok(g.corpo.item.roteiro.includes('Acrescentei'));
  ttsStatus = 200;
  const g2 = await api('POST', `/api/podcast/itens/${item.id}/gerar`, ana, {});
  assert.equal(g2.corpo.item.status, 'pronto'); assert.equal(g2.corpo.item.tem_audio, true);
  // excluir apaga o arquivo
  assert.equal((await api('DELETE', `/api/podcast/itens/${item.id}`, ana)).status, 200);
  assert.equal((await fs.readdir(dir)).filter((f) => f.startsWith(item.id)).length, 0);
});

test('IA fora do ar: episódio fica em erro, dá para colar a transcrição e gerar o áudio depois', async () => {
  desligarTTS();
  const ana = await uid('Ana3'); const pl = await novaPlaylist(ana);
  ia.falha = new ErroIA('IA_NAO_CONFIGURADA', 'A IA não está configurada neste servidor.');
  const r = await api('POST', `/api/podcast/playlists/${pl.id}/itens`, ana, { tema: 'Pré-eclâmpsia' });
  ia.falha = null;
  assert.equal(r.status, 201); assert.equal(r.corpo.item.status, 'erro'); assert.equal(r.corpo.codigo, 'IA_NAO_CONFIGURADA'); assert.match(r.corpo.item.erro, /IA/);
  const ed = await api('PUT', `/api/podcast/itens/${r.corpo.item.id}`, ana, { roteiro: ROTEIRO });
  assert.equal(ed.corpo.item.status, 'roteiro'); assert.ok(ed.corpo.item.duracao_s > 0);
  const refeito = await api('POST', `/api/podcast/itens/${r.corpo.item.id}/gerar`, ana, { refazer_roteiro: true });
  assert.equal(refeito.corpo.item.titulo, 'Pré-eclâmpsia'); assert.equal(refeito.corpo.item.status, 'roteiro');
});

test('revisão de cartões: exige cartões do tema e leva os piores para o roteiro', async () => {
  desligarTTS();
  const ana = await uid('Ana4'); const pl = await novaPlaylist(ana);
  const t = (await q(`insert into temas (nome, nome_norm, area) values ('Asma','asma','clinica_medica') returning id`)).rows[0].id;
  assert.equal((await api('POST', `/api/podcast/playlists/${pl.id}/itens`, ana, { tipo: 'revisao_cards', tema_id: t })).status, 400);
  const c1 = (await q(`insert into cartoes (tema_id, frente, verso) values ($1,'Qual a droga de resgate na crise de asma?','Salbutamol inalatório') returning id`, [t])).rows[0].id;
  await q(`insert into cartoes (tema_id, frente, verso) values ($1,'Quando usar corticoide sistêmico?','Crise moderada a grave')`, [t]);
  await q(`insert into cartao_progresso (usuario_id, cartao_id, erros) values ($1,$2,5)`, [ana, c1]);
  const r = await api('POST', `/api/podcast/playlists/${pl.id}/itens`, ana, { tipo: 'revisao_cards', tema_id: t });
  assert.equal(r.status, 201); assert.equal(r.corpo.item.tipo, 'revisao_cards'); assert.equal(r.corpo.item.titulo, 'Episódio sobre Asma');
  const ch = ia.chamadas.at(-1);
  assert.equal(ch.tipo, 'revisao_cards'); assert.equal(ch.cartoes.length, 2); assert.match(ch.cartoes[0].frente, /resgate/, 'o cartão mais errado vem primeiro');
});

test('feeds RSS: privado por credencial revogável e público opt-in; áudio só com token válido', async () => {
  ligarTTS();
  const ana = await uid('Ana5'); const bia = await uid('Bia5');
  const pl = await novaPlaylist(ana, 'Feed & teste');
  const it = (await api('POST', `/api/podcast/playlists/${pl.id}/itens`, ana, { tema: 'Dengue', titulo: 'Dengue <rápido>' })).corpo.item;
  // sem credencial nada abre
  assert.equal((await api('GET', `/api/podcast/feed/${pl.id}/${'x'.repeat(30)}`, undefined)).status, 404);
  const t1 = (await api('POST', '/api/podcast/token/renovar', ana)).corpo;
  assert.ok(t1.token.length >= 30); assert.equal(t1.feeds[0].url, `https://app.exemplo.com/api/podcast/feed/${pl.id}/${t1.token}`);
  assert.ok(!JSON.stringify((await api('GET', '/api/podcast/token', ana)).corpo).includes(t1.token), 'o token não é reexibido');
  const feed = await api('GET', `/api/podcast/feed/${pl.id}/${t1.token}`);
  assert.equal(feed.status, 200); assert.match(feed.headers['content-type'], /rss\+xml/);
  assert.ok(feed.texto.includes('<title>Feed &amp; teste</title>') && feed.texto.includes('Dengue &lt;rápido&gt;'));
  const m = /enclosure url="([^"]+)"/.exec(feed.texto); assert.ok(m, 'tem enclosure');
  assert.ok(m[1].startsWith(`https://app.exemplo.com/api/podcast/audio/${it.id}/${t1.token}`));
  const aud = await api('GET', `/api/podcast/audio/${it.id}/${t1.token}`); assert.equal(aud.status, 200); assert.equal(aud.buffer.length, 64);
  // a credencial de outra pessoa não abre a minha playlist
  const tb = (await api('POST', '/api/podcast/token/renovar', bia)).corpo.token;
  assert.equal((await api('GET', `/api/podcast/feed/${pl.id}/${tb}`)).status, 404);
  assert.equal((await api('GET', `/api/podcast/audio/${it.id}/${tb}`)).status, 404);
  // renovar revoga a anterior
  const t2 = (await api('POST', '/api/podcast/token/renovar', ana)).corpo.token;
  assert.equal((await api('GET', `/api/podcast/feed/${pl.id}/${t1.token}`)).status, 404);
  assert.equal((await api('GET', `/api/podcast/feed/${pl.id}/${t2}`)).status, 200);
  await api('DELETE', '/api/podcast/token', ana);
  assert.equal((await api('GET', `/api/podcast/feed/${pl.id}/${t2}`)).status, 404);
  // público: opt-in, link próprio; desligar mata o link
  const pub = (await api('POST', `/api/podcast/playlists/${pl.id}/publicar`, ana, { publica: true })).corpo;
  assert.equal(pub.publica, true); assert.match(pub.feed_publico, /\/api\/podcast\/feed\//);
  const tokPub = pub.feed_publico.split('/').pop();
  assert.equal((await api('GET', `/api/podcast/feed/${pl.id}/${tokPub}`)).status, 200);
  assert.equal((await api('POST', `/api/podcast/playlists/${pl.id}/publicar`, ana, { publica: true })).corpo.feed_publico, pub.feed_publico, 'mesmo link ao religar sem desligar');
  await api('POST', `/api/podcast/playlists/${pl.id}/publicar`, ana, { publica: false });
  assert.equal((await api('GET', `/api/podcast/feed/${pl.id}/${tokPub}`)).status, 404);
  assert.equal((await api('GET', `/api/podcast/feed/not-a-uuid/${tokPub}`)).status, 400);
});

test('radIA.m3d: só entra episódio com transcrição; programa, áudio e feed abertos; edição retira; admin modera', async () => {
  ligarTTS();
  const ana = await uid('Ana6'); const bia = await uid('Bia6'); const adm = await uid('Adm', 'admin');
  const pl = await novaPlaylist(ana);
  const ia0 = ia.falha; ia.falha = new ErroIA('IA_FALHA', 'x');
  const vazio = (await api('POST', `/api/podcast/playlists/${pl.id}/itens`, ana, { tema: 'Tema vazio' })).corpo.item; ia.falha = ia0;
  assert.equal((await api('PUT', `/api/podcast/itens/${vazio.id}/radia`, ana, { publico: true })).status, 400);
  const it = (await api('POST', `/api/podcast/playlists/${pl.id}/itens`, ana, { tema: 'Hipertensão', titulo: 'HAS na rádio' })).corpo.item;
  assert.equal((await api('PUT', `/api/podcast/itens/${it.id}/radia`, bia, { publico: true })).status, 404, 'só o dono publica');
  assert.equal((await api('PUT', `/api/podcast/itens/${it.id}/radia`, ana, { publico: true })).corpo.publico, true);
  const prog = (await api('GET', '/api/radia/programa', bia)).corpo;
  assert.equal(prog.total, 1); assert.equal(prog.itens[0].titulo, 'HAS na rádio'); assert.equal(prog.itens[0].autor, 'Ana6', 'só o primeiro nome'); assert.equal(prog.itens[0].audio_url, `/api/radia/audio/${it.id}`);
  assert.ok(prog.itens[0].transcricao.includes('palavra3'));
  assert.equal((await api('GET', `/api/radia/audio/${it.id}`)).status, 200, 'áudio público abre sem login (apps de podcast)');
  assert.equal((await api('GET', `/api/radia/audio/${vazio.id}`)).status, 404);
  const feed = await api('GET', '/api/radia/feed'); assert.equal(feed.status, 200); assert.ok(feed.texto.includes('HAS na rádio') && feed.texto.includes('/api/radia/audio/'));
  assert.ok(!feed.texto.includes('Tema vazio'));
  const canal = (await api('GET', '/api/radia/canal', bia)).corpo; assert.equal(canal.site, 'https://radia.m3d.pro/revalida'); assert.equal(canal.episodios, 1);
  // posição vale para episódio público de outro autor
  assert.equal((await api('PUT', `/api/podcast/itens/${it.id}/posicao`, bia, { posicao_s: 30 })).status, 200);
  assert.equal((await api('GET', '/api/podcast/continuar', bia)).corpo[0].titulo, 'HAS na rádio');
  // admin tira do ar; comum não
  assert.equal((await api('DELETE', `/api/radia/programa/${it.id}`, bia)).status, 403);
  assert.equal((await api('DELETE', `/api/radia/programa/${it.id}`, adm)).status, 200);
  assert.equal((await api('GET', '/api/radia/programa', bia)).corpo.total, 0);
  // republicar e editar o texto retira da rádio
  await api('PUT', `/api/podcast/itens/${it.id}/radia`, ana, { publico: true });
  await api('PUT', `/api/podcast/itens/${it.id}`, ana, { roteiro: `${ROTEIRO} nova versão` });
  assert.equal((await api('GET', '/api/radia/programa', bia)).corpo.total, 0, 'texto alterado volta a ser privado até nova publicação');
});

test('pacote de exportação e pool: fica pendente com a data do pedido, na ordem; entrega só a quem pediu', async () => {
  ligarTTS();
  const ana = await uid('Ana7'); const bia = await uid('Bia7'); const adm = await uid('Adm7', 'admin');
  const pl = await novaPlaylist(ana);
  const it = (await api('POST', `/api/podcast/playlists/${pl.id}/itens`, ana, { tema: 'Diabetes', titulo: 'DM revisão' })).corpo.item;
  const t = (await q(`insert into temas (nome, nome_norm, area) values ('Cetoacidose','cetoacidose','clinica_medica') returning id`)).rows[0].id;
  await q(`insert into cartoes (tema_id, frente, verso) values ($1,'Primeiro passo na CAD?','Hidratação com SF 0,9%')`, [t]);
  assert.equal((await api('POST', '/api/radia/exportar', ana, {})).status, 400);
  assert.equal((await api('POST', '/api/radia/exportar', ana, { itens: ['00000000-0000-4000-8000-000000000000'] })).status, 400);
  assert.equal((await api('POST', '/api/radia/exportar', bia, { itens: [it.id] })).status, 400, 'não exporta episódio alheio');
  const p1 = await api('POST', '/api/radia/exportar', ana, { temas: [t], itens: [it.id], titulo: 'Revisão de endocrinologia' });
  assert.equal(p1.status, 201); assert.equal(p1.corpo.status, 'pendente'); assert.equal(p1.corpo.itens, 2); assert.ok(p1.corpo.solicitado_em);
  await new Promise((r) => setTimeout(r, 15));
  const p2 = await api('POST', '/api/radia/exportar', ana, { temas: [t] });
  const pool = (await api('GET', '/api/radia/pool', ana)).corpo;
  assert.deepEqual(pool.pedidos.map((p) => p.id), [p1.corpo.id, p2.corpo.id], 'listado como solicitado (do mais antigo ao mais novo)');
  assert.ok(pool.pedidos.every((p) => p.status === 'pendente' && p.solicitado_em)); assert.equal(pool.sincronizacao, false);
  assert.deepEqual((await api('GET', '/api/radia/pool?ordem=desc', ana)).corpo.pedidos.map((p) => p.id), [p2.corpo.id, p1.corpo.id]);
  assert.equal((await api('GET', '/api/radia/pool', bia)).corpo.pedidos.length, 0);
  assert.equal((await api('GET', '/api/radia/pool?todos=1', ana)).corpo.pedidos.length, 2, 'não-admin ignora ?todos');
  assert.ok((await api('GET', '/api/radia/pool?todos=1', adm)).corpo.pedidos.length >= 2);
  // pacote para download: manifesto + cartões + roteiro + áudio em base64; sem dados pessoais
  const dl = await api('GET', `/api/radia/pool/${p1.corpo.id}/pacote`, ana);
  assert.match(dl.headers['content-disposition'], /radia-pacote-/);
  const pac = JSON.parse(dl.texto);
  assert.equal(pac.formato, 'revalida-radia-pacote'); assert.equal(pac.temas[0].cartoes[0].verso, 'Hidratação com SF 0,9%');
  assert.equal(pac.episodios[0].titulo, 'DM revisão'); assert.equal(Buffer.from(pac.episodios[0].audio.base64, 'base64').length, 64);
  assert.ok(!/Ana7|@x\.com/.test(dl.texto), 'sem nome nem e-mail do aluno');
  assert.equal((await api('GET', `/api/radia/pool/${p1.corpo.id}/pacote`, bia)).status, 404);
  // cancelar pendente
  assert.equal((await api('DELETE', `/api/radia/pool/${p2.corpo.id}`, bia)).status, 404);
  assert.equal((await api('DELETE', `/api/radia/pool/${p2.corpo.id}`, ana)).status, 200);
});

test('sincronização com a rádio (site FALSO): ordem, credenciais, erro com nova tentativa e limite', async () => {
  ligarTTS();
  const ana = await uid('Ana8'); const adm = await uid('Adm8', 'admin');
  await q('delete from radia_pool');
  const pl = await novaPlaylist(ana);
  const it = (await api('POST', `/api/podcast/playlists/${pl.id}/itens`, ana, { tema: 'Tuberculose', titulo: 'TB' })).corpo.item;
  const a = (await api('POST', '/api/radia/exportar', ana, { itens: [it.id], titulo: 'Primeiro' })).corpo;
  await new Promise((r) => setTimeout(r, 15));
  const b = (await api('POST', '/api/radia/exportar', ana, { itens: [it.id], titulo: 'Segundo' })).corpo;
  assert.equal((await api('POST', '/api/radia/sincronizar', ana)).status, 403);
  radiaChamadas.length = 0;
  assert.deepEqual((await api('POST', '/api/radia/sincronizar', adm)).corpo, { configurado: false, enviados: 0, erros: 0, restantes: 0 }, 'sem RADIA_URL/RADIA_TOKEN nada é enviado');
  assert.equal(radiaChamadas.length, 0);
  valores.RADIA_URL = 'https://radia.exemplo.test/api/importar'; valores.RADIA_TOKEN = 'token-da-radia-123';
  assert.equal((await api('GET', '/api/radia/pool', ana)).corpo.sincronizacao, true);
  radiaStatus = 500;
  const r1 = (await api('POST', '/api/radia/sincronizar', adm)).corpo;
  assert.deepEqual([r1.enviados, r1.erros, r1.restantes], [0, 2, 2]);
  const lista = (await api('GET', '/api/radia/pool', ana)).corpo.pedidos;
  assert.ok(lista.every((p) => p.status === 'erro' && p.tentativas === 1 && /HTTP 500/.test(p.erro)));
  radiaStatus = 200; radiaChamadas.length = 0;
  const r2 = (await api('POST', '/api/radia/sincronizar', adm)).corpo;
  assert.deepEqual([r2.enviados, r2.erros, r2.restantes], [2, 0, 0]);
  assert.deepEqual(radiaChamadas.map((c) => c.corpo.pedido_id), [a.id, b.id], 'enviado na ordem do pedido');
  assert.equal(radiaChamadas[0].headers.authorization, 'Bearer token-da-radia-123'); assert.equal(radiaChamadas[0].headers['idempotency-key'], a.id);
  assert.equal(radiaChamadas[0].corpo.episodios[0].audio.mime, 'audio/mpeg'); assert.ok(radiaChamadas[0].corpo.episodios[0].audio.base64.length > 10);
  const fim = (await api('GET', '/api/radia/pool', ana)).corpo.pedidos;
  assert.ok(fim.every((p) => p.status === 'sincronizado' && p.sincronizado_em && p.erro === ''));
  assert.equal((await api('DELETE', `/api/radia/pool/${a.id}`, ana)).status, 404, 'já sincronizado não se cancela');
  // limite de tentativas: depois de MAX o pedido para de ser reenviado
  const c = (await api('POST', '/api/radia/exportar', ana, { itens: [it.id] })).corpo;
  radiaStatus = 500;
  for (let i = 0; i < 6; i++) await sincronizarPool({ q, cfg, fetchImpl: fetchFalso, dir });
  const ult = (await api('GET', '/api/radia/pool', ana)).corpo.pedidos.find((p) => p.id === c.id);
  assert.equal(ult.status, 'erro'); assert.equal(ult.tentativas, 5);
  radiaStatus = 200;
});
