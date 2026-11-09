// Catálogo de esqueletos de estação (gerado a partir dos materiais de revisão do curso; editável).
// Cada esqueleto: etapas → elementos (id, título, texto de apoio). O esqueleto transversal (A–G) vale para qualquer estação.
export const ESQUELETOS = [
 {
  "id": "esq-transversal",
  "nome": "Esqueleto transversal (blocos A–G)",
  "area": null,
  "etapas": [
   {
    "id": "A",
    "titulo": "Apresentação e rapport",
    "itens": [
     {
      "id": "A",
      "titulo": "Apresentação, nome e idade, como prefere ser chamado(a)",
      "texto": "Bom dia, meu nome é; sou participante do exame; como o(a) senhor(a) prefere ser chamado(a); confirmar nome e idade; motivo da consulta"
     }
    ]
   },
   {
    "id": "B",
    "titulo": "História familiar",
    "itens": [
     {
      "id": "B",
      "titulo": "Doenças na família",
      "texto": "Alguém na família tem essa doença; diabetes, hipertensão, doenças do coração, câncer, doenças neurológicas, convulsões"
     }
    ]
   },
   {
    "id": "C",
    "titulo": "Hábitos de vida, medicamentos e alergias",
    "itens": [
     {
      "id": "C",
      "titulo": "Hábitos, medicação contínua e alergias",
      "texto": "fuma, álcool, alimentação, atividade física, remédio contínuo, alergia a medicamento, drogas, sono"
     }
    ]
   },
   {
    "id": "D",
    "titulo": "Antecedentes pessoais e reprodutivos",
    "itens": [
     {
      "id": "D",
      "titulo": "Antecedentes, cirurgias, internações e história reprodutiva",
      "texto": "doença prévia, cirurgia, internação, já teve isso antes, gestações, partos, última menstruação, diabetes na gestação"
     }
    ]
   },
   {
    "id": "E",
    "titulo": "Caracterização dos sintomas e sinais de alarme",
    "itens": [
     {
      "id": "E",
      "titulo": "Quando começou, tipo, local, irradiação, intensidade, fatores, sinais de alarme",
      "texto": "início, dor tipo local irradiação intensidade 0 a 10, melhora piora, febre, falta de ar, desmaio, alteração de consciência, sangramento"
     }
    ]
   },
   {
    "id": "F",
    "titulo": "Exame físico sistemático e verbalização de achados",
    "itens": [
     {
      "id": "F",
      "titulo": "Sinais vitais, cabeça e pescoço, tórax, abdome, membros e verbalizar achados",
      "texto": "examinar sinais vitais temperatura cabeça pescoço tórax abdome membros pedir autorização verbalizar achados normais ou não"
     }
    ]
   },
   {
    "id": "G",
    "titulo": "Conduta de fechamento",
    "itens": [
     {
      "id": "G",
      "titulo": "Medidas não farmacológicas, orientações de alta, sinais de alerta, retorno, encaminhamentos, impressos e notificação",
      "texto": "orientar alimentação atividade física, sinais de alerta volte se febre dor forte piora, retorno em dias semanas, receita encaminhamento ler em voz alta, notificação"
     }
    ]
   }
  ]
 },
 {
  "id": "esq-clinica",
  "nome": "Clínica Médica",
  "area": "clinica_medica",
  "etapas": [
   {
    "id": "1",
    "titulo": "Abordagem Inicial",
    "itens": [
     {
      "id": "1.1",
      "titulo": "Antes de sentar",
      "texto": "* Aponte o QR Code para a câmera e diga em voz clara: \"Fulano de Tal, candidato à revalidação\". * Vá direto até a mesa, com passo firme e sem pressa. O relógio conta desde o primeiro segundo. * Leia a tarefa afixada e identifique o cenário: UBS, pronto-socorro, enfermaria ou ambulatório. O cenário muda a conduta."
     },
     {
      "id": "1.2",
      "titulo": "Cumprimento e identificação",
      "texto": "\"Olá, boa tarde! Meu nome é [seu nome], sou o(a) médico(a) que vai realizar o seu atendimento.\""
     },
     {
      "id": "1.3",
      "titulo": "Identificação do paciente",
      "texto": "\"Por favor, pode me dizer o seu nome, idade, profissão, estado civil e naturalidade?\" * Guarde o nome e use-o durante toda a estação. Chamar o paciente pelo nome pontua em comunicação. * Profissão e naturalidade abrem hipóteses: exposição ocupacional e doenças endêmicas da região. ￼"
     }
    ]
   },
   {
    "id": "2",
    "titulo": "Anamnese",
    "itens": [
     {
      "id": "2.1",
      "titulo": "Queixa principal",
      "texto": "\"O que te trouxe aqui hoje?\" * Ouça sem interromper. O paciente costuma trazer até três queixas. * Faça uma lista mental das queixas e destrinche uma por uma, na ordem."
     },
     {
      "id": "2.2",
      "titulo": "Caracterização da queixa (ALICIA-FREDUSA)",
      "texto": "Sigla Significado Pergunta prática A Aparecimento Quando começou? Há quanto tempo? L Localização Onde exatamente é? I Intensidade De 0 a 10, quanto? C Caráter É em cólica, pontada, queimação, aperto? I Irradiação Vai para algum outro lugar? A Atenuantes e agravantes Algo melhora ou piora? Tomou algum remédio? FRE Frequência Quantas vezes por dia, semana ou mês? DU Duração Quanto tempo dura cada episódio? Já teve isso antes? SA Sintomas associados O que vem junto? Direcione para a sua hipótese. Roteiros rápidos por sintoma Febre Tosse Dispneia Dia de início, aferiu com termômetro e valor, horário do dia em que é mais intensa, calafrios ou sudorese, fatores de alívio, quantos picos por dia. Di"
     },
     {
      "id": "2.3",
      "titulo": "Sintomas associados",
      "texto": "* Náuseas, vômitos, febre, perda de peso, astenia, hiporexia, sudorese noturna. * Alterações intestinais e urinárias sempre entram no bloco, mesmo que a queixa não seja abdominal. * Quanto melhor a sua teoria, melhores as perguntas: os sintomas associados devem apontar para a sua hipótese e para os diferenciais."
     },
     {
      "id": "2.4",
      "titulo": "Antecedentes patológicos pessoais",
      "texto": "\"O(A) senhor(a) tem alguma doença como pressão alta, diabetes, colesterol alto, asma, tuberculose, problema no coração ou câncer?\" * Comorbidades: HAS, DM, dislipidemia, IAM e outras cardiopatias, AVC, asma, DPOC, tuberculose, HIV, neoplasias. * Medicações: uso contínuo e uso recente de antibiótico ou corticoide. * Alergias: medicamentosas e alimentares. * Internações e cirurgias prévias. * Direcione o bloco para a sua suspeita: se pensa em AVC, pergunte por fibrilação atrial e AIT prévio."
     },
     {
      "id": "2.5",
      "titulo": "Antecedentes familiares",
      "texto": "* HAS, DM, IAM, AVC, dislipidemia, neoplasias, tuberculose e asma. * Pergunte também se alguém em casa tem os mesmos sintomas."
     },
     {
      "id": "2.6",
      "titulo": "Hábitos de vida",
      "texto": "\"O(A) senhor(a) fuma, bebe ou usa algum tipo de droga?\" * Tabagismo: há quanto tempo, quantos cigarros por dia, já tentou parar. Calcule a carga tabágica quando fizer diferença. * Etilismo: tipo de bebida, frequência, quantidade, padrão social ou de abuso. * Drogas ilícitas: qual, frequência, último uso, via. * Rotina: alimentação, atividade física, sono, hábito intestinal, hábito urinário e atividade sexual."
     },
     {
      "id": "2.7",
      "titulo": "Encerramento da anamnese",
      "texto": "\"Tem mais alguma coisa que o(a) senhor(a) gostaria de me relatar?\" Solicite o cartão de vacinas se ainda não pediu. ￼"
     }
    ]
   },
   {
    "id": "3",
    "titulo": "Exame Físico",
    "itens": [
     {
      "id": "3.1",
      "titulo": "Procedimentos iniciais",
      "texto": "1. Peça autorização: \"O(A) senhor(a) me autoriza a realizar o exame físico?\" 2. Explique o que vai fazer, em linguagem acessível. 3. ￼ 4. Verbalize que vai lavar, secar e aquecer as mãos, antes e depois. 5. ￼ 6. Paramente-se conforme a estação exigir: gorro, óculos, máscara, capote e luvas. 7. Oriente o posicionamento do paciente e mantenha-se à direita da maca. 8. Solicite acompanhante ou auxiliar em sala quando o exame for íntimo."
     },
     {
      "id": "3.2",
      "titulo": "Sinais vitais e ectoscopia",
      "texto": "* Sinais vitais: PA, FC, FR, saturação de O2, pulso, temperatura axilar e glicemia capilar quando indicada. * Antropometria: peso, altura, IMC e circunferência abdominal. * Ectoscopia cefalocaudal: estado geral, nível de consciência, pele, mucosas, hidratação, perfusão e extremidades."
     },
     {
      "id": "3.3",
      "titulo": "Exame segmentar",
      "texto": "* Cabeça e pescoço: tireoide, linfonodos, turgência jugular, oroscopia e otoscopia quando pertinente. * Cardiovascular: inspeção, palpação do ictus, ausculta dos focos, ritmo, bulhas e sopros. * Respiratório: inspeção, palpação, percussão e ausculta (IPPA). * Abdome: inspeção, ausculta, percussão e palpação (IAPP), com toque retal quando indicado. * Neurológico: Glasgow, pupilas, força, reflexos, sensibilidade, coordenação e sinais meníngeos (Kernig e Brudzinski). * Membros: edema, panturrilhas, pulsos periféricos e perfusão. * Punho-percussão lombar (sinal de Giordano). O exame é dirigido à queixa: aprofunde o aparelho envolvido e faça o restante de forma sistematizada."
     },
     {
      "id": "3.4",
      "titulo": "Manobras que valem ponto",
      "texto": "Situação clínica Manobras relevantes Meningite Kernig, Brudzinski, rigidez de nuca Insuficiência cardíaca Turgência jugular, refluxo hepatojugular, ausculta de B3 Derrame pleural Frêmito toracovocal reduzido, macicez à percussão, murmúrio abolido Trombose venosa profunda Homans, empastamento de panturrilha, medida comparativa Ascite Piparote, macicez móvel, semicírculos de Skoda Lombalgia e infecção urinária alta Giordano Dengue Prova do laço Descreva o passo a passo da manobra que está realizando antes de dar o resultado. ￼"
     }
    ]
   },
   {
    "id": "4",
    "titulo": "Exames Complementares",
    "itens": [
     {
      "id": "4.1",
      "titulo": "Regra geral",
      "texto": "* Solicite em bloco e dirigido à hipótese. Confira se a tarefa limita o número de exames. * Exame não substitui raciocínio: ele confirma a hipótese, afasta diferenciais ou avalia gravidade."
     },
     {
      "id": "4.2",
      "titulo": "Bioquímicos e laboratoriais",
      "texto": "* Hemograma completo, PCR, VHS. * Função renal e eletrólitos: ureia, creatinina, sódio, potássio, cálcio e magnésio. * Metabólico: glicemia de jejum, hemoglobina glicada e perfil lipídico. * Função hepática: TGO, TGP, fosfatase alcalina, GGT e bilirrubinas. * Quadros agudos: amilase, lipase, lactato e gasometria arterial. * Urina tipo 1 e urocultura, parasitológico de fezes. * Sorologias: HIV, hepatite B e C, VDRL. PPD e baciloscopia de escarro em duas amostras para tuberculose. Punção liquórica na suspeita de meningite."
     },
     {
      "id": "4.3",
      "titulo": "Imagem",
      "texto": "￼ Peça sempre com nome e sobrenome, o mais específico possível. * Radiografia de tórax em incidências posteroanterior e perfil. * Eletrocardiograma de 12 derivações. * Ultrassonografia de abdome total, tomografia computadorizada, angiotomografia e ressonância magnética. * Ecocardiograma transtorácico, endoscopia digestiva alta e doppler vascular."
     },
     {
      "id": "4.4",
      "titulo": "Rastreios por faixa etária",
      "texto": "Idade Rastreio 20 anos Perfil lipídico 25 anos Câncer de colo de útero (Papanicolau) 35 anos Câncer de mama em alto risco e diabetes 45 anos Diabetes 50 anos Câncer de mama (mamografia) e de cólon (sangue oculto nas fezes) 55 anos Câncer de pulmão em grande carga tabágica 65 anos, homem Aneurisma de aorta abdominal em tabagistas 65 anos, mulher Osteoporose"
     },
     {
      "id": "4.5",
      "titulo": "Interpretar e explicar",
      "texto": "\"Seu hemograma mostrou aumento dos glóbulos brancos com desvio à esquerda, o que indica um quadro infeccioso.\" ￼ Nunca leia o exame em silêncio. Diga o achado, o que ele significa e qual será o próximo passo. Ler e não explicar é ponto perdido em quase toda estação. ￼"
     }
    ]
   },
   {
    "id": "5",
    "titulo": "Hipótese Diagnóstica e Diferenciais",
    "itens": [
     {
      "id": "5",
      "titulo": "Hipótese Diagnóstica e Diferenciais",
      "texto": "* Verbalize a hipótese construindo o raciocínio: quadro clínico + exame físico + exames complementares. * Explique ao paciente em linguagem acessível, sem jargão. * Liste os diferenciais: \"poderia ser também...\". Traga pelo menos três a cinco. * ￼ * Em doença infectocontagiosa, explique agente causal e modo de transmissão. ￼"
     }
    ]
   },
   {
    "id": "6",
    "titulo": "Conduta e Tratamento",
    "itens": [
     {
      "id": "6.1",
      "titulo": "Internação",
      "texto": "* ￼ * Explique por que está internando e peça o consentimento. * MOVG: monitorização multiparamétrica, oxigênio suplementar, veia (acesso venoso periférico) e glicemia capilar. * Dieta conforme o caso: via oral, zero, por sonda, hipossódica ou hipocalórica. * Hidratação venosa, correção de distúrbios hidroeletrolíticos e cabeceira elevada. * Sintomáticos: analgesia, antitérmico, antiemético, protetor gástrico e antibioticoterapia quando indicada. * Profilaxia de tromboembolismo venoso quando indicada."
     },
     {
      "id": "6.2",
      "titulo": "Tratamento ambulatorial",
      "texto": "* ￼ * Não farmacológico: alimentação, atividade física, sono, cessação do tabagismo, redução do álcool, psicoterapia, fisioterapia e nutrição. * Farmacológico: classe do fármaco, dose, via, posologia, tempo de uso e efeitos adversos. * Confirme se o paciente consegue ler e entender a prescrição."
     },
     {
      "id": "6.3",
      "titulo": "Encaminhamentos",
      "texto": "* Especialistas: conforme a hipótese. * Equipe multiprofissional: nutricionista, psicólogo, fisioterapeuta e assistente social. * Rede: NASF, CAPS, CAPS-AD, CEREST e unidade de maior complexidade. ￼"
     }
    ]
   },
   {
    "id": "7",
    "titulo": "Considerações Finais (CPMED)",
    "itens": [
     {
      "id": "7",
      "titulo": "Considerações Finais (CPMED)",
      "texto": "Letra Ação C Chamar acompanhante, familiar ou responsável para explicar o quadro e fazer busca ativa de contactantes. P Planejar o acompanhamento, explicar riscos e possíveis complicações. M Marcar retorno programado com data, orientar sinais de alarme e demanda espontânea, e notificar o caso (SINAN, conselho tutelar, CAT). E Extrapolar o motivo da consulta: atualizar cartão de vacinas e avaliar rastreios possíveis. D Despedir-se com empatia e desfazer dúvidas: \"O(A) senhor(a) tem alguma dúvida?\" ￼ .fa-secondary{opacity:.4}"
     }
    ]
   }
  ]
 },
 {
  "id": "esq-cirurgia",
  "nome": "Cirurgia Geral (abdome agudo, trauma, procedimento)",
  "area": "cirurgia",
  "etapas": [
   {
    "id": "1",
    "titulo": "Abordagem Inicial",
    "itens": [
     {
      "id": "1.1",
      "titulo": "Antes de sentar",
      "texto": "* Aponte o QR Code para a câmera e diga seu nome completo seguido de \"candidato à revalidação\". * Leia a tarefa. Em cirurgia ela costuma dizer se a estação é de atendimento, de procedimento ou de trauma, e isso muda tudo. * Olhe o cenário: pronto-socorro, sala vermelha, ambulatório ou centro cirúrgico."
     },
     {
      "id": "1.2",
      "titulo": "Cumprimento e identificação",
      "texto": "\"Olá, boa tarde! Meu nome é [seu nome], sou o(a) médico(a) que vai realizar o seu atendimento.\" \"Por favor, me diga o seu nome, idade, profissão, estado civil e naturalidade.\" ￼"
     }
    ]
   },
   {
    "id": "2",
    "titulo": "Anamnese",
    "itens": [
     {
      "id": "2.1",
      "titulo": "Queixa principal",
      "texto": "\"O que te trouxe aqui hoje?\""
     },
     {
      "id": "2.2",
      "titulo": "Caracterização da queixa (ALICIA-FREDUSA)",
      "texto": "Sigla Significado A Aparecimento (quando iniciou) L Localização I Intensidade (0 a 10) C Caráter (cólica, pontada, queimação, contínua) I Irradiação A Atenuantes e exacerbantes FRE Frequência DU Duração SA Sintomas associados"
     },
     {
      "id": "2.3",
      "titulo": "Sintomas associados do abdome agudo",
      "texto": "* Náuseas e vômitos, e o que sai neles. * Febre, distensão abdominal, anorexia, astenia e perda de peso. * Parada de eliminação de gases e de fezes. * Diarreia ou constipação e alteração recente do hábito intestinal. * Acolia fecal, colúria e icterícia (pense em síndrome colestática). * Disúria, hematúria e urgência urinária. * Sangramento digestivo alto ou baixo: hematêmese, melena, hematoquezia. * Histórico de trauma abdominal."
     },
     {
      "id": "2.4",
      "titulo": "Antecedentes patológicos pessoais",
      "texto": "* Comorbidades: HAS, DM, cardiopatias, HIV, neoplasias, hepatopatias, doença ulcerosa péptica. * Cirurgias prévias: qual, quando, por qual via e se houve complicação. Muda a hipótese de obstrução por brida. * Medicações: atenção a anticoagulantes, antiagregantes, corticoide e anti-inflamatórios. * Alergias medicamentosas e internações prévias. * Direcione conforme a suspeita: se pensa em isquemia mesentérica, pergunte por fibrilação atrial."
     },
     {
      "id": "2.5",
      "titulo": "Antecedentes familiares",
      "texto": "* Câncer colorretal, de mama, de ovário e gástrico, DM, HAS, tuberculose e queixas semelhantes."
     },
     {
      "id": "2.6",
      "titulo": "Hábitos de vida",
      "texto": "* Tabagismo (tempo e quantidade por dia), etilismo (tipo, frequência e quantidade) e drogas ilícitas. * Alimentação, hábito intestinal, sono, atividade física e vida sexual."
     },
     {
      "id": "2.7",
      "titulo": "Encerramento da anamnese",
      "texto": "\"Tem mais alguma coisa que o(a) senhor(a) gostaria de me relatar?\" ￼"
     }
    ]
   },
   {
    "id": "3",
    "titulo": "Atendimento ao Trauma (ABCDE)",
    "itens": [
     {
      "id": "3",
      "titulo": "Atendimento ao Trauma (ABCDE)",
      "texto": "￼ Em estação de trauma ou de paciente instável, o ABCDE vem antes de qualquer anamnese detalhada. Você só passa para a próxima letra depois de resolver a anterior. Letra Ação A Via aérea pérvia com proteção da coluna cervical: colar cervical, aspiração e oxigênio suplementar. B Ventilação: oximetria, inspeção, palpação, percussão e ausculta do tórax. C Circulação: monitorização, dois acessos venosos calibrosos, controle de hemorragia externa por compressão direta e reposição volêmica. D Disfunção neurológica: escala de coma de Glasgow por componentes, pupilas e glicemia capilar. E Exposição com prevenção da hipotermia: dispa completamente e cubra em seguida com manta térmica. Depois do ABCDE"
     }
    ]
   },
   {
    "id": "4",
    "titulo": "Paramentação e Procedimento",
    "itens": [
     {
      "id": "4.1",
      "titulo": "Paramentação (verbalize a ordem)",
      "texto": "1. ￼ 2. Lavar as mãos. 3. Gorro. 4. Máscara. 5. Óculos de proteção ou face shield. 6. Capote (avental estéril). 7. Luvas estéreis."
     },
     {
      "id": "4.2",
      "titulo": "Sequência do procedimento",
      "texto": "1. Lavagem das mãos e paramentação. 2. Assepsia e antissepsia da região, do centro para a periferia, aguardando o tempo de ação. 3. Campo cirúrgico estéril. 4. Anestesia local: aspirar antes de injetar, aguardar e testar a sensibilidade. 5. Procedimento propriamente dito, verbalizando cada tempo. 6. Curativo, orientações e descarte adequado do perfurocortante. 7. Retirar as luvas e lavar as mãos novamente. 8. Avaliar profilaxia antitetânica e necessidade de antibiótico. ￼"
     }
    ]
   },
   {
    "id": "5",
    "titulo": "Exame Físico",
    "itens": [
     {
      "id": "5.1",
      "titulo": "Procedimentos iniciais",
      "texto": "1. Solicitar autorização e explicar o procedimento. 2. Lavar, secar e aquecer as mãos, antes e depois. 3. Paramentar-se conforme a estação exigir. 4. Orientar o posicionamento e manter-se à direita da maca."
     },
     {
      "id": "5.2",
      "titulo": "Avaliação geral",
      "texto": "* Ectoscopia: estado geral, nível de consciência, pele, mucosas, hidratação, perfusão, icterícia e extremidades. * Sinais vitais: PA, FC, FR, saturação de O2, temperatura e glicemia capilar. * Antropometria quando fizer diferença."
     },
     {
      "id": "5.3",
      "titulo": "Exame segmentar",
      "texto": "* Cabeça e pescoço. * Cardiovascular: ausculta, ritmo e bulhas. * Respiratório: inspeção, palpação, percussão e ausculta. * Abdome, sempre nesta ordem: inspeção, ausculta, percussão e palpação. * Região inguinal e genitália: pesquisa de hérnias com manobra de Valsalva. * Toque retal quando indicado. * Neurológico: Glasgow, pupilas e sinais meníngeos. * Membros, pulsos periféricos e perfusão, com punho-percussão lombar."
     },
     {
      "id": "5.4",
      "titulo": "Hora de brilhar no abdome",
      "texto": "Suspeita Manobras Apendicite aguda Blumberg, Rovsing, psoas, obturador, ponto de McBurney Colecistite aguda Murphy Peritonite Descompressão brusca dolorosa difusa, defesa e rigidez abdominal Obstrução intestinal Ruídos metálicos ou abolidos, timpanismo, distensão Perfuração de víscera oca Sinal de Jobert (desaparecimento da macicez hepática) Hérnia Manobra de Valsalva, avaliação de redutibilidade Torção testicular e orquiepididimite Prehn, reflexo cremastérico, sinal de Angell, transiluminação Pancreatite grave Sinais de Grey Turner e de Cullen ￼"
     }
    ]
   },
   {
    "id": "6",
    "titulo": "Exames Complementares",
    "itens": [
     {
      "id": "6.1",
      "titulo": "Laboratoriais",
      "texto": "* Hemograma completo, PCR, VHS. * Ureia, creatinina, sódio, potássio, cálcio e magnésio. * Amilase e lipase. * Colestase: TGO, TGP, fosfatase alcalina, GGT e bilirrubinas direta e indireta. * Coagulograma, tipagem sanguínea e prova cruzada quando houver possibilidade cirúrgica. * Lactato e gasometria arterial nos quadros graves. * Beta-HCG em toda mulher em idade fértil. * Urina tipo 1 e urocultura."
     },
     {
      "id": "6.2",
      "titulo": "Imagem",
      "texto": "* ￼ * Radiografia de tórax em posteroanterior e perfil e radiografia de abdome em pé e deitado (pneumoperitônio e níveis hidroaéreos). * Ultrassonografia de abdome total e de vias biliares. * Tomografia de abdome com contraste: apendicite complicada, diverticulite, abscessos, tumores e trauma em paciente estável. * FAST no trauma abdominal com paciente instável. * Angiotomografia: isquemia mesentérica, aneurisma ou dissecção de aorta. * Endoscopia digestiva alta, colonoscopia e doppler vascular conforme a hipótese. Peça sempre com nome e sobrenome. Interprete e explique o resultado ao paciente. ￼"
     }
    ]
   },
   {
    "id": "7",
    "titulo": "Hipótese Diagnóstica e Diferenciais",
    "itens": [
     {
      "id": "7",
      "titulo": "Hipótese Diagnóstica e Diferenciais",
      "texto": "* Verbalize primeiro o diagnóstico sindrômico e depois o etiológico. * Classifique o abdome agudo: inflamatório, obstrutivo, perfurativo, vascular ou hemorrágico. * Liste os diferenciais e diga por que os afastou. ￼"
     }
    ]
   },
   {
    "id": "8",
    "titulo": "Conduta e Tratamento",
    "itens": [
     {
      "id": "8.1",
      "titulo": "Medidas iniciais e internação",
      "texto": "* ￼ * Explique a necessidade de internação e peça o consentimento informado. * MOVG: monitorização, oxigênio, veia (acesso venoso periférico) e glicemia capilar. * Jejum, repouso no leito e hidratação venosa. * Analgesia, antiemético, protetor gástrico e antibioticoterapia quando indicada. * Sonda nasogástrica e sondagem vesical quando indicadas. * Profilaxia de tromboembolismo venoso."
     },
     {
      "id": "8.2",
      "titulo": "Tratamento cirúrgico",
      "texto": "* Tempo: eletiva (programada), de urgência (nas próximas horas) ou de emergência (imediata). * Via: aberta (laparotomia) ou videolaparoscópica, com a justificativa da escolha. * Técnica e finalidade, explicadas em linguagem acessível. * Termo de consentimento informado assinado, jejum, antibioticoprofilaxia e avaliação pré-anestésica. * Explique riscos, tempo de internação e recuperação."
     },
     {
      "id": "8.3",
      "titulo": "Tratamento ambulatorial",
      "texto": "* Não farmacológico: dieta, hidratação, repouso relativo, cessação do tabagismo e cuidados com a ferida. * Farmacológico: nome, via, posologia, tempo de uso e efeitos adversos."
     },
     {
      "id": "8.4",
      "titulo": "Encaminhamentos",
      "texto": "* Cirurgião geral, coloproctologista, urologista, oncologista e cirurgião vascular. * Nutricionista, estomaterapeuta e unidade de saúde de maior complexidade. ￼"
     }
    ]
   },
   {
    "id": "9",
    "titulo": "Considerações Finais (CPMED)",
    "itens": [
     {
      "id": "9",
      "titulo": "Considerações Finais (CPMED)",
      "texto": "Letra Ação C Chamar acompanhante ou familiar para explicar o quadro e o procedimento. P Planejar o seguimento e esclarecer possíveis complicações pós-operatórias. M Marcar retorno, orientar sinais de alarme e notificar quando indicado (SINAN, CAT, conselho tutelar). E Extrapolar o motivo da consulta: vacinas (inclusive antitetânica) e rastreios. D Despedir-se com empatia e desfazer dúvidas. ￼ .fa-secondary{opacity:.4}"
     }
    ]
   }
  ]
 },
 {
  "id": "esq-pediatria",
  "nome": "Pediatria (puericultura)",
  "area": "pediatria",
  "etapas": [
   {
    "id": "1",
    "titulo": "Abordagem Inicial",
    "itens": [
     {
      "id": "1.1",
      "titulo": "Cumprimento e identificação",
      "texto": "\"Olá, boa tarde! Meu nome é [seu nome], sou o(a) médico(a) que vai realizar o atendimento.\" \"Por favor, pode me dizer o seu nome, idade, profissão e estado civil? E qual o nome e a idade do seu filho(a)?\" * Pediatria é uma estação sobre a mãe (ou responsável) e a criança. Acolha os dois. * Use o nome da criança durante toda a consulta, e não \"o bebê\" ou \"a criança\". * Postura receptiva: não cruze os braços, mantenha contato visual e escute sem interromper."
     },
     {
      "id": "1.2",
      "titulo": "Solicite os documentos",
      "texto": "\"A senhora trouxe a Caderneta de Saúde da Criança e o cartão de vacinas?\" * Peça logo no início, junto com a identificação. A caderneta traz gráficos, marcos e vacinas. * Identifique atrasos vacinais e verbalize a atualização. ￼"
     }
    ]
   },
   {
    "id": "2",
    "titulo": "Anamnese",
    "itens": [
     {
      "id": "2.1",
      "titulo": "Queixa principal",
      "texto": "\"Dona [nome], o que houve com o(a) [nome da criança]? Qual o motivo da consulta?\""
     },
     {
      "id": "2.2",
      "titulo": "Caracterização da queixa (ALICIDAE)",
      "texto": "Sigla Significado A Aparecimento L Localização I Intensidade C Caráter I Irradiação D Duração e frequência A Atenuantes E Exacerbantes Roteiros rápidos por tema Aleitamento Respiratório Diarreia aguda Exantema Tipo (aleitamento materno exclusivo?), número de mamadas, livre demanda, tempo em cada mama, dor ao amamentar, pega e posição, fissuras, ingurgitamento, mamadeira e chupeta. Taquipneia, tiragem, batimento de asa de nariz, gemido, estridor, sibilância, pródromos catarrais, otalgia, febre, cianose. Início, número de evacuações, consistência, sangue ou muco, vômitos, aceitação de líquidos, diurese, estado geral, olhos fundos, lágrimas, sede, sinal da prega, enchimento capilar. Apareciment"
     },
     {
      "id": "2.3",
      "titulo": "Sintomas associados",
      "texto": "* Febre, tosse, coriza, vômitos, diarreia, dor, recusa alimentar, irritabilidade e sonolência. * Alterações urinárias, choro persistente, convulsão e sinais meníngeos. * Perda ou ganho inadequado de peso."
     },
     {
      "id": "2.4",
      "titulo": "Antecedentes gestacionais, perinatais e neonatais",
      "texto": "* Fez o pré-natal? Quantas consultas? Teve alguma intercorrência? Fez as sorologias? * Idade gestacional ao nascer, via de parto e motivo se cesárea. * Intercorrências no parto, necessidade de reanimação, Apgar, peso, comprimento e perímetro cefálico ao nascer. * Triagens neonatais: teste do pezinho, orelhinha, olhinho, coraçãozinho e linguinha. * Icterícia neonatal, uso de fototerapia e internação em unidade neonatal."
     },
     {
      "id": "2.5",
      "titulo": "Antecedentes patológicos pessoais e familiares",
      "texto": "* Doenças e internações prévias, cirurgias, medicações em uso, suplementações e alergias. * Familiares: asma, atopias, diabetes, hipertensão, tuberculose e doenças genéticas. * Sempre pergunte se há mais alguém com os mesmos sintomas em casa, na creche ou na escola."
     },
     {
      "id": "2.6",
      "titulo": "Hábitos de vida e desenvolvimento",
      "texto": "* Aleitamento materno exclusivo em livre demanda? Introdução alimentar: quando começou e como é feita? * Hábito intestinal (frequência e características das fezes) e urinário (número de fraldas ou micções). * Sono: quantas horas, onde dorme e posição de dormir. * Uso de mamadeira e chupeta. * Frequenta creche ou escola? Pratica atividade física? Tempo de exposição a telas. * Marcos do desenvolvimento neuropsicomotor conforme a idade: mencione e confira na caderneta. * Condições de moradia, saneamento, prevenção de acidentes e presença de fumante em casa."
     },
     {
      "id": "2.7",
      "titulo": "Rede de apoio",
      "texto": "* Quem cuida da criança no dia a dia? A mãe tem rede de apoio? * Está de licença maternidade ou já voltou a trabalhar? Se voltou, oriente a ordenha e o armazenamento correto do leite materno. * Investigue sinais de sobrecarga materna e de depressão pós-parto. ￼"
     }
    ]
   },
   {
    "id": "3",
    "titulo": "Exame Físico",
    "itens": [
     {
      "id": "3.1",
      "titulo": "Procedimentos iniciais",
      "texto": "1. Solicitar autorização e explicar o procedimento à mãe ou ao responsável. 2. ￼ 3. Lavar, secar e aquecer as mãos, antes e depois. 4. Pedir para a mãe despir completamente a criança, incluindo fralda e acessórios, e vesti-la ao final. 5. Realizar o exame em ambiente aquecido e com a criança confortável, no colo se necessário. 6. Deixar as manobras desconfortáveis (oroscopia e otoscopia) para o final."
     },
     {
      "id": "3.2",
      "titulo": "Avaliação geral e antropometria",
      "texto": "* Ectoscopia: estado geral, nível de atividade, choro, pele, mucosas, hidratação, perfusão e lesões. * Sinais vitais: FC, FR, saturação de O2, temperatura axilar e PA, com valores de referência para a idade. * Antropometria: peso, comprimento ou estatura, perímetro cefálico e IMC. * Solicite os gráficos da caderneta, plote os resultados e verbalize o escore Z."
     },
     {
      "id": "3.3",
      "titulo": "Exame segmentar",
      "texto": "* Cabeça: fontanelas (tamanho e tensão), suturas e formato do crânio. * Olhos, oroscopia, otoscopia e rinoscopia. * Pescoço: linfonodos e rigidez de nuca. * Cardiovascular: ausculta, ritmo, sopros e pulsos femorais. * Respiratório: inspeção (tiragem, batimento de asa de nariz, uso de musculatura acessória), palpação, percussão e ausculta. * Abdome: inspeção, ausculta, percussão e palpação, com avaliação do coto umbilical no recém-nascido, hérnias e visceromegalias. * Genitália: testículos tópicos, fimose, sinéquia e sinais de puberdade precoce. * Quadris: manobras de Ortolani e de Barlow. * Neurológico: tônus, reflexos primitivos conforme a idade, Glasgow pediátrico, pupilas e sinais menínge"
     }
    ]
   },
   {
    "id": "4",
    "titulo": "Exames Complementares",
    "itens": [
     {
      "id": "4",
      "titulo": "Exames Complementares",
      "texto": "* Solicite apenas o necessário, dirigido à hipótese, em bloco, respeitando o limite da tarefa. * Hemograma, PCR, VHS, ureia, creatinina, eletrólitos e glicemia. * Urina tipo 1 e urocultura (atenção ao método de coleta na criança), hemocultura e coprocultura. * ￼ * Radiografia de tórax em posteroanterior e perfil, ultrassonografia dirigida. * Descreva o exame solicitado, cite o que você observa e explique o resultado ao responsável. ￼"
     }
    ]
   },
   {
    "id": "5",
    "titulo": "Hipótese Diagnóstica e Diferenciais",
    "itens": [
     {
      "id": "5",
      "titulo": "Hipótese Diagnóstica e Diferenciais",
      "texto": "* Comunique à mãe ou ao responsável com linguagem simples e acolhedora. * Explique o que causou a doença, se é grave, se é autolimitada e qual a evolução esperada. * Liste os diagnósticos diferenciais. * ￼ * Em doenças transmissíveis, explique a transmissão, o período de isolamento e a conduta com os contactantes. ￼"
     }
    ]
   },
   {
    "id": "6",
    "titulo": "Conduta e Tratamento",
    "itens": [
     {
      "id": "6.1",
      "titulo": "Internação",
      "texto": "* ￼ * Justifique a decisão e explique o motivo aos pais. * MOV: monitorização, oxigênio e veia (acesso venoso periférico). * Hidratação conforme o plano (A, B ou C na diarreia com desidratação), com cálculo por peso. * Antitérmico, analgesia e antibioticoterapia quando indicada, sempre com dose por quilo."
     },
     {
      "id": "6.2",
      "titulo": "Ambulatorial",
      "texto": "* Farmacológico: dose por quilo de peso, via, intervalo, tempo de uso e efeitos adversos. Confirme se a mãe sabe administrar corretamente. * Não farmacológico: correção da pega no aleitamento, orientação alimentar, hidratação, medidas ambientais na asma, higiene das mãos e ventilação do ambiente. * Oriente redução do tempo de tela, sono adequado e atividade física conforme a idade. * Prevenção de acidentes conforme a faixa etária."
     },
     {
      "id": "6.3",
      "titulo": "Encaminhamentos",
      "texto": "* Especialista, nutricionista, fonoaudiólogo, fisioterapeuta e psicólogo. * NASF, CAPS infantil, CRAS, CREAS e conselho tutelar quando houver violação de direitos. ￼"
     }
    ]
   },
   {
    "id": "7",
    "titulo": "Considerações Finais (CPMED)",
    "itens": [
     {
      "id": "7",
      "titulo": "Considerações Finais (CPMED)",
      "texto": "Letra Ação C Chamar o responsável para explicar o quadro e fazer busca ativa de contactantes. P Planejar o acompanhamento, explicar complicações e tirar dúvidas. M Marcar retorno programado, orientar sinais de alarme e notificar quando indicado (SINAN, conselho tutelar). E Extrapolar o motivo da consulta: vacinas, alimentação, tempo de tela, sono e atividade física. D Despedir-se, tranquilizar e confirmar o entendimento: \"a senhora ficou com alguma dúvida?\" Verbalize sempre que está anotando tudo na Caderneta de Saúde da Criança. ￼"
     }
    ]
   },
   {
    "id": "8",
    "titulo": "Roteiro da Puericultura (CEVADA)",
    "itens": [
     {
      "id": "8",
      "titulo": "Roteiro da Puericultura (CEVADA)",
      "texto": "Letra Item C Crescimento: peso, estatura, perímetro cefálico, plotagem nos gráficos e escore Z E Estado nutricional: aleitamento, introdução alimentar, suplementação de ferro e vitamina D V Vacinas: conferir o cartão e corrigir atrasos A Alimentação: qualidade, frequência, ultraprocessados e açúcar antes dos 2 anos D Desenvolvimento: marcos neuropsicomotores para a idade A Ambiente: moradia, creche, prevenção de acidentes, tabagismo passivo e rede de apoio ￼ .fa-secondary{opacity:.4}"
     }
    ]
   }
  ]
 },
 {
  "id": "esq-ginecologia",
  "nome": "Ginecologia (propedêutica ginecológica)",
  "area": "ginecologia_obstetricia",
  "etapas": [
   {
    "id": "1",
    "titulo": "Abordagem Inicial",
    "itens": [
     {
      "id": "1.1",
      "titulo": "Cumprimento e identificação",
      "texto": "\"Olá, boa tarde! Meu nome é [seu nome], sou o(a) médico(a) que vai realizar o seu atendimento.\" \"Por favor, poderia me dizer o seu nome, idade, profissão, estado civil e naturalidade?\" * Ginecologia exige acolhimento desde a primeira frase: contato visual, tom calmo e privacidade garantida. * Confirme se a paciente prefere ser atendida sozinha ou acompanhada. ￼"
     }
    ]
   },
   {
    "id": "2",
    "titulo": "Anamnese",
    "itens": [
     {
      "id": "2.1",
      "titulo": "Queixa principal",
      "texto": "\"O que te trouxe aqui hoje?\""
     },
     {
      "id": "2.2",
      "titulo": "Caracterização da queixa (ALICIDAE)",
      "texto": "Sigla Significado A Aparecimento L Localização I Intensidade (0 a 10) C Caráter I Irradiação D Duração e frequência A Atenuantes E Exacerbantes Roteiros rápidos por tema Derrame papilar Corrimento vaginal Rastreio de IST Queixa urinária Espontâneo ou à expressão, uni ou bilateral, uni ou multiductal, coloração, aspecto água de rocha, sanguinolento, tempo de evolução. Cor, odor que piora após o coito, quantidade, aspecto (grumoso, bolhoso, líquido), prurido, relação com o ciclo, vesículas ou lesões, dispareunia, uso de duchas ou pomadas. Uso de preservativo em todas as relações, número de parceiros, ISTs prévias e tratadas, parceiro sintomático, vacinação para HPV e hepatite B. Disúria, polac"
     },
     {
      "id": "2.3",
      "titulo": "Sintomas associados",
      "texto": "* Dor pélvica, dismenorreia, dispareunia, sinusorragia e sangramento uterino anormal. * Febre, perda de peso, astenia e alterações urinárias e intestinais. * No climatério: sintomas vasomotores, ressecamento vaginal e alterações do humor."
     },
     {
      "id": "2.4",
      "titulo": "Antecedentes ginecológicos",
      "texto": "* Menarca e sexarca. * Ciclo menstrual: regular ou irregular, duração, intervalo, fluxo e número de absorventes por dia. * Data da última menstruação (DUM). * Último Papanicolau, última mamografia e última ultrassonografia. * Vida sexual: ativa, parceiro único ou múltiplos, uso de preservativo em todas as relações. * Método contraceptivo em uso, satisfação e desejo de troca. * ISTs prévias, leucorreia e queixas urinárias. * Vacinas: HPV, hepatite B e dupla adulto."
     },
     {
      "id": "2.5",
      "titulo": "Antecedentes obstétricos",
      "texto": "* Gesta, para e aborto (GPA), com a via de cada parto. * Intercorrências na gestação, no parto e no puerpério. * Se houve aborto ou cesárea, pergunte o motivo. Se houve aborto, pergunte se recebeu imunoglobulina anti-D. * Amamentação e tempo de aleitamento. * Desejo reprodutivo atual: pretende engravidar?"
     },
     {
      "id": "2.6",
      "titulo": "Antecedentes pessoais e familiares",
      "texto": "* Pessoais: HAS, DM, dislipidemia, tromboembolismo, enxaqueca com aura, hepatopatia, neoplasias, cirurgias e internações prévias, medicações e alergias. * Familiares: câncer de mama, de ovário, de endométrio e colorretal, com a idade do diagnóstico. DM e HAS."
     },
     {
      "id": "2.7",
      "titulo": "Hábitos de vida",
      "texto": "* Alimentação, atividade física, sono, hábito intestinal e urinário. * Tabagismo, etilismo e uso de drogas ilícitas, sempre quantificados."
     },
     {
      "id": "2.8",
      "titulo": "Encerramento da anamnese",
      "texto": "\"Tem mais alguma coisa que a senhora gostaria de me relatar?\" ￼"
     }
    ]
   },
   {
    "id": "3",
    "titulo": "Exame Físico",
    "itens": [
     {
      "id": "3.1",
      "titulo": "Procedimentos iniciais",
      "texto": "1. Solicitar autorização: \"A senhora me autoriza a realizar o exame físico e ginecológico?\" 2. Explicar o procedimento passo a passo, antes de começar. 3. Solicitar a presença de uma terceira pessoa na sala, preferencialmente do sexo feminino. 4. ￼ 5. Lavar, secar e aquecer as mãos, antes e depois. 6. Garantir privacidade com biombo e orientar a paciente a se despir e vestir o avental. 7. Pedir que esvazie a bexiga antes do exame."
     },
     {
      "id": "3.2",
      "titulo": "Avaliação geral",
      "texto": "* Ectoscopia: estado geral, pele, mucosas, distribuição de pelos, acne e sinais de hiperandrogenismo. * Sinais vitais: PA, FC, FR, saturação de O2 e temperatura. * Antropometria: peso, altura, IMC e circunferência abdominal. * Exame segmentar: aparelho respiratório, cardiovascular e abdome."
     },
     {
      "id": "3.3",
      "titulo": "Exame das mamas",
      "texto": "1. Inspeção estática: paciente sentada, braços ao longo do corpo. Avalie simetria, abaulamentos, retrações e alterações da pele (pele em casca de laranja) e do complexo areolopapilar. 2. Inspeção dinâmica: braços elevados acima da cabeça, mãos na cintura com contração peitoral e inclinação do tronco para a frente. 3. Palpação de linfonodos: cadeias axilares, cervicais, supraclaviculares e infraclaviculares. 4. Palpação das mamas: paciente deitada com as mãos atrás da cabeça, com a polpa digital em movimentos circulares, por quadrantes ou em espiral, incluindo a cauda axilar de Spence. 5. Expressão papilar: presença, aspecto e origem uni ou multiductal da secreção."
     },
     {
      "id": "3.4",
      "titulo": "Exame ginecológico",
      "texto": "1. Posicionamento: litotomia, cabeceira a 30 graus, foco de luz posicionado. 2. Inspeção vulvar: lábios maiores e menores, clitóris, meato uretral, períneo e região perianal. Procure lesões, verrugas, úlceras e fissuras. 3. Exame especular: calçar luvas, introduzir o espéculo a 45 graus, horizontalizar, abrir e visualizar paredes vaginais e colo uterino. 4. Coleta do colpocitológico: espátula de Ayre para a ectocérvice e escova endocervical para o canal. Identifique a lâmina com lápis grafite, fixe imediatamente e identifique os frascos. 5. Retirada do espéculo: feche parcialmente e retire protegendo a uretra. 6. Toque vaginal bimanual: luvas e lubrificação dos dedos indicador e médio. Avali"
     }
    ]
   },
   {
    "id": "4",
    "titulo": "Exames Complementares",
    "itens": [
     {
      "id": "4",
      "titulo": "Exames Complementares",
      "texto": "Tipo Exemplos Laboratoriais Hemograma, glicemia de jejum, perfil lipídico, TSH, prolactina, beta-HCG, EAS e urocultura Sorologias HIV, VDRL, HBsAg, anti-HCV, toxoplasmose (IgG e IgM) Imagem USG pélvica e transvaginal, mamografia, ultrassonografia mamária, histerossonografia Rastreamento Papanicolau (25 a 64 anos), mamografia (50 a 69 anos, bienal), sangue oculto nas fezes Outros Coombs, tipagem e fator Rh, bacterioscopia e cultura de secreção vaginal, teste das aminas, pH vaginal, colposcopia com biópsia Interprete e explique cada resultado para a paciente com linguagem clara. ￼"
     }
    ]
   },
   {
    "id": "5",
    "titulo": "Hipótese Diagnóstica e Diferenciais",
    "itens": [
     {
      "id": "5",
      "titulo": "Hipótese Diagnóstica e Diferenciais",
      "texto": "* Comunique a hipótese principal e justifique com os achados. * Liste os diagnósticos diferenciais. * ￼ * Em ISTs, explique agente causal, forma de transmissão, necessidade de tratar o parceiro e notificação. ￼"
     }
    ]
   },
   {
    "id": "6",
    "titulo": "Conduta e Tratamento",
    "itens": [
     {
      "id": "6.1",
      "titulo": "Ambulatorial",
      "texto": "* Farmacológico: nome, dose, via, posologia, tempo de uso e efeitos adversos. Confirme se a paciente entendeu. * Não farmacológico: higiene íntima, uso de preservativo em todas as relações, alimentação, atividade física e cessação do tabagismo. * Contracepção: indique ou ajuste o método considerando os critérios de elegibilidade."
     },
     {
      "id": "6.2",
      "titulo": "Internação",
      "texto": "* ￼ * Justifique a internação com base no quadro. * MOV: monitorização, oxigênio e veia (acesso venoso periférico). * Hidratação, analgesia e antibioticoterapia quando indicada."
     },
     {
      "id": "6.3",
      "titulo": "Cirúrgico",
      "texto": "* Explique a necessidade, o tempo (eletiva, urgência ou emergência) e a via. * Termo de consentimento informado, jejum, hidratação venosa e analgesia."
     },
     {
      "id": "6.4",
      "titulo": "Tratamento da sífilis",
      "texto": "Estágio Esquema Primária, secundária e latente recente (menos de 1 ano) Penicilina G benzatina 2.400.000 UI IM, dose única Latente tardia, de duração ignorada e terciária Penicilina G benzatina 2.400.000 UI IM, 1 vez por semana, por 3 semanas Trate o parceiro, notifique o caso e programe o seguimento sorológico trimestral com VDRL."
     },
     {
      "id": "6.5",
      "titulo": "Encaminhamentos",
      "texto": "* Mastologista, oncologista, reprodução humana e cirurgia ginecológica. * Rede de apoio: NASF, CAPS, CRAS, CREAS e serviço de referência para violência sexual. ￼"
     }
    ]
   },
   {
    "id": "7",
    "titulo": "Considerações Finais (CPMED)",
    "itens": [
     {
      "id": "7",
      "titulo": "Considerações Finais (CPMED)",
      "texto": "Letra Ação C Chamar acompanhante ou familiar, com o consentimento da paciente, e fazer busca ativa de contactantes quando for IST. P Planejar o seguimento e esclarecer riscos e complicações. M Marcar retorno, orientar sinais de alarme e notificar (SINAN, conselho tutelar, delegacia em casos de violência sexual). E Extrapolar o motivo da consulta: vacinas (HPV, hepatite B, dupla adulto) e rastreios (Papanicolau, mamografia). D Despedir-se e desfazer dúvidas. ￼ .fa-secondary{opacity:.4}"
     }
    ]
   }
  ]
 },
 {
  "id": "esq-obstetricia",
  "nome": "Obstetrícia",
  "area": "ginecologia_obstetricia",
  "etapas": [
   {
    "id": "1",
    "titulo": "Abordagem Inicial",
    "itens": [
     {
      "id": "1.1",
      "titulo": "Cumprimento e identificação",
      "texto": "\"Olá, boa tarde! Meu nome é [seu nome], sou o(a) médico(a) que vai realizar o seu atendimento.\" \"Por favor, poderia me dizer o seu nome, idade, profissão, estado civil e naturalidade?\""
     },
     {
      "id": "1.2",
      "titulo": "Solicite a caderneta",
      "texto": "\"A senhora trouxe a sua Caderneta da Gestante e o cartão de vacinas?\" * Peça a caderneta logo no início: ela traz idade gestacional, exames de rotina, curva de peso, pressão e altura uterina. * Ao final do exame, verbalize que está registrando tudo na caderneta. ￼"
     }
    ]
   },
   {
    "id": "2",
    "titulo": "Anamnese",
    "itens": [
     {
      "id": "2.1",
      "titulo": "Queixa principal",
      "texto": "\"O que te trouxe aqui hoje?\""
     },
     {
      "id": "2.2",
      "titulo": "Caracterização da queixa (ALICIDAE)",
      "texto": "Sigla Significado A Aparecimento L Localização I Intensidade (0 a 10) C Caráter I Irradiação D Duração e frequência A Atenuantes E Exacerbantes Cenários comuns Sangramento Síndrome hipertensiva Infecção urinária Alto risco Cor, quantidade, coágulos, relação com o coito, dor associada, colo aberto ou fechado, idade gestacional. Cefaleia, escotomas cintilantes, epigastralgia ou dor em hipocôndrio direito, edema de face e mãos, oligúria, níveis pressóricos. Disúria, polaciúria, urgência, dor lombar, febre, calafrios, náuseas e vômitos. HAS, DM, colagenoses, nefropatia, cardiopatia, trombofilias, gestação múltipla, idade materna extrema."
     },
     {
      "id": "2.3",
      "titulo": "Sintomas obstétricos que sempre devem ser perguntados",
      "texto": "1. Sangramento vaginal. 2. Corrimento ou secreção vaginal. 3. Perda de líquido pela vagina. 4. Cólicas, contrações ou dor abdominal. 5. Movimentação fetal: percebe o bebê mexendo, mudou o padrão? Complete com cefaleia, alterações visuais, edema, náuseas, vômitos e queixas urinárias."
     },
     {
      "id": "2.4",
      "titulo": "Antecedentes obstétricos",
      "texto": "* DUM, data provável do parto (DPP) e idade gestacional em semanas. * GPAC: gestações, partos (via de cada um), abortos e cesáreas. * Intercorrências em gestações anteriores: pré-eclâmpsia, diabetes gestacional, prematuridade, restrição de crescimento, óbito fetal. * Intercorrências no parto e no puerpério, e peso dos recém-nascidos. * Se houve aborto, pergunte o motivo e se recebeu imunoglobulina anti-D. * Está fazendo o pré-natal? Quantas consultas já teve? Traz os exames? * Se o pré-natal já está em andamento, pergunte o que mudou desde a última consulta. * Esta gestação foi planejada e desejada? Tem rede de apoio?"
     },
     {
      "id": "2.5",
      "titulo": "Antecedentes ginecológicos",
      "texto": "* Menarca, sexarca, ciclo menstrual e DUM. * Último Papanicolau, última mamografia e ultrassonografias. * ISTs prévias, leucorreia e uso de preservativo. * Vacinas: dTpa, hepatite B, influenza e covid-19."
     },
     {
      "id": "2.6",
      "titulo": "Antecedentes pessoais e familiares",
      "texto": "* Pessoais: HAS, DM, cardiopatia, nefropatia, tireoidopatia, trombofilia, epilepsia, transtornos mentais, cirurgias e internações, medicações e alergias. * Familiares: DM, HAS, pré-eclâmpsia, gemelaridade, câncer de mama, ovário e endométrio."
     },
     {
      "id": "2.7",
      "titulo": "Hábitos de vida",
      "texto": "* Alimentação, hidratação, atividade física, sono e hábitos fisiológicos. * Tabagismo, etilismo e uso de drogas: quantifique e ofereça apoio para cessação. * Uso de medicações e suplementação (ácido fólico e sulfato ferroso). ￼"
     }
    ]
   },
   {
    "id": "3",
    "titulo": "Exame Físico",
    "itens": [
     {
      "id": "3.1",
      "titulo": "Procedimentos iniciais",
      "texto": "1. Pedir autorização e explicar o procedimento. 2. Solicitar auxiliar em sala, preferencialmente do sexo feminino. 3. ￼ 4. Lavar, secar e aquecer as mãos. 5. Garantir privacidade com biombo e orientar a paciente a se despir e vestir o avental."
     },
     {
      "id": "3.2",
      "titulo": "Exame geral",
      "texto": "* Ectoscopia: estado geral, pele, mucosas, hidratação e presença de edema (face, mãos e membros inferiores). * Sinais vitais: PA com técnica correta (sentada, após repouso), FC, FR, saturação de O2 e temperatura. * Antropometria: peso, altura, IMC e ganho de peso na gestação. * Exame segmentar: aparelho respiratório, cardiovascular e abdome."
     },
     {
      "id": "3.3",
      "titulo": "Exame obstétrico",
      "texto": "1. Medida da altura uterina com fita métrica, da borda superior da sínfise púbica ao fundo uterino, comparando com a curva da caderneta. 2. Manobras de Leopold, nos quatro tempos: * 1º tempo: delimitar o fundo uterino e definir a situação (longitudinal, transversa ou oblíqua). * 2º tempo: deslizar as mãos pelas laterais do abdome para localizar o dorso fetal e definir a posição. * 3º tempo: palpar o polo que se apresenta com movimentos laterais e definir a apresentação (cefálica, pélvica ou córmica). * 4º tempo: de costas para a paciente, com as duas mãos nas fossas ilíacas, avaliar a insinuação. 3. Ausculta dos batimentos cardiofetais com sonar ou Pinard, informando a frequência (normal ent"
     },
     {
      "id": "3.4",
      "titulo": "Exame ginecológico na gestante",
      "texto": "* Inspeção vulvar. * Exame especular quando indicado: avalia sangramento, líquido amniótico e lesões do colo. * Toque vaginal bimanual: dilatação, apagamento, consistência e posição do colo, altura da apresentação e integridade das membranas. ￼ Não realize toque vaginal antes de afastar placenta prévia por ultrassonografia em sangramento do terceiro trimestre. ￼"
     }
    ]
   },
   {
    "id": "4",
    "titulo": "Exames Complementares",
    "itens": [
     {
      "id": "4.1",
      "titulo": "Rotina de pré-natal",
      "texto": "* Hemograma, tipagem sanguínea e fator Rh, Coombs indireto em gestantes Rh negativo. * Glicemia de jejum e teste oral de tolerância à glicose com 75 g entre 24 e 28 semanas. * Sorologias: HIV, VDRL, HBsAg, anti-HCV, toxoplasmose (IgG e IgM, com teste de avidez se necessário). * Urina tipo 1 e urocultura em todos os trimestres. * Testes rápidos para HIV e sífilis, repetidos no terceiro trimestre. * Pesquisa de estreptococo do grupo B (swab vaginal e retal) entre 35 e 37 semanas. * Proteinúria de fita ou de 24 horas na suspeita de pré-eclâmpsia."
     },
     {
      "id": "4.2",
      "titulo": "Imagem e vitalidade fetal",
      "texto": "* ￼ * Ultrassonografia obstétrica e transvaginal, com avaliação do colo quando indicada. * Morfológica de primeiro e de segundo trimestre. * Doppler de artérias uterinas e umbilical nas gestações de risco. * Cardiotocografia e perfil biofísico fetal na avaliação de vitalidade. Interprete e explique cada resultado para a gestante com linguagem clara. ￼"
     }
    ]
   },
   {
    "id": "5",
    "titulo": "Hipótese Diagnóstica e Diferenciais",
    "itens": [
     {
      "id": "5",
      "titulo": "Hipótese Diagnóstica e Diferenciais",
      "texto": "* Enuncie sempre com a idade gestacional: \"gestante de 34 semanas com pré-eclâmpsia com sinais de gravidade\". * Liste os diferenciais pertinentes. * Em sangramento, diferencie por trimestre e verbalize o raciocínio. ￼"
     }
    ]
   },
   {
    "id": "6",
    "titulo": "Conduta e Tratamento",
    "itens": [
     {
      "id": "6.1",
      "titulo": "Pré-natal de rotina",
      "texto": "* Suplementação: ácido fólico e sulfato ferroso conforme o protocolo. * ￼ * Vacinas: dTpa a partir de 20 semanas em cada gestação, hepatite B e influenza. * Orientações alimentares, hidratação, atividade física e sinais de alarme. * Agende o retorno conforme o calendário do pré-natal e registre tudo na caderneta."
     },
     {
      "id": "6.2",
      "titulo": "Internação e emergências",
      "texto": "* ￼ * Justifique a internação e peça o consentimento. * MOV: monitorização, oxigênio e veia, com decúbito lateral esquerdo. * Sulfato de magnésio na eclâmpsia e na pré-eclâmpsia com sinais de gravidade, monitorando reflexos, diurese e frequência respiratória. * Anti-hipertensivo de ação rápida na emergência hipertensiva (hidralazina ou nifedipino). * Corticoterapia antenatal para maturação pulmonar entre 24 e 34 semanas. * Antibioticoterapia com atenção às drogas seguras na gestação. * Avalie sempre a via e o momento do parto conforme a idade gestacional e a vitalidade fetal."
     },
     {
      "id": "6.3",
      "titulo": "Endometrite puerperal",
      "texto": "* Suspeite diante de febre, dor pélvica, loquiação fétida, subinvolução uterina e colo aberto no puerpério. * Esquema clássico: ampicilina, gentamicina e metronidazol, por via endovenosa. * Fatores de risco: cesárea, trabalho de parto prolongado, rotura prolongada de membranas, múltiplos toques, retenção de restos placentários e corioamnionite."
     },
     {
      "id": "6.4",
      "titulo": "Encaminhamentos",
      "texto": "* Pré-natal de alto risco, maternidade de referência, nutricionista, psicologia e assistência social. ￼"
     }
    ]
   },
   {
    "id": "7",
    "titulo": "Considerações Finais (CPMED)",
    "itens": [
     {
      "id": "7",
      "titulo": "Considerações Finais (CPMED)",
      "texto": "Letra Ação C Chamar acompanhante ou familiar, com o consentimento da gestante, e reforçar o direito ao acompanhante no parto. P Planejar o acompanhamento, explicar riscos e complicações, e construir o plano de parto. M Marcar retorno com data, orientar sinais de alarme e quando procurar a maternidade, e notificar quando indicado. E Extrapolar o motivo da consulta: vacinas, exames pendentes, aleitamento e planejamento familiar pós-parto. D Despedir-se e desfazer dúvidas. Verbalize que está registrando tudo na caderneta. ￼ .fa-secondary{opacity:.4}"
     }
    ]
   }
  ]
 },
 {
  "id": "esq-preventiva",
  "nome": "Medicina Preventiva (clínica ampliada e MCCP)",
  "area": "mfc",
  "etapas": [
   {
    "id": "1",
    "titulo": "Abordagem Inicial",
    "itens": [
     {
      "id": "1.1",
      "titulo": "Cumprimento e identificação",
      "texto": "\"Bom dia! Meu nome é [seu nome], sou o(a) médico(a) da unidade e vou realizar o seu atendimento hoje.\" \"O(A) senhor(a) poderia me dizer seu nome, idade, profissão, estado civil e procedência, por favor?\" * Cumprimente de forma cordial e simpática. Preventiva é a área em que a comunicação mais pontua. * Estabeleça contato visual, chame o paciente pelo nome e use linguagem acessível. * Não interrompa. Deixe o paciente terminar a fala antes de dirigir as perguntas. * Verbalize empatia: \"eu entendo o que o(a) senhor(a) está sentindo, vamos resolver isso juntos\". ￼"
     }
    ]
   },
   {
    "id": "2",
    "titulo": "Anamnese",
    "itens": [
     {
      "id": "2.1",
      "titulo": "Queixa principal",
      "texto": "\"Senhor(a) [nome], o que te trouxe aqui hoje? Qual o seu motivo de consulta?\""
     },
     {
      "id": "2.2",
      "titulo": "Caracterização da queixa (ALICIDAE)",
      "texto": "Sigla Significado A Aparecimento L Localização I Intensidade (0 a 10) C Caráter I Irradiação D Duração e frequência A / E Atenuantes e exacerbantes"
     },
     {
      "id": "2.3",
      "titulo": "Sintomas associados",
      "texto": "* Náuseas, vômitos, febre, perda de peso, astenia, hiporexia e sudorese noturna. * Alterações intestinais e urinárias, sangramentos, dispneia e tosse. * Direcione conforme a hipótese: quanto melhor a teoria, melhores as perguntas."
     },
     {
      "id": "2.4",
      "titulo": "Antecedentes epidemiológicos (obrigatórios em Preventiva)",
      "texto": "* É a primeira vez que sente isso? * Alguém em casa, no trabalho ou na escola tem os mesmos sintomas? * Teve contato com animais? Cães, gatos, roedores, capivaras, morcegos, animais silvestres ou doentes. * Foi picado por algum inseto ou mosquito? * Fez alguma viagem recente? Para onde e quando. * Como é o lugar onde mora? Água encanada, esgoto, coleta de lixo, terrenos baldios e água parada por perto. * Com quem o(a) senhor(a) mora? Quantas pessoas na casa. * Está com o cartão de vacinas em dia? Trouxe o cartão?"
     },
     {
      "id": "2.5",
      "titulo": "Antecedentes patológicos pessoais e familiares",
      "texto": "\"O(A) senhor(a) ou alguém da sua família tem alguma doença como diabetes, pressão alta, asma, tuberculose ou câncer?\" * Medicações de uso contínuo, alergias, internações e cirurgias prévias. * Direcione conforme a suspeita: se pensa em hanseníase ou tuberculose, inclua a doença no bloco de perguntas. * Avalie a necessidade de solicitar caderneta do idoso ou caderneta da pessoa com hanseníase ou tuberculose."
     },
     {
      "id": "2.6",
      "titulo": "Hábitos de vida",
      "texto": "* Alimentação, atividade física, sono, hábito intestinal, hábito urinário e atividade sexual. * Tabagismo (tempo e quantidade), etilismo (tipo, frequência e quantidade) e uso de drogas ilícitas. * Uso de equipamento de proteção individual no trabalho e exposição ocupacional."
     },
     {
      "id": "2.7",
      "titulo": "Contexto e determinantes sociais",
      "texto": "* Trabalho e renda, escolaridade, moradia, saneamento e segurança alimentar. * Rede de apoio familiar e comunitária. * Acesso a serviços de saúde e adesão aos cuidados."
     },
     {
      "id": "2.8",
      "titulo": "Encerramento da anamnese",
      "texto": "\"O(A) senhor(a) gostaria de relatar mais alguma coisa?\" ￼"
     }
    ]
   },
   {
    "id": "3",
    "titulo": "Exame Físico",
    "itens": [
     {
      "id": "3.1",
      "titulo": "Procedimentos iniciais",
      "texto": "1. Solicitar permissão e explicar o procedimento. 2. ￼ 3. Lavar, secar e aquecer as mãos, antes e depois. 4. ￼ 5. Paramentar-se conforme a estação exigir. 6. Orientar o posicionamento e manter-se à direita da maca."
     },
     {
      "id": "3.2",
      "titulo": "Avaliação física",
      "texto": "* Ectoscopia geral de pele e mucosas: estado geral, hidratação, palidez, icterícia, cianose, lesões cutâneas e extremidades. * Sinais vitais: PA, FC, FR, saturação de O2, pulso, temperatura axilar e glicemia capilar. * Antropometria: peso, altura, IMC e circunferência abdominal."
     },
     {
      "id": "3.3",
      "titulo": "Exame segmentar",
      "texto": "* Cabeça e pescoço, com oroscopia, otoscopia e palpação de tireoide e linfonodos. * Aparelho cardiovascular. * Aparelho respiratório (inspeção, palpação, percussão e ausculta). * Abdome (inspeção, ausculta, percussão e palpação), com toque retal quando indicado. * Aparelho geniturinário. * Neurológico: pupilas, Glasgow, sinais meníngeos, sensibilidade e força. * Membros e extremidades, com punho-percussão lombar. * Avaliação de sensibilidade em lesões de pele quando houver suspeita de hanseníase. ￼"
     }
    ]
   },
   {
    "id": "4",
    "titulo": "Exames Complementares",
    "itens": [
     {
      "id": "4.1",
      "titulo": "Laboratoriais",
      "texto": "* Hemograma completo, PCR, VHS. * Glicemia de jejum, hemoglobina glicada e perfil lipídico. * Ureia, creatinina, sódio, potássio, TGO e TGP. * Urina tipo 1, urocultura e parasitológico de fezes. * Sorologias: HIV, hepatite B e C, VDRL. * Testes rápidos disponíveis na atenção primária: HIV, sífilis, hepatites B e C. * Baciloscopia de escarro em duas amostras e teste rápido molecular para tuberculose. Prova tuberculínica ou IGRA na infecção latente."
     },
     {
      "id": "4.2",
      "titulo": "Imagem",
      "texto": "￼ Peça com nome e sobrenome: radiografia de tórax em posteroanterior e perfil, eletrocardiograma de 12 derivações e ultrassonografia dirigida."
     },
     {
      "id": "4.3",
      "titulo": "Rastreios por faixa etária",
      "texto": "Idade Rastreio 20 anos Perfil lipídico 25 anos Câncer de colo de útero (Papanicolau, até 64 anos) 35 anos Câncer de mama em alto risco e diabetes 45 anos Diabetes 50 anos Câncer de mama (mamografia até 69 anos) e de cólon (sangue oculto até 75 anos) 55 anos Câncer de pulmão em grande carga tabágica 65 anos, homem Aneurisma de aorta abdominal em tabagistas 65 anos, mulher Osteoporose ￼ Atenção às tarefas que pedem \"diagnóstico clínico-epidemiológico\": nesses casos não é necessário solicitar exames, e pedir uma bateria consome tempo e pode custar ponto. ￼"
     }
    ]
   },
   {
    "id": "5",
    "titulo": "Hipótese Diagnóstica e Diferenciais",
    "itens": [
     {
      "id": "5",
      "titulo": "Hipótese Diagnóstica e Diferenciais",
      "texto": "* Comunique com linguagem acessível e verifique se o paciente entendeu. * Liste os diagnósticos diferenciais. * ￼ * Sempre explique agente causal, modo de transmissão, período de incubação e formas de prevenção. ￼"
     }
    ]
   },
   {
    "id": "6",
    "titulo": "Conduta e Tratamento",
    "itens": [
     {
      "id": "6.1",
      "titulo": "Ambulatorial",
      "texto": "* Não farmacológico: alimentação, atividade física, sono, cessação do tabagismo, redução do álcool, manejo do estresse e apoio psicossocial. * Farmacológico: nome, dose, via, posologia, tempo de uso e efeitos adversos. Confirme a compreensão. * Medidas ambientais e coletivas: controle de vetores, eliminação de criadouros, uso de mosquiteiro e repelente, cuidados com água e alimentos. * Tratamento supervisionado quando indicado (tuberculose e hanseníase)."
     },
     {
      "id": "6.2",
      "titulo": "Internação ou encaminhamento",
      "texto": "* ￼ * Justifique a decisão e explique o motivo ao paciente. * MOVG: monitorização, oxigênio, veia e glicemia capilar nos casos graves. * Encaminhe a unidade de maior complexidade quando houver sinais de gravidade."
     },
     {
      "id": "6.3",
      "titulo": "Você não é uma ilha: acione a rede",
      "texto": "* Agente comunitário de saúde para visita domiciliar, busca ativa e monitoramento. * Agente de combate a endemias para controle de vetores e reservatórios. * Equipe multiprofissional: enfermeiro, psicólogo, nutricionista, educador físico, fisioterapeuta e assistente social. * NASF, CAPS, CAPS-AD, CRAS, CREAS, CEREST e grupos de apoio. ￼"
     }
    ]
   },
   {
    "id": "7",
    "titulo": "Notificação",
    "itens": [
     {
      "id": "7",
      "titulo": "Notificação",
      "texto": "Órgão ou profissional Quando acionar SINAN Preenchimento obrigatório em agravos de notificação compulsória Vigilância Epidemiológica Dengue, sífilis, tuberculose, hanseníase, meningite, covid-19 e outras Vigilância Sanitária Risco sanitário coletivo: água imprópria, alimentos contaminados, ambiente insalubre Conselho Tutelar Violação de direitos de crianças e adolescentes: negligência, maus-tratos, abuso, evasão escolar CRAS e CREAS Vulnerabilidade social, abandono, violência familiar, idoso negligenciado CAT Acidente de trabalho ou doença ocupacional Agente de endemias Dengue, zika, chikungunya, leishmaniose, malária, doença de Chagas CAPS e psiquiatria da rede Transtornos moderados a grave"
     }
    ]
   },
   {
    "id": "8",
    "titulo": "Considerações Finais (CPMED)",
    "itens": [
     {
      "id": "8",
      "titulo": "Considerações Finais (CPMED)",
      "texto": "Letra Ação C Chamar acompanhante ou familiar para explicar o quadro e fazer busca ativa de contactantes. P Planejar o acompanhamento longitudinal e esclarecer riscos e complicações. M Marcar retorno programado, orientar sinais de alarme e notificar o caso. E Extrapolar o motivo da consulta: atualizar cartão de vacinas, rastreios e orientar prevenção. D Despedir-se com cordialidade e verificar se restam dúvidas."
     }
    ]
   }
  ]
 }
];
