// Voz do podcast: provedor de TTS configurável, compatível com POST /audio/speech da OpenAI.
// Sem provedor configurado, `configurado()` é falso e o episódio fica só com a transcrição (o navegador pode ler em voz alta).
import { ErroIA } from './ia.js';

const LIMITE = 3800;       // a API aceita 4096 caracteres por chamada
/** Quebra o texto em pedaços de até `max` caracteres, preferindo fim de frase. */
export function dividirTexto(texto, max = LIMITE) {
  const partes = []; let resto = String(texto).trim();
  while (resto.length > max) {
    let corte = Math.max(resto.lastIndexOf('. ', max), resto.lastIndexOf('\n', max), resto.lastIndexOf('? ', max), resto.lastIndexOf('! ', max));
    if (corte < max * 0.5) corte = resto.lastIndexOf(' ', max);
    if (corte < 1) corte = max;
    partes.push(resto.slice(0, corte + 1).trim()); resto = resto.slice(corte + 1).trim();
  }
  if (resto) partes.push(resto);
  return partes;
}

export function criarTTS({ cfg, fetchImpl = globalThis.fetch, timeoutMs = 60_000 }) {
  const url = () => {
    const u = cfg.obter('TTS_URL'); if (!u) return null;
    return /\/audio\/speech\/?$/.test(u) ? u : `${u.replace(/\/$/, '')}/audio/speech`;
  };
  return {
    configurado: () => Boolean(url() && cfg.obter('TTS_CHAVE')),
    /** → { buffer, mime }. Lança ErroIA('TTS_FALHA') sem vazar a chave. */
    async sintetizar(texto) {
      const alvo = url(); const chave = cfg.obter('TTS_CHAVE');
      if (!alvo || !chave) throw new ErroIA('TTS_NAO_CONFIGURADO', 'A voz (TTS) não está configurada neste servidor.');
      const blocos = [];
      for (const parte of dividirTexto(texto)) {
        let r;
        try {
          r = await fetchImpl(alvo, { method: 'POST', signal: AbortSignal.timeout(timeoutMs),
            headers: { 'content-type': 'application/json', authorization: `Bearer ${chave}` },
            body: JSON.stringify({ model: cfg.obter('TTS_MODELO') || 'tts-1', voice: cfg.obter('TTS_VOZ') || 'alloy', input: parte, response_format: 'mp3' }) });
        } catch { throw new ErroIA('TTS_FALHA', 'O serviço de voz não respondeu.'); }
        if (!r.ok) throw new ErroIA('TTS_FALHA', `O serviço de voz recusou o pedido (HTTP ${r.status}).`);
        blocos.push(Buffer.from(await r.arrayBuffer()));
      }
      const buffer = Buffer.concat(blocos);
      if (!buffer.length) throw new ErroIA('TTS_FALHA', 'O serviço de voz devolveu áudio vazio.');
      return { buffer, mime: 'audio/mpeg' };   // MP3 concatenado quadro a quadro continua tocável
    },
  };
}
