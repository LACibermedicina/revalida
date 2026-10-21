// Ícones do menu: SVG com gradiente e animação própria (ao passar o mouse e quando a tela está ativa). Sem biblioteca externa.
import React from 'react';

const Base = ({ nome, children }) => (
  <svg className={`ic ic-${nome}`} viewBox="0 0 32 32" width="26" height="26" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    <defs><linearGradient id={`g-${nome}`} gradientUnits="userSpaceOnUse" x1="4" y1="4" x2="28" y2="28"><stop offset="0" stopColor="var(--ic-a, #2b7cf0)" /><stop offset="1" stopColor="var(--ic-b, #19c2a0)" /></linearGradient></defs>
    <g stroke={`url(#g-${nome})`}>{children}</g>
  </svg>
);

const D = {
  inicio: <><path className="ic-teto" d="M5 15 16 5l11 10" /><path d="M8 13v13h16V13" /><path className="ic-porta" d="M13 26v-7h6v7" /></>,
  sala: <><rect x="4" y="9" width="17" height="14" rx="3" /><path className="ic-lente" d="m21 14 7-4v12l-7-4" /><circle className="ic-rec" cx="9" cy="14" r="1.4" fill="var(--ic-b, #19c2a0)" stroke="none" /></>,
  ciclos: <><g className="ic-gira"><path d="M26 12a10 10 0 0 0-18-3" /><path d="M6 20a10 10 0 0 0 18 3" /><path d="M8 4v5h5" /><path d="M24 28v-5h-5" /></g></>,
  estudo: <><path d="M16 8c-3-2-7-2-11-1v17c4-1 8-1 11 1 3-2 7-2 11-1V7c-4-1-8-1-11 1z" /><path className="ic-folha" d="M16 8v17" /><path className="ic-linha" d="M9 12c2 0 4 .2 5 .8M9 16c2 0 4 .2 5 .8" /></>,
  catalogo: <><rect x="7" y="6" width="18" height="21" rx="3" /><path d="M12 6V4h8v2" /><path className="ic-l1" d="M12 13h8" /><path className="ic-l2" d="M12 18h8" /><path className="ic-l3" d="M12 23h5" /></>,
  criar: <><path className="ic-lapis" d="M5 27l1.5-6L21 6.5a3 3 0 0 1 4.5 4.5L11 25.5z" /><path d="M18 9.5l4.5 4.5" /></>,
  admin: <><path className="ic-escudo" d="M16 4l10 4v7c0 6-4 10-10 13C10 25 6 21 6 15V8z" /><path d="m11.5 16 3.5 3.5 6-7" /></>,
  conta: <><circle className="ic-cab" cx="16" cy="11" r="5" /><path className="ic-omb" d="M6 27c1-5 5-8 10-8s9 3 10 8" /></>,
  sair: <><path d="M13 5H8a3 3 0 0 0-3 3v16a3 3 0 0 0 3 3h5" /><path className="ic-seta" d="M20 10l6 6-6 6M26 16H12" /></>,
  menu: <><path className="ic-m1" d="M6 10h20" /><path className="ic-m2" d="M6 16h20" /><path className="ic-m3" d="M6 22h20" /></>,
};
export const Icone = ({ nome }) => <Base nome={nome}>{D[nome]}</Base>;
