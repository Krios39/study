# Стенд на трёх машинах (среда B)

Три Linux-ноутбука в офисе, соединённые своим свитчем. Тот же стенд и тот же bench, что на одной машине; отличаются раскладка контейнеров и сеть.

```
        университетская сеть ── VPN ── доступ снаружи (только к l2)
                   │ (Wi-Fi или второй порт)
               [l2 10.10.0.2]  ss1 (consumer) + k6/curl, отсюда запускается bench
                   │
  ── свитч, изолированная подсеть 10.10.0.0/24, только для стенда ──
       │                                              │
 [l1 10.10.0.1]                                 [l3 10.10.0.3]
 cs, ca, ss0, ss3 (provider B), is-provider-b   ss2 (provider A), is-provider
```

- **Свитч изолирован**: кабель из университетской розетки в него не включать (MAC-адреса контейнеров и чужой трафик в подсети замеров). Внешний доступ — только у l2 (Wi-Fi или второй сетевой порт).
- **Сеть контейнеров — macvlan** на проводном интерфейсе к свитчу (`compose.yml`): у каждого контейнера свой адрес, без NAT и проброса портов; на одном адресе может быть только один SS (порты 5500/5577 фиксированы протоколом). Имена контейнеров на других машинах — `extra_hosts`; временные контейнеры bench (k6, curl) получают те же имена через `--add-host`.
- Хост не достаёт до своих macvlan-контейнеров — bench работает через `docker exec`, UI — туннелем через другую машину: `ssh -L 4000:10.10.0.10:4000 l2` → https://localhost:4000 (CS).
- У ss3 свой эхо-сервис на l1 (`is-provider-b`), чтобы оба провайдера отвечали из локального IS.
- `direct` (baseline-0) теперь идёт k6 (l2) → is-provider (l3) через свитч — это путь клиент → IS по сети, а не внутри одной машины.

## Установка

На каждой машине (адрес из `ip -br link` — интерфейс, воткнутый в свитч):

```bash
curl -fsSL https://raw.githubusercontent.com/Krios39/study/master/1_semester/distributed_systems_seminar/stand/multihost/setup.sh -o setup.sh
sudo bash setup.sh l1 enp0s31f6
```

`setup.sh`: пакеты под apt/dnf/pacman/zypper (git, docker + compose ≥ 2.24, chrony, ssh, node на l2), репозиторий в `/opt/study` (путь одинаковый на всех машинах — compose монтирует файлы стенда по абсолютному пути), `10.10.0.N/24` на интерфейсе (NetworkManager или systemd-networkd), `l1/l2/l3` в `/etc/hosts`, сон и крышка выключены, автообновления выключены, `.env` стенда (роль, профиль compose, интерфейс, диапазон адресов временных контейнеров; логин/пароль/PIN спросит — **одинаковые на всех трёх**), образы скачаны заранее. Повторный запуск безопасен.

Потом на l2, от своего пользователя:

```bash
bash /opt/study/1_semester/distributed_systems_seminar/stand/multihost/link.sh user@l1 user@l3
```

ssh-ключ l2 → l1/l3, `~/.ssh/config` с ControlMaster (bench делает сотни docker-вызовов на l1/l3), docker context `l1`/`l3`.

## Запуск

Всё с l2, из `/opt/study/1_semester/distributed_systems_seminar/stand`, теми же командами:

```bash
node bench/up.js --fresh     # compose на всех трёх (через ssh), init через hurl на l1 — ключи генерируются заново
node bench/check.js          # + docker на l1/l3, расхождение часов, ping по свитчу
node bench/night.js 2        # в tmux: tmux new -s night
```

`STAND_HOST` в `.env` включает многомашинный режим в `bench/lib.js`: контейнеры другой машины — `docker --context <host>`, compose — `ssh <host> docker compose …` в каталоге стенда (со своим `.env` той машины), hurl — на l1 (там volume с сертификатами testca), docker stats — по процессу на машину.

## Не проверено

Написано и проверено на одной машине (compose-раскладка через `docker compose config`, пакетная часть `setup.sh` в контейнерах Debian/Fedora/Arch/openSUSE/Mint); на трёх машинах ещё не запускалось. Первые вероятные места: имя интерфейса и NetworkManager, macvlan на конкретной сетевой карте, ssh-доступ l2 → l1/l3, расхождение часов.
