// Transcrição da fala do candidato durante a estação.
//  1) Reconhecimento de voz do navegador (pt-BR), em tempo real.
//  2) Reserva: se o navegador não tem reconhecimento (ou ele falha, como no Electron sem chave do Google),
//     grava trechos curtos do microfone e o servidor pede à IA para transcrever.
// Só o microfone do candidato é transcrito, e só enquanto a estação anda: ao receber "encerrada" do servidor tudo para.
const RECONHECIMENTO = () => (typeof window !== 'undefined' ? window.SpeechRecognition || window.webkitSpeechRecognition : null);
export const suportaReconhecimento = () => Boolean(RECONHECIMENTO());
export const suportaGravacao = () => typeof navigator !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia) && typeof MediaRecorder !== 'undefined';
export const podeTranscrever = () => suportaReconhecimento() || suportaGravacao();

const blobParaBase64 = (blob) => new Promise((ok, no) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(',')[1] ?? ''); r.onerror = () => no(new Error('áudio')); r.readAsDataURL(blob); });

/**
 * enviarTexto(texto, inicioMs) / enviarAudio(mime, base64) devolvem uma promessa; erro com `codigo === 'TRANSCRICAO_ENCERRADA'` encerra tudo.
 * aoEstado: 'ouvindo' | 'parada' | 'negado' | 'encerrada' | 'erro'.  aoTexto(texto, parcial) mostra o que está sendo reconhecido.
 */
export function criarTranscritor({ enviarTexto, enviarAudio, aoEstado = () => {}, aoTexto = () => {}, trechoMs = 8000, agora = () => Date.now() }) {
  let ativo = false; let rec = null; let modo = null; let t0 = 0; let fila = Promise.resolve(); let gravacao = null;

  const mandar = (fn) => { fila = fila.then(fn).catch((e) => { if (e?.codigo === 'TRANSCRICAO_ENCERRADA') { parar(false); aoEstado('encerrada'); } else if (ativo) aoEstado('erro'); }); return fila; };

  function iniciarReconhecimento() {
    const R = RECONHECIMENTO(); modo = 'voz';
    rec = new R(); rec.lang = 'pt-BR'; rec.continuous = true; rec.interimResults = true;
    rec.onresult = (ev) => {
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const r = ev.results[i]; const texto = String(r[0]?.transcript ?? '').trim();
        if (!texto) continue;
        aoTexto(texto, !r.isFinal);
        if (r.isFinal) { const ini = Math.max(0, agora() - t0); mandar(() => enviarTexto(texto, ini)); }
      }
    };
    rec.onerror = (ev) => {
      if (ev.error === 'not-allowed' || ev.error === 'service-not-allowed') { ativo = false; aoEstado('negado'); }
      else if (ev.error === 'network' || ev.error === 'language-not-supported') { rec = null; if (suportaGravacao()) iniciarGravacao(); else { ativo = false; aoEstado('erro'); } }
    };
    rec.onend = () => { if (ativo && rec) setTimeout(() => { if (ativo && rec) { try { rec.start(); } catch { /* já iniciado */ } } }, 250); };
    try { rec.start(); aoEstado('ouvindo'); } catch { aoEstado('erro'); }
  }

  async function iniciarGravacao() {
    modo = 'gravacao';
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!ativo) { stream.getTracks().forEach((t) => t.stop()); return; }
      gravacao = { stream, rec: null, timer: null };
      const ciclo = () => {
        if (!ativo || !gravacao) return;
        const mr = new MediaRecorder(stream); const partes = []; gravacao.rec = mr;
        mr.ondataavailable = (e) => { if (e.data?.size) partes.push(e.data); };
        mr.onstop = async () => {
          if (partes.length) { const blob = new Blob(partes, { type: mr.mimeType || 'audio/webm' }); const b64 = await blobParaBase64(blob).catch(() => ''); const mime = (blob.type || 'audio/webm').split(';')[0]; if (b64) mandar(() => enviarAudio(mime, b64)); }
          if (ativo) ciclo();
        };
        mr.start(); gravacao.timer = setTimeout(() => { try { mr.stop(); } catch { /* parado */ } }, trechoMs);
      };
      ciclo(); aoEstado('ouvindo');
    } catch (e) { ativo = false; aoEstado(e?.name === 'NotAllowedError' ? 'negado' : 'erro'); }
  }

  function parar(avisar = true) {
    ativo = false;
    const r = rec; rec = null; if (r) { try { r.onend = null; r.stop(); } catch { /* já parado */ } }
    if (gravacao) { clearTimeout(gravacao.timer); try { gravacao.rec?.state === 'recording' && gravacao.rec.stop(); } catch { /* parado */ } gravacao.stream.getTracks().forEach((t) => t.stop()); gravacao = null; }
    if (avisar) aoEstado('parada');
    return fila;
  }

  return {
    get modo() { return modo; },
    iniciar() {
      if (ativo) return; ativo = true; t0 = agora();
      if (suportaReconhecimento()) iniciarReconhecimento(); else if (suportaGravacao()) iniciarGravacao(); else { ativo = false; aoEstado('erro'); }
    },
    parar,
  };
}
