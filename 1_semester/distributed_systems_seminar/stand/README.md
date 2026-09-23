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

Логин везде `xrd` / `secret`, PIN токена `123456xrd!` (в `docker-compose.yml` и `hurl/vars.env` — менять синхронно).
Admin UI **только по https**, серт самоподписанный.

## Запуск с нуля

```powershell
docker compose down -v            # старые volume'ы обязательно снести — см. ниже
docker compose up -d --build      # первый старт SS: 2–4 мин до healthy
docker compose ps                 # ждать, пока все (healthy)
.\init.ps1                        # ~10–15 мин, много ретраев на ожидании gconf — это нормально
```

Проверка (через 1–2 мин после init, пока gconf с ACL доедет до ss1/ss2):

```powershell
curl.exe -s -H "X-Road-Client: DEV/MEMBER/SS1-CODE/CLIENT" "http://localhost:4210/r1/DEV/MEMBER/SS2-CODE/ECHO/echo?size=16"
curl.exe -s -H "X-Road-Client: DEV/MEMBER/SS1-CODE/CLIENT" "http://localhost:4210/r1/DEV/MEMBER/SS3-CODE/ECHO/echo?size=16"
curl.exe -s "http://localhost:8081/echo?size=16"     # baseline, мимо X-Road
```

Ожидаемо: 16 байт `abcdefghijklmnop`, в ответе заголовки `x-road-id`, `x-road-request-hash`.

## Что было не так в старом compose

- `ss4` монтировал volume'ы `ss3-*` — два контейнера на одном каталоге PostgreSQL и одном `/etc/xroad`. Это порча базы, поэтому `down -v`.
- Не было лимитов CPU/RAM — на ноуте и VM среды были бы несравнимы (план, 8.2). Сейчас 2 CPU / 4 GB на SS.
- Не было эхо-сервиса и автоматизации регистрации.

## Как устроен init

`hurl/*.hurl` — адаптация `development/hurl/scenarios/setup.hurl` из репозитория X-Road (тег 7.8.3), разрезанная на переиспользуемые куски:

1. `01-cs.hurl` — init CS, класс `MEMBER`, signing keys, 4 члена, management-подсистема, CA/OCSP/TSA.
2. `02-ss-base.hurl` ×4 — anchor, init, auth/sign ключи, подпись CSR у testca, регистрация auth cert, approve на CS, TSA.
3. `03-ss0-management.hurl` — management services на ss0.
4. `04-consumer.hurl` — подсистема CLIENT на ss1.
5. `05-provider.hurl` ×2 — подсистема ECHO, REST-сервис `echo` → `http://is-provider:8080/echo`, ACL для `DEV:MEMBER:SS1-CODE:CLIENT`.

Скрипты не идемпотентны. Если init упал посередине — проще `down -v` и заново, чем чинить руками.
Ручное вмешательство через UI после init допустимо (например, включить op-monitoring или сменить ключи на EC для конфигурации 7 из плана).

## Куда дальше (шаг 3 плана)

- `k6/smoke.js` — заготовка; полная сетка размер × конфигурация × VU пишется поверх неё.
- Конфигурации 4–6 (TSA off / sync timestamping / OCSP freshness) — правки `/etc/xroad/conf.d/local.ini` внутри контейнера + `supervisorctl restart xroad-proxy`, volume `ssN-conf-data` их сохранит.
- Чистка message log между прогонами: `docker compose exec ss1 sh -c "psql -U messagelog -c 'TRUNCATE logrecord'"` — точное имя БД/пользователя сверить в `/etc/xroad/db.properties`.
