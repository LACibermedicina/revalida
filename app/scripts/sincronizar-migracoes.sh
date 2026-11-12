#!/usr/bin/env bash
# Copia db/migracoes para server/migracoes (a imagem da API só enxerga a pasta server/). Rode depois de criar uma migração.
set -euo pipefail
cd "$(dirname "$0")/.."
rm -rf server/migracoes && mkdir -p server/migracoes && cp db/migracoes/*.sql server/migracoes/
echo "server/migracoes sincronizada ($(ls server/migracoes | wc -l) arquivos)."
