# Инициализация стенда руками через UI — с объяснениями

Зачем это читать, если есть `init.ps1`: чтобы понимать, что скрипт делает и почему именно в таком порядке. Один раз пройти руками — потом логи и ошибки читаются сами.

Везде логин `xrd` / `secret`, PIN `123456xrd!`. Все админки только по **https** с самоподписанным сертом.

| Кто | URL |
|---|---|
| cs | https://localhost:4000 |
| ss0 (management) | https://localhost:4100 |
| ss1 (consumer) | https://localhost:4200 |
| ss2 (provider A) | https://localhost:4300 |
| ss3 (provider B) | https://localhost:4400 |
| testca | http://localhost:8888/testca/ |

Про ожидания: CS **раз в минуту** собирает глобальную конфигурацию, каждый SS **раз в минуту** её скачивает. Любое изменение на CS (новый член, одобренный серт, новая подсистема) доезжает до SS через 1–2 минуты. Если кнопки нет или список пустой — почти всегда надо просто подождать и обновить страницу.

---

## Часть 0. Модель: кто есть кто и какие бывают сертификаты

Читать до кликов. Дальше по тексту всё ссылается сюда.

### 0.1 Три слоя идентификаторов

```
 instance          DEV                         ← вся сеть (в проде EE, FI)
   │
   ├─ member        DEV:MEMBER:SS1-CODE               ← организация: класс + код
   │    │
   │    ├─ subsystem  DEV:MEMBER:SS1-CODE:CLIENT      ← информационная система внутри неё
   │    │                                         (только подсистемы вызывают и предоставляют сервисы)
   │    └─ security server  DEV:MEMBER:SS1-CODE:SS1   ← шлюз, принадлежит члену
   │
   └─ service       DEV:MEMBER:SS2-CODE:ECHO:echo     ← сервис = подсистема + код сервиса
```

Правила:

- **Класс члена** (`MEMBER`) — просто ярлык-категория. Любая строка из букв/цифр, лишь бы была заведена на CS раньше членов. В Эстонии `GOV`/`COM`/`NGO`, в Финляндии `GOV`/`COM`/`ORG`/`MUN`/`EDU`. На стенде одного достаточно.
- **Имя члена** (`SS0-NAME`) — свободный текст для людей. В идентификаторах, сертификатах и логах его нет, там только код. Можно вообще не заполнять. В проде это «Регистр населения», «Налоговый департамент».
- **Код** (`SS0-CODE`…`SS3-CODE`) — то, что реально идентифицирует. Уникален в классе.
- Один член может владеть несколькими SS и иметь много подсистем. Четыре разных члена на стенде — чтобы измеряемый путь шёл между **разными** организациями с **разными** sign-ключами, как в проде.

### 0.2 Топология стенда и кто с кем говорит

```
              gconf (http, раз в минуту)
         ┌──────────────┬──────────────┬──────────────┬──────────────┐
         ▼              ▼              ▼              ▼              │
      ┌─────┐        ┌─────┐        ┌─────┐        ┌─────┐       ┌────┐
      │ ss0 │        │ ss1 │        │ ss2 │        │ ss3 │       │ cs │
      │mgmt │        │cons.│        │prov.│        │prov.│       └────┘
      └──┬──┘        └──┬──┘        └──┬──┘        └──┬──┘          ▲
         │              │  TLS 5500     │              │             │ auth-cert
         │              ├──────────────►│              │             │ registration
         │              ├─────────────────────────────►│             │ (4001)
         │              │               │              │             │
         │◄─────────────┘ clientReg (X-Road msg, 5500) │             │
         │                                                            │
         └──── management service (SOAP) ────────────────────────────┘

      ┌────┐   sign CSR (8888)      OCSP (8888)      TSA (8899)
      │ ca │ ◄─────────────────── все ss ──────────────────────
      └────┘
                   ┌─────────────┐
      ss2, ss3 ───►│ is-provider │  http://is-provider:8080/echo
                   └─────────────┘
      k6/curl ───► ss1:8080 (localhost:4210)      k6/curl ───► is-provider (localhost:8081, baseline)
```

Порты между SS: **5500** — сообщения (mTLS), **5577** — обмен OCSP-ответами (SS отдаёт другим готовые OCSP-ответы на свои сертификаты, чтобы каждый не ходил в CA сам).

### 0.3 Дерево доверия

```
                 ┌─────────────────────────────┐
                 │  Test CA  (корневой серт)   │  ← ca.pem, загружен на CS (1.8)
                 └──────────────┬──────────────┘
        ┌──────────────┬────────┴────────┬──────────────────────┐
        ▼              ▼                 ▼                      ▼
  OCSP responder   TSA cert         auth-серты            sign-серты
  cert (ocsp.pem)  (tsa.pem)        по одному на SS       по одному на члена (на каждом SS,
  → на CS (1.8)    → на CS (1.9)    CN=ss1, ss2, …        где живут его подсистемы)
                                    subject: DEV/SS1/MEMBER  CN=SS1-CODE, SS2-CODE, …

  Отдельно, НЕ от CA:
  ┌──────────────────────────────────┐   ┌──────────────────────────────────────┐
  │ ключ CS для подписи gconf        │   │ внутренний TLS-серт каждого SS       │
  │ (softToken CS, 1.3)              │   │ (admin UI :4000, IS-интерфейс :8443) │
  │ доверие через ЯКОРЬ: hash ключа  │   │ самоподписанный, «Not secure» в      │
  │ + адрес cs                       │   │ браузере — это он                    │
  └──────────────────────────────────┘   └──────────────────────────────────────┘
```

Два корня доверия: **якорь** (кому верить про состав сети) и **CA** (кому верить про ключи участников). CA сам становится доверенным только потому, что его серт лежит в gconf, подписанной ключом из якоря.

### 0.4 Два сертификата SS: auth и sign

| | auth | sign |
|---|---|---|
| Что защищает | TLS-канал между SS (порт 5500), взаимная аутентификация | подпись каждого сообщения и ответа |
| Принадлежит | **серверу** (`DEV:MEMBER:SS1-CODE:SS1`) | **члену** (`DEV:MEMBER:SS1-CODE`) |
| Сколько на SS | один активный | по одному на каждого члена, чьи подсистемы тут живут |
| Subject | CN = DNS-имя (`ss1`), serialNumber = `DEV/SS1/MEMBER` | CN = код члена (`SS1-CODE`), serialNumber = `DEV/SS1/MEMBER` |
| Регистрация на CS | **да**, напрямую на CS:4001, ждёт Approve; после этого серт + адрес попадают в gconf | **нет**, CS о нём не знает |
| Как проверяет другая сторона | серт из TLS-рукопожатия сверяется с тем, что в gconf для этого сервера | серт приложен к сообщению; цепочка до CA из gconf + OCSP |
| Нужен Activate | да | нет |
| Что будет без него | никто не может открыть TLS к этому SS и он ни к кому | SS не может отправить ни одного сообщения от имени этого члена |

Обе пары ключей **рождаются внутри SS** (в softToken, зашифрованы PIN'ом) и не покидают его. Наружу уходит только CSR.

### 0.5 Жизненный цикл ключа

```
   SS (softToken)              CA (testca:8888)               CS (:4000 / :4001)
   ───────────────             ────────────────               ──────────────────
   Add key ──► keypair
   Generate CSR ──────────────► POST /testca/sign
                                type=auth|sign
                               ◄──────────────── cert
   Import cert ◄───────────────┘
        │
        │  только auth:
        ├── Register (адрес ss1) ─────────────────────────────► management request
        │                                                        Approve ◄── админ CS
        │                                          gconf ◄───── {SS1: addr=ss1, authCert=…}
        ◄────────── через ≤2 мин gconf доехала до всех SS ──────┘
        │
        └── Activate  → ключ используется для TLS

   sign: после Import серт становится Registered сам, как только член есть в gconf.
```

`type` при подписи важен: CA пишет в серт keyUsage (auth → digitalSignature+keyAgreement для TLS, sign → nonRepudiation). SS откажется импортировать auth-серт под sign-ключ и наоборот.

### 0.6 Где какой серт работает в одном запросе

```
 k6 ──HTTP──► ss1                                    ss2 ──HTTP──► is-provider
              │ 1. X-Road-Client → подсистема CLIENT   ▲
              │    зарегистрирована здесь? (gconf)     │ 6. ответ, подписать sign-ключом члена SS2-CODE
              │ 2. ACL: CLIENT может echo? (gconf)     │    записать в message log
              │ 3. подписать sign-ключом члена SS1-CODE    │
              │    записать в message log              │ 5. проверить подпись: sign-серт из сообщения →
              │                                        │    цепочка до CA (gconf) → OCSP-ответ (кеш/5577)
              │ 4. mTLS 5500 ────────────────────────► │    ACL ещё раз
              │    auth-серт ss1  ◄──► auth-серт ss2   │
              │    оба сверяются с gconf               │
              └────────────────────────────────────────┘
                    фон, не в синхронном пути:
                    OCSP-ответы на свои серты обновляются раз в N минут (ocspFreshnessSeconds)
                    TSA: раз в минуту метка времени на пачку записей message log
```

Именно это раскладывается в RQ1: п.3 и п.6 — подпись, п.5 — проверка, п.4 — TLS, OCSP и TSA — в фоне, пока их не выдернуть в синхронный путь конфигурациями 5–6 плана.

### 0.7 Что лежит в глобальной конфигурации

```
 gconf (XML, подписан ключом CS из якоря)
 ├── instance DEV, адрес CS
 ├── члены и их подсистемы                  ← Members на CS
 ├── security servers: id, адрес, auth-серт ← после Approve auth-регистрации
 ├── какие подсистемы на каком SS           ← после Approve clientReg
 ├── certification services (CA + OCSP URL) ← Trust services
 ├── timestamping services                  ← Trust services
 ├── global groups (security-server-owners) ← автоматически
 └── параметры: ocspFreshnessSeconds, timeStampingIntervalSeconds, …  ← это ты будешь крутить
```

SS ничего не решает сам: любое «можно/нельзя» — это поиск в gconf. Поэтому всё асинхронно с шагом в минуту.

---

## Часть 1. Central Server

CS — реестр сети. Пока он пуст, ни один SS не знает ни кому доверять, ни кто вообще существует. Поэтому всё начинается здесь.

### 1.1 Wizard первичной настройки

Открываешь https://localhost:4000, логин, появляется форма.

- **Instance identifier** = `DEV`. Это имя всей сети X-Road. В Эстонии это `EE`, в тесте `ee-test`. Все идентификаторы в системе начинаются с него: `DEV:MEMBER:SS0-CODE:CLIENT`. Поменять потом нельзя.
- **Central server address** = `cs`. Адрес, по которому Security Server'ы будут ходить за конфигурацией. Внутри docker-сети контейнер виден по имени. Этот адрес попадёт в якорь.
- **PIN** = `123456xrd!`. У CS тоже есть программный токен — в нём лежит ключ, которым CS подписывает глобальную конфигурацию. Без подписи SS её не примет. PIN должен совпадать с `XROAD_TOKEN_PIN` в compose: контейнер после рестарта сам разблокирует токен этим PIN'ом.

### 1.2 Класс членов

**Settings → System settings → Member classes → Add** → код `MEMBER`, описание любое.

Класс — ярлык-категория (0.1), код может быть любым; `MEMBER` — просто нейтральное слово. Одного класса хватает. Если поменяешь — поменяй `member_class` в `hurl/vars.env`.

### 1.3 Ключи подписи конфигурации

**Global configuration → Internal configuration** → у токена `softToken-0` нажать **Log in**, ввести PIN → **Add key** → label любой.

**Обязательно то же на вкладке External configuration.** Без ключа там CS показывает в шапке «Signing of external configuration failed — active key missing / Global configuration generation failing» и не раздаёт ничего, включая internal.

Internal — для своих SS, External — для федерации с другими инстансами. Первый ключ на каждой вкладке становится активным сам; если нет — кнопка Activate у ключа.

Проверка: через минуту на этой же странице в блоке **Configuration anchor** появится хеш и время генерации. Это значит, что конфигурация собирается.

### 1.4 Члены

Три разных поля, которые легко перепутать:

| Поле | Что это | Где всплывает | Пример |
|---|---|---|---|
| Member **name** | подпись для людей | только в списках CS | `SS0-NAME` |
| Member **code** | идентификатор организации | во всех ID, в CN sign-серта, в `X-Road-Client`, в URL | `SS0-CODE` |
| Security server **code** | идентификатор сервера внутри организации | в ID сервера, в serialNumber сертов | `SS0` |

Из них собирается: член `DEV:MEMBER:SS0-CODE`, сервер `DEV:MEMBER:SS0-CODE:SS0`, подсистема `DEV:MEMBER:SS0-CODE:MANAGEMENT`.

**Members → Add member**, минимум один — `SS0-CODE` / `SS0-NAME`: он владелец management-сервера, и management-подсистема (1.5) без него не создаётся.

Остальных трёх (`SS1-CODE`…`SS3-CODE`) можно завести здесь же, а можно не заводить: CS создаст члена сам при Approve регистрации auth-серта его сервера (2.4), только без имени. Имя потом дописывается: Members → член → Edit. Если заводишь руками — на SS в wizard'е подтянется имя и не будет предупреждения «Member is unregistered».

Что бы ни выбрал, **код члена должен совпадать в трёх местах**: wizard SS шаг 2 → поле Client у sign-ключа → подсистемы. Рассогласование = «Unknown member» при регистрации.

### 1.5 Management-подсистема

**Members → SS0-NAME → Subsystems → Add** → код `MANAGEMENT`.

Подсистема — это «информационная система» внутри члена; именно подсистемы вызывают сервисы и предоставляют их. Член сам по себе ничего не вызывает.

Зачем MANAGEMENT: когда SS хочет зарегистрировать у себя новую подсистему, он **не идёт на CS напрямую** — он отправляет обычное X-Road-сообщение специальному сервису «management service». Этот сервис живёт на CS, но опубликован в сеть через один из Security Server'ов (у нас ss0) под подсистемой MANAGEMENT. Так CS не нужно принимать входящие X-Road-соединения от кого попало.

Исключение — регистрация auth-сертификата: она идёт напрямую на CS (порт 4001), потому что до неё SS ещё не является участником сети и слать X-Road-сообщения не может.

### 1.6 Назначить management service

**Settings → System settings → Management services → Edit** → выбрать `DEV:MEMBER:SS0-CODE:MANAGEMENT`.

Теперь CS знает, какая подсистема будет фасадом для его management-сервисов. Поле «Security server» пока пустое — заполним в 2.6, когда ss0 будет зарегистрирован.

### 1.7 Сертификаты тестового CA на диск

В PowerShell:

```powershell
docker cp ca:/home/ca/certs/ca.pem .
docker cp ca:/home/ca/certs/ocsp.pem .
docker cp ca:/home/ca/certs/tsa.pem .
```

Контейнер `ca` при первом старте сгенерил себе корневой серт, серт OCSP-респондера и серт TSA. CS'у их надо показать, иначе он не будет доверять сертификатам, которые этот CA выдаст Security Server'ам.

### 1.8 Certification service

**Trust services → Certification services → Add certification service** → файл `ca.pem` → далее:

- **Certificate profile info**: `ee.ria.xroad.common.certificateprofile.impl.FiVRKCertificateProfileInfoProvider`. Профиль — это правила, какие поля должны быть в CSR и как из серта вычитать, чьё оно (какому члену/серверу принадлежит). FiVRK — финский профиль, тестовый CA заточен под него. Именно из-за профиля в CSR будет поле `serialNumber = DEV/SS0/MEMBER`.
- **TLS auth**: выключено.
- ACME: пусто.

Потом открыть добавленный CA → **OCSP responders → Add**: URL `http://ca:8888`, сертификат `ocsp.pem`.

OCSP — сервис «жив ли сертификат?». SS перед тем, как доверять чужому auth/sign-сертификату, спрашивает у OCSP и кеширует ответ. Без респондера все сертификаты этого CA считаются непроверенными, и сообщения не пройдут.

### 1.9 Timestamping service

**Trust services → Timestamping services → Add**: URL `http://ca:8899`, сертификат `tsa.pem`.

TSA ставит метки времени на записи message log (пакетно, раз в минуту). Это доказательство, что сообщение существовало в такой-то момент. SS без хотя бы одного настроенного TSA через некоторое время перестаёт принимать сообщения (это ровно тот механизм, который ты собираешься ломать в конфигурации 4 плана).

### 1.10 Скачать якорь

**Global configuration → Internal configuration → Download** (в блоке Configuration anchor).

Якорь — маленький XML: адрес `cs` + хеш ключа, которым подписана конфигурация. SS по нему находит CS и проверяет, что конфигурация не подделана. Один файл на все четыре SS.

Важно: якорь надо скачивать **после** 1.8–1.9, иначе не страшно (якорь не содержит CA), но SS, загрузив старую конфигурацию, ещё минуту не будет видеть CA. Просто подождёт.

CS готов.

---

## Часть 2. ss0 — management Security Server

Он первый, потому что через него остальные будут регистрировать подсистемы (1.5). Пока ss0 не работает целиком, регистрация на ss1–ss3 будет падать.

### 2.1 Wizard

https://localhost:4100 → логин → три шага:

1. **Configuration anchor** → Upload → файл из 1.10. Покажет хеш и адрес `cs` — сверь.
2. **Owner member** — три поля:
   - Member Class: `MEMBER`
   - Member Code: `SS0-CODE` — код **организации**, не сервера. Впишешь сюда `SS0` — сервер будет принадлежать члену «SS0», и CS его таким и создаст при Approve.
   - Security Server Code: `SS0`
   Member Name заполнится сам, если член уже есть на CS и конфигурация доехала. Предупреждение **«Member is unregistered»** — члена ещё нет в gconf: либо Cancel и завести на CS (1.4), либо Continue — создастся при Approve.
3. **Token PIN** `123456xrd!` — тот же смысл, что в 1.1: PIN программного хранилища ключей этого SS.

После Continue SS начнёт качать конфигурацию с CS. **Подожди минуту.** Проверка: **Diagnostics** → Global configuration должен стать зелёным.

### 2.2 Auth-ключ и сертификат

Auth-сертификат — это TLS-серт сервера. Им ss0 будет представляться другим SS, когда те к нему подключаются по 5500. Один на сервер.

**Keys and certificates → SIGN AND AUTH KEYS** → токен `softToken-0` (если не залогинен — Log in, PIN) → **Add key**:

1. Label: `auth`.
2. **Usage**: Authentication. **Certification service**: единственный в списке (если список пуст — конфигурация ещё не доехала, подожди). **CSR format**: DER или PEM — testca ест оба.
3. Поля субъекта: `C` = `EE`, `O` = `SS0-NAME`, `CN` = `ss0`, `serialNumber` заполнится сам (`DEV/SS0/MEMBER`). CN — это DNS-имя сервера, по нему другие SS проверят серт при TLS.
4. **Generate CSR** → скачается файл.

Ключ сгенерирован **внутри** SS и никуда не уходит. Наружу отдаётся только CSR — запрос «подпиши мне вот этот открытый ключ».

Подписать у CA: http://localhost:8888/testca/ → файл CSR, радиокнопка **Auth** → Sign → скачается серт. Или из PowerShell:

```powershell
curl.exe -F "type=auth" -F "certreq=@auth_csr.der" http://localhost:8888/testca/sign -o auth.cert.pem
```

Тип важен: CA пропишет в серт разрешённое использование ключа (keyUsage). Серт «auth» нельзя импортировать как sign и наоборот.

Обратно в SS: **Import cert.** → файл серта. Серт появится под ключом со статусом *Saved*.

Если на импорте «**Client not found DEV:MEMBER:ss0**» — CA подписал CSR как sign (осталась радиокнопка Sign или `type=sign`): SS увидел sign-keyUsage, прочитал CN как код члена и не нашёл такого. Удалить ключ, сгенерить заново, подписать с **Auth**.

### 2.3 Sign-ключ и сертификат

Sign-серт — для подписи сообщений. Он принадлежит **члену**, а не серверу: подпись под сообщением — это «организация MEMBER:SS0-CODE утверждает». Поэтому на каждого члена, чьи подсистемы живут на этом SS, нужен свой sign-ключ.

**Add key**: label `sign`, Usage **Signing**, **Client** = `DEV:MEMBER:SS0-CODE` (владелец), CA тот же. Поля: `CN` = `SS0-CODE`, `O` = `SS0-NAME`, `C` = `EE`. Generate CSR → подписать у testca с типом **Sign** → Import cert.

Регистрировать sign-серт не нужно: CS про него не знает. Получатель сообщения проверяет подпись по серту, приложенному к сообщению, и спрашивает OCSP, не отозван ли он.

Статус должен стать *Registered* (для sign это значит «серт валиден и привязан к клиенту, который есть в конфигурации»).

Sign делается **до** регистрации auth-серта: запрос на регистрацию SS подписывает sign-ключом владельца. Без него — «Unknown member. Could not find any certificates for member …».

Проверить, что signer реально видит:

```powershell
docker exec -u xroad ss0 signer-console list-certs
```

Под SIGNING-ключом должна быть строка `Cert: … (registered, MEMBER:DEV/MEMBER/SS0-CODE)`. Если там только `CertReq:` — серт не импортирован.

### 2.4 Зарегистрировать auth-сертификат

Кликнуть по серту → **Register** → адрес `ss0`.

Что происходит: SS отправляет на CS (порт 4001, напрямую) запрос «я `DEV:MEMBER:SS0-CODE:SS0`, живу по адресу `ss0`, вот мой auth-серт». Пока CS не одобрит, сервера в сети нет.

На CS: **Management requests** → запрос `AUTH_CERT_REGISTRATION` → открыть → **Approve**. Если владельца ещё нет среди членов, диалог предупредит и создаст его.

После одобрения CS в следующей конфигурации опубликует: сервер SS0, адрес ss0, серт такой-то. Все остальные SS через минуту-две будут ему доверять.

Обратно на ss0: серт → **Activate**. Без активации SS не будет использовать этот ключ для TLS, даже если он зарегистрирован. (Можно держать несколько auth-ключей и переключать — для ротации.)

Проверка, три колонки в строке серта: STATUS = *Registered*, OCSP = **Good**, и в CS → **Security servers** появился SS0. Пока серт не активирован, OCSP показывает *Disabled* — SS для неактивных сертов OCSP не запрашивает. После Activate до минуты OCSP будет *Unknown*, потом *Good*. Только с Good этот SS может открывать и принимать TLS.

### 2.5 TSA

**Settings → System parameters → Timestamping services → Add** → выбрать из списка (список приходит из глобальной конфигурации, см. 1.9).

Это выбор, какой из разрешённых CS'ом TSA будет использовать этот SS. Без него message log не будет таймстемпиться, а SS через `acceptable-timestamp-failure-period` перестанет работать.

### 2.6 Опубликовать management service через ss0

На CS: **Settings → System settings → Management Services** → строка *Management Services' Security Server* → **Edit** (это и есть «Register», кнопки с таким названием нет) → выбрать `SS0`.

CS регистрирует подсистему `DEV:MEMBER:SS0-CODE:MANAGEMENT` на ss0 сам, без запроса через X-Road (потому что запрос через X-Road идёт через management service, которого ещё нет — курица и яйцо). Если в списке пусто — ss0 ещё не в Security servers (2.4).

На ss0: **Clients → Add subsystem** → кнопка **Select Subsystem** → выбрать `MANAGEMENT` из глобального списка → галку **Register subsystem снять** (CS уже зарегистрировал; с галкой ss0 попытается послать clientReg через management service, которого ещё нет) → connection type `HTTP`. Через минуту статус *Registered*.

Открыть клиента MANAGEMENT → **Services → Add WSDL** → URL взять на CS в том же блоке, поле **WSDL Address** (`http://cs/managementservices.wsdl`). Появятся сервисы `authCertDeletion`, `clientReg`, `clientDeletion`, `ownerChange`, … — это и есть management-сервисы CS, описанные в WSDL. У всех URL = адрес WSDL, это заглушка.

Кликнуть любой сервис. В карточке три независимых поля, **у каждого свой «Apply to all in WSDL»**:

| Поле | Значение | Apply to all |
|---|---|---|
| Service URL | `https://cs:4002/managementservice/manage/` — точно так, с `https` и слэшем в конце (поле **Management Services Address** на CS) | да |
| Verify TLS certificate | **выключить** (серт CS самоподписанный, сверять не с чем) | да |
| Timeout | 60 | да |

Save. Проверка по таблице сервисов: у всех строк новый URL, замочек **жёлтый** (жёлтый = https без проверки серта; закрытый серый = с проверкой; это индикатор флага, а не схемы URL).

Тут же → **Service clients → Add subject** → глобальная группа `security-server-owners` → выдать **все** сервисы.

Смысл: `security-server-owners` — автоматическая группа, в которой состоят владельцы всех зарегистрированных SS. Давая ей доступ, мы разрешаем любому SS сети слать запросы clientReg и прочие. Именно так ss1 сможет зарегистрировать свою подсистему.

Тумблер у WSDL → **Enabled**.

Что говорит ошибка при Register клиента на ss1, если тут что-то не так:

| Ошибка | Причина |
|---|---|
| `405 Not Allowed` | URL сервиса остался `http://cs/managementservices.wsdl` — nginx отдаёт WSDL только по GET |
| `Client '…MANAGEMENT' has no IS certificates` | Verify TLS certificate включён (свой Apply to all не нажат) |
| `301 Moved Permanently` | URL без слэша в конце или иной опечаткой |
| `400 Bad Request` | `http://` вместо `https://` на порт 4002 |

Проверить сам CS, минуя X-Road (ожидается 500 на мусорный SOAP, не 3xx/4xx):

```powershell
docker exec cs curl -sk -o /dev/null -w "%{http_code} %{redirect_url}\n" -X POST -H "Content-Type: text/xml;charset=UTF-8" --data "<x/>" https://127.0.0.1:4002/managementservice/manage/
```

ss0 готов. Проверка: **Diagnostics** на ss0 — всё зелёное; CS → Members → SS0-NAME → Subsystems → MANAGEMENT показывает сервер SS0.

---

## Часть 3. ss1, ss2, ss3 — базовая часть

На каждом одно и то же, что в 2.1–2.5 (порядок: wizard → auth → sign → register → activate → TSA). Меняются только коды:

| SS | URL | member code | O | server code | CN auth | CN sign |
|---|---|---|---|---|---|---|
| ss1 | :4200 | SS1-CODE | SS1-NAME | SS1 | ss1 | SS1-CODE |
| ss2 | :4300 | SS2-CODE | SS2-NAME | SS2 | ss2 | SS2-CODE |
| ss3 | :4400 | SS3-CODE | SS3-NAME | SS3 | ss3 | SS3-CODE |

Можно делать параллельно: wizard на всех трёх → auth-ключи на всех трёх → три Approve на CS подряд → и т.д. Так меньше ждать конфигурацию.

---

## Часть 4. Подсистемы

### 4.1 Consumer на ss1

**Clients → Add subsystem** → member `DEV:MEMBER:SS1-CODE`, subsystem code `CLIENT` (новая, в списке её нет — ввести руками), connection type `HTTP`.

Connection type — как информационная система подключается к **своему** SS по 8080/8443: HTTP без проверки, HTTPS, HTTPS с проверкой клиентского серта. Для замеров HTTP: генератор нагрузки будет ходить на `localhost:4210` без TLS. Это внутренний участок, в измеряемый путь между SS он не входит.

Подсистема появится со статусом *Saved*. Открыть → **Register**.

Вот здесь ss1 отправляет X-Road-сообщение `clientReg` на management service, т.е. на ss0. Для этого нужно: ss1 в конфигурации (auth-серт одобрен, 2.4), sign-серт ss1 валиден (2.3), ss0 полностью настроен (2.6), OCSP отвечает. Ошибки читаются по цепочке — каждая следующая значит, что предыдущий слой уже прошёл:

| Ошибка | Где затык |
|---|---|
| `ClientProxy: Security server has no valid authentication certificate` | у **ss1** auth-серт не активирован или OCSP не Good (2.4) |
| `ClientProxy: TLS handshake failed` | серт ss1 валиден, но ss0 его ещё не принимает: OCSP Good не с обеих сторон, либо gconf с ss1 ещё не доехала до ss0. Подождать 1–2 мин |
| `ServerProxy: service_failed 405 / 301 / 400 / no IS certificates` | TLS прошёл, ss0 переслал запрос на CS, но адрес сервиса на ss0 неверный — таблица в 2.6 |
| `AccessDenied` на ss0 | группе `security-server-owners` не выданы сервисы (2.6) |

На CS: **Management requests → CLIENT_REGISTRATION → Approve**. Через минуту на ss1 статус *Registered*.

### 4.2 Provider на ss2 и ss3

То же: **Add subsystem** `ECHO` для `DEV:MEMBER:SS2-CODE` на ss2 и для `DEV:MEMBER:SS3-CODE` на ss3 → Register → Approve на CS.

Дальше на каждом: открыть ECHO → **Services → Add REST**:

- **URL type**: REST API basepath (не OpenAPI — у нашего эхо нет спеки).
- **URL**: `http://is-provider:8080/echo`. Это куда SS будет проксировать запрос. Контейнер `is-provider` в той же docker-сети.
- **Service code**: `echo`. Это имя сервиса в X-Road. Полный идентификатор: `DEV:MEMBER:SS2-CODE:ECHO:echo`.

Появится service description с одним сервисом. Тумблер → **Enabled**. Кликнуть `echo` → **Timeout** 60, TLS off (URL http).

**Service clients → Add subject** → найти `DEV:MEMBER:SS1-CODE:CLIENT` → выдать `echo`.

Это ACL. В X-Road по умолчанию никто ничего вызывать не может; провайдер явно перечисляет, каким подсистемам (или группам) разрешён каждый сервис. Без этого ss1 получит `Access denied`.

Через минуту ACL доедет до ss1 (он тоже проверяет права до отправки, чтобы не гонять зря).

---

## Часть 5. Проверка

```powershell
curl.exe -s -H "X-Road-Client: DEV/MEMBER/SS1-CODE/CLIENT" "http://localhost:4210/r1/DEV/MEMBER/SS2-CODE/ECHO/echo?size=16"
```

Разбор URL:

- `localhost:4210` — порт 8080 контейнера ss1, т.е. IS-интерфейс consumer'а. Генератор нагрузки прикидывается информационной системой члена SS1-CODE.
- `X-Road-Client: DEV/MEMBER/SS1-CODE/CLIENT` — от чьего имени. SS проверит, что такая подсистема на нём зарегистрирована, и подпишет запрос её sign-ключом.
- `/r1/` — REST-протокол X-Road версии 1.
- `DEV/MEMBER/SS2-CODE/ECHO/echo` — кого вызываем: подсистема провайдера и код сервиса.
- `?size=16` — прозрачно уйдёт дальше в `http://is-provider:8080/echo?size=16`.

Путь запроса: curl → ss1 (проверка клиента, подпись, лог) → TLS по 5500 → ss2 (проверка серта ss1 через OCSP-кеш, проверка подписи, ACL, лог) → `is-provider` → обратно тем же путём с подписью ответа.

Ответ: `abcdefghijklmnop` и заголовки `x-road-id`, `x-road-request-hash`. С `-v` видно.

Типовые ошибки:

- `Server.ServerProxy.AccessDenied` — ACL не выдан или ещё не доехал до ss1.
- `Server.ClientProxy.UnknownMember` — подсистема CLIENT не зарегистрирована или не в конфигурации.
- `Server.ServerProxy.ServiceFailed.*` / `NetworkError` — ss2 не достучался до `is-provider`, проверь `docker compose ps`.
- `Server.ClientProxy.OutdatedGlobalConf` — SS не может скачать конфигурацию с CS, смотри Diagnostics.
- `...CannotCreateSignature` / `TokenNotActive` — токен заблокирован, Keys and certificates → Log in.
- `Unknown member. Could not find any certificates for member 'MEMBER:DEV/MEMBER/X'` при Register — нет sign-серта владельца X на этом SS (2.3), либо владелец в wizard'е был другой.
- `Client not found DEV:MEMBER:ss0` при импорте — серт подписан не тем типом (2.2).
- CS в шапке: `Signing of external configuration failed - active key missing` — нет ключа на вкладке External configuration (1.3).
- OCSP у серта *Disabled* — серт не активирован; *Unknown* — активирован меньше минуты назад.
- На CS появились члены с кодами `SS0`, `SS1`… — в wizard'е в Member Code вписан код сервера; CS создал таких членов при Approve. Либо принять и выпускать sign-ключи для них, либо снести SS и переинициализировать (см. ниже).

Переинициализировать один SS (сайдкар хранит всё в volume):

```powershell
docker compose rm -sf ss2
docker volume rm ss2-db-data ss2-conf-data ss2-archive-data
docker compose up -d ss2
```

На CS перед этим удалить его из Security servers и, если создался лишний член, из Members.
