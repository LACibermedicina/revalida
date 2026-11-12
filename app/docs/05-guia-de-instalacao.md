# Guia de Instalação — Revalida Prático

Para quem vai colocar o sistema no ar. Complementa o Manual Técnico (arquitetura) e o Manual do Desenvolvedor (código).

> **Honestidade sobre o que foi testado.** Neste ambiente de desenvolvimento foi possível verificar: o pacote (SHA-256), `instalar.sh --so-config` (gera o `.env` seguro), a **sintaxe** dos scripts, e o `db/schema.sql` + todas as migrações aplicados **duas vezes** em um PostgreSQL 16 limpo (idempotentes, 37 tabelas). **Não foi possível** instalar as dependências reais do `npm` (a rede do ambiente bloqueou o registro) nem subir o Docker (sem daemon). Portanto **nunca foram executados**: `npm install` real, `docker compose up`, o build com Vite real, vídeo ao vivo (Agora), SMTP, IA real, Electron e Expo. O §9 traz um *smoke test* que você deve rodar antes de abrir para usuários, e os testes automatizados (`npm test`) usam versões mínimas de express, pg, bcrypt e jwt.

---

## 1. O que você vai instalar

| Peça | Função | Porta |
|---|---|---|
| **PostgreSQL 16** | Banco de dados (`db/schema.sql`) | 5432 |
| **API** (Node 20, Express, Socket.IO) | Regras, autenticação, salas em tempo real | 3001 |
| **Web** (build do React; Nginx no Docker) | Site, e `/watch/` para relógio | 5173 (Docker) ou 80/443 (produção) |

Opcionais: **Agora** (vídeo), **SMTP** (e-mail de recuperação), **provedor de IA** (criar estações, cartões, análise da fala).

## 2. Requisitos

- Servidor Linux (Ubuntu 22.04+ recomendado), 2 vCPU, 2 GB de RAM e 10 GB de disco para começar *[estimativa, ajuste após o piloto]*.
- **Um domínio com HTTPS.** Câmera e microfone só funcionam em `https://` (ou `http://localhost`). `http://IP:porta` **não** serve para a sala.
- Caminho A (recomendado): Docker Engine 24+ com Compose v2.
- Caminho B: Node.js 20+, PostgreSQL 16, `psql`.

## 3. Caminho A — Docker Compose (o mais curto)

```bash
unzip revalida-pratico-instalacao.zip && cd revalida-pratico
bash scripts/instalar.sh --url https://treino.seudominio.com
```

O script: confere Docker; cria `server/.env` **sem sobrescrever um existente**, com `JWT_SEGREDO` aleatório, `NODE_ENV=production` e uma **senha inicial aleatória para o root** (impressa uma vez — anote); sobe `db`, `api` e `web`; espera `GET /api/saude`; tenta semear as estações de exemplo (precisa de `python3` e `psycopg`); imprime o **código de instalação**.

Opções: `--sem-semente` (não semeia), `--so-config` (só cria o `.env`, não sobe nada).

Depois abra o endereço e siga o **instalador** (§6). Verifique com `bash scripts/verificar.sh https://treino.seudominio.com`.

> No Windows use **WSL2** (Ubuntu) com o Docker Desktop integrado. Sem WSL, rode os comandos do script à mão: copie `server/.env.example` para `server/.env`, edite (§5) e execute `docker compose up -d --build`.

## 4. Caminho B — sem Docker

```bash
# 1) banco
createdb revalida
psql -d revalida -v ON_ERROR_STOP=1 -f db/schema.sql      # idempotente
# (opcional) estações de exemplo
pip install "psycopg[binary]" && DATABASE_URL=postgres://usuario:senha@localhost:5432/revalida python3 python/seed.py

# 2) API
cd server && cp .env.example .env     # edite (§5)
npm install --omit=dev
DATABASE_URL=postgres://usuario:senha@localhost:5432/revalida npm start     # porta 3001

# 3) Web
cd ../web && npm install && npm run build      # gera web/dist
```

Sirva `web/dist` por um servidor web (Nginx/Caddy) e encaminhe `/api/` e `/socket.io/` (com WebSocket) para a API. Exemplo de Nginx em `web/nginx.conf`; exemplo de Caddy:

```
treino.seudominio.com {
  root * /var/www/revalida/dist
  encode gzip
  handle /api/*       { reverse_proxy 127.0.0.1:3001 }
  handle /socket.io/* { reverse_proxy 127.0.0.1:3001 }
  handle              { try_files {path} /index.html
                        file_server }
}
```
Caddy emite o certificado HTTPS sozinho. Para manter a API ligada, use `systemd` ou `pm2`.

## 5. Variáveis de ambiente (`server/.env`)

| Variável | Obrigatória | Para quê |
|---|---|---|
| `NODE_ENV` | sim | `production` em instalação real (o script define). |
| `JWT_SEGREDO` | **sim** | 32+ caracteres aleatórios. A API **recusa subir** em produção com valor curto ou com o texto de exemplo. Gera os segredos cifrados do banco: **trocar depois torna ilegíveis** os segredos já guardados (reconfigure-os). |
| `APP_URL` | sim | Endereço público (https). Entra nos links de e-mail. |
| `DATABASE_URL` | sim* | *No Compose já vem definida. |
| `ROOT_EMAIL` / `ROOT_SENHA` | sim | Conta root criada na partida. A senha do exemplo é **fraca**: o app a trata como provisória e pede troca. |
| `ROOT_SENHA_REDEFINIR` | não | `1` = redefine a senha do root a partir daqui **na próxima partida** (recuperação). Volte para `0`. |
| `SMTP_URL`, `EMAIL_DE` | recomendado | E-mail de recuperação/aprovação. **Em produção sem SMTP o link não aparece em lugar nenhum** (só em desenvolvimento ele vai para o log). |
| `AGORA_APP_ID`, `AGORA_APP_CERTIFICATE` | para vídeo | Sem elas a sala abre em **modo demo** (telas simuladas). |
| `INSTALL_CODE` | não | Fixa o código do instalador (instalação automatizada). |
| `PHP_TOKEN_URL` | não | Endpoint reserva de token de vídeo (`php/token.php`). |
| Chaves de IA | não | `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `IA_ORDEM`… (ver instalador). **Nunca** no front-end. |

Variável de ambiente **sempre vence** o que foi salvo pelo instalador e aparece bloqueada na tela.

## 6. Primeiro acesso: o instalador

1. Abra o site: sem instalação concluída ele mostra o **instalador**.
2. Informe o **código de instalação** (impresso no log: `docker compose logs api | grep "Código de instalação"`). 10 erros bloqueiam o IP por 15 min.
3. **Verificação:** banco, estrutura, `JWT_SEGREDO`, `APP_URL`, proxy, SMTP, Agora e (no navegador) HTTPS e `/socket.io`. Corrija o que estiver vermelho.
4. **Parâmetros:** nome da instituição, remetente, SMTP, Agora. Segredos são cifrados (AES-256-GCM).
5. **Administradores:** defina a senha **definitiva** do root e crie admins/moderadores (é preciso ao menos um admin com senha definitiva).
6. **Concluir:** as rotas `/api/instalacao/*` passam a responder 403 para sempre. Reabrir só pelo root (Admin → Sistema) ou pelo comando `npm run reinstalar`.

## 7. HTTPS, proxy e vídeo

- Sem HTTPS a sala não abre câmera/microfone. O instalador avisa.
- O proxy deve repassar `X-Forwarded-For` (limite de tentativas de login por IP) e o **WebSocket** em `/socket.io/`.
- **Agora:** crie um projeto com certificado, coloque App ID e Certificate no `.env` ou no instalador. Para conferir que **observador não é ouvido** antes da liberação do chefe, faça uma sala com 3 contas reais.

## 8. Operação

- **Backup:** `bash scripts/backup.sh [pasta]` (pg_dump comprimido). Faça **antes** de atualizar e teste a restauração.
- **Restaurar:** `bash scripts/restaurar.sh backups/arquivo.sql.gz --sim` (**apaga** o banco atual).
- **Atualizar:** `bash scripts/atualizar.sh` (backup → migrações de `db/migracoes` em ordem, idempotentes → rebuild). Depois `bash scripts/verificar.sh`.
- **Logs:** `docker compose logs -f api`. Não há telemetria embutida: monitore `GET /api/saude`, CPU/memória, conexões do Postgres e 5xx do Nginx.
- **Perdeu a senha do root?** "Esqueci minha senha" (precisa de SMTP) ou suba a API uma vez com `ROOT_SENHA_REDEFINIR=1`. Perdeu o acesso total: `npm run reinstalar` no servidor.
- **Escala:** a API é de instância única (Socket.IO sem adaptador). Não coloque duas réplicas sem antes adicionar o adaptador.

## 9. Smoke test antes de abrir ao público (30 minutos)

1. `bash scripts/verificar.sh https://seu-dominio` sem falhas (avisos de https/proxy devem sumir em produção).
2. Instalador concluído; login com o root e **troca da senha**.
3. Crie 3 contas: *chefe/avaliador*, *candidato*, *observador*. Em 3 navegadores/aparelhos, entre na mesma sala.
4. Câmeras aparecem para todos; o **observador não é ouvido** até o chefe liberar.
5. Monte um ciclo com uma estação, inicie, faça a transcrição (permita o microfone), finalize e confira **nota no servidor**, análise e cartões.
6. "Esqueci minha senha" entrega o e-mail (SMTP) e o link funciona uma vez.
7. Reinicie a API e a máquina: nada se perde, e o instalador **não** reabre.
8. Faça um backup e restaure em um banco de teste.

## 10. Problemas comuns

| Sintoma | Causa provável | O que fazer |
|---|---|---|
| API não sobe em produção: "Defina JWT_SEGREDO…" | Segredo curto ou o texto de exemplo | Gere um com `openssl rand -hex 32`. |
| Câmera/microfone bloqueados | Sem HTTPS | Use domínio com certificado. |
| Sala sem tempo real | Proxy não repassa WebSocket | Ver `/socket.io/` no §4; `verificar.sh` avisa. |
| Instalador pede código | Código muda a cada início | Veja o log da API (ou fixe `INSTALL_CODE`). |
| Recuperação de senha "não chega" | Sem SMTP em produção | Configure `SMTP_URL`. |
| Segredos salvos "sumiram" após trocar `JWT_SEGREDO` | Chave de cifra derivada dele | Reconfigure no instalador/Admin. |
| `createdb`/`psql` falham | Postgres parado | Inicie o serviço e confira `DATABASE_URL`. |

## 11. Desinstalar

`docker compose down` mantém os dados; `docker compose down -v` **apaga o volume do banco**. Faça backup antes.

## Publicação automática na VPS (GitHub → VPS)

O repositório `LACibermedicina/revalida` publica sozinho na VPS **159.223.22.82**, em **https://revalida.m3d.pro**,
a cada envio para a branch `main` que mexa em `app/` (arquivo `.github/workflows/publicar-vps.yml`).

**Como funciona:** o GitHub copia `app/` para `/opt/revalida/app` na VPS (sem apagar nada lá e sem tocar nos `.env`
nem nos backups) e roda `scripts/vps-preparar.sh --dominio revalida.m3d.pro`, que:

1. instala o Docker, se faltar;
2. na primeira vez, escolhe **portas livres acima de 1000** (site a partir de 8180, API a partir de 13001,
   banco a partir de 15432), grava em `app/.env` e prende tudo em `127.0.0.1` (nada fica exposto direto);
3. instala (primeira vez) ou atualiza (backup → migrações → rebuild);
4. configura o **proxy reverso** `revalida.m3d.pro → 127.0.0.1:<porta do site>` no nginx (ou no Caddy, se for o que
   a VPS usa; sem nenhum dos dois, instala o nginx) e pede o **certificado HTTPS** ao Let's Encrypt;
5. confere se o app responde.

**Configuração única:**

1. DNS: registro **A** `revalida` em `m3d.pro` apontando para `159.223.22.82` (na Cloudflare, deixe a nuvem cinza
   até o certificado sair).
2. Chave SSH só para a publicação, no seu computador: `ssh-keygen -t ed25519 -f revalida-deploy -N ""`.
   Copie o conteúdo de `revalida-deploy.pub` para o fim de `/root/.ssh/authorized_keys` na VPS.
3. No GitHub: **Settings → Secrets and variables → Actions → New repository secret**, nome `VPS_SSH_KEY`,
   valor = conteúdo do arquivo `revalida-deploy` (a chave privada).
4. **Actions → Publicar na VPS → Run workflow.**

A senha do usuário root do app e o código do instalador **não aparecem no log do GitHub**: na VPS, rode
`cat /root/revalida-credenciais.txt`. Para trocar host, usuário, pasta, domínio ou e-mail do certificado, crie as
variáveis `VPS_HOST`, `VPS_USER`, `VPS_PORT`, `VPS_DIR`, `DOMINIO` e `EMAIL_CERT` (aba **Variables**).
Na mão, dentro da VPS: `cd /opt/revalida/app && bash scripts/vps-preparar.sh --dominio revalida.m3d.pro`.
