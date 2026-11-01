#!/usr/bin/env bash
# Gera o pacote de instalação: dist-pacote/revalida-pratico-AAAAMMDD.zip (+ SHA256SUMS).
# Uso: bash scripts/empacotar.sh
set -euo pipefail
cd "$(dirname "$0")/.."
V="$(date +%Y%m%d)"; NOME="revalida-pratico"
SAIDA="dist-pacote"; TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
mkdir -p "$SAIDA" "$TMP/$NOME"
tar --exclude='node_modules' --exclude='capturas' --exclude='dist' --exclude='dist-pacote' --exclude='backups' \
    --exclude='server/.env' --exclude='*.log' --exclude='__pycache__' --exclude='.git' -cf - . | tar -xf - -C "$TMP/$NOME"
echo "$V" > "$TMP/$NOME/VERSAO"
( cd "$TMP/$NOME" && find . -type f ! -name SHA256SUMS | sort | xargs sha256sum > SHA256SUMS )
rm -f "$SAIDA/$NOME-$V.zip"
( cd "$TMP" && zip -qr "$OLDPWD/$SAIDA/$NOME-$V.zip" "$NOME" )
( cd "$SAIDA" && sha256sum "$NOME-$V.zip" > "$NOME-$V.zip.sha256" )
echo "Pacote: $SAIDA/$NOME-$V.zip ($(du -h "$SAIDA/$NOME-$V.zip" | cut -f1))"
