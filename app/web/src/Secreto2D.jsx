import React from 'react';

const IMG = { sit: '/marca/epi-sentado.webp', stand: '/marca/epi-em-pe.webp', wave: '/marca/epi-acenando.webp' };

/** Epi (mascote da M3D) em 2D: imagem renderizada do próprio modelo 3D, sem fundo. Reserva para quando o 3D não carrega
 *  (sem WebGL) e enquanto ele carrega. Animado e não interativo: flutua, respira, dá um pulinho de vez em quando e brilha.
 *  `pose`: sit (sentado), stand (em pé), wave (acenando). */
export default function Secreto2D({ pose = 'sit', titulo = 'Epi, o mascote da M3D' }) {
  return (
    <div className={`s2d pose-${pose}`} role="img" aria-label={titulo}>
      <i className="s2d-sombra" aria-hidden="true" />
      <div className="s2d-quadro" aria-hidden="true">
        <div className="s2d-flutua">
          <div className="s2d-corpo-g"><div className="s2d-pulo">
            <img className="s2d-img" src={IMG[pose] || IMG.sit} alt="" draggable="false" />
          </div></div>
        </div>
        <span className="s2d-brilhos">{[0, 1, 2, 3].map((i) => <i key={i} style={{ '--i': i }} />)}</span>
      </div>
    </div>
  );
}
