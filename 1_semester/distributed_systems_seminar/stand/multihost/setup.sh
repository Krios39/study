#!/usr/bin/env bash
# Подготовка машины для стенда на трёх машинах (среда B). Запускать на каждой, от root:
#   curl -fsSL https://raw.githubusercontent.com/Krios39/study/master/1_semester/distributed_systems_seminar/stand/multihost/setup.sh -o setup.sh
#   sudo bash setup.sh l1 <интерфейс к свитчу>          # l1 | l2 | l3; интерфейс — ip -br link
# Bash, а не Node: на свежей машине Node ещё нет (ставится здесь же). Повторный запуск безопасен.
# Что делает: пакеты (git, docker + compose ≥ 2.24, chrony, ssh, node на l2) под apt/dnf/pacman/zypper; репозиторий в
# /opt/study (путь одинаковый на всех машинах — compose монтирует файлы стенда по абсолютному пути); статический адрес
# 10.10.0.N/24 на интерфейсе к свитчу; имена l1/l2/l3 в /etc/hosts; сон и крышка выключены; автообновления выключены;
# .env стенда (роль, интерфейс, диапазон адресов, пароль/PIN — одинаковые на всех трёх); образы скачаны заранее.
# После всех трёх машин — на l2: bash /opt/study/1_semester/distributed_systems_seminar/stand/multihost/link.sh
set -euo pipefail

ROLE="${1:-}"; IFACE="${2:-}"
case "$ROLE" in l1) N=1; RANGE=10.10.0.64/27 ;; l2) N=2; RANGE=10.10.0.96/27 ;; l3) N=3; RANGE=10.10.0.128/27 ;;
  *) echo "usage: sudo bash setup.sh l1|l2|l3 <iface-to-switch>"; ip -br link; exit 2 ;; esac
[ -n "$IFACE" ] && ip link show "$IFACE" >/dev/null 2>&1 || { echo "interface '$IFACE' not found:"; ip -br link; exit 2; }
[ "$(id -u)" = 0 ] || { echo "run with sudo"; exit 2; }
USER_NAME="${SUDO_USER:-root}"
REPO=/opt/study
STAND="$REPO/1_semester/distributed_systems_seminar/stand"
say() { printf '\n=== %s\n' "$*"; }

# ---------- пакеты ----------
. /etc/os-release
say "distro: ${PRETTY_NAME:-$ID} (ID=$ID ID_LIKE=${ID_LIKE:-})"
if command -v apt-get >/dev/null; then PM=apt
elif command -v dnf >/dev/null; then PM=dnf
elif command -v pacman >/dev/null; then PM=pacman
elif command -v zypper >/dev/null; then PM=zypper
else echo "unknown package manager — install git, docker, docker compose, chrony, openssh-server by hand"; exit 1; fi
install() {
  case $PM in
    apt) DEBIAN_FRONTEND=noninteractive apt-get install -y "$@" ;;
    dnf) dnf install -y "$@" ;;
    pacman) pacman -S --needed --noconfirm "$@" ;;
    zypper) zypper --non-interactive install "$@" ;;
  esac
}
try_install() { for p in "$@"; do install "$p" >/dev/null 2>&1 && echo "  + $p" || echo "  - $p (нет в репозитории)"; done; }

say "packages ($PM)"
case $PM in apt) apt-get update -qq ;; pacman) pacman -Sy --noconfirm >/dev/null ;; esac
case $PM in
  apt)    try_install git curl ca-certificates chrony openssh-server iputils-ping iproute2 ;;
  dnf)    try_install git curl chrony openssh-server iputils iproute ;;
  pacman) try_install git curl chrony openssh iputils iproute2 ;;
  zypper) try_install git curl chrony openssh iputils iproute2 ;;
esac
if [ "$ROLE" = l2 ]; then
  case $PM in apt|dnf|pacman) try_install nodejs ;;
    zypper) for p in nodejs-default nodejs24 nodejs22 nodejs20; do install "$p" >/dev/null 2>&1 && { echo "  + $p"; break; }; done ;; esac
fi

# docker: официальный скрипт (debian/ubuntu/fedora/centos/rhel), иначе пакеты дистрибутива
if ! command -v docker >/dev/null; then
  say "docker"
  if ! curl -fsSL https://get.docker.com | sh; then
    case $PM in
      apt) try_install docker.io docker-compose-v2 docker-compose-plugin ;;
      dnf) try_install moby-engine docker-compose ;;
      pacman) try_install docker docker-compose ;;
      zypper) try_install docker docker-compose ;;
    esac
  fi
fi
command -v docker >/dev/null || { echo "docker not installed — stop here and install it by hand"; exit 1; }
# compose ≥ 2.24 (multihost/compose.yml использует !reset); у дистрибутивов бывает старый или v1 — тогда плагин с GitHub
cv=$(docker compose version --short 2>/dev/null || echo 0)
if [ "$(printf '%s\n2.24.0\n' "${cv#v}" | sort -V | head -1)" != "2.24.0" ]; then
  say "docker compose $cv < 2.24 — installing plugin from GitHub"
  arch=$(uname -m); mkdir -p /usr/local/lib/docker/cli-plugins
  curl -fsSL "https://github.com/docker/compose/releases/latest/download/docker-compose-linux-$arch" -o /usr/local/lib/docker/cli-plugins/docker-compose
  chmod +x /usr/local/lib/docker/cli-plugins/docker-compose
fi
docker compose version

# ---------- службы ----------
say "services"
for s in docker chrony chronyd ssh sshd; do systemctl enable --now "$s" >/dev/null 2>&1 && echo "  + $s" || true; done
[ "$USER_NAME" != root ] && usermod -aG docker "$USER_NAME"

# ---------- репозиторий ----------
say "repo → $REPO"
if [ ! -d "$REPO/.git" ]; then git clone --depth 1 https://github.com/Krios39/study "$REPO"; else git -C "$REPO" pull --ff-only || true; fi
chown -R "$USER_NAME": "$REPO"

# ---------- сеть к свитчу ----------
say "static 10.10.0.$N/24 on $IFACE"
if command -v nmcli >/dev/null && systemctl is-active --quiet NetworkManager; then
  nmcli con delete xroad-lan >/dev/null 2>&1 || true
  nmcli con add type ethernet ifname "$IFACE" con-name xroad-lan ipv4.method manual ipv4.addresses "10.10.0.$N/24" \
    ipv4.never-default yes ipv6.method disabled connection.autoconnect yes connection.autoconnect-priority 100 >/dev/null
  nmcli con up xroad-lan
elif systemctl is-active --quiet systemd-networkd; then
  printf '[Match]\nName=%s\n\n[Network]\nAddress=10.10.0.%s/24\nLinkLocalAddressing=no\n' "$IFACE" "$N" > /etc/systemd/network/10-xroad-lan.network
  systemctl restart systemd-networkd
else
  ip addr replace "10.10.0.$N/24" dev "$IFACE"; ip link set "$IFACE" up
  echo "  !! ни NetworkManager, ни systemd-networkd: адрес задан до перезагрузки — настроить постоянный вручную"
fi
sed -i '/# xroad-stand$/d' /etc/hosts
printf '10.10.0.1 l1 # xroad-stand\n10.10.0.2 l2 # xroad-stand\n10.10.0.3 l3 # xroad-stand\n' >> /etc/hosts
ip -br addr show "$IFACE"

# ---------- не засыпать, не обновляться ----------
say "sleep / lid / auto-updates off"
systemctl mask sleep.target suspend.target hibernate.target hybrid-sleep.target >/dev/null
mkdir -p /etc/systemd/logind.conf.d
printf '[Login]\nHandleLidSwitch=ignore\nHandleLidSwitchExternalPower=ignore\nHandleLidSwitchDocked=ignore\nIdleAction=ignore\n' \
  > /etc/systemd/logind.conf.d/xroad-stand.conf
for s in unattended-upgrades apt-daily.timer apt-daily-upgrade.timer dnf-automatic.timer dnf-makecache.timer packagekit; do
  systemctl disable --now "$s" >/dev/null 2>&1 && echo "  - $s" || true
done

# ---------- .env стенда ----------
say ".env"
ENVF="$STAND/.env"
get() { [ -f "$ENVF" ] && sed -n "s/^$1=//p" "$ENVF" | head -1 || true; }
AU=$(get XROAD_ADMIN_USER); AP=$(get XROAD_ADMIN_PASSWORD); PIN=$(get XROAD_TOKEN_PIN)
if [ -z "$AP" ] || [ -z "$PIN" ]; then
  echo "  логин/пароль/PIN стенда — ОДИНАКОВЫЕ на всех трёх машинах"
  read -rp "  admin user [xrd]: " AU; AU=${AU:-xrd}
  read -rsp "  admin password: " AP; echo
  read -rsp "  token PIN: " PIN; echo
fi
cat > "$ENVF" <<EOF
# multihost/setup.sh $ROLE — $(date -Iseconds)
STAND_HOST=$ROLE
COMPOSE_FILE=docker-compose.yml:multihost/compose.yml
COMPOSE_PROFILES=$ROLE
LAN_IF=$IFACE
LAN_RANGE=$RANGE
XROAD_ADMIN_USER=$AU
XROAD_ADMIN_PASSWORD=$AP
XROAD_TOKEN_PIN=$PIN
EOF
chown "$USER_NAME": "$ENVF"; chmod 600 "$ENVF"

# ---------- образы заранее ----------
say "images"
cd "$STAND"
docker compose pull --ignore-buildable
case $ROLE in
  l1) docker compose build; docker compose --profile init pull hurl ;;
  l2) docker pull grafana/k6:latest; docker pull curlimages/curl:latest; docker compose --profile tools build netcount ;;
  l3) docker compose build ;;
esac

# ---------- итог ----------
say "done: $ROLE"
echo "  $(docker --version); compose $(docker compose version --short)"
[ "$ROLE" = l2 ] && echo "  node $(node --version 2>/dev/null || echo 'НЕТ — нужен Node >= 18')"
chronyc tracking 2>/dev/null | grep -E 'Reference|System time' || echo "  chrony: chronyc tracking недоступен"
echo "  перелогиниться (группа docker для $USER_NAME); крышку можно закрывать после: sudo systemctl restart systemd-logind (или перезагрузка)"
[ "$ROLE" != l2 ] || echo "  когда l1 и l3 готовы: bash $STAND/multihost/link.sh <user>@l1 <user>@l3"
