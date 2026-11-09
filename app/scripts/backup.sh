#!/usr/bin/env bash
# Backup do banco (Docker Compose). Uso: bash scripts/backup.sh [pasta_destino]
set -euo pipefail
cd "$(dirname "$0")/.."
DEST="${1:-backups}"; mkdir -p "$DEST"
ARQ="$DEST/revalida-$(date +%Y%m%d-%H%M%S).sql.gz"
docker compose exec -T db pg_dump -U revalida revalida | gzip > "$ARQ"
[ -s "$ARQ" ] && echo "Backup salvo em $ARQ ($(du -h "$ARQ" | cut -f1))" || { echo "Backup vazio: algo falhou" >&2; exit 1; }
