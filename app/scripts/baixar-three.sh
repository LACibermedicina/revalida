#!/usr/bin/env bash
# Baixa o three.js r128 (usado pelo mascote 3D) para web/public/vendor/three.min.js, para o app funcionar sem CDN.
# Precisa de acesso ao registro npm. Uso: bash scripts/baixar-three.sh
set -euo pipefail
cd "$(dirname "$0")/.."
T="$(mktemp -d)"; trap 'rm -rf "$T"' EXIT
( cd "$T" && npm pack three@0.128.0 --silent >/dev/null && tar -xzf three-0.128.0.tgz package/build/three.min.js )
mkdir -p web/public/vendor
cp "$T/package/build/three.min.js" web/public/vendor/three.min.js
echo "ok: web/public/vendor/three.min.js ($(wc -c < web/public/vendor/three.min.js) bytes)"
