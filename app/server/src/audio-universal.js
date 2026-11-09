// Padrão de áudio do Revalida Prático: o MESMO arquivo serve ao navegador, ao app de podcast e à importação em outras plataformas.
//   MP3 (MPEG-1 Layer III) · mono · 44 100 Hz · 64 kbps CBR · tags ID3v2.3 (título, artista, álbum, faixa, gênero Podcast, ano, comentário).
// Convertido com o ffmpeg quando ele existe no servidor; sem ffmpeg (ou com AUDIO_NORMALIZAR=0) o áudio original do TTS é mantido
// (já é MP3) e a duração segue estimada pelo texto. Nada aqui usa shell: os argumentos vão em lista.
import { spawn } from 'node:child_process';

export const PADRAO_AUDIO = Object.freeze({
  codec: 'MP3 (MPEG-1 Layer III)', mime: 'audio/mpeg', extensao: 'mp3', canais: 1, taxaHz: 44100, kbps: 64, cbr: true,
  tags: 'ID3v2.3 (título, artista, álbum, faixa, gênero, ano, comentário)', transcricao: 'texto UTF-8 (.txt) por episódio',
  feed: 'RSS 2.0 + iTunes + Podcasting 2.0 (podcast:transcript)',
});

const limpar = (v, n = 200) => String(v ?? '').replace(/[\u0000-\u001F\u007F]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);

let cacheDisponivel = new Map();
export function ffmpegDisponivel(bin = 'ffmpeg') {
  if (cacheDisponivel.has(bin)) return cacheDisponivel.get(bin);
  const p = new Promise((resolve) => {
    try { const c = spawn(bin, ['-version'], { stdio: 'ignore' }); c.on('error', () => resolve(false)); c.on('close', (k) => resolve(k === 0)); } catch { resolve(false); }
  });
  cacheDisponivel.set(bin, p); return p;
}
export const _limparCache = () => { cacheDisponivel = new Map(); };

/** Duração exata de um MP3 CBR: bytes de áudio (sem a tag ID3 do início) × 8 ÷ taxa. */
export function duracaoCBR(buffer, kbps = PADRAO_AUDIO.kbps) {
  let ini = 0;
  if (buffer.length > 10 && buffer.toString('latin1', 0, 3) === 'ID3') ini = 10 + ((buffer[6] & 0x7f) << 21 | (buffer[7] & 0x7f) << 14 | (buffer[8] & 0x7f) << 7 | (buffer[9] & 0x7f));
  return Math.max(0, Math.round(((buffer.length - ini) * 8) / (kbps * 1000)));
}

/** → { buffer, duracao_s|null, normalizado, motivo? }. Nunca lança: em qualquer falha devolve o áudio original. */
export async function normalizarMP3(buffer, meta = {}, { bin = process.env.FFMPEG_BIN || 'ffmpeg', ativo = process.env.AUDIO_NORMALIZAR !== '0', timeoutMs = 180_000 } = {}) {
  if (!ativo) return { buffer, duracao_s: null, normalizado: false, motivo: 'desligado (AUDIO_NORMALIZAR=0)' };
  if (!(await ffmpegDisponivel(bin))) return { buffer, duracao_s: null, normalizado: false, motivo: 'ffmpeg não encontrado no servidor' };
  const m = { title: limpar(meta.titulo), artist: limpar(meta.artista || 'Revalida Prático'), album: limpar(meta.album || 'Revalida Prático'),
    genre: 'Podcast', date: String(meta.ano || new Date().getUTCFullYear()), comment: limpar(meta.comentario, 300) };
  if (meta.faixa) m.track = String(Number(meta.faixa) || 1);
  const args = ['-hide_banner', '-loglevel', 'error', '-i', 'pipe:0', '-vn', '-map_metadata', '-1', '-ac', String(PADRAO_AUDIO.canais), '-ar', String(PADRAO_AUDIO.taxaHz),
    '-c:a', 'libmp3lame', '-b:a', `${PADRAO_AUDIO.kbps}k`, '-write_xing', '0', '-id3v2_version', '3',
    ...Object.entries(m).filter(([, v]) => v).flatMap(([k, v]) => ['-metadata', `${k}=${v}`]), '-f', 'mp3', 'pipe:1'];
  return new Promise((resolve) => {
    const falha = (motivo) => resolve({ buffer, duracao_s: null, normalizado: false, motivo });
    let c; try { c = spawn(bin, args, { stdio: ['pipe', 'pipe', 'pipe'] }); } catch { return falha('não foi possível iniciar o ffmpeg'); }
    const partes = []; let erro = ''; let feito = false;
    const t = setTimeout(() => { if (!feito) { c.kill('SIGKILL'); } }, timeoutMs);
    c.stdout.on('data', (d) => partes.push(d)); c.stderr.on('data', (d) => { erro += d; if (erro.length > 2000) erro = erro.slice(-2000); });
    c.stdin.on('error', () => {}); c.on('error', () => { feito = true; clearTimeout(t); falha('erro ao executar o ffmpeg'); });
    c.on('close', (codigo) => {
      feito = true; clearTimeout(t);
      const saida = Buffer.concat(partes);
      if (codigo !== 0 || saida.length < 100) return falha(`o ffmpeg não converteu (${limpar(erro, 160) || `código ${codigo}`})`);
      resolve({ buffer: saida, duracao_s: duracaoCBR(saida), normalizado: true });
    });
    c.stdin.end(buffer);
  });
}
