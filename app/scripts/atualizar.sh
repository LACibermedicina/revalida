#!/usr/bin/env bash
# Atualização: backup -> migrações pendentes -> rebuild. Uso: bash scripts/atualizar.sh
# As migrações em db/migracoes são idempotentes; rodá-las de novo é seguro.
set -euo pipefail
cd "$(dirname "$0")/.."
bash scripts/backup.sh
for f in db/migracoes/*.sql; do
  echo "Aplicando $f"
  docker compose exec -T db psql -U revalida -d revalida -v ON_ERROR_STOP=1 -q < "$f"
done
docker compose up -d --build
echo "Atualizado. Rode: bash scripts/verificar.sh"
