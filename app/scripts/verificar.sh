#!/usr/bin/env bash
# Verificação pós-instalação. Uso: bash scripts/verificar.sh [URL_DO_SITE] [URL_DA_API]
# Confere: saúde da API, página inicial, proxy /api, https, cabeçalho de WebSocket e estado do instalador.
set -uo pipefail
SITE="${1:-http://localhost:5173}"; API="${2:-http://localhost:3001}"
falhas=0; avisos=0
ok(){ printf '\033[32m✔\033[0m %s\n' "$*"; }
av(){ printf '\033[33m!\033[0m %s\n' "$*"; avisos=$((avisos+1)); }
no(){ printf '\033[31m✘\033[0m %s\n' "$*"; falhas=$((falhas+1)); }

r="$(curl -fsS "$API/api/saude" 2>/dev/null)" && ok "API saudável: $r" || no "API não respondeu em $API/api/saude"
curl -fsS -o /dev/null "$SITE/" 2>/dev/null && ok "Site responde em $SITE" || no "Site não respondeu em $SITE"
curl -fsS "$SITE/api/saude" >/dev/null 2>&1 && ok "Proxy /api funciona pelo site" || av "$SITE/api/saude não respondeu (proxy do Nginx/porta?)"
case "$SITE" in https://*) ok "Endereço em https (câmera/microfone liberados)";; http://localhost*|http://127.0.0.1*) av "localhost: ok para teste; em produção use https";; *) av "Sem https: câmera e microfone NÃO funcionam em http://IP";; esac
code="$(curl -s -o /dev/null -w '%{http_code}' "$SITE/socket.io/?EIO=4&transport=polling" 2>/dev/null)"
[ "$code" = "200" ] && ok "Socket.IO responde (polling)" || av "Socket.IO respondeu $code em $SITE/socket.io/ (confira o proxy de WebSocket)"
inst="$(curl -fsS "$SITE/api/instalacao/estado" 2>/dev/null || true)"
[ -n "$inst" ] && ok "Instalador acessível: $inst" || av "Instalador já concluído (esperado após instalar) ou rota indisponível"
echo; echo "Resultado: $falhas falha(s), $avisos aviso(s)."; [ "$falhas" -eq 0 ]
