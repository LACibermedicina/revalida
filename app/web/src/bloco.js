// Bloco de 5 com IA: uma estação nova por grande área, criada pela IA em paralelo.
// O estado vive fora dos componentes (e no localStorage) para a geração continuar mesmo se a pessoa trocar de tela.
import { useEffect, useState } from 'react';

export const AREAS_BLOCO = ['clinica_medica', 'cirurgia', 'ginecologia_obstetricia', 'pediatria', 'mfc'];
export const NOME_AREA = { clinica_medica: 'Clínica Médica', cirurgia: 'Cirurgia', ginecologia_obstetricia: 'Ginecologia e Obstetrícia', pediatria: 'Pediatria', mfc: 'Medicina de Família e Comunidade' };
const CHAVE = 'rv_bloco_ia';

const ler = () => { try { const b = JSON.parse(localStorage.getItem(CHAVE)); return b && Array.isArray(b.itens) ? b : null; } catch { return null; } };
let estado = ler();
// o que estava "gerando" quando o app fechou não volta mais: vira falha, com botão de tentar de novo
if (estado) estado = { ...estado, itens: estado.itens.map((i) => (i.situacao === 'gerando' ? { ...i, situacao: 'falhou', erro: 'A criação foi interrompida.' } : i)) };
const ouvintes = new Set();
function gravar(novo) {
  estado = novo;
  try { if (novo) localStorage.setItem(CHAVE, JSON.stringify(novo)); else localStorage.removeItem(CHAVE); } catch { /* sem storage */ }
  ouvintes.forEach((f) => f(estado));
}
const mudarItem = (n, dados) => { if (estado) gravar({ ...estado, itens: estado.itens.map((i, k) => (k === n ? { ...i, ...dados } : i)) }); };

/** Mistura a ordem das áreas (cada bloco começa por uma área diferente). */
export function embaralhar(l, aleatorio = Math.random) {
  const c = [...l];
  for (let i = c.length - 1; i > 0; i--) { const j = Math.floor(aleatorio() * (i + 1)); [c[i], c[j]] = [c[j], c[i]]; }
  return c;
}

/** Primeira estação pronta que ainda não foi iniciada (ou a primeira pronta, se todas já foram). */
export function proximaDoBloco(b) {
  if (!b) return -1;
  const k = b.itens.findIndex((i) => i.situacao === 'pronta' && !i.iniciada);
  return k >= 0 ? k : b.itens.findIndex((i) => i.situacao === 'pronta');
}

function gerarItem(api, token, n) {
  const area = estado.itens[n].area, criado = estado.criado;
  mudarItem(n, { situacao: 'gerando', erro: '' });
  return api('/api/solo/bloco/estacao', { metodo: 'POST', token, corpo: { area } })
    .then((r) => { if (estado?.criado === criado) mudarItem(n, { situacao: 'pronta', ...r }); })
    .catch((e) => { if (estado?.criado === criado) mudarItem(n, { situacao: 'falhou', erro: e.message }); });
}

export const bloco = {
  atual: () => estado,
  /** Começa um bloco novo: 5 pedidos em paralelo, um por área. */
  sortear(api, token) {
    gravar({ criado: Date.now(), itens: embaralhar(AREAS_BLOCO).map((area) => ({ area, situacao: 'gerando' })) });
    estado.itens.forEach((_, n) => gerarItem(api, token, n));
  },
  tentarDeNovo: (api, token, n) => gerarItem(api, token, n),
  marcarIniciada: (n) => mudarItem(n, { iniciada: true }),
  limpar: () => gravar(null),
};

export function useBloco() {
  const [b, setB] = useState(estado);
  useEffect(() => { ouvintes.add(setB); setB(estado); return () => ouvintes.delete(setB); }, []);
  return b;
}
