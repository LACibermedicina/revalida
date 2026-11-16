// Miniaturas de vídeo soltas pela tela (estilo "picture in picture" do Zoom): aparecem quando a chamada da sala está ligada
// mas a janela da sala está fechada, minimizada ou coberta. Cada miniatura pode ser arrastada para qualquer canto
// (a posição fica salva); a barrinha tem câmera, microfone, "voltar para a sala" e "sair da chamada".
import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { chamada, useChamada } from './chamada.js';

const lerPos = () => { try { return JSON.parse(localStorage.getItem('rv_vf_pos')) || {}; } catch { return {}; } };

function Miniatura({ id, track, rotulo, indice, pos, aoMover, children }) {
  const ref = useRef(null); const vid = useRef(null); const a = useRef(null);
  const [p, setP] = useState(null);
  useEffect(() => { if (track && vid.current && track.play) { try { track.play(vid.current); } catch { /* sem vídeo */ } } }, [track]);
  const base = pos ?? { x: innerWidth - 248, y: 84 + indice * 164 };
  const atual = p ?? base;
  return (
    <div ref={ref} className={`vf-mini${p ? ' movendo' : ''}`} style={{ left: Math.min(Math.max(atual.x, 4), innerWidth - 228), top: Math.min(Math.max(atual.y, 4), innerHeight - 140) }}
      onPointerDown={(e) => { if (e.button > 0 || e.target.closest('button')) return; a.current = { px: e.clientX, py: e.clientY, x: atual.x, y: atual.y, mov: false }; e.currentTarget.setPointerCapture(e.pointerId); }}
      onPointerMove={(e) => { const s = a.current; if (!s) return; const dx = e.clientX - s.px, dy = e.clientY - s.py; if (!s.mov && Math.hypot(dx, dy) < 4) return; s.mov = true; setP({ x: s.x + dx, y: s.y + dy }); }}
      onPointerUp={() => { const s = a.current; a.current = null; if (s?.mov && p) aoMover(id, p); setP(null); }}
      onPointerCancel={() => { a.current = null; setP(null); }} data-testid="video-flutuante">
      <div className="vf-video" ref={vid}>{!track && <span className="vf-sem" aria-hidden="true">🎥</span>}</div>
      <span className="vf-nome">{rotulo}</span>
      {children}
    </div>
  );
}

export default function VideoFlutuante({ aoAbrirSala }) {
  const c = useChamada();
  const [pos, setPos] = useState(lerPos);
  const [mostrar, setMostrar] = useState(false);
  // a cada instante: a galeria da sala está à vista? então as miniaturas somem (o vídeo volta para lá)
  useEffect(() => {
    if (!c.salaId) { setMostrar(false); return undefined; }
    const ver = () => { const v = !chamada.palcoVisivel(); setMostrar(v); chamada.definirVisao(v ? 'flutuante' : 'palco'); };
    ver(); const t = setInterval(ver, 700);
    return () => clearInterval(t);
  }, [c.salaId]);
  if (!c.salaId || !mostrar) return null;
  const tiles = Object.entries(c.tiles);
  const lista = tiles.length ? tiles : [['eu', { track: null, local: true }]];
  const mover = (id, p) => { const n = { ...pos, [id]: p }; setPos(n); try { localStorage.setItem('rv_vf_pos', JSON.stringify(n)); } catch { /* ok */ } };
  return createPortal(
    <div className="vf-camada" aria-label="Chamada de vídeo da sala">
      {lista.map(([uid, t], i) => (
        <Miniatura key={`${uid}-${c.visao}`} id={t.local ? 'eu' : uid} track={t.track} rotulo={t.local ? 'Você' : 'Participante'} indice={i} pos={pos[t.local ? 'eu' : uid]} aoMover={mover}>
          {i === 0 && (
            <div className="vf-barra">
              <button type="button" className={`vf-b${c.mic ? '' : ' off'}`} onClick={() => chamada.alternar('mic')} aria-pressed={c.mic} title={c.mic ? 'Silenciar microfone' : 'Ligar microfone'}>{c.mic ? '🎙️' : '🔇'}</button>
              <button type="button" className={`vf-b${c.cam ? '' : ' off'}`} onClick={() => chamada.alternar('cam')} aria-pressed={c.cam} title={c.cam ? 'Desligar câmera' : 'Ligar câmera'}>{c.cam ? '📹' : '🚫'}</button>
              <button type="button" className="vf-b" onClick={aoAbrirSala} title="Voltar para a sala">⤢</button>
              <button type="button" className="vf-b sair" onClick={() => chamada.sair()} title="Sair da chamada (continua na sala)">✕</button>
            </div>
          )}
        </Miniatura>
      ))}
    </div>, document.body);
}
