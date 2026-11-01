# Manual Técnico Completo — Revalida Prático

Arquitetura, modelo de dados, fluxos, segurança, operação e limites. Público: arquitetos, SRE, segurança e quem fará a auditoria técnica.

---

## 1. Visão geral

Aplicação web de treino da 2ª fase prática do Revalida: salas com vídeo, estações com checklist (PEP), transcrição e análise da fala, módulo de estudo e apoio cognitivo. Um **único front-end** atende computador, celular e relógio (versão mini); Electron e Expo apenas embrulham o app do servidor.

### 1.1 Componentes

```
 Navegador / Electron / WebView / Relógio
        │ HTTPS                       │ WebRTC (mídia)
        ▼                             ▼
 ┌─────────────┐   /api, /socket.io   ┌───────────────┐        ┌────────────┐
 │ Nginx (web) │ ───────────────────▶ │ API Node.js   │ ─────▶ │ PostgreSQL │
 │ estáticos   │                      │ Express +     │  SQL   │ 16         │
 │ /watch/     │                      │ Socket.IO     │        └────────────┘
 └─────────────┘                      └──────┬────────┘
                                             │ HTTPS (saída)
                      ┌──────────────┬───────┴─────────┬───────────────┐
                      ▼              ▼                 ▼               ▼
                 Agora (tokens)  Provedores de IA   SMTP        PHP reserva (token)
```

| Camada | Tecnologia | Observação |
|---|---|---|
| Front | React 18 + Vite | SPA; build estático servido pelo Nginx |
| API | Node 20 · Express 4 · Socket.IO 4 | `server/src/index.js`, 122 rotas |
| Banco | PostgreSQL 16 | 37 tabelas; regras críticas em funções PL/pgSQL |
| Vídeo | Agora RTC | token emitido no servidor com privilégio por papel; modo demo sem credenciais |
| IA | Gemini → OpenAI → Pollinations → Claude | failsafe com disjuntor; opcional |
| E-mail | SMTP (nodemailer opcional) | recuperação de senha e tokens |
| Reserva | PHP `token.php` | só se a API estiver fora do ar |
| Relógio | PWA estática `/watch/` | consome as mesmas rotas |

---

## 2. Papéis e autorização

Dois níveis independentes:

1. **Papel no sistema** (`usuarios.papel_app`): `usuario`, `moderador`, `admin`, `root` (um único root, definido por `ROOT_EMAIL`).
2. **Papel na sala** (`sala_participantes`/`sessoes`): `admin` (chefe), `candidato`, `observador`, `avaliador_ator`.

Regras:
- O papel é lido **do banco a cada requisição** (`sessao_versao`): bloquear usuário ou trocar a senha invalida as sessões imediatamente.
- Toda decisão de permissão é do servidor. O front só esconde botões.
- O candidato **não recebe** o PEP nem as marcações até a finalização; a transcrição só é devolvida a ele após **liberação do avaliador** (`execucoes.transcricao_liberada`), com redação do texto (`ocultarFala`) antes disso.
- Ações administrativas gravam em `auditoria_admin`.

---

## 3. Autenticação e sessão

- Senhas com **bcrypt** (`bcryptjs`), regra mínima de complexidade no servidor (`senhaValida`).
- **JWT** assinado com `JWT_SEGREDO`; em `NODE_ENV=production` a API **recusa subir** com segredo padrão ou < 32 caracteres.
- Login: 5 erros por IP+e-mail bloqueiam por 15 min. Mensagens genéricas (não revelam se a conta existe).
- Recuperação: link de 60 min, uso único, só o **hash** do token no banco, máx. 3 e-mails/hora por endereço; `#` no URL mantém o token fora de logs do servidor.
- Conta **root**: criada na partida a partir do ambiente; senha só como hash; senha fraca vira *provisória* com faixa pedindo troca; não existe senha mestra.
- Tokens de acesso: 1 uso preso ao e-mail (admin) ou multiuso (root).

---

## 4. Instalador, configuração e ciclo de vida

- Servidor sem instalação concluída mostra o **instalador**: código impresso no log da API → verificação (banco, estrutura, `JWT_SEGREDO`, `APP_URL`, proxy, SMTP, Agora, HTTPS e `/socket.io` no navegador) → parâmetros → administradores → concluir (`instalado_em`; rotas `/api/instalacao/*` passam a responder 403 para sempre).
- Parâmetros ficam em `config_servidor`; **segredos cifrados com AES-256-GCM**, chave derivada de `JWT_SEGREDO`, nunca devolvidos ao navegador. **Variável de ambiente sempre vence** e aparece bloqueada.
- Reabrir só pelo root (Admin → Sistema; senha + frase `REINSTALAR`/`APAGAR TUDO`; 5 erros bloqueiam 15 min; auditoria) ou por CLI no servidor: `npm run reinstalar` (`-- --limpar --sim` apaga dados).
- **Atenção operacional:** trocar `JWT_SEGREDO` torna ilegíveis os segredos cifrados em `config_servidor`; reconfigure-os.

---

## 5. Modelo de dados (resumo)

Lista completa em `docs/modelo-de-dados.md`. Grupos:

| Grupo | Tabelas principais |
|---|---|
| Identidade | `usuarios`, `tokens_acesso`, `recuperacoes_senha`, `solicitacoes_acesso`, `auditoria_admin` |
| Estações | `estacoes` (+ `titulo_norm`, `conteudo_hash`), `pep_itens`, `estacao_materiais` (cartas sob demanda), `usuario_estacao`, `estacao_temas`, `diretrizes`, `catalogo_estudo` |
| Salas | `salas`, `sala_participantes`, `solicitacoes_papel`, `ciclos`, `ciclo_itens`, `convites_sala`, `sala_eventos` |
| Execução | `execucoes`, `execucao_materiais`, `transcricoes`, `analises_transcricao` (marcas e revisão de nota na própria execução) |
| Estudo | `temas`, `tema_relacoes`, `cartoes`, `cartao_progresso` (SM-2), `resumos`, `lacunas` (base do caderno de erros) |
| Sessões legadas | `sessoes`, `sessao_participantes`, `avaliacoes`, `avaliacao_itens`, `comentarios_observador`, `sessao_materiais` (modo solo/dupla; canal de vídeo; `audio_observadores`) |
| Sistema | `config_servidor` (instalação e parâmetros) |

Decisões de modelagem:
- **Duplicidade de estações**: `titulo_norm` (normalizado) e `conteudo_hash` (hash do conteúdo normalizado). Conteúdo idêntico → 409 `ESTACAO_DUPLICADA` sempre; título repetido → 409 `TITULO_REPETIDO` (manual) ou sufixo " (2)" (IA/variação/arquivo/pacote); escopo por visibilidade.
- **Exclusão**: chaves estrangeiras impedem apagar estação usada (`EM_USO`, 409).
- **Opções da sala** que não exigem reescrever a função de estado (ex.: `salas.apoio_cognitivo`) são injetadas no `GET /api/salas/:id/estado` pela API.

---

## 6. Fluxos principais

### 6.1 Entrada na sala e vídeo
1. `POST /api/salas`/`entrar` → papel inicial *observador*.
2. Front pede `GET …/agora-token`; o servidor lê o papel no banco e emite token com **privilégios separados** (`buildTokenWithUidAndPrivilege`): observador sem liberação **sem** privilégio de publicar áudio; com liberação, o privilégio dura 120 s e é renovado enquanto valer; revogar derruba o microfone por evento e, mesmo em cliente adulterado, o privilégio expira em até 2 min.
3. Falha → token reserva em PHP; sem credenciais → **modo demo** (telas simuladas; cronômetro e checklist funcionam).
4. Pausa de vídeo pelo chefe: token curto para a pausa valer em até 2 min.

### 6.2 Estação em andamento
1. Chefe inicia (`rv_*` com bloqueio de linha; só uma execução por ciclo). O candidato recebe descrição e cenário; os materiais saem por liberação do avaliador (`cartas/:id/liberar`).
2. **Transcrição**: o navegador do candidato reconhece a fala (Web Speech) e envia trechos finais (`POST …/transcricao`); sem reconhecimento, grava trechos curtos e o servidor pede à IA a transcrição (`POST …/audio`, até 3 MB). Só a voz do candidato, só durante a estação (o servidor recusa texto novo após o fim: `TRANSCRICAO_ENCERRADA`).
3. **Análise ao vivo** (avaliador): `POST …/analise-ao-vivo` compara a fala com os itens do PEP (IA, com validação rígida de saída; ou palavras do item). Resultado = **sugestão**; a nota é sempre marcada pelo avaliador.
4. **Finalizar**: nota calculada no servidor; análise final com divergências fala × marcação, resumo e bibliografia.

### 6.3 Pós-estação
`GET /api/estudo/execucoes/:id/analise` devolve resumo, seções (contra a média histórica), comparação, itens × fala, transcrição (redigida se não liberada) e trilha. Ações: cartões do checklist/IA (aprofundados), nova estação com outra abordagem (`/variar`), revisão de nota.

### 6.4 Estudo
- Trilha e mapa por tema; desempenho por tema derivado de execuções e cartões.
- **Cartões**: SM-2 (facilidade mínima 1,3; erro volta para amanhã). A IA recebe `foco`, `pontos` (≤ 8, ≤ 220 caracteres, como dado) e `aprofundar`, com camadas: critério, importância, conduta (droga/dose/via/prazo), sinais de alarme/erros comuns e pergunta de raciocínio.
- `POST /api/estudo/temas/resolver` garante o tema (origem *catálogo*) a partir do nome; `GET /api/estudo/temas/:id` devolve `contexto` (anos em prova, desempenho, cartões, lacunas) para o quadro explicativo.

### 6.5 Apoio cognitivo (grafo da conduta)
- **100 % no navegador do candidato.** `conduta.js` normaliza o texto (sem acentos, minúsculas), detecta achados por expressões regulares com negação simples, pontua hipóteses, avalia a **trilha genérica** (8 fases) e produz o grafo (nós, arestas, camadas). A visão 3D usa `grafo3d.js` (projeção em perspectiva em canvas 2D, sem biblioteca).
- **Não usa nem recebe o PEP real da estação** (teste automatizado impede referências à API/checklist no módulo) e não grava nada; as anotações ficam em memória.
- O chefe liga/desliga por sala (`PATCH /api/salas/:id/apoio-cognitivo`). A trava é de **interface**, não barreira criptográfica.
- Base de conhecimento: 6 protocolos resumidos (trauma/ATLS, sepse, SCA, AVC, pré-eclâmpsia, dengue) — **material de estudo**, sujeito a revisão por especialistas e às diretrizes vigentes.

---

## 7. Tempo real

Socket.IO: sala `sessao:<id>` para eventos (`participante_saiu`, `ciclo_pausado`, `audio_observadores`, `apoio_cognitivo`, …). O front reconsulta o estado (`/estado`) ao receber eventos e por polling leve. Presença com tempo de graça na saída. Atrás de Nginx é obrigatório o *upgrade* de WebSocket em `/socket.io/`.

---

## 8. Segurança

| Tema | Controle |
|---|---|
| Transporte | HTTPS obrigatório (câmera/microfone exigem contexto seguro); `trust proxy` para IP real |
| Segredos | `.env`/variáveis ou cifrados no banco (AES-256-GCM); chaves Agora e de IA só no servidor |
| Entrada | validação de tipos/tamanhos; SQL parametrizado; limites de corpo (200 KB padrão; 12 MB só em importação e 3 MB em áudio, **após** autenticar) |
| Força bruta | bloqueio por IP+e-mail; limites de e-mails de recuperação; limite de IA por usuário |
| Concorrência | regras de sala em PL/pgSQL com `FOR UPDATE` |
| Injeção em IA | texto do usuário vai como **dado**; saídas validadas; citações fora da bibliografia descartadas |
| Dados sensíveis | transcrição de voz só com aceite do candidato; leitura posterior liberada pelo avaliador |
| Auditoria | `auditoria_admin` para ações administrativas |
| Navegação (Electron) | sandbox, sem Node no site, navegação restrita ao servidor configurado |

### 8.1 Privacidade e LGPD (pontos de atenção)
- Dados pessoais: nome, e-mail, desempenho, **transcrição da voz** (dado potencialmente sensível/biométrico a depender do tratamento), vídeo (a mídia trafega pelo Agora; o sistema **não grava** vídeo).
- Recomendações: base legal e termo de consentimento explícito para transcrição; política de retenção e exclusão de transcrições; contrato de operador com Agora, provedores de IA e SMTP; registro de incidentes; DPO/encarregado. **Isto não é aconselhamento jurídico**: valide com assessoria especializada.
- Os casos/estações são fictícios; evite inserir dados reais de pacientes.

### 8.2 Ameaças consideradas
Força bruta de login, enumeração de contas, XSS (React escapa; conteúdo formatado passa por `TextoEstacao` sem HTML bruto), escalonamento de papel (checagem no servidor), vazamento do gabarito ao candidato (PEP omitido, transcrição redigida), abuso de IA (limites e validação), upload malicioso (limites, tipo e assinatura de arquivo conferidos antes da IA).

---

## 9. Desempenho e capacidade

- API stateless (sessão por JWT) — escala horizontal atrás de balanceador, **desde que** o Socket.IO tenha *sticky sessions* ou adaptador (Redis) — **não implementado**; hoje o desenho é de **uma instância de API**.
- Gargalos esperados: Postgres (funções com bloqueio por sala), chamadas de IA (latência e custo), geração de grafo 3D (O(n) por quadro de animação, n ≈ 30–60 nós).
- O layout 3D de temas usa forças O(n²) com limite de iterações; mapas grandes (> 250 nós) reduzem iterações.
- Capacidade de vídeo é do Agora (por minuto de uso), não do servidor.
- Não há teste de carga executado: **dimensione por piloto**.

---

## 10. Operação

### 10.1 Implantação
`docker compose up --build` (Postgres 16, API Node 20 Alpine, Nginx com o build do web e `/watch/`). Ver Guia de Instalação.

### 10.2 Backup e restauração
`scripts/backup.sh` (pg_dump comprimido) e `scripts/restaurar.sh`. Faça backup **antes** de aplicar migrações. Teste a restauração periodicamente.

### 10.3 Atualização
1. Backup. 2. Obter a nova versão. 3. Aplicar migrações novas (`db/migracoes`) em ordem. 4. `docker compose up -d --build`. 5. Verificar `scripts/verificar.sh`.

### 10.4 Monitoramento sugerido
Saúde HTTP (`GET /api/saude` → `{ ok, agora }`), uso de CPU/memória da API, conexões do Postgres, taxa de erros 5xx no Nginx, falhas de IA (503/429) e de token de vídeo. Não há telemetria embutida.

### 10.5 Logs
A API escreve em stdout (`docker compose logs api`); o código de instalação é impresso no log enquanto o servidor não estiver instalado. Não registre segredos.

---

## 11. Qualidade e verificação

- **Testes automatizados** (executados no desenvolvimento): ~150 de servidor (Postgres real via `psql`, com express/bcrypt/jwt/pg mínimos), 23 do front (regras puras), e 12 suítes e2e em navegador (Chromium) com voz e vídeo simulados.
- **Nunca executados neste ambiente de desenvolvimento**: instalação das dependências reais de produção (`express`, `pg`, `socket.io`, `bcryptjs`, `jsonwebtoken`, `vite`), Docker Compose, Agora ao vivo, SMTP real, IA real, Electron e Expo (apps nativos), dispositivos reais (relógio).
- Antes de produção: executar o **smoke test** (Guia de Instalação §9) com pacotes reais, em HTTPS, com 3 contas.

---

## 12. Limitações e dívidas técnicas

1. Instância única de API (Socket.IO sem adaptador).
2. Sem *rate limit* global (apenas por login/recuperação/IA).
3. Sem observabilidade embutida (métricas/traces).
4. Apoio cognitivo é heurístico (expressões regulares); não substitui julgamento clínico e precisa de curadoria por especialistas e ampliação dos protocolos.
5. Reconhecimento de voz dependente do navegador (qualidade e idioma variam); a reserva por IA tem custo e latência.
6. Pasta `web/src/conduta/` duplicada (não usada) — remover ou unificar.
7. Políticas de retenção/exclusão de dados pessoais ainda precisam ser implementadas conforme a LGPD.
8. Reforço opcional: expulsão por API REST do Agora quando o privilégio de áudio for revogado (hoje o privilégio apenas expira).

---

## 13. Glossário

**PEP**: Planilha/Padrão de Execução do Procedimento (checklist da estação). **Estação**: caso clínico cronometrado. **Ciclo**: sequência de estações. **Chefe**: administrador da sala. **Cartão**: item de revisão com repetição espaçada (SM-2). **Failsafe**: alternativa automática quando o caminho principal falha. **`.rvpack`**: pacote exportado/importado de estações.

## 14. Camada social, fila randômica e trilha (migração 013)

- **Bloqueio:** `bloqueios(bloqueador, bloqueado, origem)`; `rv_bloqueados(a,b)` vale nos dois sentidos e é consultada em `rv_sala_entrar`, `rv_convite_criar`, lista de online, convites recebidos, chamados e pareamento. Bloquear/denunciar tira o bloqueador das salas em comum e cancela convites pendentes.
- **Denúncia:** `denuncias` (aberta → respondida → resolvida/arquivada/suspensa). Notifica denunciado (sem identificar o denunciante) e administradores; o denunciado responde; só `admin`/`root` decidem. Suspensão = `suspensoes` + `usuarios.suspenso_ate` por 7 dias, sem alvo admin/root; decisões auditadas em `auditoria_admin`.
- **Fila randômica:** `chamados(tipo='randomico')` expira em 10 min; o pareamento exige parceiro online (visto em 90 s), ativo, não suspenso, sem bloqueio e área compatível; reivindicação otimista (`update … where estado='aberto'`) evita pareamento duplo. Estação sorteada entre as aprovadas (as que nenhum fez vêm primeiro); com tempo (trilha) preenche o orçamento, cada estação valendo 2× a duração.
- **Inversão 1×1:** `POST /api/salas/:id/randomico/seguir` (só o admin da sala, após finalizar): fase 0 → `rv_ciclo_proximo('inverter')` e a mesma estação; fase 1 → próxima estação do plano com novo sorteio de funções; fim → ciclo encerrado.
- **Trilha:** `trilhas(minutos_dia, dias[], ultimo_modo)`; "hoje" e o dia da semana usam `America/Sao_Paulo`; o tempo feito conta execuções finalizadas hoje como candidato ou avaliador.
- **Limites:** o pareamento é por consulta (polling do cliente), instância única; sem notificação push; classificação dos blocos do PEP é heurística por palavras.
