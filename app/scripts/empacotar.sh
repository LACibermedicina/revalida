#!/usr/bin/env bash
# Gera o pacote completo: dist-pacote/revalida-pratico-AAAAMMDD.zip (+ .sha256), com dois diretórios:
#   app/       o aplicativo completo (server, web, desktop, mobile, watch, db, scripts, php, python, docs técnicos)
#   playbook/  playbook em 4 idiomas, manuais, marca e galeria de telas (abrem direto no navegador)
# Uso: bash scripts/empacotar.sh
set -euo pipefail
cd "$(dirname "$0")/.."
V="$(date +%Y%m%d)"; NOME="revalida-pratico"
SAIDA="dist-pacote"; TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
R="$TMP/$NOME"; mkdir -p "$SAIDA" "$R/app" "$R/playbook"
find docs -name __pycache__ -type d -prune -exec rm -rf {} + 2>/dev/null || true

# 1) app completo (sem o material de apresentação, que vai para playbook/)
tar --exclude='node_modules' --exclude='capturas' --exclude='dist' --exclude='dist-pacote' --exclude='backups' \
    --exclude='server/.env' --exclude='*.log' --exclude='__pycache__' --exclude='.git' \
    --exclude='./docs/playbook' --exclude='./docs/marca' --exclude='./docs/visualizacao' -cf - . | tar -xf - -C "$R/app"

# 2) playbook + manuais + marca + galeria
cp -r docs/playbook "$R/playbook/playbook"
cp -r docs/marca "$R/playbook/marca"
cp -r docs/visualizacao "$R/playbook/galeria-de-telas"
mkdir -p "$R/playbook/manuais"
cp docs/0*.md docs/modelo-de-dados.md docs/referencia-api.md "$R/playbook/manuais/"
find "$R" -name __pycache__ -type d -prune -exec rm -rf {} + 2>/dev/null || true
cat > "$R/playbook/LEIA-ME.txt" <<'TXT'
PLAYBOOK — REVALIDA PRÁTICO
===========================
Abra no navegador (não precisa instalar nada):
  playbook/playbook.html          playbook interativo em pt-BR, es, en e 中文 (roadmap imersivo, MER, fluxogramas)
  playbook/playbook.<idioma>.md   o mesmo em Markdown (diagramas Mermaid)
  marca/marca.html                folha da marca (símbolo, horizontal, ícone, paleta, uso) + SVGs
  galeria-de-telas/index.html     galeria visual das telas
  manuais/                        01 usuário · 02 desenvolvedor · 03 investidor · 04 técnico · 05 instalação · modelo de dados · API
Para regenerar o playbook depois de editar o conteúdo: python3 playbook/gerar.py  (fonte: conteudo.py e diagramas.py).
Honestidade: tudo foi testado em desenvolvimento (Postgres real, navegador automatizado); não em produção, vídeo ao vivo, SMTP, IA real, Docker ou apps nativos.
TXT
cat > "$R/LEIA-ME.txt" <<'TXT'
REVALIDA PRÁTICO — PACOTE COMPLETO
==================================
  app/        o aplicativo. Comece por app/LEIA-ME-PRIMEIRO.txt e app/docs/05-guia-de-instalacao.md
              (caminho curto: cd app && bash scripts/instalar.sh --url https://seu-dominio)
  playbook/   playbook interativo em 4 idiomas, manuais, marca e galeria de telas. Comece por playbook/LEIA-ME.txt
Integridade: sha256sum -c SHA256SUMS (dentro desta pasta).
TXT
python3 - "$R/app/LEIA-ME-PRIMEIRO.txt" <<'PY'
import sys,re
p=sys.argv[1]; s=open(p,encoding='utf-8').read()
s=re.sub(r'  (visualizacao/index\.html|playbook/playbook\.html|playbook/playbook\.<idioma>\.md)[^\n]*\n','',s)
s=s.replace('Aviso:','O playbook, a marca e a galeria de telas estão na pasta irmã ../playbook/.\n\nAviso:',1)
open(p,'w',encoding='utf-8').write(s)
PY
echo "$V" > "$R/VERSAO"; cp "$R/VERSAO" "$R/app/VERSAO"
( cd "$R" && find . -type f ! -name SHA256SUMS | sort | xargs sha256sum > SHA256SUMS )
rm -f "$SAIDA/$NOME-$V.zip"
( cd "$TMP" && zip -qr "$OLDPWD/$SAIDA/$NOME-$V.zip" "$NOME" )
( cd "$SAIDA" && sha256sum "$NOME-$V.zip" > "$NOME-$V.zip.sha256" )
echo "Pacote: $SAIDA/$NOME-$V.zip ($(du -h "$SAIDA/$NOME-$V.zip" | cut -f1))"
