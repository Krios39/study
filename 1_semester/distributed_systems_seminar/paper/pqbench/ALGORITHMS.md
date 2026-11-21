# Алгоритмы для RQ3: что гоняем и почему

Решено 17.11.2026: берём все шесть групп. Гоняем в бенчмарке (`SignBench.java`, BouncyCastle 1.84, JDK 21) и в модели размеров (`sizemodel.js`). X-Road 7.8.3 постквантовых алгоритмов не знает, поэтому на стенде их нет. Стенд проверяет модель: сообщение дополняется до того размера, который дала бы подпись (`paper/grids/matrix-pq.json`, `paper/stand-results/pq-sizes`). Сейчас модель проверена до 40 КБ прибавки в запросе и 30 КБ в ответе, это три пачки пакетов. Если модель выйдет за этот диапазон (SLH-DSA в роли CA/OCSP), нужны новые точки сетки.

## Список

| # | Группа | Варианты (имена в BC 1.84) | Роль в модели | Где в источниках |
|---|---|---|---|---|
| 1 | RSA, текущее | `SHA512withRSA` 2048 и 3072 (уже в бенчмарке) | базовая линия; 3072 — в пакетах EE/FI | везде |
| 2 | ECDSA | `SHA512withECDSA` на `secp256r1` и `secp384r1` | классическая альтернатива, X-Road её поддерживает | NIIS (уязвим, EdDSA удобнее для перехода); Cybernetica (гибрид с эллиптическими кривыми); Paquin и Sikeridis (базовая линия P-256) |
| 3 | ML-DSA (FIPS 204) | `ML-DSA-44`, `ML-DSA-65`, `ML-DSA-87` (уже в бенчмарке) | подпись участников (A); участники, CA и OCSP (B) | NIIS C3 (Dilithium, без параметров); Cybernetica (Dilithium5); Paquin (Dilithium2); XATF (ML-DSA-65); Sikeridis |
| 4 | Falcon / FN-DSA (FIPS 206, черновик) | `FALCON-512`, `FALCON-1024` | как ML-DSA, самые компактные решёточные подписи | NIIS C3 (только название); Cybernetica (Falcon-1024, для сообщений и глобальной конфигурации); Sikeridis |
| 5 | Гибрид / composite (RFC 10073) | `MLDSA44-RSA2048-PSS-SHA256`, `MLDSA44-ECDSA-P256-SHA256`, `MLDSA65-RSA3072-PSS-SHA512`, `MLDSA65-ECDSA-P256-SHA512`, `MLDSA87-RSA4096-PSS-SHA512`, `MLDSA87-ECDSA-P384-SHA512` | переходный период | NIIS C4 (основная рекомендация); Cybernetica (склейка подписей для сообщений); XATF (RSA-4096 + ML-DSA-65, OpenSSL 3.5) |
| 6 | SLH-DSA (FIPS 205) | `SLH-DSA-SHA2-128S`, `-128F`, `-256S` (алгоритм подписи `SLH-DSA`) | только CA и OCSP: подпись `s` длится около секунды, для каждого сообщения не годится | NIIS C3 (SPHINCS+, частая смена ключей); Cybernetica (SPHINCS+-256f/256s); Sikeridis |

Размеры из проверочного прогона 17.11 (байты: открытый ключ в DER SPKI / подпись). Это не замер скорости:

| Вариант | Ключ | Подпись |
|---|---|---|
| ECDSA P-256 | 91 | 70 (DER, переменная длина) |
| ECDSA P-384 | 120 | 104 |
| Falcon-512 | 915 | 653 (переменная длина) |
| Falcon-1024 | 1811 | 1267 |
| SLH-DSA-SHA2-128s | 50 | 7856 |
| SLH-DSA-SHA2-128f | 50 | 17088 |
| SLH-DSA-SHA2-192s | 66 | 16224 |
| SLH-DSA-SHA2-256s | 82 | 29792 |
| ML-DSA-44 + RSA-2048 | 1603 | 2676 |
| ML-DSA-44 + P-256 | 1398 | 2492 |
| ML-DSA-65 + RSA-3072 | 2371 | 3693 |
| ML-DSA-65 + P-256 | 2038 | 3379 |
| ML-DSA-87 + RSA-4096 | 3139 | 5139 |
| ML-DSA-87 + P-384 | 2710 | 4730 |

Ранее измерено (`results/2026-11-16-16-07/sizes.csv`): RSA-2048 294/256, RSA-3072 422/384, ML-DSA-44 1334/2420, ML-DSA-65 1974/3309, ML-DSA-87 2614/4627.

Замер скорости: `results/2026-11-17-21-23` (ночь 17–18.11, 1 ч 14 мин, ошибок нет). SLH-DSA-128s и 256s идут отдельным `SlowSignBench.java` (итерации по 5 с, 3 форка): подпись 0.70 и 1.09 с. Модель размеров по всем вариантам: `results/sizemodel.csv`.

## Вычисления на сообщение (`compute.js` → `results/compute.csv`)
Сколько операций на одно сообщение, по исходникам X-Road 7.8.3 (1 синхронный SOAP-запрос):
- подпись: ss1 подписывает запрос, ss2 подписывает ответ — 2 подписи ключом участника;
- проверка подписи сообщения: ss2 проверяет запрос, ss1 проверяет ответ (`SignatureVerifier.verifySignatureValue`) — 2 проверки;
- цепочка сертификатов: PKIX build+validate на каждом сообщении без кэша (`CertChainVerifier.verifyImpl`), это одна подпись CA на каждую цепочку. Цепочки такие: сертификат подписи запроса (на ss2) и ответа (на ss1), сертификат аутентификации ss1 на ss2 (`ServerMessageProcessor.verifySslClientCert`, на каждом сообщении) и сертификат аутентификации ss2 на ss1 (`AuthTrustVerifier`, только на новом соединении). Итого 4 проверки подписи CA в `full` и 3 в `reuse`;
- OCSP: подпись ответа и сертификат ответчика проверяются раз в 60 с (`OcspVerifier.RESPONSE_VALIDITY_CACHE`, `proxy.ocsp-verifier-cache-period`, максимум 180 с). Подписи OCSP и CA делаются вне пути сообщения. Поэтому медленная подпись SLH-DSA (0.7–1.1 с) в роли CA и OCSP на сообщение не влияет, а на сообщение влияет только проверка (0.6–1.8 мс × 3–4).

Итог по бенчмарку 17–18.11, разница с base (RSA-2048, CA RSA-4096: 1.7 мс на сообщение):
- ECDSA, ML-DSA-44/65, Falcon, composite с ECDSA (кроме ML-DSA-87+P-384) — дешевле base на 0.2–1.3 мс;
- ML-DSA-87 — от −0.1 до +0.15 мс;
- composite с RSA: ML-DSA-44+RSA-2048 +0.6 мс, ML-DSA-65+RSA-3072 +3.3…3.5 мс, ML-DSA-87+RSA-4096 +8.7…9.3 мс (подпись RSA-3072/4096);
- ML-DSA-87+P-384 в B: +1.3…1.6 мс;
- SLH-DSA в CA/OCSP: 128s +0.7…2.0 мс, 256s +3.0…5.0 мс, 128f +4.3…6.8 мс (128f проверяется медленнее 256s).
Для сравнения: один RTT на сети — 20–50 мс, разброс стенда 1–3 мс. Вычисления меняют картину только у composite с RSA-3072/4096 и у SLH-DSA, и даже там меньше одного RTT.

Оговорки:
- проверку RSA-4096 в бенчмарке не мерили: оценка как разность composite ML-DSA-87+RSA-4096 и ML-DSA-87 (84 мкс);
- Вычисления померены на BC 1.84 под JDK 21, как в X-Road 7.8.3. Своя ML-DSA в JDK появилась только в 24 (JEP 497); другая библиотека или другая версия Java может дать другое время (в статье — ограничение);
- при построении цепочки PKIX подпись CA может проверяться дважды (builder и validator), так что 3–4 — нижняя граница;
- сертификаты аутентификации считаются того же алгоритма, что подпись участника, и выпущены тем же CA;
- 1 VU. Под нагрузкой signer подписывает пачкой (одна подпись на несколько сообщений), цена подписи на сообщение падает.

## Что не берём
- **LMS/XMSS.** Cybernetica предлагает их только для подписи глобальной конфигурации, а её нет на пути сообщения. Подпись с состоянием серверу, который подписывает каждое сообщение, не подходит.
- **qTESLA, Picnic** (Paquin), **Rainbow, MQDSS** (Sikeridis). Сняты с конкурса NIST или взломаны.
- **KEM** (Kyber/ML-KEM, HQC, FrodoKEM, Classic McEliece, SIKE, BIKE). Это TLS между SS, а не подпись сообщения. В обсуждении упомянуть «harvest now, decrypt later» (NIIS T4, мера C8).
- **Дополнительный конкурс NIST** (MAYO, SNOVA и другие; MAYO и SNOVA есть в BCPQC). В наших источниках их нет, NIIS упоминает его только общими словами («short signatures and fast verification», угроза PQC.T2).

## Composite в BouncyCastle: версии
- BC 1.83 (27.11.2025): «composite signatures implementation has been updated to the final draft and now follows the submitted standard». Последняя редакция на тот момент — `draft-ietf-lamps-pq-composite-sigs-13` (31.10.2025).
- BC 1.84 (14.04.2026): только исправления (OID brainpool/EdDSA в построителях ключей; CVE-2026-5588 в старом generic-composite, который мы не используем). На редакцию -15 (24.02.2026) явно не переходил. Редакции -16…-19 вышли после 1.84 (8–21.04.2026).
- **RFC 10073** (ноябрь 2026, опубликован 6.11.2026 из редакции -19): «Composite ML-DSA for Use in X.509 PKI», Ounsworth, Gray, Pala, Klaußner, Fluhrer.
- OID у BC 1.84 совпадают с RFC 10073 (проверено): MLDSA44-RSA2048-PSS-SHA256 = 1.3.6.1.5.5.7.6.37, MLDSA65-RSA3072-PSS-SHA512 = .41, MLDSA65-ECDSA-P256-SHA512 = .45, MLDSA87-ECDSA-P384-SHA512 = .49.
- Не проверено: совпадают ли сами подписи байт в байт (Prefix/Label/ctx, RFC 10073 разд. 2.2). Проверяется тестовыми векторами из RFC. На размер (склейка ML-DSA и классической подписи) и скорость не влияет.
- В BC после 1.84 исправлены ошибки composite: пустое сообщение, ctx > 255 байт, игнорирование SecureRandom, у KEM ещё и регистрация классов ключей. Наш случай (1 КБ, без ctx) они не задевают.
- В статье: ссылаться на RFC 10073 и указать, что реализация BC 1.84 сделана по редакциям до RFC.

## X-Road и NIIS, состояние на 17.11.2026
- X-Road 7.8.3: EC-ключи с 7.6.0 (XRDDEV-2693/2694/2695). Кривая по умолчанию `secp256r1` (`SystemProperties.DEFAULT_SIGNER_KEY_NAMED_CURVE`, параметр `signer.key-named-curve`). Алгоритмы ECDSA-SHA256/384/512 в `SignAlgorithm.java`. Постквантовых алгоритмов нет ни в 7.8.3, ни в журнале изменений 8.0.0 (не выпущен).
- Последняя публикация NIIS — «Migration of X-Road to Post-Quantum Cryptography» (13.01.2026, ISBN 978-9916-9853-4-2), она у нас в `sources/`. Главная рекомендация — гибридный переход (C4). X-Road уже умеет два способа подписи (пакетный и одиночный), так что третий, постквантовый, добавить «relatively easy».
- В дорожной карте X-Road на 2024–2031 PQC нет (X-Road 8: data spaces, monitoring, cloud; X-Road 9: low-code, AI).
- По Эстонии (ENISA): RIA заказала у NIIS «X-tee path to PQC». Национальная дорожная карта — апрель 2026: высокий риск к 2030, остальное к 2035.

## Ссылки
- `sources/REPORT_Migration_of_X-Road_to_Post-Quantum_Cryptography.FINAL.pdf`: меры C3, C4, C8 (табл. 6, с. 28–29); угрозы PQC.T1–T3 (с. 30); SPHINCS+ и гибриды (с. 31).
- `sources/PQC_UXP_report_8c97d91552.pdf`: Snetkov, Vakarjuk, Cybernetica D-2-499, 2023. Табл. 2 — картинка, цифры в `sources/literature_summary.md`, раздел 5.
- `sources/PQCrypto-PaqSteTam20.pdf`: Paquin, Stebila, Tamvada, PQCrypto 2020, табл. 2–3.
- `sources/XATF_...pdf`: гибрид RSA-4096 + ML-DSA-65.
- Sikeridis, Kampanakis, Devetsikiotis, NDSS 2020, DOI 10.14722/ndss.2020.24203, PDF в `paper/sources/`.
- FIPS 204 (ML-DSA), FIPS 205 (SLH-DSA), RFC 10073: в `paper/sources/`. FIPS 206 (FN-DSA) — черновик.
- RFC 10073: https://www.rfc-editor.org/rfc/rfc10073.txt
- История черновика: https://datatracker.ietf.org/doc/draft-ietf-lamps-pq-composite-sigs/history/
- Примечания к выпускам BC: https://raw.githubusercontent.com/bcgit/bc-java/main/docs/releasenotes.md
- NIIS publications: https://www.niis.org/niis-publications
- Дорожная карта X-Road: https://x-road.global/development-roadmap
- ENISA: https://www.enisa.europa.eu/media/57521
- Журнал изменений X-Road: https://raw.githubusercontent.com/nordic-institute/X-Road/develop/CHANGELOG.md

## Открыто
- ECDSA в роли B даёт по модели −1 RTT (запрос влезает в первую пачку). Сетка проверяла только рост, уменьшение дополнением тела не проверить.
- Модель проверена сетками до +190.6 КБ в запросе и +132.5 КБ в ответе (`paper/stand-results/pq-large-*`, 18–19.11). Вне диапазона только ML-DSA-87 + SLH-DSA-256s (+2.8 КБ сверху, число пачек то же).
- С четвёртой пачки запрос упирается в окно приёма ss2, а не в cwnd (`paper/stand-results/flows-pq/C256S`). Величина окна зависит от автонастройки получателя и RTT. Цифры 36/41 сегментов — для этого стенда.

## Решения
- **ECDSA на стенде вживую не гоняем** (17.11). Бенчмарк предсказывает разницу с RSA меньше 1 мс на весь путь, а разброс между повторами на стенде 1–3 мс, между ночами больше. Сообщение меньше примерно на 1 КБ, число пачек по модели не меняется. Прогон дал бы «разницы нет», а это не подтверждает ни перенос времени из бенчмарка, ни модель размеров. Модель уже проверена дополнением тела (`paper/stand-results/pq-sizes`, 12 из 12). ECDSA остаётся в бенчмарке и в модели как классическая альтернатива.

## Pre-hash (`PrehashBench.java` → `results/2026-11-19-21-20-prehash`, 19.11)
Signer X-Road получает хэш `SignedInfo`, а чистые ML-DSA и SLH-DSA подписывают сами данные, поэтому при переходе нужны HashML-DSA, HashSLH-DSA и составные `-PREHASH` (или другой интерфейс signer). В одном прогоне с настройками SignBench сравнены пары: ML-DSA-44/65/87 и `-WITH-SHA512`, SLH-DSA-SHA2-128F и `-WITH-SHA256`, MLDSA44-RSA2048-PSS-SHA256, MLDSA65-ECDSA-P256-SHA512, MLDSA87-ECDSA-P384-SHA512 и их `-PREHASH`. Составному `-PREHASH` на вход подаётся хэш данных, как в signer X-Road.
Итог: проверка отличается не больше чем на 7 мкс (SLH 0.4 %, остальные 1–5 %). Подпись ML-DSA и составных отличается до 83 мкс, это внутри ошибки среднего (повторы со случайным числом попыток). Подпись SLH-128f отличается на 0.9 %. На обмен (2 подписи и 2 проверки ключом участника) выходит меньше 0.2 мс, поэтому оценки по чистым вариантам годятся. Falcon не мерили.

## Модель пачек: правка после `pq-edge` (20.11)
Сетка `paper/grids/matrix-pq-edge.json` (`paper/stand-results/pq-edge-2026-11-19-22-16-g1`) нашла промах на B ML-DSA-65+P-256. Первая пачка запроса — 9 сегментов, а не 8, запрос занимает не меньше 2 пачек (у base последний неполный сегмент ждёт ACK; не Nagle — `TCP_NODELAY=true`, причина по записям не видна). Совпадают 26 из 26 точек. Подробности — в README `stand-results`.
