// Lê o texto de um caderno de estações (padrão INEP: sumário por ano, instruções, impressos, informações do ator e PEP com pontuação)
// e devolve estações em RASCUNHO para revisão. Não usa IA: só estrutura do texto. O que não for encontrado fica vazio e marcado em `incertos`.
// Estações sem pontuação no PEP (formato antigo, só lista de itens) não são importadas: voltam no relatório com o motivo.
import { validarEstacao } from './estacao-esquema.js';

const RUIDO = [/^REVALIDA INEP$/, /^Estratégia MED \|/, /^ITENS DE DESEMPENHO AVALIADOS/, /^DESEMPENHO (OBSERVADO|AVALIADO)$/, /^INADEQUADO\s+PARCIALMENTE/i, /^(Inadequado )?Parcialmente\s*$/i, /^adequado\s+Adequado$/i,
  /^ADEQUADO\s+ADEQUADO$/, /^\*{3,}$/, /^\s*$/, /^QUESITOS AVALIADOS/, /^Curso de Prova/];
const ehRuido = (l) => RUIDO.some((r) => r.test(l.trim()));
const limpar = (t) => String(t).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
const junta = (ls) => ls.map((l) => l.trim()).filter(Boolean).join('\n').replace(/\n{3,}/g, '\n\n').trim();
const num = (s) => Number(String(s).replace(',', '.'));
const titulo = (s) => { const t = s.toLowerCase().replace(/(^|[\s(/–-])(\p{L})/gu, (m, a, b) => a + b.toUpperCase()); return t.replace(/\b(Da|De|Do|Das|Dos|Na|No|E|Em|Com|Por|Para|À|A|O)\b(?!\s*$)/g, (m, w, o) => (o === 0 ? w : w.toLowerCase())).replace(/\bDip\b/, 'DIP').replace(/\bHellp\b/, 'HELLP').replace(/\bSua\b/, 'SUA').replace(/\bAsc-h\b/i, 'ASC-H').replace(/\bDm\b/, 'DM'); };

/** Sumário: pares (edição, título) na ordem em que as estações aparecem no caderno. */
export function lerSumario(linhas) {
  const ini = linhas.findIndex((l) => l.trim() === 'SUMÁRIO');
  if (ini < 0) return { itens: [], fim: -1 };
  const itens = []; let ano = null; let fim = ini;
  for (let i = ini + 1; i < linhas.length; i++) {
    const l = linhas[i].trim();
    if (l === 'CAPÍTULO') { fim = i; break; }
    if (!l || ehRuido(l)) continue;
    const a = l.match(/^(20\d\d(?:\.\d)?)\s+\d+$/); if (a) { ano = a[1]; continue; }
    const t = l.match(/^(.+?)\s+(\d{1,3})$/); if (t && ano) itens.push({ edicao: ano, titulo: t[1].trim() });
  }
  return { itens, fim };
}

/** Parte o texto em um bloco por estação, procurando cada título do sumário em ordem. */
export function cortarEstacoes(linhas, sumario, fimSumario) {
  const pos = []; let de = fimSumario;
  for (const s of sumario) {
    let i = linhas.findIndex((l, k) => k >= de && l.trim() === s.titulo);
    if (i < 0) { pos.push({ ...s, i: -1 }); continue; }
    pos.push({ ...s, i }); de = i + 1;
  }
  return pos.map((p, k) => {
    if (p.i < 0) return { ...p, linhas: [] };
    const prox = pos.slice(k + 1).find((x) => x.i >= 0);
    return { ...p, linhas: linhas.slice(p.i + 1, prox ? prox.i : linhas.length) };
  });
}

const CAB = /^(CENÁRIO DE (ATUAÇÃO|ATENDIMENTO)|DESCRIÇÃO DO CASO|SÍNTESE DA ESTAÇÃO.*|INSTRUÇÕES (PARA O\(A\) PARTICIPANTE|AO PARTICIPANTE)|IMPRESSO( \d)?|lMPRESSO( \d)?|PADRÃO ESPERADO DE PROCEDIMENTOS?.*|RESPOSTAS A POSSÍVEIS QUESTIONAMENTOS.*|REFERÊNCIAS BIBLIOGRÁFICAS)\s*$/i;

export function lerPEP(linhas) {
  const itens = []; let secao = 'Geral'; let atual = null; let esperado = 1; const vistos = new Set();
  const fechar = () => { if (atual) { itens.push(atual); atual = null; } };
  for (const bruta of linhas) {
    const l = bruta.trim();
    if (ehRuido(l)) continue;
    const m = l.match(/^(\d{1,2})\.?\s+(\S.*)$/);
    const nn = m ? Number(m[1]) : 0;
    // item novo: número esperado; ou salto pequeno; ou número ainda não visto quando o item atual já está completo
    // (o PDF às vezes perde ou troca a ordem de itens entre páginas)
    const completo = !atual || /Inadequado:.*\)\s*\.?\s*$/.test(atual.linhas.join(' '));
    const novo = m && !vistos.has(nn) && nn <= 30 && (nn === esperado || (/^[A-ZÁÉÍÓÚÂÊÔÃÕÇ]/.test(m[2]) && (nn <= esperado + 2 || completo)));
    if (novo) { fechar(); vistos.add(nn); esperado = Math.max(esperado, nn + 1); atual = { n: nn, secao, linhas: [m[2]] }; continue; }
    if (/^[A-ZÁÉÍÓÚÂÊÔÃÕÇ][A-ZÁÉÍÓÚÂÊÔÃÕÇ0-9 ,/()–-]{3,}$/.test(l) && !/^(ADEQUADO|INADEQUADO)/.test(l) && l.split(' ').length <= 8) { if (atual) fechar(); secao = l.charAt(0) + l.slice(1).toLowerCase(); continue; }
    if (atual) atual.linhas.push(l);
  }
  fechar();
  const saida = [];
  itens.sort((a, b) => a.n - b.n);
  for (const it of itens) {
    const txt = it.linhas.join(' ').replace(/\s+/g, ' ');
    const iA = txt.search(/Adequado:/);
    const descricao = (iA >= 0 ? txt.slice(0, iA) : txt).trim();
    const criterio = iA >= 0 ? txt.slice(iA).trim() : '';
    // cada trecho (Adequado / Parcialmente adequado / Inadequado) termina com a pontuação entre parênteses
    const partes = criterio.split(/(?=Parcialmente adequado:|Inadequado:)/);
    const ponto = (t) => { const m = t?.trim().match(/\((\d+(?:,\d+)?)\)\s*\.?\s*$/); return m ? num(m[1]) : null; };
    let adeq = ponto(partes.find((x) => /^Adequado:/.test(x)));
    const inad = ponto(partes.find((x) => /^Inadequado:/.test(x)));
    let deduzido = false;
    if ((adeq === 0 || adeq === null) && inad > 0) { adeq = inad; deduzido = true; }   // o gabarito às vezes troca as pontuações de lugar
    const parc = ponto(partes.find((x) => /^Parcialmente adequado:/.test(x)));
    if (adeq === null) { saida.push({ descricao, criterio, secao: it.secao, semPontos: true }); continue; }
    saida.push({ secao: it.secao, descricao, criterio: criterio.slice(0, 400), pontos_total: adeq, pontos_parcial: parc !== null && parc < adeq ? parc : null, critico: false, ...(deduzido ? { deduzido: true } : {}) });
  }
  return saida;
}

export function lerEstacao(bloco, { area, edicao, titulo: tit }) {
  const L = bloco.map(limpar);
  let idxPEP = L.findIndex((l) => /^PADRÃO ESPERADO DE PROCEDIMENTOS?/i.test(l.trim()) || /^ESPERADO DE PROCEDIMENTOS? \(PEP\)/i.test(l.trim()));
  if (idxPEP < 0) {   // sem cabeçalho do PEP: começa no item "1." que tem "Adequado:" logo adiante
    idxPEP = L.findIndex((l, i) => /^1\.\s+\S/.test(l.trim()) && L.slice(i, i + 14).some((x) => /^Adequado:/.test(x.trim()))) - 1;
    if (idxPEP < -1) idxPEP = -1;
  }
  const antes = idxPEP >= 0 ? L.slice(0, idxPEP) : L;
  const pep = idxPEP >= 0 ? lerPEP(L.slice(idxPEP + 1)) : [];
  const sec = (re) => antes.findIndex((l) => re.test(l.trim()));
  const iCen = sec(/^CENÁRIO DE (ATUAÇÃO|ATENDIMENTO)/i); const iDesc = sec(/^DESCRIÇÃO DO CASO/i);
  const iSint = sec(/^SÍNTESE DA ESTAÇÃO/i); const iImp = sec(/^l?MPRESSO/i.test ? /^[lI]MPRESSO/i : /x/);
  const corte = (a, ate) => junta(antes.slice(a + 1, ate).filter((l) => !ehRuido(l) && !CAB.test(l.trim())));
  const fimInstr = [iSint, iImp].filter((x) => x > iDesc && x >= 0).sort((a, b) => a - b)[0] ?? antes.length;
  const cenario = iCen >= 0 ? corte(iCen, iDesc > iCen ? iDesc : fimInstr) : '';
  const instrucoes = iDesc >= 0 ? corte(iDesc, fimInstr) : '';
  const sintese = iSint >= 0 ? corte(iSint, antes.length) : '';
  // impressos: cada "IMPRESSO" abre um material (título = linha seguinte); termina no próximo cabeçalho
  const materiais = []; const heads = antes.map((l, i) => [i, l.trim()]).filter(([, l]) => /^[lI]MPRESSO/i.test(l));
  heads.forEach(([i], k) => {
    const fim = heads[k + 1]?.[0] ?? (iSint > i ? iSint : antes.length);
    const corpo = antes.slice(i + 1, fim).filter((l) => !ehRuido(l));
    if (!corpo.length) return;
    materiais.push({ tipo: /LABORATOR|HEMOGRAMA|EXAMES? LAB/i.test(corpo[0]) ? 'laboratorial' : /IMAGEM|ULTRA|RADIO|MAMOGRAF/i.test(corpo[0]) ? 'imagem' : /LAUDO|CITOLOG|BIÓPSIA/i.test(corpo[0]) ? 'laudo' : 'outro',
      titulo: corpo[0].trim().slice(0, 120), conteudo: junta(corpo.slice(1)).slice(0, 8000) || corpo[0].trim(), gatilho: `Quando o candidato solicitar: ${corpo[0].trim().toLowerCase().slice(0, 100)}` });
  });
  const incertos = [];
  const semPontos = pep.some((p) => p.semPontos || !(p.pontos_total > 0 && p.pontos_total <= 10));
  const itensPep = pep.filter((p) => !p.semPontos && p.pontos_total > 0 && p.pontos_total <= 10);
  if (itensPep.length < 3) return { ok: false, motivo: idxPEP < 0 ? 'o material não traz o PEP desta estação' : 'o PEP não tem pontuação por item (formato antigo, só lista de itens)' };
  const somaPep = itensPep.reduce((a, p) => a + p.pontos_total, 0);
  if (semPontos || Math.abs(somaPep - 10) > 0.05) incertos.push('pep');   // soma ≠ 10: item perdido/mal lido no PDF
  if (!instrucoes) incertos.push('instrucoes_candidato');
  if (!cenario) incertos.push('cenario');
  if (!sintese) incertos.push('script_ator');
  const bruto = {
    titulo: `${titulo(tit)} (INEP ${edicao})`.slice(0, 120), area, duracao_min: 10,
    sintese: sintese.slice(0, 3000), instrucoes_candidato: instrucoes || 'Instruções do candidato não constam no material: complete antes de usar.',
    cenario: cenario || '', script_ator: sintese || 'Roteiro do ator não consta no material: complete antes de usar.',
    pep: itensPep.map((p, i) => ({ ...p, ordem: i })), materiais, conceitos: [titulo(tit)], objetivos: [],
  };
  const v = validarEstacao(bruto, { completa: false });
  if (!v.ok) return { ok: false, motivo: `não passou na validação (${v.erros.slice(0, 2).join('; ')})` };
  return { ok: true, estacao: v.estacao, incertos, soma: Math.round(itensPep.reduce((s, p) => s + p.pontos_total, 0) * 100) / 100 };
}

/** Ponto de entrada: texto do caderno → { estacoes: [{estacao, incertos, edicao}], relatorio: [{titulo, edicao, importada, motivo?}] }. */
export function extrairEstacoesInep(texto, { area }) {
  const linhas = String(texto).replace(/\r/g, '').split('\n');
  const { itens, fim } = lerSumario(linhas);
  if (!itens.length) return { estacoes: [], relatorio: [], erro: 'Não encontrei o sumário do caderno (esperado: "SUMÁRIO" com ano e título por estação).' };
  const blocos = cortarEstacoes(linhas, itens, fim);
  const estacoes = []; const relatorio = [];
  for (const b of blocos) {
    if (!b.linhas.length) { relatorio.push({ titulo: b.titulo, edicao: b.edicao, importada: false, motivo: 'título não localizado no corpo do caderno' }); continue; }
    const r = lerEstacao(b.linhas, { area, edicao: b.edicao, titulo: b.titulo });
    if (!r.ok) { relatorio.push({ titulo: b.titulo, edicao: b.edicao, importada: false, motivo: r.motivo }); continue; }
    estacoes.push({ estacao: r.estacao, incertos: r.incertos, edicao: b.edicao });
    relatorio.push({ titulo: b.titulo, edicao: b.edicao, importada: true, itens: r.estacao.pep.length, soma: r.soma, a_conferir: r.incertos });
  }
  return { estacoes, relatorio };
}
