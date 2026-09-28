#!/usr/bin/env bash
# То же, что init.ps1, для bash (WSL / Git Bash / Linux-VM).
set -euo pipefail
cd "$(dirname "$0")"

hurl() {
  local file=$1; shift
  local vars=()
  for v in "$@"; do vars+=(--variable "$v"); done
  echo ">>> $file $*"
  docker compose run --rm hurl \
    --insecure --variables-file /hurl-src/vars.env --file-root /hurl-files \
    --retry 30 --retry-interval 10000 --test \
    "${vars[@]}" "/hurl-src/$file"
}

hurl 01-cs.hurl
hurl 02-ss-base.hurl ss_host=ss0 ss_code=SS0 member_code=SS0-CODE "member_name=SS0-NAME"
hurl 03-ss0-management.hurl ss_host=ss0 ss_code=SS0
hurl 02-ss-base.hurl ss_host=ss1 ss_code=SS1 member_code=SS1-CODE "member_name=SS1-NAME"
hurl 02-ss-base.hurl ss_host=ss2 ss_code=SS2 member_code=SS2-CODE "member_name=SS2-NAME"
hurl 02-ss-base.hurl ss_host=ss3 ss_code=SS3 member_code=SS3-CODE "member_name=SS3-NAME"
hurl 04-consumer.hurl ss_host=ss1 member_code=SS1-CODE subsystem=CLIENT
hurl 05-provider.hurl ss_host=ss2 member_code=SS2-CODE subsystem=ECHO
hurl 05-provider.hurl ss_host=ss3 member_code=SS3-CODE subsystem=ECHO

echo "Done. Smoke test (подожди 1-2 мин на раздачу gconf):"
echo '  curl -s -H "X-Road-Client: DEV/MEMBER/SS1-CODE/CLIENT" "http://localhost:4210/r1/DEV/MEMBER/SS2-CODE/ECHO/echo?size=16"'
