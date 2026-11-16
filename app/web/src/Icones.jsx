// Ícones ilustrados no estilo "animação 3D" (Pixar-like): objetos fofos, arredondados, com volume (gradiente de luz em cima
// e sombra embaixo), brilho especular e sombra de contato. Cada recurso tem o SEU desenho — nenhum se repete.
// Animam ao passar o mouse / focar (e em loop suave quando a tela está ativa). Tudo em SVG, sem biblioteca. Ver icones.css.
import React, { useId } from 'react';

// paleta: [luz, base, sombra]
const COR = {
  azul: ['#8FD0FF', '#3D9BFF', '#1F5FD1'], verde: ['#9FF0B8', '#2FCB78', '#14945A'], roxo: ['#D9C2FF', '#9B6BFF', '#6436D6'],
  laranja: ['#FFD39A', '#FF9B3D', '#E0661A'], rosa: ['#FFC2DA', '#FF6FA8', '#D63C7C'], amarelo: ['#FFF1A6', '#FFD23F', '#E5A100'],
  vermelho: ['#FFB0A8', '#FF5A4E', '#D12F2A'], teal: ['#A6F4E8', '#22C7B0', '#0E8F86'], creme: ['#FFFFFF', '#FFF4E2', '#E8CFA8'],
  cinza: ['#F2F6FB', '#C7D3E3', '#8C9BB3'], marrom: ['#E6B98A', '#B9783F', '#7F4E22'], papel: ['#FFFFFF', '#F7FAFF', '#D5E0EE'],
  escuro: ['#5A6B8C', '#2B3A57', '#151F33'], ouro: ['#FFF3B0', '#FFC93C', '#D98E04'],
};

/** Moldura comum: defs com os gradientes (ids únicos por instância), sombra de contato e o desenho. */
function Base({ nome, children }) {
  const u = useId().replace(/:/g, '');
  const f = (c) => `url(#${u}${c})`;   // preenchimento com volume
  return (
    <svg className={`ic pxi pxi-${nome}`} viewBox="0 0 48 48" width="28" height="28" aria-hidden="true" focusable="false">
      <defs>
        {Object.entries(COR).map(([k, [a, b, c]]) => (
          <linearGradient key={k} id={u + k} x1="0" y1="0" x2=".35" y2="1"><stop offset="0" stopColor={a} /><stop offset=".55" stopColor={b} /><stop offset="1" stopColor={c} /></linearGradient>
        ))}
        <radialGradient id={`${u}brilho`} cx=".3" cy=".25" r=".6"><stop offset="0" stopColor="#fff" stopOpacity=".95" /><stop offset="1" stopColor="#fff" stopOpacity="0" /></radialGradient>
        <radialGradient id={`${u}luz`} cx=".5" cy=".5" r=".5"><stop offset="0" stopColor="#FFF7B0" stopOpacity="1" /><stop offset="1" stopColor="#FFE16B" stopOpacity="0" /></radialGradient>
      </defs>
      <ellipse className="px-sombra" cx="24" cy="44.5" rx="14" ry="2.6" fill="#1C2B4A" opacity=".16" />
      <g className="px-corpo">{children(f, `url(#${u}brilho)`, `url(#${u}luz)`)}</g>
    </svg>
  );
}

// contorno escuro suave (dá o ar de "brinquedo" com borda)
const L = { stroke: 'rgba(28,43,74,.28)', strokeWidth: 1.2, strokeLinejoin: 'round' };
const Olhos = ({ x = 24, y = 24, d = 6, r = 2.2 }) => (
  <g className="px-olhos"><circle cx={x - d / 2} cy={y} r={r} fill="#1C2B4A" /><circle cx={x + d / 2} cy={y} r={r} fill="#1C2B4A" />
    <circle cx={x - d / 2 + .7} cy={y - .8} r={r * .35} fill="#fff" /><circle cx={x + d / 2 + .7} cy={y - .8} r={r * .35} fill="#fff" /></g>
);

const D = {
  // Início: casinha com chaminé soltando fumaça e janela acesa
  inicio: (f, b) => <>
    <rect x="30" y="8" width="5" height="9" rx="1.5" fill={f('vermelho')} {...L} />
    <g className="px-fumaca" fill="#fff" opacity=".9"><circle cx="32.5" cy="5.5" r="2" /><circle cx="35" cy="3" r="1.5" /></g>
    <rect x="10" y="21" width="28" height="20" rx="4" fill={f('creme')} {...L} />
    <path d="M6.5 23.5 24 9l17.5 14.5a2.5 2.5 0 0 1-3.2 3.8L24 15.3 9.7 27.3a2.5 2.5 0 0 1-3.2-3.8z" fill={f('vermelho')} {...L} />
    <rect className="px-porta" x="20" y="29" width="8" height="12" rx="4" fill={f('azul')} {...L} />
    <rect className="px-janela" x="12.5" y="27" width="5.5" height="5.5" rx="1.5" fill={f('amarelo')} {...L} />
    <rect x="30" y="27" width="5.5" height="5.5" rx="1.5" fill={f('amarelo')} {...L} />
    <ellipse cx="17" cy="23" rx="6" ry="2" fill={b} />
  </>,
  // Sala: câmera de vídeo com luz "gravando"
  sala: (f, b) => <>
    <path className="px-aba" d="M32 20l9-5.5v19L32 28z" fill={f('azul')} {...L} />
    <rect x="6" y="14" width="28" height="22" rx="7" fill={f('azul')} {...L} />
    <circle cx="20" cy="25" r="7" fill={f('escuro')} {...L} /><circle cx="20" cy="25" r="3.6" fill="#5FB7FF" /><circle cx="18.4" cy="23.3" r="1.5" fill="#fff" />
    <circle className="px-rec" cx="10.5" cy="18.5" r="2" fill="#FF4E4E" />
    <ellipse cx="15" cy="16.5" rx="7" ry="1.6" fill={b} />
  </>,
  // Ciclos: carrossel — anel de setas girando com 3 "estações" coloridas
  ciclos: (f, b) => <>
    <g className="px-gira">
      <path d="M24 7a17 17 0 0 1 16.4 12.6l3.1-1.2-3.4 8.3-7.6-4.6 3.2-1.3A12 12 0 0 0 24 12z" fill={f('roxo')} {...L} />
      <path d="M24 41A17 17 0 0 1 7.6 28.4l-3.1 1.2 3.4-8.3 7.6 4.6-3.2 1.3A12 12 0 0 0 24 36z" fill={f('roxo')} {...L} />
    </g>
    <circle cx="24" cy="24" r="8.5" fill={f('papel')} {...L} />
    <circle className="px-p1" cx="20.5" cy="22" r="2.2" fill={f('verde')} /><circle className="px-p2" cx="27.5" cy="22" r="2.2" fill={f('laranja')} /><circle className="px-p3" cx="24" cy="27.5" r="2.2" fill={f('azul')} />
  </>,
  // Estações: prancheta com checklist sendo marcado
  catalogo: (f, b) => <>
    <rect x="9" y="7" width="30" height="36" rx="5" fill={f('marrom')} {...L} />
    <rect x="12.5" y="11" width="23" height="29" rx="2.5" fill={f('papel')} {...L} />
    <rect x="17" y="4.5" width="14" height="7" rx="3" fill={f('cinza')} {...L} />
    {[17, 24, 31].map((y, i) => <g key={y} className={`px-chk px-chk${i}`}>
      <circle cx="17.5" cy={y} r="2.6" fill={f(['verde', 'verde', 'cinza'][i])} />
      {i < 2 && <path d={`M16.2 ${y}l1 1.1 2-2.3`} stroke="#fff" strokeWidth="1.3" fill="none" strokeLinecap="round" />}
      <rect x="22" y={y - 1.2} width={i === 2 ? 7 : 10} height="2.4" rx="1.2" fill="#C9D6E8" />
    </g>)}
  </>,
  // Comunidade: dois amiguinhos (bolinhas com carinha) e um balão de conversa
  comunidade: (f, b) => <>
    <g className="px-balao"><path d="M28 4h12a4 4 0 0 1 4 4v6a4 4 0 0 1-4 4h-6l-4 3v-3h-2a4 4 0 0 1-4-4V8a4 4 0 0 1 4-4z" fill={f('papel')} {...L} />
      <circle cx="30" cy="11" r="1.3" fill="#9B6BFF" /><circle cx="34" cy="11" r="1.3" fill="#FF6FA8" /><circle cx="38" cy="11" r="1.3" fill="#22C7B0" /></g>
    <g className="px-amigo2"><path d="M26 42c0-8 3.5-13 9.5-13S45 34 45 42z" fill={f('teal')} {...L} /><circle cx="35.5" cy="25" r="6.5" fill={f('teal')} {...L} /><Olhos x={35.5} y={25} d={5} r={1.5} /></g>
    <g className="px-amigo1"><path d="M3 43c0-9 4.5-14.5 11.5-14.5S26 34 26 43z" fill={f('laranja')} {...L} /><circle cx="14.5" cy="22" r="8" fill={f('laranja')} {...L} /><Olhos x={14.5} y={22} d={6} r={1.8} />
      <path d="M12 26.2q2.5 1.8 5 0" stroke="#1C2B4A" strokeWidth="1.2" fill="none" strokeLinecap="round" /><ellipse cx="11.5" cy="17.5" rx="3" ry="1.5" fill={b} /></g>
  </>,
  // Praticar com IA: robozinho (paciente IA) com antena acesa
  solo: (f, b, luz) => <>
    <circle className="px-antena-luz" cx="24" cy="6" r="6" fill={luz} />
    <path d="M24 8v6" stroke="#8C9BB3" strokeWidth="2" strokeLinecap="round" /><circle className="px-antena" cx="24" cy="6.5" r="2.6" fill={f('rosa')} {...L} />
    <rect x="5" y="22" width="5" height="10" rx="2.5" fill={f('teal')} {...L} /><rect x="38" y="22" width="5" height="10" rx="2.5" fill={f('teal')} {...L} />
    <rect x="8.5" y="13" width="31" height="27" rx="10" fill={f('teal')} {...L} />
    <rect x="13" y="18.5" width="22" height="13" rx="6.5" fill={f('escuro')} />
    <g className="px-olhos-bot"><rect x="17.5" y="22" width="4" height="6" rx="2" fill="#7FFFE6" /><rect x="26.5" y="22" width="4" height="6" rx="2" fill="#7FFFE6" /></g>
    <path d="M20 35.5q4 2.4 8 0" stroke="#0E8F86" strokeWidth="1.6" fill="none" strokeLinecap="round" />
    <ellipse cx="17" cy="16" rx="6" ry="2" fill={b} />
  </>,
  // Podcast e Rádio: microfone retrô com ondas de som
  podcast: (f, b) => <>
    <g className="px-ondas" fill="none" stroke="#FF6FA8" strokeWidth="2.2" strokeLinecap="round"><path d="M9 14a12 12 0 0 0 0 14" /><path d="M39 14a12 12 0 0 1 0 14" /><path className="px-onda2" d="M4.5 10.5a18 18 0 0 0 0 21" /><path className="px-onda2" d="M43.5 10.5a18 18 0 0 1 0 21" /></g>
    <path d="M24 33v6M16 41.5h16" stroke="#8C9BB3" strokeWidth="3" strokeLinecap="round" />
    <path d="M14 22a10 10 0 0 0 20 0" fill="none" stroke="#8C9BB3" strokeWidth="2.4" strokeLinecap="round" />
    <rect x="16" y="4" width="16" height="27" rx="8" fill={f('rosa')} {...L} />
    <path d="M16.5 13h15M16.5 17.5h15M16.5 22h15" stroke="rgba(28,43,74,.25)" strokeWidth="1.2" />
    <ellipse cx="21" cy="8.5" rx="3" ry="2.2" fill={b} />
  </>,
  // Desempenho: troféu dourado com estrela brilhando
  desempenho: (f, b) => <>
    <path d="M13 11H7.5a1.5 1.5 0 0 0-1.5 1.7C6.7 19 10 22.5 15 23M35 11h5.5a1.5 1.5 0 0 1 1.5 1.7C41.3 19 38 22.5 33 23" fill="none" stroke="#E5A100" strokeWidth="2.6" strokeLinecap="round" />
    <path d="M12 7h24v9a12 12 0 0 1-24 0z" fill={f('ouro')} {...L} />
    <rect x="21" y="27" width="6" height="6" fill={f('ouro')} /><rect x="14" y="33" width="20" height="8" rx="3" fill={f('marrom')} {...L} />
    <path className="px-estrela" d="M24 10.5l1.8 3.6 4 .6-2.9 2.8.7 4L24 19.6l-3.6 1.9.7-4-2.9-2.8 4-.6z" fill="#fff" />
    <rect className="px-reflexo" x="14" y="7" width="3.5" height="16" rx="1.75" fill={b} />
  </>,
  // Estudo: pilha de livros com uma maçã em cima
  estudo: (f, b) => <>
    <rect x="7" y="33" width="34" height="8" rx="2.5" fill={f('azul')} {...L} /><rect x="9" y="35" width="30" height="1.6" rx=".8" fill="#fff" opacity=".7" />
    <rect x="10" y="25" width="28" height="8" rx="2.5" fill={f('verde')} {...L} /><rect x="12" y="27" width="24" height="1.6" rx=".8" fill="#fff" opacity=".7" />
    <rect className="px-livro-topo" x="8" y="17.5" width="30" height="7.5" rx="2.5" fill={f('vermelho')} {...L} />
    <g className="px-maca"><circle cx="24" cy="11" r="5.6" fill={f('vermelho')} {...L} /><path d="M24 5.8c.5-2 1.6-3 3.4-3.4" stroke="#7F4E22" strokeWidth="1.4" fill="none" strokeLinecap="round" />
      <path d="M25 5.5c2-.9 4-.5 5 .8-2 .9-3.8.7-5-.8z" fill="#2FCB78" /><ellipse cx="21.8" cy="9" rx="1.6" ry="1.1" fill={b} /></g>
  </>,
  // Análise: lupa sobre um gráfico
  analise: (f, b) => <>
    <rect x="5" y="9" width="28" height="30" rx="4" fill={f('papel')} {...L} />
    <rect x="10" y="27" width="4" height="7" rx="1" fill="#9B6BFF" /><rect x="16" y="22" width="4" height="12" rx="1" fill="#3D9BFF" /><rect x="22" y="17" width="4" height="17" rx="1" fill="#2FCB78" />
    <g className="px-lupa"><path d="M34.5 34.5l7 7" stroke="#9A6233" strokeWidth="5" strokeLinecap="round" />
      <circle cx="30" cy="30" r="8" fill="rgba(170,225,255,.55)" stroke="#8C9BB3" strokeWidth="3" /><ellipse cx="27.5" cy="27" rx="3" ry="1.8" fill={b} /></g>
  </>,
  // Conta: crachá com foto e cordão
  conta: (f, b) => <>
    <path d="M17 3l7 8 7-8" fill="none" stroke="#3D9BFF" strokeWidth="2.6" strokeLinejoin="round" />
    <rect className="px-cracha" x="10" y="10" width="28" height="33" rx="5" fill={f('papel')} {...L} />
    <rect x="19" y="10" width="10" height="4" rx="2" fill={f('cinza')} />
    <circle cx="24" cy="23" r="6.5" fill={f('azul')} {...L} /><circle cx="24" cy="21.5" r="2.6" fill="#FFE2C7" /><path d="M19.6 27.5a4.6 3.6 0 0 1 8.8 0" fill="#FFE2C7" />
    <rect x="15" y="33" width="18" height="2.4" rx="1.2" fill="#C9D6E8" /><rect x="18" y="37.5" width="12" height="2.2" rx="1.1" fill="#E1E9F3" />
  </>,
  // Admin: engrenagem que gira com um escudinho
  admin: (f, b) => <>
    <g className="px-gira"><path d="M21 4h6l1 5 4 1.7 4.2-2.9 4.2 4.2-2.9 4.2L39 20l5 1v6l-5 1-1.7 4 2.9 4.2-4.2 4.2-4.2-2.9L28 39l-1 5h-6l-1-5-4-1.7-4.2 2.9-4.2-4.2 2.9-4.2L9 28l-5-1v-6l5-1 1.7-4-2.9-4.2 4.2-4.2 4.2 2.9L20 9z" fill={f('cinza')} {...L} /></g>
    <path d="M24 15l8 3v6c0 5-3.4 8-8 10-4.6-2-8-5-8-10v-6z" fill={f('azul')} {...L} /><path d="M20.5 24l2.5 2.5 4.5-5" stroke="#fff" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
  </>,
  // Notas rápidas: post-it amarelo com lápis
  notas: (f, b) => <>
    <path d="M8 7h30v24l-9 9H8z" fill={f('amarelo')} {...L} transform="rotate(-4 24 24)" />
    <path d="M29 40v-9h9" fill="#E5A100" opacity=".6" transform="rotate(-4 24 24)" />
    <path d="M13 15h18M13 20.5h14M13 26h10" stroke="#C98F00" strokeWidth="1.8" strokeLinecap="round" transform="rotate(-4 24 24)" />
    <g className="px-lapis"><path d="M30 34 41.5 22.5a2.5 2.5 0 0 1 3.5 3.5L33.5 37.5l-5 1.5z" fill={f('laranja')} {...L} /><path d="M28.5 39l1.5-5 3.5 3.5z" fill="#FFE2C7" /><path d="M41.5 22.5l3.5 3.5" stroke="#FF6FA8" strokeWidth="3" /></g>
  </>,
  // Notificações: sino dourado que balança
  sino: (f, b) => <>
    <g className="px-sino"><circle cx="24" cy="6.5" r="2.6" fill={f('ouro')} {...L} />
      <path d="M11 34c3-3 3.5-6 3.5-12a9.5 9.5 0 0 1 19 0c0 6 .5 9 3.5 12z" fill={f('ouro')} {...L} />
      <rect x="9" y="33" width="30" height="5" rx="2.5" fill={f('ouro')} {...L} />
      <ellipse cx="19.5" cy="17" rx="2.2" ry="4" fill={b} /></g>
    <circle className="px-badalo" cx="24" cy="41" r="3.2" fill={f('laranja')} {...L} />
  </>,
  // Criar: lápis grandão escrevendo
  criar: (f, b) => <>
    <path d="M10 30h20" stroke="#3D9BFF" strokeWidth="2.4" strokeLinecap="round" className="px-risco" />
    <g className="px-lapis"><path d="M9 39l2.6-8.5L33 9a4 4 0 0 1 5.7 5.7L17.3 36.2z" fill={f('amarelo')} {...L} /><path d="M9 39l2.6-8.5 5.7 5.7z" fill="#FFE2C7" /><path d="M9 39l1-3.4 2.4 2.4z" fill="#2B3A57" />
      <path d="M33 9l5.7 5.7" stroke="#FF6FA8" strokeWidth="4" /></g>
  </>,
  // Sair: porta entreaberta com seta
  sair: (f, b) => <>
    <rect x="6" y="5" width="22" height="38" rx="3" fill={f('marrom')} {...L} />
    <path className="px-folha" d="M8 7l14 3v33l-14-2z" fill={f('laranja')} {...L} /><circle cx="18.5" cy="26" r="1.5" fill="#FFD23F" />
    <g className="px-seta"><path d="M28 24h13" stroke="#2FCB78" strokeWidth="4.5" strokeLinecap="round" /><path d="M36 18l6 6-6 6" stroke="#14945A" strokeWidth="4" fill="none" strokeLinecap="round" strokeLinejoin="round" /></g>
  </>,
  // Menu: três barrinhas coloridas
  menu: (f) => <>
    <rect className="px-m1" x="8" y="10" width="32" height="6" rx="3" fill={f('azul')} {...L} />
    <rect className="px-m2" x="8" y="21" width="32" height="6" rx="3" fill={f('verde')} {...L} />
    <rect className="px-m3" x="8" y="32" width="32" height="6" rx="3" fill={f('laranja')} {...L} />
  </>,
  // Modo mesa: monitor com janelinhas
  mesa: (f, b) => <>
    <path d="M20 35h8l2 6H18z" fill={f('cinza')} {...L} /><rect x="13" y="40" width="22" height="3.5" rx="1.75" fill={f('cinza')} {...L} />
    <rect x="4" y="7" width="40" height="28" rx="5" fill={f('escuro')} {...L} /><rect x="7.5" y="10.5" width="33" height="21" rx="2.5" fill="#BFE5FF" />
    <rect className="px-jan1" x="10" y="13" width="15" height="10" rx="2" fill="#fff" /><rect x="10" y="13" width="15" height="2.6" rx="1.3" fill="#FF6FA8" />
    <rect className="px-jan2" x="22" y="18" width="15" height="10.5" rx="2" fill="#fff" /><rect x="22" y="18" width="15" height="2.6" rx="1.3" fill="#2FCB78" />
  </>,
  // Tema para revisão: lâmpada de ideia acesa
  tema: (f, b, luz) => <>
    <circle className="px-aura" cx="24" cy="19" r="17" fill={luz} />
    <path d="M24 5a13 13 0 0 0-8 23.3c1.5 1.2 2.5 3 2.5 5V35h11v-1.7c0-2 1-3.8 2.5-5A13 13 0 0 0 24 5z" fill={f('amarelo')} {...L} />
    <path d="M20 22l2.5 3 1.5-4 1.5 4 2.5-3" stroke="#E0661A" strokeWidth="1.6" fill="none" strokeLinejoin="round" />
    <rect x="18" y="35" width="12" height="4" rx="1.5" fill={f('cinza')} {...L} /><rect x="19.5" y="39" width="9" height="3.5" rx="1.75" fill={f('cinza')} {...L} />
    <ellipse cx="19" cy="12" rx="2.6" ry="4" fill={b} transform="rotate(25 19 12)" />
  </>,
  // Estação favorita: alfinete vermelho espetado
  pino: (f, b) => <>
    <path d="M24 26v16" stroke="#8C9BB3" strokeWidth="2.6" strokeLinecap="round" />
    <path className="px-pino" d="M15 6h18l-3 9 5 6c1 1.2.2 3-1.3 3H14.3c-1.5 0-2.3-1.8-1.3-3l5-6z" fill={f('vermelho')} {...L} />
    <ellipse cx="21" cy="10" rx="2" ry="3" fill={b} />
  </>,
  /* ---- ícones dos GRUPOS (blocos) ---- */
  // Treinar: estetoscópio
  g_treinar: (f) => <>
    <path d="M12 5v11a9 9 0 0 0 18 0V5" fill="none" stroke="#3D9BFF" strokeWidth="4" strokeLinecap="round" />
    <circle cx="12" cy="5" r="2.6" fill={f('cinza')} {...L} /><circle cx="30" cy="5" r="2.6" fill={f('cinza')} {...L} />
    <path d="M21 25v6a8 8 0 0 0 16 0v-5" fill="none" stroke="#3D9BFF" strokeWidth="4" strokeLinecap="round" />
    <g className="px-disco"><circle cx="37" cy="22" r="6.5" fill={f('cinza')} {...L} /><circle cx="37" cy="22" r="3.6" fill={f('teal')} /></g>
  </>,
  // Estudar: capelo de formatura com borla
  g_estudar: (f, b) => <>
    <path d="M13 22v8c0 3 5 6 11 6s11-3 11-6v-8" fill={f('escuro')} {...L} />
    <path d="M2.5 18 24 9l21.5 9L24 27z" fill={f('escuro')} {...L} /><path d="M7 18 24 11l17 7" fill="none" stroke="rgba(255,255,255,.25)" strokeWidth="1.2" />
    <g className="px-borla"><path d="M24 18l12 4v10" stroke="#FFC93C" strokeWidth="1.8" fill="none" /><path d="M34 32h4l1 7h-6z" fill={f('ouro')} {...L} /></g>
    <circle cx="24" cy="18" r="1.8" fill="#FFC93C" />
  </>,
  // Acompanhar: alvo com flecha no centro
  g_acompanhar: (f) => <>
    <circle cx="22" cy="26" r="17" fill={f('vermelho')} {...L} /><circle cx="22" cy="26" r="12" fill={f('papel')} /><circle cx="22" cy="26" r="7.5" fill={f('vermelho')} /><circle cx="22" cy="26" r="3" fill={f('papel')} />
    <g className="px-flecha"><path d="M22 26 40 8" stroke="#9A6233" strokeWidth="2.6" strokeLinecap="round" /><path d="M38 4l2 4 4 2-3 3-3-1-1-3z" fill={f('verde')} {...L} /></g>
  </>,
  // Pessoas: coração com cruz (cuidado)
  g_pessoas: (f, b) => <>
    <path className="px-coracao" d="M24 42S5 30.5 5 17.5A9.5 9.5 0 0 1 24 12a9.5 9.5 0 0 1 19 5.5C43 30.5 24 42 24 42z" fill={f('rosa')} {...L} />
    <path d="M24 18.5v12M18 24.5h12" stroke="#fff" strokeWidth="4.2" strokeLinecap="round" />
    <ellipse cx="13.5" cy="15.5" rx="3.6" ry="2.3" fill={b} transform="rotate(-30 13.5 15.5)" />
  </>,
};

export const NOMES_ICONES = Object.keys(D);
export const Icone = ({ nome }) => <Base nome={nome}>{D[nome] ?? D.inicio}</Base>;
