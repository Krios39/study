# Обмены ss1 ↔ ss2: full, reuse × RTT 50 мс, 20 запросов по 40594 Б

| config | RTT задан | RTT потока (ядро) | соединения | запрос по записи, мс | curl, мс | паузы ≥0.4·RTT | сумма пауз, мс | др. порты |
|---|---|---|---|---|---|---|---|---|
| full | 50 | 50.78 (min 50.17) | new TCP + resumed TLS: 20 | 364.8 | 415.9 | 14 | 349.7 | — |
| reuse | 50 | 55.28 (min 50.03) | reused connection: 1 | 3742.0 | 172.8 | 104 | 2981.7 | — |

RTT потока — сглаженный rtt сокетов ss1 → ss2:5500 по ядру (ss -tin) во время запросов, в скобках minrtt (у соединений пула — минимум с момента открытия, в т. ч. до смены задержки). В хронологии исходящие пакеты ss1 видны уже после очереди netem (сдвиг на RTT/2), входящие — по приходу. Запрос по записи — от первого пакета запроса до последних данных ответа на канале ss1 ↔ ss2. Пауза — промежуток между соседними пакетами запроса не меньше max(0.4·RTT, 1 мс).

## full, RTT 50 мс — медианный запрос (new TCP + resumed TLS, 364.9 мс)

Паузы:
- 25.1 мс: после «← ss2 SYN-ACK» до «ss1 → ACK»
- 25.1 мс: после «ss1 → ClientHello 2800 B» до «← ss2 ACK»
- 25.0 мс: после «← ss2 Finished (enc.) 45 B» до «ss1 → ACK»
- 25.1 мс: после «ss1 → data (cont.) 2896 B» до «← ss2 ACK»
- 25.0 мс: после «← ss2 ACK» до «ss1 → data (cont.) 2896 B»
- 25.2 мс: после «ss1 → data (cont.) 2896 B» до «← ss2 ACK»
- 24.5 мс: после «← ss2 ACK» до «ss1 → data (cont.) 2896 B»
- 24.6 мс: после «ss1 → data (cont.) 2808 B» до «← ss2 ACK»
- 25.4 мс: после «← ss2 ACK» до «← ss2 data 224 B»
- 25.5 мс: после «← ss2 data 63 B» до «ss1 → ACK»
- 25.1 мс: после «ss1 → ACK» до «← ss2 data 2896 B»
- 25.0 мс: после «← ss2 data (cont.) 2896 B» до «ss1 → ACK»
- 25.1 мс: после «ss1 → ACK» до «← ss2 data (cont.) 2896 B»

```
    0.00  ss1 → SYN
   10.05  ← ss2 ACK
   10.06  ← ss2 ACK
   25.12  ← ss2 SYN-ACK
   50.21  ss1 → ACK
   51.13  ss1 → ClientHello 2800 B
   76.22  ← ss2 ACK
   78.82  ← ss2 TLS hs 2+4 2660 B
   78.85  ← ss2 ChangeCipherSpec 6 B
   78.86  ← ss2 Finished (enc.) 45 B
  103.90  ss1 → ACK
  103.91  ss1 → ACK
  103.91  ss1 → ACK
  104.49  ss1 → ChangeCipherSpec 6 B
  112.17  ss1 → Finished (enc.) 2896 B
  112.17  ss1 → data (cont.) 2896 B
  112.22  ss1 → data (cont.) 2896 B
  112.22  ss1 → data (cont.) 1448 B
  112.24  ss1 → data (cont.) 2896 B
  137.32  ← ss2 ACK
  137.35  ← ss2 ACK
  137.36  ← ss2 ACK
  137.36  ← ss2 ACK
  162.40  ss1 → data (cont.) 2896 B
  162.40  ss1 → data (cont.) 2896 B
  162.40  ss1 → data (cont.) 2896 B
  162.40  ss1 → data (cont.) 2896 B
  162.40  ss1 → data (cont.) 2896 B
  162.40  ss1 → data (cont.) 2896 B
  162.40  ss1 → data (cont.) 2896 B
  162.41  ss1 → data (cont.) 2896 B
  162.41  ss1 → data (cont.) 2896 B
  162.41  ss1 → data (cont.) 2896 B
  187.57  ← ss2 ACK
  188.09  ← ss2 ACK
  212.64  ss1 → data (cont.) 2896 B
  212.64  ss1 → data (cont.) 2896 B
  213.16  ss1 → data (cont.) 2896 B
  213.16  ss1 → data (cont.) 2808 B
  237.76  ← ss2 ACK
  237.97  ← ss2 ACK
  238.20  ← ss2 ACK
  238.44  ← ss2 ACK
  263.80  ← ss2 data 224 B
  263.82  ← ss2 data 63 B
  263.82  ← ss2 data 31 B
  263.82  ← ss2 data 75 B
  263.82  ← ss2 data 31 B
  263.82  ← ss2 data 31 B
  263.82  ← ss2 data 419 B
  263.96  ← ss2 data 31 B
  263.96  ← ss2 data 31 B
  263.97  ← ss2 data 63 B
  289.49  ss1 → ACK
  314.60  ← ss2 data 2896 B
  314.62  ← ss2 data (cont.) 2896 B
  314.63  ← ss2 data (cont.) 2896 B
  314.63  ← ss2 data (cont.) 2896 B
  314.63  ← ss2 data (cont.) 2896 B
  314.63  ← ss2 data (cont.) 2896 B
  314.63  ← ss2 data (cont.) 2896 B
  314.63  ← ss2 data (cont.) 2896 B
  314.63  ← ss2 data (cont.) 2896 B
  314.63  ← ss2 data (cont.) 2896 B
  339.66  ss1 → ACK
  339.67  ss1 → ACK
  339.67  ss1 → ACK
  339.67  ss1 → ACK
  364.81  ← ss2 data (cont.) 2896 B
  364.84  ← ss2 data (cont.) 2896 B
  364.85  ← ss2 data (cont.) 2896 B
  364.85  ← ss2 data (cont.) 2896 B
  364.85  ← ss2 data (cont.) 2896 B
  364.85  ← ss2 data (cont.) 2896 B
  364.85  ← ss2 data (cont.) 2896 B
  364.85  ← ss2 FIN 1954 B
```

## reuse, RTT 50 мс — медианный запрос (reused connection, 3742.0 мс)

Паузы:
- 24.8 мс: после «ss1 → data (cont.) 1448 B» до «← ss2 ACK»
- 20.8 мс: после «← ss2 ACK» до «ss1 → data (cont.) 2896 B»
- 21.2 мс: после «ss1 → data (cont.) 2896 B» до «← ss2 ACK»
- 20.8 мс: после «← ss2 ACK» до «ss1 → data (cont.) 2896 B»
- 25.5 мс: после «ss1 → data (cont.) 1373 B» до «← ss2 ACK»
- 20.2 мс: после «← ss2 ACK» до «← ss2 data 236 B»
- 25.4 мс: после «← ss2 data 69 B» до «ss1 → ACK»
- 25.3 мс: после «ss1 → ACK» до «← ss2 data 2896 B»
- 25.1 мс: после «← ss2 data (cont.) 2896 B» до «ss1 → ACK»
- 25.2 мс: после «ss1 → ACK» до «← ss2 data (cont.) 2896 B»
- 25.1 мс: после «← ss2 data (cont.) 2186 B» до «ss1 → ACK»
- 42.6 мс: после «ss1 → ACK» до «ss1 → data (cont.) 2896 B»
- 52.1 мс: после «ss1 → data (cont.) 1373 B» до «← ss2 data 236 B»
- 24.9 мс: после «← ss2 data (cont.) 1448 B» до «ss1 → ACK»
- 25.1 мс: после «ss1 → ACK» до «← ss2 data (cont.) 2896 B»
- 25.0 мс: после «← ss2 data (cont.) 564 B» до «ss1 → ACK»
- 29.1 мс: после «ss1 → ACK» до «ss1 → data (cont.) 2896 B»
- 41.2 мс: после «ss1 → data (cont.) 1373 B» до «← ss2 data 236 B»
- 21.0 мс: после «← ss2 data 741 B» до «← ss2 data 36 B»
- 21.0 мс: после «ss1 → ACK» до «ss1 → ACK»
- 31.0 мс: после «ss1 → ACK» до «ss1 → data (cont.) 2896 B»
- 22.7 мс: после «ss1 → data (cont.) 1448 B» до «ss1 → data (cont.) 2896 B»
- 22.7 мс: после «← ss2 ACK» до «← ss2 ACK»
- 42.6 мс: после «ss1 → data (cont.) 1373 B» до «← ss2 data 236 B»
- 28.6 мс: после «ss1 → ACK» до «ss1 → data (cont.) 2896 B»
- 55.4 мс: после «ss1 → data (cont.) 1373 B» до «← ss2 data 236 B»
- 24.3 мс: после «← ss2 data 741 B» до «← ss2 data 36 B»
- 24.6 мс: после «ss1 → ACK» до «ss1 → ACK»
- 31.8 мс: после «ss1 → ACK» до «ss1 → data (cont.) 2896 B»
- 22.4 мс: после «ss1 → data (cont.) 1448 B» до «ss1 → data (cont.) 2896 B»
- 22.4 мс: после «← ss2 ACK» до «← ss2 ACK»
- 48.4 мс: после «ss1 → data (cont.) 1373 B» до «← ss2 data 236 B»
- 29.0 мс: после «ss1 → ACK» до «ss1 → data (cont.) 2896 B»
- 20.1 мс: после «ss1 → data (cont.) 1448 B» до «ss1 → data (cont.) 2896 B»
- 20.1 мс: после «← ss2 ACK» до «← ss2 ACK»
- 43.7 мс: после «ss1 → data (cont.) 1373 B» до «← ss2 data 236 B»
- 20.4 мс: после «ss1 → ACK» до «ss1 → data (cont.) 2896 B»
- 21.8 мс: после «ss1 → data (cont.) 1448 B» до «ss1 → data (cont.) 2896 B»
- 44.1 мс: после «ss1 → data (cont.) 1373 B» до «← ss2 data 236 B»
- 24.4 мс: после «← ss2 data 741 B» до «← ss2 data 36 B»
- 24.5 мс: после «ss1 → ACK» до «ss1 → ACK»
- 25.3 мс: после «ss1 → ACK» до «ss1 → data (cont.) 2896 B»
- 21.1 мс: после «ss1 → data (cont.) 1448 B» до «ss1 → data (cont.) 2896 B»
- 21.0 мс: после «← ss2 ACK» до «← ss2 ACK»
- 42.5 мс: после «ss1 → data (cont.) 1373 B» до «← ss2 data 236 B»
- 21.4 мс: после «← ss2 data 741 B» до «← ss2 data 36 B»
- 21.5 мс: после «ss1 → ACK» до «ss1 → ACK»
- 33.6 мс: после «ss1 → ACK» до «ss1 → data (cont.) 2896 B»
- 24.8 мс: после «ss1 → data (cont.) 1448 B» до «← ss2 ACK»
- 20.1 мс: после «← ss2 ACK» до «ss1 → data (cont.) 1373 B»
- 42.1 мс: после «← ss2 ACK» до «← ss2 data 236 B»
- 29.3 мс: после «ss1 → ACK» до «ss1 → data (cont.) 2896 B»
- 21.1 мс: после «ss1 → data (cont.) 1448 B» до «ss1 → data (cont.) 2896 B»
- 21.0 мс: после «← ss2 ACK» до «← ss2 ACK»
- 59.7 мс: после «ss1 → data (cont.) 1373 B» до «← ss2 data 236 B»
- 22.0 мс: после «← ss2 data 741 B» до «ss1 → ACK»
- 21.7 мс: после «← ss2 data 36 B» до «ss1 → ACK»
- 47.0 мс: после «ss1 → ACK» до «ss1 → data (cont.) 2896 B»
- 25.0 мс: после «ss1 → data (cont.) 1448 B» до «← ss2 ACK»
- 40.4 мс: после «← ss2 ACK» до «← ss2 data 236 B»
- 21.6 мс: после «← ss2 data 741 B» до «← ss2 data 36 B»
- 21.7 мс: после «ss1 → ACK» до «ss1 → ACK»
- 27.5 мс: после «ss1 → ACK» до «ss1 → data (cont.) 2896 B»
- 25.2 мс: после «ss1 → data (cont.) 1448 B» до «← ss2 ACK»
- 20.2 мс: после «← ss2 ACK» до «ss1 → data (cont.) 1373 B»
- 59.1 мс: после «← ss2 ACK» до «← ss2 data 236 B»
- 23.5 мс: после «← ss2 data 7982 B» до «ss1 → ACK»
- 24.9 мс: после «← ss2 data 36 B» до «ss1 → ACK»
- 32.0 мс: после «ss1 → ACK» до «ss1 → data (cont.) 2896 B»
- 44.5 мс: после «ss1 → data (cont.) 1373 B» до «← ss2 data 236 B»
- 21.5 мс: после «← ss2 data 7982 B» до «← ss2 data 36 B»
- 21.7 мс: после «ss1 → ACK» до «ss1 → ACK»
- 27.6 мс: после «ss1 → ACK» до «ss1 → data (cont.) 2896 B»
- 21.8 мс: после «ss1 → data (cont.) 1448 B» до «ss1 → data (cont.) 2896 B»
- 46.9 мс: после «ss1 → data (cont.) 1373 B» до «← ss2 data 236 B»
- 23.0 мс: после «← ss2 data 741 B» до «← ss2 data 36 B»
- 23.2 мс: после «ss1 → ACK» до «ss1 → ACK»
- 35.7 мс: после «ss1 → ACK» до «ss1 → data (cont.) 2896 B»
- 22.4 мс: после «ss1 → data (cont.) 1448 B» до «ss1 → data (cont.) 2896 B»
- 22.2 мс: после «← ss2 ACK» до «← ss2 ACK»
- 51.2 мс: после «ss1 → data (cont.) 1373 B» до «← ss2 data 236 B»
- 24.4 мс: после «← ss2 data 741 B» до «← ss2 data 36 B»
- 24.4 мс: после «← ss2 data 36 B» до «ss1 → ACK»
- 25.8 мс: после «ss1 → ACK» до «ss1 → data (cont.) 2896 B»
- 21.6 мс: после «ss1 → data (cont.) 1448 B» до «ss1 → data (cont.) 2896 B»
- 47.4 мс: после «ss1 → data (cont.) 1373 B» до «← ss2 data 236 B»
- 21.3 мс: после «← ss2 data 741 B» до «← ss2 data 36 B»
- 21.4 мс: после «ss1 → ACK» до «ss1 → ACK»
- 32.6 мс: после «ss1 → ACK» до «ss1 → data (cont.) 2896 B»
- 22.3 мс: после «ss1 → data (cont.) 1448 B» до «ss1 → data (cont.) 2896 B»
- 22.3 мс: после «← ss2 ACK» до «← ss2 ACK»
- 46.2 мс: после «ss1 → data (cont.) 1373 B» до «← ss2 data 236 B»
- 21.4 мс: после «← ss2 data 741 B» до «← ss2 data 36 B»
- 21.5 мс: после «ss1 → ACK» до «ss1 → ACK»
- 32.7 мс: после «ss1 → ACK» до «ss1 → data (cont.) 2896 B»
- 20.5 мс: после «ss1 → data (cont.) 1448 B» до «ss1 → data (cont.) 2896 B»
- 20.3 мс: после «← ss2 ACK» до «← ss2 ACK»
- 45.3 мс: после «ss1 → data (cont.) 1373 B» до «← ss2 data 236 B»
- 22.5 мс: после «← ss2 data 741 B» до «← ss2 data 36 B»
- 22.6 мс: после «ss1 → ACK» до «ss1 → ACK»
- 32.1 мс: после «ss1 → ACK» до «ss1 → data (cont.) 2896 B»
- 22.2 мс: после «ss1 → data (cont.) 1448 B» до «ss1 → data (cont.) 2896 B»
- 22.2 мс: после «← ss2 ACK» до «← ss2 ACK»
- 44.1 мс: после «ss1 → data (cont.) 1373 B» до «← ss2 data 236 B»

```
    0.00  ss1 → data (cont.) 2896 B
    0.00  ss1 → data (cont.) 2896 B
    0.00  ss1 → data (cont.) 1374 B
    0.56  ss1 → data (cont.) 2896 B
    0.65  ss1 → data (cont.) 2896 B
    0.65  ss1 → data (cont.) 1448 B
   25.44  ← ss2 ACK
   29.78  ← ss2 ACK
   50.55  ss1 → data (cont.) 2896 B
   50.55  ss1 → data (cont.) 2896 B
   50.55  ss1 → data (cont.) 2896 B
   50.55  ss1 → data (cont.) 2896 B
   50.55  ss1 → data (cont.) 2896 B
   54.88  ss1 → data (cont.) 2896 B
   54.89  ss1 → data (cont.) 2896 B
   54.89  ss1 → data (cont.) 2896 B
   54.89  ss1 → data (cont.) 2896 B
   54.89  ss1 → data (cont.) 2896 B
   76.05  ← ss2 ACK
   80.32  ← ss2 ACK
  101.15  ss1 → data (cont.) 2896 B
  101.15  ss1 → data (cont.) 2896 B
  101.15  ss1 → data (cont.) 2896 B
  101.15  ss1 → data (cont.) 1373 B
  126.61  ← ss2 ACK
  146.77  ← ss2 data 236 B
  146.82  ← ss2 data 69 B
  146.82  ← ss2 data 36 B
  146.82  ← ss2 data 81 B
  146.82  ← ss2 data 36 B
  146.83  ← ss2 data 36 B
  146.83  ← ss2 data 426 B
  147.29  ← ss2 data 36 B
  147.30  ← ss2 data 36 B
  147.30  ← ss2 data 69 B
  172.69  ss1 → ACK
  197.95  ← ss2 data 2896 B
  197.99  ← ss2 data (cont.) 2896 B
  197.99  ← ss2 data (cont.) 2896 B
  197.99  ← ss2 data (cont.) 2896 B
  197.99  ← ss2 data (cont.) 2896 B
  197.99  ← ss2 data (cont.) 2896 B
  197.99  ← ss2 data (cont.) 2896 B
  197.99  ← ss2 data (cont.) 2896 B
  197.99  ← ss2 data (cont.) 2896 B
  197.99  ← ss2 data (cont.) 2896 B
  223.11  ss1 → ACK
  248.31  ← ss2 data (cont.) 2896 B
  248.36  ← ss2 data (cont.) 2896 B
  248.36  ← ss2 data (cont.) 2896 B
  248.36  ← ss2 data (cont.) 2896 B
  248.36  ← ss2 data (cont.) 2896 B
  248.37  ← ss2 data (cont.) 2896 B
  248.37  ← ss2 data (cont.) 2896 B
  248.37  ← ss2 data (cont.) 2186 B
  273.45  ss1 → ACK
  273.45  ss1 → ACK
  316.02  ss1 → data (cont.) 2896 B
  316.02  ss1 → data (cont.) 2896 B
  316.02  ss1 → data (cont.) 1374 B
  316.02  ss1 → data (cont.) 2896 B
  316.07  ss1 → data (cont.) 2896 B
  316.07  ss1 → data (cont.) 2896 B
  316.07  ss1 → data (cont.) 2896 B
  316.11  ss1 → data (cont.) 2896 B
  316.11  ss1 → data (cont.) 2896 B
  316.11  ss1 → data (cont.) 2896 B
  316.17  ss1 → data (cont.) 2896 B
  316.17  ss1 → data (cont.) 2896 B
  316.17  ss1 → data (cont.) 1448 B
  335.30  ss1 → data (cont.) 2896 B
  335.31  ss1 → data (cont.) 2896 B
  335.31  ss1 → data (cont.) 2896 B
  335.31  ss1 → data (cont.) 1448 B
  335.31  ss1 → data (cont.) 2896 B
  335.31  ss1 → data (cont.) 2896 B
  335.31  ss1 → data (cont.) 1448 B
  341.45  ← ss2 ACK
  360.45  ← ss2 ACK
  360.56  ← ss2 ACK
  366.57  ss1 → data (cont.) 1373 B
  418.64  ← ss2 data 236 B
  418.66  ← ss2 data 69 B
  418.66  ← ss2 data 36 B
  418.66  ← ss2 data 81 B
  418.66  ← ss2 data 36 B
  418.67  ← ss2 data 36 B
  418.67  ← ss2 data 426 B
  419.19  ← ss2 data 36 B
  419.22  ← ss2 data 36 B
  419.23  ← ss2 data 69 B
  419.24  ← ss2 data 36 B
  419.25  ← ss2 data 77 B
  419.26  ← ss2 data 36 B
  419.26  ← ss2 data 36 B
  419.40  ← ss2 data (cont.) 2896 B
  419.41  ← ss2 data (cont.) 2896 B
  419.41  ← ss2 data (cont.) 1366 B
  419.48  ← ss2 data (cont.) 2896 B
  419.49  ← ss2 data (cont.) 2896 B
  419.49  ← ss2 data (cont.) 2437 B
  419.50  ← ss2 data (cont.) 2896 B
  419.50  ← ss2 data (cont.) 2896 B
  419.50  ← ss2 data (cont.) 2437 B
  419.55  ← ss2 data (cont.) 2896 B
  419.55  ← ss2 data (cont.) 2896 B
  419.55  ← ss2 data (cont.) 2437 B
  419.62  ← ss2 data (cont.) 2896 B
  419.63  ← ss2 data (cont.) 1448 B
  444.51  ss1 → ACK
  444.65  ss1 → ACK
  444.69  ss1 → ACK
  469.76  ← ss2 data (cont.) 2896 B
  469.83  ← ss2 data (cont.) 2896 B
  469.83  ← ss2 data (cont.) 2896 B
  469.83  ← ss2 data (cont.) 2896 B
  469.84  ← ss2 data (cont.) 2896 B
  469.84  ← ss2 data (cont.) 564 B
  494.87  ss1 → ACK
  494.94  ss1 → ACK
  524.02  ss1 → data (cont.) 2896 B
  524.02  ss1 → data (cont.) 2896 B
  524.02  ss1 → data (cont.) 1374 B
  524.09  ss1 → data (cont.) 2896 B
  524.10  ss1 → data (cont.) 2896 B
  524.10  ss1 → data (cont.) 2896 B
  524.10  ss1 → data (cont.) 2896 B
  524.18  ss1 → data (cont.) 2896 B
  524.19  ss1 → data (cont.) 2896 B
  524.19  ss1 → data (cont.) 2896 B
  524.24  ss1 → data (cont.) 2896 B
  524.24  ss1 → data (cont.) 2896 B
  524.24  ss1 → data (cont.) 1448 B
  542.01  ss1 → data (cont.) 2896 B
  542.02  ss1 → data (cont.) 2896 B
  542.02  ss1 → data (cont.) 2896 B
  542.02  ss1 → data (cont.) 1448 B
  542.13  ss1 → data (cont.) 2896 B
  542.13  ss1 → data (cont.) 2896 B
  542.13  ss1 → data (cont.) 1448 B
  549.50  ← ss2 ACK
  567.25  ← ss2 ACK
  567.41  ← ss2 ACK
  574.60  ss1 → data (cont.) 1373 B
  615.79  ← ss2 data 236 B
  615.83  ← ss2 data 69 B
  615.83  ← ss2 data 36 B
  615.85  ← ss2 data 81 B
  615.85  ← ss2 data 36 B
  615.85  ← ss2 data 36 B
  615.85  ← ss2 data 426 B
  616.09  ← ss2 data 36 B
  616.09  ← ss2 data 36 B
  616.09  ← ss2 data 69 B
  616.09  ← ss2 data 36 B
  616.09  ← ss2 data 77 B
  616.10  ← ss2 data 36 B
  616.10  ← ss2 data 36 B
  616.18  ← ss2 data (cont.) 4344 B
  616.18  ← ss2 data (cont.) 2814 B
  616.24  ← ss2 data (cont.) 4344 B
  616.24  ← ss2 data (cont.) 3885 B
  616.29  ← ss2 data (cont.) 4344 B
  616.29  ← ss2 data (cont.) 3885 B
  616.33  ← ss2 data (cont.) 4344 B
  616.34  ← ss2 data (cont.) 3885 B
  616.38  ← ss2 data (cont.) 4344 B
  616.39  ← ss2 data (cont.) 3885 B
  616.39  ← ss2 data 741 B
  637.42  ← ss2 data 36 B
  637.45  ← ss2 data 36 B
  637.46  ← ss2 data 69 B
  637.46  ← ss2 data 36 B
  637.46  ← ss2 data 78 B
  637.46  ← ss2 data 36 B
  637.46  ← ss2 data 36 B
  637.46  ← ss2 data 441 B
  637.46  ← ss2 data 36 B
  637.48  ← ss2 data 36 B
  637.48  ← ss2 data 69 B
  637.48  ← ss2 data 36 B
  637.48  ← ss2 data 71 B
  637.48  ← ss2 data 36 B
  637.48  ← ss2 data 36 B
  637.48  ← ss2 data 723 B
  637.50  ← ss2 data 36 B
  637.50  ← ss2 data 36 B
  637.50  ← ss2 data 69 B
  637.50  ← ss2 data 36 B
  637.50  ← ss2 data 70 B
  637.50  ← ss2 data 36 B
  637.50  ← ss2 data 36 B
  637.51  ← ss2 data (cont.) 4344 B
  637.51  ← ss2 data (cont.) 3695 B
  637.51  ← ss2 data 36 B
  637.51  ← ss2 data 36 B
  637.52  ← ss2 data 69 B
  637.52  ← ss2 data 36 B
  637.52  ← ss2 data 36 B
  637.54  ← ss2 data 36 B
  641.55  ss1 → ACK
  662.53  ss1 → ACK
  662.57  ss1 → ACK
  693.61  ss1 → data (cont.) 2896 B
  693.62  ss1 → data (cont.) 2896 B
  693.62  ss1 → data (cont.) 1374 B
  693.74  ss1 → data (cont.) 2896 B
  693.79  ss1 → data (cont.) 2896 B
  693.79  ss1 → data (cont.) 2896 B
  693.79  ss1 → data (cont.) 2896 B
  693.91  ss1 → data (cont.) 2896 B
  693.91  ss1 → data (cont.) 2896 B
  693.91  ss1 → data (cont.) 2896 B
  694.00  ss1 → data (cont.) 2896 B
  694.00  ss1 → data (cont.) 2896 B
  694.00  ss1 → data (cont.) 1448 B
  716.66  ss1 → data (cont.) 2896 B
  716.66  ss1 → data (cont.) 2896 B
  716.66  ss1 → data (cont.) 2896 B
  716.66  ss1 → data (cont.) 1448 B
  716.66  ss1 → data (cont.) 2896 B
  716.66  ss1 → data (cont.) 2896 B
  716.66  ss1 → data (cont.) 1448 B
  719.10  ← ss2 ACK
  741.80  ← ss2 ACK
  742.14  ← ss2 ACK
  744.16  ss1 → data (cont.) 1373 B
  786.80  ← ss2 data 236 B
  786.83  ← ss2 data 69 B
  786.83  ← ss2 data 36 B
  786.83  ← ss2 data 81 B
  786.84  ← ss2 data 36 B
  786.84  ← ss2 data 36 B
  786.84  ← ss2 data 426 B
  787.24  ← ss2 data 36 B
  787.25  ← ss2 data 36 B
  787.26  ← ss2 data 69 B
  787.26  ← ss2 data 36 B
  787.27  ← ss2 data 77 B
  787.28  ← ss2 data 36 B
  787.28  ← ss2 data 36 B
  787.38  ← ss2 data 7158 B
  787.45  ← ss2 data 8229 B
  787.56  ← ss2 data 8229 B
  787.62  ← ss2 data 8229 B
  787.67  ← ss2 data 8229 B
  787.68  ← ss2 data 741 B
  806.21  ← ss2 data 36 B
  806.23  ← ss2 data 36 B
  806.24  ← ss2 data 69 B
  806.24  ← ss2 data 36 B
  806.24  ← ss2 data 78 B
  806.24  ← ss2 data 36 B
  806.24  ← ss2 data 36 B
  806.24  ← ss2 data 441 B
  806.24  ← ss2 data 36 B
  806.24  ← ss2 data 36 B
  806.29  ← ss2 data 69 B
  806.29  ← ss2 data 36 B
  806.29  ← ss2 data 71 B
  806.29  ← ss2 data 36 B
  806.29  ← ss2 data 36 B
  806.29  ← ss2 data 723 B
  806.31  ← ss2 data 36 B
  806.31  ← ss2 data 36 B
  806.31  ← ss2 data 69 B
  806.31  ← ss2 data 36 B
  806.31  ← ss2 data 70 B
  806.31  ← ss2 data 36 B
  806.31  ← ss2 data 36 B
  806.32  ← ss2 data 8039 B
  806.32  ← ss2 data 36 B
  806.32  ← ss2 data 36 B
  806.33  ← ss2 data 69 B
  806.33  ← ss2 data 36 B
  806.33  ← ss2 data 36 B
  806.33  ← ss2 data 36 B
  812.47  ss1 → ACK
  812.48  ss1 → ACK
  812.60  ss1 → ACK
  812.76  ss1 → ACK
  831.35  ss1 → ACK
  831.42  ss1 → ACK
  860.00  ss1 → data (cont.) 2896 B
  860.00  ss1 → data (cont.) 2896 B
  860.00  ss1 → data (cont.) 1374 B
  860.14  ss1 → data (cont.) 2896 B
  860.18  ss1 → data (cont.) 2896 B
  860.18  ss1 → data (cont.) 2896 B
  860.18  ss1 → data (cont.) 2896 B
  860.31  ss1 → data (cont.) 2896 B
  860.31  ss1 → data (cont.) 2896 B
  860.31  ss1 → data (cont.) 2896 B
  860.31  ss1 → data (cont.) 2896 B
  860.31  ss1 → data (cont.) 2896 B
  860.31  ss1 → data (cont.) 1448 B
  878.67  ss1 → data (cont.) 2896 B
  878.67  ss1 → data (cont.) 2896 B
  878.67  ss1 → data (cont.) 2896 B
  878.67  ss1 → data (cont.) 1448 B
  878.67  ss1 → data (cont.) 2896 B
  878.67  ss1 → data (cont.) 2896 B
  878.68  ss1 → data (cont.) 1448 B
  885.35  ← ss2 ACK
  888.68  ← ss2 ACK
  903.82  ← ss2 ACK
  904.00  ← ss2 ACK
  910.41  ss1 → data (cont.) 1373 B
  965.82  ← ss2 data 236 B
  965.87  ← ss2 data 69 B
  965.87  ← ss2 data 36 B
  965.87  ← ss2 data 81 B
  965.87  ← ss2 data 36 B
  965.87  ← ss2 data 36 B
  965.87  ← ss2 data 426 B
  966.11  ← ss2 data 36 B
  966.13  ← ss2 data 36 B
  966.13  ← ss2 data 69 B
  966.29  ← ss2 data 36 B
  966.36  ← ss2 data 77 B
  966.39  ← ss2 data 36 B
  966.41  ← ss2 data 36 B
  966.53  ← ss2 data 7158 B
  966.63  ← ss2 data 8229 B
  966.76  ← ss2 data 8229 B
  966.83  ← ss2 data 8229 B
  966.90  ← ss2 data 8229 B
  967.01  ← ss2 data 741 B
  991.32  ← ss2 data 36 B
  991.41  ← ss2 data 36 B
  991.42  ← ss2 data 69 B
  991.42  ← ss2 data 36 B
  991.42  ← ss2 data 78 B
  991.42  ← ss2 data 36 B
  991.43  ← ss2 data 36 B
  991.43  ← ss2 data 441 B
  991.44  ← ss2 data 36 B
  991.45  ← ss2 data 36 B
  991.45  ← ss2 data 69 B
  991.45  ← ss2 data 36 B
  991.48  ← ss2 data 71 B
  991.48  ← ss2 data 36 B
  991.48  ← ss2 data 36 B
  991.48  ← ss2 data 723 B
  991.48  ← ss2 data 36 B
  991.49  ← ss2 data 36 B
  991.49  ← ss2 data 69 B
  991.49  ← ss2 data 36 B
  991.49  ← ss2 data 70 B
  991.49  ← ss2 data 36 B
  991.49  ← ss2 data 36 B
  991.54  ← ss2 data 8039 B
  991.54  ← ss2 data 36 B
  991.54  ← ss2 data 36 B
  991.55  ← ss2 data 69 B
  991.55  ← ss2 data 36 B
  991.55  ← ss2 data 36 B
  991.61  ← ss2 data 36 B
  991.67  ss1 → ACK
  991.67  ss1 → ACK
  991.78  ss1 → ACK
  991.90  ss1 → ACK
  991.92  ss1 → ACK
 1016.49  ss1 → ACK
 1016.64  ss1 → ACK
 1048.47  ss1 → data (cont.) 2896 B
 1048.47  ss1 → data (cont.) 2896 B
 1048.47  ss1 → data (cont.) 1374 B
 1048.57  ss1 → data (cont.) 2896 B
 1048.57  ss1 → data (cont.) 2896 B
 1048.57  ss1 → data (cont.) 2896 B
 1048.57  ss1 → data (cont.) 2896 B
 1048.70  ss1 → data (cont.) 2896 B
 1048.71  ss1 → data (cont.) 2896 B
 1048.71  ss1 → data (cont.) 2896 B
 1048.75  ss1 → data (cont.) 2896 B
 1048.75  ss1 → data (cont.) 2896 B
 1048.75  ss1 → data (cont.) 1448 B
 1071.20  ss1 → data (cont.) 2896 B
 1071.21  ss1 → data (cont.) 2896 B
 1071.21  ss1 → data (cont.) 2896 B
 1071.29  ss1 → data (cont.) 1448 B
 1071.29  ss1 → data (cont.) 2896 B
 1071.29  ss1 → data (cont.) 2896 B
 1071.29  ss1 → data (cont.) 1448 B
 1073.95  ← ss2 ACK
 1096.36  ← ss2 ACK
 1096.64  ← ss2 ACK
 1099.02  ss1 → data (cont.) 1373 B
 1147.39  ← ss2 data 236 B
 1147.43  ← ss2 data 69 B
 1147.43  ← ss2 data 36 B
 1147.43  ← ss2 data 81 B
 1147.43  ← ss2 data 36 B
 1147.44  ← ss2 data 36 B
 1147.44  ← ss2 data 426 B
 1147.86  ← ss2 data 36 B
 1147.87  ← ss2 data 36 B
 1147.87  ← ss2 data 69 B
 1147.87  ← ss2 data 36 B
 1147.88  ← ss2 data 77 B
 1147.88  ← ss2 data 36 B
 1147.88  ← ss2 data 36 B
 1148.03  ← ss2 data 7158 B
 1148.13  ← ss2 data (cont.) 7240 B
 1148.13  ← ss2 data (cont.) 989 B
 1148.19  ← ss2 data (cont.) 7240 B
 1148.19  ← ss2 data (cont.) 989 B
 1148.28  ← ss2 data (cont.) 7240 B
 1148.28  ← ss2 data (cont.) 989 B
 1148.38  ← ss2 data (cont.) 7240 B
 1148.39  ← ss2 data (cont.) 989 B
 1148.39  ← ss2 data 741 B
 1167.92  ← ss2 data 36 B
 1167.95  ← ss2 data 36 B
 1167.95  ← ss2 data 69 B
 1167.95  ← ss2 data 36 B
 1167.95  ← ss2 data 78 B
 1167.95  ← ss2 data 36 B
 1167.96  ← ss2 data 36 B
 1167.96  ← ss2 data 441 B
 1167.96  ← ss2 data 36 B
 1167.98  ← ss2 data 36 B
 1167.98  ← ss2 data 69 B
 1167.98  ← ss2 data 36 B
 1167.98  ← ss2 data 71 B
 1167.98  ← ss2 data 36 B
 1167.98  ← ss2 data 36 B
 1167.98  ← ss2 data 723 B
 1167.99  ← ss2 data 36 B
 1167.99  ← ss2 data 36 B
 1167.99  ← ss2 data 69 B
 1167.99  ← ss2 data 36 B
 1167.99  ← ss2 data 70 B
 1168.00  ← ss2 data 36 B
 1168.00  ← ss2 data 36 B
 1168.03  ← ss2 data (cont.) 7240 B
 1168.03  ← ss2 data (cont.) 799 B
 1168.03  ← ss2 data 36 B
 1168.04  ← ss2 data 36 B
 1168.04  ← ss2 data 69 B
 1168.04  ← ss2 data 36 B
 1168.04  ← ss2 data 36 B
 1168.08  ← ss2 data 36 B
 1173.06  ss1 → ACK
 1173.29  ss1 → ACK
 1173.29  ss1 → ACK
 1173.50  ss1 → ACK
 1173.65  ss1 → ACK
 1193.09  ss1 → ACK
 1193.17  ss1 → ACK
 1222.21  ss1 → data (cont.) 2896 B
 1222.21  ss1 → data (cont.) 2896 B
 1222.21  ss1 → data (cont.) 1374 B
 1222.33  ss1 → data (cont.) 2896 B
 1222.35  ss1 → data (cont.) 2896 B
 1222.35  ss1 → data (cont.) 2896 B
 1222.35  ss1 → data (cont.) 2896 B
 1222.41  ss1 → data (cont.) 2896 B
 1222.41  ss1 → data (cont.) 2896 B
 1222.41  ss1 → data (cont.) 2896 B
 1222.49  ss1 → data (cont.) 2896 B
 1222.49  ss1 → data (cont.) 2896 B
 1222.49  ss1 → data (cont.) 1448 B
 1242.61  ss1 → data (cont.) 2896 B
 1242.61  ss1 → data (cont.) 2896 B
 1242.61  ss1 → data (cont.) 2896 B
 1242.61  ss1 → data (cont.) 1448 B
 1242.69  ss1 → data (cont.) 2896 B
 1242.69  ss1 → data (cont.) 2896 B
 1242.69  ss1 → data (cont.) 1448 B
 1247.69  ← ss2 ACK
 1267.78  ← ss2 ACK
 1268.01  ← ss2 ACK
 1272.75  ss1 → data (cont.) 1373 B
 1316.50  ← ss2 data 236 B
 1316.59  ← ss2 data 69 B
 1316.59  ← ss2 data 36 B
 1316.75  ← ss2 data 81 B
 1316.77  ← ss2 data 36 B
 1316.77  ← ss2 data 36 B
 1316.77  ← ss2 data 426 B
 1317.28  ← ss2 data 36 B
 1317.29  ← ss2 data 36 B
 1317.39  ← ss2 data 69 B
 1317.39  ← ss2 data 36 B
 1317.39  ← ss2 data 77 B
 1317.40  ← ss2 data 36 B
 1317.41  ← ss2 data 36 B
 1317.57  ← ss2 data 8110 B
 1317.66  ← ss2 data 8229 B
 1317.75  ← ss2 data 8229 B
 1317.82  ← ss2 data 8229 B
 1317.88  ← ss2 data 7982 B
 1337.68  ← ss2 data 36 B
 1337.73  ← ss2 data 36 B
 1337.73  ← ss2 data 69 B
 1337.74  ← ss2 data 36 B
 1337.74  ← ss2 data 78 B
 1337.74  ← ss2 data 36 B
 1337.74  ← ss2 data 36 B
 1337.77  ← ss2 data 441 B
 1337.78  ← ss2 data 36 B
 1337.78  ← ss2 data 36 B
 1337.78  ← ss2 data 69 B
 1337.78  ← ss2 data 36 B
 1337.78  ← ss2 data 71 B
 1337.78  ← ss2 data 36 B
 1337.78  ← ss2 data 36 B
 1337.78  ← ss2 data 723 B
 1337.80  ← ss2 data 36 B
 1337.80  ← ss2 data 36 B
 1337.80  ← ss2 data 69 B
 1337.80  ← ss2 data 36 B
 1337.81  ← ss2 data 70 B
 1337.81  ← ss2 data 36 B
 1337.81  ← ss2 data 36 B
 1337.83  ← ss2 data 8039 B
 1337.83  ← ss2 data 36 B
 1337.84  ← ss2 data 36 B
 1337.84  ← ss2 data 69 B
 1337.86  ← ss2 data 36 B
 1337.86  ← ss2 data 36 B
 1337.88  ← ss2 data 36 B
 1342.69  ss1 → ACK
 1342.69  ss1 → ACK
 1342.76  ss1 → ACK
 1343.32  ss1 → ACK
 1362.83  ss1 → ACK
 1362.88  ss1 → ACK
 1371.33  ss1 → ACK
 1391.73  ss1 → data (cont.) 2896 B
 1391.73  ss1 → data (cont.) 2896 B
 1391.73  ss1 → data (cont.) 1374 B
 1391.87  ss1 → data (cont.) 2896 B
 1391.90  ss1 → data (cont.) 2896 B
 1391.90  ss1 → data (cont.) 2896 B
 1391.90  ss1 → data (cont.) 2896 B
 1391.95  ss1 → data (cont.) 2896 B
 1391.96  ss1 → data (cont.) 2896 B
 1391.96  ss1 → data (cont.) 2896 B
 1392.06  ss1 → data (cont.) 2896 B
 1392.07  ss1 → data (cont.) 2896 B
 1392.07  ss1 → data (cont.) 1448 B
 1413.86  ss1 → data (cont.) 2896 B
 1413.86  ss1 → data (cont.) 2896 B
 1413.86  ss1 → data (cont.) 2896 B
 1413.86  ss1 → data (cont.) 1448 B
 1413.86  ss1 → data (cont.) 2896 B
 1413.87  ss1 → data (cont.) 2896 B
 1413.87  ss1 → data (cont.) 1448 B
 1417.15  ← ss2 ACK
 1420.70  ← ss2 ACK
 1439.03  ← ss2 ACK
 1439.29  ← ss2 ACK
 1442.21  ss1 → data (cont.) 1373 B
 1486.34  ← ss2 data 236 B
 1486.38  ← ss2 data 69 B
 1486.38  ← ss2 data 36 B
 1486.38  ← ss2 data 81 B
 1486.39  ← ss2 data 36 B
 1486.39  ← ss2 data 36 B
 1486.39  ← ss2 data 426 B
 1486.78  ← ss2 data 36 B
 1486.80  ← ss2 data 36 B
 1486.83  ← ss2 data 69 B
 1486.84  ← ss2 data 36 B
 1486.85  ← ss2 data 77 B
 1486.86  ← ss2 data 36 B
 1486.87  ← ss2 data 36 B
 1487.15  ← ss2 data 7158 B
 1487.44  ← ss2 data 8229 B
 1487.55  ← ss2 data 8229 B
 1487.71  ← ss2 data 8229 B
 1487.79  ← ss2 data 8229 B
 1487.80  ← ss2 data 741 B
 1512.21  ← ss2 data 36 B
 1512.25  ← ss2 data 36 B
 1512.26  ← ss2 data 69 B
 1512.26  ← ss2 data 36 B
 1512.26  ← ss2 data 78 B
 1512.26  ← ss2 data 36 B
 1512.26  ← ss2 data 36 B
 1512.29  ss1 → ACK
 1512.29  ← ss2 data 441 B
 1512.29  ← ss2 data 36 B
 1512.29  ← ss2 data 36 B
 1512.29  ← ss2 data 69 B
 1512.29  ← ss2 data 36 B
 1512.30  ← ss2 data 71 B
 1512.30  ← ss2 data 36 B
 1512.30  ← ss2 data 36 B
 1512.30  ← ss2 data 723 B
 1512.32  ← ss2 data 36 B
 1512.34  ← ss2 data 36 B
 1512.34  ← ss2 data 69 B
 1512.34  ← ss2 data 36 B
 1512.35  ← ss2 data 70 B
 1512.35  ← ss2 data 36 B
 1512.35  ← ss2 data 36 B
 1512.42  ← ss2 data 8039 B
 1512.46  ss1 → ACK
 1512.49  ← ss2 data 36 B
 1512.49  ← ss2 data 36 B
 1512.52  ← ss2 data 69 B
 1512.52  ← ss2 data 36 B
 1512.53  ← ss2 data 36 B
 1512.63  ← ss2 data 36 B
 1512.85  ss1 → ACK
 1537.37  ss1 → ACK
 1537.48  ss1 → ACK
 1546.15  ss1 → ACK
 1571.47  ss1 → data (cont.) 2896 B
 1571.49  ss1 → data (cont.) 2896 B
 1571.49  ss1 → data (cont.) 1374 B
 1571.51  ss1 → data (cont.) 2896 B
 1571.52  ss1 → data (cont.) 2896 B
 1571.52  ss1 → data (cont.) 2896 B
 1571.52  ss1 → data (cont.) 2896 B
 1571.63  ss1 → data (cont.) 2896 B
 1571.63  ss1 → data (cont.) 2896 B
 1571.63  ss1 → data (cont.) 2896 B
 1571.69  ss1 → data (cont.) 2896 B
 1571.69  ss1 → data (cont.) 2896 B
 1571.69  ss1 → data (cont.) 1448 B
 1592.76  ss1 → data (cont.) 2896 B
 1592.77  ss1 → data (cont.) 2896 B
 1592.77  ss1 → data (cont.) 2896 B
 1592.77  ss1 → data (cont.) 1448 B
 1592.94  ss1 → data (cont.) 2896 B
 1592.94  ss1 → data (cont.) 2896 B
 1592.94  ss1 → data (cont.) 1448 B
 1597.04  ← ss2 ACK
 1618.02  ← ss2 ACK
 1618.37  ← ss2 ACK
 1622.11  ss1 → data (cont.) 1373 B
 1664.65  ← ss2 data 236 B
 1664.69  ← ss2 data 69 B
 1664.69  ← ss2 data 36 B
 1664.69  ← ss2 data 81 B
 1664.70  ← ss2 data 36 B
 1664.70  ← ss2 data 36 B
 1664.70  ← ss2 data 426 B
 1665.02  ← ss2 data 36 B
 1665.03  ← ss2 data 36 B
 1665.03  ← ss2 data 69 B
 1665.03  ← ss2 data 36 B
 1665.03  ← ss2 data 77 B
 1665.04  ← ss2 data 36 B
 1665.04  ← ss2 data 36 B
 1665.10  ← ss2 data 7158 B
 1665.15  ← ss2 data 8229 B
 1665.37  ← ss2 data 8229 B
 1665.44  ← ss2 data 8229 B
 1665.49  ← ss2 data 8229 B
 1665.50  ← ss2 data 741 B
 1686.87  ← ss2 data 36 B
 1686.91  ← ss2 data 36 B
 1686.95  ← ss2 data 69 B
 1686.95  ← ss2 data 36 B
 1686.95  ← ss2 data 78 B
 1686.95  ← ss2 data 36 B
 1686.95  ← ss2 data 36 B
 1686.95  ← ss2 data 441 B
 1686.97  ← ss2 data 36 B
 1686.97  ← ss2 data 36 B
 1686.97  ← ss2 data 69 B
 1686.97  ← ss2 data 36 B
 1686.98  ← ss2 data 71 B
 1686.98  ← ss2 data 36 B
 1686.99  ← ss2 data 36 B
 1686.99  ← ss2 data 723 B
 1686.99  ← ss2 data 36 B
 1686.99  ← ss2 data 36 B
 1687.05  ← ss2 data 69 B
 1687.06  ← ss2 data 36 B
 1687.06  ← ss2 data 70 B
 1687.06  ← ss2 data 36 B
 1687.06  ← ss2 data 36 B
 1687.10  ← ss2 data 8039 B
 1687.11  ← ss2 data 36 B
 1687.11  ← ss2 data 36 B
 1687.11  ← ss2 data 69 B
 1687.16  ← ss2 data 36 B
 1687.17  ← ss2 data 36 B
 1687.17  ← ss2 data 36 B
 1690.24  ss1 → ACK
 1690.46  ss1 → ACK
 1690.50  ss1 → ACK
 1712.02  ss1 → ACK
 1712.23  ss1 → ACK
 1745.81  ss1 → data (cont.) 2896 B
 1745.81  ss1 → data (cont.) 2896 B
 1745.82  ss1 → data (cont.) 1374 B
 1746.07  ss1 → data (cont.) 2896 B
 1746.14  ss1 → data (cont.) 2896 B
 1746.14  ss1 → data (cont.) 2896 B
 1746.14  ss1 → data (cont.) 2896 B
 1746.36  ss1 → data (cont.) 2896 B
 1746.36  ss1 → data (cont.) 2896 B
 1746.36  ss1 → data (cont.) 2896 B
 1746.52  ss1 → data (cont.) 2896 B
 1746.52  ss1 → data (cont.) 2896 B
 1746.52  ss1 → data (cont.) 1448 B
 1771.36  ← ss2 ACK
 1772.85  ss1 → data (cont.) 2896 B
 1772.87  ss1 → data (cont.) 2896 B
 1772.87  ss1 → data (cont.) 2896 B
 1772.88  ss1 → data (cont.) 1448 B
 1772.95  ss1 → data (cont.) 2896 B
 1772.95  ss1 → data (cont.) 2896 B
 1772.95  ss1 → data (cont.) 1448 B
 1776.40  ← ss2 ACK
 1796.47  ss1 → data (cont.) 1373 B
 1798.27  ← ss2 ACK
 1798.29  ← ss2 ACK
 1840.42  ← ss2 data 236 B
 1840.46  ← ss2 data 69 B
 1840.46  ← ss2 data 36 B
 1840.46  ← ss2 data 81 B
 1840.46  ← ss2 data 36 B
 1840.46  ← ss2 data 36 B
 1840.46  ← ss2 data 426 B
 1840.79  ← ss2 data 36 B
 1840.79  ← ss2 data 36 B
 1840.79  ← ss2 data 69 B
 1840.79  ← ss2 data 36 B
 1840.80  ← ss2 data 77 B
 1840.80  ← ss2 data 36 B
 1840.80  ← ss2 data 36 B
 1840.97  ← ss2 data 8110 B
 1841.06  ← ss2 data 8229 B
 1841.08  ← ss2 data 8229 B
 1841.16  ← ss2 data 8229 B
 1841.19  ← ss2 data 7982 B
 1859.73  ← ss2 data 36 B
 1859.77  ← ss2 data 36 B
 1859.77  ← ss2 data 69 B
 1859.77  ← ss2 data 36 B
 1859.79  ← ss2 data 78 B
 1859.79  ← ss2 data 36 B
 1859.79  ← ss2 data 36 B
 1859.79  ← ss2 data 441 B
 1859.80  ← ss2 data 36 B
 1859.80  ← ss2 data 36 B
 1859.80  ← ss2 data 69 B
 1859.80  ← ss2 data 36 B
 1859.80  ← ss2 data 71 B
 1859.80  ← ss2 data 36 B
 1859.80  ← ss2 data 36 B
 1859.80  ← ss2 data 723 B
 1859.81  ← ss2 data 36 B
 1859.81  ← ss2 data 36 B
 1859.81  ← ss2 data 69 B
 1859.82  ← ss2 data 36 B
 1859.82  ← ss2 data 70 B
 1859.85  ← ss2 data 36 B
 1859.85  ← ss2 data 36 B
 1859.93  ← ss2 data 8039 B
 1859.93  ← ss2 data 36 B
 1859.93  ← ss2 data 36 B
 1859.93  ← ss2 data 69 B
 1859.93  ← ss2 data 36 B
 1859.93  ← ss2 data 36 B
 1859.95  ← ss2 data 36 B
 1866.03  ss1 → ACK
 1866.12  ss1 → ACK
 1866.24  ss1 → ACK
 1884.86  ss1 → ACK
 1885.08  ss1 → ACK
 1914.42  ss1 → data (cont.) 2896 B
 1914.42  ss1 → data (cont.) 2896 B
 1914.42  ss1 → data (cont.) 1374 B
 1914.55  ss1 → data (cont.) 2896 B
 1914.55  ss1 → data (cont.) 2896 B
 1914.55  ss1 → data (cont.) 2896 B
 1914.55  ss1 → data (cont.) 2896 B
 1914.55  ss1 → data (cont.) 2896 B
 1914.55  ss1 → data (cont.) 2896 B
 1914.55  ss1 → data (cont.) 2896 B
 1914.62  ss1 → data (cont.) 2896 B
 1914.62  ss1 → data (cont.) 2896 B
 1914.62  ss1 → data (cont.) 1448 B
 1935.77  ss1 → data (cont.) 2896 B
 1935.78  ss1 → data (cont.) 2896 B
 1935.78  ss1 → data (cont.) 2896 B
 1935.78  ss1 → data (cont.) 1448 B
 1935.78  ss1 → data (cont.) 2896 B
 1935.78  ss1 → data (cont.) 2896 B
 1935.78  ss1 → data (cont.) 1448 B
 1939.92  ← ss2 ACK
 1960.93  ← ss2 ACK
 1961.49  ← ss2 ACK
 1965.01  ss1 → data (cont.) 1373 B
 2024.74  ← ss2 data 236 B
 2024.87  ← ss2 data 69 B
 2024.88  ← ss2 data 36 B
 2024.89  ← ss2 data 81 B
 2024.90  ← ss2 data 36 B
 2024.90  ← ss2 data 36 B
 2024.95  ← ss2 data 426 B
 2025.91  ← ss2 data 36 B
 2025.98  ← ss2 data 36 B
 2025.99  ← ss2 data 69 B
 2025.99  ← ss2 data 36 B
 2025.99  ← ss2 data 77 B
 2025.99  ← ss2 data 36 B
 2025.99  ← ss2 data 36 B
 2026.39  ← ss2 data 7158 B
 2026.81  ← ss2 data 8229 B
 2028.43  ← ss2 data 8229 B
 2028.69  ← ss2 data 8229 B
 2028.72  ← ss2 data 8229 B
 2028.74  ← ss2 data 741 B
 2050.76  ss1 → ACK
 2051.38  ss1 → ACK
 2051.51  ss1 → ACK
 2051.91  ss1 → ACK
 2053.53  ss1 → ACK
 2053.92  ss1 → ACK
 2053.92  ss1 → ACK
 2059.62  ← ss2 data 36 B
 2059.71  ← ss2 data 36 B
 2059.72  ← ss2 data 69 B
 2059.72  ← ss2 data 36 B
 2059.74  ← ss2 data 78 B
 2059.79  ← ss2 data 36 B
 2060.28  ← ss2 data 36 B
 2060.58  ← ss2 data 441 B
 2060.72  ← ss2 data 36 B
 2060.84  ← ss2 data 36 B
 2060.95  ← ss2 data 69 B
 2060.99  ← ss2 data 36 B
 2061.00  ← ss2 data 71 B
 2061.08  ← ss2 data 36 B
 2061.32  ← ss2 data 36 B
 2061.53  ← ss2 data 723 B
 2061.65  ← ss2 data 36 B
 2061.97  ← ss2 data 36 B
 2062.18  ← ss2 data 69 B
 2062.66  ← ss2 data 36 B
 2062.79  ← ss2 data 70 B
 2062.79  ← ss2 data 36 B
 2062.80  ← ss2 data 36 B
 2062.89  ← ss2 data 8039 B
 2063.31  ← ss2 data 36 B
 2063.36  ← ss2 data 36 B
 2063.36  ← ss2 data 69 B
 2063.37  ← ss2 data 36 B
 2063.37  ← ss2 data 36 B
 2063.44  ← ss2 data 36 B
 2085.14  ss1 → ACK
 2085.97  ss1 → ACK
 2085.98  ss1 → ACK
 2086.35  ss1 → ACK
 2086.62  ss1 → ACK
 2087.08  ss1 → ACK
 2087.80  ss1 → ACK
 2087.93  ss1 → ACK
 2102.25  ss1 → ACK
 2149.27  ss1 → data (cont.) 2896 B
 2149.28  ss1 → data (cont.) 2896 B
 2149.28  ss1 → data (cont.) 1374 B
 2149.51  ss1 → data (cont.) 2896 B
 2149.53  ss1 → data (cont.) 2896 B
 2149.53  ss1 → data (cont.) 2896 B
 2149.53  ss1 → data (cont.) 2896 B
 2149.73  ss1 → data (cont.) 2896 B
 2149.73  ss1 → data (cont.) 2896 B
 2149.73  ss1 → data (cont.) 2896 B
 2149.88  ss1 → data (cont.) 2896 B
 2149.88  ss1 → data (cont.) 2896 B
 2149.88  ss1 → data (cont.) 1448 B
 2174.89  ← ss2 ACK
 2186.24  ← ss2 ACK
 2191.26  ss1 → data (cont.) 2896 B
 2191.27  ss1 → data (cont.) 2896 B
 2191.27  ss1 → data (cont.) 2896 B
 2191.37  ss1 → data (cont.) 1448 B
 2191.41  ss1 → data (cont.) 2896 B
 2191.41  ss1 → data (cont.) 2896 B
 2191.41  ss1 → data (cont.) 1448 B
 2199.97  ss1 → data (cont.) 1373 B
 2216.44  ← ss2 ACK
 2216.87  ← ss2 ACK
 2257.31  ← ss2 data 236 B
 2257.37  ← ss2 data 69 B
 2257.42  ← ss2 data 36 B
 2257.47  ← ss2 data 81 B
 2257.50  ← ss2 data 36 B
 2257.52  ← ss2 data 36 B
 2257.53  ← ss2 data 426 B
 2258.24  ← ss2 data 36 B
 2258.30  ← ss2 data 36 B
 2258.35  ← ss2 data 69 B
 2258.42  ← ss2 data 36 B
 2258.43  ← ss2 data 77 B
 2258.44  ← ss2 data 36 B
 2258.45  ← ss2 data 36 B
 2258.66  ← ss2 data 7158 B
 2258.84  ← ss2 data 8229 B
 2258.99  ← ss2 data 8229 B
 2259.15  ← ss2 data 8229 B
 2259.24  ← ss2 data 8229 B
 2259.30  ← ss2 data 741 B
 2280.86  ← ss2 data 36 B
 2280.90  ← ss2 data 36 B
 2280.93  ← ss2 data 69 B
 2280.93  ← ss2 data 36 B
 2280.93  ← ss2 data 78 B
 2280.93  ← ss2 data 36 B
 2280.93  ← ss2 data 36 B
 2280.93  ← ss2 data 441 B
 2280.94  ← ss2 data 36 B
 2280.95  ← ss2 data 36 B
 2280.95  ← ss2 data 69 B
 2280.95  ← ss2 data 36 B
 2280.95  ← ss2 data 71 B
 2280.95  ← ss2 data 36 B
 2280.95  ← ss2 data 36 B
 2280.95  ← ss2 data 723 B
 2280.95  ← ss2 data 36 B
 2280.96  ← ss2 data 36 B
 2280.96  ← ss2 data 69 B
 2280.96  ← ss2 data 36 B
 2280.96  ← ss2 data 70 B
 2280.96  ← ss2 data 36 B
 2280.96  ← ss2 data 36 B
 2280.99  ← ss2 data 8039 B
 2281.00  ← ss2 data 36 B
 2281.01  ← ss2 data 36 B
 2281.01  ← ss2 data 69 B
 2281.01  ← ss2 data 36 B
 2281.01  ← ss2 data 36 B
 2281.11  ← ss2 data 36 B
 2283.75  ss1 → ACK
 2283.86  ss1 → ACK
 2284.28  ss1 → ACK
 2305.96  ss1 → ACK
 2306.05  ss1 → ACK
 2317.43  ss1 → ACK
 2344.91  ss1 → data (cont.) 2896 B
 2344.91  ss1 → data (cont.) 2896 B
 2344.91  ss1 → data (cont.) 1374 B
 2345.11  ss1 → data (cont.) 2896 B
 2345.19  ss1 → data (cont.) 2896 B
 2345.19  ss1 → data (cont.) 2896 B
 2345.19  ss1 → data (cont.) 2896 B
 2345.23  ss1 → data (cont.) 2896 B
 2345.23  ss1 → data (cont.) 2896 B
 2345.23  ss1 → data (cont.) 2896 B
 2345.38  ss1 → data (cont.) 2896 B
 2345.38  ss1 → data (cont.) 2896 B
 2345.38  ss1 → data (cont.) 1448 B
 2370.57  ← ss2 ACK
 2371.02  ss1 → data (cont.) 2896 B
 2371.03  ss1 → data (cont.) 2896 B
 2371.03  ss1 → data (cont.) 2896 B
 2371.11  ss1 → data (cont.) 1448 B
 2371.27  ss1 → data (cont.) 2896 B
 2371.27  ss1 → data (cont.) 2896 B
 2371.27  ss1 → data (cont.) 1448 B
 2375.56  ← ss2 ACK
 2395.73  ss1 → data (cont.) 1373 B
 2396.15  ← ss2 ACK
 2396.56  ← ss2 ACK
 2455.67  ← ss2 data 236 B
 2455.84  ← ss2 data 69 B
 2455.85  ← ss2 data 36 B
 2456.12  ← ss2 data 81 B
 2456.24  ← ss2 data 36 B
 2456.25  ← ss2 data 36 B
 2456.26  ← ss2 data 426 B
 2456.82  ← ss2 data 36 B
 2456.87  ← ss2 data 36 B
 2456.89  ← ss2 data 69 B
 2456.90  ← ss2 data 36 B
 2456.92  ← ss2 data 77 B
 2456.94  ← ss2 data 36 B
 2456.95  ← ss2 data 36 B
 2457.24  ← ss2 data 8110 B
 2457.66  ← ss2 data 8229 B
 2457.84  ← ss2 data 8229 B
 2457.96  ← ss2 data 8229 B
 2458.21  ← ss2 data 7982 B
 2481.70  ss1 → ACK
 2481.94  ss1 → ACK
 2481.95  ss1 → ACK
 2482.11  ss1 → ACK
 2482.34  ss1 → ACK
 2482.72  ss1 → ACK
 2483.03  ss1 → ACK
 2483.26  ss1 → ACK
 2486.23  ← ss2 data 36 B
 2486.32  ← ss2 data 36 B
 2486.37  ← ss2 data 69 B
 2486.38  ← ss2 data 36 B
 2486.49  ← ss2 data 78 B
 2486.50  ← ss2 data 36 B
 2486.50  ← ss2 data 36 B
 2486.50  ← ss2 data 441 B
 2486.50  ← ss2 data 36 B
 2486.52  ← ss2 data 36 B
 2486.52  ← ss2 data 69 B
 2486.52  ← ss2 data 36 B
 2486.79  ← ss2 data 71 B
 2486.80  ← ss2 data 36 B
 2486.80  ← ss2 data 36 B
 2486.82  ← ss2 data 723 B
 2486.82  ← ss2 data 36 B
 2486.83  ← ss2 data 36 B
 2486.83  ← ss2 data 69 B
 2486.83  ← ss2 data 36 B
 2486.83  ← ss2 data 70 B
 2486.83  ← ss2 data 36 B
 2486.83  ← ss2 data 36 B
 2486.91  ← ss2 data 8039 B
 2486.91  ← ss2 data 36 B
 2486.91  ← ss2 data 36 B
 2486.91  ← ss2 data 69 B
 2486.92  ← ss2 data 36 B
 2486.92  ← ss2 data 36 B
 2487.00  ← ss2 data 36 B
 2511.90  ss1 → ACK
 2512.11  ss1 → ACK
 2544.09  ss1 → data (cont.) 2896 B
 2544.10  ss1 → data (cont.) 2896 B
 2544.10  ss1 → data (cont.) 1374 B
 2544.17  ss1 → data (cont.) 2896 B
 2544.18  ss1 → data (cont.) 2896 B
 2544.18  ss1 → data (cont.) 2896 B
 2544.18  ss1 → data (cont.) 2896 B
 2544.27  ss1 → data (cont.) 2896 B
 2544.27  ss1 → data (cont.) 2896 B
 2544.27  ss1 → data (cont.) 2896 B
 2544.30  ss1 → data (cont.) 2896 B
 2544.30  ss1 → data (cont.) 2896 B
 2544.30  ss1 → data (cont.) 1448 B
 2563.97  ss1 → data (cont.) 2896 B
 2563.98  ss1 → data (cont.) 2896 B
 2563.98  ss1 → data (cont.) 2896 B
 2563.98  ss1 → data (cont.) 1448 B
 2563.98  ss1 → data (cont.) 2896 B
 2563.98  ss1 → data (cont.) 2896 B
 2563.98  ss1 → data (cont.) 1448 B
 2569.55  ← ss2 ACK
 2589.18  ← ss2 ACK
 2589.55  ← ss2 ACK
 2594.66  ss1 → data (cont.) 1373 B
 2639.16  ← ss2 data 236 B
 2639.36  ← ss2 data 69 B
 2639.38  ← ss2 data 36 B
 2639.42  ← ss2 data 81 B
 2639.42  ← ss2 data 36 B
 2639.42  ← ss2 data 36 B
 2639.49  ← ss2 data 426 B
 2639.94  ← ss2 data 36 B
 2639.96  ← ss2 data 36 B
 2639.96  ← ss2 data 69 B
 2639.96  ← ss2 data 36 B
 2639.97  ← ss2 data 77 B
 2639.97  ← ss2 data 36 B
 2639.97  ← ss2 data 36 B
 2640.07  ← ss2 data 8110 B
 2640.13  ← ss2 data 8229 B
 2640.21  ← ss2 data 8229 B
 2640.23  ← ss2 data 8229 B
 2640.28  ← ss2 data 7982 B
 2661.81  ← ss2 data 36 B
 2661.88  ← ss2 data 36 B
 2662.01  ← ss2 data 69 B
 2662.05  ← ss2 data 36 B
 2662.09  ← ss2 data 78 B
 2662.11  ← ss2 data 36 B
 2662.12  ← ss2 data 36 B
 2662.19  ← ss2 data 441 B
 2662.20  ← ss2 data 36 B
 2662.20  ← ss2 data 36 B
 2662.20  ← ss2 data 69 B
 2662.20  ← ss2 data 36 B
 2662.20  ← ss2 data 71 B
 2662.21  ← ss2 data 36 B
 2662.27  ← ss2 data 36 B
 2662.27  ← ss2 data 723 B
 2662.29  ← ss2 data 36 B
 2662.30  ← ss2 data 36 B
 2662.30  ← ss2 data 69 B
 2662.30  ← ss2 data 36 B
 2662.31  ← ss2 data 70 B
 2662.32  ← ss2 data 36 B
 2662.33  ← ss2 data 36 B
 2662.41  ← ss2 data 8039 B
 2662.43  ← ss2 data 36 B
 2662.43  ← ss2 data 36 B
 2662.46  ← ss2 data 69 B
 2662.46  ← ss2 data 36 B
 2662.47  ← ss2 data 36 B
 2662.61  ← ss2 data 36 B
 2664.78  ss1 → ACK
 2665.19  ss1 → ACK
 2665.23  ss1 → ACK
 2665.66  ss1 → ACK
 2687.32  ss1 → ACK
 2687.50  ss1 → ACK
 2695.57  ss1 → ACK
 2723.19  ss1 → data (cont.) 2896 B
 2723.19  ss1 → data (cont.) 2896 B
 2723.19  ss1 → data (cont.) 1374 B
 2723.31  ss1 → data (cont.) 2896 B
 2723.35  ss1 → data (cont.) 2896 B
 2723.36  ss1 → data (cont.) 2896 B
 2723.36  ss1 → data (cont.) 2896 B
 2723.48  ss1 → data (cont.) 2896 B
 2723.48  ss1 → data (cont.) 2896 B
 2723.48  ss1 → data (cont.) 2896 B
 2723.57  ss1 → data (cont.) 2896 B
 2723.57  ss1 → data (cont.) 2896 B
 2723.57  ss1 → data (cont.) 1448 B
 2745.35  ss1 → data (cont.) 2896 B
 2745.36  ss1 → data (cont.) 2896 B
 2745.36  ss1 → data (cont.) 2896 B
 2745.36  ss1 → data (cont.) 1448 B
 2745.36  ss1 → data (cont.) 2896 B
 2745.36  ss1 → data (cont.) 2896 B
 2745.36  ss1 → data (cont.) 1448 B
 2748.68  ← ss2 ACK
 2752.76  ← ss2 ACK
 2770.53  ← ss2 ACK
 2770.80  ← ss2 ACK
 2773.75  ss1 → data (cont.) 1373 B
 2820.68  ← ss2 data 236 B
 2820.77  ← ss2 data 69 B
 2820.77  ← ss2 data 36 B
 2820.77  ← ss2 data 81 B
 2820.77  ← ss2 data 36 B
 2820.77  ← ss2 data 36 B
 2820.78  ← ss2 data 426 B
 2821.08  ← ss2 data 36 B
 2821.09  ← ss2 data 36 B
 2821.14  ← ss2 data 69 B
 2821.14  ← ss2 data 36 B
 2821.15  ← ss2 data 77 B
 2821.18  ← ss2 data 36 B
 2821.19  ← ss2 data 36 B
 2821.30  ← ss2 data 7158 B
 2821.40  ← ss2 data 8229 B
 2821.49  ← ss2 data 8229 B
 2821.58  ← ss2 data 8229 B
 2821.65  ← ss2 data 8229 B
 2821.67  ← ss2 data 741 B
 2844.69  ← ss2 data 36 B
 2844.75  ← ss2 data 36 B
 2844.75  ← ss2 data 69 B
 2844.76  ← ss2 data 36 B
 2844.80  ← ss2 data 78 B
 2844.81  ← ss2 data 36 B
 2844.81  ← ss2 data 36 B
 2844.81  ← ss2 data 441 B
 2844.82  ← ss2 data 36 B
 2844.83  ← ss2 data 36 B
 2844.83  ← ss2 data 69 B
 2844.83  ← ss2 data 36 B
 2844.83  ← ss2 data 71 B
 2844.83  ← ss2 data 36 B
 2844.83  ← ss2 data 36 B
 2844.83  ← ss2 data 723 B
 2844.83  ← ss2 data 36 B
 2844.85  ← ss2 data 36 B
 2844.85  ← ss2 data 69 B
 2844.85  ← ss2 data 36 B
 2844.85  ← ss2 data 70 B
 2844.85  ← ss2 data 36 B
 2844.85  ← ss2 data 36 B
 2844.87  ← ss2 data 8039 B
 2844.88  ← ss2 data 36 B
 2844.88  ← ss2 data 36 B
 2844.88  ← ss2 data 69 B
 2844.88  ← ss2 data 36 B
 2844.90  ← ss2 data 36 B
 2845.12  ← ss2 data 36 B
 2846.40  ss1 → ACK
 2846.46  ss1 → ACK
 2846.50  ss1 → ACK
 2846.63  ss1 → ACK
 2846.67  ss1 → ACK
 2869.84  ss1 → ACK
 2870.01  ss1 → ACK
 2905.71  ss1 → data (cont.) 2896 B
 2905.71  ss1 → data (cont.) 2896 B
 2905.71  ss1 → data (cont.) 1374 B
 2905.77  ss1 → data (cont.) 2896 B
 2905.79  ss1 → data (cont.) 2896 B
 2905.79  ss1 → data (cont.) 2896 B
 2905.79  ss1 → data (cont.) 2896 B
 2905.85  ss1 → data (cont.) 2896 B
 2905.85  ss1 → data (cont.) 2896 B
 2905.85  ss1 → data (cont.) 2896 B
 2905.92  ss1 → data (cont.) 2896 B
 2905.92  ss1 → data (cont.) 2896 B
 2905.93  ss1 → data (cont.) 1448 B
 2928.32  ss1 → data (cont.) 2896 B
 2928.32  ss1 → data (cont.) 2896 B
 2928.32  ss1 → data (cont.) 2896 B
 2928.32  ss1 → data (cont.) 1448 B
 2928.32  ss1 → data (cont.) 2896 B
 2928.32  ss1 → data (cont.) 2896 B
 2928.32  ss1 → data (cont.) 1448 B
 2931.21  ← ss2 ACK
 2953.45  ← ss2 ACK
 2953.77  ← ss2 ACK
 2956.31  ss1 → data (cont.) 1373 B
 3007.53  ← ss2 data 236 B
 3007.62  ← ss2 data 69 B
 3007.63  ← ss2 data 36 B
 3007.63  ← ss2 data 81 B
 3007.63  ← ss2 data 36 B
 3007.63  ← ss2 data 36 B
 3007.63  ← ss2 data 426 B
 3007.91  ← ss2 data 36 B
 3007.93  ← ss2 data 36 B
 3007.93  ← ss2 data 69 B
 3007.93  ← ss2 data 36 B
 3007.93  ← ss2 data 77 B
 3007.94  ← ss2 data 36 B
 3007.94  ← ss2 data 36 B
 3008.02  ← ss2 data 7158 B
 3008.12  ← ss2 data (cont.) 7240 B
 3008.13  ← ss2 data (cont.) 989 B
 3008.25  ← ss2 data (cont.) 7240 B
 3008.25  ← ss2 data (cont.) 989 B
 3008.31  ← ss2 data (cont.) 7240 B
 3008.31  ← ss2 data (cont.) 989 B
 3008.43  ← ss2 data (cont.) 7240 B
 3008.43  ← ss2 data (cont.) 989 B
 3008.54  ← ss2 data 741 B
 3032.92  ← ss2 data 36 B
 3033.04  ← ss2 data 36 B
 3033.14  ← ss2 data 69 B
 3033.15  ← ss2 data 36 B
 3033.22  ← ss2 data 78 B
 3033.26  ← ss2 data 36 B
 3033.28  ← ss2 data 36 B
 3033.28  ← ss2 data 441 B
 3033.29  ← ss2 data 36 B
 3033.29  ← ss2 data 36 B
 3033.36  ← ss2 data 69 B
 3033.37  ← ss2 data 36 B
 3033.39  ← ss2 data 71 B
 3033.39  ← ss2 data 36 B
 3033.40  ← ss2 data 36 B
 3033.40  ← ss2 data 723 B
 3033.40  ss1 → ACK
 3033.42  ← ss2 data 36 B
 3033.44  ss1 → ACK
 3033.49  ← ss2 data 36 B
 3033.56  ss1 → ACK
 3033.65  ← ss2 data 69 B
 3033.74  ← ss2 data 36 B
 3033.74  ← ss2 data 70 B
 3033.75  ← ss2 data 36 B
 3033.81  ← ss2 data 36 B
 3033.94  ← ss2 data (cont.) 7240 B
 3033.94  ← ss2 data (cont.) 799 B
 3033.94  ← ss2 data 36 B
 3033.96  ← ss2 data 36 B
 3033.96  ← ss2 data 69 B
 3033.97  ← ss2 data 36 B
 3033.97  ← ss2 data 36 B
 3034.04  ← ss2 data 36 B
 3058.43  ss1 → ACK
 3058.99  ss1 → ACK
 3069.27  ss1 → ACK
 3095.05  ss1 → data (cont.) 2896 B
 3095.05  ss1 → data (cont.) 2896 B
 3095.05  ss1 → data (cont.) 1374 B
 3095.38  ss1 → data (cont.) 2896 B
 3095.55  ss1 → data (cont.) 2896 B
 3095.55  ss1 → data (cont.) 2896 B
 3095.55  ss1 → data (cont.) 2896 B
 3095.90  ss1 → data (cont.) 2896 B
 3095.90  ss1 → data (cont.) 2896 B
 3095.90  ss1 → data (cont.) 2896 B
 3095.99  ss1 → data (cont.) 2896 B
 3095.99  ss1 → data (cont.) 2896 B
 3095.99  ss1 → data (cont.) 1448 B
 3117.62  ss1 → data (cont.) 2896 B
 3117.63  ss1 → data (cont.) 2896 B
 3117.63  ss1 → data (cont.) 2896 B
 3117.64  ss1 → data (cont.) 1448 B
 3117.94  ss1 → data (cont.) 2896 B
 3117.94  ss1 → data (cont.) 2896 B
 3117.94  ss1 → data (cont.) 1448 B
 3120.54  ← ss2 ACK
 3126.34  ← ss2 ACK
 3142.84  ← ss2 ACK
 3143.13  ← ss2 ACK
 3145.61  ss1 → data (cont.) 1373 B
 3193.01  ← ss2 data 236 B
 3193.05  ← ss2 data 69 B
 3193.05  ← ss2 data 36 B
 3193.05  ← ss2 data 81 B
 3193.06  ← ss2 data 36 B
 3193.06  ← ss2 data 36 B
 3193.06  ← ss2 data 426 B
 3193.36  ← ss2 data 36 B
 3193.36  ← ss2 data 36 B
 3193.36  ← ss2 data 69 B
 3193.36  ← ss2 data 36 B
 3193.37  ← ss2 data 77 B
 3193.37  ← ss2 data 36 B
 3193.37  ← ss2 data 36 B
 3193.47  ← ss2 data 7158 B
 3193.52  ← ss2 data 8229 B
 3193.71  ← ss2 data 8229 B
 3193.77  ← ss2 data 8229 B
 3193.81  ← ss2 data 8229 B
 3193.83  ← ss2 data 741 B
 3215.09  ← ss2 data 36 B
 3215.15  ← ss2 data 36 B
 3215.16  ← ss2 data 69 B
 3215.16  ← ss2 data 36 B
 3215.16  ← ss2 data 78 B
 3215.17  ← ss2 data 36 B
 3215.17  ← ss2 data 36 B
 3215.22  ← ss2 data 441 B
 3215.23  ← ss2 data 36 B
 3215.23  ← ss2 data 36 B
 3215.23  ← ss2 data 69 B
 3215.23  ← ss2 data 36 B
 3215.23  ← ss2 data 71 B
 3215.23  ← ss2 data 36 B
 3215.23  ← ss2 data 36 B
 3215.23  ← ss2 data 723 B
 3215.25  ← ss2 data 36 B
 3215.25  ← ss2 data 36 B
 3215.25  ← ss2 data 69 B
 3215.26  ← ss2 data 36 B
 3215.26  ← ss2 data 70 B
 3215.26  ← ss2 data 36 B
 3215.26  ← ss2 data 36 B
 3215.28  ← ss2 data 8039 B
 3215.28  ← ss2 data 36 B
 3215.28  ← ss2 data 36 B
 3215.29  ← ss2 data 69 B
 3215.29  ← ss2 data 36 B
 3215.29  ← ss2 data 36 B
 3215.29  ← ss2 data 36 B
 3218.78  ss1 → ACK
 3218.92  ss1 → ACK
 3218.92  ss1 → ACK
 3240.30  ss1 → ACK
 3240.46  ss1 → ACK
 3273.11  ss1 → data (cont.) 2896 B
 3273.11  ss1 → data (cont.) 2896 B
 3273.11  ss1 → data (cont.) 1374 B
 3273.18  ss1 → data (cont.) 2896 B
 3273.19  ss1 → data (cont.) 2896 B
 3273.19  ss1 → data (cont.) 2896 B
 3273.19  ss1 → data (cont.) 2896 B
 3273.25  ss1 → data (cont.) 2896 B
 3273.25  ss1 → data (cont.) 2896 B
 3273.25  ss1 → data (cont.) 2896 B
 3273.30  ss1 → data (cont.) 2896 B
 3273.30  ss1 → data (cont.) 2896 B
 3273.31  ss1 → data (cont.) 1448 B
 3295.62  ss1 → data (cont.) 2896 B
 3295.63  ss1 → data (cont.) 2896 B
 3295.63  ss1 → data (cont.) 2896 B
 3295.63  ss1 → data (cont.) 1448 B
 3295.63  ss1 → data (cont.) 2896 B
 3295.63  ss1 → data (cont.) 2896 B
 3295.63  ss1 → data (cont.) 1448 B
 3298.59  ← ss2 ACK
 3320.84  ← ss2 ACK
 3321.15  ← ss2 ACK
 3323.68  ss1 → data (cont.) 1373 B
 3369.93  ← ss2 data 236 B
 3370.07  ← ss2 data 69 B
 3370.09  ← ss2 data 36 B
 3370.09  ← ss2 data 81 B
 3370.09  ← ss2 data 36 B
 3370.09  ← ss2 data 36 B
 3370.09  ← ss2 data 426 B
 3370.36  ← ss2 data 36 B
 3370.38  ← ss2 data 36 B
 3370.38  ← ss2 data 69 B
 3370.38  ← ss2 data 36 B
 3370.38  ← ss2 data 77 B
 3370.38  ← ss2 data 36 B
 3370.38  ← ss2 data 36 B
 3370.46  ← ss2 data 7158 B
 3370.55  ← ss2 data 8229 B
 3370.59  ← ss2 data 8229 B
 3370.85  ← ss2 data 8229 B
 3370.95  ← ss2 data 8229 B
 3370.96  ← ss2 data 741 B
 3392.41  ← ss2 data 36 B
 3392.47  ← ss2 data 36 B
 3392.48  ← ss2 data 69 B
 3392.48  ← ss2 data 36 B
 3392.48  ← ss2 data 78 B
 3392.55  ← ss2 data 36 B
 3392.55  ← ss2 data 36 B
 3392.55  ← ss2 data 441 B
 3392.55  ← ss2 data 36 B
 3392.55  ← ss2 data 36 B
 3392.55  ← ss2 data 69 B
 3392.56  ← ss2 data 36 B
 3392.56  ← ss2 data 71 B
 3392.56  ← ss2 data 36 B
 3392.56  ← ss2 data 36 B
 3392.56  ← ss2 data 723 B
 3392.58  ← ss2 data 36 B
 3392.58  ← ss2 data 36 B
 3392.58  ← ss2 data 69 B
 3392.58  ← ss2 data 36 B
 3392.58  ← ss2 data 70 B
 3392.58  ← ss2 data 36 B
 3392.58  ← ss2 data 36 B
 3392.58  ← ss2 data 8039 B
 3392.58  ← ss2 data 36 B
 3392.59  ← ss2 data 36 B
 3392.59  ← ss2 data 69 B
 3392.60  ← ss2 data 36 B
 3392.60  ← ss2 data 36 B
 3392.60  ← ss2 data 36 B
 3395.72  ss1 → ACK
 3395.96  ss1 → ACK
 3396.09  ss1 → ACK
 3417.61  ss1 → ACK
 3417.73  ss1 → ACK
 3450.45  ss1 → data (cont.) 2896 B
 3450.46  ss1 → data (cont.) 2896 B
 3450.46  ss1 → data (cont.) 1374 B
 3450.54  ss1 → data (cont.) 2896 B
 3450.54  ss1 → data (cont.) 2896 B
 3450.54  ss1 → data (cont.) 2896 B
 3450.54  ss1 → data (cont.) 2896 B
 3450.61  ss1 → data (cont.) 2896 B
 3450.61  ss1 → data (cont.) 2896 B
 3450.61  ss1 → data (cont.) 2896 B
 3450.65  ss1 → data (cont.) 2896 B
 3450.65  ss1 → data (cont.) 2896 B
 3450.65  ss1 → data (cont.) 1448 B
 3471.13  ss1 → data (cont.) 2896 B
 3471.13  ss1 → data (cont.) 2896 B
 3471.13  ss1 → data (cont.) 2896 B
 3471.13  ss1 → data (cont.) 1448 B
 3471.13  ss1 → data (cont.) 2896 B
 3471.13  ss1 → data (cont.) 2896 B
 3471.13  ss1 → data (cont.) 1448 B
 3476.03  ← ss2 ACK
 3496.33  ← ss2 ACK
 3496.62  ← ss2 ACK
 3501.17  ss1 → data (cont.) 1373 B
 3546.50  ← ss2 data 236 B
 3546.55  ← ss2 data 69 B
 3546.55  ← ss2 data 36 B
 3546.55  ← ss2 data 81 B
 3546.55  ← ss2 data 36 B
 3546.55  ← ss2 data 36 B
 3546.55  ← ss2 data 426 B
 3546.80  ← ss2 data 36 B
 3546.81  ← ss2 data 36 B
 3546.81  ← ss2 data 69 B
 3546.81  ← ss2 data 36 B
 3546.82  ← ss2 data 77 B
 3546.83  ← ss2 data 36 B
 3546.84  ← ss2 data 36 B
 3547.06  ← ss2 data 7158 B
 3547.17  ← ss2 data 8229 B
 3547.29  ← ss2 data 8229 B
 3547.39  ← ss2 data 8229 B
 3547.42  ← ss2 data 8229 B
 3547.42  ← ss2 data 741 B
 3569.94  ← ss2 data 36 B
 3570.00  ← ss2 data 36 B
 3570.00  ← ss2 data 69 B
 3570.00  ← ss2 data 36 B
 3570.00  ← ss2 data 78 B
 3570.01  ← ss2 data 36 B
 3570.01  ← ss2 data 36 B
 3570.07  ← ss2 data 441 B
 3570.07  ← ss2 data 36 B
 3570.07  ← ss2 data 36 B
 3570.07  ← ss2 data 69 B
 3570.07  ← ss2 data 36 B
 3570.07  ← ss2 data 71 B
 3570.07  ← ss2 data 36 B
 3570.08  ← ss2 data 36 B
 3570.08  ← ss2 data 723 B
 3570.09  ← ss2 data 36 B
 3570.09  ← ss2 data 36 B
 3570.09  ← ss2 data 69 B
 3570.09  ← ss2 data 36 B
 3570.09  ← ss2 data 70 B
 3570.10  ← ss2 data 36 B
 3570.10  ← ss2 data 36 B
 3570.10  ← ss2 data 8039 B
 3570.10  ← ss2 data 36 B
 3570.10  ← ss2 data 36 B
 3570.10  ← ss2 data 69 B
 3570.10  ← ss2 data 36 B
 3570.10  ← ss2 data 36 B
 3570.10  ← ss2 data 36 B
 3572.26  ss1 → ACK
 3572.37  ss1 → ACK
 3572.49  ss1 → ACK
 3595.14  ss1 → ACK
 3595.34  ss1 → ACK
 3627.46  ss1 → data (cont.) 2896 B
 3627.46  ss1 → data (cont.) 2896 B
 3627.46  ss1 → data (cont.) 1374 B
 3627.57  ss1 → data (cont.) 2896 B
 3627.62  ss1 → data (cont.) 2896 B
 3627.62  ss1 → data (cont.) 2896 B
 3627.63  ss1 → data (cont.) 2896 B
 3627.66  ss1 → data (cont.) 2896 B
 3627.66  ss1 → data (cont.) 2896 B
 3627.66  ss1 → data (cont.) 2896 B
 3627.79  ss1 → data (cont.) 2896 B
 3627.79  ss1 → data (cont.) 2896 B
 3627.79  ss1 → data (cont.) 1448 B
 3649.96  ss1 → data (cont.) 2896 B
 3649.96  ss1 → data (cont.) 2896 B
 3649.96  ss1 → data (cont.) 2896 B
 3649.96  ss1 → data (cont.) 1448 B
 3649.96  ss1 → data (cont.) 2896 B
 3649.97  ss1 → data (cont.) 2896 B
 3649.97  ss1 → data (cont.) 1448 B
 3652.97  ← ss2 ACK
 3675.14  ← ss2 ACK
 3675.47  ← ss2 ACK
 3678.04  ss1 → data (cont.) 1373 B
 3722.15  ← ss2 data 236 B
 3722.19  ← ss2 data 69 B
 3722.19  ← ss2 data 36 B
 3722.19  ← ss2 data 81 B
 3722.20  ← ss2 data 36 B
 3722.20  ← ss2 data 36 B
 3722.20  ← ss2 data 426 B
 3722.48  ← ss2 data 36 B
 3722.49  ← ss2 data 36 B
 3722.49  ← ss2 data 69 B
 3722.56  ← ss2 data 36 B
 3722.56  ← ss2 data 77 B
 3722.56  ← ss2 data 36 B
 3722.56  ← ss2 data 36 B
 3722.63  ← ss2 data 7158 B
 3722.69  ← ss2 data 8229 B
 3722.85  ← ss2 data 8229 B
 3723.06  ← ss2 data 8229 B
 3723.13  ← ss2 data 8229 B
 3723.13  ← ss2 data 741 B
 3741.78  ← ss2 data 36 B
 3741.84  ← ss2 data 36 B
 3741.85  ← ss2 data 69 B
 3741.85  ← ss2 data 36 B
 3741.93  ← ss2 data 78 B
 3741.93  ← ss2 data 36 B
 3741.93  ← ss2 data 36 B
 3741.94  ← ss2 data 441 B
 3741.94  ← ss2 data 36 B
 3741.94  ← ss2 data 36 B
 3741.94  ← ss2 data 69 B
 3741.94  ← ss2 data 36 B
 3741.94  ← ss2 data 71 B
 3741.94  ← ss2 data 36 B
 3741.94  ← ss2 data 36 B
 3741.94  ← ss2 data 723 B
 3741.94  ← ss2 data 36 B
 3741.94  ← ss2 data 36 B
 3741.95  ← ss2 data 69 B
 3741.95  ← ss2 data 36 B
 3741.95  ← ss2 data 70 B
 3741.98  ← ss2 data 36 B
 3741.98  ← ss2 data 36 B
 3742.02  ← ss2 data 8039 B
 3742.02  ← ss2 data 36 B
 3742.02  ← ss2 data 36 B
 3742.02  ← ss2 data 69 B
 3742.02  ← ss2 data 36 B
 3742.02  ← ss2 data 36 B
 3742.02  ← ss2 data 36 B
```
