import test from 'node:test';
import assert from 'node:assert/strict';
import { montarMenu, comandoValido, COMANDOS } from '../src-menu.js';

const base = (ativo, enviados = []) => montarMenu({ enviar: (c) => enviados.push(c), servidorAtivo: () => ativo, trocarServidor() {}, recarregar() {} });
const itens = (m, rotulo) => m.find((x) => x.label === rotulo).submenu;

test('menu tem Estações (criar, gerar por IA, importar, exportar) e Ciclos', () => {
  const m = base(true);
  const rot = itens(m, 'Estações').filter((i) => i.label).map((i) => i.label);
  assert.ok(rot.includes('Nova estação') && rot.some((r) => /Gerar com IA/.test(r)) && rot.some((r) => /Importar/.test(r)) && rot.some((r) => /Exportar/.test(r)));
  assert.equal(itens(m, 'Ciclos').length, 1);
});

test('cada item manda o comando certo para a tela web', () => {
  const env = []; const m = base(true, env);
  for (const i of [...itens(m, 'Estações'), ...itens(m, 'Ciclos')]) i.click?.();
  assert.deepEqual(env.map((c) => `${c.tela}:${c.aba ?? ''}`), ['estacoes:novo', 'estacoes:gerar', 'estacoes:importar', 'estacoes:exportar', 'estacoes:lista', 'ciclos:']);
  const e3 = []; for (const i of itens(base(true, e3), 'Catálogo')) i.click?.();
  assert.deepEqual(e3.map((c) => `${c.tela}:${c.aba}`), ['catalogo:estacoes', 'catalogo:temas', 'catalogo:importar']);
  const e2 = []; for (const i of itens(base(true, e2), 'Estudo')) i.click?.();
  assert.deepEqual(e2.map((c) => `${c.tela}:${c.aba}`), ['estudo:trilha', 'estudo:cartoes', 'estudo:mapa', 'estudo:erros', 'estudo:guia', 'estudo:diretrizes']);
});

test('sem servidor aberto, os itens ficam desativados', () => {
  const m = base(false);
  assert.ok([...itens(m, 'Estações'), ...itens(m, 'Ciclos')].filter((i) => i.label).every((i) => i.enabled === false));
});

test('só comandos conhecidos passam (fronteira IPC)', () => {
  for (const c of Object.values(COMANDOS)) assert.equal(comandoValido(c), true);
  assert.equal(comandoValido({ tela: 'estacoes', aba: '<script>' }), false);
  assert.equal(comandoValido({ tela: 'admin' }), false);
  assert.equal(comandoValido(null), false);
});
