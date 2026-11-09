// Podcast: compartilhar fora da plataforma e agrupar trilhas.
//   • episódio: link público próprio (token opt-in por episódio) → página para ouvir, MP3 e transcrição, sem login;
//   • playlist (grupo de gravações): link público (página), RSS (para apps de podcast) e MP3 de cada episódio;
//   • mover/copiar episódios entre playlists e agrupar vários numa playlist nova.
// Os links são segredos longos (24 bytes aleatórios): quem tem o link ouve; desativar apaga o token e o link morre.
import { montarRSS } from './radia.js';
import { paginaEpisodio, paginaPlaylist } from './podcast-paginas.js';
import { idValido } from './seguranca.js';

const TOKEN = /^[A-Za-z0-9_-]{16,100}$/;

export function registrarPublico(app, { q, autenticar, validarId, rota, base, U, enviarAudio, minhaPlaylist, meuItem, novoToken, arquivo, fs, txt, COLS, Limitador }) {
  const limite = new Limitador({ max: 240, janelaMs: 60e3 });
  const ip = (req) => req.ip || req.headers?.['x-forwarded-for'] || 'anon';
  const protegido = (req, res, prox) => {
    if (limite.excedeu(ip(req))) return res.status(429).set('Retry-After', '60').json({ erro: 'Muitos acessos. Tente de novo em instantes.' });
    limite.registrar(ip(req));
    res.set({ 'X-Robots-Tag': 'noindex, nofollow', 'Referrer-Policy': 'no-referrer' });
    return TOKEN.test(String(req.params.token ?? '')) ? prox() : res.status(404).json({ erro: 'Link inválido ou desativado.' });
  };
  const morto = (res) => res.status(404).json({ erro: 'Link inválido ou desativado.' });
  const HTML = { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'private, max-age=60' };
  const TXT = { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'private, max-age=60' };
  const XML = { 'Content-Type': 'application/rss+xml; charset=utf-8', 'Cache-Control': 'private, max-age=60' };

  const linksEpisodio = (req, t) => ({
    pagina: `${base(req)}/api/ouvir/e/${t}`, audio: `${base(req)}/api/publico/podcast/e/${t}/audio`,
    baixar: `${base(req)}/api/publico/podcast/e/${t}/audio?baixar=1`, transcricao: `${base(req)}/api/publico/podcast/e/${t}/transcricao`,
  });
  const episodioPorToken = async (t) => (await q(`select i.id, i.titulo, i.roteiro, i.duracao_s, i.audio_arquivo, i.audio_mime, i.audio_bytes, p.titulo playlist_titulo
    from podcast_itens i join podcast_playlists p on p.id = i.playlist_id where i.token_publico=$1 and i.roteiro <> ''`, [t])).rows[0];
  const playlistPorToken = async (t) => (await q('select * from podcast_playlists where token_publico=$1 and publica', [t])).rows[0];
  const itensPublicos = async (p) => (await q(`select i.id, i.titulo, i.roteiro, i.duracao_s, i.audio_arquivo, i.audio_mime, i.audio_bytes, i.criado_em
    from podcast_itens i where i.playlist_id=$1 and i.roteiro <> '' order by i.posicao, i.criado_em`, [p.id])).rows;
  const nomeArq = (s) => `${String(s || 'episodio').replace(/[^\w\- ]+/g, '').trim().slice(0, 80) || 'episodio'}`;

  /* ---------- gestão (dono) ---------- */
  app.post('/api/podcast/itens/:id/compartilhar', autenticar, validarId, rota(async (req, res) => {
    const it = await meuItem(req.params.id, U(req));
    if (!it) return res.status(404).json({ erro: 'Episódio não encontrado.' });
    if (req.body?.ativo === false) {
      await q('update podcast_itens set token_publico=null, compartilhado_em=null where id=$1', [it.id]);
      return res.json({ compartilhado: false });
    }
    if (!it.roteiro) return res.status(409).json({ erro: 'O episódio ainda não tem roteiro para compartilhar.' });
    const token = it.token_publico || novoToken();
    await q('update podcast_itens set token_publico=$2, compartilhado_em=coalesce(compartilhado_em, now()) where id=$1', [it.id, token]);
    res.json({ compartilhado: true, tem_audio: Boolean(it.audio_arquivo), links: linksEpisodio(req, token) });
  }));
  app.get('/api/podcast/itens/:id/links', autenticar, validarId, rota(async (req, res) => {
    const it = await meuItem(req.params.id, U(req));
    if (!it) return res.status(404).json({ erro: 'Episódio não encontrado.' });
    res.json(it.token_publico ? { compartilhado: true, links: linksEpisodio(req, it.token_publico) } : { compartilhado: false });
  }));
  app.get('/api/podcast/playlists/:id/links', autenticar, validarId, rota(async (req, res) => {
    const p = await minhaPlaylist(req.params.id, U(req));
    if (!p) return res.status(404).json({ erro: 'Playlist não encontrada.' });
    if (!(p.publica && p.token_publico)) return res.json({ publica: false });
    res.json({ publica: true, pagina: `${base(req)}/api/ouvir/p/${p.token_publico}`, rss: `${base(req)}/api/publico/podcast/p/${p.token_publico}/feed.xml` });
  }));

  /* ---------- agrupar trilhas: mover/copiar para outra playlist ---------- */
  async function levar(item, destino, copiar) {
    const pos = (await q('select coalesce(max(posicao),-1)::int + 1 n from podcast_itens where playlist_id=$1', [destino.id])).rows[0].n;
    if (!copiar) { await q('update podcast_itens set playlist_id=$2, posicao=$3, atualizado_em=now() where id=$1', [item.id, destino.id, pos]); return item.id; }
    const novo = (await q(`insert into podcast_itens (playlist_id, posicao, tipo, tema_id, titulo, topico, prompt, minutos, roteiro, status, erro, duracao_s, audio_normalizado)
      select $2,$3,tipo,tema_id,titulo,topico,prompt,minutos,roteiro,status,erro,duracao_s,audio_normalizado from podcast_itens where id=$1 returning id`, [item.id, destino.id, pos])).rows[0];
    if (item.audio_arquivo) {
      const nome = `${novo.id}.mp3`;
      try { await fs.copyFile(arquivo(item.audio_arquivo), arquivo(nome)); await q('update podcast_itens set audio_arquivo=$2, audio_mime=$3, audio_bytes=$4 where id=$1', [novo.id, nome, item.audio_mime, item.audio_bytes]); }
      catch { await q(`update podcast_itens set status = case when roteiro <> '' then 'roteiro' else status end where id=$1`, [novo.id]); }
    }
    return novo.id;
  }
  const cabe = async (playlistId, n) => (await q('select count(*)::int n from podcast_itens where playlist_id=$1', [playlistId])).rows[0].n + n <= 100;

  app.post('/api/podcast/itens/:id/mover', autenticar, validarId, rota(async (req, res) => {
    const it = await meuItem(req.params.id, U(req));
    if (!it) return res.status(404).json({ erro: 'Episódio não encontrado.' });
    if (!idValido(req.body?.playlist_id)) return res.status(400).json({ erro: 'Escolha a playlist de destino.' });
    const destino = await minhaPlaylist(req.body.playlist_id, U(req));
    if (!destino) return res.status(404).json({ erro: 'Playlist de destino não encontrada.' });
    const copiar = req.body?.copiar === true;
    if (destino.id === it.playlist_id && !copiar) return res.json({ ok: true, item_id: it.id, playlist_id: destino.id });
    if (!(await cabe(destino.id, 1))) return res.status(409).json({ erro: 'Limite de 100 episódios por playlist.' });
    const id = await levar(it, destino, copiar);
    res.json({ ok: true, item_id: id, playlist_id: destino.id, copiado: copiar });
  }));

  /** Cria uma playlist nova (grupo) já com os episódios escolhidos (movendo ou copiando). */
  app.post('/api/podcast/playlists/agrupar', autenticar, rota(async (req, res) => {
    const titulo = txt(req.body?.titulo, 120);
    const ids = [...new Set((Array.isArray(req.body?.itens) ? req.body.itens : []).filter(idValido))].slice(0, 100);
    if (titulo.length < 2) return res.status(400).json({ erro: 'Dê um título ao grupo.' });
    if (!ids.length) return res.status(400).json({ erro: 'Escolha ao menos um episódio.' });
    if ((await q('select count(*)::int n from podcast_playlists where usuario_id=$1', [U(req)])).rows[0].n >= 50) return res.status(409).json({ erro: 'Limite de 50 playlists.' });
    const itens = [];
    for (const id of ids) { const it = await meuItem(id, U(req)); if (!it) return res.status(404).json({ erro: 'Algum episódio não foi encontrado.' }); itens.push(it); }
    const pl = (await q('insert into podcast_playlists (usuario_id, titulo, prompt) values ($1,$2,$3) returning id, titulo, prompt, publica, criada_em', [U(req), titulo, txt(req.body?.prompt, 1500)])).rows[0];
    const copiar = req.body?.copiar !== false;        // por padrão copia (as playlists de origem continuam como estavam)
    for (const it of itens) await levar(it, pl, copiar);
    res.status(201).json({ playlist: pl, itens: itens.length, copiado: copiar });
  }));

  /* ---------- público: episódio ---------- */
  app.get('/api/ouvir/e/:token', protegido, rota(async (req, res) => {
    const e = await episodioPorToken(req.params.token); if (!e) return morto(res);
    const L = linksEpisodio(req, req.params.token); const tem = Boolean(e.audio_arquivo);
    res.set(HTML).status(200).send(paginaEpisodio({ titulo: e.titulo, album: e.playlist_titulo, roteiro: e.roteiro, duracao_s: e.duracao_s, audioUrl: tem ? L.audio : null, baixarUrl: tem ? L.baixar : null, txtUrl: L.transcricao, url: L.pagina }));
  }));
  app.get('/api/publico/podcast/e/:token', protegido, rota(async (req, res) => {
    const e = await episodioPorToken(req.params.token); if (!e) return morto(res);
    const L = linksEpisodio(req, req.params.token);
    res.json({ titulo: e.titulo, playlist: e.playlist_titulo, duracao_s: e.duracao_s, tem_audio: Boolean(e.audio_arquivo), audio_url: e.audio_arquivo ? L.audio : null, transcricao_url: L.transcricao, roteiro: e.roteiro,
      formato: e.audio_arquivo ? { mime: e.audio_mime, bytes: e.audio_bytes } : null });
  }));
  app.get('/api/publico/podcast/e/:token/audio', protegido, rota(async (req, res) => {
    const e = await episodioPorToken(req.params.token); if (!e || !e.audio_arquivo) return morto(res);
    return enviarAudio(req, res, e, { baixar: req.query?.baixar === '1' });
  }));
  app.get('/api/publico/podcast/e/:token/transcricao', protegido, rota(async (req, res) => {
    const e = await episodioPorToken(req.params.token); if (!e) return morto(res);
    res.set({ ...TXT, 'Content-Disposition': `inline; filename="${nomeArq(e.titulo)}.txt"` }).status(200).send(`${e.titulo}\n${'='.repeat(Math.min(60, e.titulo.length))}\n\n${e.roteiro}\n`);
  }));

  /* ---------- público: playlist ---------- */
  const linksItemPl = (req, t, id) => ({ audio: `${base(req)}/api/publico/podcast/p/${t}/audio/${id}`, baixar: `${base(req)}/api/publico/podcast/p/${t}/audio/${id}?baixar=1`, txt: `${base(req)}/api/publico/podcast/p/${t}/transcricao/${id}` });
  app.get('/api/ouvir/p/:token', protegido, rota(async (req, res) => {
    const p = await playlistPorToken(req.params.token); if (!p) return morto(res);
    const itens = (await itensPublicos(p)).map((i) => { const L = linksItemPl(req, req.params.token, i.id); const tem = Boolean(i.audio_arquivo);
      return { titulo: i.titulo, roteiro: i.roteiro, duracao_s: i.duracao_s, audioUrl: tem ? L.audio : null, baixarUrl: tem ? L.baixar : null, txtUrl: L.txt }; });
    res.set(HTML).status(200).send(paginaPlaylist({ titulo: p.titulo, descricao: p.prompt, itens, rssUrl: `${base(req)}/api/publico/podcast/p/${req.params.token}/feed.xml`, url: `${base(req)}/api/ouvir/p/${req.params.token}` }));
  }));
  app.get('/api/publico/podcast/p/:token', protegido, rota(async (req, res) => {
    const p = await playlistPorToken(req.params.token); if (!p) return morto(res);
    const itens = (await itensPublicos(p)).map((i) => { const L = linksItemPl(req, req.params.token, i.id); return { id: i.id, titulo: i.titulo, duracao_s: i.duracao_s, tem_audio: Boolean(i.audio_arquivo), audio_url: i.audio_arquivo ? L.audio : null, transcricao_url: L.txt, roteiro: i.roteiro }; });
    res.json({ titulo: p.titulo, descricao: p.prompt, rss: `${base(req)}/api/publico/podcast/p/${req.params.token}/feed.xml`, itens });
  }));
  app.get('/api/publico/podcast/p/:token/feed.xml', protegido, rota(async (req, res) => {
    const p = await playlistPorToken(req.params.token); if (!p) return morto(res);
    const itens = await itensPublicos(p); const t = req.params.token;
    const xml = montarRSS({ titulo: p.titulo, descricao: p.prompt || `Playlist de estudo "${p.titulo}" — Revalida Prático.`, link: `${base(req)}/api/ouvir/p/${t}`, imagem: `${base(req)}/apple-touch-icon.png`, self: `${base(req)}/api/publico/podcast/p/${t}/feed.xml`,
      itens: itens.map((i) => { const L = linksItemPl(req, t, i.id); return { id: i.id, titulo: i.titulo, roteiro: i.roteiro, data: i.criado_em, duracao_s: i.duracao_s, transcricao_url: L.txt,
        audio: i.audio_arquivo ? { url: L.audio, bytes: i.audio_bytes, mime: i.audio_mime } : null }; }) });
    res.set(XML).status(200).send(xml);
  }));
  const itemDaPlaylist = async (req) => {
    if (!idValido(req.params.itemId)) return null;
    const p = await playlistPorToken(req.params.token); if (!p) return null;
    return (await q(`select i.id, i.titulo, i.roteiro, i.audio_arquivo, i.audio_mime from podcast_itens i where i.id=$1 and i.playlist_id=$2 and i.roteiro <> ''`, [req.params.itemId, p.id])).rows[0] ?? null;
  };
  app.get('/api/publico/podcast/p/:token/audio/:itemId', protegido, rota(async (req, res) => {
    const i = await itemDaPlaylist(req); if (!i || !i.audio_arquivo) return morto(res);
    return enviarAudio(req, res, i, { baixar: req.query?.baixar === '1' });
  }));
  app.get('/api/publico/podcast/p/:token/transcricao/:itemId', protegido, rota(async (req, res) => {
    const i = await itemDaPlaylist(req); if (!i) return morto(res);
    res.set({ ...TXT, 'Content-Disposition': `inline; filename="${nomeArq(i.titulo)}.txt"` }).status(200).send(`${i.titulo}\n${'='.repeat(Math.min(60, i.titulo.length))}\n\n${i.roteiro}\n`);
  }));
}
