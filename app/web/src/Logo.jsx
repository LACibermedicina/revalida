// Marca no estilo "voxel cartoon": letras feitas de cubinhos com volume (juta como o Epi; ".M3D" em verde-água),
// e o ícone é a cabeça do Epi em voxel (cubo de juta, costura verde, olho de lente, antena). Tudo anima de leve:
// as letras fazem uma "ola" de tempos em tempos, o ponto pula, o Epi pisca e a antena brilha. Sem imagens externas.
import React, { useId } from 'react';

// fonte de 5 linhas (1 = cubinho)
const G = {
  R: ['1110', '1001', '1110', '1010', '1001'], E: ['1111', '1000', '1110', '1000', '1111'], V: ['10001', '10001', '01010', '01010', '00100'],
  A: ['0110', '1001', '1111', '1001', '1001'], L: ['1000', '1000', '1000', '1000', '1111'], I: ['111', '010', '010', '010', '111'],
  D: ['1110', '1001', '1001', '1001', '1110'], '.': ['0', '0', '0', '0', '1'], M: ['10001', '11011', '10101', '10001', '10001'],
  3: ['1110', '0001', '0110', '0001', '1110'],
};
const T = 6;          // lado do cubinho
const P = 2.2;        // profundidade (deslocamento da face lateral)
const TXT = 'REVALIDA.M3D';

const CORES = {
  juta: { topo: '#E3BC86', frente: `url(#JUTA)`, lado: '#8A5A2B' },
  agua: { topo: '#9BF3E4', frente: 'url(#AGUA)', lado: '#0B7F73' },
  ponto: { topo: '#FFB3B0', frente: 'url(#PONTO)', lado: '#C2413F' },
};

function letras() {
  let x = 0; const out = [];
  [...TXT].forEach((ch, i) => {
    const g = G[ch]; const w = g[0].length;
    const tipo = ch === '.' ? 'ponto' : i > 8 ? 'agua' : 'juta';
    const cel = [];
    g.forEach((linha, r) => [...linha].forEach((v, c) => { if (v === '1') cel.push([c, r]); }));
    out.push({ ch, x, cel, tipo, i });
    x += (w + 1) * T + (ch === '.' ? -T * .4 : 0);
  });
  return { out, larg: x - T };
}
const { out: LETRAS, larg: LARG } = letras();

/** Nome da marca em voxel, animado. O tamanho vem do CSS (.wordmark: altura = 1em). */
export function Wordmark() {
  const u = useId().replace(/:/g, '');
  const id = (n) => `${u}${n}`;
  const W = LARG + P + 2, H = 5 * T + P + 4;
  return (
    <span className="wordmark vx" role="img" aria-label="REVALIDA.M3D">
      <svg viewBox={`-1 ${-P - 1} ${W} ${H}`} height="1em" aria-hidden="true" focusable="false">
        <defs>
          <pattern id={id('tr')} width="3" height="3" patternUnits="userSpaceOnUse"><rect width="3" height="3" fill="#C9965A" /><path d="M0 0l3 3M3 0L0 3" stroke="#A97640" strokeWidth=".55" opacity=".7" /></pattern>
          <linearGradient id={id('JUTA')} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#D9AA6E" /><stop offset="1" stopColor="#B07A42" /></linearGradient>
          <linearGradient id={id('AGUA')} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#4FE0C8" /><stop offset="1" stopColor="#14A897" /></linearGradient>
          <linearGradient id={id('PONTO')} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#FF7A75" /><stop offset="1" stopColor="#E0504C" /></linearGradient>
        </defs>
        {LETRAS.map((l) => {
          const c = CORES[l.tipo];
          const frente = c.frente.replace('url(#', `url(#${u}`);
          return (
            <g key={l.i} className={`vx-l vx-${l.tipo}`} style={{ '--i': l.i }} transform={`translate(${l.x} 0)`}>
              <g className="vx-salto">
                {l.cel.map(([cx, cy]) => <path key={`l${cx}-${cy}`} d={`M${cx * T + T} ${cy * T}l${P} ${-P}v${T}l${-P} ${P}z`} fill={c.lado} />)}
                {l.cel.map(([cx, cy]) => <path key={`t${cx}-${cy}`} d={`M${cx * T} ${cy * T}l${P} ${-P}h${T}l${-P} ${P}z`} fill={c.topo} />)}
                {l.cel.map(([cx, cy]) => <rect key={`f${cx}-${cy}`} x={cx * T} y={cy * T} width={T} height={T} rx=".9" fill={frente} stroke="rgba(40,25,10,.35)" strokeWidth=".45" />)}
                {l.tipo === 'juta' && l.cel.map(([cx, cy]) => <rect key={`p${cx}-${cy}`} x={cx * T + .6} y={cy * T + .6} width={T - 1.2} height={T - 1.2} rx=".6" fill={`url(#${id("tr")})`} opacity=".3" />)}
                {l.cel.map(([cx, cy]) => <rect key={`b${cx}-${cy}`} x={cx * T + 1} y={cy * T + .9} width={T * .45} height=".9" rx=".45" fill="#fff" opacity=".55" />)}
              </g>
            </g>
          );
        })}
        {/* costura verde-água atravessando o "REVALIDA", como o zíper do Epi */}
        <path className="vx-costura" d={`M2 ${2.5 * T}H${LETRAS[8].x - T * .6}`} stroke="#22C7B0" strokeWidth=".9" strokeDasharray="1.6 1.4" opacity=".85" />
      </svg>
    </span>
  );
}

/** Ícone da marca: cabeça do Epi em voxel (juta, costura, olho de lente, botão, antena com luz). */
export default function Logo({ tamanho = 30 }) {
  const u = useId().replace(/:/g, '');
  return (
    <svg className="logo vx-logo" width={tamanho} height={tamanho} viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      <defs>
        <pattern id={`${u}tr`} width="3.4" height="3.4" patternUnits="userSpaceOnUse"><rect width="3.4" height="3.4" fill="#C9965A" /><path d="M0 0l3.4 3.4M3.4 0L0 3.4" stroke="#9E6C37" strokeWidth=".6" opacity=".75" /></pattern>
        <linearGradient id={`${u}f`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#fff" stopOpacity=".28" /><stop offset="1" stopColor="#000" stopOpacity=".12" /></linearGradient>
        <radialGradient id={`${u}luz`}><stop offset="0" stopColor="#7FFFE6" /><stop offset="1" stopColor="#7FFFE6" stopOpacity="0" /></radialGradient>
      </defs>
      <ellipse cx="31" cy="60" rx="17" ry="2.6" fill="#1C2B4A" opacity=".18" />
      <g className="vx-cabeca">
        {/* antena */}
        <g className="vx-antena"><path d="M33 17V7" stroke="#2B6F66" strokeWidth="2.2" strokeLinecap="round" /><circle className="vx-antena-luz" cx="33" cy="6" r="6" fill={`url(#${u}luz)`} /><circle cx="33" cy="6" r="2.6" fill="#22C7B0" stroke="#0B5F57" strokeWidth=".8" /></g>
        {/* cubo: lado, topo e frente */}
        <path d="M50 21l6-5v32l-6 5z" fill="#8A5A2B" />
        <path d="M10 21l6-5h40l-6 5z" fill="#E3BC86" />
        <rect x="10" y="21" width="40" height="37" rx="3" fill={`url(#${u}tr)`} stroke="#5A3A1A" strokeWidth="1.2" />
        <rect x="10" y="21" width="40" height="37" rx="3" fill={`url(#${u}f)`} />
        {/* costura verde-água */}
        <path d="M30 21v37" stroke="#22C7B0" strokeWidth="1.6" strokeDasharray="2.4 2" />
        <path d="M27.5 24h5M27.5 30h5M27.5 36h5M27.5 42h5M27.5 48h5M27.5 54h5" stroke="#0E8F86" strokeWidth="1.2" strokeLinecap="round" />
        {/* olho de lente (esquerda) e olho-botão (direita) */}
        <g className="vx-olho"><circle cx="19.5" cy="37" r="6.6" fill="#0E8F86" stroke="#0A4F48" strokeWidth="1.2" /><circle cx="19.5" cy="37" r="4" fill="#0A3A3F" /><circle cx="18" cy="35.4" r="1.5" fill="#BFFFF3" /></g>
        <g className="vx-olho"><circle cx="41" cy="37" r="5" fill="#17A596" stroke="#0A4F48" strokeWidth="1.1" /><circle cx="39.6" cy="35.8" r=".9" fill="#0A4F48" /><circle cx="42.4" cy="35.8" r=".9" fill="#0A4F48" /><circle cx="39.6" cy="38.4" r=".9" fill="#0A4F48" /><circle cx="42.4" cy="38.4" r=".9" fill="#0A4F48" /></g>
        <path d="M14 23.5h12" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" opacity=".5" />
      </g>
    </svg>
  );
}
