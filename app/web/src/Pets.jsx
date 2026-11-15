import React, { useEffect, useRef, useState } from 'react';

/** Golden Paws e Spotty Pal: dois cachorrinhos que vivem no rodapé do desktop (Mesa).
 *  Andam, sentam, deitam, rolam, dormem, pulam, acenam e brincam entre si; viram para o mouse e reagem quando ele chega
 *  perto. Ficam atrás das janelas e não recebem cliques. Com "reduzir movimento" ficam quietos (sentados/dormindo). */

// altura de exibição (px, antes da escala da tela) e se a imagem olha para a esquerda (as de andar/pular olham)
const P = {
  golden: {
    sentado: { h: 112 }, olhando: { h: 104 }, 'em-pe': { h: 94, esq: true }, andando: { h: 98, esq: true },
    barriga: { h: 50 }, dormindo: { h: 60 }, feliz: { h: 108 },
  },
  spotty: {
    sentado: { h: 104 }, 'andando-a': { h: 88, esq: true }, 'andando-b': { h: 88, esq: true }, brincar: { h: 84, esq: true },
    'brincar-b': { h: 88, esq: true }, pulo: { h: 90, esq: true }, acenar: { h: 112 }, deitado: { h: 86 }, feliz: { h: 92 }, bandana: { h: 106 },
  },
};
const URL = (cao, pose) => `/marca/pets/${cao}-${pose}.webp`;
const PASSO = { golden: ['em-pe', 'andando'], spotty: ['andando-a', 'andando-b'] };
const VEL = { golden: 46, spotty: 70 };          // px/s
const sorteio = (l) => l[Math.floor(Math.random() * l.length)];
const entre = (a, b) => a + Math.random() * (b - a);

function novoCao(cao, x) {
  return { cao, x, alvo: x, dir: cao === 'golden' ? 1 : -1, pose: 'sentado', ate: 0, andando: false, fase: 0, pulo: 0, puloDur: 0, acao: 'sentar', zzz: false };
}

export default function Pets({ reserva = 320 }) {
  const area = useRef(null);
  const els = useRef({});
  const caes = useRef([novoCao('golden', 60), novoCao('spotty', 220)]);
  const mouse = useRef({ x: -1e4, y: -1e4, t: 0 });
  const [, render] = useState(0);
  const redesenhar = () => render((n) => n + 1);

  useEffect(() => {
    const reduz = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    // pré-carrega as poses (sem piscar na troca)
    for (const cao of Object.keys(P)) for (const pose of Object.keys(P[cao])) { const i = new Image(); i.src = URL(cao, pose); }

    const largura = () => Math.max(260, (area.current?.clientWidth || 800) - reserva);   // não invade o canto do Epi
    const outro = (c) => caes.current.find((d) => d !== c);

    function decidir(c, agora) {
      const W = largura(), o = outro(c);
      if (reduz) { c.acao = c.cao === 'golden' ? 'dormir' : 'sentar'; c.pose = c.cao === 'golden' ? 'dormindo' : 'sentado'; c.zzz = c.cao === 'golden'; c.ate = agora + 1e9; return; }
      const opcoes = c.cao === 'golden'
        ? [['andar', 4], ['sentar', 3], ['olhar', 1], ['barriga', 1.2], ['dormir', 1.2], ['feliz', 1]]
        : [['andar', 4], ['sentar', 2], ['brincar', 2], ['pular', 1.5], ['deitar', 1], ['feliz', 1], ['bandana', 0.8], ['visitar', 1.5]];
      let r = Math.random() * opcoes.reduce((s, [, p]) => s + p, 0); let acao = opcoes[0][0];
      for (const [a, p] of opcoes) { if ((r -= p) <= 0) { acao = a; break; } }
      c.acao = acao; c.zzz = false; c.andando = false;
      if (acao === 'andar' || acao === 'visitar') {
        c.alvo = acao === 'visitar' && o ? Math.max(0, Math.min(W, o.x + (o.x > c.x ? -90 : 90))) : entre(0, W);
        if (Math.abs(c.alvo - c.x) < 40) c.alvo = Math.min(W, c.x + 120);
        c.andando = true; c.dir = c.alvo > c.x ? 1 : -1; c.ate = agora + 30_000;
      } else if (acao === 'sentar') { c.pose = c.cao === 'spotty' && Math.random() < 0.3 ? 'bandana' : 'sentado'; c.ate = agora + entre(3000, 6500); }
      else if (acao === 'olhar') { c.pose = 'olhando'; c.ate = agora + entre(2000, 3500); }
      else if (acao === 'barriga') { c.pose = 'barriga'; c.ate = agora + entre(2500, 4000); }
      else if (acao === 'dormir') { c.pose = 'dormindo'; c.zzz = true; c.ate = agora + entre(8000, 14000); }
      else if (acao === 'feliz') { c.pose = 'feliz'; c.ate = agora + entre(2000, 3500); }
      else if (acao === 'bandana') { c.pose = 'bandana'; c.ate = agora + entre(3000, 5000); }
      else if (acao === 'brincar') { c.pose = Math.random() < 0.5 ? 'brincar' : 'brincar-b'; if (o) c.dir = o.x > c.x ? 1 : -1; c.ate = agora + entre(1800, 3000); }
      else if (acao === 'deitar') { c.pose = 'deitado'; c.ate = agora + entre(3500, 6000); }
      else if (acao === 'pular') { c.pose = 'pulo'; c.pulo = agora; c.puloDur = 700; c.ate = agora + 900; }
      redesenhar();
    }

    // reação ao mouse: perto -> Spotty acena ou pula; Golden acorda e olha
    function reagir(c, agora) {
      if (reduz || agora - mouse.current.t > 2500 || !area.current) return;
      const r = area.current.getBoundingClientRect();
      const cx = r.left + c.x + 50, cy = r.bottom - 60, dx = mouse.current.x - cx, dy = mouse.current.y - cy;
      const perto = Math.hypot(dx, dy) < 140;
      if (!c.andando && !['pular'].includes(c.acao)) {
        const novaDir = dx > 0 ? 1 : -1;
        if (novaDir !== c.dir && Math.abs(dx) > 30) { c.dir = novaDir; redesenhar(); }
      }
      if (perto && agora - (c.ultimaReacao || 0) > 6000) {
        c.ultimaReacao = agora; c.andando = false; c.zzz = false;
        if (c.cao === 'spotty') {
          if (Math.random() < 0.5) { c.acao = 'acenar'; c.pose = 'acenar'; c.ate = agora + 2200; }
          else { c.acao = 'pular'; c.pose = 'pulo'; c.pulo = agora; c.puloDur = 700; c.ate = agora + 900; }
        } else { c.acao = 'olhar'; c.pose = mouse.current.y < cy - 80 ? 'olhando' : 'feliz'; c.ate = agora + 2500; }
        redesenhar();
      }
    }

    let raf = 0, antes = performance.now();
    const quadro = (agora) => {
      raf = requestAnimationFrame(quadro);
      const dt = Math.min(0.05, (agora - antes) / 1000); antes = agora;
      for (const c of caes.current) {
        if (agora > c.ate) decidir(c, agora);
        reagir(c, agora);
        if (c.andando) {
          const passo = VEL[c.cao] * dt * c.dir;
          c.x += passo; c.fase += dt;
          const pose = PASSO[c.cao][Math.floor(c.fase / (c.cao === 'golden' ? 0.22 : 0.16)) % 2];
          if (pose !== c.pose) { c.pose = pose; redesenhar(); }
          if ((c.dir > 0 && c.x >= c.alvo) || (c.dir < 0 && c.x <= c.alvo)) { c.x = c.alvo; c.andando = false; c.ate = agora; }
        }
        c.x = Math.max(0, Math.min(largura(), c.x));
        // movimento contínuo: passo (sobe e desce), pulo (arco), respiração parado
        let y = 0, sx = 1, sy = 1;
        if (c.andando) y = Math.abs(Math.sin(c.fase * (c.cao === 'golden' ? 14 : 19))) * 4;
        else if (c.acao === 'pular' && c.pulo) {
          const p = Math.min(1, (agora - c.pulo) / c.puloDur);
          y = Math.sin(p * Math.PI) * 70; if (p < 0.12 || p > 0.92) { sy = 0.92; sx = 1.06; }
          c.x += (c.dir * 60) * dt;
        } else if (!reduz) { const b = Math.sin(agora / (c.zzz ? 900 : 500)) * (c.zzz ? 0.02 : 0.012); sy = 1 + b; sx = 1 - b / 2; }
        const el = els.current[c.cao];
        if (el) {
          el.style.transform = `translate3d(${c.x.toFixed(1)}px,0,0)`;
          const corpo = el.firstChild, sombra = el.lastChild;
          const vira = (P[c.cao][c.pose]?.esq ? c.dir > 0 : c.dir < 0) ? -1 : 1;   // imagens "esq" olham para a esquerda
          corpo.style.transform = `translateY(${(-y).toFixed(1)}px) scale(${(sx * vira).toFixed(3)},${sy.toFixed(3)})`;
          sombra.style.transform = `translateX(-50%) scale(${(1 - y / 140).toFixed(3)})`;
          sombra.style.opacity = String(Math.max(0.25, 1 - y / 110));
        }
      }
    };
    const mover = (e) => { mouse.current = { x: e.clientX, y: e.clientY, t: performance.now() }; };
    window.addEventListener('pointermove', mover, { passive: true });
    raf = requestAnimationFrame(quadro);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('pointermove', mover); };
  }, []);

  return (
    <div className="pets" ref={area} aria-hidden="true">
      {caes.current.map((c) => {
        const info = P[c.cao][c.pose] || P[c.cao].sentado;
        return (
          <div key={c.cao} className={`pet pet-${c.cao}`} ref={(e) => { els.current[c.cao] = e; }}>
            <div className="pet-corpo">
              <img src={URL(c.cao, c.pose)} alt="" draggable="false" style={{ height: `calc(${info.h}px * var(--pets-escala, 1))` }} />
              {c.zzz && <span className="pet-zzz"><i>z</i><i>z</i><i>z</i></span>}
            </div>
            <i className="pet-sombra" />
          </div>
        );
      })}
    </div>
  );
}
