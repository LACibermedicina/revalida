import React, { useEffect, useRef, useState } from 'react';
import Secreto2D from './Secreto2D.jsx';

/** Epi, o mascote da M3D (o mesmo de m3d.pro), em 3D: só o personagem (sem fundo, cenário ou botões), em /epi-3d.html — sem dependências,
 *  abre offline. A cabeça e o corpo seguem o mouse (a página repassa a posição ao iframe) e ele faz movimentos aleatórios.
 *  Não recebe cliques (pointer-events: none): nada atrapalha a tela. Enquanto o 3D carrega, ou se o navegador não tiver WebGL,
 *  aparece a versão 2D animada. `pose`: sit | stand | wave. `fluido`: ocupa 100% do pai; senão usa `tamanho` (largura). */
export default function Mascote3D({ pose = 'sit', tamanho = 220, fluido = false, titulo = 'Epi, o mascote da M3D', className = '' }) {
  const ref = useRef(null);
  const [pronto, setPronto] = useState(false);
  const sem3d = typeof window !== 'undefined' && window.__SIMULACAO__ === true;   // arquivo autônomo (file://): só a versão 2D
  const destino = typeof window !== 'undefined' && window.location.origin !== 'null' ? window.location.origin : '*';   // página aberta do disco: origem "null"

  useEffect(() => {
    if (sem3d) return undefined;
    const ouvir = (e) => {
      if (e.origin !== window.location.origin || !ref.current || e.source !== ref.current.contentWindow || !e.data) return;
      if (e.data.rv3d === 'ok') setPronto(true);
      else if (e.data.rv3d === 'sem') setPronto(false);
    };
    let quadro = 0;
    const mover = (e) => {
      if (quadro) return;
      quadro = requestAnimationFrame(() => {
        quadro = 0;
        const f = ref.current; if (!f || !f.contentWindow) return;
        const r = f.getBoundingClientRect();
        f.contentWindow.postMessage({ rv3dMouse: [e.clientX - r.left, e.clientY - r.top, Math.max(window.innerWidth, window.innerHeight) / 2] }, destino);
      });
    };
    window.addEventListener('message', ouvir);
    window.addEventListener('pointermove', mover, { passive: true });
    return () => { window.removeEventListener('message', ouvir); window.removeEventListener('pointermove', mover); if (quadro) cancelAnimationFrame(quadro); };
  }, [sem3d, destino]);

  useEffect(() => {
    if (pronto && ref.current?.contentWindow) ref.current.contentWindow.postMessage({ rv3dPose: pose }, destino);
  }, [pose, pronto, destino]);

  const estilo = fluido ? { width: '100%', height: '100%' } : { width: tamanho, height: Math.round(tamanho * 1.05) };
  return (
    <div className={`mascote3d ${fluido ? 'fluido ' : ''}${pronto ? 'tem3d ' : ''}${className}`} style={estilo}>
      {!pronto && <Secreto2D pose={pose} titulo={titulo} />}
      {!sem3d && (
        <iframe ref={ref} title={titulo} src={`/epi-3d.html?pose=${encodeURIComponent(pose)}`} tabIndex={-1} aria-hidden={!pronto}
          style={{ opacity: pronto ? 1 : 0, pointerEvents: 'none' }} />
      )}
    </div>
  );
}
