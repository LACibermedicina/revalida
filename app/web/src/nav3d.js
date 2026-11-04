// Navegação do mapa 3D como em um mapa online: arrastar move (pan), roda/pinça aproxima no ponto apontado,
// botão direito (ou Ctrl/Shift + arrastar) e dois dedos girando/inclinando orbitam, duplo clique aproxima, setas e +/− no teclado.
export const ZOOM_MIN = 0.4; export const ZOOM_MAX = 6;
const lim = (v, a, b) => Math.max(a, Math.min(b, v));

/** Estado inicial de navegação (rotY/rotX/zoom/pan). */
export const estadoInicial = (extra = {}) => ({ rotY: 0.6, rotX: 0.35, zoom: 1, panX: 0, panY: 0, w: 600, h: 420, ...extra });

/** Mantém o mapa à vista: o centro nunca sai mais do que ~1,2 tela do meio. */
export function limitarPan(s) {
  const mx = s.w * 1.2 * Math.max(1, s.zoom * 0.6); const my = s.h * 1.2 * Math.max(1, s.zoom * 0.6);
  s.panX = lim(s.panX, -mx, mx); s.panY = lim(s.panY, -my, my);
}

/** Aproxima/afasta mantendo parado o ponto (px, py) sob o cursor. */
export function zoomEm(s, px, py, fator) {
  const novo = lim(s.zoom * fator, ZOOM_MIN, ZOOM_MAX); const r = novo / s.zoom;
  const cx = px - s.w / 2; const cy = py - s.h / 2;
  s.panX = cx - (cx - s.panX) * r; s.panY = cy - (cy - s.panY) * r; s.zoom = novo; limitarPan(s);
}

export function arrastar(s, dx, dy, modo) {
  if (modo === 'orbita') { s.rotY += dx * 0.008; s.rotX = lim(s.rotX + dy * 0.008, -1.3, 1.3); } else { s.panX += dx; s.panY += dy; limitarPan(s); }
}

/** Dois dedos: devolve fator de zoom, giro (rad) e deslocamento do ponto médio entre dois instantes. */
export function gestoDois(a0, b0, a1, b1) {
  const d0 = Math.hypot(b0.x - a0.x, b0.y - a0.y) || 1; const d1 = Math.hypot(b1.x - a1.x, b1.y - a1.y) || 1;
  let giro = Math.atan2(b1.y - a1.y, b1.x - a1.x) - Math.atan2(b0.y - a0.y, b0.x - a0.x);
  if (giro > Math.PI) giro -= 2 * Math.PI; if (giro < -Math.PI) giro += 2 * Math.PI;
  return { fator: d1 / d0, giro, mx: (a1.x + b1.x) / 2, my: (a1.y + b1.y) / 2, dx: (a1.x + b1.x) / 2 - (a0.x + b0.x) / 2, dy: (a1.y + b1.y) / 2 - (a0.y + b0.y) / 2 };
}

export function resetar(s) { Object.assign(s, { rotY: 0.6, rotX: 0.35, zoom: 1, panX: 0, panY: 0 }); }

/**
 * Entradas do canvas. `est` é o estado (ver estadoInicial + arrasto/auto/proj); `aoToque(x, y, e)` recebe o clique sem arrasto;
 * `aoPassar(x, y)` recebe o ponteiro parado (hover). Devolve os handlers prontos para o JSX.
 */
export function criarEntrada({ canvas, est, aoToque = () => {}, aoPassar = () => {} }) {
  const ptrs = new Map();
  const ponto = (e) => { const r = canvas().getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  const baixar = (e) => {
    canvas().setPointerCapture?.(e.pointerId); const [x, y] = ponto(e); ptrs.set(e.pointerId, { x, y });
    const orbita = e.button === 2 || e.ctrlKey || e.shiftKey || e.button === 1;
    est.arrasto = { moveu: false, modo: orbita ? 'orbita' : 'pan', x: e.clientX, y: e.clientY, multi: ptrs.size > 1 };
    if (ptrs.size > 1) est.arrasto.multi = true;
  };
  const mover = (e) => {
    const [x, y] = ponto(e);
    if (!est.arrasto) { aoPassar(x, y); return; }
    if (ptrs.size >= 2 && ptrs.has(e.pointerId)) {
      const ids = [...ptrs.keys()]; const a0 = ptrs.get(ids[0]); const b0 = ptrs.get(ids[1]);
      ptrs.set(e.pointerId, { x, y });
      const a1 = ptrs.get(ids[0]); const b1 = ptrs.get(ids[1]);
      const g = gestoDois(a0, b0, a1, b1);
      zoomEm(est, g.mx, g.my, g.fator); est.rotY += g.giro; est.panX += g.dx; est.panY += g.dy; limitarPan(est); est.arrasto.moveu = true; return;
    }
    if (ptrs.has(e.pointerId)) ptrs.set(e.pointerId, { x, y });
    const dx = e.clientX - est.arrasto.x; const dy = e.clientY - est.arrasto.y;
    if (Math.abs(dx) + Math.abs(dy) > 3) est.arrasto.moveu = true;
    if (!est.arrasto.multi) arrastar(est, dx, dy, est.arrasto.modo);
    est.arrasto.x = e.clientX; est.arrasto.y = e.clientY;
  };
  const soltar = (e) => {
    const a = est.arrasto; ptrs.delete(e.pointerId);
    if (ptrs.size > 0) return;                       // ainda há um dedo: o gesto continua até soltar todos
    est.arrasto = null;
    if (a && !a.moveu && !a.multi) { const [x, y] = ponto(e); aoToque(x, y, e); }
  };
  const cancelar = (e) => { ptrs.delete(e.pointerId); if (!ptrs.size) est.arrasto = null; };
  const roda = (e) => { e.preventDefault?.(); const [x, y] = ponto(e); zoomEm(est, x, y, Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0018))); };
  const duplo = (e) => { const [x, y] = ponto(e); zoomEm(est, x, y, e.shiftKey ? 1 / 1.6 : 1.6); };
  const tecla = (e) => {
    const passo = 40; let ok = true;
    switch (e.key) {
      case 'ArrowLeft': est.panX += passo; break; case 'ArrowRight': est.panX -= passo; break;
      case 'ArrowUp': est.panY += passo; break; case 'ArrowDown': est.panY -= passo; break;
      case '+': case '=': zoomEm(est, est.w / 2, est.h / 2, 1.25); break; case '-': case '_': zoomEm(est, est.w / 2, est.h / 2, 0.8); break;
      case 'q': case 'Q': est.rotY -= 0.15; break; case 'e': case 'E': est.rotY += 0.15; break;
      case 'w': case 'W': est.rotX = lim(est.rotX - 0.1, -1.3, 1.3); break; case 's': case 'S': est.rotX = lim(est.rotX + 0.1, -1.3, 1.3); break;
      case '0': resetar(est); break;
      default: ok = false;
    }
    if (ok) { e.preventDefault(); limitarPan(est); }
  };
  return { baixar, mover, soltar, cancelar, roda, duplo, tecla, menu: (e) => e.preventDefault() };
}
