# Revalida Prático

App completo para treino da 2ª fase prática do Revalida INEP: estações clínicas com checklist PEP,
videoconferência multiusuário (Agora) e modos Solo, Dupla e Observadores.

## Stack

| Camada            | Tecnologia                                             |
|-------------------|--------------------------------------------------------|
| Front-end         | React 18 + Vite (visual do protótipo aprovado)         |
| API + tempo real  | Node.js (Express + Socket.IO)                          |
| Vídeo             | Agora RTC (token no servidor, failsafe e modo demo)    |
| Banco             | PostgreSQL 16 (`db/schema.sql`)                        |
| Token reserva     | PHP (`php/token.php`, proxy failsafe)                  |
| Semente de dados  | Python (`python/seed.py`)                              |

## Subida rápida (Docker)

```bash
cp server/.env.example server/.env   # preencha AGORA_APP_ID e AGORA_APP_CERTIFICATE
docker compose up --build
# em outro terminal, semear as estações de exemplo:
pip install psycopg[binary] && python python/seed.py
```

Abra http://localhost:5173 — duas abas/janelas entram na mesma sala e as câmeras aparecem para todos.

## Subida manual

```bash
# banco
psql $DATABASE_URL -f db/schema.sql
python python/seed.py

# api (porta 3001)
cd server && npm install && npm run dev

# web (porta 5173)
cd web && npm install && npm run dev
```

## Failsafe de vídeo (ordem de tentativa)

1. `GET /api/sessoes/:id/agora-token` (Node) emite token com papel vindo do banco.
2. Falhou? o front tenta `php/token.php` (endpoint reserva).
3. Sem credenciais Agora configuradas? o servidor responde `modo:"demo"` e a sala
   abre com telas simuladas, cronômetro e checklist 100% funcionais — nada quebra.

O cliente renova o token antes de expirar (`token-privilege-will-expire`), reentra
sozinho em queda de rede (`connection-state-change`) e o observador nunca publica
áudio/vídeo.

## Segurança

- Senha com bcrypt; sessão via JWT; regras de papel conferidas no servidor, nunca no cliente.
- O candidato não recebe PEP nem marcações até a finalização.
- Chaves Agora ficam só no servidor (`.env`), nunca no front.

## Recuperação de senha e conta root

**Configuração** (`server/.env`, veja `.env.example`): `ROOT_EMAIL`, `ROOT_SENHA`, `APP_URL`, `JWT_SEGREDO`, e `SMTP_URL` (+ `npm i nodemailer`) para enviar e-mails.
Para bancos já existentes rode `db/migracoes/002_recuperacao_e_root.sql` (idempotente); bancos novos já recebem tudo pelo `schema.sql`.

**Conta root.** Na partida, a API cria `ROOT_EMAIL` com papel `root` (só pode haver um). A senha vem do ambiente, nunca do código, e fica no banco só como hash bcrypt.
Se a senha não cumprir a regra do app (como `arcano123`, com 9 caracteres), a conta fica *provisória*: o app mostra uma faixa pedindo a troca.
O root faz tudo que o admin faz e mais: tokens de vários usos, promover/rebaixar admins e moderadores e agir sobre admins. Ninguém altera o root pela API.
Perdeu a senha do root? Use "Esqueci minha senha" ou suba a API uma vez com `ROOT_SENHA_REDEFINIR=1`.
Não existe "senha mestra" que entre em qualquer conta: seria uma porta dos fundos.

**Recuperação de senha.** `POST /api/auth/recuperar` responde sempre igual (não revela se a conta existe), envia um link de 60 min e uso único (`APP_URL/#/redefinir/<token>`; o `#` mantém o token fora de logs do servidor). Só o hash do token fica no banco. Máximo de 3 e-mails/hora por endereço. Ao redefinir ou trocar a senha, todas as outras sessões caem.
`POST /api/auth/trocar-senha` (logado) exige a senha atual.

**Painel de administração** (aba Admin do app; o servidor confere cada ação lendo o papel atual no banco):
| Papel | Pode |
|---|---|
| moderador | revisar estações |
| admin | + pedidos de acesso (aprovar gera token de 1 uso preso ao e-mail), tokens de 1 uso, bloquear/desbloquear usuários comuns, gerar link de senha, registro de auditoria |
| root | tudo, inclusive tokens de vários usos e papéis de admin/moderador |

Pedidos de acesso agora são gravados (antes a rota só respondia a mensagem). Toda ação administrativa vai para `auditoria_admin`.
Login: 5 erros por IP+e-mail bloqueiam por 15 min. Bloquear alguém ou trocar a senha derruba as sessões na hora (o papel e o estado da conta são lidos do banco a cada requisição).

**Atenção:** a senha `arcano123` foi escrita em uma conversa e é fraca; use-a só para o primeiro acesso e troque em seguida. Em produção, defina `JWT_SEGREDO` forte (a API recusa subir sem ele com `NODE_ENV=production`) e ative HTTPS. Sessões antigas (sem versão) pedem novo login após a atualização.

**Testes** (`server/`): `npm test` (20 testes contra Postgres real, precisa de `psql`) e `npm run test:e2e` (navegador + HTTP + Postgres; precisa de Playwright e esbuild).
Neles, express, bcrypt, jsonwebtoken e pg são trocados por versões mínimas; **não foram executados** com os pacotes reais, com SMTP real nem com Agora/Socket.IO.

## Versão web (computador)
O mesmo front (`web/`) agora é responsivo: a partir de 900 px de largura o menu vira barra lateral, o painel e a sala usam duas colunas e a administração vira grade de cartões; no celular continua a coluna única. Não há código duplicado: é o mesmo `App.jsx` com CSS adaptativo.
Rodar: `cd web && npm install && npm run dev` (http://localhost:5173) ou `docker compose up --build`. O teste `npm run test:e2e` (em `server/`) confere o layout em 1366 px e 390 px.

## Instalador do primeiro acesso

Num servidor novo (sem nenhum usuário além da conta root do ambiente) o site abre o **instalador** em vez do login.

1. **Código** – a API imprime no log `Código de instalação: XXXX-XXXX-XXXX` (`docker compose logs api`). Só quem enxerga o log da máquina instala; 10 erros bloqueiam o IP por 15 min. Pode ser fixado com `INSTALL_CODE`.
2. **Verificação** – banco, estrutura (tabelas/colunas, inclusive a migração 003), `JWT_SEGREDO`, `APP_URL`, proxy (`X-Forwarded-For`), SMTP (conecta e autentica, sem enviar), Agora (valida o formato e gera tokens com e sem áudio) e, no navegador, HTTPS (necessário para câmera/microfone) e `/socket.io`. Erros impedem concluir; avisos (e-mail e vídeo opcionais) não.
3. **Parâmetros** – `APP_URL`, nome da instituição, remetente, SMTP, Agora, URL reserva do token. Guardados em `config_servidor`; segredos cifrados (AES-256-GCM, chave derivada de `JWT_SEGREDO`) e nunca devolvidos ao navegador. Variável de ambiente sempre vence e aparece bloqueada. Há botão de e-mail de teste.
4. **Administradores** – define a senha definitiva da conta raiz (a de exemplo é provisória) e cria administradores/moderadores. Para concluir é preciso ao menos um admin com senha definitiva.
5. **Concluir** – grava `instalado_em`; todas as rotas `/api/instalacao/*` passam a responder 403 para sempre. Servidores que já tinham usuários são reconhecidos como instalados.

## Vídeo e áudio na sala

- O vídeo conecta ao entrar na sala (antes de iniciar a estação). Candidato e avaliador/ator abrem câmera e microfone sozinhos; **todos** (inclusive observadores) podem abrir a própria câmera.
- **Áudio de observador: bloqueado por padrão** (`sessoes.audio_observadores = false`). Só o chefe da sala (avaliador/ator) liga/desliga a chave "Liberar o microfone dos observadores" (`PATCH /api/sessoes/:id/audio-observadores`; qualquer outro papel recebe 403).
- A regra é do **servidor**: o token Agora é emitido com privilégios separados (`buildTokenWithUidAndPrivilege`). Observador sem liberação recebe token sem privilégio de publicar áudio; com liberação, o privilégio dura 120 s e é renovado enquanto valer. Se o chefe revogar, o aviso em tempo real derruba o microfone na hora e, mesmo num cliente adulterado, o privilégio expira em até 2 min.
- O endpoint PHP reserva só é usado se a API estiver fora do ar; recusas (403) não são contornadas por ele.

**Não testado de verdade neste ambiente:** vídeo ao vivo com Agora (testes usam token/Socket.IO simulados), envio SMTP real, e o comportamento do Agora ao receber privilégio de áudio `0`. Faça uma sala com 3 contas reais e confira que o observador não é ouvido antes da liberação; se for, a Agora pode ainda exigir kick pela API REST de banimento (reforço opcional).

## Versões desktop e mobile

Ambas abrem o **mesmo app web do seu servidor** (então instalador, login, salas e as regras de vídeo/áudio são idênticos), com câmera e microfone liberados só para o endereço configurado. Na primeira abertura pedem o endereço do servidor (https; http só em localhost).

- `desktop/` – Electron (Windows/macOS/Linux). `npm i && npm start`; instalador com `npm run dist`. Janela isolada (sandbox, sem Node no site), navegação restrita ao servidor, menu "Trocar servidor…".
- `mobile/` – Expo/React Native (Android/iOS) com WebView. `npm i && npx expo start`; permissões de câmera/microfone declaradas em `app.json`. Segure o rodapé para trocar de servidor. iOS precisa de 14.3+ para câmera na WebView.

Testado aqui: a validação do endereço (`npm test` em cada pasta) e a sintaxe dos arquivos. **Não executados**: Electron e Expo não puderam ser instalados neste ambiente, então não abri as janelas/apps nem testei câmera em aparelho.

## Versão smartwatch (`watch/`)

Relógio compacto (PWA estática, sem build) servido pelo próprio servidor em **`/watch/`** (o `docker compose` já copia a pasta). Abra o endereço no navegador do relógio (Wear OS) ou adicione à tela inicial.

- Faz: entrar, listar suas salas ativas, cronômetro grande com vibração em 1 min e no fim, iniciar/pausar/retomar (avaliador/ator, ou dono em sala solo) e, para o **chefe da sala**, liberar/bloquear o áudio dos observadores (começa bloqueado).
- Não faz: checklist PEP (usa Socket.IO) nem vídeo. Use o celular ou o computador para isso.
- Toda regra segue no servidor; o relógio só chama as mesmas rotas.
- Testes: `cd watch && npm test` (lógica) e `node test/fumaca.e2e.mjs` (Chromium 240×240 com API simulada).
- Não testado em relógio de verdade, nem app nativo (Wear OS/watchOS): é uma página web.

## Detecção automática do aparelho e relógio de bolso

`web/src/dispositivo.js` identifica sozinho **celular**, **desktop** ou **relógio** (tela ≤ 300 px, user-agent de relógio como Wear OS/Galaxy Watch, ou largura + toque) e marca `<html data-dispositivo data-layout>`. O layout de computador (menu lateral, duas colunas) só vale para desktop com janela ≥ 900 px; celular deitado continua com o layout de celular. Acompanha redimensionamento.

- Aparelho que é um relógio abre direto a versão mini (`/watch/`).
- Em qualquer aparelho há, discretamente no canto superior direito, o ícone de **relógio de bolso**: leva à versão mini já com a sessão aberta. No relógio, o botão "App completo" volta (e lembra a escolha).
- Preferência guardada em `rv-modo` (`auto`/`relogio`/`completo`).
- Testes: `web: npm test` (regras) e `server: node test/e2e/dispositivo.e2e.mjs` (Chromium: desktop, iPhone, celular deitado, Wear OS, tela 240 px).
- Limites: a detecção por user-agent/tela é heurística; um relógio com navegador que se identifica como celular em tela grande não é reconhecido (use o ícone). No `vite dev`, `/watch/` não é servido (só no nginx/docker).

## Ciclo de vida da instalação (primeira vez, reinstalar, limpar)

- **Primeira vez:** servidor sem instalação concluída mostra o instalador a todos (passo a passo, ver acima). Concluído, grava `instalado_em` e **nunca mais aparece** — nem ao recarregar, nem ao reiniciar a API.
- **Só reabre quando o administrador raiz pede** (aba **Admin → Sistema**, visível apenas para o root; exige a senha dele e digitar a frase de confirmação; 5 erros bloqueiam por 15 min; tudo vai para o registro de auditoria):
  - **Reinstalar** (`REINSTALAR`): reabre o instalador sem apagar dados. Persiste a marca `reinstalacao_pendente`, então um reinício não "reconhece" o servidor como instalado até concluir de novo.
  - **Limpar o banco** (`APAGAR TUDO`): apaga usuários (inclusive o root), salas, avaliações, comentários, pedidos e tokens (o token master fica); mantém estações/checklists (opcional apagá-las) e os parâmetros do servidor; reabre o instalador, onde se cria o root novamente.
  - Em ambos o log da API imprime um **novo código de instalação** e o anterior deixa de valer. Enquanto o instalador está aberto, todos os visitantes o veem.
- **Sem acesso root (perdeu a conta)?** No servidor: `npm run reinstalar` (reabre sem apagar) ou `npm run reinstalar -- --limpar --sim` (apaga dados), depois reinicie a API para imprimir o código.

## Versão por aparelho

Desktop, celular e relógio são detectados sozinhos (ver acima). **Trocar de versão pelo ícone do canto só existe no desktop**; em celular/tablet o ícone nem é desenhado e uma escolha antiga guardada é ignorada. Aparelho-relógio vai direto à versão mini; "App completo" volta.

Testes: `cd server && npm test` (37) e `npm run test:e2e` (Chromium: app, instalador/sala, dispositivos, ciclo de instalação); `cd web && npm test`; `cd watch && npm test`.

## Carregamento com porcentagem e layout adaptativo

**Tela de carregamento (`web/index.html`)**: anel com % animado que cobre o app até que HTML, CSS, fontes, JS e primeiros dados estejam prontos. O app fica invisível (`html.carregando #root`) durante o processo, então a tela nunca aparece "por partes". O número só sobe, nunca passa da etapa em andamento e chega a 100% apenas quando o app chama `__boot.pronto()`. Há falhas tratadas: 20 s de espera, erro de JS ou do download do bundle mostram mensagem com botão "Tentar de novo"; fontes têm limite de 4 s; `prefers-reduced-motion` é respeitado.

**Quadro adaptativo (`web/src/dispositivo.js`)**: inspirado no modelo de redimensionamento proporcional. Mede a área realmente visível (`visualViewport`, que acompanha barra de endereço e teclado) e calcula `--app-w/--app-h` por perfil (celular, tablet, janela, desktop). O quadro nunca excede a área visível; quando falta altura, o conteúdo rola dentro do quadro. Recalcula em resize, rotação e teclado (com debounce). Estilos usam `dvh`, sem `min-height` forçado.

**Testado** (Chromium/Playwright, `server/test/e2e/adaptativo.e2e.mjs`): % monotônico, app oculto até o fim, falha de download, modo escuro e 11 tamanhos de tela (320×480 a 1920×1080, retrato/paisagem, teclado aberto). **Não testado**: Safari/iOS e Firefox reais, aparelhos físicos.

## Salas e ciclos (web e desktop)

Aba **🔁 Ciclos**. O chefe cria a sala e passa o código; candidato e observadores entram por ele. O servidor decide tudo (regras no banco, com trava por sala); a tela só mostra o estado que cada pessoa tem direito de ver.

- Papéis: 1 chefe, 1 candidato, vários observadores. Pedidos de papel (observador → candidato/chefe) são aceitos ou recusados por quem já tem o papel; trocar ou inverter papéis **pausa** a estação e o ciclo, e o ciclo pausado aparece com o botão **Retomar** (quando os papéis anteriores estão de volta).
- Fila do ciclo: o candidato e os observadores só veem estações já feitas, em andamento, pausadas ou **liberadas** pelo chefe. O chefe adiciona grupos de estações a qualquer momento.
- Estação: relógio do servidor; só quem avalia recebe o checklist (o candidato nunca recebe o gabarito). A nota é **calculada no servidor** a partir das marcas (sim / parcial / não).
- Fim da estação: nota, tempo, "nª vez desta estação", itens críticos falhos e histórico; o vídeo continua. O chefe escolhe: próxima estação, manter papéis, inverter papéis ou encerrar o ciclo.
- Vídeo: o chefe pode pausar o vídeo de qualquer pessoa (vale em até 2 min mesmo com cliente adulterado) e liberar o áudio dos observadores.

## Desktop completo

O app desktop abre este mesmo web app, então tem tudo: criar estações (manual, **gerar por IA**, importar pacote/PDF/imagem, exportar), ciclos e salas. O menu nativo traz **Estações** (Nova, Gerar com IA, Importar, Exportar, Minhas) e **Ciclos**; os itens ficam desativados até haver um servidor configurado. Os comandos passam por uma lista fechada no processo principal (`desktop/src-menu.js`).

Testes: `cd server && npm test` (97 testes), `npm run test:e2e` (navegador real: salas, estações, adaptativo…) e `cd desktop && npm test`.

## Estudo: trilha, cartões, mapa 3D e diretrizes (aba 📚 Estudo)

- **Trilha de aprendizagem**: parte dos temas das estações que você já fez e ordena pelo seu desempenho (do mais fraco ao mais forte, ou o contrário). Cada tema sugere o próximo passo (praticar, cartões, refazer).
- **Cartões** com repetição espaçada (estilo SM-2: errou volta amanhã; acertou sobe o intervalo). A IA gera **novas séries** por tema, usando as suas lacunas e sem repetir cartões existentes.
- **Mapa 3D**: nós coloridos pelo seu desempenho e ligações entre temas (pré-requisito, diferencial, complicação, conduta). Arrastar gira, +/− aproxima; há **lista alternativa** para teclado e leitor de tela. "Expandir o mapa (IA)" cria temas novos ligados; "Gerar resumo (IA)" aceita um foco específico.
- **Caderno de erros**: depois de cada estação o candidato marca a categoria da lacuna (conhecimento, sequência, comunicação, tempo). O mesmo erro em 3 estações diferentes aparece como **transversal**.
- **Diretrizes**: a moderação cadastra o texto de diretrizes/protocolos (ex.: Ministério da Saúde). A IA só trata como norma o que está cadastrado; sem diretriz o conteúdo sai marcado "sem diretriz de referência". **Todo conteúdo de IA precisa ser conferido por uma pessoa.**
- **Guia de treino**: níveis 1–3, roteiro universal, erros comuns, sessão eficiente e semana (não substitui o PEP).

### Criar estações (modelo INEP)
Gerar por IA aceita os campos do modelo (área, cenário, perfil, queixa, diagnóstico alvo, objetivos) e uma **base de referência**: "mais relevantes" (peso dos temas) ou "meus pontos mais fracos". A estação sai com síntese, objetivos, folha do candidato, roteiro do paciente, materiais liberados sob demanda e PEP com critério e pontuação parcial. Em qualquer estação salva há **Criar variação com IA**: muda só perfil, cenário, diagnóstico ou dificuldade e refaz o que depende disso; a estação base não é alterada. Tudo entra como rascunho para revisão.

## Durante a estação: cartas, transcrição e conferência do PEP

- **Cartas do candidato**: ao iniciar, o candidato vê sozinho a *descrição* (folha do candidato) e o *cenário*. Exames, imagens e laudos são **cartas liberadas pelo avaliador**; o candidato só enxerga as já liberadas (nunca o gatilho, o roteiro do ator ou o checklist). Quando a fala do candidato pede um exame, o avaliador vê "pedido detectado" e libera com um clique.
- **Transcrição da fala do candidato**: só dele, só enquanto a estação anda, e só depois do aceite dele (guardado no navegador). Usa o reconhecimento de voz do navegador; se não houver (ex.: dentro do Electron), grava trechos de áudio e a IA transcreve. Ao finalizar a estação a transcrição **para**: o app desliga o microfone e o servidor recusa fala nova (regra no banco, inclusive para escrita direta).
- **Conferência do PEP pela fala**: a IA (ou, sem IA, a conferência por palavras do item) sugere sim/parcial/não por item **com o trecho da fala que sustenta** e julga se o que foi dito é compatível com o critério do item. Sem trecho na transcrição, o item não pontua. É sugestão: a nota é do avaliador.
- **Revisão da nota**: depois do fim, o avaliador compara a marcação com a fala e pode revisar; a nota é recalculada no servidor e a **nota original fica registrada**.
- **Painel de análise** (Início → estação feita; também no fim da estação na sala): resumo, pontos fortes e fracos por seção contra o seu histórico, comparação com outras estações e com a média da área, itens × fala, transcrição com os trechos destacados, e trilha sugerida.
- **Cartões de revisão** dos pontos que você escolher: ficam ligados à estação, aparecem em Estudo → Cartões e entram na repetição espaçada.
- **Outra abordagem**: a IA cria uma estação nova (rascunho) com o mesmo conteúdo, dando ênfase aos pontos escolhidos.

## Catálogo de estações (agora aba Catálogo INEP dentro de Estações)
- **Estações**: 426 estações de referência (`server/data/catalogo.json`, vindas da planilha anexada) com origem (INEP / INEP modificada / sem INEP), área, procedimento e didática. Cada pessoa marca estudo (não estudada / estudando / dominada), prioridade e anotações; **Gerar estação** cria um rascunho por IA a partir do item e o vincula (**Abrir estação** depois).
- **Temas por ano**: matriz de 168 temas das provas práticas 2011–2025.1 (`server/data/temas-provas.json`), ordenada por frequência.
- **Importar caderno** (moderador/admin): envia o texto de um caderno INEP; cada estação com pontuação por item vira rascunho num `.rvpack`, com relatório. Nada é publicado: o que o leitor não confirma (soma do PEP ≠ 10, roteiro do ator ausente) fica em `incertos` e entra como rascunho para conferência.
- Limites: cadernos de 2011–2020 não trazem pontuação por item e não são importados; a leitura depende do texto extraído do PDF, por isso toda estação importada precisa de revisão humana.

## Menu recolhível, ícones animados e análise da fala com bibliografia
- **Menu**: botão ☰ oculta/mostra o menu (computador e celular); a escolha fica lembrada no aparelho. Ícones em SVG com animação ao passar o mouse e na tela ativa (respeitam "reduzir movimento").
- **Análise da fala (só o avaliador)**: em cada item do PEP aparece a sugestão (sim/parcial/não) e a situação — acerto, parcial, erro, confusão de termo ou não falou; "ver análise" abre a equivalência com o critério, o termo confundido, o feedback e a referência. O menu "Análise da fala" mostra desempenho, pontos fortes/fracos e a bibliografia usada. O candidato nunca vê isso. A nota continua sendo do avaliador.
- **Bibliografia**: em Estudo › Diretrizes, a administração cadastra o texto, o tipo (Ministério da Saúde, OMS, sociedade) e marca "exigida" (usada primeiro). A IA só pode citar essas referências (R1, R2…); citação fora da lista é descartada. Sem bibliografia, o feedback segue o consenso clínico geral e a tela avisa. O sistema NÃO traz o texto das diretrizes do Ministério, da OMS ou das sociedades: o que vale como norma é o que for cadastrado.

## Sala: convites, cancelamento, autocorreção e sugestões
- **Convidar**: quem avalia (chefe ou avaliador delegado) abre "Convidar pessoas online" na sala; aparecem só nomes de quem foi visto nos últimos 90 s e ainda não está na sala. O convidado recebe o convite em qualquer tela e entra como **observador** ou, se a vaga estiver livre, como **candidato** (nunca dois candidatos).
- **Vaga de candidato**: livre quando o candidato **abandona** (vira observador) ou quando o chefe/avaliador **cancela a estação** marcando "tirar do papel de candidato".
- **Cancelar não é finalizar**: a estação fica `abandonada`, não conta como feita, não gera nota, análise nem feedback, a transcrição é apagada e a estação volta como pendente para ser refeita.
- **Autocorreção ao finalizar**: a transcrição é analisada ao terminar; a tela do fim mostra a nota pela fala × a nota do avaliador, os itens divergentes com feedback e a fala por minuto. Adotar a nota pela fala é decisão do avaliador (a nota anterior fica registrada). Sem fala transcrita não há autocorreção.
- **Cartas do avaliador**: informações sob demanda agrupadas por tipo (laboratório, imagem, biópsia, laudo, outras), com progresso e o aviso "pedido detectado na fala"; o candidato só vê o liberado. O enunciado aparece em itens.
- **Depois da estação**: análise com fala por minuto, pontos fortes/fracos, cartões dos pontos escolhidos **ou da estação inteira**, e **Biblioteca de revisão** (Estudo) com cartões pendentes × executados por estação.
- **Mapa 3D**: filtros por complexidade (da dificuldade das estações ligadas ou do nº de ligações), desempenho, tipo de relação, informações associadas (estações, cartões, lacunas) e vizinhança do tema escolhido.
- **Início**: 5 estações sugeridas por sorteio ponderado (temas de pior desempenho e nível avançado pesam mais; o que foi bem feito há pouco pesa menos, no máximo 2 da mesma área) e a lista de todas as estações disponíveis.
- **Menu**: completo, só ícones ou oculto (lembrado no aparelho); a escala do texto se ajusta ao tamanho da tela.


## Menu simplificado, painel visual e estações sem duplicidade

- **Menu**: Início · Ciclos (salas e prática) · Estações · Estudo · Admin (só administração) · Conta. Toda função mora em um deles; o Início só mostra e leva ao lugar certo.
- **Início** (`web/src/Painel.jsx`, dados de `GET /api/painel`): nota média, estações feitas, cartões a revisar, salas abertas, evolução, desempenho por área, sugestões de treino e salas. Quem avalia vê também **Como avaliador**: estação ao vivo (atalho para acompanhar a fala em tempo real) e as últimas avaliadas, com botão **Liberar transcrição / Retirar**.
- **Estações** é um painel só: *Disponíveis* (todas as aprovadas, com busca e filtros), *Minhas* (rascunhos, revisão, exportação), *Catálogo INEP*, *Temas por ano* e, para a moderação, *Em revisão* (antes ficava no Admin). Nova, Gerar com IA e Importar (arquivo, pacote .rvpack e caderno INEP em texto) saem do mesmo topo. A criação/entrada de sala existe só em Ciclos.
- **Transcrição**: o avaliador acompanha a fala em tempo real na sala. O candidato só relê depois do fim **e** se o avaliador liberar (`POST /api/execucoes/:id/transcricao/liberar`, reversível). Sem liberação o candidato recebe a análise (acertos e lacunas) sem nenhum trecho literal (segmentos, fala por minuto e evidências).
- **Duplicidade** (`server/src/assinatura.js`, colunas `titulo_norm` e `conteudo_hash`, migração 011): conteúdo idêntico (ignora título, caixa, acentos e pontuação) é sempre recusado, apontando a estação existente; título repetido é recusado na criação/edição manual (com título sugerido) e recebe sufixo ` (2)` quando vem de IA, variação, arquivo ou pacote. Pacote reimportado informa quais já existiam. A comparação só enxerga estações aprovadas, as suas e (moderação) todas.
- **Estação já na fila**: adicionar ao ciclo uma estação que já está nele devolve `409 ESTACAO_NA_FILA` com a situação de cada uma; a interface oferece *Duplicar a prática*, *Adicionar só as outras* ou desistir (`repetir: true` confirma; a regra também vale no banco). Sala por link (`/api/sessoes`) avisa igual (`ESTACAO_JA_ABERTA`).
- Limite: estações antigas ganham a assinatura na subida do servidor; rascunhos alheios não são comparados (para não revelar que existem).

## Barra de ferramentas da sala, quadros móveis e leitura facilitada

- **Sala**: barra de ferramentas fixa no topo (não rola com o conteúdo) com ícones de vídeo, câmera, microfone, participantes, pedidos, estação, transcrição, checklist, fim e fila. Os ícones se reordenam por arrastar e soltar (ou Alt + setas); a ordem fica guardada no navegador e o layout se adapta ao redimensionar (rótulos somem em telas estreitas). Botão ↺ restaura a ordem.
- **Conteúdo da estação** (roteiro, cenário, materiais) passa por `TextoEstacao`: títulos, listas, pares "Rótulo: valor" e destaque de medidas (mmHg, bpm, mg, °C, %).
- **Temas** (Estudo, Trilha e Catálogo): clicar no tema abre um quadro flutuante (arrastável, minimizável; vira folha inferior no celular) com contexto, anos em prova, desempenho, resumo, diretrizes e temas relacionados, além de "Criar cards do argumento".
- **Cards que aprofundam**: a IA recebe foco, pontos selecionados e a instrução de aprofundar (critério, por que importa, conduta, sinais de alarme, pergunta de raciocínio). Na Trilha há "Criar card do argumento" ao lado de "Cartões".
- **Análise**: índice de quadros resumidos; abertos, podem ser movidos, minimizados e fechados. A opção "Ver o conteúdo em sequência" empilha todos os quadros; desligada, volta ao formato compacto. Preferências ficam no navegador.
- **Excluir estações**: botão "Excluir" em Minhas (qualquer status) e em Disponíveis (dono ou admin). Estação já usada em sala/ciclo responde `EM_USO` e deve voltar para rascunho.
