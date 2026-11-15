#!/usr/bin/env bash
# Ações pontuais e destrutivas na VPS (rodam só quando pedidas: Actions > "Publicar na VPS" > Run workflow > ação + "SIM").
# Uso (como root, na pasta do app):
#   bash scripts/vps-acoes.sh zerar-app          apaga os dados do app (usuários, estações, progresso…) e reabre o instalador;
#                                                mantém os parâmetros já configurados (e-mail, Agora, IA…) e o server/.env
#   bash scripts/vps-acoes.sh apagar-copia-antiga remove a instalação antiga (projeto Docker "app": app-web, app-api, app-db)
# Sempre faz backup antes e só apaga se o backup deu certo. Backups: /opt/revalida/backups-acoes/
set -euo pipefail
if [ "$(id -u)" -ne 0 ]; then exec sudo -E bash "$0" "$@"; fi
cd "$(dirname "$0")/.."
ok()  { printf '\033[32m✔\033[0m %s\n' "$*"; }
av()  { printf '\033[33m!\033[0m %s\n' "$*"; }
erro(){ printf '\033[31m✘\033[0m %s\n' "$*" >&2; }
titulo(){ printf '\n\033[1m== %s ==\033[0m\n' "$*"; }
DEST=/opt/revalida/backups-acoes; mkdir -p "$DEST"; chmod 700 "$DEST"
QUANDO="$(date +%Y%m%d-%H%M%S)"

esperar_banco(){ for i in $(seq 1 60); do docker compose exec -T db pg_isready -U revalida -d revalida -q 2>/dev/null && return 0; sleep 2; done; erro "O banco não ficou pronto."; return 1; }
backup_ok(){ [ -s "$1" ] && gzip -t "$1" 2>/dev/null && [ "$(gzip -dc "$1" | head -c 200000 | grep -c 'PostgreSQL database dump')" -gt 0 ]; }

zerar_app(){
  titulo "Zerar o app (mantendo os parâmetros)"
  docker compose up -d db >/dev/null; esperar_banco
  F="$DEST/app-antes-de-zerar-$QUANDO.sql.gz"
  docker compose exec -T db pg_dump -U revalida -d revalida | gzip > "$F"
  backup_ok "$F" || { erro "Backup falhou: nada foi apagado."; exit 1; }
  ok "Backup completo: $F ($(du -h "$F" | cut -f1))"
  P="$DEST/parametros-$QUANDO.sql"
  docker compose exec -T db pg_dump -U revalida -d revalida --data-only --inserts --on-conflict-do-nothing -t config_servidor > "$P"
  grep -q "INSERT INTO" "$P" && ok "Parâmetros guardados ($(grep -c 'INSERT INTO' "$P") itens)" || av "Nenhum parâmetro gravado no banco para guardar."
  PROJ="$(grep -E '^COMPOSE_PROJECT_NAME=' .env 2>/dev/null | cut -d= -f2)"; PROJ="${PROJ:-revalida}"
  docker compose stop web api >/dev/null 2>&1 || true
  docker compose rm -sf db >/dev/null
  docker volume rm "${PROJ}_pgdata" >/dev/null
  ok "Banco antigo apagado (volume ${PROJ}_pgdata)"
  docker compose up -d db >/dev/null; esperar_banco
  for f in db/migracoes/*.sql; do docker compose exec -T db psql -U revalida -d revalida -v ON_ERROR_STOP=1 -q < "$f" >/dev/null; done
  ok "Banco novo criado, com a estrutura atual"
  if grep -q "INSERT INTO" "$P"; then
    docker compose exec -T db psql -U revalida -d revalida -q < "$P" >/dev/null
    docker compose exec -T db psql -U revalida -d revalida -q -c "delete from config_servidor where chave in ('instalado_em','reinstalacao_pendente')" >/dev/null
    ok "Parâmetros devolvidos (e-mail, Agora, nome da instituição…)"
  fi
  rm -f "$P"
  rm -f /root/revalida-credenciais.txt
  docker compose up -d >/dev/null
  for i in $(seq 1 30); do curl -fsS --max-time 5 "http://127.0.0.1:$(grep -E '^WEB_PORTA=' .env | cut -d= -f2)/api/instalacao/estado" 2>/dev/null | grep -q '"instalado":false' && break; sleep 2; done
  if curl -fsS --max-time 5 "http://127.0.0.1:$(grep -E '^WEB_PORTA=' .env | cut -d= -f2)/api/instalacao/estado" | grep -q '"instalado":false'; then
    ok "App zerado: o instalador está aberto de novo (use o código do segredo INSTALL_CODE)"
  else erro "O app subiu, mas não confirmou o instalador aberto."; exit 1; fi
}

apagar_copia_antiga(){
  titulo "Apagar a instalação antiga (projeto Docker \"app\")"
  mapfile -t CS < <(docker ps -a --filter label=com.docker.compose.project=app --format '{{.Names}}')
  if [ "${#CS[@]}" -eq 0 ]; then ok "Não há instalação antiga (projeto \"app\") nesta VPS."; return 0; fi
  echo "Contêineres do projeto antigo: ${CS[*]}"
  DB="$(docker ps -a --filter label=com.docker.compose.project=app --filter label=com.docker.compose.service=db --format '{{.Names}}' | head -1)"
  if [ -n "$DB" ]; then
    docker start "$DB" >/dev/null 2>&1 || true
    for i in $(seq 1 30); do docker exec "$DB" sh -c 'pg_isready -U "${POSTGRES_USER:-postgres}" -q' 2>/dev/null && break; sleep 2; done
    F="$DEST/copia-antiga-$QUANDO.sql.gz"
    docker exec "$DB" sh -c 'pg_dumpall -U "${POSTGRES_USER:-postgres}"' | gzip > "$F"
    backup_ok "$F" || { erro "Backup do banco antigo falhou: nada foi apagado."; exit 1; }
    ok "Backup do banco antigo: $F ($(du -h "$F" | cut -f1))"
  else av "A instalação antiga não tem contêiner de banco; seguindo sem backup de banco."; fi
  docker rm -f "${CS[@]}" >/dev/null
  mapfile -t VS < <(docker volume ls -q --filter label=com.docker.compose.project=app)
  [ "${#VS[@]}" -gt 0 ] && docker volume rm "${VS[@]}" >/dev/null
  mapfile -t NS < <(docker network ls -q --filter label=com.docker.compose.project=app)
  [ "${#NS[@]}" -gt 0 ] && docker network rm "${NS[@]}" >/dev/null 2>&1 || true
  ok "Instalação antiga removida: ${#CS[@]} contêiner(es), ${#VS[@]} volume(s). As portas 5173, 5008 e 5434 foram fechadas."
  docker image prune -f >/dev/null 2>&1 || true
}

case "${1:-}" in
  zerar-app) zerar_app ;;
  apagar-copia-antiga) apagar_copia_antiga ;;
  zerar-app-e-apagar-copia-antiga) apagar_copia_antiga; zerar_app ;;
  *) echo "Uso: bash scripts/vps-acoes.sh zerar-app | apagar-copia-antiga | zerar-app-e-apagar-copia-antiga" >&2; exit 2 ;;
esac
