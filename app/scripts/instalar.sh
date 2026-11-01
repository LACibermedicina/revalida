#!/usr/bin/env bash
# Instalação guiada do Revalida Prático com Docker Compose (Linux/macOS/WSL).
# Uso: bash scripts/instalar.sh [--url https://treino.exemplo.com] [--sem-semente] [--so-config]
set -euo pipefail
cd "$(dirname "$0")/.."

URL=""; SEMENTE=1; SO_CONFIG=0
while [ $# -gt 0 ]; do
  case "$1" in
    --url) URL="${2:-}"; shift 2 ;;
    --sem-semente) SEMENTE=0; shift ;;
    --so-config) SO_CONFIG=1; shift ;;
    -h|--help) sed -n '2,4p' "$0"; exit 0 ;;
    *) echo "Opção desconhecida: $1" >&2; exit 2 ;;
  esac
done

ok()  { printf '\033[32m✔\033[0m %s\n' "$*"; }
av()  { printf '\033[33m!\033[0m %s\n' "$*"; }
erro(){ printf '\033[31m✘\033[0m %s\n' "$*" >&2; }

gerar_segredo() {
  if command -v openssl >/dev/null 2>&1; then openssl rand -hex 32
  else head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n'; fi
}

# 1) requisitos
if [ "$SO_CONFIG" -eq 0 ]; then
  command -v docker >/dev/null 2>&1 || { erro "Docker não encontrado. Instale: https://docs.docker.com/get-docker/"; exit 1; }
  docker compose version >/dev/null 2>&1 || { erro "Docker Compose v2 não encontrado (comando 'docker compose')."; exit 1; }
  docker info >/dev/null 2>&1 || { erro "O serviço do Docker não está em execução."; exit 1; }
  ok "Docker e Compose disponíveis"
fi

# 2) configuração (.env) — nunca sobrescreve um .env existente
ENVF="server/.env"
if [ -f "$ENVF" ]; then
  av "$ENVF já existe: mantido sem alterações."
else
  cp server/.env.example "$ENVF"
  SEG="$(gerar_segredo)"
  sed -i.bak "s|^JWT_SEGREDO=.*|JWT_SEGREDO=${SEG}|" "$ENVF"
  [ -n "$URL" ] && sed -i.bak "s|^APP_URL=.*|APP_URL=${URL}|" "$ENVF"
  RSENHA="$(gerar_segredo | cut -c1-20)Aa1!"
  sed -i.bak "s|^ROOT_SENHA=.*|ROOT_SENHA=${RSENHA}|" "$ENVF"
  rm -f "$ENVF.bak"; chmod 600 "$ENVF"
  ok "Criado $ENVF com JWT_SEGREDO aleatório e senha do root gerada"
  echo "   E-mail do root : $(grep '^ROOT_EMAIL=' "$ENVF" | cut -d= -f2)"
  echo "   Senha do root  : ${RSENHA}   (anote agora; troque no primeiro acesso)"
fi
# instalação = produção (o .env.example vem com development para quem desenvolve)
if grep -q '^NODE_ENV=' "$ENVF"; then sed -i.bak "s|^NODE_ENV=.*|NODE_ENV=production|" "$ENVF" && rm -f "$ENVF.bak"; else echo "NODE_ENV=production" >> "$ENVF"; fi
if [ -n "$URL" ]; then
  case "$URL" in https://*|http://localhost*|http://127.0.0.1*) ;; *) av "APP_URL sem https: câmera e microfone só funcionam em https (ou localhost).";; esac
fi
[ "$SO_CONFIG" -eq 1 ] && { ok "Configuração pronta (--so-config)."; exit 0; }

# 3) subir
docker compose up -d --build
ok "Contêineres iniciados (db, api, web)"

# 4) esperar a API
echo -n "Aguardando a API"
for _ in $(seq 1 60); do
  if curl -fsS "http://localhost:3001/api/saude" >/dev/null 2>&1; then echo; ok "API respondendo"; break; fi
  echo -n "."; sleep 2
done
curl -fsS "http://localhost:3001/api/saude" >/dev/null 2>&1 || { echo; erro "A API não respondeu. Veja: docker compose logs api"; exit 1; }

# 5) semente opcional (estações de exemplo)
if [ "$SEMENTE" -eq 1 ] && command -v python3 >/dev/null 2>&1; then
  if python3 -c "import psycopg" >/dev/null 2>&1; then
    DATABASE_URL="postgres://revalida:revalida@localhost:5432/revalida" python3 python/seed.py && ok "Estações de exemplo semeadas"
  else
    av "Para semear exemplos: pip install 'psycopg[binary]' && python3 python/seed.py"
  fi
fi

# 6) instruções finais
CODIGO="$(docker compose logs api 2>/dev/null | grep -o 'Código de instalação: [A-Z0-9-]*' | tail -1 || true)"
echo
ok "Pronto. Abra ${URL:-http://localhost:5173} e conclua o instalador."
[ -n "$CODIGO" ] && echo "   $CODIGO"
echo "   Verificação: bash scripts/verificar.sh ${URL:-http://localhost:5173}"
