# Manual do Investidor e Plano de Negócios — Revalida Prático

> **Leia antes.** Este documento mistura **fatos verificados** (marcados com fonte e data de consulta: 30/10/2026), **fatos do produto** (conferidos no código e nos testes) e **hipóteses** (marcadas como *[HIPÓTESE]*). Não há cliente pagante, piloto nem receita comprovados. Nada aqui é promessa de retorno nem recomendação de investimento; as projeções são exercícios de sensibilidade para discussão e devem ser substituídas por dados de piloto.

---

## 1. Resumo executivo

**O que é.** Plataforma de treino da **2ª fase prática do Revalida INEP**: salas de treino com vídeo, estações clínicas com checklist (PEP), transcrição e análise da fala do candidato, estudo com cartões de repetição espaçada, mapa de temas e um **apoio cognitivo** que desenha, ao vivo, o grafo da conduta (2D/3D).

**Para quem.** Médicos formados no exterior que se preparam para validar o diploma no Brasil (candidatos), cursos preparatórios e instituições (licenciamento), e avaliadores/preceptores.

**Por quê agora.** A demanda do exame cresceu: de 10.048 inscritos (2024/1) para **21.568 (2025/2)**; a edição 2025/1 teve 4.365 aprovados na 2ª etapa e a 2025/2 já tinha 8.000 aprovados na 1ª etapa (fonte secundária, ver §4).

**Diferencial do produto (verificável no código).** Simulação completa da estação com avaliador humano **e** conferência objetiva pela fala; análise pós-estação que alimenta cartões, trilha e nova estação; criação/importação de estações sem duplicidade; operação em computador, celular e relógio.

**Maturidade.** Produto funcional em ambiente de desenvolvimento, com ~150 testes de servidor, 23 do front e 12 suítes em navegador. **Ainda não validado** com usuários reais, vídeo ao vivo, IA real nem carga. Próximo passo crítico: **piloto fechado** com 30–50 candidatos e 1–2 cursos parceiros.

**Conclusão honesta da modelagem.** Só com assinaturas individuais a R$ 99/mês *[HIPÓTESE]*, o negócio paga a infraestrutura em cenário base, mas **não sustenta uma equipe** sem **receita B2B (licenças a cursos/instituições)** e/ou ticket maior. O plano abaixo trata o B2B como o caminho principal de escala.

---

## 2. Problema

1. O Revalida prático exige **treino de comunicação e conduta cronometrada**, difícil de fazer sozinho.
2. Candidatos dependem de grupos informais e de colegas para simular estações; faltam avaliador, checklist e feedback objetivo.
3. O feedback tradicional é subjetivo e não rastreia **o que foi dito** versus **o que o PEP exige**.
4. Material de estudo é disperso: sem ligação entre erro na estação, tema e revisão.

## 3. Solução e produto

| Capacidade | O que entrega | Estado |
|---|---|---|
| Salas com vídeo | Candidato, avaliador/ator, observadores; cronômetro; áudio de observador bloqueado por padrão | Implementado; vídeo ao vivo **não testado** com Agora real |
| Estações e ciclos | Biblioteca, criação manual/IA/arquivo, catálogo INEP (426 itens) e 168 temas por prova, sem duplicidade | Implementado e testado |
| Checklist (PEP) | Marcação pelo avaliador; nota calculada no servidor; revisão de nota | Implementado e testado |
| Transcrição e análise | Fala do candidato × PEP, sugestões com trecho-evidência, análise final, liberação ao candidato | Implementado; IA **real** não testada |
| Estudo | Trilha por tema, cartões SM-2 aprofundados, mapa 3D, caderno de erros, diretrizes | Implementado e testado |
| Apoio cognitivo | Grafo ao vivo achados→hipótese→trilha→ramificação, em 2D e 3D; o chefe pode desligar | Implementado e testado em navegador |
| Multiplataforma | Web, celular (WebView), desktop (Electron), relógio (PWA) | Web e relógio testados em navegador; Electron/Expo **não executados** |
| Administração | Instalador, root, tokens, auditoria, recuperação de senha | Implementado e testado |

**Barreiras de entrada reais:** (i) fluxo de avaliação ligado à nota e à fala; (ii) base de estações/temas e vínculo com estudo; (iii) curadoria clínica (a construir). Barreiras **fracas**: tecnologia isolada é replicável; a vantagem precisa vir de conteúdo, comunidade e parcerias.

---

## 4. Mercado

### 4.1 Fatos públicos consultados
Série histórica do Revalida INEP (compilada por portal de preparação; fonte secundária, dados do Painel Revalida INEP atualizados em 26/02/2026):

| Edição | Inscritos | Aprovados 1ª etapa | Aprovados 2ª etapa |
|---|---|---|---|
| 2020 | 15.499 | 2.396 | 1.098 |
| 2021 | 13.641 | 6.002 | 3.911 |
| 2022/1 | 7.960 | 619 | 2.187 |
| 2022/2 | 7.515 | 885 | 266 |
| 2023/1 | 9.900 | 1.225 | 1.220 |
| 2023/2 | 9.273 | 1.069 | 168 |
| 2024/1 | 10.048 | 2.549 | 1.937 |
| 2024/2 | 10.822 | 2.509 | 737 |
| 2025/1 | 17.121 | 4.503 | 4.365 |
| 2025/2 | 21.568 | 8.000 | *(em andamento na fonte)* |

- Na edição 2025/1: 15.952 presentes na 1ª etapa e 7.292 na 2ª (mesma fonte).
- O Inep publicou a lista final da 2025/2 com **5.666 habilitados** (Portaria nº 493/2026, 10–11/09/2026; Agência Brasil).
- Edital 2026/2: taxa de inscrição **R$ 410**; 1ª etapa em 13/09/2026 (fonte: portal de preparação, resumindo o edital).
- A fonte da série tem **inconsistências internas** (ex.: 2022/1 com mais aprovados na 2ª que na 1ª, explicado por candidatos reaproveitados). Use a série como **ordem de grandeza**, e confirme no Painel Revalida/edital oficial antes de usar em captação.
- **Não encontrei** (acessível) a estrutura oficial da prova prática (número de estações e tempos) nem a data da 2ª etapa 2026/2; consulte o edital.

### 4.2 Dimensionamento *[HIPÓTESE]*
- **TAM** (candidatos inscritos/ano): ~2 edições × ~10–21 mil ≈ **20–40 mil inscrições/ano**.
- **SAM** (quem chega à etapa prática): aprovados na 1ª etapa por edição. Média de 2025/1 e 2025/2 = **6.252** por edição → ~12.500/ano.
- **SOM** (penetração realista de um produto novo): 1–6 % do SAM no horizonte de 3 anos (≈ 125–750 assinaturas/ano). Premissas, não dados.
- A janela de uso é curta (≈ 3 meses entre a 1ª e a 2ª etapa) *[HIPÓTESE]*, o que favorece **campanhas por edição** e pacotes.

### 4.3 Concorrência (categorias, sem dados de preço verificados)
- **Cursos preparatórios** com aulas e simulados (portais de preparação aparecem nas buscas do tema); fortes em marca e conteúdo, geralmente sem simulador de estação com checklist e fala.
- **Grupos informais** de treino entre candidatos: gratuito, sem estrutura nem métrica.
- **Plataformas de simulação clínica** genéricas: não focadas no formato Revalida.
- **Oportunidade:** ser a **camada de prática e feedback** que cursos podem licenciar, em vez de competir com o conteúdo teórico deles.

---

## 5. Modelo de negócio *[HIPÓTESES de preço]*

| Fonte | Modelo | Preço de partida *[HIPÓTESE]* |
|---|---|---|
| B2C | Assinatura mensal do candidato (acesso a salas, estudo, análise) | R$ 99/mês (média de 3 meses por coorte = R$ 297) |
| B2C | Pacotes por edição ("Revalida 2026/2") | R$ 249–349 |
| B2B | Licença para curso/instituição (N candidatos, marca própria, relatórios de turma) | R$ 2.500/mês por instituição |
| Serviços | Avaliadores profissionais (hora de feedback humano) | repasse + margem |
| Dados agregados | Relatórios de desempenho por tema (sem identificar pessoas) | a validar |

**Princípios:** transparência de IA (o avaliador decide a nota), consentimento explícito para transcrição, conteúdo não oficial declarado.

---

## 6. Projeção financeira (sensibilidade)

**Premissas [HIPÓTESES]:** SAM = 6.252 aprovados na 1ª etapa por edição; 2 edições/ano; ticket R$ 99/mês × 3 meses = **R$ 297 por assinatura**; custo variável (vídeo + IA + transcrição) **R$ 25 por assinante/mês** = R$ 75 por assinatura; margem de contribuição **R$ 222 por assinatura**; custo fixo sem pessoal (infra, suporte, ferramentas, contábil) **R$ 6.000/mês = R$ 72.000/ano**; pessoal ilustrativo **R$ 15.000/mês = R$ 180.000/ano**.

### 6.1 Só B2C — assinaturas por ano e resultado

| Cenário | Ano | Penetração do SAM | Assinaturas | Receita | Contribuição | Resultado sem pessoal | Resultado com pessoal |
|---|---|---|---|---|---|---|---|
| Conservador | 1 | 1 % | 125 | R$ 37.125 | R$ 27.750 | −R$ 44.250 | −R$ 224.250 |
| | 2 | 2 % | 250 | R$ 74.250 | R$ 55.500 | −R$ 16.500 | −R$ 196.500 |
| | 3 | 3 % | 375 | R$ 111.375 | R$ 83.250 | R$ 11.250 | −R$ 168.750 |
| Base | 1 | 2 % | 250 | R$ 74.250 | R$ 55.500 | −R$ 16.500 | −R$ 196.500 |
| | 2 | 4 % | 500 | R$ 148.500 | R$ 111.000 | R$ 39.000 | −R$ 141.000 |
| | 3 | 6 % | 750 | R$ 222.750 | R$ 166.500 | R$ 94.500 | −R$ 85.500 |
| Otimista | 1 | 4 % | 500 | R$ 148.500 | R$ 111.000 | R$ 39.000 | −R$ 141.000 |
| | 2 | 8 % | 1.000 | R$ 297.000 | R$ 222.000 | R$ 150.000 | −R$ 30.000 |
| | 3 | 12 % | 1.500 | R$ 445.500 | R$ 333.000 | R$ 261.000 | R$ 81.000 |

**Ponto de equilíbrio:** 325 assinaturas/ano cobrem custos fixos sem pessoal; **1.136 assinaturas/ano (≈ 9 % do SAM)** cobrem também a equipe ilustrativa.

**Leitura:** B2C puro, a R$ 99/mês, é um negócio **pequeno**; vale como **porta de entrada, vitrine e fonte de dados de uso**, não como única receita.

### 6.2 Adicionando B2B *[HIPÓTESE]*
Cada licença institucional a R$ 2.500/mês = **R$ 30.000/ano** (margem de contribuição maior, pois o custo variável é menor por candidato quando a instituição fornece avaliadores).

| Licenças ativas | Receita B2B/ano |
|---|---|
| 5 | R$ 150.000 |
| 10 | R$ 300.000 |
| 20 | R$ 600.000 |

Com 10 licenças + cenário B2C base (ano 3), a receita somada seria ≈ R$ 522.750 (R$ 300.000 + R$ 222.750), suficiente para discutir equipe enxuta. **Validar** com 3–5 conversas de venda antes de assumir.

### 6.3 Custos *[HIPÓTESES — substituir por cotações reais]*
- Infraestrutura (servidor + Postgres + backup + domínio/HTTPS).
- **Vídeo** (Agora cobra por minuto de uso; **preço não verificado aqui**).
- **IA** (tokens por geração de estação/cartões/análise; depende do provedor; há limite por usuário no produto).
- Suporte, conteúdo (curadoria clínica), jurídico/LGPD, contabilidade.

---

## 7. Go-to-market

1. **Piloto fechado (0–3 meses):** 30–50 candidatos da próxima edição + 1–2 cursos parceiros; metas: ≥ 60 % concluem 3 estações; NPS ≥ 40; custo variável real/assinante; 5 depoimentos autorizados.
2. **Edição-alvo (3–6 meses):** pacote "Revalida 2026/2/2027/1" com preço fechado, calendário de salas e avaliadores.
3. **B2B (3–12 meses):** licenciar a camada de prática para cursos (relatórios por turma, marca própria).
4. **Canais:** comunidades de médicos formados no exterior, cursos parceiros, indicação, conteúdo gratuito (estação demo), parcerias com associações.
5. **Retenção:** trilha + cartões levam o candidato de uma edição a outra (reaproveitamento após reprovação — o histórico mostra candidatos que tentam mais de uma vez).

## 8. Métricas-chave
Ativação (primeira estação concluída em 7 dias), estações por candidato, % com transcrição consentida, divergência fala×marcação (qualidade da IA), cartões revisados/semana, conversão pilot→pago, CAC, churn pós-edição, custo variável por assinatura, tempo de fila para encontrar avaliador.

## 9. Roadmap (proposta)
- **0–3 m:** validação com pacotes reais e Docker em staging; vídeo Agora real; IA real; piloto; política de privacidade e termo de consentimento.
- **3–6 m:** curadoria clínica das estações e protocolos do apoio cognitivo por especialistas; painel de turma (B2B); exportação de relatórios.
- **6–12 m:** pagamentos e planos; adaptador Socket.IO (escala horizontal); métricas e alertas; apps nativos publicados.
- **12 m+:** banco de avaliadores; relatórios por tema para instituições; outros exames práticos.

## 10. Riscos e mitigação

| Risco | Impacto | Mitigação |
|---|---|---|
| **Propriedade intelectual / uso de materiais do INEP** (catálogo e importação) | Alto | Revisão jurídica; usar apenas conteúdo próprio, licenciado ou de uso permitido; rotular como material não oficial |
| **LGPD** (voz, desempenho, vídeo) | Alto | Consentimento explícito, retenção curta, DPO, contratos com operadores |
| Erro clínico em conteúdo/IA | Alto | Curadoria por especialistas, avisos, decisão final do avaliador, validação de saída |
| Dependência de terceiros (Agora, IA) | Médio | Failsafe e modo demo já existem; contratos e plano B |
| Sazonalidade (2 picos por ano) | Médio | Pacotes por edição, B2B anual, produtos de estudo contínuo |
| Mercado pequeno e concentrado | Médio | B2B, outros exames, internacionalização |
| Replicação por concorrentes | Médio | Conteúdo, comunidade, parcerias, dados de uso |
| Maturidade técnica (não validada em produção) | Médio | Smoke test, staging, piloto, testes de carga |
| Marca/alegações (promessa de aprovação) | Alto | Nunca prometer aprovação; comunicar como ferramenta de treino |

## 11. Equipe e necessidades *[a preencher pelos fundadores]*
Fundadores/responsáveis, histórico, dedicação. Funções-chave a contratar: **coordenação clínica** (curadoria e avaliadores), **produto/engenharia**, **comercial B2B**, **jurídico/LGPD** (consultoria).

## 12. Uso de recursos *[estrutura; valores a definir com base no piloto]*
Sugestão de alocação: engenharia e infraestrutura (validação e escala), curadoria clínica, aquisição B2B, jurídico/privacidade, reserva. **Não há valor de captação definido neste documento.**

## 13. Due diligence — o que o investidor pode verificar hoje
- Código e testes executáveis (`npm test`, e2e) e a visualização do produto.
- Manuais técnico e do desenvolvedor; modelo de dados; 122 rotas documentadas.
- O que **não** pode ser verificado ainda: tração, receita, qualidade da IA em produção, desempenho sob carga, vídeo ao vivo, apps nativos.

## 14. Fontes consultadas (30/10/2026)
- Série histórica e dados do Painel Revalida (portal de preparação): https://med.estrategia.com/portal/revalida/aprovados-no-revalida-inep-confira-os-dados/
- Lista final 2025/2 (Agência Brasil): https://agenciabrasil.ebc.com.br/educacao/noticia/2026-09/inep-divulga-relacao-final-dos-aprovados-no-revalida-20252
- Edital 1ª etapa 2026/2 (resumo): https://portal.estrategia.com/medicina/revalida/revalida-inep-2026-2-edital-da-1a-etapa-divulgado/
- Inep — notícias do Revalida: https://www.gov.br/inep/pt-br/centrais-de-conteudo/noticias/revalida

*Premissas financeiras: calculadas por script a partir dos valores declarados em §6; altere-as e recalcule antes de qualquer uso externo.*
