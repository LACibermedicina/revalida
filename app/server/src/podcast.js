// Podcast de estudo: playlists com roteiro (transcrição), áudio por TTS, posição salva, feeds RSS (privado e público),
// playlist do programa radIA.m3d, rádio Revalida e pool de exportação.
//   • sem TTS configurado o episódio fica só com a transcrição (o navegador pode lê-la em voz alta);
//   • feed privado: token por usuário (só o hash fica no banco; renovar revoga o anterior); feed público: token da playlist, opt-in;
//   • o áudio fica em PODCAST_DIR (use volume persistente).
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { ErroIA } from './ia.js';
import { idValido, rota, Limitador } from './seguranca.js';
import { garantirTema, diretrizesDoTema } from './temas.js';
import { AREAS } from './estacao-esquema.js';
import { criarTTS } from './tts.js';
import { duracaoEstimada } from './podcast-ia.js';
import { CANAL, montarPacote, montarRSS, pacoteComAudio, sincronizarPool, MAX_TENTATIVAS } from './radia.js';

const ERROS_IA = { IA_NAO_CONFIGURADA: 503, IA_CHAVE_INVALIDA: 502, IA_LIMITE: 429, IA_DEMORA: 504, IA_FALHA: 502, IA_ESQUEMA: 502 };
const txt = (v, n) => String(v ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim().slice(0, n);
const sha256 = (s) => crypto.createHash('sha256').update(String(s)).digest('hex');
const novoToken = () => crypto.randomBytes(24).toString('base64url');
const igual = (a, b) => { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && crypto.timingSafeEqual(x, y); };
const COLS = `i.id, i.playlist_id, i.posicao, i.tipo, i.tema_id, i.titulo, i.topico, i.prompt, i.minutos, i.roteiro, i.status, i.erro,
  (i.audio_arquivo is not null) tem_audio, i.audio_mime, i.audio_bytes, i.duracao_s, i.publico, i.publicado_em, i.criado_em, i.atualizado_em`;

export function registrarPodcast(app, { q, autenticar, ia, cfg, fetchImpl = globalThis.fetch, dir = process.env.PODCAST_DIR || path.resolve('dados/podcast'), tts, intervaloSyncMin = Number(process.env.RADIA_SYNC_MIN) || 0 }) {
  const voz = tts ?? criarTTS({ cfg, fetchImpl });
  const U = (req) => req.usuario.id;
  const ehAdmin = (u) => ['admin', 'root'].includes(u?.papel_app);
  const validarId = (req, res, prox) => (idValido(req.params.id) ? prox() : res.status(400).json({ erro: 'Identificador inválido.' }));
  const exigirAdmin = (req, res, prox) => (ehAdmin(req.usuario) ? prox() : res.status(403).json({ erro: 'Sem permissão para esta ação.' }));
  const limiteGerar = new Limitador({ max: 30, janelaMs: 3600e3 });
  const erroIA = (res, e) => { if (e instanceof ErroIA) return res.status(ERROS_IA[e.codigo] ?? 502).json({ erro: e.message, codigo: e.codigo }); throw e; };
  const base = (req) => (cfg.obter('APP_URL') || `${req.headers?.['x-forwarded-proto'] || 'http'}://${req.headers?.host || 'localhost'}`).replace(/\/$/, '');
  const arquivo = (nome) => path.join(dir, path.basename(nome));
  const apagarAudio = async (nome) => { if (nome) await fs.rm(arquivo(nome), { force: true }).catch(() => {}); };

  const minhaPlaylist = async (id, usuarioId) => (await q('select * from podcast_playlists where id=$1 and usuario_id=$2', [id, usuarioId])).rows[0];
  const meuItem = async (id, usuarioId) => (await q(`select i.*, p.usuario_id, p.prompt prompt_playlist, p.titulo playlist_titulo from podcast_itens i join podcast_playlists p on p.id = i.playlist_id where i.id=$1 and p.usuario_id=$2`, [id, usuarioId])).rows[0];
  const itemPublico = (item) => ({ id: item.id, titulo: item.titulo, tema: item.tema ?? null, area: item.area ?? null, topico: item.topico, duracao_s: item.duracao_s, tem_audio: item.tem_audio, publicado_em: item.publicado_em, autor: item.autor ?? null,
    audio_url: item.tem_audio ? `/api/radia/audio/${item.id}` : null, roteiro: item.roteiro });

  /** Entrega um arquivo de áudio com suporte a Range (apps de podcast e <audio> pedem trechos). */
  async function enviarAudio(req, res, item, { baixar = false } = {}) {
    let buf; try { buf = await fs.readFile(arquivo(item.audio_arquivo)); } catch { return res.status(404).json({ erro: 'Este episódio ainda não tem áudio.' }); }
    const mime = item.audio_mime || 'audio/mpeg';
    const cab = { 'Content-Type': mime, 'Accept-Ranges': 'bytes', 'Cache-Control': 'private, max-age=0',
      ...(baixar ? { 'Content-Disposition': `attachment; filename="${(item.titulo || 'episodio').replace(/[^\w\-. ]+/g, '').trim().slice(0, 80) || 'episodio'}.mp3"` } : {}) };
    const m = /^bytes=(\d*)-(\d*)$/.exec(String(req.headers?.range ?? ''));
    if (m && (m[1] || m[2])) {
      let ini = m[1] === '' ? Math.max(0, buf.length - Number(m[2])) : Number(m[1]);
      let fim = m[1] === '' || m[2] === '' ? buf.length - 1 : Math.min(Number(m[2]), buf.length - 1);
      if (ini > fim || ini >= buf.length) { res.set({ ...cab, 'Content-Range': `bytes */${buf.length}` }); return res.status(416).send(Buffer.alloc(0)); }
      res.set({ ...cab, 'Content-Range': `bytes ${ini}-${fim}/${buf.length}`, 'Content-Length': String(fim - ini + 1) });
      return res.status(206).send(buf.subarray(ini, fim + 1));
    }
    res.set({ ...cab, 'Content-Length': String(buf.length) });
    return res.status(200).send(buf);
  }

  /** Gera (ou refaz) roteiro e áudio. Falhas viram estado do episódio, nunca perdem o que já existia. */
  async function gerar(item, { refazerRoteiro = false } = {}) {
    const resultado = { aviso: '' };
    let { roteiro, titulo } = item;
    if (refazerRoteiro || !roteiro) {
      const tema = item.tema_id ? (await q('select nome, area from temas where id=$1', [item.tema_id])).rows[0] : null;
      const nomeTema = tema?.nome ?? item.titulo;
      const diretrizes = await diretrizesDoTema(q, { nome: nomeTema, area: tema?.area });
      let cartoes = [];
      if (item.tipo === 'revisao_cards' && item.tema_id) {
        cartoes = (await q(`select c.frente, c.verso from cartoes c left join cartao_progresso cp on cp.cartao_id = c.id and cp.usuario_id = $2
          where c.tema_id=$1 order by coalesce(cp.erros,0) desc, coalesce(cp.proximo_em, now()) limit 12`, [item.tema_id, item.usuario_id])).rows;
      }
      try {
        const r = await ia.gerarRoteiro({ tipo: item.tipo, tema: nomeTema, area: tema?.area, topico: item.topico, minutos: item.minutos, promptPlaylist: item.prompt_playlist ?? '', promptItem: item.prompt, diretrizes, cartoes });
        roteiro = r.roteiro; titulo = item.titulo_auto ? r.titulo : (item.titulo || r.titulo);
      } catch (e) {
        if (!(e instanceof ErroIA)) throw e;
        await q(`update podcast_itens set status = case when roteiro <> '' then 'roteiro' else 'erro' end, erro=$2, atualizado_em=now() where id=$1`, [item.id, e.message.slice(0, 300)]);
        return { ...resultado, aviso: e.message, codigo: e.codigo };
      }
      await apagarAudio(item.audio_arquivo);
      await q(`update podcast_itens set roteiro=$2, titulo=$3, duracao_s=$4, status='roteiro', erro='', audio_arquivo=null, audio_mime=null, audio_bytes=null, atualizado_em=now() where id=$1`, [item.id, roteiro, txt(titulo, 140), duracaoEstimada(roteiro)]);
    }
    if (!voz.configurado()) return { ...resultado, aviso: 'Voz (TTS) não configurada: o episódio ficou só com a transcrição; o navegador pode lê-la em voz alta.' };
    try {
      const { buffer, mime } = await voz.sintetizar(roteiro);
      await fs.mkdir(dir, { recursive: true });
      const nome = `${item.id}.mp3`;
      await fs.writeFile(arquivo(nome), buffer);
      await q(`update podcast_itens set status='pronto', erro='', audio_arquivo=$2, audio_mime=$3, audio_bytes=$4, atualizado_em=now() where id=$1`, [item.id, nome, mime, buffer.length]);
    } catch (e) {
      if (!(e instanceof ErroIA)) throw e;
      await q(`update podcast_itens set status='roteiro', erro=$2, atualizado_em=now() where id=$1`, [item.id, e.message.slice(0, 300)]);
      return { ...resultado, aviso: e.message, codigo: e.codigo };
    }
    return resultado;
  }
  const itemCompleto = async (id) => (await q(`select ${COLS} from podcast_itens i where i.id=$1`, [id])).rows[0];

  /* ---------- configuração e temas ---------- */
  app.get('/api/podcast/config', autenticar, rota(async (_req, res) => {
    res.json({ ia: Boolean(ia.configurado?.()), tts: voz.configurado(), radia: Boolean(cfg.obter('RADIA_URL') && cfg.obter('RADIA_TOKEN')), canal: CANAL });
  }));
  app.get('/api/podcast/temas', autenticar, rota(async (req, res) => {
    const b = txt(req.query?.busca, 60).toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/[^a-z0-9 ]+/g, ' ').trim();
    const r = await q(`select id, nome, area from temas where nome_norm like $1 order by relevancia desc, nome limit 30`, [`%${b}%`]);
    res.json(r.rows);
  }));

  /* ---------- playlists ---------- */
  app.get('/api/podcast/playlists', autenticar, rota(async (req, res) => {
    const r = await q(`select p.id, p.titulo, p.prompt, p.publica, p.criada_em,
        (select count(*)::int from podcast_itens i where i.playlist_id = p.id) itens,
        (select coalesce(sum(i.duracao_s),0)::int from podcast_itens i where i.playlist_id = p.id) duracao_s
      from podcast_playlists p where p.usuario_id=$1 order by p.criada_em desc limit 100`, [U(req)]);
    res.json(r.rows);
  }));
  app.post('/api/podcast/playlists', autenticar, rota(async (req, res) => {
    const titulo = txt(req.body?.titulo, 120);
    if (titulo.length < 2) return res.status(400).json({ erro: 'Dê um título à playlist.' });
    if ((await q('select count(*)::int n from podcast_playlists where usuario_id=$1', [U(req)])).rows[0].n >= 50) return res.status(409).json({ erro: 'Limite de 50 playlists.' });
    const r = await q('insert into podcast_playlists (usuario_id, titulo, prompt) values ($1,$2,$3) returning id, titulo, prompt, publica, criada_em', [U(req), titulo, txt(req.body?.prompt, 1500)]);
    res.status(201).json(r.rows[0]);
  }));
  app.get('/api/podcast/playlists/:id', autenticar, validarId, rota(async (req, res) => {
    const p = await minhaPlaylist(req.params.id, U(req));
    if (!p) return res.status(404).json({ erro: 'Playlist não encontrada.' });
    const itens = (await q(`select ${COLS}, t.nome tema, t.area, cp.posicao_s, cp.concluido from podcast_itens i left join temas t on t.id = i.tema_id
        left join podcast_posicoes cp on cp.item_id = i.id and cp.usuario_id = $2 where i.playlist_id=$1 order by i.posicao, i.criado_em`, [p.id, U(req)])).rows;
    res.json({ id: p.id, titulo: p.titulo, prompt: p.prompt, publica: p.publica, criada_em: p.criada_em, itens });
  }));
  app.put('/api/podcast/playlists/:id', autenticar, validarId, rota(async (req, res) => {
    const p = await minhaPlaylist(req.params.id, U(req));
    if (!p) return res.status(404).json({ erro: 'Playlist não encontrada.' });
    const titulo = req.body?.titulo === undefined ? p.titulo : txt(req.body.titulo, 120);
    if (titulo.length < 2) return res.status(400).json({ erro: 'Dê um título à playlist.' });
    const prompt = req.body?.prompt === undefined ? p.prompt : txt(req.body.prompt, 1500);
    await q('update podcast_playlists set titulo=$2, prompt=$3, atualizada_em=now() where id=$1', [p.id, titulo, prompt]);
    res.json({ id: p.id, titulo, prompt });
  }));
  app.delete('/api/podcast/playlists/:id', autenticar, validarId, rota(async (req, res) => {
    const p = await minhaPlaylist(req.params.id, U(req));
    if (!p) return res.status(404).json({ erro: 'Playlist não encontrada.' });
    for (const i of (await q('select audio_arquivo from podcast_itens where playlist_id=$1', [p.id])).rows) await apagarAudio(i.audio_arquivo);
    await q('delete from podcast_playlists where id=$1', [p.id]);
    res.json({ ok: true });
  }));
  app.put('/api/podcast/playlists/:id/ordem', autenticar, validarId, rota(async (req, res) => {
    const p = await minhaPlaylist(req.params.id, U(req));
    if (!p) return res.status(404).json({ erro: 'Playlist não encontrada.' });
    const ids = req.body?.ids;
    if (!Array.isArray(ids) || ids.length > 200 || !ids.every(idValido)) return res.status(400).json({ erro: 'Envie a lista de episódios na ordem desejada.' });
    for (let n = 0; n < ids.length; n++) await q('update podcast_itens set posicao=$3 where id=$1 and playlist_id=$2', [ids[n], p.id, n]);
    res.json({ ok: true });
  }));
  /** Liga/desliga o feed público da playlist (link específico para apps de podcast). Desligar apaga o token: o link antigo morre. */
  app.post('/api/podcast/playlists/:id/publicar', autenticar, validarId, rota(async (req, res) => {
    const p = await minhaPlaylist(req.params.id, U(req));
    if (!p) return res.status(404).json({ erro: 'Playlist não encontrada.' });
    if (req.body?.publica === true) {
      const token = p.token_publico || novoToken();
      await q('update podcast_playlists set publica=true, token_publico=$2 where id=$1', [p.id, token]);
      return res.json({ publica: true, feed_publico: `${base(req)}/api/podcast/feed/${p.id}/${token}` });
    }
    await q('update podcast_playlists set publica=false, token_publico=null where id=$1', [p.id]);
    res.json({ publica: false });
  }));

  /* ---------- episódios ---------- */
  app.post('/api/podcast/playlists/:id/itens', autenticar, validarId, rota(async (req, res) => {
    const p = await minhaPlaylist(req.params.id, U(req));
    if (!p) return res.status(404).json({ erro: 'Playlist não encontrada.' });
    const tipo = req.body?.tipo === 'revisao_cards' ? 'revisao_cards' : 'tema';
    const nome = txt(req.body?.tema, 80);
    let temaId = idValido(req.body?.tema_id) ? req.body.tema_id : null;
    if (temaId && !(await q('select 1 from temas where id=$1', [temaId])).rows[0]) temaId = null;
    if (!temaId) {
      if (nome.length < 2) return res.status(400).json({ erro: 'Informe o tema do episódio.' });
      temaId = await garantirTema(q, nome, { area: AREAS.includes(req.body?.area) ? req.body.area : null, origem: 'manual' });
    }
    if (tipo === 'revisao_cards' && (await q('select count(*)::int n from cartoes where tema_id=$1', [temaId])).rows[0].n === 0)
      return res.status(400).json({ erro: 'Este tema ainda não tem cartões para revisar. Crie os cartões primeiro.' });
    if ((await q('select count(*)::int n from podcast_itens where playlist_id=$1', [p.id])).rows[0].n >= 100) return res.status(409).json({ erro: 'Limite de 100 episódios por playlist.' });
    if (limiteGerar.excedeu(U(req))) return res.status(429).json({ erro: 'Muitos episódios gerados na última hora. Tente mais tarde.' });
    limiteGerar.registrar(U(req));
    const tema = (await q('select nome from temas where id=$1', [temaId])).rows[0];
    const tituloDado = txt(req.body?.titulo, 140);
    const minutos = Math.max(1, Math.min(20, Math.round(Number(req.body?.minutos) || 5)));
    const pos = (await q('select coalesce(max(posicao),-1)::int + 1 n from podcast_itens where playlist_id=$1', [p.id])).rows[0].n;
    const ins = await q(`insert into podcast_itens (playlist_id, posicao, tipo, tema_id, titulo, topico, prompt, minutos) values ($1,$2,$3,$4,$5,$6,$7,$8) returning id`,
      [p.id, pos, tipo, temaId, tituloDado || (tipo === 'revisao_cards' ? `Revisão: ${tema.nome}` : tema.nome), txt(req.body?.topico, 160), txt(req.body?.prompt, 1500), minutos]);
    const item = { ...(await meuItem(ins.rows[0].id, U(req))), titulo_auto: !tituloDado };
    const r = await gerar(item);
    res.status(201).json({ item: await itemCompleto(item.id), aviso: r.aviso || undefined, codigo: r.codigo });
  }));
  app.put('/api/podcast/itens/:id', autenticar, validarId, rota(async (req, res) => {
    const it = await meuItem(req.params.id, U(req));
    if (!it) return res.status(404).json({ erro: 'Episódio não encontrado.' });
    const titulo = req.body?.titulo === undefined ? it.titulo : txt(req.body.titulo, 140);
    if (titulo.length < 2) return res.status(400).json({ erro: 'Dê um título ao episódio.' });
    const topico = req.body?.topico === undefined ? it.topico : txt(req.body.topico, 160);
    const prompt = req.body?.prompt === undefined ? it.prompt : txt(req.body.prompt, 1500);
    const minutos = req.body?.minutos === undefined ? it.minutos : Math.max(1, Math.min(20, Math.round(Number(req.body.minutos) || 5)));
    let roteiro = it.roteiro; let mudou = false;
    if (req.body?.roteiro !== undefined) { roteiro = String(req.body.roteiro).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim().slice(0, 24000); mudou = roteiro !== it.roteiro; }
    if (mudou) {      // texto novo: o áudio antigo não vale mais; e o que foi para a rádio sai até a pessoa publicar de novo
      await apagarAudio(it.audio_arquivo);
      await q(`update podcast_itens set titulo=$2, topico=$3, prompt=$4, minutos=$5, roteiro=$6, duracao_s=$7, audio_arquivo=null, audio_mime=null, audio_bytes=null,
        status=$8, publico=false, publicado_em=null, erro='', atualizado_em=now() where id=$1`, [it.id, titulo, topico, prompt, minutos, roteiro, roteiro ? duracaoEstimada(roteiro) : 0, roteiro ? 'roteiro' : 'pendente']);
    } else {
      await q('update podcast_itens set titulo=$2, topico=$3, prompt=$4, minutos=$5, atualizado_em=now() where id=$1', [it.id, titulo, topico, prompt, minutos]);
    }
    res.json({ item: await itemCompleto(it.id), audio_invalidado: mudou && Boolean(it.audio_arquivo) });
  }));
  /** (Re)gera o áudio; com `refazer_roteiro` pede um roteiro novo à IA (usa as preferências atuais). */
  app.post('/api/podcast/itens/:id/gerar', autenticar, validarId, rota(async (req, res) => {
    const it = await meuItem(req.params.id, U(req));
    if (!it) return res.status(404).json({ erro: 'Episódio não encontrado.' });
    if (limiteGerar.excedeu(U(req))) return res.status(429).json({ erro: 'Muitas gerações na última hora. Tente mais tarde.' });
    limiteGerar.registrar(U(req));
    const refazer = req.body?.refazer_roteiro === true;
    const r = await gerar({ ...it, titulo_auto: false }, { refazerRoteiro: refazer });
    res.json({ item: await itemCompleto(it.id), aviso: r.aviso || undefined, codigo: r.codigo });
  }));
  app.delete('/api/podcast/itens/:id', autenticar, validarId, rota(async (req, res) => {
    const it = await meuItem(req.params.id, U(req));
    if (!it) return res.status(404).json({ erro: 'Episódio não encontrado.' });
    await apagarAudio(it.audio_arquivo);
    await q('delete from podcast_itens where id=$1', [it.id]);
    res.json({ ok: true });
  }));
  app.get('/api/podcast/itens/:id/audio', autenticar, validarId, rota(async (req, res) => {
    const it = await meuItem(req.params.id, U(req));
    if (!it?.audio_arquivo) return res.status(404).json({ erro: 'Este episódio ainda não tem áudio.' });
    return enviarAudio(req, res, it, { baixar: req.query?.baixar === '1' });
  }));
  app.get('/api/podcast/itens/:id/transcricao', autenticar, validarId, rota(async (req, res) => {
    const it = await meuItem(req.params.id, U(req));
    if (!it || !it.roteiro) return res.status(404).json({ erro: 'Este episódio ainda não tem transcrição.' });
    res.set({ 'Content-Type': 'text/plain; charset=utf-8', 'Content-Disposition': `attachment; filename="${(it.titulo || 'episodio').replace(/[^\w\-. ]+/g, '').trim().slice(0, 80) || 'episodio'}.txt"` });
    res.status(200).send(`${it.titulo}\n\n${it.roteiro}\n`);
  }));

  /* ---------- posição de reprodução (continuar depois) ---------- */
  app.put('/api/podcast/itens/:id/posicao', autenticar, validarId, rota(async (req, res) => {
    const ok = (await q(`select 1 from podcast_itens i join podcast_playlists p on p.id = i.playlist_id where i.id=$1 and (p.usuario_id=$2 or i.publico)`, [req.params.id, U(req)])).rows[0];
    if (!ok) return res.status(404).json({ erro: 'Episódio não encontrado.' });
    const pos = Math.max(0, Math.min(86400, Number(req.body?.posicao_s) || 0));
    await q(`insert into podcast_posicoes (usuario_id, item_id, posicao_s, concluido) values ($1,$2,$3,$4)
      on conflict (usuario_id, item_id) do update set posicao_s=excluded.posicao_s, concluido=excluded.concluido, atualizado_em=now()`, [U(req), req.params.id, pos, req.body?.concluido === true]);
    res.json({ posicao_s: pos, concluido: req.body?.concluido === true });
  }));
  app.get('/api/podcast/continuar', autenticar, rota(async (req, res) => {
    const r = await q(`select i.id item_id, i.titulo, i.playlist_id, p.titulo playlist, i.tem_audio_flag, cp.posicao_s, i.duracao_s, cp.atualizado_em
      from podcast_posicoes cp join (select x.*, (x.audio_arquivo is not null) tem_audio_flag from podcast_itens x) i on i.id = cp.item_id
      join podcast_playlists p on p.id = i.playlist_id
      where cp.usuario_id=$1 and not cp.concluido and cp.posicao_s > 5 and (p.usuario_id=$1 or i.publico) order by cp.atualizado_em desc limit 5`, [U(req)]);
    res.json(r.rows.map((x) => ({ item_id: x.item_id, titulo: x.titulo, playlist_id: x.playlist_id, playlist: x.playlist, posicao_s: Number(x.posicao_s), duracao_s: x.duracao_s, tem_audio: x.tem_audio_flag, em: x.atualizado_em })));
  }));

  /* ---------- credencial do feed privado ---------- */
  app.get('/api/podcast/token', autenticar, rota(async (req, res) => {
    const t = (await q('select criado_em from podcast_tokens where usuario_id=$1', [U(req)])).rows[0];
    res.json({ existe: Boolean(t), criado_em: t?.criado_em ?? null });
  }));
  /** Gera (ou renova) a credencial; a anterior deixa de valer. O token só aparece aqui, uma vez. */
  app.post('/api/podcast/token/renovar', autenticar, rota(async (req, res) => {
    const token = novoToken();
    await q(`insert into podcast_tokens (usuario_id, token_hash) values ($1,$2) on conflict (usuario_id) do update set token_hash=excluded.token_hash, criado_em=now()`, [U(req), sha256(token)]);
    const pls = (await q('select id, titulo from podcast_playlists where usuario_id=$1 order by criada_em desc limit 100', [U(req)])).rows;
    res.json({ token, feeds: pls.map((p) => ({ playlist_id: p.id, titulo: p.titulo, url: `${base(req)}/api/podcast/feed/${p.id}/${token}` })) });
  }));
  app.delete('/api/podcast/token', autenticar, rota(async (req, res) => { await q('delete from podcast_tokens where usuario_id=$1', [U(req)]); res.json({ ok: true }); }));

  /** O token vale se for o público da playlist (ligado) ou a credencial do dono. */
  async function temAcesso(playlist, token) {
    const t = String(token ?? '');
    if (t.length < 16 || t.length > 100) return false;
    if (playlist.publica && playlist.token_publico && igual(playlist.token_publico, t)) return true;
    return Boolean((await q('select 1 from podcast_tokens where usuario_id=$1 and token_hash=$2', [playlist.usuario_id, sha256(t)])).rows[0]);
  }
  const naoAchou = (res) => res.status(404).json({ erro: 'Link inválido ou revogado.' });
  const XML = { 'Content-Type': 'application/rss+xml; charset=utf-8', 'Cache-Control': 'private, max-age=60' };

  app.get('/api/podcast/feed/:id/:token', validarId, rota(async (req, res) => {
    const p = (await q('select * from podcast_playlists where id=$1', [req.params.id])).rows[0];
    if (!p || !(await temAcesso(p, req.params.token))) return naoAchou(res);
    const itens = (await q(`select ${COLS} from podcast_itens i where i.playlist_id=$1 and i.roteiro <> '' order by i.posicao, i.criado_em`, [p.id])).rows;
    const xml = montarRSS({ titulo: p.titulo, descricao: p.prompt || `Playlist de estudo "${p.titulo}" — Revalida Prático.`, link: base(req),
      itens: itens.map((i) => ({ id: i.id, titulo: i.titulo, roteiro: i.roteiro, data: i.criado_em, duracao_s: i.duracao_s,
        audio: i.tem_audio ? { url: `${base(req)}/api/podcast/audio/${i.id}/${req.params.token}`, bytes: i.audio_bytes, mime: i.audio_mime } : null })) });
    res.set(XML); res.status(200).send(xml);
  }));
  app.get('/api/podcast/audio/:id/:token', validarId, rota(async (req, res) => {
    const it = (await q(`select i.id, i.titulo, i.audio_arquivo, i.audio_mime, p.id playlist_id, p.usuario_id, p.publica, p.token_publico from podcast_itens i join podcast_playlists p on p.id = i.playlist_id where i.id=$1`, [req.params.id])).rows[0];
    if (!it || !it.audio_arquivo || !(await temAcesso(it, req.params.token))) return naoAchou(res);
    return enviarAudio(req, res, it, { baixar: req.query?.baixar === '1' });
  }));

  /* ---------- radIA.m3d / rádio Revalida ---------- */
  app.get('/api/radia/canal', autenticar, rota(async (req, res) => {
    const n = (await q('select count(*)::int n from podcast_itens where publico')).rows[0].n;
    res.json({ ...CANAL, episodios: n, feed: `${base(req)}/api/radia/feed`, sincronizacao: Boolean(cfg.obter('RADIA_URL') && cfg.obter('RADIA_TOKEN')) });
  }));
  const PUB = `select ${COLS}, t.nome tema, t.area, u.nome autor from podcast_itens i join podcast_playlists p on p.id = i.playlist_id join usuarios u on u.id = p.usuario_id left join temas t on t.id = i.tema_id where i.publico`;
  app.get('/api/radia/programa', autenticar, rota(async (req, res) => {
    const por = Math.max(1, Math.min(50, Math.round(Number(req.query?.por) || 20))); const pag = Math.max(1, Math.round(Number(req.query?.pagina) || 1));
    const total = (await q('select count(*)::int n from podcast_itens where publico')).rows[0].n;
    const r = await q(`${PUB} order by i.publicado_em desc, i.id limit $1 offset $2`, [por, (pag - 1) * por]);
    res.json({ total, pagina: pag, por, itens: r.rows.map((i) => ({ ...itemPublico({ ...i, autor: String(i.autor).split(' ')[0] }), roteiro: undefined, transcricao: i.roteiro })) });
  }));
  /** Áudio de episódio PÚBLICO (quem publicou escolheu tornar aberto): serve ao player da plataforma e aos apps de podcast. */
  app.get('/api/radia/audio/:id', validarId, rota(async (req, res) => {
    const it = (await q('select id, titulo, audio_arquivo, audio_mime from podcast_itens where id=$1 and publico', [req.params.id])).rows[0];
    if (!it?.audio_arquivo) return res.status(404).json({ erro: 'Episódio indisponível.' });
    return enviarAudio(req, res, it, { baixar: req.query?.baixar === '1' });
  }));
  app.get('/api/radia/feed', rota(async (req, res) => {
    const r = await q(`${PUB} order by i.publicado_em desc, i.id limit 100`);
    const xml = montarRSS({ titulo: CANAL.nome, descricao: 'Programa de revisão para a 2ª fase do Revalida — radIA.m3d.', link: CANAL.site,
      itens: r.rows.map((i) => ({ id: i.id, titulo: i.titulo, roteiro: i.roteiro, data: i.publicado_em || i.criado_em, duracao_s: i.duracao_s,
        audio: i.tem_audio ? { url: `${base(req)}/api/radia/audio/${i.id}`, bytes: i.audio_bytes, mime: i.audio_mime } : null })) });
    res.set({ ...XML, 'Cache-Control': 'public, max-age=300' }); res.status(200).send(xml);
  }));
  /** Publica/retira o próprio episódio do programa. Só entra episódio com transcrição. */
  app.put('/api/podcast/itens/:id/radia', autenticar, validarId, rota(async (req, res) => {
    const it = await meuItem(req.params.id, U(req));
    if (!it) return res.status(404).json({ erro: 'Episódio não encontrado.' });
    const publico = req.body?.publico === true;
    if (publico && !it.roteiro) return res.status(400).json({ erro: 'Gere a transcrição antes de enviar o episódio à rádio.' });
    await q(`update podcast_itens set publico=$2, publicado_em=case when $2 then coalesce(publicado_em, now()) else null end where id=$1`, [it.id, publico]);
    res.json({ publico });
  }));
  /** Moderação: a administração tira qualquer episódio do ar. */
  app.delete('/api/radia/programa/:id', autenticar, exigirAdmin, validarId, rota(async (req, res) => {
    const r = await q('update podcast_itens set publico=false, publicado_em=null where id=$1 and publico returning id', [req.params.id]);
    if (!r.rows[0]) return res.status(404).json({ erro: 'Episódio não está no programa.' });
    res.json({ ok: true });
  }));

  /* ---------- pacote de exportação e pool ---------- */
  app.post('/api/radia/exportar', autenticar, rota(async (req, res) => {
    const temaIds = Array.isArray(req.body?.temas) ? [...new Set(req.body.temas.filter(idValido))].slice(0, 20) : [];
    const itemIds = Array.isArray(req.body?.itens) ? [...new Set(req.body.itens.filter(idValido))].slice(0, 50) : [];
    if (!temaIds.length && !itemIds.length) return res.status(400).json({ erro: 'Escolha ao menos um tema ou episódio para exportar.' });
    const pacote = await montarPacote(q, { usuarioId: U(req), temaIds, itemIds, dir });
    if (!pacote.temas.length && !pacote.episodios.length) return res.status(400).json({ erro: 'Nada para exportar: temas ou episódios não encontrados (episódios precisam ter transcrição).' });
    const n = pacote.temas.length + pacote.episodios.length;
    const titulo = txt(req.body?.titulo, 140) || `Revisão — ${[...pacote.temas.map((t) => t.nome), ...pacote.episodios.map((e) => e.titulo)].slice(0, 3).join(', ')}`;
    const r = await q('insert into radia_pool (solicitante_id, titulo, pacote, itens) values ($1,$2,$3,$4) returning id, titulo, itens, status, solicitado_em', [U(req), titulo, JSON.stringify(pacote), n]);
    res.status(201).json(r.rows[0]);
  }));
  app.get('/api/radia/pool', autenticar, rota(async (req, res) => {
    const todos = req.query?.todos === '1' && ehAdmin(req.usuario);
    const dir_ = req.query?.ordem === 'desc' ? 'desc' : 'asc';      // padrão: na ordem em que foram solicitados
    const r = await q(`select p.id, p.titulo, p.itens, p.status, p.tentativas, p.erro, p.solicitado_em, p.sincronizado_em${todos ? ', u.nome solicitante' : ''}
      from radia_pool p ${todos ? 'join usuarios u on u.id = p.solicitante_id' : ''} where ${todos ? 'true' : 'p.solicitante_id = $1'} order by p.solicitado_em ${dir_}, p.id limit 200`, todos ? [] : [U(req)]);
    res.json({ sincronizacao: Boolean(cfg.obter('RADIA_URL') && cfg.obter('RADIA_TOKEN')), max_tentativas: MAX_TENTATIVAS, pedidos: r.rows });
  }));
  app.get('/api/radia/pool/:id/pacote', autenticar, validarId, rota(async (req, res) => {
    const p = (await q('select id, titulo, pacote, solicitante_id, solicitado_em from radia_pool where id=$1', [req.params.id])).rows[0];
    if (!p || (p.solicitante_id !== U(req) && !ehAdmin(req.usuario))) return res.status(404).json({ erro: 'Pedido não encontrado.' });
    const pacote = await pacoteComAudio(q, p.pacote, dir);
    res.set({ 'Content-Type': 'application/json; charset=utf-8', 'Content-Disposition': `attachment; filename="radia-pacote-${String(p.id).slice(0, 8)}.json"` });
    res.status(200).send(JSON.stringify({ ...pacote, pedido_id: p.id, solicitado_em: p.solicitado_em }, null, 2));
  }));
  app.delete('/api/radia/pool/:id', autenticar, validarId, rota(async (req, res) => {
    const r = await q(`delete from radia_pool where id=$1 and solicitante_id=$2 and status <> 'sincronizado' returning id`, [req.params.id, U(req)]);
    if (!r.rows[0]) return res.status(404).json({ erro: 'Pedido não encontrado ou já sincronizado.' });
    res.json({ ok: true });
  }));
  app.post('/api/radia/sincronizar', autenticar, exigirAdmin, rota(async (_req, res) => {
    res.json(await sincronizarPool({ q, cfg, fetchImpl, dir }));
  }));

  if (intervaloSyncMin > 0) {
    const t = setInterval(() => { sincronizarPool({ q, cfg, fetchImpl, dir }).catch((e) => console.error('sincronização radIA:', e.message)); }, intervaloSyncMin * 60_000);
    t.unref?.();
  }
}
