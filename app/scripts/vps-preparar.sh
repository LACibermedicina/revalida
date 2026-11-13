#!/usr/bin/env bash
# Instala ou atualiza o Revalida Prático numa VPS Linux (Ubuntu/Debian), atrás de um proxy reverso com HTTPS.
# Uso (como root ou com sudo), dentro da pasta do app:
#   bash scripts/vps-preparar.sh --dominio revalida.m3d.pro [--email voce@exemplo.com] [--porta 8180] [--codigo-stdin]
#   (--env-stdin: lê da entrada um bloco KEY=VALOR com INSTALL_CODE e credenciais; o GitHub passa os segredos
#    INSTALL_CODE e SERVIDOR_ENV por aqui — nada vai para log, linha de comando ou repositório)
# O que faz (pode rodar quantas vezes quiser; é o que o GitHub Actions roda a cada atualização):
#   1. instala o Docker, se faltar;
#   2. escolhe portas livres acima de 1000 (só na primeira vez; ficam gravadas em .env) e prende o app em 127.0.0.1;
#   3. primeira vez: instala (scripts/instalar.sh); depois: atualiza (backup -> migrações -> rebuild);
#   4. configura o proxy reverso do domínio para a porta do app (nginx existente, Caddy existente ou instala nginx)
#      e o certificado HTTPS (Let's Encrypt), se o DNS do domínio já apontar para esta VPS;
#   5. confere se o app responde pela porta local e pelo domínio.
# Senha do root do app e código do instalador ficam só em /root/revalida-credenciais.txt (nunca no log).
set -euo pipefail
if [ "$(id -u)" -ne 0 ]; then exec sudo -E bash "$0" "$@"; fi
cd "$(dirname "$0")/.."
APP_DIR="$(pwd)"

DOMINIO=""; EMAIL=""; PORTA_PEDIDA=""; CODIGO_NOVO=""; ENTRADA=""
while [ $# -gt 0 ]; do
  case "$1" in
    --dominio) DOMINIO="${2:-}"; shift 2 ;;
    --email) EMAIL="${2:-}"; shift 2 ;;
    --porta) PORTA_PEDIDA="${2:-}"; shift 2 ;;
    --codigo-stdin) IFS= read -r CODIGO_NOVO || true; CODIGO_NOVO="$(printf '%s' "$CODIGO_NOVO" | tr -d '\r' | tr 'a-z' 'A-Z' | sed 's/^ *//; s/ *$//')"; shift ;;
    --env-stdin) ENTRADA="$(cat || true)"; shift ;;   # bloco KEY=VALOR (segredo SERVIDOR_ENV do GitHub + INSTALL_CODE)
    -h|--help) sed -n '2,14p' "$0"; exit 0 ;;
    *) echo "Opção desconhecida: $1" >&2; exit 2 ;;
  esac
done
[ -n "$DOMINIO" ] || { echo "Informe --dominio (ex.: --dominio revalida.m3d.pro)" >&2; exit 2; }

ok()  { printf '\033[32m✔\033[0m %s\n' "$*"; }
av()  { printf '\033[33m!\033[0m %s\n' "$*"; }
erro(){ printf '\033[31m✘\033[0m %s\n' "$*" >&2; }
titulo(){ printf '\n\033[1m== %s ==\033[0m\n' "$*"; }
export DEBIAN_FRONTEND=noninteractive
apt_instalar(){ command -v apt-get >/dev/null 2>&1 || { erro "Sem apt-get: instale manualmente: $*"; return 1; }; apt-get update -qq >/dev/null; apt-get install -y -qq "$@" >/dev/null; }

# ---------- 0) DNS ----------
titulo "DNS de $DOMINIO"
IP_VPS="$(curl -fsS4 --max-time 6 https://api.ipify.org 2>/dev/null || { hostname -I 2>/dev/null || true; } | awk '{print $1}')"
IP_DNS="$( { getent ahostsv4 "$DOMINIO" 2>/dev/null || true; } | awk 'NR==1{print $1}')"
DNS_OK=0
if [ -z "$IP_DNS" ]; then av "$DOMINIO ainda não resolve. Crie um registro A: $DOMINIO -> $IP_VPS (o HTTPS fica para a próxima execução)."
elif [ "$IP_DNS" != "$IP_VPS" ]; then av "$DOMINIO aponta para $IP_DNS, mas esta VPS é $IP_VPS (Cloudflare com proxy laranja também causa isso). O HTTPS pode falhar."
else DNS_OK=1; ok "$DOMINIO -> $IP_VPS"; fi

# ---------- 1) Docker ----------
titulo "Docker"
if ! command -v docker >/dev/null 2>&1; then
  av "Instalando o Docker…"; curl -fsSL https://get.docker.com | sh >/dev/null
fi
docker compose version >/dev/null 2>&1 || apt_instalar docker-compose-plugin
systemctl enable --now docker >/dev/null 2>&1 || true
docker info >/dev/null 2>&1 || { erro "O Docker não está rodando."; exit 1; }
ok "$(docker --version | cut -d, -f1) com Compose $(docker compose version --short 2>/dev/null)"
command -v ss >/dev/null 2>&1 || apt_instalar iproute2

# ---------- 2) portas (só escolhe na primeira vez) ----------
titulo "Portas"
ENVC="$APP_DIR/.env"; touch "$ENVC"; chmod 600 "$ENVC"
lerenv(){ { grep -E "^$1=" "$ENVC" 2>/dev/null || true; } | tail -1 | cut -d= -f2-; }
gravar(){ if grep -qE "^$1=" "$ENVC"; then sed -i "s|^$1=.*|$1=$2|" "$ENVC"; else echo "$1=$2" >> "$ENVC"; fi; }
ocupada(){ ss -ltnH 2>/dev/null | awk '{print $4}' | grep -qE "[:.]$1\$"; }
usadas=" "
livre_a_partir(){ local p="$1"; while ocupada "$p" || [[ "$usadas" == *" $p "* ]]; do p=$((p+1)); done; echo "$p"; }

if [ -z "$(lerenv COMPOSE_PROJECT_NAME)" ]; then
  # instalação antiga feita como projeto "app" (nome da pasta): mantém, para não perder o volume do banco
  if [ -f server/.env ] && docker volume inspect app_pgdata >/dev/null 2>&1; then gravar COMPOSE_PROJECT_NAME app; else gravar COMPOSE_PROJECT_NAME revalida; fi
fi
for v in WEB_PORTA API_PORTA DB_PORTA; do x="$(lerenv $v)"; if [ -n "$x" ]; then usadas="$usadas$x "; fi; done
if [ -z "$(lerenv WEB_PORTA)" ]; then
  if [ -n "$PORTA_PEDIDA" ]; then
    [ "$PORTA_PEDIDA" -gt 1000 ] 2>/dev/null || { erro "--porta deve ser maior que 1000"; exit 2; }
    ocupada "$PORTA_PEDIDA" && { erro "A porta $PORTA_PEDIDA já está em uso."; exit 1; }
    P="$PORTA_PEDIDA"
  else P="$(livre_a_partir 8180)"; fi
  gravar WEB_PORTA "$P"; usadas="$usadas$P "
fi
[ -n "$(lerenv API_PORTA)" ] || { P="$(livre_a_partir 13001)"; gravar API_PORTA "$P"; usadas="$usadas$P "; }
[ -n "$(lerenv DB_PORTA)" ]  || { P="$(livre_a_partir 15432)"; gravar DB_PORTA "$P"; usadas="$usadas$P "; }
gravar WEB_BIND 127.0.0.1; gravar API_BIND 127.0.0.1; gravar DB_BIND 127.0.0.1   # nada exposto direto na internet
WEB_PORTA="$(lerenv WEB_PORTA)"; API_PORTA="$(lerenv API_PORTA)"
ok "projeto $(lerenv COMPOSE_PROJECT_NAME): site 127.0.0.1:$WEB_PORTA · API 127.0.0.1:$API_PORTA · banco 127.0.0.1:$(lerenv DB_PORTA)"

# ---------- 3) app ----------
URL="https://$DOMINIO"
CRED=/root/revalida-credenciais.txt
INSTALOU=0
if [ ! -f server/.env ]; then
  titulo "Primeira instalação"
  umask 077
  if bash scripts/instalar.sh --url "$URL" > "$CRED.tmp" 2>&1; then
    { echo "Revalida Prático — instalação de $(date '+%d/%m/%Y %H:%M')"; echo "Endereço: $URL"; grep -E "E-mail do root|Senha do root|Código de instalação" "$CRED.tmp" | sed 's/\x1b\[[0-9;]*m//g'; } > "$CRED"
    grep -vE "Senha do root|Código de instalação" "$CRED.tmp" | sed 's/\x1b\[[0-9;]*m//g' || true
    rm -f "$CRED.tmp"; chmod 600 "$CRED"
    INSTALOU=1
    ok "Instalado. Senha do root e código do instalador: na VPS, rode  cat $CRED"
  else
    grep -vE "Senha do root|Código de instalação" "$CRED.tmp" | tail -40; rm -f "$CRED.tmp"; erro "A instalação falhou (veja acima)."; exit 1
  fi
else
  titulo "Atualização"
fi
# endereço público e proxies confiáveis (VPS: proxy reverso + nginx do container = 2)
if grep -q '^APP_URL=' server/.env; then sed -i "s|^APP_URL=.*|APP_URL=$URL|" server/.env; else echo "APP_URL=$URL" >> server/.env; fi
if grep -q '^TRUST_PROXY=' server/.env; then sed -i "s|^TRUST_PROXY=.*|TRUST_PROXY=2|" server/.env; else echo "TRUST_PROXY=2" >> server/.env; fi
# ---------- credenciais vindas do GitHub (segredo SERVIDOR_ENV): só as chaves que o app usa ----------
APLICADAS=""; IGNORADAS=""
if [ -n "$ENTRADA" ]; then
  PERMITIDAS=" SMTP_URL SMTP_HOST SMTP_PORT SMTP_SECURE SMTP_USER SMTP_PASS MAIL_FROM EMAIL_DE AGORA_APP_ID AGORA_APP_CERTIFICATE \
    ANTHROPIC_API_KEY IA_MODELO IA_ORDEM GEMINI_API_KEY GOOGLE_API_KEY GEMINI_CURL_API_KEY GEMINI_MODEL OPENAI_API_KEY OPENAI_MODEL \
    AI_INTEGRATIONS_OPENAI_BASE_URL AI_INTEGRATIONS_OPENAI_API_KEY POLLINATIONS_API_KEY POLLINATIONS_MODEL \
    TTS_URL TTS_CHAVE TTS_MODELO TTS_VOZ NOME_INSTITUICAO "
  while IFS= read -r linha || [ -n "$linha" ]; do
    linha="$(printf '%s' "$linha" | tr -d '\r' | sed -E 's/^[[:space:]]*(export[[:space:]]+)?//; s/[[:space:]]*,?[[:space:]]*$//')"
    # aceita KEY=VALOR, KEY: VALOR e "KEY": "VALOR"
    if [[ "$linha" =~ ^\"?([A-Za-z_][A-Za-z0-9_]*)\"?[[:space:]]*[=:][[:space:]]*(.*)$ ]]; then
      k="${BASH_REMATCH[1]}"; v="${BASH_REMATCH[2]}"
      v="$(printf '%s' "$v" | sed -E 's/^"(.*)"$/\1/; s/^'"'"'(.*)'"'"'$/\1/')"
      [ -n "$v" ] || continue
      if [ "$k" = INSTALL_CODE ]; then CODIGO_NOVO="$(printf '%s' "$v" | tr 'a-z' 'A-Z')"; continue; fi
      if [[ "$PERMITIDAS" != *" $k "* ]]; then IGNORADAS="$IGNORADAS $k"; continue; fi
      if [[ "$v" == *"'"* ]]; then erro "$k: o valor tem aspas simples; não aplicado."; continue; fi
      if [ "$k" = AI_INTEGRATIONS_OPENAI_BASE_URL ] && [[ "$v" =~ ^https?://(localhost|127\.|0\.0\.0\.0) ]]; then IGNORADAS="$IGNORADAS $k(localhost)"; continue; fi
      sed -i "/^#\\? *$k=/d" server/.env; printf "%s='%s'\n" "$k" "$v" >> server/.env
      APLICADAS="$APLICADAS $k"
    fi
  done <<< "$ENTRADA"
  [ -n "$APLICADAS" ] && ok "Credenciais do segredo SERVIDOR_ENV aplicadas:$(echo "$APLICADAS" | tr ' ' '\n' | sort -u | tr '\n' ' ')"
  [ -n "$IGNORADAS" ] && av "Ignoradas (o app não usa):$(echo "$IGNORADAS" | tr ' ' '\n' | sort -u | tr '\n' ' ')"
  chmod 600 server/.env
fi

# código do instalador fixo (sem isso a API sorteia outro a cada reinício e o código anotado deixa de valer)
# se veio um código escolhido (segredo INSTALL_CODE do GitHub), ele manda
if [ -n "$CODIGO_NOVO" ]; then
  if [ "${#CODIGO_NOVO}" -lt 6 ] || ! printf '%s' "$CODIGO_NOVO" | grep -qE '^[A-Z0-9_-]+$'; then
    erro "INSTALL_CODE do GitHub inválido: use 6 ou mais letras, números ou hífen (ignorado)."
  else
    sed -i '/^#\? *INSTALL_CODE=/d' server/.env; echo "INSTALL_CODE=$CODIGO_NOVO" >> server/.env
    ok "Código do instalador definido pelo segredo INSTALL_CODE do GitHub"
  fi
fi
if ! grep -qE '^INSTALL_CODE=.+' server/.env; then
  H="$(od -An -N6 -tx1 /dev/urandom | tr -d ' \n' | tr 'a-f' 'A-F')"
  sed -i '/^#\? *INSTALL_CODE=/d' server/.env; echo "INSTALL_CODE=${H:0:4}-${H:4:4}-${H:8:4}" >> server/.env
fi
CODIGO_INST="$(grep -E '^INSTALL_CODE=' server/.env | tail -1 | cut -d= -f2-)"
if [ "$INSTALOU" -eq 1 ]; then
  docker compose up -d --build >/dev/null   # recém-instalado: só aplica APP_URL/TRUST_PROXY
else
  bash scripts/atualizar.sh
fi
ok "Contêineres no ar"
# o contêiner da API está usando o código fixo? (compara sem mostrar o código)
EM_USO="$(docker compose exec -T api printenv INSTALL_CODE 2>/dev/null | tr -d '\r' || true)"
if [ "$EM_USO" != "$CODIGO_INST" ]; then
  av "A API ainda não usava o código fixo: recriando o contêiner da API…"
  docker compose up -d --force-recreate api >/dev/null 2>&1; sleep 5
  EM_USO="$(docker compose exec -T api printenv INSTALL_CODE 2>/dev/null | tr -d '\r' || true)"
fi
[ "$EM_USO" = "$CODIGO_INST" ] && ok "Código do instalador: a API usa o mesmo de server/.env" || erro "A API não está usando o código de server/.env"
# instalador ainda pendente? deixa o código certo no arquivo de credenciais
sleep 3
if curl -fsS --max-time 10 "http://127.0.0.1:$WEB_PORTA/api/instalacao/estado" 2>/dev/null | grep -q '"instalado":false'; then
  umask 077; touch "$CRED"
  if grep -q "Código de instalação" "$CRED"; then sed -i "s|Código de instalação.*|Código de instalação: $CODIGO_INST|" "$CRED"; else echo "  Código de instalação: $CODIGO_INST" >> "$CRED"; fi
  chmod 600 "$CRED"
  av "Instalador ainda não concluído: abra $URL e use o código que está em  cat $CRED"
fi

# ---------- 4) proxy reverso + HTTPS ----------
titulo "Proxy reverso $DOMINIO -> 127.0.0.1:$WEB_PORTA"
ativo(){ systemctl is-active --quiet "$1" 2>/dev/null; }
dono_porta(){ ss -ltnpH "( sport = :$1 )" 2>/dev/null | grep -o 'users:(("[^"]*' | head -1 | cut -d'"' -f2; }
MODO=""
if ativo nginx; then MODO=nginx
elif ativo caddy; then MODO=caddy
else
  D80="$(dono_porta 80)"; D443="$(dono_porta 443)"
  if [ -n "$D80$D443" ]; then
    erro "As portas 80/443 estão com outro programa (${D80:-?}/${D443:-?}), que não é nginx nem Caddy."
    echo "   Configure nele: $DOMINIO -> http://127.0.0.1:$WEB_PORTA (com suporte a WebSocket em /socket.io/)."; exit 1
  fi
  av "Nenhum proxy encontrado: instalando o nginx…"; apt_instalar nginx; systemctl enable --now nginx >/dev/null 2>&1; MODO=nginx
fi

if [ "$MODO" = nginx ]; then
  if [ -d /etc/nginx/sites-available ]; then CONF="/etc/nginx/sites-available/$DOMINIO.conf"; LINK="/etc/nginx/sites-enabled/$DOMINIO.conf"
  else CONF="/etc/nginx/conf.d/$DOMINIO.conf"; LINK=""; fi
  CERT="/etc/letsencrypt/live/$DOMINIO"
  bloco_proxy="    client_max_body_size 100m;
    location / {
        proxy_pass http://127.0.0.1:$WEB_PORTA;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection \$revalida_conexao;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 3600s;
        proxy_send_timeout 3600s;
    }"
  escrever_conf(){
    {
      echo "# Revalida Prático — gerado por app/scripts/vps-preparar.sh (é regravado a cada atualização)"
      echo "map \$http_upgrade \$revalida_conexao { default upgrade; '' close; }"
      if [ -f "$CERT/fullchain.pem" ]; then
        echo "server { listen 80; listen [::]:80; server_name $DOMINIO;"
        echo "    location /.well-known/acme-challenge/ { root /var/www/html; }"
        echo "    location / { return 301 https://\$host\$request_uri; } }"
        echo "server { listen 443 ssl; listen [::]:443 ssl; http2 on; server_name $DOMINIO;"
        echo "    ssl_certificate $CERT/fullchain.pem; ssl_certificate_key $CERT/privkey.pem;"
        [ -f /etc/letsencrypt/options-ssl-nginx.conf ] && echo "    include /etc/letsencrypt/options-ssl-nginx.conf;"
        echo "$bloco_proxy"; echo "}"
      else
        echo "server { listen 80; listen [::]:80; server_name $DOMINIO;"
        echo "    location /.well-known/acme-challenge/ { root /var/www/html; }"
        echo "$bloco_proxy"; echo "}"
      fi
    } > "$CONF"
    [ -n "$LINK" ] && ln -sf "$CONF" "$LINK"
    if ! nginx -t >/dev/null 2>&1; then
      # nginx antigo (< 1.25) não conhece "http2 on;"
      sed -i 's/listen 443 ssl; listen \[::\]:443 ssl; http2 on;/listen 443 ssl http2; listen [::]:443 ssl http2;/' "$CONF"
    fi
    nginx -t 2>&1 | grep -vi "syntax is ok\|test is successful" | sed "s/^/   nginx: /" || true; nginx -t >/dev/null 2>&1 && systemctl reload nginx
  }
  mkdir -p /var/www/html
  # outras configurações do mesmo domínio (de instalações antigas) roubam o tráfego: o nginx usa a primeira que achar
  ESTE="$(readlink -f "$CONF" 2>/dev/null || echo "$CONF")"
  for arq in $(grep -RlE "server_name[^;]*[[:space:]]$DOMINIO([[:space:];]|\$)" /etc/nginx/sites-enabled /etc/nginx/conf.d /etc/nginx/nginx.conf 2>/dev/null | sort -u); do
    real="$(readlink -f "$arq")"; [ "$real" = "$ESTE" ] && continue
    outros="$(grep -hoE 'server_name[^;]*' "$real" | sed 's/server_name//' | tr ' ' '\n' | grep -v "^$DOMINIO\$" | grep -v '^$' || true)"
    if [ -z "$outros" ] && [ "$real" != /etc/nginx/nginx.conf ]; then
      if [ -L "$arq" ]; then rm -f "$arq"; else mv "$arq" "$arq.desativado-revalida"; fi
      av "Desativada configuração antiga do $DOMINIO: $arq (o arquivo original continua em $real${real:+ }ou com sufixo .desativado-revalida)"
    else
      erro "O arquivo $real também declara $DOMINIO junto com outros sites ($(echo $outros | tr '\n' ' ')). Remova $DOMINIO dele à mão."
    fi
  done
  escrever_conf
  ok "nginx: $CONF"
  if [ ! -f "$CERT/fullchain.pem" ]; then
    if [ "$DNS_OK" -eq 1 ]; then
      command -v certbot >/dev/null 2>&1 || apt_instalar certbot python3-certbot-nginx
      if [ -n "$EMAIL" ]; then CB_MAIL=(-m "$EMAIL"); else CB_MAIL=(--register-unsafely-without-email); fi
      if certbot certonly --webroot -w /var/www/html -d "$DOMINIO" --non-interactive --agree-tos "${CB_MAIL[@]}" >/dev/null 2>&1; then
        escrever_conf; ok "HTTPS ativo (Let's Encrypt; renovação automática pelo certbot)"
      else av "Não consegui o certificado agora (o DNS propagou? a porta 80 está aberta?). Rode de novo depois."; fi
    else av "Sem HTTPS por enquanto: o DNS de $DOMINIO ainda não aponta para esta VPS."; fi
  else ok "Certificado HTTPS já existente"; fi
  # renovação recarrega o nginx
  mkdir -p /etc/letsencrypt/renewal-hooks/deploy 2>/dev/null && printf '#!/bin/sh\nsystemctl reload nginx\n' > /etc/letsencrypt/renewal-hooks/deploy/recarregar-nginx.sh && chmod +x /etc/letsencrypt/renewal-hooks/deploy/recarregar-nginx.sh || true
else
  CF=/etc/caddy/Caddyfile; touch "$CF"
  sed -i '/# revalida-inicio/,/# revalida-fim/d' "$CF"
  printf '# revalida-inicio (gerado por app/scripts/vps-preparar.sh)\n%s {\n    reverse_proxy 127.0.0.1:%s\n}\n# revalida-fim\n' "$DOMINIO" "$WEB_PORTA" >> "$CF"
  caddy validate --config "$CF" --adapter caddyfile >/dev/null 2>&1 && systemctl reload caddy
  ok "Caddy: $DOMINIO -> 127.0.0.1:$WEB_PORTA (o Caddy cuida do HTTPS sozinho)"
fi
if command -v ufw >/dev/null 2>&1 && ufw status 2>/dev/null | grep -q "Status: active"; then ufw allow 80/tcp >/dev/null; ufw allow 443/tcp >/dev/null; ok "Firewall (ufw): 80 e 443 liberadas"; fi

# ---------- 5) conferência ----------
titulo "Conferência"
falhou=0
echo "Contêineres em execução:"; docker ps --format '   {{.Names}}  {{.Ports}}' | sed 's/0.0.0.0/*/g'
A="$(curl -fsS --max-time 10 "http://127.0.0.1:$WEB_PORTA/" 2>/dev/null | sha256sum | cut -c1-12)"
B="$(curl -fsSk --max-time 10 --resolve "$DOMINIO:443:127.0.0.1" "https://$DOMINIO/" 2>/dev/null | sha256sum | cut -c1-12)"
[ "$B" = "$(printf '' | sha256sum | cut -c1-12)" ] && B="$(curl -fsS --max-time 10 -H "Host: $DOMINIO" "http://127.0.0.1/" 2>/dev/null | sha256sum | cut -c1-12)"
if [ "$A" = "$B" ]; then ok "O domínio $DOMINIO entrega ESTE app (porta $WEB_PORTA)"
else erro "O domínio $DOMINIO entrega OUTRA página que não este app (app $A ≠ domínio $B). Veja: grep -rn $DOMINIO /etc/nginx"; falhou=1; fi
curl -fsS --max-time 10 "http://127.0.0.1:$WEB_PORTA/" >/dev/null && ok "site responde em 127.0.0.1:$WEB_PORTA" || { erro "site não responde em 127.0.0.1:$WEB_PORTA"; falhou=1; }
curl -fsS --max-time 10 "http://127.0.0.1:$WEB_PORTA/api/saude" >/dev/null && ok "API responde pelo site" || { erro "API não responde (docker compose logs api)"; falhou=1; }
if curl -fsS --max-time 15 "$URL/api/saude" >/dev/null 2>&1; then ok "$URL no ar"
elif curl -fsS --max-time 15 -H "Host: $DOMINIO" "http://127.0.0.1/api/saude" >/dev/null 2>&1; then av "O proxy funciona, mas $URL ainda não abre de fora (DNS/HTTPS)."
else av "$URL ainda não responde."; fi
# parâmetros gravados pelo instalador (só os NOMES, nunca os valores) e estado da instalação
PARAMS="$(docker compose exec -T db psql -U revalida -d revalida -tAc "select string_agg(chave, ', ' order by chave) from config_servidor" 2>/dev/null | tr -d '\r' || true)"
echo "Parâmetros gravados no banco: ${PARAMS:-nenhum}"
grep -oE '^(SMTP_[A-Z]+|MAIL_FROM|EMAIL_DE|AGORA_[A-Z_]+)=' server/.env 2>/dev/null | sed 's/=$//' | tr '\n' ' ' | sed 's/^/Definidos no server\/.env (têm prioridade): /; s/$/\n/' || true
[ "$falhou" -eq 0 ] || exit 1
ok "Pronto: $URL"
