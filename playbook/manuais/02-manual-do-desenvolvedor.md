# Manual do Desenvolvedor — Revalida Prático

Para quem vai rodar, alterar, testar e estender o código. Complementa o Manual Técnico (arquitetura e decisões) e o Guia de Instalação (produção).

---

## 1. Mapa do repositório

```
revalida-variacao/
├─ server/         API Node.js (Express + Socket.IO), regras de negócio, IA, testes
│  ├─ src/         módulos por assunto (ver §3)
│  ├─ data/        catalogo.json (426 itens) e temas-provas.json (168 temas) — dados estáticos
│  └─ test/        testes de unidade/integração (*.test.mjs) e e2e (test/e2e/*.e2e.mjs)
├─ web/            Front-end React 18 + Vite (o MESMO app serve desktop, celular e navegador)
│  ├─ src/         telas (*.jsx), peças compartilhadas e CSS por tela
│  └─ test/        testes das regras puras (conduta, grafo3d, dispositivo)
├─ db/             schema.sql (banco novo) e migracoes/ (002…012, idempotentes)
├─ desktop/        Electron: abre o app web do seu servidor
├─ mobile/         Expo/React Native: WebView do seu servidor
├─ watch/          PWA estática para relógios (sem build)
├─ php/token.php   endpoint reserva de token Agora
├─ python/seed.py  semente de estações de exemplo e token demo
├─ docs/           estes manuais + referência da API + modelo de dados
├─ scripts/        instalar, verificar, backup, restaurar, atualizar
└─ docker-compose.yml
```

> Há uma pasta `web/src/conduta/` com um segundo port do script "Conduta Dinâmica" que **não é importado** pelo app (o módulo em uso é `web/src/conduta.js`). Decida se mantém ou remove para evitar duplicidade.

---

## 2. Ambiente de desenvolvimento

Requisitos: **Node 20+**, **PostgreSQL 16**, `psql` e `createdb` no PATH (os testes usam), Python 3.10+ (só para a semente), Docker (opcional).

```bash
# 1) banco
createdb revalida
psql revalida -f db/schema.sql
pip install "psycopg[binary]" && python python/seed.py     # opcional: estações de exemplo

# 2) API (porta 3001)
cd server && cp .env.example .env     # ajuste DATABASE_URL, JWT_SEGREDO, ROOT_EMAIL/ROOT_SENHA
npm install && npm run dev

# 3) Web (porta 5173)
cd web && npm install && npm run dev
```

Atalho: `docker compose up --build` sobe Postgres + API + Nginx (web). Detalhes em `docs/05-guia-de-instalacao.md`.

### Variáveis de ambiente principais
`DATABASE_URL`, `PORT`, `NODE_ENV`, `JWT_SEGREDO` (≥ 32 caracteres em produção; a API recusa subir sem), `APP_URL`, `ROOT_EMAIL`, `ROOT_SENHA`, `ROOT_SENHA_REDEFINIR`, `SMTP_URL`/`EMAIL_DE`, `AGORA_APP_ID`/`AGORA_APP_CERTIFICATE`, `INSTALL_CODE`, `PHP_TOKEN_URL`, e chaves de IA (`GEMINI_API_KEY`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`…). A **variável de ambiente sempre vence** o que o instalador gravou no banco.

---

## 3. Back-end: módulos de `server/src`

| Arquivo | Responsabilidade |
|---|---|
| `index.js` | Monta o app: middlewares, Socket.IO, login, rotas de sessões/estações legadas, registra os módulos abaixo |
| `auth.js`, `seguranca.js`, `recuperacao.js`, `bootstrap.js` | Login, JWT, senhas (bcrypt), recuperação, conta root |
| `admin.js` | Painel de administração e auditoria |
| `instalacao.js`, `cli-reinstalar.js`, `config.js` | Instalador do primeiro acesso, parâmetros guardados (segredos cifrados AES-256-GCM) |
| `social.js` | Bloqueio bilateral, denúncia (notificações, resposta, decisão, suspensão de 7 dias), chamados à comunidade, fila randômica (`parear`, `montarSala`, `/randomico/seguir` com inversão 1×1) e trilha guiada. Regras de bloqueio também em `rv_sala_entrar`/`rv_convite_criar` (migração 013) |
| `desempenho.js` | `GET /api/desempenho`: agrega por bloco do PEP (`classificar`), modalidade, área e semana; filtros área/período/modalidade |
| `agora.js`, `video.js` | Tokens de vídeo/áudio (Agora) com privilégios por papel |
| `salas.js` | Salas, ciclos, papéis dinâmicos, convites (regras em funções PL/pgSQL `rv_*`) |
| `execucao.js` | Estação em andamento: cartas/materiais, transcrição, análise ao vivo, checklist, finalização, liberação da transcrição |
| `analise-transcricao.js` | Conferência do PEP pela fala (IA ou palavras do item) e resumo de desempenho |
| `estacoes.js`, `estacao-esquema.js`, `assinatura.js` | CRUD de estações, validação, importação (.rvpack/PDF/imagem), duplicidade (título e hash de conteúdo) |
| `catalogo.js`, `importar-inep.js`, `temas.js` | Catálogo INEP, importador de caderno, temas |
| `estudo.js`, `estudo-logica.js`, `estudo-ia.js` | Trilha, cartões (SM-2), mapa, caderno de erros, diretrizes, prompts de IA |
| `ia.js` | Provedores de IA com failsafe e disjuntor |
| `painel.js` | `GET /api/painel` do Início |
| `email.js` | Envio de e-mail (nodemailer opcional) |

### Convenções do back-end
- **Português** nos nomes de domínio (tabelas, rotas, variáveis).
- **Regra de negócio sensível mora no banco** (funções `rv_*`, com `SELECT … FOR UPDATE`) e a API só traduz erros. Erros de regra usam `RAISE EXCEPTION … USING ERRCODE='RV001'` e são mapeados em `ERROS` (`salas.js`) para status HTTP e `codigo`.
- **Permissão no servidor, nunca no cliente.** O papel é lido do banco a cada requisição (bloqueio e troca de senha derrubam sessões na hora).
- `node-pg` devolve `numeric` como **string**: faça `::float8` no SQL.
- Rotas novas: registre em módulo `registrarX(app, { q, autenticar, … })` e chame em `index.js`. Valide `:id` com `validarId`/`idValido`.
- Conteúdo vindo de IA/arquivos entra como **rascunho**; instruções do usuário seguem para a IA como **dado**, nunca como instrução de sistema.

---

## 4. Banco de dados

- `db/schema.sql` cria um banco **novo** (já inclui tudo até a migração 012).
- Banco existente: aplique `db/migracoes/NNN_*.sql` em ordem (todas idempotentes: `if not exists`, `create or replace`).
- Para mudar o esquema: crie `013_…sql`, **e** acrescente o mesmo conteúdo ao fim de `db/schema.sql` (os testes constroem o banco a partir do `schema.sql`).
- Funções PL/pgSQL que montam JSON de estado (`rv_sala_estado`) são grandes: prefira acrescentar campos pela API (como `apoio_cognitivo`) a reescrevê-las.

Veja `docs/modelo-de-dados.md` (tabelas e colunas) e `docs/referencia-api.md` (122 rotas).

---

## 5. Front-end

- **React 18 + Vite**, sem biblioteca de estado: estado local + `api()` (fetch com token). Um único `App.jsx` com menu e telas; CSS por tela (`salas.css`, `estudo.css`…), tema claro/escuro por variáveis CSS (`--mar`, `--menta`, `--coral`, `--sol`, `--uva`, `--card`, `--borda`…).
- **Peças compartilhadas (`Quadros.jsx`)**:
  - `usePref(chave, padrão)` — preferência persistida no `localStorage` (com `try/catch`);
  - `useReordenar(chave, ids)` — arrastar e soltar HTML5 + Alt+setas, ordem guardada por *id* (nunca por posição);
  - `QuadroFlutuante` — quadro arrastável/minimizável/redimensionável, reajustado ao redimensionar a janela; vira folha no celular;
  - `PainelQuadros` — índice de quadros resumidos × modo em sequência (Análise).
- `FerramentasSala.jsx` — barra fixa de ícones reordenáveis. `TextoEstacao.jsx` — formata descrição/cenário (títulos, listas, rótulos, medidas).
- `QuadroTema.jsx` — quadro explicativo de tema (Estudo/Catálogo/Trilha).
- **Apoio cognitivo**: `conduta.js` (motor puro: achados → hipótese → trilha → grafo), `ApoioCognitivo.jsx` (quadro 2D/3D), `grafo3d.js` (layout e projeção 3D sem biblioteca).
- `dispositivo.js` — detecção de celular/desktop/relógio e viewport adaptativo; `transcricao.js` — reconhecimento de voz do navegador com reserva por gravação.
- Seletores de teste: use `data-testid` estáveis (os e2e dependem deles).

### Acessibilidade
Botões ≥ 44 px, foco visível, `aria-*` nos quadros, alternativa de teclado para tudo que arrasta (Alt+setas), `prefers-reduced-motion` respeitado.

---

## 6. Testes

| Onde | Comando | O que cobre |
|---|---|---|
| `server/` | `npm test` | ~150 testes de regra/HTTP contra **Postgres real** via `psql` |
| `server/` | `npm run test:e2e` | navegador (Playwright/Chromium) + HTTP + Postgres; 11 suítes + `apoio-ui.e2e.mjs` |
| `web/` | `npm test` | regras puras: conduta, grafo 3D, dispositivo |
| `watch/`, `desktop/`, `mobile/` | `npm test` | lógica e validação de endereço |

**Como os testes funcionam (importante):** `server/test/ajuda.mjs` cria um banco descartável por suíte (`createdb` + `schema.sql`), usa `psql` no lugar do driver `pg` e **versões mínimas de express, bcrypt, jwt e pg**. Ou seja: as regras e o SQL são reais; os pacotes de terceiros **não** são exercitados pelos testes. Antes de produção rode o checklist de *smoke test* do Guia de Instalação com os pacotes reais.

**E2E**: esbuild empacota o front com stubs de `socket.io-client` e do vídeo; o harness `server/test/e2e/servidor-http.mjs` espelha rotas — ao criar rota nova que o front usa, registre-a também no harness. Rode **um arquivo e2e por vez** (suítes simultâneas no mesmo navegador geram falhas espúrias). Saída/capturas: `SAIDA=<pasta>`.

```bash
cd server
node --test test/estacoes.test.mjs         # uma suíte
SAIDA=/tmp/cap node test/e2e/salas-ui.e2e.mjs
```

Se o Postgres local parar (`stale pid`): `pg_ctlcluster 16 main start`.

---

## 7. Receitas

### Adicionar uma rota
1. Escreva a regra (SQL ou JS) no módulo do assunto; valide entrada; verifique papel no servidor.
2. Teste em `server/test/*.test.mjs` (use `criarApp`, `criarBanco`, `criarQ`).
3. Se o front usa, registre no harness e1e e crie o passo em `*.e2e.mjs`.
4. Regenere a referência (`python3 scripts/gerar-docs.py`).

### Adicionar uma opção de sala (exemplo real: apoio cognitivo)
Migração `012` (`alter table salas add column …`) → anexar ao `schema.sql` → rota `PATCH /api/salas/:id/<opção>` só para o admin → injetar no `GET …/estado` → caixa na tela e leitura `est.sala.<opção>` → testes HTTP e e2e.

### Adicionar uma protocolo ao apoio cognitivo
Em `web/src/conduta.js`: inclua em `PROTOCOLOS` (etapas `M(texto, regex)`; ramos condicionais `A(texto, regex, on, off, motivo)`) e os achados que pesam em `ACHADOS`. As expressões usam **texto sem acentos e minúsculo**. Atualize `web/test/conduta.test.mjs`.

### Adicionar uma tela
Componente `.jsx` + `.css`, entrada no menu em `App.jsx`, `data-testid` nos elementos-chave, estados de carregando/erro/vazio, tema claro/escuro.

---

## 8. IA

`ia.js` tenta provedores na ordem configurada (padrão **Gemini → OpenAI → Pollinations → Claude**) com **disjuntor**: provedor quebrado fica em pausa. Limite por usuário (ex.: 3 gerações/hora). Saídas são validadas (`estacao-esquema.js`, `estudo-ia.js`); citação fora da bibliografia é descartada. Sem IA configurada, as rotas respondem 503 `IA_NAO_CONFIGURADA` e as funções que têm alternativa (palavras do item) continuam.

---

## 9. Qualidade e segurança — lista antes de fazer merge

- [ ] Permissão conferida no servidor; nada sensível no cliente (PEP não vai ao candidato).
- [ ] Entrada validada (tipos, tamanhos); SQL parametrizado.
- [ ] Segredos só em variáveis de ambiente ou cifrados no banco; nunca em log.
- [ ] Teste novo + suíte existente verde (`npm test`, e2e afetados).
- [ ] Texto da interface em português do Brasil; `data-testid` nos pontos novos.
- [ ] README/docs atualizados; migração idempotente e anexada ao `schema.sql`.

---

## 10. Limites conhecidos (honestidade)

- Dependências reais (`express`, `pg`, `socket.io`, `bcryptjs`, `jsonwebtoken`, `vite`) **não foram instaladas nem exercitadas no ambiente em que o código foi escrito**; os testes usam versões mínimas. Faça o smoke test.
- **Agora (vídeo ao vivo), SMTP real, IA real, Electron e Expo não foram testados** em dispositivo/serviço reais.
- Arrastar e soltar em toque depende do navegador (arrasto por toque longo); há alternativa por teclado (Alt+setas).
- O reconhecimento de voz usa o do navegador (Chrome/Edge); a reserva por gravação depende de IA no servidor.

### Camada social (migração 013)
Tabelas `bloqueios`, `denuncias`, `suspensoes`, `notificacoes`, `chamados`, `ciclos_randomicos`, `trilhas` e coluna `usuarios.suspenso_ate` (o autenticador e o Socket.IO recusam conta suspensa; `sessao_versao` muda ao suspender). Testes: `server/test/social.test.mjs`, `desempenho.test.mjs`, e2e `social-ui.e2e.mjs`. Telas: `Inicio.jsx` (trilha × plataforma), `Comunidade.jsx`, `Seguranca.jsx`, `Desempenho.jsx`.
