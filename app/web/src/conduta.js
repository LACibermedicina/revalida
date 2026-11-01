// Conduta dinâmica: do que o candidato diz (transcrição) ao grafo "achados → hipótese → trilha do PEP → ramificação da conduta".
// Portado do script "Revalida · Conduta Dinâmica" (kb.js, pep.js, board.js, app.js), sem DOM: funções puras, testáveis em Node.
//
// IMPORTANTE: a trilha de referência aqui é a ESTRUTURA GENÉRICA das estações práticas (apresentação → anamnese → exame → hipótese →
// exames → conduta → comunicação → desfecho) e os protocolos resumidos abaixo. Nunca recebe o checklist (PEP) real da estação em curso:
// esse segue restrito ao avaliador. É apoio cognitivo e não altera a nota.

/** minúsculas e sem acentos: todas as expressões abaixo são escritas já nesse formato. */
export const N = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const M = (t, k) => ({ t, k, alt: 0 });
const A = (t, k, on, off, why) => ({ t, k, on, off, why, alt: 1 });

/** Protocolos: s = etapas na ordem esperada; alt = ramo condicional (só entra se um achado justificar; "off" o descarta). */
export const PROTOCOLOS = {
  tr: { n: 'Trauma — ATLS (ABCDE)', s: [
    M('A · Via aérea com restrição de coluna cervical', /via aerea|colar|cervical|intub/),
    M('B · Ventilação: ausculta, SpO₂, O₂ 100%', /ausculta|oxigen|\bo2\b|saturacao|spo2|mascara/),
    A('Descompressão/drenagem torácica (pneumotórax hipertensivo)', /drenagem|toracostomia|descompress/, /pneumotorax hipertensivo|desvio de traqueia|turgencia jugular|murmurio (vesicular )?(abolido|ausente)/, /murmurio vesicular (presente|normal|simetrico)|traqueia (central|medial)|sem desvio/, 'sem sinais de pneumotórax hipertensivo'),
    M('C · Circulação: 2 acessos calibrosos, controle de hemorragia, cristaloide aquecido', /acesso|hemorragia|cristaloide|ringer|garrote|compress/),
    A('Centro cirúrgico / laparotomia', /laparotomia|centro cirurgico/, /fast positivo|liquido livre|instavel|choque/, /fast negativo|hemodinamicamente estavel/, 'FAST negativo / paciente estável'),
    M('D · Neurológico: Glasgow e pupilas', /glasgow|pupila/),
    M('E · Exposição e controle de hipotermia', /exposi|expor|hipotermia|aquec/),
    M('Adjuvantes: FAST, RX de tórax e pelve', /\bfast\b|raio x|\brx\b/),
    A('TC de corpo inteiro', /\btc\b|tomografia/, /\bestavel/, /instavel|fast positivo|choque/, 'paciente instável: TC contraindicada, vai ao centro cirúrgico'),
    M('Revisão secundária (AMPLA) e transferência', /ampla|revisao secundaria|transfer/)] },
  se: { n: 'Sepse — Surviving Sepsis / MS', s: [
    M('Reconhecer: qSOFA/SIRS + foco suspeito', /qsofa|sirs|foco/),
    M('Lactato + 2 hemoculturas antes do ATB', /lactato|hemocultura/),
    M('Antibiótico de amplo espectro na 1ª hora', /antibiotic|atb|ceftriaxona|piperacilina|meropenem/),
    M('Cristaloide 30 mL/kg se hipotensão ou lactato ≥4', /cristaloide|30 ?ml|ringer|\bsf\b|soro/),
    A('Vasopressor (noradrenalina), meta PAM ≥65', /noradrenalina|vasopressor/, /refrataria|pam (<|menor)|hipotensao persistente|nao responde/, /respondeu (ao|a) volume|pam (>|maior|acima)/, 'respondeu a volume, PAM ≥65'),
    M('Controle do foco (drenagem/remoção)', /drenagem|controle (do )?foco|cirurg/),
    M('Reavaliar perfusão (lactato, diurese, TEC)', /reavalia|diurese|tec\b/)] },
  sc: { n: 'Síndrome coronariana aguda — MS/SBC/AHA', s: [
    M('ECG de 12 derivações em ≤10 min', /ecg|eletrocardiograma/),
    M('Monitorização + acesso venoso', /monitor|acesso/),
    M('AAS 160–300 mg mastigado', /aas|acido acetilsalicilico/),
    A('Nitrato SL / analgesia', /nitrato|isossorbida|nitroglicerina|morfina/, /dor (persistente|continua)|\bdor\b/, /pas (<|menor)|hipotens|sildenafil|ventriculo direito|iam de vd/, 'hipotensão/uso de inibidor de PDE5/IAM de VD'),
    A('Reperfusão: ICP primária ≤90 min ou fibrinólise', /icp|angioplastia|fibrinol|tenecteplase|estreptoquinase|reperfusao/, /supra|supradesnivelamento|iamcsst|bloqueio de ramo esquerdo novo/, /sem supra|infra|ecg normal|st normal/, 'sem supra de ST: tratar como SCASEST (anticoagular, estratificar risco)'),
    M('Troponina seriada', /troponina/),
    M('Anticoagulação + P2Y12 conforme estratégia', /heparina|enoxaparina|clopidogrel|ticagrelor/)] },
  av: { n: 'AVC — MS/AHA', s: [
    M('Glicemia capilar + ABC + horário de início', /glicemia|hgt|dextro/),
    M('Escala (Cincinnati/NIHSS) e TC de crânio sem contraste', /nihss|cincinnati|tc|tomografia/),
    A('Trombólise IV (alteplase) se ≤4,5 h', /alteplase|trombolise|rtpa/, /(ha|inicio) (\d|um|uma|duas|tres) ?(h|hora)|menos de 4/, /hemorragia|sangramento|mais de 4|acordou com|pa (>|maior).?185/, 'hemorragia na TC, janela excedida ou PA não controlada'),
    M('Controle de PA (<185/110 se trombólise; <220/120 se não)', /pressao|\bpa\b|anti-?hipertensivo/),
    M('Unidade de AVC, AAS após 24 h, dieta suspensa até deglutição', /unidade de avc|aas|degluticao/)] },
  pe: { n: 'Pré-eclâmpsia/Eclâmpsia — MS', s: [
    M('Confirmar PA ≥140/90 em 2 medidas + proteinúria', /proteinuria|fita|pa (de )?\d/),
    A('Sulfato de magnésio (ataque 4 g EV + manutenção)', /sulfato|magnesio/, /convuls|eclampsia|escotoma|cefaleia intensa|epigastralgia|pa.{0,6}(16|17|18|19)\d/, /pressao normal|sem sinais de gravidade|sem cefaleia/, 'sem sinais de gravidade/iminência'),
    A('Anti-hipertensivo (hidralazina ou nifedipina) se PA ≥160/110', /hidralazina|nifedipina/, /pa.{0,6}(16|17|18|19)\d|crise hipertensiva/, /pa.{0,6}1[34]\d ?x ?(9\d|8\d)/, 'PA <160/110: manter observação/oral'),
    M('Exames: hemograma, plaquetas, TGO/TGP, creatinina, LDH', /hemograma|plaqueta|tgo|creatinina|ldh/),
    M('Vitalidade fetal (CTG/USG)', /ctg|cardiotocografia|usg|ultrassom|bcf/),
    M('Resolução da gestação conforme idade gestacional/gravidade', /parto|cesarea|resolucao|interrupcao/)] },
  de: { n: 'Dengue — MS (Grupos A–D)', s: [
    M('Classificar: sinais de alarme/gravidade, comorbidades, prova do laço', /classific|grupo|sinais de alarme|laco/),
    M('Hemograma (Ht/plaquetas) — Grupos B, C, D', /hemograma|hematocrito|plaqueta/),
    A('Hidratação EV imediata (20 mL/kg/h) — Grupos C/D', /reposicao|hidratacao (ev|venosa)|20 ?ml/, /sinais? de alarme|dor abdominal intensa|vomitos persistentes|sangramento|letargia|hipotensao|choque/, /sem sinais de alarme|nao ha sinais de alarme/, 'sem sinais de alarme: hidratação oral (Grupos A/B)'),
    M('Hidratação oral (60–80 mL/kg/dia) — Grupos A/B', /hidratacao oral|via oral|\bvo\b/),
    M('Sintomáticos: paracetamol/dipirona; evitar AINEs e AAS', /paracetamol|dipirona/),
    M('Retorno/reavaliação em 24 h e orientação de sinais de alarme', /retorno|reavalia|orienta/)] },
};

/** Achados: [rótulo, expressão, peso por hipótese]. */
export const ACHADOS = [
  ['trauma/colisão/queda', /acidente|queda|atropel|colisao|trauma|esfaque|tiro/, { tr: 3 }],
  ['hipotensão/choque', /hipotens|choque|pa (de )?[5-8]\d ?x/, { tr: 1, se: 2 }],
  ['febre', /febre|febril|calafrio/, { se: 2, de: 2 }], ['taquicardia', /taquicard|fc (de )?1[0-9]\d/, { se: 1, tr: 1, sc: 1 }],
  ['dor torácica', /dor toracica|precordial|dor no peito/, { sc: 3 }], ['sudorese/irradiação', /sudorese|irradia/, { sc: 2 }],
  ['supra de ST', /supra/, { sc: 3 }], ['déficit focal/afasia', /hemiparesia|afasia|desvio de rima|fraqueza (em um|no) lado|deficit/, { av: 3 }],
  ['início súbito', /subito|abrupto/, { av: 1 }], ['gestante', /gestante|gravida|semanas de gestacao|\big\b/, { pe: 2 }],
  ['cefaleia', /cefaleia|dor de cabeca/, { pe: 1, av: 1, de: 1 }], ['edema/proteinúria', /edema|proteinuria/, { pe: 2 }],
  ['PA elevada', /pa (de )?1[4-9]\d ?x|hipertens/, { pe: 2, av: 1 }], ['convulsão', /convuls/, { pe: 2, av: 1 }],
  ['mialgia/exantema/retro-orbitária', /mialgia|exantema|retro-?orbit|dengue|manchas vermelhas/, { de: 3 }],
  ['vômitos/dor abdominal', /vomito|dor abdominal/, { de: 1 }], ['foco infeccioso', /pneumonia|itu|infeccao|urina turva|tosse com secrecao/, { se: 2 }],
  ['desvio de traqueia/MV abolido', /desvio de traqueia|murmurio (vesicular )?(abolido|ausente)/, { tr: 2 }], ['Glasgow baixo', /glasgow (de )?([3-9])\b/, { tr: 1 }],
];

/** Trilha genérica das estações práticas (fases e itens). `null` = verificado por regra (conduta específica / desfecho). */
export const TRILHA = [
  { id: 'p1', n: '1 · Preparação e apresentação', items: [
    ['Higieniza as mãos', /lav(o|ar|ei|ando).{0,15}maos|higieniz|alcool (em )?gel/],
    ['Cumprimenta e se apresenta como médico(a)', /bom dia|boa tarde|boa noite|me apresent|meu nome e|sou (o|a) (dr|dra|doutor|doutora|medic)/],
    ['Confirma a identificação do paciente (nome/idade)', /qual (e )?(o )?(seu )?nome|nome completo|quantos anos|data de nascimento|sua idade/]] },
  { id: 'p2', n: '2 · Anamnese', items: [
    ['Queixa principal e tempo de evolução', /o que (esta|o) (sentindo|traz)|queixa|ha quanto tempo|quando comecou|desde quando/],
    ['Características do sintoma (intensidade, irradiação, piora/melhora)', /intensidade|irradi|piora|melhora|tipo da dor|escala de dor/],
    ['Sintomas associados', /sintomas associados|mais alguma coisa|febre|vomito|falta de ar|nausea|tosse/],
    ['Antecedentes, comorbidades e medicamentos em uso', /antecedente|comorbidade|hipertens|diabet|medicamento|remedio|usa algum/],
    ['Alergias', /alergi/],
    ['Hábitos e história familiar/social', /tabag|fuma|etilis|bebe|historia familiar|na familia|ocupacao|trabalha/]] },
  { id: 'p3', n: '3 · Exame físico', items: [
    ['Sinais vitais (PA, FC, FR, SpO₂, temperatura)', /sinais vitais|pressao arterial|\bpa\b|frequencia cardiaca|\bfc\b|saturacao|temperatura|\bfr\b/],
    ['Estado geral e nível de consciência', /estado geral|consciente|glasgow|orientad|lucido/],
    ['Exame segmentar dirigido (inspeção, ausculta, palpação)', /ausculta|palpacao|palpo|inspecao|percuss|exame fisico|exame (do|da) /]] },
  { id: 'p4', n: '4 · Hipótese diagnóstica', items: [
    ['Enuncia a hipótese diagnóstica principal', /hipotese|diagnostico|trata-?se de|suspeita de|compativel com/],
    ['Cita diagnósticos diferenciais', /diferencia|descartar|excluir|outras causas/]] },
  { id: 'p5', n: '5 · Exames complementares', items: [
    ['Solicita exames pertinentes', /solicit|\bpeco\b|hemograma|\becg\b|eletrocardiograma|tomografia|raio x|ultrassom|lactato|troponina|glicemia|exames/]] },
  { id: 'p6', n: '6 · Conduta / tratamento', items: [
    ['Realiza/prescreve conduta terapêutica imediata', /prescri|administr|inicio|\bdose\b|\bmg\b|oxigen|acesso venoso|hidrata|medicacao/],
    ['Executa o fluxo da conduta específica (≥2 etapas do fluxo clínico)', null]] },
  { id: 'p7', n: '7 · Comunicação e orientações', items: [
    ['Explica diagnóstico e conduta em linguagem acessível', /explic|entendeu|ficou claro|alguma duvida/],
    ['Orienta sinais de alarme, retorno e seguimento', /sinais de alarme|retorn|procure|seguimento|orienta/],
    ['Demonstra empatia e acolhimento', /entendo|compreendo|fique tranquil|estou aqui|acolh|calma/]] },
  { id: 'p8', n: '8 · Desfecho', items: [['Define o destino do paciente (alta, internação, UTI, centro cirúrgico, transferência)', null]] },
];
const DESFECHOS = [['Alta com orientações', /\balta\b|liber(o|ar|ado)/], ['Internação em enfermaria', /internac|internar/], ['UTI / sala de emergência', /\buti\b|terapia intensiva|sala vermelha|sala de emergencia/], ['Centro cirúrgico', /centro cirurgico|laparotomia|cirurgia de urgencia/], ['Transferência / encaminhamento', /transfer|encaminh|referenc/], ['Notificação compulsória', /notific/]];

/** Acha a expressão sem aceitar "sem/nega/não há…" imediatamente antes (negação simples). */
export function tem(re, t) {
  const m = t.match(re); if (!m) return false;
  return !/\b(sem|nega|ausencia de|nao (ha|tem|apresenta)|afasta)\s+$/.test(t.slice(Math.max(0, m.index - 18), m.index));
}

/** Achados detectados, hipóteses ranqueadas e a conduta do protocolo mais provável (ou da `forcada`). */
export function analisar(bruto, forcada = null) {
  const t = N(bruto); const sc = {}; const hit = [];
  ACHADOS.forEach((f) => { if (tem(f[1], t)) { hit.push(f); for (const p in f[2]) sc[p] = (sc[p] || 0) + f[2][p]; } });
  const rank = Object.keys(PROTOCOLOS).sort((a, b) => (sc[b] || 0) - (sc[a] || 0));
  const top = forcada && PROTOCOLOS[forcada] ? forcada : ((sc[rank[0]] || 0) > 0 ? rank[0] : null);
  let steps = [];
  if (top) {
    steps = PROTOCOLOS[top].s.map((s) => {
      let st = 'pend'; let why = '';
      if (tem(s.k, t)) st = 'done';
      else if (s.alt) { if (s.off && s.off.test(t)) { st = 'dis'; why = s.why; } else if (tem(s.on, t)) st = 'ind'; else st = 'cond'; }
      return { ...s, st, why };
    });
    const nx = steps.find((s) => !s.alt && s.st === 'pend'); if (nx) nx.st = 'next';
  }
  return { sc, hit, rank, top, steps };
}

/** Trilha genérica: o que já foi dito, em que posição do texto, e o desfecho. */
export function avaliarTrilha(r, bruto) {
  const t = N(bruto);
  const feitos = r.steps.filter((s) => !s.alt && s.st === 'done');
  const outc = DESFECHOS.find((o) => o[1].test(t)) || null;
  const sp = feitos.map((s) => t.search(s.k)).sort((a, b) => a - b);
  const ph = TRILHA.map((p) => ({ id: p.id, n: p.n, its: p.items.map((it, i) => {
    let ok; let pos = -1;
    if (it[1] === null) { ok = p.id === 'p6' ? (!!r.top && feitos.length >= 2) : !!outc; pos = p.id === 'p6' ? (ok ? sp[1] : -1) : (outc ? t.search(outc[1]) : -1); }
    else { const m = t.match(it[1]); ok = !!m; pos = m ? m.index : -1; }
    return { l: it[0], ok, pos, k: p.id + i };
  }) }));
  return { ph, outc };
}

/** Quebra o texto em linhas de até n letras (no máximo m linhas, reticências no fim). */
export const quebrar = (s, n, m) => {
  const L = []; let c = '';
  String(s).split(' ').forEach((x) => { if ((`${c} ${x}`).trim().length > n && c) { L.push(c); c = x; } else c = (`${c} ${x}`).trim(); });
  if (c) L.push(c);
  if (L.length > m) { L.length = m; L[m - 1] = `${L[m - 1].slice(0, n - 1)}…`; }
  return L;
};
export const mmss = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.max(0, Math.round(s)) % 60).padStart(2, '0')}`;

/**
 * Monta o grafo (nós e arestas) com a mesma disposição do quadro original: coluna 0 = achados e hipóteses; uma coluna por fase da trilha;
 * embaixo, a ramificação da conduta clínica. `camada` (−1 achados/hipóteses, 0 trilha, 1 conduta, 1.4 ramos) serve à visão 3D.
 * `tempos` = { [chave do item]: segundos } de quando cada item foi dito.
 */
export function montarGrafo(r, e, { tempos = {} } = {}) {
  const CW = 206, NW = 172, NH = 52, RG = 62, X0 = 20, Y0 = 72;
  const pos = {}; const nos = []; const arestas = []; const cab = []; const info = {};
  const add = (id, x, y, w, h, txt, n, cls, st, inf, camada, extra = {}) => { pos[id] = { x, y, w, h }; nos.push({ id, x, y, w, h, linhas: quebrar(txt, n, 2), rotulo: txt, cls, st, camada, ...extra }); info[id] = inf; return nos[nos.length - 1]; };
  const caminho = (a, b) => {
    const A_ = pos[a], B = pos[b];
    if (A_.x === B.x) { const dn = B.y > A_.y; return `M${A_.x + A_.w / 2},${A_.y + (dn ? A_.h : 0)}L${B.x + B.w / 2},${B.y + (dn ? 0 : B.h)}`; }
    const f = B.x > A_.x; const x1 = f ? A_.x + A_.w : A_.x; const x2 = f ? B.x : B.x + B.w; const y1 = A_.y + A_.h / 2; const y2 = B.y + B.h / 2; const d = Math.max(30, Math.abs(x2 - x1) / 2) * (f ? 1 : -1);
    return `M${x1},${y1}C${x1 + d},${y1} ${x2 - d},${y2} ${x2},${y2}`;
  };
  const aresta = (a, b, cls, mk, d, peso = 0.5) => arestas.push({ id: `${a}>${b}${cls}`, de: a, para: b, cls, mk: mk || null, d: d || caminho(a, b), peso });

  const flat = [];
  e.ph.forEach((p, pi) => p.its.forEach((it, ii) => flat.push({ it, pi, ii, id: `i${pi}_${ii}`, ei: flat.length })));
  const lastOk = Math.max(-1, ...flat.filter((f) => f.it.ok).map((f) => f.pi));
  const perf = flat.filter((f) => f.it.ok && f.it.pos >= 0).sort((a, b) => a.it.pos - b.it.pos); const rank = {}; const oo = new Set(); let mx = -1;
  perf.forEach((f, i) => { rank[f.id] = i + 1; if (f.ei < mx) oo.add(f.id); mx = Math.max(mx, f.ei); });
  const nxt = flat.find((f) => !f.it.ok && f.pi >= Math.max(lastOk, 0));

  r.hit.forEach((f, i) => add(`f${i}`, X0, Y0 + i * 42, NW, 34, f[0], 26, 'fd', '', `${f[0]} — achado detectado na fala.`, -1));
  const hb = Y0 + r.hit.length * 42 + 22; const hyp = r.rank.slice(0, 3).filter((p) => (r.sc[p] || 0) > 0 || p === r.top);
  hyp.forEach((p, j) => { const top = p === r.top; add(`h${p}`, X0, hb + j * 54, NW, 46, (top ? '★ ' : '') + PROTOCOLOS[p].n.split(' — ')[0], 26, `hy${top ? ' top' : ''}`, `${top ? 'mais provável' : 'alternativa'} · peso ${r.sc[p] || 0}`, `${PROTOCOLOS[p].n}${top ? ' — hipótese principal.' : ' — hipótese alternativa.'} Toque para comparar/fixar este fluxo.`, -1, { hyp: p }); });
  const bottom0 = hb + hyp.length * 54;
  cab.push({ x: X0, t: 'Achados → hipótese', c: '' });
  r.hit.forEach((f, i) => hyp.forEach((p) => { if (f[2][p]) { const A_ = pos[`f${i}`]; const B = pos[`h${p}`]; const y1 = A_.y + A_.h / 2; const y2 = B.y + B.h / 2; aresta(`f${i}`, `h${p}`, p === r.top ? 'fht' : 'fh', null, `M${X0 + NW},${y1}C${X0 + NW + 34},${y1} ${X0 + NW + 34},${y2} ${X0 + NW},${y2}`, f[2][p] / 3); } }));

  let maxRows = 0;
  flat.forEach((f) => {
    const x = X0 + (f.pi + 1) * CW; const y = Y0 + f.ii * RG; const it = f.it; maxRows = Math.max(maxRows, f.ii + 1);
    const cls = it.ok ? 'done' : f === nxt ? 'next' : (f.pi < lastOk ? 'omit' : 'pend'); const tm = tempos[it.k] != null ? mmss(tempos[it.k]) : '';
    const st = { done: `✔ realizado${tm ? ` ${tm}` : ''}`, next: '▶ próximo esperado', omit: '✖ omitido', pend: 'previsto' }[cls];
    const inf = `${it.l} — ${{ done: `realizado${tm ? ` aos ${tm}` : ''}, ordem ${rank[f.id]} na fala${oo.has(f.id) ? ' (fora da sequência esperada)' : ''}.`, next: 'próximo item esperado.', omit: 'omitido: não foi citado, embora fases posteriores já tenham ocorrido.', pend: 'previsto; ainda não citado.' }[cls]}`;
    add(f.id, x, y, NW, NH, it.l, 26, cls, st, inf, 0, it.ok && rank[f.id] ? { ordem: rank[f.id], foraDeSeq: oo.has(f.id) } : {});
  });
  e.ph.forEach((p, pi) => cab.push({ x: X0 + (pi + 1) * CW, t: p.n, c: `${p.its.filter((i) => i.ok).length}/${p.its.length}` }));
  for (let i = 0; i < flat.length - 1; i++) aresta(flat[i].id, flat[i + 1].id, 'ex', null, null, 0.1);
  if (hyp.includes(r.top) && pos.i3_0) aresta(`h${r.top}`, 'i3_0', 'hp', null, null, 0.4);
  perf.forEach((f, i) => { if (i) aresta(perf[i - 1].id, f.id, oo.has(f.id) ? 'oo' : 'pf', oo.has(f.id) ? 'a2' : 'a1', null, 0.9); });

  const top0 = Math.max(bottom0, Y0 + maxRows * RG); let H = top0 + 20; let W = X0 + (e.ph.length + 1) * CW;
  if (r.top) {
    const Yb = top0 + 70; const main = r.steps.map((s, i) => ({ s, i })).filter((o) => !o.s.alt); let ma = 0; let prevId = null;
    cab.push({ x: X0, y: Yb - 30, t: `Ramificação da conduta clínica · ${PROTOCOLOS[r.top].n}`, c: '', largo: 1 });
    main.forEach((o, mi) => {
      const s = o.s; const id = `m${o.i}`; const x = X0 + mi * CW; const cls = s.st === 'done' ? 'done' : s.st === 'next' ? 'next' : 'pend';
      add(id, x, Yb, NW, NH, s.t, 26, cls, { done: '✔ realizado', next: '▶ próximo passo', pend: 'previsto' }[cls], `${s.t} — ${ROTULO[s.st]}.`, 1);
      if (prevId) { const feito = cls === 'done' && r.steps[+prevId.slice(1)].st === 'done'; aresta(prevId, id, feito ? 'pf' : 'ex', feito ? 'a1' : null, null, feito ? 0.9 : 0.1); }
      prevId = id;
      let j = 0;
      for (let k = o.i + 1; k < r.steps.length && r.steps[k].alt; k++, j++) {
        const a = r.steps[k]; const ax = x + 22; const ay = Yb + NH + 22 + j * 66; const c2 = { ind: 'ind', dis: 'dis', cond: 'cond', done: 'done' }[a.st];
        add(`a${k}`, ax, ay, NW - 22, 56, a.t, 22, c2, a.st === 'dis' ? `⛔ ${quebrar(a.why, 24, 1)[0]}` : a.st === 'ind' ? '⚠ indicada' : a.st === 'done' ? '✔ realizado' : '◌ condicional',
          `${a.t} — ${ROTULO[a.st]}${a.st === 'dis' ? `. Interrompido: ${a.why}` : a.st === 'ind' ? '. Os achados justificam esta conduta.' : a.st === 'cond' ? '. Só entra se surgir achado que a justifique.' : '.'}`, 1.4);
        aresta(id, `a${k}`, { ind: 'br', dis: 'brd', cond: 'brc', done: 'pf' }[a.st], a.st === 'ind' ? 'a3' : null, `M${x + 11},${Yb + NH}V${ay + 28}H${ax}`, a.st === 'ind' ? 0.8 : 0.3);
        ma = Math.max(ma, j + 1);
      }
    });
    const l6 = flat.find((f) => f.it.l.startsWith('Executa o fluxo'));
    if (l6 && main.length) { const A_ = pos[l6.id]; const B = pos[`m${main[0].i}`]; aresta(l6.id, `m${main[0].i}`, 'hp', null, `M${A_.x + A_.w / 2},${A_.y + A_.h}C${A_.x + A_.w / 2},${Yb - 20} ${B.x + B.w / 2},${Yb - 50} ${B.x + B.w / 2},${Yb}`, 0.4); }
    H = Yb + NH + 22 + ma * 66 + 30; W = Math.max(W, X0 + main.length * CW);
  }
  const feitos = flat.filter((f) => f.it.ok).length; const omitidos = flat.filter((f) => !f.it.ok && f.pi < lastOk).length;
  return {
    nos, arestas, cab, info, W, H, Y0,
    resumo: { feitos, omitidos, foraDeSeq: oo.size, total: flat.length, fluxo: r.top ? PROTOCOLOS[r.top].n.split(' — ')[0] : null, desfecho: e.outc ? e.outc[0] : null },
  };
}
export const ROTULO = { done: 'feito', next: 'próximo passo', ind: 'indicada pelo achado', cond: 'condicional', dis: 'descartada', pend: 'pendente' };

/** Posições 3D {id:[x,y,z]} a partir da disposição 2D: x/y mantêm a leitura, a camada vira profundidade. Estável quando o grafo cresce. */
export function posicoes3D(grafo) {
  const hx = grafo.W / 2 || 1; const hy = grafo.H / 2 || 1; const out = {};
  // x ocupa [-1,1] (a leitura da esquerda para a direita), y fica mais achatado (×0.5) e a camada vira profundidade
  for (const n of grafo.nos) out[n.id] = [(n.x + n.w / 2 - hx) / hx, ((n.y + n.h / 2 - hy) / hy) * 0.5, (n.camada ?? 0) * 0.55];
  return out;
}

/** Tudo em um passo: texto → grafo. `anotacoes` (achados que o ator informou, anotados pelo candidato) entram junto com a fala. */
export function construir({ fala = '', anotacoes = '', forcada = null, tempos = {} } = {}) {
  const texto = [fala, anotacoes].filter(Boolean).join(' . ');
  const r = analisar(texto, forcada); const e = avaliarTrilha(r, texto);
  return { r, e, grafo: montarGrafo(r, e, { tempos }), texto };
}
