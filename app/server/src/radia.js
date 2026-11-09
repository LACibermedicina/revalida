// radIA.m3d / Revalida: pacote de exportação, pool de sincronização e RSS.
// O pool guarda o pedido (com a data) até o worker entregar ao site da rádio; a rádio real (radia.m3d.pro) só é alcançada em produção.
import fs from 'node:fs/promises';
import path from 'node:path';

export const CANAL = { nome: 'radIA.m3d · Revalida', site: 'https://radia.m3d.pro/revalida', programa: 'radIA.m3d' };
export const MAX_TENTATIVAS = 5;
const MAX_AUDIO_PACOTE = 25 * 1024 * 1024;       // áudio em base64 só entra no pacote até este total

const esc = (s) => String(s ?? '').replace(/[<>&'"\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c] ?? ''));

const hms = (s) => { const n = Math.max(0, Math.round(Number(s) || 0)); return [Math.floor(n / 3600), Math.floor(n % 3600 / 60), n % 60].map((v, k) => (k ? String(v).padStart(2, '0') : String(v))).join(':'); };

/** RSS 2.0 com tags iTunes e Podcasting 2.0: serve para qualquer app de podcast (padrão de entrada para importação).
 *  `itens[].audio` = { url, mime, bytes } ou null; `itens[].transcricao_url` (opcional) vira <podcast:transcript>. */
export function montarRSS({ titulo, descricao, link, imagem = null, itens, autor = 'Revalida Prático', self = null }) {
  const corpo = itens.map((i, k) => `    <item>
      <title>${esc(i.titulo)}</title>
      <description>${esc(String(i.roteiro).slice(0, 4000))}</description>
      <itunes:summary>${esc(String(i.roteiro).slice(0, 4000))}</itunes:summary>
      <content:encoded><![CDATA[${String(i.roteiro).replace(/\]\]>/g, ']]]]><![CDATA[>').replace(/\n/g, '<br/>')}]]></content:encoded>
      <guid isPermaLink="false">${esc(i.id)}</guid>
      <pubDate>${new Date(i.data).toUTCString()}</pubDate>${i.audio ? `\n      <enclosure url="${esc(i.audio.url)}" length="${Number(i.audio.bytes) || 0}" type="${esc(i.audio.mime || 'audio/mpeg')}"/>` : ''}
      <itunes:duration>${hms(i.duracao_s)}</itunes:duration>
      <itunes:episode>${k + 1}</itunes:episode>
      <itunes:explicit>false</itunes:explicit>${i.transcricao_url ? `\n      <podcast:transcript url="${esc(i.transcricao_url)}" type="text/plain" language="pt-BR"/>` : ''}
    </item>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:podcast="https://podcastindex.org/namespace/1.0">
  <channel>
    <title>${esc(titulo)}</title>
    <link>${esc(link)}</link>
    <description>${esc(descricao)}</description>
    <language>pt-br</language>${self ? `\n    <atom:link href="${esc(self)}" rel="self" type="application/rss+xml"/>` : ''}
    <generator>Revalida Prático</generator>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <itunes:author>${esc(autor)}</itunes:author>
    <itunes:summary>${esc(descricao)}</itunes:summary>
    <itunes:type>episodic</itunes:type>
    <itunes:category text="Education"/>
    <itunes:explicit>false</itunes:explicit>${imagem ? `\n    <itunes:image href="${esc(imagem)}"/>\n    <image><url>${esc(imagem)}</url><title>${esc(titulo)}</title><link>${esc(link)}</link></image>` : ''}
${corpo}
  </channel>
</rss>
`;
}

async function lerAudio(dir, item) {
  if (!item.audio_arquivo) return null;
  try { return await fs.readFile(path.join(dir, path.basename(item.audio_arquivo))); } catch { return null; }
}

/**
 * Monta o pacote de exportação. Só conteúdo de estudo (nada pessoal do aluno):
 * temas (com cartões) e/ou episódios do próprio usuário (roteiro + áudio opcional).
 */
export async function montarPacote(q, { usuarioId, temaIds = [], itemIds = [], dir, comAudio = false }) {
  const temas = [];
  for (const id of temaIds) {
    const t = (await q('select id, nome, area, descricao from temas where id=$1', [id])).rows[0]; if (!t) continue;
    const cartoes = (await q('select frente, verso from cartoes where tema_id=$1 order by serie, criado_em limit 60', [id])).rows;
    temas.push({ nome: t.nome, area: t.area, descricao: t.descricao, cartoes });
  }
  const episodios = []; let bytes = 0; let audioOmitido = 0;
  for (const id of itemIds) {
    const i = (await q(`select i.id, i.titulo, i.topico, i.tipo, i.roteiro, i.duracao_s, i.audio_arquivo, i.audio_mime, t.nome tema, t.area
        from podcast_itens i join podcast_playlists p on p.id = i.playlist_id left join temas t on t.id = i.tema_id
        where i.id=$1 and p.usuario_id=$2 and i.roteiro <> ''`, [id, usuarioId])).rows[0]; if (!i) continue;
    const ep = { id: i.id, titulo: i.titulo, tema: i.tema, area: i.area, topico: i.topico, tipo: i.tipo, roteiro: i.roteiro, duracao_s: i.duracao_s, audio: null };
    if (comAudio) {
      const buf = await lerAudio(dir, i);
      if (buf && bytes + buf.length <= MAX_AUDIO_PACOTE) { bytes += buf.length; ep.audio = { mime: i.audio_mime || 'audio/mpeg', base64: buf.toString('base64') }; } else if (buf) audioOmitido++;
    }
    episodios.push(ep);
  }
  return { formato: 'revalida-radia-pacote', versao: 1, origem: 'Revalida Prático', canal: CANAL.site, gerado_em: new Date().toISOString(), temas, episodios, audio_omitido: audioOmitido };
}

/** Devolve o pacote com o áudio (base64) lido do disco no momento da entrega: o pool guarda só os roteiros. */
export async function pacoteComAudio(q, pacote, dir) {
  const episodios = []; let total = 0;
  for (const ep of pacote.episodios ?? []) {
    const c = { ...ep, audio: null };
    if (ep.id) {
      const row = (await q('select audio_arquivo, audio_mime from podcast_itens where id=$1', [ep.id])).rows[0];
      const buf = row ? await lerAudio(dir, row) : null;
      if (buf && total + buf.length <= MAX_AUDIO_PACOTE) { total += buf.length; c.audio = { mime: row.audio_mime || 'audio/mpeg', base64: buf.toString('base64') }; }
    }
    episodios.push(c);
  }
  return { ...pacote, episodios };
}

/**
 * Worker: entrega ao site da rádio os pedidos pendentes (e os com erro que ainda têm tentativas), do mais antigo ao mais novo.
 * Contrato (proposto, a confirmar com a rádio): POST RADIA_URL, `Authorization: Bearer RADIA_TOKEN`, `Idempotency-Key: <id do pedido>`,
 * corpo = pacote JSON; qualquer 2xx confirma.
 */
export async function sincronizarPool({ q, cfg, fetchImpl = globalThis.fetch, dir, limite = 20, timeoutMs = 30_000 }) {
  const url = cfg.obter('RADIA_URL'); const token = cfg.obter('RADIA_TOKEN');
  if (!url || !token) return { configurado: false, enviados: 0, erros: 0, restantes: 0 };
  const fila = (await q(`select id, pacote from radia_pool where status = 'pendente' or (status = 'erro' and tentativas < $1) order by solicitado_em, id limit $2`, [MAX_TENTATIVAS, limite])).rows;
  let enviados = 0; let erros = 0;
  for (const p of fila) {
    try {
      const pacote = { ...(await pacoteComAudio(q, p.pacote, dir)), pedido_id: p.id };
      const r = await fetchImpl(url, { method: 'POST', signal: AbortSignal.timeout(timeoutMs),
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}`, 'idempotency-key': p.id }, body: JSON.stringify(pacote) });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      await q(`update radia_pool set status='sincronizado', sincronizado_em=now(), erro='', tentativas=tentativas+1 where id=$1`, [p.id]);
      enviados++;
    } catch (e) {
      erros++;
      await q(`update radia_pool set status='erro', erro=$2, tentativas=tentativas+1 where id=$1`, [p.id, String(e?.message ?? e).replace(/[\u0000-\u001F]/g, ' ').slice(0, 200)]);
    }
  }
  const restantes = (await q(`select count(*)::int n from radia_pool where status = 'pendente' or (status = 'erro' and tentativas < $1)`, [MAX_TENTATIVAS])).rows[0].n;
  return { configurado: true, enviados, erros, restantes };
}
