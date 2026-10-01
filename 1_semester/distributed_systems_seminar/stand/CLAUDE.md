# Контекст для Claude Code — стенд замеров X-Road 7.8.3

Проект: семинар по распределённым системам, Univ. of Tartu, тема «Measuring the Overhead of Trust Mechanisms in the X-Road Data Exchange Layer», руководитель Artjom Lind. План — `../measurement_plan.md`. Общение с пользователем по-русски, без вступлений и вежливостей, коротко; действовать самостоятельно, спрашивать только когда решение действительно за пользователем.

## Правила
- Скрипты — JavaScript (Node ≥ 18, без зависимостей); где JS не подходит — Rust. Никакого PowerShell/Python в новых скриптах (старые `.ps1` оставлены как есть).
- Пользователь работает в PowerShell на Windows (Docker Desktop, WSL2). В cmd `#` не комментарий.
- Не менять формат `results/<dir>/summary.json` и `meta.json` без правки `bench/analyze.js`.
- Всё существенное документировать в `README.md`; про каждый каталог результатов и его дефекты — `results/README.md`.
- Коммиты — в репозиторий `C:\учёба\study` (ветка `master`), не создавать вложенных `.git`. Snapshots, `requests.csv.gz`, `stats.csv` в `.gitignore`.

## Что есть
- `docker-compose.yml`: cs, ca (testca: OCSP 8888, TSA 8899, наш многопоточный `ca/tsa_server.py`), ss0–ss3 (sidecar 7.8.3, 2 CPU/4 GB), is-provider (Rust axum echo, `?size=N&fill=random`), hurl (profile init).
- Идентификаторы: класс `MEMBER`, коды `SS0-CODE..SS3-CODE`; consumer `DEV:MEMBER:SS1-CODE:CLIENT` на ss1, провайдеры `SS2-CODE:ECHO` (ss2), `SS3-CODE:ECHO` (ss3), management `SS0-CODE:MANAGEMENT` на ss0. Логин UI, пароль и PIN — в `.env` (не в git, шаблон `.env.example`); `lib.hurl` подставляет их в hurl. Измеряемый путь: k6 → ss1:8080 → ss2 → is-provider.
- Четыре команды: `node bench/up.js` (compose up + init + ожидание), `node bench/check.js` (готовность), `node bench/run.js` (контроль + сетка по `bench/matrix.json`; старая полная — `--matrix bench/matrix-wide.json`), `node bench/analyze.js results/<dir> [dir2 ...]`. Ночной: `node bench/night.js N`.
- Секреты: логин/пароль/PIN в `.env` (не в git, шаблон `.env.example`), `lib.hurl` передаёт их в hurl. `snapshots/` в git не хранить (там приватные ключи CA и SS).
- С 30.09 каждый прогон: ждёт метки времени у всех сообщений до чистки (`meta.timestamping`), меряет байты ss1↔ss2 iptables-счётчиками (`meta.link_bytes`, образ `stand-netcount`), ss3 на время сетки остановлен, контроль в каждом повторе. `clean.js` удаляет large objects (тела сообщений) — раньше копились до 12 ГБ.
- Конфигурации (`bench/config.js`): `full`, `nobody` (тело не в лог), `notsa` (`timeStampingIntervalSeconds=86400` на CS — снять TSA нельзя, `LogManager.verifyCanLogMessage`), `synctsa` (`timestamp-immediately=true`). `ocsp` убрана: клиентский proxy к OCSP не ходит, кеш signer'а ≥60 с — при `ocspFreshnessSeconds` меньше все запросы падают (`AuthTrustVerifier`, `OcspClientExecuteScheduler`, `OcspVerifier.isExpired`).
- БД: таблицы не в `public` — `bench/lib.js` ищет схему через `information_schema` и ставит `search_path` (иначе на CS падает history-триггер). Messagelog чистится `TRUNCATE messagelog.logrecord CASCADE`.
- Лог testca с портами (`ca/00-logformat.nginx`) → подсчёт OCSP/TSA-обращений за прогон.

## Что намерено (среда A, ноутбук)
Сетки без ошибок (но с дефектами 30.09 — см. `results/README.md`): `results/2026-09-29-20-43-g1`, `-g2`, сводка `results/night-2026-09-29-20-43/merged.md` (6 повторов на точку). Итог: full − direct ≈ 29 мс (1–10 КБ), 65 мс (1 МБ), потолок ~80 req/s; synctsa +73…+77 мс, потолок 24 req/s; nobody на ≤100 КБ в шуме, 1 МБ −38 %, 32 VU +19 % req/s, лог 20 КБ/запрос вместо 34 КБ…1.43 МБ; notsa 0. Все прежние каталоги — с дефектами, см. `results/README.md`.

## Грабли
- Первый прогон после рестарта proxy медленнее: прогрев 2000 + обкатка 4 VU (`burnin` в matrix) — уже сделано, остаток ~10 %.
- Ноутбук дрейфует (окна 2× медленнее); мерять ночью, ноут в сети, лишнее закрыто; абсолютные числа между ночами не сравнивать.
- После рестарта контейнеров SS software-токен закрыт → `up.js` открывает его (`hurl/token-login.hurl`).
- Оригинальный TSA testca однопоточный и виснет под нагрузкой — заменён `ca/tsa_server.py`; `check.js` это проверяет.
- `--resume results/<dir>` продолжает сетку; каждый прогон пишет `run.log`.

## Письмо Артёма 30.09 (главное)
Просит: перечень реально прогнанных конфигураций вместо «лестницы»; методику (топология, payload, прогрев, чистка, контроли, анализ); раздел предварительных результатов с ограничениями рядом с числами; формулировки строго по тому, что сравнение показывает (direct vs X-Road — весь путь, не криптооперации; nobody — только запись тела; synctsa — другая политика меток; notsa откладывает метки, не выключает TSA, и 86400 нарушает документированное ограничение относительно OCSP freshness; ocsp не сработал — оценки нет); убрать таблицу «механизм → цена», сравнение алгоритмов ключей и выводы про несколько хостов, пока не измерены; малую чистую сетку (`bench/matrix.json`) с разбросом между повторами; байты — только канал consumer↔provider; финальные данные — с отдельных машин/тихой VM, иначе сузить вопрос про среды; убрать секреты из репо (сделано). На вопросы из отчёта (ноутбуки для среды B, сроки HPC, SOAP, подписи, интервалы) прямо не ответил.

## Среда B (с 02.10)
Артём дал 3 Linux-ноутбука (дистрибутив не Ubuntu, не проверен) и свитч; стоят у него в офисе, доступ удалённо (учебный VPN — проверить; запасной вариант Tailscale, спросить разрешения). `multihost/`: setup.sh/link.sh/compose.yml, `bench/lib.js` при `STAND_HOST` ходит в контейнеры других машин через docker context, compose — через ssh. Раскладка: l1 cs/ca/ss0/ss3/is-provider-b, l2 ss1 + bench, l3 ss2/is-provider. На железе ещё не запускалось.

## Дальше (по плану, раздел 6)
1. **Baseline-1**: два nginx с mTLS (серты от того же testca: `POST http://ca:8888/testca/sign`, CA в `certs/ca.pem`) — `proxy-client:8080` → https/mTLS → `proxy-provider` → `is-provider:8080`. Новый `target=mtls` в `k6/grid.js`, группа в `matrix.json`, сервисы в compose. Даёт разность «цена TLS» vs «цена X-Road поверх TLS».
2. **Конфигурация 7**: ключи secp256r1 вместо RSA — второй член/подсистема с EC auth+sign на ss1 и ss2 (UI или hurl), тот же путь.
3. Op-monitoring как прямое разложение (опционально). Среда B/C (VM) — та же сетка. Письмо Артёму с результатами и вопросами (раздел 12 плана).
