// Base de conhecimento do módulo "Conduta dinâmica" (apoio cognitivo): condutas-padrão por hipótese (ATLS, MS, OMS, AHA, Surviving Sepsis),
// achados que pesam para cada hipótese e a estrutura genérica do PEP. Portado do script anexado pelo usuário (kb.js e pep.js), sem alterar as regras.
// Material de estudo: não substitui o PEP oficial da estação nem a diretriz vigente.
export const N=s=>s.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
const M=(t,k,id)=>({t,k,id,alt:0}),A=(t,k,on,off,why)=>({t,k,on,off,why,alt:1});
export const P={
tr:{n:"Trauma — ATLS (ABCDE)",s:[
M("A · Via aérea com restrição de coluna cervical",/via aerea|colar|cervical|intub/),
M("B · Ventilação: ausculta, SpO₂, O₂ 100%",/ausculta|oxigen|\bo2\b|saturacao|spo2|mascara/),
A("Descompressão/drenagem torácica (pneumotórax hipertensivo)",/drenagem|toracostomia|descompress/,/pneumotorax hipertensivo|desvio de traqueia|turgencia jugular|murmurio (vesicular )?(abolido|ausente)/,/murmurio vesicular (presente|normal|simetrico)|traqueia (central|medial)|sem desvio/,"sem sinais de pneumotórax hipertensivo"),
M("C · Circulação: 2 acessos calibrosos, controle de hemorragia, cristaloide aquecido",/acesso|hemorragia|cristaloide|ringer|garrote|compress/),
A("Centro cirúrgico / laparotomia",/laparotomia|centro cirurgico/,/fast positivo|liquido livre|instavel|choque/,/fast negativo|hemodinamicamente estavel/,"FAST negativo / paciente estável"),
M("D · Neurológico: Glasgow e pupilas",/glasgow|pupila/),
M("E · Exposição e controle de hipotermia",/exposi|expor|hipotermia|aquec/),
M("Adjuvantes: FAST, RX de tórax e pelve",/\bfast\b|raio x|\brx\b/),
A("TC de corpo inteiro",/\btc\b|tomografia/,/\bestavel/,/instavel|fast positivo|choque/,"paciente instável: TC contraindicada, vai ao centro cirúrgico"),
M("Revisão secundária (AMPLA) e transferência",/ampla|revisao secundaria|transfer/)]},
se:{n:"Sepse — Surviving Sepsis / MS",s:[
M("Reconhecer: qSOFA/SIRS + foco suspeito",/qsofa|sirs|foco/),
M("Lactato + 2 hemoculturas antes do ATB",/lactato|hemocultura/),
M("Antibiótico de amplo espectro na 1ª hora",/antibiotic|atb|ceftriaxona|piperacilina|meropenem/),
M("Cristaloide 30 mL/kg se hipotensão ou lactato ≥4",/cristaloide|30 ?ml|ringer|\bsf\b|soro/),
A("Vasopressor (noradrenalina), meta PAM ≥65",/noradrenalina|vasopressor/,/refrataria|pam (<|menor)|hipotensao persistente|nao responde/,/respondeu (ao|a) volume|pam (>|maior|acima)/,"respondeu a volume, PAM ≥65"),
M("Controle do foco (drenagem/remoção)",/drenagem|controle (do )?foco|cirurg/),
M("Reavaliar perfusão (lactato, diurese, TEC)",/reavalia|diurese|tec\b/)]},
sc:{n:"Síndrome coronariana aguda — MS/SBC/AHA",s:[
M("ECG de 12 derivações em ≤10 min",/ecg|eletrocardiograma/),
M("Monitorização + acesso venoso",/monitor|acesso/),
M("AAS 160–300 mg mastigado",/aas|acido acetilsalicilico/),
A("Nitrato SL / analgesia",/nitrato|isossorbida|nitroglicerina|morfina/,/dor (persistente|continua)|\bdor\b/,/pas (<|menor)|hipotens|sildenafil|ventriculo direito|iam de vd/,"hipotensão/uso de inibidor de PDE5/IAM de VD"),
A("Reperfusão: ICP primária ≤90 min ou fibrinólise",/icp|angioplastia|fibrinol|tenecteplase|estreptoquinase|reperfusao/,/supra|supradesnivelamento|iamcsst|bloqueio de ramo esquerdo novo/,/sem supra|infra|ecg normal|st normal/,"sem supra de ST: tratar como SCASEST (anticoagular, estratificar risco)"),
M("Troponina seriada",/troponina/),
M("Anticoagulação + P2Y12 conforme estratégia",/heparina|enoxaparina|clopidogrel|ticagrelor/)]},
av:{n:"AVC — MS/AHA",s:[
M("Glicemia capilar + ABC + horário de início",/glicemia|hgt|dextro/),
M("Escala (Cincinnati/NIHSS) e TC de crânio sem contraste",/nihss|cincinnati|tc|tomografia/),
A("Trombólise IV (alteplase) se ≤4,5 h",/alteplase|trombolise|rtpa/,/(ha|inicio) (\d|um|uma|duas|tres) ?(h|hora)|menos de 4/,/hemorragia|sangramento|mais de 4|acordou com|pa (>|maior).?185/,"hemorragia na TC, janela excedida ou PA não controlada"),
M("Controle de PA (<185/110 se trombólise; <220/120 se não)",/pressao|\bpa\b|anti-?hipertensivo/),
M("Unidade de AVC, AAS após 24 h, dieta suspensa até deglutição",/unidade de avc|aas|degluticao/)]},
pe:{n:"Pré-eclâmpsia/Eclâmpsia — MS",s:[
M("Confirmar PA ≥140/90 em 2 medidas + proteinúria",/proteinuria|fita|pa (de )?\d/),
A("Sulfato de magnésio (ataque 4 g EV + manutenção)",/sulfato|magnesio/,/convuls|eclampsia|escotoma|cefaleia intensa|epigastralgia|pa.{0,6}(16|17|18|19)\d/,/pressao normal|sem sinais de gravidade|sem cefaleia/,"sem sinais de gravidade/iminência"),
A("Anti-hipertensivo (hidralazina ou nifedipina) se PA ≥160/110",/hidralazina|nifedipina/,/pa.{0,6}(16|17|18|19)\d|crise hipertensiva/,/pa.{0,6}1[34]\d ?x ?(9\d|8\d)/,"PA <160/110: manter observação/oral"),
M("Exames: hemograma, plaquetas, TGO/TGP, creatinina, LDH",/hemograma|plaqueta|tgo|creatinina|ldh/),
M("Vitalidade fetal (CTG/USG)",/ctg|cardiotocografia|usg|ultrassom|bcf/),
M("Resolução da gestação conforme idade gestacional/gravidade",/parto|cesarea|resolucao|interrupcao/)]},
de:{n:"Dengue — MS (Grupos A–D)",s:[
M("Classificar: sinais de alarme/gravidade, comorbidades, prova do laço",/classific|grupo|sinais de alarme|laco/),
M("Hemograma (Ht/plaquetas) — Grupos B, C, D",/hemograma|hematocrito|plaqueta/),
A("Hidratação EV imediata (20 mL/kg/h) — Grupos C/D",/reposicao|hidratacao (ev|venosa)|20 ?ml/,/sinais? de alarme|dor abdominal intensa|vomitos persistentes|sangramento|letargia|hipotensao|choque/,/sem sinais de alarme|nao ha sinais de alarme/,"sem sinais de alarme: hidratação oral (Grupos A/B)"),
M("Hidratação oral (60–80 mL/kg/dia) — Grupos A/B",/hidratacao oral|via oral|\bvo\b/),
M("Sintomáticos: paracetamol/dipirona; evitar AINEs e AAS",/paracetamol|dipirona/),
M("Retorno/reavaliação em 24 h e orientação de sinais de alarme",/retorno|reavalia|orienta/)]}};
export const F=[["trauma/colisão/queda",/acidente|queda|atropel|colisao|trauma|esfaque|tiro/,{tr:3}],
["hipotensão/choque",/hipotens|choque|pa (de )?[5-8]\d ?x/,{tr:1,se:2}],
["febre",/febre|febril|calafrio/,{se:2,de:2}],["taquicardia",/taquicard|fc (de )?1[0-9]\d/,{se:1,tr:1,sc:1}],
["dor torácica",/dor toracica|precordial|dor no peito/,{sc:3}],["sudorese/irradiação",/sudorese|irradia/,{sc:2}],
["supra de ST",/supra/,{sc:3}],["déficit focal/afasia",/hemiparesia|afasia|desvio de rima|fraqueza (em um|no) lado|deficit/,{av:3}],
["início súbito",/subito|abrupto/,{av:1}],["gestante",/gestante|gravida|semanas de gestacao|\big\b/,{pe:2}],
["cefaleia",/cefaleia|dor de cabeca/,{pe:1,av:1,de:1}],["edema/proteinúria",/edema|proteinuria/,{pe:2}],
["PA elevada",/pa (de )?1[4-9]\d ?x|hipertens/,{pe:2,av:1}],["convulsão",/convuls/,{pe:2,av:1}],
["mialgia/exantema/retro-orbitária",/mialgia|exantema|retro-?orbit|dengue|manchas vermelhas/,{de:3}],
["vômitos/dor abdominal",/vomito|dor abdominal/,{de:1}],["foco infeccioso",/pneumonia|itu|infeccao|urina turva|tosse com secrecao/,{se:2}],
["desvio de traqueia/MV abolido",/desvio de traqueia|murmurio (vesicular )?(abolido|ausente)/,{tr:2}],["Glasgow baixo",/glasgow (de )?([3-9])\b/,{tr:1}]];
export const has=(re,t)=>{const m=t.match(re);if(!m)return false;return !/\b(sem|nega|ausencia de|nao (ha|tem|apresenta)|afasta)\s+$/.test(t.slice(Math.max(0,m.index-18),m.index))};

export const PEP=[
{id:"p1",n:"1 · Preparação e apresentação",items:[
["Higieniza as mãos",/lav(o|ar|ei|ando).{0,15}maos|higieniz|alcool (em )?gel/],
["Cumprimenta e se apresenta como médico(a)",/bom dia|boa tarde|boa noite|me apresent|meu nome e|sou (o|a) (dr|dra|doutor|doutora|medic)/],
["Confirma a identificação do paciente (nome/idade)",/qual (e )?(o )?(seu )?nome|nome completo|quantos anos|data de nascimento|sua idade/]]},
{id:"p2",n:"2 · Anamnese",items:[
["Queixa principal e tempo de evolução",/o que (esta|o) (sentindo|traz)|queixa|ha quanto tempo|quando comecou|desde quando/],
["Características do sintoma (intensidade, irradiação, piora/melhora)",/intensidade|irradi|piora|melhora|tipo da dor|escala de dor/],
["Sintomas associados",/sintomas associados|mais alguma coisa|febre|vomito|falta de ar|nausea|tosse/],
["Antecedentes, comorbidades e medicamentos em uso",/antecedente|comorbidade|hipertens|diabet|medicamento|remedio|usa algum/],
["Alergias",/alergi/],
["Hábitos e história familiar/social",/tabag|fuma|etilis|bebe|historia familiar|na familia|ocupacao|trabalha/]]},
{id:"p3",n:"3 · Exame físico",items:[
["Sinais vitais (PA, FC, FR, SpO₂, temperatura)",/sinais vitais|pressao arterial|\bpa\b|frequencia cardiaca|\bfc\b|saturacao|temperatura|\bfr\b/],
["Estado geral e nível de consciência",/estado geral|consciente|glasgow|orientad|lucido/],
["Exame segmentar dirigido (inspeção, ausculta, palpação)",/ausculta|palpacao|palpo|inspecao|percuss|exame fisico|exame (do|da) /]]},
{id:"p4",n:"4 · Hipótese diagnóstica",items:[
["Enuncia a hipótese diagnóstica principal",/hipotese|diagnostico|trata-?se de|suspeita de|compativel com/],
["Cita diagnósticos diferenciais",/diferencia|descartar|excluir|outras causas/]]},
{id:"p5",n:"5 · Exames complementares",items:[
["Solicita exames pertinentes",/solicit|\bpeco\b|hemograma|\becg\b|eletrocardiograma|tomografia|raio x|ultrassom|lactato|troponina|glicemia|exames/]]},
{id:"p6",n:"6 · Conduta / tratamento",items:[
["Realiza/prescreve conduta terapêutica imediata",/prescri|administr|inicio|\bdose\b|\bmg\b|oxigen|acesso venoso|hidrata|medicacao/],
["Executa o fluxo da conduta específica (≥2 etapas do fluxo clínico)",null]]},
{id:"p7",n:"7 · Comunicação e orientações",items:[
["Explica diagnóstico e conduta em linguagem acessível",/explic|entendeu|ficou claro|alguma duvida/],
["Orienta sinais de alarme, retorno e seguimento",/sinais de alarme|retorn|procure|seguimento|orienta/],
["Demonstra empatia e acolhimento",/entendo|compreendo|fique tranquil|estou aqui|acolh|calma/]]},
{id:"p8",n:"8 · Desfecho",items:[["Define o destino do paciente (alta, internação, UTI, centro cirúrgico, transferência)",null]]}];
export const OUT=[["Alta com orientações",/\balta\b|liber(o|ar|ado)/],["Internação em enfermaria",/internac|internar/],["UTI / sala de emergência",/\buti\b|terapia intensiva|sala vermelha|sala de emergencia/],["Centro cirúrgico",/centro cirurgico|laparotomia|cirurgia de urgencia/],["Transferência / encaminhamento",/transfer|encaminh|referenc/],["Notificação compulsória",/notific/]];
