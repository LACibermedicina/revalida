import test from 'node:test';
import assert from 'node:assert/strict';
import { diagnosticarMidia, problemasDe, midiaDesconectada, mostrarSolucionar } from '../src/midia.js';

const fluxo = (par) => ({ getTracks: () => [{ stop: () => par.push('parou') }] });
const navegador = ({ erros = {}, negadas = [], lista = [{ kind: 'videoinput' }, { kind: 'audioinput' }] } = {}) => {
  const parou = [];
  return { parou, mediaDevices: { enumerateDevices: async () => lista, getUserMedia: async (c) => { const k = Object.keys(c)[0]; if (erros[k]) { const e = new Error('x'); e.name = erros[k]; throw e; } return fluxo(parou); } },
    permissions: { query: async ({ name }) => ({ state: negadas.includes(name) ? 'denied' : 'prompt' }) } };
};

test('tudo liberado: abre e FECHA os dois aparelhos, sem problemas', async () => {
  const n = navegador(); const d = await diagnosticarMidia(n, { seguro: true });
  assert.deepEqual([d.camera, d.microfone], ['ok', 'ok']); assert.deepEqual(d.dispositivos, { camera: 1, microfone: 1 });
  assert.equal(n.parou.length, 2, 'não deixa o aparelho aberto'); assert.deepEqual(problemasDe(d), []);
});
test('cada falha vira um estado e uma instrução', async () => {
  const d = await diagnosticarMidia(navegador({ erros: { video: 'NotAllowedError', audio: 'NotReadableError' } }), { seguro: true });
  assert.deepEqual([d.camera, d.microfone], ['negada', 'em_uso']);
  const p = problemasDe(d); assert.equal(p.length, 2); assert.match(p[0].como, /cadeado/); assert.match(p[1].como, /Feche o outro aplicativo/);
  assert.equal((await diagnosticarMidia(navegador({ erros: { video: 'NotFoundError' } }), { seguro: true })).camera, 'sem_dispositivo');
});
test('permissão já negada nem tenta abrir; sem suporte/sem https é indisponível', async () => {
  const n = navegador({ negadas: ['camera'] }); const d = await diagnosticarMidia(n, { seguro: true });
  assert.equal(d.camera, 'negada'); assert.equal(n.parou.length, 1, 'só sondou o microfone');
  const sem = await diagnosticarMidia({}, { seguro: false });
  assert.deepEqual([sem.camera, sem.microfone, sem.seguro], ['indisponivel', 'indisponivel', false]);
  assert.equal(problemasDe(sem).length, 3);
});
test('quando o botão de solucionar problemas aparece', () => {
  const off = { modo: 'agora', cam: false, mic: true }; const on = { modo: 'agora', cam: true, mic: true };
  assert.equal(midiaDesconectada({ modo: null }), true); assert.equal(midiaDesconectada(off), true);
  assert.equal(midiaDesconectada(on), false); assert.equal(midiaDesconectada({ modo: 'demo', cam: false, mic: false }), false);
  assert.equal(mostrarSolucionar({ papel: 'candidato', video: off }), true);
  assert.equal(mostrarSolucionar({ papel: 'admin', video: off }), true);
  assert.equal(mostrarSolucionar({ papel: 'observador', eAvaliador: true, video: off }), true, 'avaliador delegado');
  assert.equal(mostrarSolucionar({ papel: 'observador', video: off }), false, 'observador não vê');
  assert.equal(mostrarSolucionar({ papel: 'candidato', video: on }), false, 'conectado: some');
});
