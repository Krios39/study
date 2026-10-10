# Стенд X-Road 7.8.3 для замеров

## Топология

| Контейнер | Роль | Член | Подсистема | Admin UI (https) | IS http / https |
|---|---|---|---|---|---|
| `cs` | Central Server | — | — | :4000 | — |
| `ca` | тестовый CA + OCSP (:8888) + TSA (:8899) | — | — | — | — |
| `ss0` | management SS | DEV:MEMBER:SS0-CODE | MANAGEMENT | :4100 | :4110 / :4111 |
| `ss1` | consumer | DEV:MEMBER:SS1-CODE | CLIENT | :4200 | :4210 / :4211 |
| `ss2` | provider A | DEV:MEMBER:SS2-CODE | ECHO | :4300 | :4310 / :4311 |
| `ss3` | provider B | DEV:MEMBER:SS3-CODE | ECHO | :4400 | :4410 / :4411 |
| `is-provider` | эхо-сервис (`./echo`, Rust/axum) | — | — | — | :8081 (baseline-0) |

Логин, пароль админки и PIN токена — в `.env` (не в git): `cp .env.example .env` и заполнить до первого `up.js`. Его читают и `docker compose`, и `bench/lib.js` (передаёт в hurl). Ключи и сертификаты CA и SS генерируются при развёртывании (`up.js --fresh`), в репозитории их нет.
Admin UI **только по https**, серт самоподписанный.

## Три машины (среда B)

`multihost/` — тот же стенд на трёх Linux-ноутбуках со своим свитчем: `setup.sh` (подготовка каждой машины), `link.sh` (ssh и docker context с l2), `compose.yml` (раскладка и macvlan поверх `docker-compose.yml`). Bench тот же, запускается с l2; многомашинный режим включает `STAND_HOST` в `.env`. Подробно — `multihost/README.md`.

## Четыре команды

Всё на Node ≥ 18 без зависимостей, из папки `stand` в PowerShell:

```powershell
node bench/up.js                  # 1. поднять: compose up, ждать healthy, инициализировать (если ещё нет), дождаться ответа через X-Road
node bench/check.js               # 2. готов ли стенд: контейнеры, эхо, X-Road к обоим провайдерам, БД, конфигурация = full, лог testca, простой CPU, диагностика SS
node bench/run.js                 # 3. замер: контроль (full дважды) + полная сетка по bench/matrix.json → results/<дата>/, ~4 ч
node bench/analyze.js results\<дата>   # 4. сводка → summary.md / summary.csv
node bench/opmon.js results\<дата>     # этапы задержки из op-monitoring → opmon.md (run.js пишет opmon.json сам)
node bench/night.js 3                   # на ночь: 3 сетки подряд (~14 ч), каждая в свой каталог, авто-resume после обрыва, в конце объединённая сводка
```

`up.js --fresh` — снести volume'ы и поднять с нуля (~15 мин; после обрыва init иначе никак). `run.js --control` — только контроль (~5 мин), `--grid` — без контроля, `--resume results\<дата>` — продолжить после обрыва, `--only full,nobody` — часть конфигураций, `--dry` — показать план.

Между сетками стенд не пересоздаётся: `run.js` в конце возвращает конфигурацию `full`, `clean.js` чистит message log перед каждым прогоном.

Ручная проверка:

```powershell
curl.exe -s -H "X-Road-Client: DEV/MEMBER/SS1-CODE/CLIENT" "http://localhost:4210/r1/DEV/MEMBER/SS2-CODE/ECHO/echo?size=16"
curl.exe -s "http://localhost:8081/echo?size=16"     # baseline, мимо X-Road
```

Ожидаемо: 16 байт `abcdefghijklmnop`, в ответе через X-Road заголовки `x-road-id`, `x-road-request-hash`. Замер использует `&fill=random` — несжимаемое тело, иначе Postgres сжимает message log и рост лога занижен в сотни раз.

## Что было не так в старом compose

- `ss4` монтировал volume'ы `ss3-*` — два контейнера на одном каталоге PostgreSQL и одном `/etc/xroad`. Это порча базы, поэтому `down -v`.
- Не было лимитов CPU/RAM — на ноуте и VM среды были бы несравнимы (план, 8.2). Сейчас 2 CPU / 4 GB на SS.
- Не было эхо-сервиса и автоматизации регистрации.

## Как устроен init

`up.js` гоняет `hurl/*.hurl` — адаптацию `development/hurl/scenarios/setup.hurl` из репозитория X-Road (тег 7.8.3), разрезанную на переиспользуемые куски:

1. `01-cs.hurl` — init CS, класс `MEMBER`, signing keys, 4 члена, management-подсистема, CA/OCSP/TSA.
2. `02-ss-base.hurl` ×4 — anchor, init, auth/sign ключи, подпись CSR у testca, регистрация auth cert, approve на CS, TSA.
3. `03-ss0-management.hurl` — management services на ss0.
4. `04-consumer.hurl` — подсистема CLIENT на ss1.
5. `05-provider.hurl` ×2 — подсистема ECHO, REST-сервис `echo` → `http://is-provider:8080/echo`, ACL для `DEV:MEMBER:SS1-CODE:CLIENT`.

Сценарии не идемпотентны: `up.js` запускает их только если ни на одном SS нет якоря; полуинициализированный стенд — `up.js --fresh`.
Ручное вмешательство через UI после init допустимо (например, включить op-monitoring или сменить ключи на EC для конфигурации 7 из плана).
`init.ps1`/`init.sh` — то же самое без обёртки, оставлены для отладки.

## Замеры (шаг 3 плана) — `bench/`

k6 и curl запускаются контейнерами внутри `xroad-network`, так что проброс портов Docker Desktop в замер не попадает.

| Файл | Что |
|---|---|
| `bench/up.js` | 1: compose up + init + ожидание gconf |
| `bench/check.js` | 2: готовность стенда (`--quick` без hurl-диагностики) |
| `bench/run.js` | 3: контроль + сетка (см. флаги выше) |
| `bench/analyze.js` | 4: медианы по повторам, Δ против full, байты/запрос, рост лога, OCSP/TSA за прогон, оценка контроля |
| `bench/opmon.js` | этапы задержки по меткам op-monitoring X-Road (ss1 + провайдер, склейка по `x_request_id`): `opmon.json` на прогон (сырые этапы в `opmon.csv.gz`, не в git), `opmon.md` — средние этапов и Δ против full. X-Road хранит записи 7 дней — задним числом только последняя неделя |
| `bench/night.js [N]` | N сеток подряд: check → run (до 5 попыток с `config.js full` + проверка TSA + `--resume`) → analyze; итог `results/night-<дата>/merged.md`, журнал `results/night-<дата>.log` |
| `bench/matrix.json` | малая сетка (с 30.09, по письму руководителя): `full`/`nobody`/`synctsa`, точки 10 КБ×1 VU, 1 МБ×1 VU, 10 КБ×4/16/32 VU — одни и те же для `direct`; 5 повторов; контроль в начале каждого повтора и в конце. 106 прогонов |
| `bench/matrix-wide.json` | прежняя полная сетка (182 прогона): `node bench/run.js --matrix bench/matrix-wide.json` |
| `bench/config.js <name>` | `full` / `nobody` / `notsa` / `synctsa` (`ocsp` — см. ниже, из сетки убран) — переключает стенд (local.ini + `system_parameters` на CS), рестартит proxy, ждёт smoke. `notsa` = `timeStampingIntervalSeconds=86400` (TSA остаётся настроен: при пустом списке TSA proxy отвергает все сообщения — `LogManager.verifyCanLogMessage`, 7.8.3) |
| `bench/clean.js` | `TRUNCATE messagelog.logrecord CASCADE` + `lo_unlink` всех large objects (тела сообщений; до 30.09 не удалялись и копились — 12 ГБ на ss1/ss2) + архивы на всех запущенных SS |
| `bench/lib.js` | общие помощники: docker, psql со схемами, hurl, счётчики, лог testca |
| `hurl/check-ss.hurl`, `tsa-add/remove.hurl` | диагностика SS; TSA снять/вернуть (для `notsa`) |
| `k6/grid.js` | один прогон: прогрев (не пишется) + N измеряемых, `summary.json` + `requests.csv.gz` по-запросно |
| `probe.ps1`, `warmup.ps1`, `volumes.ps1` | этап 0 (разовые проверки, кривая прогрева); снимки volume'ов |

Прогрев: после рестарта proxy медиана по окнам в 200 запросов падает 114 → 83 → 66 → 60 → … → 45 и выходит на плато только к ~2500–3000 запросам (оценка «700» с этапа 0 была ошибкой) → после смены конфигурации сначала прогон-обкатка (`burnin`: 4 VU, 1000+2000 запросов, пишется в `results/<дата>/_burnin/`, в сводку не входит — первый прогон после рестарта proxy медленнее даже после 4000 запросов при 1 VU), затем `warmup_first: 2000`, 200 между прогонами одной конфигурации; плато 1 КБ / 1 VU: p50 ≈ 50–60 мс, p90 ≈ 65–80; раз в минуту всплеск p99 до ~190 мс — фоновые задачи SS (timestamping, gconf, OCSP). Разброс плато между прогонами до 20% → 3 повтора и рандомизация обязательны.

Результаты: `results/<дата>/<config>_s<size>_v<vus>_r<rep>[_controlN]/` — `summary.json`, `meta.json` (байты на eth0 ss1/ss2, байты на канале ss1↔ss2 — `link_bytes`, рост messagelog, обращения к OCSP/TSA, `timestamping` — дождались ли меток, local.ini), `stats.csv` (docker stats раз в секунду), `requests.csv.gz` (k6 по-запросно; `analyze.js` считает ошибки отсюда; прогон с >10 % ошибок или p50 > 10 с считается негодным и в медианы не входит — колонка «негодных»). `env.json` — образы по digest и план; `run.log` — полный журнал прогона (вывод hurl/compose/k6, ошибки) — смотреть при обрыве. `results/_pilot/` — пробные прогоны 23.09 без CPU.

Что известно по двум чистым сеткам `2026-09-29-20-43-g1/-g2` (6 повторов на точку, `results/night-2026-09-29-20-43/merged.md`; все каталоги и их дефекты — `results/README.md`): `full` − `direct` ≈ 29 мс на 1–10 КБ, 33 на 100 КБ, 65 на 1 МБ, потолок 77–83 req/s при 16–32 VU; `synctsa` +73…+77 мс при 1 VU (3.5×) и потолок 24 req/s; `nobody` на ≤ 100 КБ в шуме, на 1 МБ −38 %, при 32 VU +19 % req/s, лог 20 КБ/запрос вместо 34 КБ…1.43 МБ; `notsa` — 0 обращений к TSA и 0 разницы. Сетки сходятся между собой в пределах 1–10 %.

TSA в testca — однопоточный `http.server` + один `openssl ts -reply` на запрос (~50 меток/с); под `synctsa` при 16–32 VU он не успевает (таймаут 60 с у nginx) и после перегрузки 28.09 остался висеть — proxy на ss1 ждал его по 60 с на каждом запросе. Замена `ca/tsa_server.py` (многопоточный, `TSA_WORKERS=4` параллельных openssl, свой serial у каждого worker'а) монтируется поверх оригинала в `docker-compose.yml`. `check.js` делает настоящий TS-запрос к `ca:8899`; `run.js` перед каждым прогоном проверяет TSA, при провале перезапускает `ca` и помечает прогон (`meta.tsa_restarted_before`, после прогона `tsa_probe_after`), в сводке колонка «TSA-сбои» — такие точки не считать чистыми.

Почему нет конфигурации `ocsp` («OCSP в синхронном пути»). По исходникам 7.8.3: клиентский proxy сам к OCSP-ответчику не обращается — при TLS-рукопожатии берёт ответ из кеша signer'а, а если тот истёк, запрашивает кеш peer'а по порту 5577 (`AuthTrustVerifier.getOcspResponses`); сам signer обновляет ответы раз в `ocspFetchInterval` (мин. 60 с, по умолчанию 1200 с, `OcspClientExecuteScheduler`). При `ocspFreshnessSeconds` меньше интервала обновления ответ признаётся устаревшим (`OcspVerifier.isExpired`) и каждый запрос падает с `TLS handshake failed` — так и вышло в прогонах 28.09 (все 1000 запросов с ошибкой). Вывод для отчёта: OCSP в X-Road по построению вне пути запроса, его цена — фоновый трафик раз в 1200 с и проверка подписи кешированного ответа при рукопожатии.

С 30.09 в каждом прогоне X-Road:
- **Метки времени до чистки.** После k6 `run.js` ждёт, пока у всех сообщений в messagelog ss1/ss2 появится `timestamprecord` (пакетное проставление, интервал 60 с; обычно 15–45 с), и только потом следующий прогон чистит лог. Раньше `TRUNCATE` шёл сразу — часть сообщений удалялась без метки, и работа TSA в прогоны не попадала. `meta.timestamping`: `completed`, `wait_s`, сколько было без метки, обращения к TSA за время ожидания. Для `notsa` (интервал сутки) не ждём, только фиксируем. В сводке — «метки до чистки» (k/n) и «TSA/run+ожидание».
- **Байты на канале consumer SS ↔ provider SS.** `lib.linkBytes()`: iptables-счётчики в сетевом namespace ss1 (образ `stand-netcount` = alpine + iptables, `docker run --net container:ss1 --cap-add NET_ADMIN`; ss1 не меняется). `xroad_tx/rx` — порт 5500 ss2, `link_tx/rx` — весь трафик ss1↔ss2 (включая 5577). IP-уровень, с заголовками. Старая колонка «tx ss1» (eth0 целиком) включала ответ клиенту k6 и обращения к CS/CA — это не канал между SS.
- **ss3 остановлен** на время сетки (в измеряемом пути не участвует, но ел CPU ноутбука); после сетки остаётся остановленным (поднять — `node bench/up.js`), `check.js` остановленный ss3 ошибкой не считает. До 01.10 `run.js` запускал его в конце — ss3 не успевал стать healthy к проверке перед следующей сеткой, и night.js пропускал сетки 2 и 3.
- **Контроль** (full, 10 КБ, 1 VU) — в начале каждого повтора и в конце: дрейф за ночь. Сводка — по всем контролям, разброс (max−min)/медиана; такой же разброс между повторами — для p50 и req/s каждой точки. «успешных» — число запросов со статусом 200 по всем повторам.
- req/s = VU × 1000 / средняя задержка (замкнутый цикл без пауз), не счётчик по времени.

Конфигурация 7 (EC-ключи) и baseline-1 (mTLS без X-Road) — отдельно, после сетки.
