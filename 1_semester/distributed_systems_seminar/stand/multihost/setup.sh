#!/usr/bin/env bash
# Подготовка машины для стенда на трёх машинах (среда B). Запускать на каждой, от root:
#   curl -fsSL https://raw.githubusercontent.com/Krios39/study/master/1_semester/distributed_systems_seminar/stand/multihost/setup.sh -o setup.sh
#   sudo bash setup.sh l1 <интерфейс к свитчу> [--access] [--tailscale] [--keys=URL]   # l1/l2/l3; интерфейс — ip -br link
# Bash, а не Node: на свежей машине Node ещё нет (ставится здесь же). Повторный запуск безопасен.
# Что делает: пакеты (git, docker + compose ≥ 2.24, chrony, ssh, node на l2) под apt/dnf/pacman/zypper; репозиторий в
# /opt/study (путь одинаковый на всех машинах — compose монтирует файлы стенда по абсолютному пути); статический адрес
# 10.10.0.N/24 на интерфейсе к свитчу; имена l1/l2/l3 в /etc/hosts; сон и крышка выключены; автообновления выключены;
# .env стенда (роль, интерфейс, диапазон адресов, пароль/PIN — одинаковые на всех трёх); образы скачаны заранее.
# После всех трёх машин — на l2: bash /opt/study/1_semester/distributed_systems_seminar/stand/multihost/link.sh
set -euo pipefail

ROLE="${1:-}"; IFACE="${2:-}"
case "$ROLE" in l1) N=1; RANGE=10.10.0.64/27 ;; l2) N=2; RANGE=10.10.0.96/27 ;; l3) N=3; RANGE=10.10.0.128/27 ;;
  *) echo "usage: sudo bash setup.sh l1|l2|l3 <iface-to-switch> [--access] [--tailscale] [--keys=URL]"; ls /sys/class/net; exit 2 ;; esac
[ -n "$IFACE" ] && [ -e "/sys/class/net/$IFACE" ] || { echo "interface '$IFACE' not found; есть: $(ls /sys/class/net | tr '\n' ' ')"; exit 2; }
[ "$(id -u)" = 0 ] || { echo "run with sudo"; exit 2; }
USER_NAME="${SUDO_USER:-root}"
REPO=/opt/study
STAND="$REPO/1_semester/distributed_systems_seminar/stand"
say() { printf '\n=== %s\n' "$*"; }

# ---------- пакеты ----------
. /etc/os-release
say "distro: ${PRETTY_NAME:-$ID} (ID=$ID ID_LIKE=${ID_LIKE:-})"
# Fedora Atomic / Universal Blue (Aurora, Bluefin, Bazzite): система неизменяемая, пакеты не ставим — docker, git, curl,
# chrony, sshd там уже есть (aurora-dx); чего нет — сообщаем. Node для bench на l2 — через brew (есть в Universal Blue)
if command -v rpm-ostree >/dev/null && [ -e /run/ostree-booted ]; then PM=ostree
elif command -v apt-get >/dev/null; then PM=apt
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
    ostree) return 1 ;;
  esac
}
try_install() {
  if [ "$PM" = ostree ]; then   # не ставим, только проверяем нужные команды
    for p in "$@"; do case $p in openssh*) c=sshd ;; iputils*) c=ping ;; iproute*) c=ip ;; nodejs) c=node ;; *) c=$p ;; esac
      command -v "$c" >/dev/null || [ -x "/usr/sbin/$c" ] && echo "  = $p (есть)" || echo "  !! $p нет — atomic: brew install $p или rpm-ostree install $p + перезагрузка"; done
    return 0
  fi
  for p in "$@"; do install "$p" >/dev/null 2>&1 && echo "  + $p" || echo "  - $p (нет в репозитории)"; done
}

# ---------- флаги ----------
# --access        только удалённый доступ (на месте, быстро): ssh, ключи, адрес к свитчу, без сна; без docker и образов
# --tailscale     + Tailscale (исходящее соединение — работает за NAT/eduroam без входящих портов); вход по ссылке
# --keys=<url|файл>  открытые ssh-ключи в authorized_keys (по умолчанию https://github.com/Krios39.keys)
ACCESS=0; TAILSCALE=0; KEYS=https://github.com/Krios39.keys
for a in "${@:3}"; do case "$a" in
  --access) ACCESS=1 ;; --tailscale) TAILSCALE=1 ;; --keys=*) KEYS="${a#--keys=}" ;;
  *) echo "unknown option $a"; exit 2 ;; esac; done

lan_setup() {
  say "static 10.10.0.$N/24 on $IFACE"
  # Если на проводе уже есть рабочий адрес по DHCP (свитч соединён с розеткой кафедры, через провод и заходят) —
  # 10.10.0.N добавляется ВТОРЫМ адресом к существующему подключению; заменить его = потерять доступ посреди установки.
  # Сначала сразу (без переподключения), потом постоянно.
  ip addr replace "10.10.0.$N/24" dev "$IFACE"
  local cur=""; command -v nmcli >/dev/null && cur=$(nmcli -g GENERAL.CONNECTION dev show "$IFACE" 2>/dev/null || true)
  if command -v nmcli >/dev/null && systemctl is-active --quiet NetworkManager && [ -n "$cur" ] && [ "$cur" != xroad-lan ] \
     && [ "$(nmcli -g ipv4.method con show "$cur")" = auto ]; then
    echo "  на $IFACE уже DHCP ('$cur') — добавляю адрес к нему"
    nmcli con mod "$cur" -ipv4.addresses "10.10.0.$N/24" >/dev/null 2>&1 || true
    nmcli con mod "$cur" +ipv4.addresses "10.10.0.$N/24"
    nmcli dev reapply "$IFACE" >/dev/null 2>&1 || true
  elif command -v nmcli >/dev/null && systemctl is-active --quiet NetworkManager; then
    nmcli con delete xroad-lan >/dev/null 2>&1 || true
    nmcli con add type ethernet ifname "$IFACE" con-name xroad-lan ipv4.method manual ipv4.addresses "10.10.0.$N/24" \
      ipv4.never-default yes ipv6.method disabled connection.autoconnect yes connection.autoconnect-priority 100 >/dev/null
    nmcli con up xroad-lan
  elif command -v netplan >/dev/null && [ -d /etc/netplan ]; then
    # Ubuntu Server: netplan сливает файлы — dhcp4 из основного остаётся, этот только добавляет адрес
    printf 'network:\n  version: 2\n  ethernets:\n    %s:\n      addresses: [10.10.0.%s/24]\n' "$IFACE" "$N" > /etc/netplan/90-xroad-stand.yaml
    chmod 600 /etc/netplan/90-xroad-stand.yaml
    # apply, а не только generate: адрес, добавленный руками, networkd может снять при продлении DHCP
    netplan apply && echo "  netplan: /etc/netplan/90-xroad-stand.yaml"
  elif [ -d /etc/network/if-up.d ] && grep -qsE "^\s*iface\s+$IFACE\s" /etc/network/interfaces /etc/network/interfaces.d/* 2>/dev/null; then
    # Debian без рабочего стола: ifupdown. Подключение по DHCP не трогаем — хук навешивает адрес при каждом подъёме
    printf '#!/bin/sh\n# xroad-stand (multihost/setup.sh): второй адрес на проводе к свитчу\n[ "$IFACE" = "%s" ] && ip addr replace 10.10.0.%s/24 dev "%s" || true\n' "$IFACE" "$N" "$IFACE" > /etc/network/if-up.d/xroad-stand
    chmod 755 /etc/network/if-up.d/xroad-stand
    echo "  ifupdown: /etc/network/if-up.d/xroad-stand"
  elif systemctl is-active --quiet systemd-networkd; then
    printf '[Match]\nName=%s\n\n[Network]\nAddress=10.10.0.%s/24\nLinkLocalAddressing=no\n' "$IFACE" "$N" > /etc/systemd/network/10-xroad-lan.network
    systemctl restart systemd-networkd
  else
    ip addr replace "10.10.0.$N/24" dev "$IFACE"; ip link set "$IFACE" up
    echo "  !! ни NetworkManager, ни systemd-networkd: адрес задан до перезагрузки — настроить постоянный вручную"
  fi
  # без sed -i: /etc/hosts бывает примонтирован (rename не проходит)
  { grep -v '# xroad-stand$' /etc/hosts; printf '10.10.0.1 l1 # xroad-stand\n10.10.0.2 l2 # xroad-stand\n10.10.0.3 l3 # xroad-stand\n'; } > /tmp/hosts.xroad
  cat /tmp/hosts.xroad > /etc/hosts
  ip -br addr show "$IFACE"
}

power_setup() {
  say "sleep / lid / auto-updates off"
  systemctl mask sleep.target suspend.target hibernate.target hybrid-sleep.target >/dev/null || echo "  !! не удалось выключить сон (systemctl mask)"
  mkdir -p /etc/systemd/logind.conf.d
  printf '[Login]\nHandleLidSwitch=ignore\nHandleLidSwitchExternalPower=ignore\nHandleLidSwitchDocked=ignore\nIdleAction=ignore\n' \
    > /etc/systemd/logind.conf.d/xroad-stand.conf
  # uupd/rpm-ostreed-automatic/bootc-fetch-apply-updates — автообновления образа в Universal Blue / Fedora Atomic
  for s in unattended-upgrades apt-daily.timer apt-daily-upgrade.timer dnf-automatic.timer dnf-makecache.timer packagekit \
           uupd.timer rpm-ostreed-automatic.timer bootc-fetch-apply-updates.timer flatpak-system-update.timer; do
    systemctl disable --now "$s" >/dev/null 2>&1 && echo "  - $s" || true
  done
  # Процессор в режиме производительности. В balanced (по умолчанию) малонагруженная машина не успевает поднять частоту
  # на коротких всплесках работы: 05.10 на трёх i5-8250U контроль был 79.7 мс в balanced и 28.7 мс в performance.
  # Профиль демона питания + служба, выставляющая governor/EPP при каждой загрузке (после tuned/power-profiles-daemon)
  say "CPU: performance"
  command -v powerprofilesctl >/dev/null && powerprofilesctl set performance 2>/dev/null || true
  command -v tuned-adm >/dev/null && tuned-adm profile throughput-performance 2>/dev/null || true
  cat > /etc/systemd/system/xroad-cpu-performance.service <<'UNIT'
[Unit]
Description=xroad-stand: CPU governor/EPP performance (multihost/setup.sh)
After=tuned.service power-profiles-daemon.service

[Service]
Type=oneshot
ExecStart=/bin/sh -c 'for f in /sys/devices/system/cpu/cpu*/cpufreq/scaling_governor /sys/devices/system/cpu/cpu*/cpufreq/energy_performance_preference; do [ -w "$f" ] && echo performance > "$f"; done; true'

[Install]
WantedBy=multi-user.target
UNIT
  systemctl daemon-reload && systemctl enable --now xroad-cpu-performance.service >/dev/null 2>&1 || echo "  !! xroad-cpu-performance.service"
  echo "  governor=$(cat /sys/devices/system/cpu/cpu0/cpufreq/scaling_governor 2>/dev/null || echo ?) epp=$(cat /sys/devices/system/cpu/cpu0/cpufreq/energy_performance_preference 2>/dev/null || echo ?)"
}

# сети docker — подальше от университетских: по умолчанию docker берёт 172.17–172.31.x, а учебный VPN выдаёт
# 172.18.64.0/23, eduroam — 172.31.208.0/21. Пересечение → ответы на ssh из VPN уходят в docker-мост, доступ теряется
docker_net_setup() {
  say "docker networks → 10.200.0.0/24, 10.201.0.0/16"
  mkdir -p /etc/docker
  if [ -s /etc/docker/daemon.json ] && ! grep -q '10.201.0.0' /etc/docker/daemon.json; then
    cp /etc/docker/daemon.json /etc/docker/daemon.json.bak; echo "  старый daemon.json → daemon.json.bak (заменён)"
  fi
  local want; want=$(printf '{\n  "bip": "10.200.0.1/24",\n  "default-address-pools": [{ "base": "10.201.0.0/16", "size": 24 }]\n}\n')
  # перезапуск docker останавливает все контейнеры стенда — только если настройки действительно меняются
  if [ "$(cat /etc/docker/daemon.json 2>/dev/null)" = "$want" ]; then echo "  daemon.json уже такой — docker не перезапускаю"; return 0; fi
  printf '%s\n' "$want" > /etc/docker/daemon.json
  if command -v docker >/dev/null; then
    systemctl restart docker 2>/dev/null || true
    echo "  docker перезапущен — контейнеры стенда остановлены, поднять: node bench/up.js (на l2)"
    { docker network ls --format '{{.Name}}' 2>/dev/null | grep -vE '^(bridge|host|none)$' || true; } | while read -r n; do
      sub=$(docker network inspect -f '{{range .IPAM.Config}}{{.Subnet}} {{end}}' "$n" 2>/dev/null)
      case "$sub" in 172.*) echo "  !! сеть $n ($sub) в 172.x — удалить, если не нужна: docker network rm $n" ;; esac
    done
  fi
}

keys_setup() {
  say "ssh keys → ~$USER_NAME/.ssh/authorized_keys ($KEYS)"
  local home; home=$(getent passwd "$USER_NAME" | cut -d: -f6)
  local k; if [ -f "$KEYS" ]; then k=$(cat "$KEYS"); else k=$(curl -fsSL "$KEYS" || true); fi
  [ -n "$k" ] || { echo "  !! ключей нет ($KEYS) — вход только по паролю"; return; }
  command install -d -m 700 -o "$USER_NAME" "$home/.ssh"      # command: не своя install() для пакетов
  touch "$home/.ssh/authorized_keys"
  printf '%s\n' "$k" | while read -r line; do [ -z "$line" ] || grep -qxF "$line" "$home/.ssh/authorized_keys" || echo "$line" >> "$home/.ssh/authorized_keys"; done
  chown "$USER_NAME": "$home/.ssh/authorized_keys"; chmod 600 "$home/.ssh/authorized_keys"
  echo "  $(wc -l < "$home/.ssh/authorized_keys") key(s)"
}

tailscale_setup() {
  say "tailscale"
  command -v tailscale >/dev/null || curl -fsSL https://tailscale.com/install.sh | sh
  systemctl enable --now tailscaled
  tailscale up --hostname="xroad-$ROLE" || true      # напечатает ссылку для входа — открыть на телефоне
  tailscale ip -4 2>/dev/null | sed 's/^/  tailscale ip: /' || true
}

# что помешает подключиться после перезагрузки без человека рядом
access_report() {
  say "access report: $ROLE"
  local st="?"; for u in sshd ssh; do systemctl cat "$u" >/dev/null 2>&1 && { st="$(systemctl is-active "$u" || true)/$(systemctl is-enabled "$u" || true)"; break; }; done
  echo "  user: $USER_NAME   sshd: $st (active/enabled — норма)"
  echo "  адреса (кроме свитча):"; ip -br -4 addr | grep -v "^lo\|^$IFACE\|docker\|br-\|veth" | sed 's/^/    /' || true
  echo "  маршрут наружу: $(ip route get 1.1.1.1 2>/dev/null | head -1)"
  # постоянный глобальный IPv6 (не temporary): обычно не меняется после перезагрузки — путь без VPN и Tailscale
  echo "  IPv6 (постоянные, для ssh -6):"
  ip -6 addr show scope global 2>/dev/null | grep inet6 | grep -v 'temporary\|deprecated' | awk '{print "    " $2 "  " $NF}' || true
  ip -6 addr show scope global 2>/dev/null | grep -q 'mngtmpaddr\|dynamic' && \
    echo "    (адрес из SLAAC; если в строке нет 'stable-privacy'/'noprefixroute' — может зависеть от MAC, он тоже постоянный)" || true
  if command -v nmcli >/dev/null; then
    nmcli -t -f NAME,TYPE,DEVICE con show --active | grep -v ':loopback:' | while IFS=: read -r name type dev; do
      case "$name" in xroad-lan|docker0|br-*|veth*) continue ;; esac
      ac=$(nmcli -g connection.autoconnect con show "$name"); perm=$(nmcli -g connection.permissions con show "$name")
      flags=$(nmcli -g 802-1x.password-flags,802-11-wireless-security.psk-flags con show "$name" 2>/dev/null | tr '\n' ' ')
      echo "  $name ($type, $dev): autoconnect=$ac permissions=${perm:-все} secret-flags=${flags:-—}"
      [ -n "$perm" ] && echo "    !! подключение только для одного пользователя — не поднимется до входа: nmcli con mod '$name' connection.permissions ''"
      case "$flags" in *1*) echo "    !! пароль хранится у пользователя (flags=1) — до входа в систему сеть не поднимется: nmcli con mod '$name' 802-1x.password-flags 0 802-11-wireless-security.psk-flags 0, затем ввести пароль ещё раз" ;; esac
    done
  fi
  lsblk -o NAME,TYPE 2>/dev/null | grep -q crypt && echo "  !! шифрованный диск: после перезагрузки ждёт пароль у экрана — удалённо не поднимется"
  systemctl is-enabled --quiet tailscaled 2>/dev/null && echo "  tailscale: $(tailscale ip -4 2>/dev/null | head -1) ($(tailscale status --self --peers=false 2>/dev/null | head -1 | awk '{print $2}'))"
  echo "  проверка: с телефона (модем) → VPN → ssh $USER_NAME@<IPv4 кафедры>, без VPN → ssh -6 $USER_NAME@<IPv6>;"
  echo "  потом sudo reboot и снова войти — адрес тот же? (крайний случай — --tailscale)"
}

if [ "$ACCESS" = 1 ]; then
  say "access-only ($PM)"
  case $PM in apt) apt-get update -qq ;; pacman) pacman -Sy --noconfirm >/dev/null ;; esac
  case $PM in
    apt) try_install openssh-server curl iputils-ping iproute2 ;; dnf) try_install openssh-server curl iputils iproute ;;
    *) try_install openssh curl iputils iproute2 ;;
  esac
  for s in ssh sshd; do systemctl enable --now "$s" >/dev/null 2>&1 && echo "  + $s" || true; done
  keys_setup; lan_setup; power_setup; docker_net_setup
  [ "$TAILSCALE" = 1 ] && tailscale_setup
  access_report
  exit 0
fi


say "packages ($PM)"
case $PM in apt) apt-get update -qq ;; pacman) pacman -Sy --noconfirm >/dev/null ;; esac
case $PM in
  apt)    try_install git curl ca-certificates chrony openssh-server iputils-ping iproute2 ;;
  dnf)    try_install git curl chrony openssh-server iputils iproute ;;
  pacman) try_install git curl chrony openssh iputils iproute2 ;;
  zypper) try_install git curl chrony openssh iputils iproute2 ;;
  ostree) try_install git curl chronyd openssh iputils iproute2 ;;
esac
if [ "$ROLE" = l2 ]; then
  case $PM in apt|dnf|pacman|ostree) try_install nodejs ;;
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

docker_net_setup

# ---------- службы ----------
say "services"
for s in docker chrony chronyd ssh sshd; do systemctl enable --now "$s" >/dev/null 2>&1 && echo "  + $s" || true; done
# в Fedora Atomic группа docker лежит в /usr/lib/group, а не в /etc/group — usermod её не видит; переносим (как ujust dx-group)
if ! grep -q '^docker:' /etc/group && grep -q '^docker:' /usr/lib/group 2>/dev/null; then grep '^docker:' /usr/lib/group >> /etc/group; fi
[ "$USER_NAME" != root ] && usermod -aG docker "$USER_NAME"

# ---------- репозиторий ----------
say "repo → $REPO"
if [ ! -d "$REPO/.git" ]; then git clone --depth 1 https://github.com/Krios39/study "$REPO"; else git -C "$REPO" pull --ff-only || true; fi
chown -R "$USER_NAME": "$REPO"

# ---------- сеть к свитчу, сон ----------
lan_setup
power_setup

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
