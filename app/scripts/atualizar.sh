#!/usr/bin/env bash
# Atualização: backup -> migrações pendentes -> rebuild. Uso: bash scripts/atualizar.sh
# As migrações em db/migracoes são idempotentes; rodá-las de novo é seguro.
set -euo pipefail
cd "$(dirname "$0")/.."
# o banco precisa estar no ar para o backup e as migrações (ex.: logo depois de reiniciar a VPS)
docker compose up -d db >/dev/null
for i in $(seq 1 60); do docker compose exec -T db pg_isready -U revalida -d revalida -q 2>/dev/null && break; sleep 2; done
docker compose exec -T db pg_isready -U revalida -d revalida -q || { echo "O banco não ficou pronto em 2 minutos (docker compose logs db)." >&2; exit 1; }
bash scripts/backup.sh
for f in db/migracoes/*.sql; do
  echo "Aplicando $f"
  docker compose exec -T db psql -U revalida -d revalida -v ON_ERROR_STOP=1 -q < "$f"
done
docker compose up -d --build
echo "Atualizado. Rode: bash scripts/verificar.sh"
