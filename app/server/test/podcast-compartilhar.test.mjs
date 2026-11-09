// Podcast: áudio no padrão universal (MP3 mono 44,1 kHz 64 kbps + ID3), links públicos de episódio e de playlist (página, RSS, MP3),
// mover/copiar/agrupar trilhas. Postgres real; IA e TTS falsos; o MP3 de teste é real (gerado pelo ffmpeg quando ele existe).
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { criarApp, criarBanco, criarQ } from './ajuda.mjs';
import { registrarPodcast } from '../src/podcast.js';
import { normalizarMP3, duracaoCBR, ffmpegDisponivel, PADRAO_AUDIO } from '../src/audio-universal.js';
import { paginaEpisodio, esc } from '../src/podcast-paginas.js';

const TEM_FFMPEG = await ffmpegDisponivel();
const bd = criarBanco('rv_podcast_comp');
const q = criarQ(bd.nome);
const { app, chamar } = criarApp();
const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'rv-podcast-comp-'));
const valores = { APP_URL: 'https://app.exemplo.com', TTS_URL: 'https://tts.exemplo.com/v1', TTS_CHAVE: 'chave-tts-secreta-123' };
const cfg = { obter: (k) => valores[k] ?? '' };
const ROTEIRO = Array.from({ length: 80 }, (_, i) => `palavra${i}`).join(' ') + '. Fim do episódio.';
let tituloIA = 'Episódio de teste';
const ia = { configurado: () => true, async gerarRoteiro(p) { return { titulo: `${tituloIA} ${p.tema}`, roteiro: ROTEIRO }; } };

// MP3 "bruto do provedor": estéreo, 22,05 kHz, 3 s, sem tags (o que um TTS qualquer poderia devolver)
let MP3_BRUTO = Buffer.from([0xff, 0xfb, 0x90, 0x00, ...Array(60).fill(7)]);
if (TEM_FFMPEG) MP3_BRUTO = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=3', '-ac', '2', '-ar', '22050', '-b:a', '128k', '-f', 'mp3', 'pipe:1'], { maxBuffer: 1 << 24 }).stdout;
const fetchFalso = async () => ({ ok: true, status: 200, arrayBuffer: async () => new Uint8Array(MP3_BRUTO).buffer });
const autenticar = async (req, _res, prox) => {
  const id = String(req.headers.authorization).split(' ')[1];
  const u = (await q('select id, nome, papel_app from usuarios where id=$1', [id])).rows[0];
  req.usuario = { id, nome: u.nome, papel_app: u.papel_app }; prox();
};
before(() => { registrarPodcast(app, { q, autenticar, ia, cfg, fetchImpl: fetchFalso, dir, intervaloSyncMin: 0 }); });
after(async () => { bd.derrubar(); await fs.rm(dir, { recursive: true, force: true }); });
const uid = async (n) => (await q(`insert into usuarios (nome,email,senha_hash,visto_em,papel_app) values ($1,$2,'x',now(),'usuario') returning id`, [n, `${n}${Math.random()}@x.com`])).rows[0].id;
const api = (m, u, t, corpo, extra = {}) => chamar(m, u, { token: t, corpo, ...extra });
const novaPl = async (t, titulo) => (await api('POST', '/api/podcast/playlists', t, { titulo })).corpo;
const novoEp = async (t, plId, tema = 'Sepse', extra = {}) => (await api('POST', `/api/podcast/playlists/${plId}/itens`, t, { tema, area: 'clinica', minutos: 3, ...extra })).corpo.item;
const caminho = (url) => url.replace('https://app.exemplo.com', '');

test('padrão universal: constantes documentadas e duração CBR exata', () => {
  assert.deepEqual([PADRAO_AUDIO.mime, PADRAO_AUDIO.canais, PADRAO_AUDIO.taxaHz, PADRAO_AUDIO.kbps, PADRAO_AUDIO.cbr], ['audio/mpeg', 1, 44100, 64, true]);
  assert.equal(duracaoCBR(Buffer.alloc(8000)), 1, '8000 bytes a 64 kbps = 1 s');
  const id3 = Buffer.concat([Buffer.from('ID3'), Buffer.from([3, 0, 0, 0, 0, 0, 10]), Buffer.alloc(10), Buffer.alloc(16000)]);   // tag de 10 bytes ignorada
  assert.equal(duracaoCBR(id3), 2);
});

test('sem ffmpeg ou desligado: devolve o áudio original sem lançar erro', async () => {
  const a = await normalizarMP3(MP3_BRUTO, { titulo: 'x' }, { bin: 'ffmpeg-que-nao-existe-123' });
  assert.equal(a.normalizado, false); assert.equal(a.buffer, MP3_BRUTO); assert.match(a.motivo, /ffmpeg/);
  const b = await normalizarMP3(MP3_BRUTO, { titulo: 'x' }, { ativo: false });
  assert.equal(b.normalizado, false); assert.match(b.motivo, /desligado/);
});

test('normaliza para MP3 mono 44,1 kHz 64 kbps com tags ID3', { skip: !TEM_FFMPEG && 'ffmpeg ausente neste ambiente' }, async () => {
  const r = await normalizarMP3(MP3_BRUTO, { titulo: 'Sepse: conduta', album: 'Clínica', faixa: 3 });
  assert.equal(r.normalizado, true);
  assert.ok(Math.abs(r.duracao_s - 3) <= 1, `duração ≈ 3 s (veio ${r.duracao_s})`);
  assert.equal(r.buffer.toString('latin1', 0, 3), 'ID3');
  const sonda = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_name,channels,sample_rate,bit_rate:format_tags=title,album,track,genre,artist', '-of', 'json', 'pipe:0'], { input: r.buffer });
  const j = JSON.parse(sonda.stdout.toString()); const s = j.streams[0], tg = j.format.tags;
  assert.deepEqual([s.codec_name, s.channels, Number(s.sample_rate), Number(s.bit_rate)], ['mp3', 1, 44100, 64000]);
  assert.deepEqual([tg.title, tg.album, tg.track, tg.genre, tg.artist], ['Sepse: conduta', 'Clínica', '3', 'Podcast', 'Revalida Prático']);
});

test('gerar episódio guarda o MP3 normalizado, a duração real e serve com Range', { skip: !TEM_FFMPEG && 'ffmpeg ausente neste ambiente' }, async () => {
  const ana = await uid('Ana'); const pl = await novaPl(ana, 'Urgências');
  const it = await novoEp(ana, pl.id);
  assert.equal(it.status, 'pronto'); assert.equal(it.tem_audio, true); assert.equal(it.audio_normalizado, true);
  assert.ok(Math.abs(it.duracao_s - 3) <= 1, 'duração vem do áudio, não da estimativa pelo texto');
  const l = (await api('POST', `/api/podcast/itens/${it.id}/compartilhar`, ana, { ativo: true })).corpo;
  const r = await chamar('GET', caminho(l.links.audio), { headers: { range: 'bytes=0-99' } });
  assert.equal(r.status, 206); assert.equal(r.headers['content-type'], 'audio/mpeg'); assert.equal(r.buffer.length, 100); assert.match(r.headers['content-range'], /^bytes 0-99\//);
});

test('episódio: link público abre sem login (página, JSON, MP3, transcrição) e pode ser desativado', async () => {
  const ana = await uid('Ana2'); const bia = await uid('Bia2'); const pl = await novaPl(ana, 'Pediatria');
  tituloIA = 'Crise <script>alert(1)</script>';
  const it = await novoEp(ana, pl.id, 'Convulsão febril'); tituloIA = 'Episódio de teste';
  assert.equal((await api('POST', `/api/podcast/itens/${it.id}/compartilhar`, bia, { ativo: true })).status, 404, 'outro usuário não compartilha o meu episódio');
  assert.equal((await api('GET', `/api/podcast/itens/${it.id}/links`, ana)).corpo.compartilhado, false);
  const c = await api('POST', `/api/podcast/itens/${it.id}/compartilhar`, ana, { ativo: true });
  assert.equal(c.status, 200); const L = c.corpo.links;
  assert.match(L.pagina, /^https:\/\/app\.exemplo\.com\/api\/ouvir\/e\/[A-Za-z0-9_-]{30,}$/);
  const again = (await api('POST', `/api/podcast/itens/${it.id}/compartilhar`, ana, { ativo: true })).corpo.links;
  assert.equal(again.pagina, L.pagina, 'ativar de novo mantém o mesmo link');
  const pg = await chamar('GET', caminho(L.pagina));            // sem token de login
  assert.equal(pg.status, 200); assert.match(pg.headers['content-type'], /text\/html/); assert.equal(pg.headers['x-robots-tag'], 'noindex, nofollow');
  assert.ok(pg.texto.includes('<audio controls') && pg.texto.includes(L.audio), 'player aponta para o MP3 público');
  assert.ok(!pg.texto.includes('<script>alert(1)'), 'título malicioso escapado'); assert.ok(pg.texto.includes('&lt;script&gt;'));
  const js = (await chamar('GET', caminho(L.pagina).replace('/api/ouvir/e/', '/api/publico/podcast/e/'))).corpo;
  assert.equal(js.tem_audio, true); assert.equal(js.audio_url, L.audio); assert.ok(js.roteiro.startsWith('palavra0'));
  const mp3 = await chamar('GET', caminho(L.audio)); assert.equal(mp3.status, 200); assert.equal(mp3.buffer.length > 50, true);
  const dl = await chamar('GET', caminho(L.baixar), { query: { baixar: '1' } }); assert.match(dl.headers['content-disposition'] ?? '', /attachment; filename=".+\.mp3"/);
  const tx = await chamar('GET', caminho(L.transcricao)); assert.match(tx.headers['content-type'], /text\/plain/); assert.ok(tx.texto.includes('palavra10'));
  assert.equal((await chamar('GET', '/api/ouvir/e/token-que-nao-existe-123456')).status, 404);
  assert.equal((await chamar('GET', '/api/ouvir/e/x')).status, 404, 'token fora do formato');
  await api('POST', `/api/podcast/itens/${it.id}/compartilhar`, ana, { ativo: false });
  for (const u of [L.pagina, L.audio, L.transcricao]) assert.equal((await chamar('GET', caminho(u))).status, 404, 'desativado = link morto');
});

test('playlist: página, RSS universal e MP3 de cada episódio (e nada de outras playlists)', async () => {
  const ana = await uid('Ana3'); const pl = await novaPl(ana, 'Plantão & Cia'); const outra = await novaPl(ana, 'Privada');
  const e1 = await novoEp(ana, pl.id, 'Sepse'); const e2 = await novoEp(ana, pl.id, 'Choque'); const privado = await novoEp(ana, outra.id, 'Segredo');
  assert.deepEqual((await api('GET', `/api/podcast/playlists/${pl.id}/links`, ana)).corpo, { publica: false });
  const pub = (await api('POST', `/api/podcast/playlists/${pl.id}/publicar`, ana, { publica: true })).corpo;
  assert.match(pub.pagina, /\/api\/ouvir\/p\//); assert.match(pub.rss, /\/api\/publico\/podcast\/p\/.+\/feed\.xml$/); assert.ok(pub.feed_publico, 'o feed público antigo continua');
  const pg = await chamar('GET', caminho(pub.pagina));
  assert.equal(pg.status, 200); assert.ok(pg.texto.includes('Plantão &amp; Cia') && pg.texto.includes('2 episódios') && pg.texto.includes('Assinar por RSS'));
  const rss = await chamar('GET', caminho(pub.rss));
  assert.match(rss.headers['content-type'], /application\/rss\+xml/);
  const x = rss.texto;
  assert.ok(x.includes('xmlns:itunes') && x.includes('xmlns:podcast') && x.includes('<itunes:type>episodic</itunes:type>') && x.includes('<atom:link'), 'RSS 2.0 com iTunes e Podcasting 2.0');
  assert.equal((x.match(/<enclosure /g) ?? []).length, 2); assert.equal((x.match(/<podcast:transcript /g) ?? []).length, 2);
  assert.match(x, /<itunes:duration>\d+:\d\d:\d\d<\/itunes:duration>/, 'duração em HH:MM:SS');
  assert.ok(x.includes(`/p/`) && !x.includes(privado.id), 'só os episódios desta playlist');
  const url1 = x.match(/<enclosure url="([^"]+)"/)[1].replace(/&amp;/g, '&');
  const a1 = await chamar('GET', caminho(url1)); assert.equal(a1.status, 200); assert.equal(a1.headers['content-type'], 'audio/mpeg');
  const t = pub.pagina.split('/').pop();
  assert.equal((await chamar('GET', `/api/publico/podcast/p/${t}/audio/${privado.id}`)).status, 404, 'episódio de outra playlist não vaza');
  assert.equal((await chamar('GET', `/api/publico/podcast/p/${t}/audio/nao-e-uuid`)).status, 404);
  const tr = await chamar('GET', `/api/publico/podcast/p/${t}/transcricao/${e2.id}`); assert.ok(tr.texto.includes('palavra5'));
  assert.equal((await api('GET', `/api/podcast/playlists/${pl.id}/links`, ana)).corpo.publica, true);
  await api('POST', `/api/podcast/playlists/${pl.id}/publicar`, ana, { publica: false });
  for (const u of [pub.pagina, pub.rss]) assert.equal((await chamar('GET', caminho(u))).status, 404, 'despublicada = link morto');
  void e1;
});

test('agrupar trilhas: mover, copiar (com o áudio) e criar grupo novo com vários episódios', async () => {
  const ana = await uid('Ana4'); const bia = await uid('Bia4');
  const a = await novaPl(ana, 'Origem'); const b = await novaPl(ana, 'Destino'); const deBia = await novaPl(bia, 'Da Bia');
  const e1 = await novoEp(ana, a.id, 'Sepse'); const e2 = await novoEp(ana, a.id, 'Choque'); const e3 = await novoEp(ana, a.id, 'AVC');
  assert.equal((await api('POST', `/api/podcast/itens/${e1.id}/mover`, ana, { playlist_id: deBia.id })).status, 404, 'não move para a playlist de outra pessoa');
  assert.equal((await api('POST', `/api/podcast/itens/${e1.id}/mover`, bia, { playlist_id: deBia.id })).status, 404, 'nem o episódio de outra pessoa');
  assert.equal((await api('POST', `/api/podcast/itens/${e1.id}/mover`, ana, { playlist_id: 'x' })).status, 400);
  const cp = (await api('POST', `/api/podcast/itens/${e1.id}/mover`, ana, { playlist_id: b.id, copiar: true })).corpo;
  assert.equal(cp.copiado, true); assert.notEqual(cp.item_id, e1.id);
  const noB = (await api('GET', `/api/podcast/playlists/${b.id}`, ana)).corpo.itens;
  assert.equal(noB.length, 1); assert.equal(noB[0].tem_audio, true);
  assert.ok((await fs.stat(path.join(dir, `${cp.item_id}.mp3`))).size > 50, 'o áudio foi copiado para um arquivo próprio');
  assert.equal((await api('GET', `/api/podcast/playlists/${a.id}`, ana)).corpo.itens.length, 3, 'copiar não tira da origem');
  await api('POST', `/api/podcast/itens/${e2.id}/mover`, ana, { playlist_id: b.id });
  assert.equal((await api('GET', `/api/podcast/playlists/${a.id}`, ana)).corpo.itens.length, 2, 'mover tira da origem');
  assert.equal((await api('GET', `/api/podcast/playlists/${b.id}`, ana)).corpo.itens.length, 2);
  assert.equal((await api('POST', '/api/podcast/playlists/agrupar', ana, { titulo: '', itens: [e1.id] })).status, 400);
  assert.equal((await api('POST', '/api/podcast/playlists/agrupar', ana, { titulo: 'Grupo', itens: [] })).status, 400);
  assert.equal((await api('POST', '/api/podcast/playlists/agrupar', bia, { titulo: 'Grupo', itens: [e3.id] })).status, 404, 'só agrupa os próprios episódios');
  const g = await api('POST', '/api/podcast/playlists/agrupar', ana, { titulo: 'Revisão da semana', itens: [e1.id, e3.id] });
  assert.equal(g.status, 201); assert.equal(g.corpo.itens, 2); assert.equal(g.corpo.copiado, true);
  const itensG = (await api('GET', `/api/podcast/playlists/${g.corpo.playlist.id}`, ana)).corpo.itens;
  assert.deepEqual(itensG.map((i) => i.posicao), [0, 1]); assert.ok(itensG.every((i) => i.tem_audio));
  assert.equal((await api('GET', `/api/podcast/playlists/${a.id}`, ana)).corpo.itens.length, 2, 'agrupar (cópia) mantém a origem');
});

test('página: tudo escapado e sem áudio mostra aviso honesto', () => {
  assert.equal(esc(`<a href="x">&'`), '&lt;a href=&quot;x&quot;&gt;&amp;&#39;');
  const h = paginaEpisodio({ titulo: '<b>x</b>', album: 'A', roteiro: '<img src=x onerror=alert(1)>', duracao_s: 125, audioUrl: null, baixarUrl: null, txtUrl: '/t', url: '/u' });
  assert.ok(!h.includes('<img src=x') && !h.includes('<b>x</b>')); assert.ok(h.includes('ainda não tem áudio') && h.includes('2:05 min'));
});
