#!/usr/bin/env bash
# Restaura um backup (APAGA o banco atual). Uso: bash scripts/restaurar.sh backups/arquivo.sql.gz --sim
set -euo pipefail
cd "$(dirname "$0")/.."
ARQ="${1:-}"; [ -f "$ARQ" ] || { echo "Informe o arquivo de backup existente." >&2; exit 2; }
[ "${2:-}" = "--sim" ] || { echo "Isto apaga o banco atual. Repita com --sim para confirmar." >&2; exit 2; }
docker compose stop api
docker compose exec -T db psql -U revalida -d postgres -c "drop database if exists revalida" -c "create database revalida owner revalida"
gunzip -c "$ARQ" | docker compose exec -T db psql -U revalida -d revalida -v ON_ERROR_STOP=1 -q
docker compose start api
echo "Restauração concluída."
