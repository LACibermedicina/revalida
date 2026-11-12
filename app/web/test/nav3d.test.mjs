import test from 'node:test';
import assert from 'node:assert/strict';
import { estadoInicial, zoomEm, arrastar, gestoDois, limitarPan, resetar, ZOOM_MAX, ZOOM_MIN } from '../src/nav3d.js';
import { projetar } from '../src/grafo3d.js';

const pos = { a: [0.3, -0.2, 0.1], b: [-0.5, 0.4, 0.3] };
const proj = (s) => projetar(pos, { rotY: s.rotY, rotX: s.rotX, zoom: s.zoom, largura: s.w, altura: s.h, panX: s.panX, panY: s.panY });

test('zoom no cursor: o ponto de mapa sob o cursor continua no mesmo lugar (como em um mapa online)', () => {
  const s = estadoInicial(); s.panX = 30; s.panY = -20;
  const antes = proj(s).a; const px = antes.x; const py = antes.y;
  zoomEm(s, px, py, 1.5);
  const depois = proj(s).a;
  assert.ok(Math.abs(depois.x - px) < 1.5 && Math.abs(depois.y - py) < 1.5, `ponto fixo: ${depois.x - px}, ${depois.y - py}`);
  assert.ok(s.zoom > 1.4);
});

test('limites de zoom e de pan; reset volta ao início', () => {
  const s = estadoInicial(); zoomEm(s, 300, 200, 100); assert.equal(s.zoom, ZOOM_MAX); zoomEm(s, 300, 200, 0.0001); assert.equal(s.zoom, ZOOM_MIN);
  arrastar(s, 99999, -99999, 'pan'); assert.ok(Math.abs(s.panX) <= s.w * 2 && Math.abs(s.panY) <= s.h * 2);
  arrastar(s, 0, 99999, 'orbita'); assert.ok(s.rotX <= 1.3);
  resetar(s); assert.deepEqual([s.zoom, s.panX, s.panY], [1, 0, 0]);
});

test('arrastar move o mapa (pan) e o botão de órbita gira; a projeção desloca junto', () => {
  const s = estadoInicial(); const p0 = proj(s).a; arrastar(s, 25, 10, 'pan'); const p1 = proj(s).a;
  assert.ok(Math.abs(p1.x - p0.x - 25) < 0.01 && Math.abs(p1.y - p0.y - 10) < 0.01);
  const r0 = s.rotY; arrastar(s, 10, 0, 'orbita'); assert.ok(s.rotY > r0);
});

test('gesto de dois dedos: afastar aproxima, girar orbita, mover desloca', () => {
  const g = gestoDois({ x: 100, y: 100 }, { x: 200, y: 100 }, { x: 80, y: 100 }, { x: 220, y: 100 });
  assert.ok(g.fator > 1.3 && Math.abs(g.giro) < 1e-9 && g.dx === 0);
  const h = gestoDois({ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 100 });
  assert.ok(Math.abs(h.giro - Math.PI / 2) < 1e-9 && Math.abs(h.fator - 1) < 1e-9);
  const m = gestoDois({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 30, y: 20 }, { x: 40, y: 20 }); assert.deepEqual([m.dx, m.dy], [30, 20]);
});
