// Esquema da estação (padrão INEP Revalida) — validação, sorteio de campos omitidos e checagens de coerência.
// Todas as vias de entrada (manual, IA por prompt, PDF/imagem, pacote .rvpack) passam por AQUI antes de gravar.
// Nenhum HTML é interpretado: o cliente mostra tudo como texto.

export const ESQUEMA_VERSAO = 1;
export const AREAS = ['clinica_medica', 'cirurgia', 'ginecologia_obstetricia', 'pediatria', 'mfc'];
export const NOMES_AREA = { clinica_medica: 'Clínica Médica', cirurgia: 'Cirurgia', ginecologia_obstetricia: 'Ginecologia e Obstetrícia', pediatria: 'Pediatria', mfc: 'Medicina de Família e Comunidade' };
export const TIPOS_MATERIAL = ['laboratorial', 'imagem', 'biopsia', 'laudo', 'outro'];
export const DIFICULDADES = ['básica', 'intermediária', 'avançada'];

/** Temas de partida para sorteio quando o usuário não os informa (lista própria, só para variar a geração). */
export const SUBTEMAS = {
  clinica_medica: ['dor torácica', 'insuficiência cardíaca', 'pneumonia comunitária', 'diabetes mellitus descompensado', 'hipertensão arterial', 'anemia', 'AVC isquêmico', 'exacerbação de DPOC', 'doença renal crônica', 'hepatite viral'],
  cirurgia: ['abdome agudo', 'trauma torácico', 'hérnia inguinal', 'colecistite aguda', 'queimaduras', 'trauma cranioencefálico', 'apendicite', 'hemorragia digestiva'],
  ginecologia_obstetricia: ['pré-natal de baixo risco', 'pré-eclâmpsia', 'sangramento na gestação', 'trabalho de parto', 'planejamento familiar', 'corrimento vaginal', 'rastreamento de câncer de colo do útero'],
  pediatria: ['febre em lactente', 'bronquiolite', 'diarreia aguda e desidratação', 'puericultura e vacinação', 'asma na infância', 'convulsão febril', 'infecção urinária na criança'],
  mfc: ['hipertensão e diabetes na atenção primária', 'saúde mental na atenção primária', 'tabagismo', 'violência doméstica', 'cuidado ao idoso', 'doenças de notificação compulsória', 'pré-natal na unidade básica'],
};

const CONTROLE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
const txt = (v, max) => String(v ?? '').replace(CONTROLE, '').trim().slice(0, max);
const ehNum = (v) => typeof v === 'number' && Number.isFinite(v);

/**
 * Valida e normaliza uma estação. `completa:true` (publicar) exige o conteúdo mínimo; rascunhos aceitam estação incompleta.
 * Devolve { ok, erros, estacao }. Os erros são mensagens curtas que podem ser devolvidas à IA para nova tentativa.
 */
export function validarEstacao(entrada, { completa = false } = {}) {
  const erros = [];
  const e = entrada && typeof entrada === 'object' && !Array.isArray(entrada) ? entrada : {};
  if (e !== entrada) erros.push('a estação precisa ser um objeto');
  const titulo = txt(e.titulo, 120);
  if (titulo.length < 3) erros.push('titulo: informe de 3 a 120 caracteres');
  if (!AREAS.includes(e.area)) erros.push(`area: use um destes valores: ${AREAS.join(', ')}`);
  let duracao = e.duracao_min === undefined || e.duracao_min === null ? 10 : e.duracao_min;
  if (!Number.isInteger(duracao) || duracao < 1 || duracao > 30) { erros.push('duracao_min: número inteiro de 1 a 30'); duracao = 10; }

  const pep = [];
  if (e.pep !== undefined && !Array.isArray(e.pep)) erros.push('pep: precisa ser uma lista');
  const listaPep = Array.isArray(e.pep) ? e.pep : [];
  if (listaPep.length > 80) erros.push('pep: no máximo 80 itens');
  listaPep.slice(0, 80).forEach((it, i) => {
    const d = txt(it?.descricao, 500);
    const total = ehNum(it?.pontos_total) ? Math.round(it.pontos_total * 100) / 100 : null;
    const parcial = it?.pontos_parcial === undefined || it?.pontos_parcial === null ? null : (ehNum(it.pontos_parcial) ? Math.round(it.pontos_parcial * 100) / 100 : NaN);
    if (d.length < 3) erros.push(`pep[${i}].descricao: informe o que será avaliado`);
    if (total === null || total <= 0 || total > 10) erros.push(`pep[${i}].pontos_total: número maior que 0 e até 10`);
    if (Number.isNaN(parcial) || (parcial !== null && (parcial <= 0 || (total !== null && parcial >= total)))) erros.push(`pep[${i}].pontos_parcial: vazio ou menor que pontos_total`);
    pep.push({ secao: txt(it?.secao, 80) || 'Geral', ordem: i, descricao: d, criterio: txt(it?.criterio, 400), pontos_total: total ?? 0, pontos_parcial: Number.isNaN(parcial) ? null : parcial, critico: it?.critico === true });
  });

  const materiais = [];
  if (e.materiais !== undefined && !Array.isArray(e.materiais)) erros.push('materiais: precisa ser uma lista');
  const listaMat = Array.isArray(e.materiais) ? e.materiais : [];
  if (listaMat.length > 20) erros.push('materiais: no máximo 20');
  listaMat.slice(0, 20).forEach((m, i) => {
    const tipo = m?.tipo === undefined ? 'outro' : m.tipo;
    if (!TIPOS_MATERIAL.includes(tipo)) erros.push(`materiais[${i}].tipo: use ${TIPOS_MATERIAL.join(', ')}`);
    const t = txt(m?.titulo, 120);
    if (!t) erros.push(`materiais[${i}].titulo: obrigatório`);
    materiais.push({ ordem: i, tipo: TIPOS_MATERIAL.includes(tipo) ? tipo : 'outro', titulo: t, conteudo: txt(m?.conteudo, 6000), gatilho: txt(m?.gatilho, 300) });
  });

  const vistos = new Set();
  const conceitos = [];
  for (const c of Array.isArray(e.conceitos) ? e.conceitos : []) {
    const n = txt(c, 60);
    if (n.length >= 2 && !vistos.has(n.toLowerCase()) && conceitos.length < 20) { vistos.add(n.toLowerCase()); conceitos.push(n); }
  }

  const objetivos = [];
  if (e.objetivos !== undefined && !Array.isArray(e.objetivos)) erros.push('objetivos: precisa ser uma lista');
  for (const o of Array.isArray(e.objetivos) ? e.objetivos : []) { const t = txt(o, 300); if (t.length >= 3 && objetivos.length < 8) objetivos.push(t); }

  const estacao = {
    titulo, area: AREAS.includes(e.area) ? e.area : null, duracao_min: duracao,
    instrucoes_candidato: txt(e.instrucoes_candidato, 4000), cenario: txt(e.cenario, 4000), script_ator: txt(e.script_ator, 8000),
    sintese: txt(e.sintese, 3000), objetivos, perfil_paciente: txt(e.perfil_paciente, 300), diagnostico_alvo: txt(e.diagnostico_alvo, 200),
    pep, materiais, conceitos,
  };
  if (completa) {
    if (estacao.script_ator.length < 20) erros.push('script_ator: descreva o roteiro do ator/avaliador');
    if (estacao.instrucoes_candidato.length < 20) erros.push('instrucoes_candidato: descreva o que o candidato deve fazer');
    if (pep.length < 3) erros.push('pep: pelo menos 3 itens de checklist');
  }
  return { ok: erros.length === 0, erros, estacao };
}

export const somaPontos = (estacao) => Math.round(estacao.pep.reduce((s, i) => s + i.pontos_total, 0) * 100) / 100;

/** Avisos (não bloqueiam): conferências heurísticas que o revisor humano deve olhar. */
export function avisosDeCoerencia(estacao) {
  const avisos = [];
  if (estacao.pep.length) avisos.push(`A soma dos pontos do PEP é ${somaPontos(estacao)}. Confira se segue o padrão de pontuação que você usa.`);
  if (estacao.pep.length && !estacao.pep.some((i) => i.critico)) avisos.push('Nenhum item do PEP está marcado como crítico.');
  const cita = estacao.pep.some((i) => /\b(hemograma|ecg|eletrocardiograma|radiografia|raio[- ]x|tomografia|ultrassom|ultrassonografia|ressonância|glicemia|gasometria|urina|biópsia|laudo)\b/i.test(i.descricao));
  if (cita && estacao.materiais.length === 0) avisos.push('O checklist cita exames, mas a estação não tem materiais extras para liberar.');
  for (const m of estacao.materiais) if (!m.conteudo) avisos.push(`O material "${m.titulo}" está sem conteúdo.`);
  return avisos;
}

/* ---------------- sorteio reproduzível ---------------- */

/** PRNG pequeno e determinístico (mulberry32): a mesma semente sempre sorteia o mesmo. */
export function criarRng(semente) {
  let a = semente >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/**
 * Completa o que o usuário deixou em branco (área, tema, dificuldade). Quem sorteia é o servidor, não a IA:
 * o resultado é reproduzível (semente) e varia de verdade entre pedidos.
 */
export function sortearCampos(pedido = {}, semente = Math.floor(Math.random() * 2 ** 31)) {
  const rng = criarRng(semente);
  const escolher = (lista) => lista[Math.floor(rng() * lista.length)];
  const sorteados = [];
  let area = AREAS.includes(pedido.area) ? pedido.area : null;
  let subtema = txt(pedido.subtema, 120);
  // base de referência: sorteio PONDERADO entre temas (relevância ou pontos fracos), só quando o autor não escolheu o tema
  const base = Array.isArray(pedido.candidatosTema) ? pedido.candidatosTema.filter((c) => AREAS.includes(c?.area) && txt(c?.nome, 120) && c.peso > 0 && (!area || c.area === area)) : [];
  if (!subtema && base.length) {
    let r = rng() * base.reduce((s, c) => s + c.peso, 0);
    const c = base.find((x) => (r -= x.peso) < 0) ?? base[base.length - 1];
    subtema = txt(c.nome, 120);
    if (!area) { area = c.area; sorteados.push('area'); }
    sorteados.push('subtema');
  }
  if (!area) { area = escolher(AREAS); sorteados.push('area'); }
  if (!subtema) { subtema = escolher(SUBTEMAS[area]); sorteados.push('subtema'); }
  let dificuldade = DIFICULDADES.includes(pedido.dificuldade) ? pedido.dificuldade : null;
  if (!dificuldade) { dificuldade = escolher(DIFICULDADES); sorteados.push('dificuldade'); }
  return { area, subtema, dificuldade, semente, sorteados };
}

/* ---------------- pacote .rvpack (JSON com soma de verificação) ---------------- */

export const FORMATO_PACOTE = 'rvpack';
export const MAX_ESTACOES_PACOTE = 100;
