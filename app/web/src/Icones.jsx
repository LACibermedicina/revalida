// Ícones do menu: SVG com gradiente e animação própria (ao passar o mouse e quando a tela está ativa). Sem biblioteca externa.
import React from 'react';

// Estilo "lowpoly": gema de facetas triangulares em tons claros (uma cor por ícone) com o desenho em traço branco grosso, como brinquedo 3D.
const MATIZ = { notas: 48, sino: 18, inicio: 200, sala: 165, ciclos: 268, estudo: 36, catalogo: 14, criar: 328, admin: 248, conta: 190, comunidade: 22, desempenho: 140, solo: 300, podcast: 6, sair: 352, menu: 215 };
const PONTOS = [[16, 1.5], [27, 5.5], [30.5, 16], [26.5, 27], [16, 30.5], [5.5, 27], [1.5, 16], [5, 5.5]];
const LUZ = [82, 72, 78, 66, 74, 84, 70, 80];
const Base = ({ nome, children }) => {
  const h = MATIZ[nome] ?? 190; const c = [14.5, 13.5];
  return (
    <svg className={`ic ic-${nome}`} viewBox="0 0 32 32" width="28" height="28" fill="none" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <g className="ic-gema">
        {PONTOS.map((pt, i) => { const q = PONTOS[(i + 1) % PONTOS.length]; return <polygon key={i} className={`ic-f ic-f${i % 4}`} points={`${c} ${pt} ${q}`} fill={`hsl(${h + (i % 2 ? 8 : -6)} 78% ${LUZ[i]}%)`} stroke={`hsl(${h} 70% 90%)`} strokeWidth=".4" />; })}
        <polygon points={PONTOS.map((x) => x.join(',')).join(' ')} fill="none" stroke={`hsl(${h} 55% 52% / .55)`} strokeWidth="1" />
      </g>
      <g className="ic-traco" transform="translate(16 16) scale(.7) translate(-16 -16)">
        <g stroke={`hsl(${h} 60% 30% / .55)`} strokeWidth="4.6" transform="translate(0 1)">{children}</g>
        <g stroke="#fff" strokeWidth="2.6">{children}</g>
      </g>
    </svg>
  );
};

const D = {
  inicio: <><path className="ic-teto" d="M5 15 16 5l11 10" /><path d="M8 13v13h16V13" /><path className="ic-porta" d="M13 26v-7h6v7" /></>,
  sala: <><rect x="4" y="9" width="17" height="14" rx="3" /><path className="ic-lente" d="m21 14 7-4v12l-7-4" /><circle className="ic-rec" cx="9" cy="14" r="1.4" fill="var(--ic-b, #19c2a0)" stroke="none" /></>,
  ciclos: <><g className="ic-gira"><path d="M26 12a10 10 0 0 0-18-3" /><path d="M6 20a10 10 0 0 0 18 3" /><path d="M8 4v5h5" /><path d="M24 28v-5h-5" /></g></>,
  estudo: <><path d="M16 8c-3-2-7-2-11-1v17c4-1 8-1 11 1 3-2 7-2 11-1V7c-4-1-8-1-11 1z" /><path className="ic-folha" d="M16 8v17" /><path className="ic-linha" d="M9 12c2 0 4 .2 5 .8M9 16c2 0 4 .2 5 .8" /></>,
  catalogo: <><rect x="7" y="6" width="18" height="21" rx="3" /><path d="M12 6V4h8v2" /><path className="ic-l1" d="M12 13h8" /><path className="ic-l2" d="M12 18h8" /><path className="ic-l3" d="M12 23h5" /></>,
  criar: <><path className="ic-lapis" d="M5 27l1.5-6L21 6.5a3 3 0 0 1 4.5 4.5L11 25.5z" /><path d="M18 9.5l4.5 4.5" /></>,
  admin: <><path className="ic-escudo" d="M16 4l10 4v7c0 6-4 10-10 13C10 25 6 21 6 15V8z" /><path d="m11.5 16 3.5 3.5 6-7" /></>,
  conta: <><circle className="ic-cab" cx="16" cy="11" r="5" /><path className="ic-omb" d="M6 27c1-5 5-8 10-8s9 3 10 8" /></>,
  comunidade: <><circle cx="11" cy="12" r="4" /><circle cx="22" cy="13" r="3" /><path d="M4 26c.8-4.5 3.5-7 7-7s6.2 2.500 7 7" /><path d="M20 20c3 0 5.500 1.800 6.500 6" /></>,
  desempenho: <><path d="M5 5v22h22" /><rect x="9" y="16" width="4" height="8" rx="1" /><rect x="15" y="11" width="4" height="13" rx="1" /><rect x="21" y="7" width="4" height="17" rx="1" /></>,
  solo: <><circle cx="16" cy="16" r="10" /><path className="ic-brilho" d="M16 9v7l4 3" /><path d="M10 4l2 3M22 4l-2 3" /></>,
  podcast: <><rect x="12" y="4" width="8" height="14" rx="4" /><path className="ic-onda" d="M7 15a9 9 0 0 0 18 0" /><path d="M16 24v4M11 28h10" /></>,
  sair: <><path d="M13 5H8a3 3 0 0 0-3 3v16a3 3 0 0 0 3 3h5" /><path className="ic-seta" d="M20 10l6 6-6 6M26 16H12" /></>,
  notas: <><path d="M8 5h16v16l-6 6H8z" /><path d="M18 27v-6h6" /><path d="M12 11h8M12 16h6" /></>,
  sino: <><path className="ic-sino" d="M8 22c1.5-2 2-4 2-8a6 6 0 0 1 12 0c0 4 .5 6 2 8z" /><path d="M13.5 25.5a3 3 0 0 0 5 0" /></>,
  menu: <><path className="ic-m1" d="M6 10h20" /><path className="ic-m2" d="M6 16h20" /><path className="ic-m3" d="M6 22h20" /></>,
};
export const Icone = ({ nome }) => <Base nome={nome}>{D[nome]}</Base>;
