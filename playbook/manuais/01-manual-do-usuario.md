# Manual do Usuário — Revalida Prático

Para candidatos, avaliadores/atores, observadores, moderadores e administradores.
Versão do documento: 1.0 · Sistema: Revalida Prático (2ª fase prática do Revalida INEP — treino).

> **Aviso importante.** O Revalida Prático é uma ferramenta de **treino**. Não é afiliado ao INEP, não reproduz o exame oficial e não garante aprovação. Os checklists (PEP) das estações cadastradas são materiais de estudo; confira sempre as diretrizes vigentes e o edital da edição.

---

## 1. O que é e para quem serve

O Revalida Prático simula as **estações práticas** do Revalida: você atende um "paciente" (um colega ou ator), cumpre uma tarefa em tempo marcado e é avaliado por um **checklist (PEP)** marcado por um avaliador. O sistema reúne:

- **Salas de treino com vídeo** (câmera e microfone), cronômetro e checklist;
- **Ciclos**: sequências de estações (como um circuito de prova);
- **Estações**: biblioteca, criação, importação e catálogo de temas já cobrados;
- **Estudo**: trilha por tema, cartões de revisão (repetição espaçada), mapa 3D de temas, caderno de erros;
- **Análise da estação** com a sua fala transcrita, comparada ao checklist;
- **Apoio cognitivo**: um grafo da conduta (2D/3D) que acompanha o que você diz.

### Quem faz o quê

| Papel | O que faz |
|---|---|
| **Candidato** (na sala) | Atende a estação, vê a descrição e o cenário, pede exames, recebe a análise no fim. Não vê o checklist durante a estação. |
| **Avaliador/ator** (na sala) | Interpreta o paciente, libera exames quando pedidos e marca o checklist. |
| **Chefe da sala (admin da sala)** | Cria a sala, monta o ciclo, convida pessoas, escolhe quem é candidato, liga/desliga opções. |
| **Observador** | Assiste; só ouve/fala se o chefe liberar o áudio. |
| **Moderador** (do sistema) | Revisa estações enviadas por usuários. |
| **Administrador / Root** | Gerencia usuários, tokens, auditoria e (root) a instalação. |

---

## 2. Primeiro acesso

1. Abra o endereço do seu servidor (por exemplo `https://treino.suaescola.com`).
2. **Entrar**: e-mail e senha. Se ainda não tem conta, peça acesso (o administrador aprova e envia um token de uso único) ou use um convite.
3. **Esqueci minha senha**: o sistema envia um link válido por 60 minutos, de uso único. Ao redefinir, as outras sessões são encerradas.
4. **Conta → trocar senha**: exige a senha atual.
5. Em computador o menu fica à esquerda; no celular, embaixo. O menu pode ser recolhido.

**Câmera e microfone** só funcionam em endereço seguro (**https**). Se o navegador pedir permissão, clique em *Permitir*.

---

## 3. Início (painel visual)

O Início mostra, em quadros: estações sugeridas pelo seu desempenho, estações já feitas (com botão **Ver análise**), salas ativas e atalhos. Em uma sala por link ou código, use o cartão da sala para voltar a ela.

---

## 4. Salas

### 4.0 Salas abertas (sem dono)
- A tela **Salas** lista as salas abertas (nome, pessoas, chefe, candidato, se há estação). Qualquer pessoa entra pela lista; **ninguém é dono**: chefe é só uma função.
- Ao criar, dê um **nome** e o prazo para **desfazer a sala se ficar vazia** (6 h a 30 dias; padrão 24 h). O chefe muda nome e prazo depois em *Nome e prazo da sala*. Os **ciclos** são criados depois, já dentro da sala.
- Quem sai pode voltar (mesmo fechando o app): a sala segue com tudo. Se o **chefe ou o candidato** sair durante uma estação, ela **pausa na hora** e **segue sozinha** quando os dois estiverem conectados; o tempo parado não conta no relógio.
- Se o chefe sumir (e não houver estação à espera dele), um participante pode **assumir a chefia**.
- **Chat** da sala para todos. O **candidato em estação vê só a estação** (vídeo, relógio, cartas, fala, apoio): gestão, chat e fila ficam ocultos.
- **Inverter papéis** ao fim da estação: pode o chefe ou o candidato atual; depois da troca o botão passa a quem ficou como candidato.
- **Câmera e microfone**: um botão para cada. Depois de inverter ou trocar o chefe/avaliador, o sistema confere **uma vez** se o navegador permite ligá-los. Se estiverem desconectados, quem é chefe, avaliador ou candidato vê um botão discreto **Solucionar problemas** com o que fazer.

### 4.1 Criar e entrar
- **Criar sala**: você vira o **chefe**. O código da sala aparece no alto; clique nele para copiar.
- **Entrar**: cole o código (ou use o link/convite). Você entra como observador e pode **pedir para ser candidato** ou chefe; o chefe aceita ou recusa em *Pedidos*.
- **Convidar pessoas online**: o chefe pode convidar usuários cadastrados; convites podem ser cancelados.

### 4.2 Barra de ferramentas da sala
Fica **fixa no topo** e não rola com o conteúdo. Ícones: Vídeo, Câmera, Mic, Pessoas, Convidar, Pedidos, Estação, Fala, Apoio, Checklist, Resultado, Fila e Código. Você pode **reordenar arrastando** (ou segurar Alt e usar as setas); a ordem fica guardada e o layout se adapta ao redimensionar a janela. O botão ↺ restaura a ordem original.

### 4.3 Vídeo e áudio
- O vídeo conecta ao entrar na sala. Candidato e avaliador abrem câmera e microfone automaticamente.
- **Observadores** podem abrir a câmera, mas o **microfone fica bloqueado** até o chefe liberar ("Liberar áudio dos observadores").
- O chefe pode pausar o vídeo de um participante.

### 4.4 Montar o ciclo
O chefe escolhe estações (da biblioteca ou por sorteio por área/nível), na ordem desejada. Há níveis de treino e **blocos mistos** (estações de áreas diferentes). Se uma estação já está na fila, o sistema avisa e só repete se você confirmar.

---

## 5. Fazer uma estação

1. O chefe **inicia** a estação. O cronômetro começa.
2. **Candidato** vê: descrição da estação e cenário (com texto formatado em títulos, listas e medidas em destaque) e, conforme pede, os **exames e materiais** que o avaliador liberar.
3. **Avaliador** vê as cartas organizadas por tipo (laboratório, imagem, laudo…), o que já foi liberado e um aviso quando o pedido é detectado na fala do candidato. Libera ao candidato com um clique.
4. **Transcrição**: se você é candidato, aparece "Iniciar transcrição" (pede o microfone uma vez). Só **a sua voz** é transcrita, apenas durante a estação.
5. **Checklist (avaliador)**: marca cada item como *sim*, *parcial* ou *não*. O sistema pode sugerir marcações pela fala do candidato, com o trecho como evidência; **a decisão e a nota são do avaliador**.
6. **Finalizar**: a nota é calculada no servidor e o resultado aparece para todos.

### 5.1 Apoio cognitivo (candidato) — opcional
Na estação aparece "Abrir apoio cognitivo" (e o ícone **Apoio** na barra). Abre um **quadro móvel e redimensionável** com um grafo da conduta montado ao vivo:

- **Achados → hipóteses**: o que você falou (e anotou) vira nós; a hipótese mais provável é destacada.
- **Trilha esperada × realizada**: etapas gerais de uma estação (apresentação, anamnese, exame físico, hipótese, exames, conduta, comunicação, desfecho). Os itens que você já disse ficam verdes, numerados na ordem em que foram ditos; os que ficaram para trás aparecem como omitidos.
- **Ramificação da conduta**: ramos indicados, condicionais ou descartados (com o motivo).
- **Converter para 3D**: o mesmo grafo em 3D. Arraste para girar, use a roda para zoom, setas ← → para girar pelo teclado.
- **Anotações**: escreva o que o paciente informou (PA, FC, achados) para o grafo considerar.
- Mover: arraste o cabeçalho (ou Alt + setas). Redimensionar: canto inferior direito. No celular vira uma folha na parte de baixo.

O apoio **não mostra o checklist da estação, não altera a nota e é só um auxílio de raciocínio**. O chefe da sala pode **desligar** o apoio para simular a prova sem ajuda.

---

## 6. Depois da estação: Ver análise

Em **Início → estações feitas → Ver análise** (ou ao fim da estação):

- **Índice de quadros resumidos**: Resultado, Resumo de desempenho, Seções, Comparação, Itens × fala, Transcrição e Revisar e praticar.
- Clique em um quadro do índice para abri-lo. Quadros abertos podem ser **movidos** (arrastando o cabeçalho), **minimizados** (–) e fechados (✕).
- **Ver em sequência**: a chave "Ver o conteúdo em sequência" empilha todos os quadros, um abaixo do outro; desligada, volta ao formato compacto. A escolha fica guardada.
- **Transcrição**: o texto da sua fala só aparece depois que o **avaliador liberar**. Antes disso você já vê acertos, lacunas e feedback.
- **Itens × fala**: marque os pontos que quer trabalhar. Eles viram **cartões de revisão**, trilha e uma **nova estação** com outra abordagem.
- **Revisar e praticar**: cartões do checklist, cartões por IA (que **aprofundam** os pontos escolhidos), "Praticar de novo" e "Gerar nova estação".
- O avaliador pode **revisar a nota** com base na fala; a nota original fica registrada.

---

## 7. Estações (criar, importar, catálogo)

A aba **Estações** reúne tudo, sem redundância:

| Aba | Função |
|---|---|
| **Disponíveis** | Estações aprovadas para praticar (filtros por área e dificuldade). |
| **Minhas** | Suas estações (rascunho, em revisão, aprovada). Exportar selecionadas (`.rvpack`), **Excluir** (com confirmação). |
| **Catálogo INEP** | Temas e estações-modelo já cobrados em provas, por ano. |
| **Temas por ano** | Lista de temas; clicar abre um **quadro móvel explicativo** do tema. |
| **Em revisão** | (moderadores) estações aguardando aprovação. |

**Criar**: Nova (manual), **Gerar com IA** (por área, subtema e dificuldade), **Importar** (PDF/imagem ou pacote `.rvpack`). Tudo que vem de IA ou arquivo entra como **rascunho** e só vira estação após a sua revisão. Campos incertos ficam marcados "a conferir".

**Duplicidade**: o sistema impede estações com **conteúdo idêntico** e título repetido. Se a estação já existe, avisa e pergunta se você quer **praticar a existente** ou, no caso de título igual, usar outro título.

**Excluir**: o dono pode excluir suas estações em qualquer status. Estação já usada em sala ou ciclo não é apagada (mensagem "em uso"); devolva-a a rascunho para tirá-la de circulação.

---

## 8. Estudo

- **Trilha**: temas ordenados por desempenho (fracos primeiro ou fortes). Clique no nome do tema para abrir o **quadro explicativo móvel**; use **Cartões** para estudar ou **Criar card do argumento** para gerar cartões aprofundados do tema.
- **Cartões**: repetição espaçada (algoritmo SM-2). Responda e avalie de 0 a 5; o sistema agenda a próxima revisão.
- **Biblioteca de revisão**: cartões da estação, pendentes × executados.
- **Mapa 3D**: cada ponto é um tema; a cor mostra o desempenho. Arraste para girar; "Ver como lista" para navegar por teclado.
- **Caderno de erros**: lacunas por categoria e por estação.
- **Guia de treino**: níveis (estação guiada, cronometrada, bloco misto), roteiro universal e semana de estudo.
- **Diretrizes**: referências cadastradas pela moderação/administração, usadas como contexto da IA.

O **quadro explicativo do tema** mostra contexto (anos em prova, desempenho, cartões), resumo, diretrizes, temas relacionados e botões para criar cards e praticar.

---

## 9. Conta e privacidade

- **Trocar senha**, **sair**, tamanho do texto e contraste (quando disponíveis).
- **Transcrição**: só sua voz, só durante a estação, com o seu aceite. Você pode parar a qualquer momento. A leitura posterior depende da liberação do avaliador.
- Dados de casos e preferências visuais ficam no servidor (conta) e no navegador (preferências, como a ordem das ferramentas).

---

## 10. Moderadores, administradores e root

- **Moderador**: aba *Em revisão* — aprova ou devolve estações. Estações incompletas (sem PEP) não podem ser publicadas.
- **Administrador**: pedidos de acesso (aprovar gera token de 1 uso preso ao e-mail), tokens, bloquear/desbloquear usuários, gerar link de senha, registro de auditoria.
- **Root**: tudo acima, papéis de admin/moderador, **Sistema** (reinstalar ou limpar o banco, com senha e frase de confirmação) e parâmetros do servidor (e-mail, vídeo, IA).
- Toda ação administrativa fica na **auditoria**.

---

## 11. Versões para outros aparelhos

- **Computador**: o mesmo app web, layout de duas colunas (≥ 900 px).
- **Celular**: layout em coluna única; app para Android/iOS (WebView) apontando para o seu servidor.
- **Relógio**: versão mini em `/watch/` com cronômetro, vibração e controles (iniciar/pausar) para avaliador e chefe. Não tem checklist nem vídeo.
- **Desktop (Electron)**: app instalável que abre o seu servidor.
- Um ícone discreto de **relógio de bolso** abre a versão mini com a sessão aberta (no computador).

---

## 12. Perguntas frequentes

**A câmera não abre.** Verifique se o endereço é https e se o navegador tem permissão. Em Chrome/Edge, clique no cadeado do endereço.

**A transcrição não inicia.** O navegador precisa de reconhecimento de voz (Chrome/Edge) ou gravação de microfone. Se a permissão foi negada, libere nas configurações do site.

**Por que não vejo a transcrição depois da estação?** O avaliador precisa liberá-la (Início → análise → "Liberar transcrição").

**Por que o apoio cognitivo não aparece?** Só o candidato o vê, durante a estação, e o chefe da sala pode tê-lo desligado.

**Não consigo excluir uma estação.** Ela já foi usada em sala ou ciclo. Devolva-a a rascunho.

**O grafo não mostra hipótese.** Ele precisa de achados na fala ou nas anotações (por exemplo: "colisão de moto, hipotensão, murmúrio vesicular abolido").

**Esqueci minha senha.** Use "Esqueci minha senha"; se for o root, veja o Guia de Instalação (seção de recuperação).

---

## 13. Boas práticas de treino

1. Comece por estações **guiadas**, depois **cronometradas**, depois **blocos mistos**.
2. Verbalize: apresente-se, confirme identificação, explique o que fará, cite **dose, via e prazo**.
3. Peça os exames em voz alta (o avaliador libera conforme o pedido).
4. Ao fim, trabalhe os pontos **parciais e omitidos** (cartões + nova estação).
5. Refaça a mesma estação depois de alguns dias para confirmar a consolidação.

## 14. Trilha guiada, ciclo randômico e chamado à comunidade

**Ao entrar** o app pergunta de forma simples: **trilha guiada** ou **plataforma**.

- **Trilha guiada:** na primeira vez você só diz **quanto tempo tem por dia** para praticar e, se quiser, **em quais dias** (sem escolher, valem todos). Em outra sessão o app pergunta de novo: seguir a trilha ou ir à plataforma. Seguindo, a trilha **recupera o que você configurou** e entra na fila randômica com o tempo que **ainda falta hoje**; a sala abre direto com o ciclo pronto, com um parceiro sorteado entre as pessoas disponíveis, e vai de uma estação à outra em sequência até preencher o seu tempo.
- **Ciclo randômico:** você fica "disponível". Quando há alguém, a **plataforma sorteia a estação e as funções** (quem avalia e quem é o candidato). Depois da estação 1×1, **os papéis se invertem** e a mesma estação roda de novo; ao fim das duas voltas passa-se à próxima, com novo sorteio.
- **Chamado à comunidade:** você abre um chamado público (pode pedir área ou estações específicas). **Qualquer usuário** pode incluir você na **sala aberta dele** ou **iniciar direto um ciclo** com as estações do chamado.
- **Plataforma:** o app de sempre (Início, Ciclos, Estações, Estudo, Comunidade, Desempenho).

## 15. Bloquear e denunciar

- **Bloquear** faz as duas pessoas **sumirem uma para a outra** (listas, convites, salas, chamados e fila), nos dois sentidos. Quem foi bloqueado não é avisado.
- **Denunciar** faz o mesmo e ainda **notifica a pessoa denunciada e o administrador**. Ela vê o motivo e o relato (não vê quem denunciou) e **tem direito de resposta**.
- **Padrão:** só os dois deixam de se relacionar. Se a situação **não for resolvida** e o administrador decidir, a conta denunciada pode ser **suspensa por 7 dias** (renovável por nova decisão). O administrador também pode arquivar ou manter só o bloqueio.

## 16. Desempenho (gráficos)

A tela **Desempenho** mostra, para as estações que você fez como candidato, o aproveitamento por **bloco geral do PEP** (preparação, anamnese, exame físico, hipótese, exames, conduta, comunicação, desfecho), por **modalidade** (sala, randômico, trilha, chamado), por **área** e a **evolução semanal**. Filtros: **área**, **período** (7, 30, 90 dias, 1 ano, intervalo ou geral) e **modalidade**. Há visão em tabela para leitores de tela. Os blocos são classificados por palavras da seção/descrição de cada item; itens sem pista caem em "Outros".

## Praticar com IA, cartas, podcast e Rádio Revalida

- **Praticar com IA**: menu *Praticar com IA*. A IA escolhe o tema onde você mais precisa treinar; você só ajusta dificuldade e tempo. Sem ajuste: tempo da estação, dificuldade médio e 15 itens de checklist.
- **Cartas**: em *Estudo → Cartões*, *Todos os cartões* lista as cartas de 10 em 10 por área; *Criar cartões* guia a conversão de um tema em cartas (escolher, gerar, revisar, salvar).
- **Podcast**: menu *Podcast e Rádio*. Crie uma playlist, escreva o prompt de detalhamento, gere episódios por tema ou revisão de cartões, baixe, pause e continue depois. *Gerar link privado* cria o endereço para o seu app de podcast (guarde-o como senha); o link público é opcional. Para compartilhar episódios e playlists com quem não está na plataforma, veja **Podcast: compartilhar fora da plataforma**.
- **Rádio Revalida**: aba *Rádio Revalida* toca a programação (radia.m3d.pro/revalida). Marque um episódio como público para entrar no programa.
- **Exportar para a rádio**: aba *Exportar para a rádio* envia temas ao pool; eles aguardam sincronização, listados com a data da solicitação.

## Podcast: compartilhar fora da plataforma e importar em outros aplicativos

Tudo o que o Revalida gera no podcast sai num **padrão universal**, para que outra pessoa (ou outro programa) possa ouvir, assinar ou importar sem ter conta aqui.

### O padrão de entrada (o que sai do Revalida)

| Item | Padrão |
|---|---|
| **Áudio do episódio** | MP3 (MPEG-1 Layer III), **mono, 44 100 Hz, 64 kbps CBR** (cerca de 0,5 MB por minuto). Tags **ID3v2.3**: título, artista (*Revalida Prático*), álbum (nome da playlist), faixa (posição), gênero *Podcast*, ano e comentário. |
| **Transcrição** | Texto simples **UTF-8 (.txt)**, um por episódio; é o mesmo texto que a voz lê. |
| **Feed da playlist** | **RSS 2.0** com os espaços de nomes iTunes, `content`, Atom e Podcasting 2.0. Canal: `title`, `link`, `description`, `language` (pt-br), `itunes:author`, `itunes:summary`, `itunes:type` (episodic), `itunes:category` (Education), `itunes:explicit` (false), `itunes:image`, `atom:link rel="self"`. Episódio: `title`, `description`, `content:encoded`, `guid` (fixo), `pubDate` (RFC 822), `enclosure` (url, length e type `audio/mpeg`), `itunes:duration` (H:MM:SS), `itunes:episode` e `podcast:transcript` (texto simples). |
| **Páginas para ouvir** | HTML simples, sem JavaScript, que toca no navegador de qualquer aparelho, com botões *Baixar MP3*, *Transcrição* e *Assinar por RSS*. |

O selo **MP3 universal** aparece no episódio quando o áudio passou por essa padronização. Se o servidor não tiver o programa de conversão (ffmpeg), o MP3 original da voz é mantido e a duração fica estimada; o episódio continua tocando e compartilhável, só sem o selo. Quem administra o servidor pode desligar a padronização com `AUDIO_NORMALIZAR=0`.

### Compartilhar um episódio

1. Em *Podcast e Rádio*, abra a playlist e, no episódio, clique em **Compartilhar / mover → Criar link público do episódio**.
2. Aparecem três endereços: **página para ouvir** (para mandar a qualquer pessoa), **MP3** (para importar em outro aplicativo) e **transcrição (.txt)**. Use *Copiar*.
3. Quem tem o link ouve e baixa **sem conta**. *Desativar link* apaga o endereço: ele deixa de funcionar na hora.

### Compartilhar uma playlist (grupo de gravações)

1. Na playlist, clique em **Criar link público**. Aparecem a **página para ouvir** (lista todos os episódios com player) e o **RSS**.
2. Para ouvir no app de podcast de outra pessoa, ela copia o **RSS** e usa *adicionar podcast por URL* (o nome do menu varia: Apple Podcasts, Pocket Casts, Overcast, AntennaPod, Podcast Addict e similares aceitam esse endereço).
3. Novos episódios aparecem sozinhos no app dela, e *Desligar link público* encerra o acesso.

### Agrupar trilhas em grupos de gravações

- **Mover ou copiar** um episódio para outra playlist: em **Compartilhar / mover → Levar para a playlist…**. Copiar leva também o áudio e mantém o original.
- **Agrupar vários de uma vez**: marque as caixinhas dos episódios e clique em **Agrupar em nova playlist**. Dê o nome do grupo; os episódios são copiados e as playlists de origem ficam como estavam. Depois é só criar o link público do grupo.
- Limites: 50 playlists por pessoa e 100 episódios por playlist.

### Importar em outras plataformas

- **Aplicativos de podcast**: assine pelo **RSS** da playlist (acima).
- **Outro sistema, curso ou plataforma de áudio**: baixe o **MP3** e a **transcrição (.txt)** de cada episódio; o MP3 já traz título, álbum e faixa nas tags. Sistemas que leem JSON podem consultar os endereços públicos `/api/publico/podcast/p/<código>` (playlist) e `/api/publico/podcast/e/<código>` (episódio).
- **Diretórios públicos (Spotify, Apple Podcasts etc.)**: o RSS segue o padrão, mas esses diretórios pedem capa de pelo menos 1400 × 1400 px, e-mail e dados do autor, que o Revalida não preenche. Para publicar lá, use o MP3 e a transcrição e cadastre o programa direto na plataforma.

### Segurança e cuidados

- O link é um **código longo e secreto**: quem o tiver, ouve. Não coloque em lugares públicos se não quiser que qualquer pessoa ouça, e desative quando não precisar mais. As páginas pedem aos buscadores que não as indexem.
- Os acessos públicos têm limite por endereço de rede (anti-abuso) e não mostram nome nem e-mail de quem criou.
- O conteúdo é gerado com IA a partir de roteiros de estudo e **não substitui orientação médica**.
- Para quem instala: os links usam o endereço configurado em `APP_URL` e passam pelo mesmo proxy de `/api/` (nenhuma regra nova no servidor web).

## Quadros e navegação do mapa 3D

- Os quadros (tema, ferramentas da sala) não têm rolagem horizontal: o texto quebra linha e tabelas, campos e imagens se ajustam à largura.
- No mapa 3D (Estudo e apoio cognitivo) a navegação é como em um mapa online: **arrastar** move o mapa; **roda do mouse** ou **pinça** aproxima no ponto apontado; **duplo clique** aproxima (Shift + duplo clique afasta); **botão direito** (ou Ctrl/Shift + arrastar) ou dois dedos giram e inclinam; setas movem, `+`/`−` dão zoom, `Q/E/W/S` orbitam e `0` volta ao início.

## Baralho e zoom

- Em *Estudo → Trilha* e *Cartões → Todos os cartões*, as cartas são móveis: arraste, solte sobre outra para empilhar, toque na pilha para abrir; *Agrupar parecidos* reúne temas semelhantes; *Organizar* volta à grade.
- No menu, **− / +** mudam o zoom e **⤢** ajusta automaticamente para o conteúdo caber na janela.
