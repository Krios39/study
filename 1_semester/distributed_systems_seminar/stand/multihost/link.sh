#!/usr/bin/env bash
# На l2, от обычного пользователя, после setup.sh на всех трёх машинах:
#   bash multihost/link.sh <user>@l1 <user>@l3
# ssh-ключ l2 → l1/l3 (пароль спросит один раз), ~/.ssh/config с ControlMaster (bench делает сотни docker-вызовов
# на l1/l3 — без общего соединения каждый ждал бы ssh-рукопожатие), docker context l1/l3, проверка.
set -euo pipefail
[ $# -eq 2 ] || { echo "usage: bash link.sh <user>@l1 <user>@l3"; exit 2; }
[ "$(id -u)" != 0 ] || { echo "run as your user, not root"; exit 2; }
STAND="$(cd "$(dirname "$0")/.." && pwd)"

mkdir -p ~/.ssh/cm && chmod 700 ~/.ssh
[ -f ~/.ssh/id_ed25519 ] || ssh-keygen -t ed25519 -N '' -f ~/.ssh/id_ed25519 -q
for target in "$@"; do
  user="${target%@*}"; host="${target#*@}"
  if ! grep -q "^Host $host\$" ~/.ssh/config 2>/dev/null; then
    printf 'Host %s\n  User %s\n  StrictHostKeyChecking accept-new\n  ControlMaster auto\n  ControlPath ~/.ssh/cm/%%r@%%h:%%p\n  ControlPersist 30m\n  ServerAliveInterval 30\n\n' \
      "$host" "$user" >> ~/.ssh/config
  fi
  chmod 600 ~/.ssh/config
  ssh-copy-id -i ~/.ssh/id_ed25519.pub "$host"
  ssh "$host" "test -f '$STAND/.env' && grep -q '^STAND_HOST=$host\$' '$STAND/.env'" \
    || { echo "$host: no $STAND/.env with STAND_HOST=$host — run setup.sh $host there"; exit 1; }
  docker context rm -f "$host" >/dev/null 2>&1 || true
  docker context create "$host" --docker "host=ssh://$host" >/dev/null
  echo "$host: docker $(docker --context "$host" version --format '{{.Server.Version}}')"
done
echo "ok — дальше: cd $STAND && node bench/up.js --fresh && node bench/check.js"
