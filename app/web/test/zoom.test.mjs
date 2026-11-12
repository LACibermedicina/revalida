import test from 'node:test';
import assert from 'node:assert/strict';
import { escalaAuto, PASSOS } from '../src/zoom.js';
test('zoom automático: só encolhe janelas de desktop estreitas, nunca abaixo de 65%', () => {
  assert.equal(escalaAuto(1280), 1); assert.equal(escalaAuto(380), 1, 'celular usa o layout próprio'); assert.equal(escalaAuto(1100), 1);
  assert.equal(escalaAuto(880), 0.8); assert.equal(escalaAuto(700), 0.65); assert.equal(escalaAuto(699), 1);
  assert.ok(PASSOS.includes(100) && PASSOS[0] === 60 && PASSOS.at(-1) === 130);
});
