#!/usr/bin/env bash
# Configura a VPS para receber publicações automáticas do GitHub (Actions > "Publicar na VPS").
# Rode UMA vez na VPS, como root:
#   curl -fsSL https://raw.githubusercontent.com/LACibermedicina/revalida/main/app/scripts/vps-configurar-github.sh | sudo bash
# (ou copie este arquivo para a VPS e rode: sudo bash vps-configurar-github.sh)
# O que faz:
#   1. cria uma chave SSH só para o GitHub (ed25519) e a autoriza para o root desta VPS;
#   2. confere se o SSH aceita essa chave, qual a porta, o IP público e o DNS do domínio;
#   3. instala o rsync (usado na cópia);
#   4. mostra o segredo e as variáveis para colar no GitHub; depois apaga a chave privada daqui.
# Rodar de novo troca a chave (a antiga deixa de valer).
set -euo pipefail
DOMINIO="${DOMINIO:-revalida.m3d.pro}"
REPO="${REPO:-LACibermedicina/revalida}"
if [ "$(id -u)" -ne 0 ]; then echo "Rode como root:  sudo bash $0" >&2; exit 1; fi

ok()  { printf '\033[32m✔\033[0m %s\n' "$*"; }
av()  { printf '\033[33m!\033[0m %s\n' "$*"; }
erro(){ printf '\033[31m✘\033[0m %s\n' "$*" >&2; }
perguntar(){ local r=""; { read -r -p "$1" r < /dev/tty; } 2>/dev/null || true; echo "$r"; }

echo; echo "Configuração da publicação automática: GitHub ($REPO) -> esta VPS -> https://$DOMINIO"; echo

# 1) chave
command -v ssh-keygen >/dev/null 2>&1 || { command -v apt-get >/dev/null 2>&1 && DEBIAN_FRONTEND=noninteractive apt-get install -y -qq openssh-client >/dev/null; }
SSHD=/root/.ssh; mkdir -p "$SSHD"; chmod 700 "$SSHD"
CHAVE="$SSHD/revalida-github-deploy"; COMENT="github-actions-revalida"
rm -f "$CHAVE" "$CHAVE.pub"
ssh-keygen -q -t ed25519 -N "" -C "$COMENT" -f "$CHAVE"
AUTH="$SSHD/authorized_keys"; touch "$AUTH"; chmod 600 "$AUTH"
sed -i "/ $COMENT\$/d" "$AUTH"                       # remove a chave antiga desta ferramenta, se houver
cat "$CHAVE.pub" >> "$AUTH"
ok "Chave criada e autorizada para o root ($AUTH)"

# 2) SSH, IP e DNS
PORTA=22; RAIZ="?"; CHAVES="?"
if command -v sshd >/dev/null 2>&1 && sshd -T >/dev/null 2>&1; then
  PORTA="$(sshd -T 2>/dev/null | awk '$1=="port"{print $2; exit}')"; PORTA="${PORTA:-22}"
  RAIZ="$(sshd -T 2>/dev/null | awk '$1=="permitrootlogin"{print $2; exit}')"
  CHAVES="$(sshd -T 2>/dev/null | awk '$1=="pubkeyauthentication"{print $2; exit}')"
fi
case "$RAIZ" in
  no) erro "O SSH não aceita login de root (PermitRootLogin no). Mude para 'prohibit-password' em /etc/ssh/sshd_config e rode: systemctl reload ssh"; ;;
  *) ok "SSH na porta $PORTA (login de root: ${RAIZ}; chaves: ${CHAVES})" ;;
esac
if ssh -i "$CHAVE" -p "$PORTA" -o BatchMode=yes -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o ConnectTimeout=8 root@127.0.0.1 true 2>/dev/null; then
  ok "Teste: a chave nova entra no SSH desta VPS"
else
  av "Não consegui testar a chave localmente (pode ser só firewall no 127.0.0.1). Se a publicação falhar em 'Testar acesso', veja /etc/ssh/sshd_config."
fi
IP="$(curl -fsS4 --max-time 6 https://api.ipify.org 2>/dev/null || { hostname -I 2>/dev/null || true; } | awk '{print $1}')"
DNS="$( { getent ahostsv4 "$DOMINIO" 2>/dev/null || true; } | awk 'NR==1{print $1}')"
ok "IP público desta VPS: $IP"
if [ "$DNS" = "$IP" ]; then ok "DNS: $DOMINIO -> $IP"
elif [ -z "$DNS" ]; then av "DNS: $DOMINIO ainda não existe. Crie um registro A: revalida -> $IP (o app sobe sem HTTPS até o DNS valer)."
else av "DNS: $DOMINIO aponta para $DNS, não para $IP. Corrija o registro A (na Cloudflare, nuvem cinza)."; fi
if command -v ufw >/dev/null 2>&1 && ufw status 2>/dev/null | grep -q "Status: active"; then
  ufw allow "$PORTA"/tcp >/dev/null; ufw allow 80/tcp >/dev/null; ufw allow 443/tcp >/dev/null; ok "Firewall (ufw): $PORTA, 80 e 443 liberadas"
fi

# 3) rsync
if ! command -v rsync >/dev/null 2>&1; then
  if command -v apt-get >/dev/null 2>&1; then { DEBIAN_FRONTEND=noninteractive apt-get update -qq >/dev/null 2>&1 || true; } && DEBIAN_FRONTEND=noninteractive apt-get install -y -qq rsync >/dev/null || true; fi
fi
command -v rsync >/dev/null 2>&1 && ok "rsync instalado" || av "Instale o rsync: apt-get install -y rsync"

# 4) o que colar no GitHub
L="════════════════════════════════════════════════════════════════════"
echo; echo "$L"
echo " COLE NO GITHUB:  https://github.com/$REPO/settings/secrets/actions"
echo "$L"
echo
echo " 1) Aba \"Secrets\" > New repository secret"
echo "    Name:   VPS_SSH_KEY"
echo "    Secret: copie TUDO entre as linhas abaixo (inclusive BEGIN e END)"
echo "------------------------------------------------------------------------"
cat "$CHAVE"
echo "------------------------------------------------------------------------"
VARS=""
[ "$IP" != "159.223.22.82" ] && VARS="$VARS\n    VPS_HOST = $IP"
[ "$PORTA" != "22" ] && VARS="$VARS\n    VPS_PORT = $PORTA"
if [ -n "$VARS" ]; then
  echo; echo " 2) Aba \"Variables\" > New repository variable (uma por linha):"; printf "%b\n" "$VARS"
else
  echo; echo " 2) Variáveis: nenhuma necessária (IP 159.223.22.82, usuário root, porta 22, pasta /opt/revalida)."
fi
echo "    Opcional: EMAIL_CERT = seu e-mail (o Let's Encrypt avisa antes do certificado vencer)"
echo
echo " 3) Depois: https://github.com/$REPO/actions > \"Publicar na VPS\" > Run workflow"
echo "    Ao terminar, aqui na VPS:  cat /root/revalida-credenciais.txt   (senha do root e código do instalador)"
echo "$L"
echo

R="$(perguntar 'Já copiou a chave para o GitHub? Digite s para apagar a cópia daqui [s/N]: ')"
if [ "$R" = "s" ] || [ "$R" = "S" ]; then
  shred -u "$CHAVE" 2>/dev/null || rm -f "$CHAVE"
  ok "Chave privada apagada desta VPS (a pública continua autorizada)."
else
  av "A chave privada ficou em $CHAVE. Depois de colar no GitHub, apague com:  shred -u $CHAVE"
fi
