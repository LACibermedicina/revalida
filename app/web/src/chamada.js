// Chamada de vídeo da sala, fora dos componentes: continua ligada mesmo quando a janela da sala é fechada ou minimizada.
// Nesse caso o vídeo aparece em miniaturas flutuantes (VideoFlutuante.jsx) que podem ser arrastadas pela tela.
// Só termina quando a pessoa sai da sala (chamada.sair) ou do app.
import { useEffect, useState } from 'react';
import { criarSalaVideo } from './video.js';

const vazio = () => ({ salaId: null, nomeSala: '', modo: null, cam: false, mic: false, erro: '', tiles: {}, visao: 'palco' });
let estado = vazio();
let handle = null;
let ligando = null;
let palco = null;                     // elemento da galeria dentro da janela da sala (quando visível, as miniaturas somem)
const ouvintes = new Set();
const mudar = (p) => { estado = { ...estado, ...p }; ouvintes.forEach((f) => f(estado)); };

export const chamada = {
  atual: () => estado,
  handle: () => handle,
  /** Liga (ou reaproveita) a chamada da sala. */
  async ligar({ salaId, token, rotaToken, nomeSala = '' }) {
    if (handle && estado.salaId === salaId) { if (nomeSala) mudar({ nomeSala }); return handle; }
    if (ligando) return ligando;
    if (handle) await chamada.sair();
    mudar({ ...vazio(), salaId, nomeSala });
    ligando = (async () => {
      try {
        const v = await criarSalaVideo({
          sessaoId: salaId, tokenAuth: token, rotaToken,
          aoMudar: (ev) => {
            if (ev.tipo === 'video') mudar({ tiles: { ...estado.tiles, [ev.uid]: { track: ev.track, local: Boolean(ev.local) } } });
            if (ev.tipo === 'saiu-video' || ev.tipo === 'saiu') { const t = { ...estado.tiles }; delete t[ev.uid]; mudar({ tiles: t }); }
          },
          aoErro: (m) => mudar({ erro: m }),
          aoSomBloqueado: () => {}, aoPermissao: () => {},
        });
        handle = v;
        mudar({ modo: v.modo, erro: '', cam: Boolean(v.cameraLigada?.()), mic: Boolean(v.microfoneLigado?.()) });
        return v;
      } catch (e) { mudar({ erro: e.message }); return null; } finally { ligando = null; }
    })();
    return ligando;
  },
  async alternar(que) {
    const v = handle; if (!v) return;
    if (v.modo === 'demo') { mudar({ [que]: !estado[que] }); return; }
    const ligado = que === 'cam' ? await v.alternarCam(!estado.cam) : await v.alternarMic(!estado.mic);
    mudar({ [que]: ligado });
  },
  async religar() {
    const v = handle; if (!v || v.modo === 'demo') return;
    try { await v.sincronizar?.(); } catch { /* relê na próxima ação */ }
    const cam = await v.alternarCam(true); const mic = await v.alternarMic(true);
    mudar({ cam, mic });
  },
  sincronizar: () => handle?.sincronizar?.(),
  async sair() { const v = handle; handle = null; palco = null; mudar(vazio()); try { await v?.sair?.(); } catch { /* já saiu */ } },
  definirPalco(el) { palco = el; },
  palcoVisivel() {
    if (!palco || !palco.isConnected || palco.offsetParent === null) return false;
    const r = palco.getBoundingClientRect();
    if (r.width < 40 || r.height < 40 || r.bottom < 0 || r.top > innerHeight) return false;
    // outra janela por cima, cobrindo o centro da galeria?
    const el = document.elementsFromPoint(r.left + r.width / 2, r.top + Math.min(r.height / 2, 60)).find((x) => !x.closest('.vf-camada'));
    return Boolean(el && palco.contains(el));
  },
  definirVisao(v) { if (estado.visao !== v) mudar({ visao: v }); },
};

export function useChamada() {
  const [e, setE] = useState(estado);
  useEffect(() => { ouvintes.add(setE); setE(estado); return () => ouvintes.delete(setE); }, []);
  return e;
}
