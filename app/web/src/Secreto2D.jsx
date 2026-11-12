import React from 'react';

/** Secreto-Bot de jaleco em 2D, recortado da foto (sem fundo), em duas camadas (corpo e balão) animadas.
 *  Animado e NÃO interativo: flutua, respira, dá um pulinho de vez em quando, o balão balança, o monitor do peito
 *  mostra um ECG e solta corações; brilhos piscam ao redor. Nenhum toque, clique ou arraste muda nada.
 *  `pose`: sit (sentado), stand (em pé, aproximação), wave (acena). Funciona em qualquer navegador (sem WebGL). */
export default function Secreto2D({ pose = 'sit', titulo = 'Secreto-Bot, o mascote de jaleco' }) {
  return (
    <div className={`s2d pose-${pose}`} role="img" aria-label={titulo}>
      <i className="s2d-sombra" aria-hidden="true" />
      <div className="s2d-quadro" aria-hidden="true">
        <div className="s2d-flutua">
          <div className="s2d-corpo-g"><div className="s2d-pulo">
            <img className="s2d-img" src="/marca/bot-corpo.webp" alt="" draggable="false" />
            <svg className="s2d-ecg" viewBox="0 0 100 56" preserveAspectRatio="none">
              <rect width="100" height="56" rx="6" fill="#06241d" />
              <g stroke="#2e8f6a" strokeWidth=".6" opacity=".35"><path d="M0 14h100M0 28h100M0 42h100M20 0v56M40 0v56M60 0v56M80 0v56" /></g>
              <path className="s2d-linha" d="M-100 28h30l6-6 6 6h14l4 4 6-26 8 40 6-18h30l6-6 6 6h14l4 4 6-26 8 40 6-18h30" fill="none" stroke="#5dff9c" strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" />
            </svg>
            <span className="s2d-coracoes">{[0, 1, 2].map((i) => <i key={i} style={{ '--i': i }}>♥</i>)}</span>
          </div></div>
          <div className="s2d-balao-g">
            <img className="s2d-img" src="/marca/bot-balao.webp" alt="" draggable="false" />
          </div>
        </div>
        <span className="s2d-brilhos">{[0, 1, 2, 3].map((i) => <i key={i} style={{ '--i': i }} />)}</span>
      </div>
    </div>
  );
}
