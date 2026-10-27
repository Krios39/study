# Обмены ss1 ↔ ss2: full, reuse × RTT 0 / 50 мс, 10 запросов по 1048576 Б

| config | RTT задан | RTT потока (ядро) | соединения | запрос по записи, мс | curl, мс | паузы ≥0.4·RTT | сумма пауз, мс | др. порты |
|---|---|---|---|---|---|---|---|---|
| full | 0 | 3.91 (min 0.16) | new TCP + resumed TLS: 10 | 79.7 | 122.9 | 4 | 60.1 | — |
| full | 50 | 56.91 (min 50.70) | new TCP + resumed TLS: 10 | 546.5 | 585.0 | 14.5 | 364.7 | — |
| reuse | 0 | 7.90 (min 0.09) | reused connection: 10 | 51.4 | 121.9 | 2 | 40.0 | — |
| reuse | 50 | 56.87 (min 0.09) | reused connection: 10 | 155.1 | 216.8 | 4 | 110.6 | — |

RTT потока — сглаженный rtt сокетов ss1 → ss2:5500 по ядру (ss -tin) во время запросов, в скобках minrtt (у соединений пула — минимум с момента открытия, в т. ч. до смены задержки). В хронологии исходящие пакеты ss1 видны уже после очереди netem (сдвиг на RTT/2), входящие — по приходу. Запрос по записи — от первого пакета запроса до последних данных ответа на канале ss1 ↔ ss2. Пауза — промежуток между соседними пакетами запроса не меньше max(0.4·RTT, 1 мс).

## full, RTT 0 мс — медианный запрос (new TCP + resumed TLS, 80.5 мс)

Паузы:
- 1.5 мс: после «← ss2 ACK» до «← ss2 data (cont.) 1448 B»
- 24.5 мс: после «ss1 → ChangeCipherSpec 6 B» до «ss1 → Finished (enc.) 2896 B»
- 12.2 мс: после «ss1 → data (cont.) 987 B» до «← ss2 data 224 B»
- 22.3 мс: после «ss1 → ACK» до «← ss2 data 31 B»

```
    0.00  ss1 → SYN
    0.59  ← ss2 SYN-ACK
    0.61  ss1 → ACK
    1.38  ss1 → ClientHello 2800 B
    1.55  ← ss2 ACK
    3.02  ← ss2 data (cont.) 1448 B
    3.02  ss1 → ACK
    3.07  ← ss2 data (cont.) 1212 B
    3.07  ss1 → ACK
    3.12  ← ss2 ChangeCipherSpec 51 B
    3.13  ss1 → ACK
    3.82  ss1 → ChangeCipherSpec 6 B
   28.36  ss1 → Finished (enc.) 2896 B
   28.43  ss1 → data (cont.) 7240 B
   29.04  ← ss2 ACK
   29.04  ← ss2 ACK
   29.06  ss1 → data (cont.) 987 B
   41.30  ← ss2 data 224 B
   41.36  ← ss2 data 63 B
   41.41  ← ss2 data 106 B
   41.48  ← ss2 data 481 B
   41.59  ← ss2 data 31 B
   41.65  ← ss2 data 94 B
   41.65  ← ss2 data 31 B
   41.65  ← ss2 data 71 B
   41.70  ← ss2 data 62 B
   41.98  ss1 → ACK
   42.05  ← ss2 data (cont.) 1448 B
   42.14  ← ss2 data (cont.) 1448 B
   42.15  ss1 → ACK
   42.20  ← ss2 data (cont.) 5792 B
   42.21  ss1 → ACK
   42.25  ← ss2 data (cont.) 5792 B
   42.25  ← ss2 data (cont.) 1448 B
   42.30  ← ss2 data (cont.) 5792 B
   42.35  ← ss2 data (cont.) 5792 B
   42.41  ← ss2 data (cont.) 5792 B
   42.46  ← ss2 data (cont.) 5792 B
   42.51  ← ss2 data (cont.) 5792 B
   42.65  ss1 → ACK
   42.78  ← ss2 data (cont.) 1448 B
   42.84  ← ss2 data (cont.) 5792 B
   42.85  ss1 → ACK
   42.90  ← ss2 data (cont.) 7240 B
   42.92  ss1 → ACK
   42.94  ← ss2 data (cont.) 5792 B
   43.00  ← ss2 data (cont.) 5792 B
   43.01  ss1 → ACK
   43.05  ← ss2 data (cont.) 5792 B
   43.10  ss1 → ACK
   43.10  ← ss2 data (cont.) 4344 B
   43.10  ← ss2 data (cont.) 1448 B
   43.11  ss1 → ACK
   43.16  ← ss2 data (cont.) 7240 B
   43.18  ss1 → ACK
   43.21  ← ss2 data (cont.) 5288 B
   43.21  ← ss2 data (cont.) 1448 B
   43.26  ← ss2 data (cont.) 5792 B
   43.27  ss1 → ACK
   43.31  ← ss2 data (cont.) 5792 B
   43.36  ← ss2 data (cont.) 5792 B
   43.39  ss1 → ACK
   43.42  ← ss2 data (cont.) 3776 B
   43.42  ← ss2 data (cont.) 2896 B
   43.43  ss1 → ACK
   43.47  ← ss2 data (cont.) 5792 B
   43.52  ← ss2 data (cont.) 5792 B
   43.53  ss1 → ACK
   43.54  ss1 → ACK
   43.57  ← ss2 data (cont.) 7240 B
   43.63  ← ss2 data (cont.) 3144 B
   43.63  ← ss2 data (cont.) 1760 B
   43.63  ← ss2 data (cont.) 1448 B
   43.67  ss1 → ACK
   43.68  ← ss2 data (cont.) 5792 B
   43.73  ← ss2 data (cont.) 5792 B
   43.78  ← ss2 data (cont.) 5792 B
   43.80  ss1 → ACK
   43.81  ss1 → ACK
   43.84  ← ss2 data (cont.) 4728 B
   43.84  ← ss2 data (cont.) 1448 B
   43.91  ss1 → ACK
   43.92  ← ss2 data (cont.) 1448 B
   43.98  ← ss2 data (cont.) 5792 B
   44.03  ← ss2 data (cont.) 5792 B
   44.03  ss1 → ACK
   44.04  ss1 → ACK
   44.08  ← ss2 data (cont.) 7240 B
   44.13  ← ss2 data (cont.) 3248 B
   44.15  ss1 → ACK
   44.16  ss1 → ACK
   44.26  ← ss2 data (cont.) 1448 B
   44.32  ← ss2 data (cont.) 600 B
   44.32  ← ss2 data (cont.) 5792 B
   44.37  ← ss2 data (cont.) 5792 B
   44.38  ss1 → ACK
   44.42  ← ss2 data (cont.) 5792 B
   44.47  ← ss2 data (cont.) 4128 B
   44.50  ss1 → ACK
   44.52  ss1 → ACK
   44.63  ← ss2 data (cont.) 1448 B
   44.68  ← ss2 data (cont.) 7240 B
   44.73  ← ss2 data (cont.) 5792 B
   44.76  ss1 → ACK
   44.79  ← ss2 data (cont.) 5792 B
   44.84  ← ss2 data (cont.) 1232 B
   44.88  ss1 → ACK
   44.89  ss1 → ACK
   45.00  ← ss2 data (cont.) 2048 B
   45.00  ← ss2 data (cont.) 1448 B
   45.06  ← ss2 data (cont.) 5792 B
   45.11  ← ss2 data (cont.) 5792 B
   45.13  ss1 → ACK
   45.16  ← ss2 data (cont.) 5792 B
   45.21  ← ss2 data (cont.) 3704 B
   45.25  ss1 → ACK
   45.26  ss1 → ACK
   45.37  ← ss2 data (cont.) 1448 B
   45.43  ← ss2 data (cont.) 5792 B
   45.48  ← ss2 data (cont.) 5792 B
   45.50  ss1 → ACK
   45.53  ← ss2 data (cont.) 7240 B
   45.58  ← ss2 data (cont.) 4304 B
   45.63  ss1 → ACK
   45.64  ss1 → ACK
   45.75  ← ss2 data (cont.) 1448 B
   45.81  ← ss2 data (cont.) 5792 B
   45.86  ← ss2 data (cont.) 5792 B
   45.87  ss1 → ACK
   45.91  ← ss2 data (cont.) 7240 B
   45.96  ← ss2 data (cont.) 3280 B
   46.00  ss1 → ACK
   46.01  ss1 → ACK
   46.10  ← ss2 data (cont.) 1448 B
   46.16  ← ss2 data (cont.) 600 B
   46.16  ← ss2 data (cont.) 5792 B
   46.21  ← ss2 data (cont.) 5792 B
   46.25  ss1 → ACK
   46.26  ss1 → ACK
   46.26  ← ss2 data (cont.) 5792 B
   46.31  ← ss2 data (cont.) 4128 B
   46.39  ss1 → ACK
   46.39  ← ss2 data (cont.) 1448 B
   46.45  ← ss2 data (cont.) 5792 B
   46.50  ← ss2 data (cont.) 5792 B
   46.52  ss1 → ACK
   46.55  ← ss2 data (cont.) 7240 B
   46.60  ← ss2 data (cont.) 528 B
   46.60  ← ss2 data (cont.) 1728 B
   46.64  ss1 → ACK
   46.65  ss1 → ACK
   46.76  ← ss2 data (cont.) 1448 B
   46.82  ← ss2 data (cont.) 5792 B
   46.87  ← ss2 data (cont.) 5792 B
   46.89  ss1 → ACK
   46.92  ← ss2 data (cont.) 7240 B
   46.97  ← ss2 data (cont.) 2256 B
   47.01  ss1 → ACK
   47.03  ss1 → ACK
   47.14  ← ss2 data (cont.) 1448 B
   47.19  ← ss2 data (cont.) 7240 B
   47.24  ← ss2 data (cont.) 5792 B
   47.28  ss1 → ACK
   47.29  ← ss2 data (cont.) 5792 B
   47.36  ← ss2 data (cont.) 4304 B
   47.42  ss1 → ACK
   47.43  ss1 → ACK
   47.54  ← ss2 data (cont.) 3072 B
   47.56  ss1 → ACK
   47.60  ← ss2 data (cont.) 5792 B
   47.65  ← ss2 data (cont.) 5792 B
   47.68  ss1 → ACK
   47.70  ← ss2 data (cont.) 7240 B
   47.75  ← ss2 data (cont.) 1656 B
   47.80  ss1 → ACK
   47.81  ss1 → ACK
   47.93  ← ss2 data (cont.) 2048 B
   47.93  ← ss2 data (cont.) 1448 B
   47.94  ss1 → ACK
   47.98  ← ss2 data (cont.) 5792 B
   48.03  ← ss2 data (cont.) 5792 B
   48.06  ss1 → ACK
   48.09  ← ss2 data (cont.) 7448 B
   48.19  ss1 → ACK
   48.20  ss1 → ACK
   48.32  ← ss2 data (cont.) 1448 B
   48.37  ← ss2 data (cont.) 5792 B
   48.42  ← ss2 data (cont.) 7240 B
   48.45  ss1 → ACK
   48.46  ss1 → ACK
   48.48  ← ss2 data (cont.) 5792 B
   48.53  ← ss2 data (cont.) 1232 B
   48.58  ← ss2 data (cont.) 1448 B
   48.58  ss1 → ACK
   48.63  ← ss2 data (cont.) 7240 B
   48.69  ← ss2 data (cont.) 5792 B
   48.71  ss1 → ACK
   48.74  ← ss2 data (cont.) 5792 B
   48.79  ← ss2 data (cont.) 1376 B
   48.83  ss1 → ACK
   48.84  ← ss2 data (cont.) 2896 B
   48.90  ← ss2 data (cont.) 3248 B
   48.96  ss1 → ACK
   48.97  ss1 → ACK
   49.08  ← ss2 data (cont.) 2896 B
   49.09  ss1 → ACK
   49.14  ← ss2 data (cont.) 5792 B
   49.19  ← ss2 data (cont.) 5792 B
   49.24  ss1 → ACK
   49.24  ← ss2 data (cont.) 5792 B
   49.25  ss1 → ACK
   49.29  ← ss2 data (cont.) 3280 B
   49.35  ← ss2 data (cont.) 1448 B
   49.39  ss1 → ACK
   49.41  ← ss2 data (cont.) 5792 B
   49.46  ← ss2 data (cont.) 5792 B
   49.51  ← ss2 data (cont.) 5792 B
   49.52  ss1 → ACK
   49.56  ← ss2 data (cont.) 2472 B
   49.62  ← ss2 data (cont.) 1624 B
   49.64  ss1 → ACK
   49.65  ss1 → ACK
   49.76  ← ss2 data (cont.) 1448 B
   49.81  ← ss2 data (cont.) 5792 B
   49.87  ← ss2 data (cont.) 5792 B
   49.89  ss1 → ACK
   49.92  ← ss2 data (cont.) 5400 B
   50.01  ss1 → ACK
   50.02  ss1 → ACK
   50.12  ← ss2 data (cont.) 1448 B
   50.18  ← ss2 data (cont.) 600 B
   50.18  ← ss2 data (cont.) 5792 B
   50.23  ← ss2 data (cont.) 5792 B
   50.24  ss1 → ACK
   50.28  ← ss2 data (cont.) 5792 B
   50.33  ← ss2 data (cont.) 3104 B
   50.37  ss1 → ACK
   50.38  ss1 → ACK
   50.49  ← ss2 data (cont.) 2048 B
   50.50  ss1 → ACK
   50.55  ← ss2 data (cont.) 7240 B
   50.60  ← ss2 data (cont.) 5792 B
   50.62  ss1 → ACK
   50.65  ← ss2 data (cont.) 5792 B
   50.70  ← ss2 data (cont.) 1656 B
   50.75  ss1 → ACK
   50.76  ss1 → ACK
   50.94  ← ss2 data (cont.) 1448 B
   50.99  ← ss2 data (cont.) 5792 B
   51.00  ss1 → ACK
   51.05  ← ss2 data (cont.) 5792 B
   51.10  ← ss2 data (cont.) 5792 B
   51.13  ss1 → ACK
   51.15  ← ss2 data (cont.) 6776 B
   51.24  ← ss2 data (cont.) 1448 B
   51.25  ss1 → ACK
   51.29  ← ss2 data (cont.) 5792 B
   51.35  ← ss2 data (cont.) 5792 B
   51.39  ss1 → ACK
   51.40  ss1 → ACK
   51.40  ← ss2 data (cont.) 7520 B
   51.45  ← ss2 data (cont.) 2400 B
   51.52  ss1 → ACK
   51.68  ← ss2 data (cont.) 1448 B
   51.79  ← ss2 data (cont.) 11584 B
   51.80  ss1 → ACK
   51.83  ← ss2 data (cont.) 5792 B
   51.87  ss1 → ACK
   52.14  ← ss2 data (cont.) 4024 B
   52.14  ← ss2 data (cont.) 18824 B
   52.15  ss1 → ACK
   52.24  ss1 → ACK
   52.42  ← ss2 data (cont.) 2080 B
   52.49  ss1 → ACK
   52.73  ← ss2 data (cont.) 25176 B
   52.74  ss1 → ACK
   52.86  ss1 → ACK
   53.17  ← ss2 data (cont.) 14480 B
   53.18  ss1 → ACK
   53.46  ← ss2 data (cont.) 28952 B
   53.46  ← ss2 data (cont.) 1624 B
   53.47  ← ss2 data (cont.) 4344 B
   53.56  ss1 → ACK
   53.74  ← ss2 data (cont.) 16280 B
   53.79  ss1 → ACK
   54.02  ← ss2 data (cont.) 24616 B
   54.04  ss1 → ACK
   54.05  ss1 → ACK
   54.31  ← ss2 data (cont.) 1088 B
   54.31  ← ss2 data (cont.) 13208 B
   54.41  ss1 → ACK
   54.60  ← ss2 data (cont.) 31784 B
   54.65  ss1 → ACK
   54.78  ss1 → ACK
   55.19  ← ss2 data (cont.) 22528 B
   55.21  ← ss2 data (cont.) 10136 B
   55.25  ss1 → ACK
   55.39  ss1 → ACK
   55.49  ← ss2 data (cont.) 14440 B
   55.51  ss1 → ACK
   55.78  ← ss2 data (cont.) 14232 B
   55.79  ss1 → ACK
   55.80  ← ss2 data (cont.) 15928 B
   55.86  ss1 → ACK
   56.07  ← ss2 data (cont.) 13768 B
   56.10  ss1 → ACK
   56.36  ss1 → ACK
   56.38  ← ss2 data (cont.) 23552 B
   56.49  ss1 → ACK
   56.67  ← ss2 data (cont.) 8688 B
   56.68  ss1 → ACK
   56.96  ← ss2 data (cont.) 28176 B
   56.98  ← ss2 data (cont.) 8688 B
   57.08  ss1 → ACK
   57.25  ← ss2 data (cont.) 8192 B
   57.26  ss1 → ACK
   57.55  ← ss2 data (cont.) 15360 B
   57.56  ss1 → ACK
   57.84  ← ss2 data (cont.) 5743 B
   57.85  ss1 → ACK
   80.18  ← ss2 data 31 B
   80.29  ← ss2 data 94 B
   80.29  ← ss2 data 103 B
   80.29  ← ss2 data 496 B
   80.43  ← ss2 data 1448 B
   80.45  ss1 → ACK
   80.50  ← ss2 data (cont.) 7864 B
   80.50  ← ss2 FIN 218 B
```

## full, RTT 50 мс — медианный запрос (new TCP + resumed TLS, 547.1 мс)

Паузы:
- 25.0 мс: после «← ss2 SYN-ACK» до «← ss2 SYN-ACK»
- 25.7 мс: после «ss1 → ClientHello 2800 B» до «← ss2 ACK»
- 23.0 мс: после «← ss2 ChangeCipherSpec 51 B» до «← ss2 ACK»
- 25.9 мс: после «ss1 → data (cont.) 1448 B» до «← ss2 ACK»
- 25.0 мс: после «← ss2 ACK» до «← ss2 ACK»
- 26.1 мс: после «ss1 → ACK» до «← ss2 data (cont.) 2896 B»
- 24.6 мс: после «← ss2 data (cont.) 2896 B» до «← ss2 data (cont.) 2896 B»
- 25.2 мс: после «ss1 → ACK» до «← ss2 data (cont.) 1448 B»
- 23.9 мс: после «← ss2 data (cont.) 2896 B» до «← ss2 data (cont.) 1448 B»
- 24.8 мс: после «ss1 → ACK» до «← ss2 data (cont.) 1448 B»
- 23.7 мс: после «← ss2 data (cont.) 2896 B» до «← ss2 data (cont.) 1448 B»
- 24.7 мс: после «ss1 → ACK» до «← ss2 data (cont.) 4344 B»
- 22.8 мс: после «← ss2 data (cont.) 7456 B» до «← ss2 data (cont.) 4344 B»
- 23.2 мс: после «ss1 → ACK» до «← ss2 data (cont.) 1448 B»
- 20.5 мс: после «← ss2 data (cont.) 2896 B» до «← ss2 data (cont.) 1448 B»
- 21.2 мс: после «ss1 → ACK» до «← ss2 data (cont.) 5792 B»
- 21.4 мс: после «← ss2 FIN 5373 B» до «← ss2 data (cont.) 5792 B»

```
    0.00  ss1 → SYN
   15.79  ← ss2 ACK
   15.79  ← ss2 ACK
   26.07  ← ss2 SYN-ACK
   51.08  ← ss2 SYN-ACK
   51.10  ss1 → ACK
   51.80  ss1 → ClientHello 2800 B
   77.50  ← ss2 ACK
   79.37  ← ss2 TLS hs 2+4 2660 B
   79.46  ← ss2 ChangeCipherSpec 51 B
  102.51  ← ss2 ACK
  104.37  ← ss2 TLS hs 2+4 2660 B
  104.38  ss1 → ACK
  104.47  ← ss2 data (cont.) 51 B
  104.47  ss1 → ACK
  104.81  ss1 → ChangeCipherSpec 6 B
  124.81  ss1 → Finished (enc.) 2896 B
  124.86  ss1 → data (cont.) 2896 B
  124.87  ss1 → data (cont.) 2896 B
  124.92  ss1 → data (cont.) 1448 B
  150.78  ← ss2 ACK
  150.79  ← ss2 ACK
  150.79  ← ss2 ACK
  175.79  ← ss2 ACK
  175.80  ← ss2 ACK
  175.80  ← ss2 ACK
  175.81  ss1 → data (cont.) 987 B
  194.32  ← ss2 ACK
  201.62  ← ss2 ACK
  212.92  ← ss2 data 224 B
  212.97  ← ss2 data 200 B
  212.97  ← ss2 data 450 B
  213.13  ← ss2 data 31 B
  213.13  ← ss2 data 94 B
  213.18  ← ss2 data 31 B
  213.18  ← ss2 data 71 B
  213.24  ← ss2 data 62 B
  213.30  ← ss2 data (cont.) 2896 B
  219.33  ← ss2 ACK
  226.62  ← ss2 ACK
  237.93  ← ss2 data 224 B
  237.97  ← ss2 data 200 B
  237.97  ← ss2 data 450 B
  238.13  ← ss2 data (cont.) 31 B
  238.13  ← ss2 data (cont.) 94 B
  238.19  ← ss2 data (cont.) 31 B
  238.19  ← ss2 data (cont.) 71 B
  238.24  ← ss2 data (cont.) 62 B
  238.30  ← ss2 data (cont.) 2896 B
  238.32  ss1 → ACK
  264.40  ← ss2 data (cont.) 2896 B
  264.41  ← ss2 data (cont.) 2896 B
  264.51  ← ss2 data (cont.) 2896 B
  264.51  ← ss2 data (cont.) 2896 B
  264.60  ← ss2 data (cont.) 2896 B
  264.60  ← ss2 data (cont.) 1448 B
  264.65  ← ss2 data (cont.) 1448 B
  264.70  ← ss2 data (cont.) 1448 B
  264.81  ← ss2 data (cont.) 1448 B
  264.81  ← ss2 data (cont.) 2896 B
  264.86  ← ss2 data (cont.) 2896 B
  264.86  ← ss2 data (cont.) 2896 B
  289.42  ← ss2 data (cont.) 2896 B
  289.42  ← ss2 data (cont.) 2896 B
  289.45  ss1 → ACK
  289.47  ss1 → ACK
  289.51  ← ss2 data (cont.) 2896 B
  289.51  ← ss2 data (cont.) 2896 B
  289.60  ← ss2 data (cont.) 2896 B
  289.60  ← ss2 data (cont.) 1448 B
  289.65  ← ss2 data (cont.) 1448 B
  289.70  ← ss2 data (cont.) 1448 B
  289.81  ← ss2 data (cont.) 1448 B
  289.82  ← ss2 data (cont.) 2896 B
  289.86  ← ss2 data (cont.) 2896 B
  289.86  ← ss2 data (cont.) 2896 B
  289.98  ss1 → ACK
  315.22  ← ss2 data (cont.) 1448 B
  315.26  ← ss2 data (cont.) 1448 B
  315.26  ← ss2 data (cont.) 2896 B
  315.33  ← ss2 data (cont.) 1448 B
  315.39  ← ss2 data (cont.) 1448 B
  315.39  ← ss2 data (cont.) 2896 B
  315.51  ← ss2 data (cont.) 1448 B
  315.56  ← ss2 data (cont.) 1448 B
  315.56  ← ss2 data (cont.) 2896 B
  315.63  ← ss2 data (cont.) 1448 B
  315.69  ← ss2 data (cont.) 1448 B
  315.69  ← ss2 data (cont.) 2896 B
  315.74  ← ss2 data (cont.) 1448 B
  315.79  ← ss2 data (cont.) 1448 B
  315.79  ← ss2 data (cont.) 2896 B
  315.84  ← ss2 data (cont.) 1448 B
  315.90  ← ss2 data (cont.) 1448 B
  315.90  ← ss2 data (cont.) 2896 B
  315.95  ← ss2 data (cont.) 1448 B
  316.00  ← ss2 data (cont.) 1448 B
  316.00  ← ss2 data (cont.) 2896 B
  316.05  ← ss2 data (cont.) 1448 B
  316.11  ← ss2 data (cont.) 1448 B
  316.11  ← ss2 data (cont.) 2896 B
  316.17  ← ss2 data (cont.) 1448 B
  316.22  ← ss2 data (cont.) 1448 B
  316.22  ← ss2 data (cont.) 2896 B
  316.27  ← ss2 data (cont.) 1448 B
  316.32  ← ss2 data (cont.) 1448 B
  316.32  ← ss2 data (cont.) 2896 B
  340.27  ← ss2 data (cont.) 1448 B
  340.27  ← ss2 data (cont.) 1448 B
  340.27  ← ss2 data (cont.) 2896 B
  340.31  ss1 → ACK
  340.34  ← ss2 data (cont.) 1448 B
  340.39  ← ss2 data (cont.) 1448 B
  340.39  ← ss2 data (cont.) 2896 B
  340.47  ss1 → ACK
  340.51  ← ss2 data (cont.) 1448 B
  340.56  ← ss2 data (cont.) 1448 B
  340.56  ← ss2 data (cont.) 2896 B
  340.57  ss1 → ACK
  340.58  ss1 → ACK
  340.64  ← ss2 data (cont.) 1448 B
  340.69  ← ss2 data (cont.) 1448 B
  340.69  ← ss2 data (cont.) 2896 B
  340.70  ss1 → ACK
  340.71  ss1 → ACK
  340.75  ← ss2 data (cont.) 1448 B
  340.79  ← ss2 data (cont.) 1448 B
  340.79  ← ss2 data (cont.) 2896 B
  340.80  ss1 → ACK
  340.81  ss1 → ACK
  340.85  ← ss2 data (cont.) 1448 B
  340.90  ← ss2 data (cont.) 1448 B
  340.90  ← ss2 data (cont.) 2896 B
  340.91  ss1 → ACK
  340.91  ss1 → ACK
  340.95  ← ss2 data (cont.) 1448 B
  341.00  ← ss2 data (cont.) 1448 B
  341.00  ← ss2 data (cont.) 2896 B
  341.02  ss1 → ACK
  341.02  ss1 → ACK
  341.05  ← ss2 data (cont.) 1448 B
  341.11  ← ss2 data (cont.) 1448 B
  341.11  ← ss2 data (cont.) 2896 B
  341.12  ss1 → ACK
  341.12  ss1 → ACK
  341.17  ← ss2 data (cont.) 1448 B
  341.22  ← ss2 data (cont.) 1448 B
  341.22  ← ss2 data (cont.) 2896 B
  341.23  ss1 → ACK
  341.24  ss1 → ACK
  341.27  ← ss2 data (cont.) 1448 B
  341.33  ← ss2 data (cont.) 1448 B
  341.33  ← ss2 data (cont.) 2896 B
  341.33  ss1 → ACK
  341.34  ss1 → ACK
  366.18  ← ss2 data (cont.) 1448 B
  366.23  ← ss2 data (cont.) 1448 B
  366.23  ← ss2 data (cont.) 2896 B
  366.23  ← ss2 data (cont.) 1448 B
  366.29  ← ss2 data (cont.) 1448 B
  366.29  ← ss2 data (cont.) 2896 B
  366.29  ← ss2 data (cont.) 2896 B
  366.33  ← ss2 data (cont.) 2896 B
  366.33  ← ss2 data (cont.) 2896 B
  366.39  ← ss2 data (cont.) 2896 B
  366.39  ← ss2 data (cont.) 2896 B
  366.44  ← ss2 data (cont.) 2896 B
  366.44  ← ss2 data (cont.) 2896 B
  366.44  ← ss2 data (cont.) 1448 B
  366.50  ← ss2 data (cont.) 1448 B
  366.50  ← ss2 data (cont.) 4344 B
  366.55  ← ss2 data (cont.) 4344 B
  366.60  ← ss2 data (cont.) 1448 B
  366.65  ← ss2 data (cont.) 2896 B
  366.66  ← ss2 data (cont.) 4344 B
  366.76  ← ss2 data (cont.) 4344 B
  366.76  ← ss2 data (cont.) 2896 B
  366.81  ← ss2 data (cont.) 1448 B
  366.81  ← ss2 data (cont.) 1448 B
  366.87  ← ss2 data (cont.) 2896 B
  366.87  ← ss2 data (cont.) 2896 B
  366.92  ← ss2 data (cont.) 1448 B
  366.92  ← ss2 data (cont.) 4344 B
  366.92  ← ss2 data (cont.) 1448 B
  366.97  ← ss2 data (cont.) 2896 B
  367.02  ← ss2 data (cont.) 4344 B
  367.08  ← ss2 data (cont.) 4344 B
  367.13  ← ss2 data (cont.) 1448 B
  367.18  ← ss2 data (cont.) 2896 B
  367.18  ← ss2 data (cont.) 4344 B
  367.24  ← ss2 data (cont.) 1448 B
  367.29  ← ss2 data (cont.) 2896 B
  367.29  ← ss2 data (cont.) 2896 B
  367.34  ← ss2 data (cont.) 1448 B
  367.40  ← ss2 data (cont.) 4344 B
  367.40  ← ss2 data (cont.) 2896 B
  367.45  ← ss2 data (cont.) 1448 B
  367.50  ← ss2 data (cont.) 2896 B
  391.22  ← ss2 data (cont.) 1448 B
  391.24  ← ss2 data (cont.) 1448 B
  391.24  ← ss2 data (cont.) 2896 B
  391.24  ← ss2 data (cont.) 1448 B
  391.25  ss1 → ACK
  391.25  ss1 → ACK
  391.29  ← ss2 data (cont.) 1448 B
  391.29  ← ss2 data (cont.) 2896 B
  391.29  ← ss2 data (cont.) 2896 B
  391.30  ss1 → ACK
  391.34  ← ss2 data (cont.) 2896 B
  391.34  ← ss2 data (cont.) 2896 B
  391.36  ss1 → ACK
  391.39  ← ss2 data (cont.) 2896 B
  391.39  ← ss2 data (cont.) 2896 B
  391.44  ← ss2 data (cont.) 2896 B
  391.45  ← ss2 data (cont.) 2896 B
  391.45  ← ss2 data (cont.) 1448 B
  391.46  ss1 → ACK
  391.50  ← ss2 data (cont.) 1448 B
  391.50  ← ss2 data (cont.) 4344 B
  391.55  ← ss2 data (cont.) 4344 B
  391.56  ss1 → ACK
  391.60  ← ss2 data (cont.) 1448 B
  391.66  ← ss2 data (cont.) 2896 B
  391.66  ← ss2 data (cont.) 4344 B
  391.67  ss1 → ACK
  391.75  ss1 → ACK
  391.77  ← ss2 data (cont.) 4344 B
  391.77  ← ss2 data (cont.) 2896 B
  391.82  ← ss2 data (cont.) 1448 B
  391.82  ← ss2 data (cont.) 1448 B
  391.85  ss1 → ACK
  391.87  ← ss2 data (cont.) 2896 B
  391.87  ← ss2 data (cont.) 2896 B
  391.89  ss1 → ACK
  391.92  ← ss2 data (cont.) 1448 B
  391.92  ← ss2 data (cont.) 4344 B
  391.92  ← ss2 data (cont.) 1448 B
  391.97  ← ss2 data (cont.) 2896 B
  391.98  ss1 → ACK
  392.02  ← ss2 data (cont.) 4344 B
  392.03  ss1 → ACK
  392.08  ← ss2 data (cont.) 4344 B
  392.13  ← ss2 data (cont.) 1448 B
  392.17  ss1 → ACK
  392.18  ← ss2 data (cont.) 2896 B
  392.18  ← ss2 data (cont.) 4344 B
  392.24  ← ss2 data (cont.) 1448 B
  392.27  ss1 → ACK
  392.29  ← ss2 data (cont.) 2896 B
  392.29  ← ss2 data (cont.) 2896 B
  392.30  ss1 → ACK
  392.35  ← ss2 data (cont.) 1448 B
  392.37  ss1 → ACK
  392.41  ← ss2 data (cont.) 4344 B
  392.41  ← ss2 data (cont.) 2896 B
  392.45  ← ss2 data (cont.) 1448 B
  392.47  ss1 → ACK
  392.51  ← ss2 data (cont.) 2896 B
  392.56  ss1 → ACK
  417.29  ← ss2 data (cont.) 4344 B
  417.29  ← ss2 data (cont.) 1448 B
  417.38  ← ss2 data (cont.) 2896 B
  417.38  ← ss2 data (cont.) 5792 B
  417.38  ← ss2 data (cont.) 2896 B
  417.47  ← ss2 data (cont.) 2896 B
  417.47  ← ss2 data (cont.) 5792 B
  417.47  ← ss2 data (cont.) 1448 B
  417.76  ← ss2 data (cont.) 4344 B
  417.76  ← ss2 data (cont.) 5792 B
  417.76  ← ss2 data (cont.) 7240 B
  417.77  ← ss2 Finished (enc.) 7240 B
  417.77  ← ss2 data (cont.) 8688 B
  417.77  ← ss2 data (cont.) 2896 B
  418.05  ← ss2 data (cont.) 5792 B
  418.05  ← ss2 data (cont.) 8688 B
  418.35  ← ss2 data (cont.) 8688 B
  418.35  ← ss2 data (cont.) 8688 B
  418.35  ← ss2 data (cont.) 4344 B
  418.64  ← ss2 data (cont.) 4344 B
  418.64  ← ss2 data (cont.) 8688 B
  418.65  ← ss2 data (cont.) 2896 B
  418.93  ← ss2 data (cont.) 5792 B
  418.94  ← ss2 data (cont.) 8688 B
  418.94  ← ss2 data (cont.) 1448 B
  419.22  ← ss2 data (cont.) 7240 B
  419.23  ← ss2 data (cont.) 8688 B
  419.23  ← ss2 data (cont.) 5792 B
  419.52  ← ss2 data (cont.) 2896 B
  419.52  ← ss2 data (cont.) 7456 B
  442.29  ← ss2 data (cont.) 4344 B
  442.29  ← ss2 data (cont.) 1448 B
  442.30  ss1 → ACK
  442.38  ← ss2 data (cont.) 2896 B
  442.39  ← ss2 data (cont.) 5792 B
  442.39  ← ss2 data (cont.) 2896 B
  442.39  ss1 → ACK
  442.40  ss1 → ACK
  442.41  ss1 → ACK
  442.47  ← ss2 data (cont.) 2896 B
  442.48  ← ss2 data (cont.) 5792 B
  442.48  ← ss2 data (cont.) 1448 B
  442.48  ss1 → ACK
  442.49  ss1 → ACK
  442.76  ← ss2 data (cont.) 4344 B
  442.76  ← ss2 data (cont.) 5792 B
  442.76  ← ss2 data (cont.) 7240 B
  442.77  ss1 → ACK
  442.78  ss1 → ACK
  442.78  ← ss2 Finished (enc.) 7240 B
  442.78  ← ss2 data (cont.) 8688 B
  442.78  ← ss2 data (cont.) 2896 B
  442.79  ss1 → ACK
  442.79  ss1 → ACK
  442.80  ss1 → ACK
  442.80  ss1 → ACK
  443.06  ← ss2 data (cont.) 5792 B
  443.06  ← ss2 data (cont.) 8688 B
  443.07  ss1 → ACK
  443.07  ss1 → ACK
  443.35  ← ss2 data (cont.) 8688 B
  443.35  ← ss2 data (cont.) 8688 B
  443.36  ss1 → ACK
  443.37  ss1 → ACK
  443.37  ← ss2 data (cont.) 4344 B
  443.38  ss1 → ACK
  443.65  ← ss2 data (cont.) 4344 B
  443.65  ← ss2 data (cont.) 8688 B
  443.65  ← ss2 data (cont.) 2896 B
  443.66  ss1 → ACK
  443.66  ss1 → ACK
  443.67  ss1 → ACK
  443.94  ← ss2 data (cont.) 5792 B
  443.94  ← ss2 data (cont.) 8688 B
  443.95  ss1 → ACK
  443.95  ← ss2 data (cont.) 1448 B
  443.96  ss1 → ACK
  444.23  ← ss2 data (cont.) 7240 B
  444.23  ← ss2 data (cont.) 8688 B
  444.24  ss1 → ACK
  444.25  ss1 → ACK
  444.25  ← ss2 data (cont.) 5792 B
  444.25  ss1 → ACK
  444.52  ← ss2 data (cont.) 2896 B
  444.52  ← ss2 data (cont.) 7456 B
  444.54  ss1 → ACK
  444.54  ss1 → ACK
  467.78  ← ss2 data (cont.) 1448 B
  467.88  ← ss2 data (cont.) 7240 B
  467.88  ← ss2 data (cont.) 2896 B
  467.96  ← ss2 data (cont.) 5792 B
  468.26  ← ss2 data (cont.) 8688 B
  468.26  ← ss2 data (cont.) 7240 B
  468.55  ← ss2 data (cont.) 1448 B
  468.55  ← ss2 data (cont.) 10136 B
  468.56  ← ss2 data (cont.) 10136 B
  468.84  ← ss2 data (cont.) 11584 B
  468.84  ← ss2 data (cont.) 11584 B
  468.85  ← ss2 data (cont.) 1448 B
  469.13  ← ss2 data (cont.) 10136 B
  469.13  ← ss2 data (cont.) 11584 B
  469.14  ← ss2 data (cont.) 4344 B
  469.42  ← ss2 data (cont.) 8688 B
  469.42  ← ss2 data (cont.) 13032 B
  469.43  ← ss2 data (cont.) 4344 B
  469.71  ← ss2 data (cont.) 8688 B
  469.71  ← ss2 data (cont.) 13032 B
  469.72  ← ss2 data (cont.) 10136 B
  469.99  ← ss2 data (cont.) 4344 B
  470.00  ← ss2 data (cont.) 14480 B
  470.00  ← ss2 data (cont.) 4344 B
  470.28  ← ss2 data (cont.) 10136 B
  470.28  ← ss2 data (cont.) 14480 B
  470.28  ← ss2 data (cont.) 4344 B
  470.56  ← ss2 data (cont.) 10136 B
  470.56  ← ss2 data (cont.) 14480 B
  470.56  ← ss2 data (cont.) 4344 B
  470.82  ← ss2 data (cont.) 10136 B
  470.82  ← ss2 data (cont.) 14480 B
  471.10  ← ss2 data (cont.) 14480 B
  471.11  ← ss2 data (cont.) 14480 B
  471.39  ← ss2 data (cont.) 14480 B
  471.41  ← ss2 data (cont.) 14480 B
  471.41  ← ss2 data (cont.) 4344 B
  471.69  ← ss2 data (cont.) 10136 B
  471.69  ← ss2 data (cont.) 14480 B
  471.70  ← ss2 data (cont.) 2896 B
  471.98  ← ss2 data (cont.) 11584 B
  471.99  ← ss2 data (cont.) 14480 B
  471.99  ← ss2 data (cont.) 2896 B
  472.27  ← ss2 data (cont.) 2896 B
  492.79  ← ss2 data (cont.) 1448 B
  492.88  ← ss2 data (cont.) 7240 B
  492.88  ← ss2 data (cont.) 2896 B
  492.89  ss1 → ACK
  492.90  ss1 → ACK
  492.97  ← ss2 data (cont.) 5792 B
  492.97  ss1 → ACK
  493.30  ← ss2 data (cont.) 8688 B
  493.30  ← ss2 data (cont.) 7240 B
  493.31  ss1 → ACK
  493.32  ss1 → ACK
  493.55  ← ss2 data (cont.) 1448 B
  493.55  ← ss2 data (cont.) 10136 B
  493.57  ss1 → ACK
  493.57  ← ss2 data (cont.) 10136 B
  493.58  ss1 → ACK
  493.84  ← ss2 data (cont.) 11584 B
  493.84  ← ss2 data (cont.) 11584 B
  493.85  ss1 → ACK
  493.86  ss1 → ACK
  493.86  ← ss2 data (cont.) 1448 B
  494.14  ← ss2 data (cont.) 10136 B
  494.14  ← ss2 data (cont.) 11584 B
  494.15  ss1 → ACK
  494.15  ss1 → ACK
  494.15  ← ss2 data (cont.) 4344 B
  494.16  ss1 → ACK
  494.43  ← ss2 data (cont.) 8688 B
  494.43  ← ss2 data (cont.) 13032 B
  494.44  ss1 → ACK
  494.44  ss1 → ACK
  494.44  ← ss2 data (cont.) 4344 B
  494.45  ss1 → ACK
  494.71  ← ss2 data (cont.) 8688 B
  494.72  ← ss2 data (cont.) 13032 B
  494.73  ss1 → ACK
  494.73  ss1 → ACK
  494.73  ← ss2 data (cont.) 10136 B
  494.74  ss1 → ACK
  495.00  ← ss2 data (cont.) 4344 B
  495.00  ← ss2 data (cont.) 14480 B
  495.01  ss1 → ACK
  495.01  ← ss2 data (cont.) 4344 B
  495.07  ss1 → ACK
  495.28  ← ss2 data (cont.) 10136 B
  495.29  ← ss2 data (cont.) 14480 B
  495.29  ← ss2 data (cont.) 4344 B
  495.30  ss1 → ACK
  495.33  ss1 → ACK
  495.57  ← ss2 data (cont.) 10136 B
  495.57  ← ss2 data (cont.) 14480 B
  495.57  ← ss2 data (cont.) 4344 B
  495.58  ss1 → ACK
  495.59  ss1 → ACK
  495.82  ← ss2 data (cont.) 10136 B
  495.82  ← ss2 data (cont.) 14480 B
  495.83  ss1 → ACK
  495.86  ss1 → ACK
  496.11  ← ss2 data (cont.) 14480 B
  496.12  ss1 → ACK
  496.12  ← ss2 data (cont.) 14480 B
  496.20  ss1 → ACK
  496.40  ← ss2 data (cont.) 14480 B
  496.41  ss1 → ACK
  496.41  ← ss2 data (cont.) 14480 B
  496.41  ← ss2 data (cont.) 4344 B
  496.46  ss1 → ACK
  496.69  ← ss2 data (cont.) 10136 B
  496.70  ← ss2 data (cont.) 14480 B
  496.70  ← ss2 data (cont.) 2896 B
  496.71  ss1 → ACK
  496.72  ss1 → ACK
  496.72  ss1 → ACK
  496.98  ← ss2 data (cont.) 11584 B
  496.99  ss1 → ACK
  496.99  ← ss2 data (cont.) 14480 B
  496.99  ← ss2 data (cont.) 2896 B
  497.05  ss1 → ACK
  497.28  ← ss2 data (cont.) 2896 B
  497.28  ss1 → ACK
  518.47  ← ss2 data (cont.) 5792 B
  518.56  ← ss2 data (cont.) 8688 B
  518.56  ← ss2 data (cont.) 1448 B
  518.61  ← ss2 data (cont.) 5792 B
  518.91  ← ss2 data (cont.) 7240 B
  519.20  ← ss2 data (cont.) 15928 B
  519.21  ← ss2 data (cont.) 7240 B
  519.49  ← ss2 data (cont.) 8688 B
  519.79  ← ss2 data (cont.) 17376 B
  519.80  ← ss2 data (cont.) 15928 B
  520.07  ← ss2 data (cont.) 1448 B
  520.08  ← ss2 data (cont.) 18824 B
  520.09  ← ss2 data (cont.) 13032 B
  520.37  ← ss2 data (cont.) 5792 B
  520.37  ← ss2 data (cont.) 20272 B
  520.38  ← ss2 data (cont.) 2896 B
  520.66  ← ss2 data (cont.) 17376 B
  520.95  ← ss2 data (cont.) 21720 B
  520.96  ← ss2 data (cont.) 14480 B
  521.24  ← ss2 data (cont.) 7240 B
  521.24  ← ss2 data (cont.) 23168 B
  521.25  ← ss2 data (cont.) 2896 B
  521.49  ← ss2 data (cont.) 20272 B
  521.51  ← ss2 data (cont.) 10136 B
  521.78  ← ss2 data (cont.) 14480 B
  521.79  ← ss2 data (cont.) 8688 B
  522.07  ← ss2 FIN 5373 B
  543.48  ← ss2 data (cont.) 5792 B
  543.49  ss1 → ACK
  543.56  ← ss2 data (cont.) 8688 B
  543.56  ← ss2 data (cont.) 1448 B
  543.57  ss1 → ACK
  543.61  ← ss2 data (cont.) 5792 B
  543.62  ss1 → ACK
  543.91  ← ss2 data (cont.) 7240 B
  543.92  ss1 → ACK
  544.20  ← ss2 data (cont.) 15928 B
  544.21  ss1 → ACK
  544.22  ← ss2 data (cont.) 7240 B
  544.22  ss1 → ACK
  544.50  ← ss2 data (cont.) 8688 B
  544.51  ss1 → ACK
  544.79  ← ss2 data (cont.) 17376 B
  544.80  ss1 → ACK
  544.80  ← ss2 data (cont.) 15928 B
  544.81  ss1 → ACK
  545.08  ← ss2 data (cont.) 1448 B
  545.08  ← ss2 data (cont.) 18824 B
  545.09  ss1 → ACK
  545.09  ← ss2 data (cont.) 13032 B
  545.10  ss1 → ACK
  545.37  ← ss2 data (cont.) 5792 B
  545.38  ← ss2 data (cont.) 20272 B
  545.38  ← ss2 data (cont.) 2896 B
  545.39  ss1 → ACK
  545.39  ss1 → ACK
  545.40  ss1 → ACK
  545.66  ← ss2 data (cont.) 17376 B
  545.67  ss1 → ACK
  545.95  ← ss2 data (cont.) 21720 B
  545.96  ss1 → ACK
  545.96  ← ss2 data (cont.) 14480 B
  545.97  ss1 → ACK
  546.25  ← ss2 data (cont.) 7240 B
  546.25  ← ss2 data (cont.) 23168 B
  546.25  ← ss2 data (cont.) 2896 B
  546.26  ss1 → ACK
  546.26  ss1 → ACK
  546.27  ss1 → ACK
  546.50  ← ss2 data (cont.) 20272 B
  546.51  ss1 → ACK
  546.51  ← ss2 data (cont.) 10136 B
  546.51  ss1 → ACK
  546.78  ← ss2 data (cont.) 14480 B
  546.79  ss1 → ACK
  546.80  ← ss2 data (cont.) 8688 B
  546.80  ss1 → ACK
  547.07  ← ss2 FIN 5373 B
```

## reuse, RTT 0 мс — медианный запрос (reused connection, 51.5 мс)

Паузы:
- 14.3 мс: после «ss1 → data (cont.) 842 B» до «← ss2 data 236 B»
- 25.8 мс: после «ss1 → ACK» до «← ss2 data 36 B»

```
    0.00  ss1 → data 2996 B
    0.16  ss1 → data (cont.) 7240 B
    0.91  ← ss2 ACK
    0.93  ss1 → data (cont.) 842 B
   15.25  ← ss2 data 236 B
   15.30  ← ss2 data 69 B
   15.30  ss1 → ACK
   15.35  ← ss2 data 117 B
   15.40  ← ss2 data 498 B
   15.59  ← ss2 data 36 B
   15.64  ← ss2 data 36 B
   15.64  ← ss2 data 69 B
   15.69  ← ss2 data 149 B
   15.74  ← ss2 data 36 B
   15.80  ← ss2 data (cont.) 2896 B
   15.82  ss1 → ACK
   15.85  ← ss2 data (cont.) 5212 B
   15.87  ss1 → ACK
   15.91  ← ss2 data (cont.) 4344 B
   15.96  ← ss2 data (cont.) 3885 B
   15.96  ← ss2 data (cont.) 2896 B
   15.99  ss1 → ACK
   16.01  ← ss2 data (cont.) 5333 B
   16.02  ss1 → ACK
   16.06  ← ss2 data (cont.) 5792 B
   16.11  ← ss2 data (cont.) 2437 B
   16.11  ← ss2 data (cont.) 4344 B
   16.16  ← ss2 data (cont.) 3885 B
   16.22  ← ss2 data (cont.) 5792 B
   16.25  ss1 → ACK
   16.27  ← ss2 data (cont.) 2437 B
   16.27  ← ss2 data (cont.) 4344 B
   16.29  ss1 → ACK
   16.32  ← ss2 data (cont.) 3885 B
   16.32  ← ss2 data (cont.) 1448 B
   16.37  ← ss2 data (cont.) 6781 B
   16.43  ← ss2 data (cont.) 7240 B
   16.48  ← ss2 data (cont.) 989 B
   16.48  ← ss2 data (cont.) 1448 B
   16.54  ← ss2 data (cont.) 6781 B
   16.59  ← ss2 data (cont.) 5792 B
   16.64  ← ss2 data (cont.) 2437 B
   16.64  ← ss2 data (cont.) 4344 B
   16.69  ← ss2 data (cont.) 3885 B
   16.69  ← ss2 data (cont.) 1448 B
   16.75  ← ss2 data (cont.) 6781 B
   16.80  ← ss2 data (cont.) 5792 B
   16.85  ← ss2 data (cont.) 2437 B
   16.90  ← ss2 data (cont.) 7240 B
   16.94  ss1 → ACK
   16.96  ← ss2 data (cont.) 989 B
   16.96  ← ss2 data (cont.) 4344 B
   17.01  ← ss2 data (cont.) 3885 B
   17.06  ← ss2 data 2068 B
   17.11  ← ss2 data (cont.) 4344 B
   17.12  ss1 → ACK
   17.13  ss1 → ACK
   17.16  ← ss2 data (cont.) 3885 B
   17.17  ← ss2 data (cont.) 1448 B
   17.22  ← ss2 data (cont.) 6781 B
   17.27  ← ss2 data (cont.) 5792 B
   17.27  ss1 → ACK
   17.28  ss1 → ACK
   17.32  ← ss2 data (cont.) 2437 B
   17.32  ← ss2 data (cont.) 4344 B
   17.37  ← ss2 data (cont.) 3885 B
   17.37  ← ss2 data (cont.) 1448 B
   17.43  ← ss2 data (cont.) 6781 B
   17.44  ss1 → ACK
   17.45  ss1 → ACK
   17.48  ← ss2 data (cont.) 2896 B
   17.53  ← ss2 data (cont.) 5333 B
   17.58  ← ss2 data (cont.) 7240 B
   17.60  ss1 → ACK
   17.64  ← ss2 data (cont.) 989 B
   17.64  ← ss2 data (cont.) 4344 B
   17.69  ← ss2 data (cont.) 3885 B
   17.69  ← ss2 data (cont.) 2896 B
   17.74  ← ss2 data (cont.) 5333 B
   17.75  ss1 → ACK
   17.76  ss1 → ACK
   17.79  ← ss2 data (cont.) 7240 B
   17.84  ← ss2 data (cont.) 989 B
   17.84  ← ss2 data (cont.) 4344 B
   17.89  ← ss2 data (cont.) 3885 B
   17.90  ← ss2 data (cont.) 2896 B
   17.91  ss1 → ACK
   17.95  ← ss2 data (cont.) 5333 B
   17.96  ss1 → ACK
   18.00  ← ss2 data (cont.) 5792 B
   18.05  ← ss2 data (cont.) 2437 B
   18.05  ← ss2 data (cont.) 4344 B
   18.06  ss1 → ACK
   18.07  ss1 → ACK
   18.10  ← ss2 data (cont.) 3885 B
   18.10  ← ss2 data (cont.) 2896 B
   18.15  ← ss2 data (cont.) 5333 B
   18.21  ← ss2 data (cont.) 5792 B
   18.22  ss1 → ACK
   18.26  ← ss2 data (cont.) 2437 B
   18.26  ← ss2 data (cont.) 4344 B
   18.31  ← ss2 data (cont.) 3885 B
   18.31  ← ss2 data (cont.) 2896 B
   18.36  ← ss2 data (cont.) 5333 B
   18.37  ss1 → ACK
   18.38  ss1 → ACK
   18.42  ← ss2 data (cont.) 5792 B
   18.47  ← ss2 data (cont.) 2437 B
   18.47  ← ss2 data (cont.) 4344 B
   18.52  ← ss2 data (cont.) 3885 B
   18.52  ← ss2 data (cont.) 1448 B
   18.55  ss1 → ACK
   18.57  ← ss2 data (cont.) 6781 B
   18.62  ← ss2 data (cont.) 5792 B
   18.68  ← ss2 data (cont.) 2437 B
   18.68  ← ss2 data 420 B
   18.68  ← ss2 data (cont.) 2896 B
   18.70  ss1 → ACK
   18.73  ← ss2 data (cont.) 5333 B
   18.73  ← ss2 data (cont.) 1448 B
   18.78  ← ss2 data (cont.) 5792 B
   18.83  ← ss2 data (cont.) 989 B
   18.83  ← ss2 data (cont.) 4344 B
   18.84  ss1 → ACK
   18.86  ss1 → ACK
   18.89  ← ss2 data (cont.) 3885 B
   18.89  ← ss2 data (cont.) 2896 B
   18.94  ← ss2 data (cont.) 5333 B
   18.99  ← ss2 data (cont.) 7240 B
   19.00  ss1 → ACK
   19.04  ← ss2 data (cont.) 989 B
   19.04  ← ss2 data (cont.) 4344 B
   19.09  ← ss2 data (cont.) 3885 B
   19.09  ← ss2 data (cont.) 2896 B
   19.14  ← ss2 data (cont.) 5333 B
   19.15  ss1 → ACK
   19.16  ss1 → ACK
   19.20  ← ss2 data (cont.) 5792 B
   19.25  ← ss2 data (cont.) 2437 B
   19.25  ← ss2 data (cont.) 4344 B
   19.30  ← ss2 data (cont.) 3885 B
   19.30  ← ss2 data (cont.) 1448 B
   19.30  ss1 → ACK
   19.31  ss1 → ACK
   19.35  ← ss2 data (cont.) 6781 B
   19.37  ss1 → ACK
   19.41  ← ss2 data (cont.) 5792 B
   19.42  ss1 → ACK
   19.46  ← ss2 data (cont.) 2437 B
   19.46  ← ss2 data (cont.) 4344 B
   19.51  ← ss2 data (cont.) 3885 B
   19.51  ← ss2 data (cont.) 1448 B
   19.55  ss1 → ACK
   19.56  ← ss2 data (cont.) 6781 B
   19.62  ← ss2 data (cont.) 5792 B
   19.66  ← ss2 data (cont.) 2437 B
   19.66  ← ss2 data (cont.) 2896 B
   19.71  ss1 → ACK
   19.72  ← ss2 data (cont.) 5333 B
   19.72  ← ss2 data (cont.) 1448 B
   19.77  ← ss2 data (cont.) 5792 B
   19.82  ← ss2 data (cont.) 989 B
   19.82  ← ss2 data (cont.) 4344 B
   19.85  ss1 → ACK
   19.88  ← ss2 data (cont.) 3885 B
   19.88  ← ss2 data (cont.) 2896 B
   19.89  ss1 → ACK
   19.93  ← ss2 data (cont.) 5333 B
   19.93  ← ss2 data (cont.) 1448 B
   19.98  ← ss2 data (cont.) 5792 B
   20.01  ss1 → ACK
   20.04  ← ss2 data (cont.) 989 B
   20.04  ← ss2 data (cont.) 4344 B
   20.08  ← ss2 data (cont.) 3885 B
   20.08  ← ss2 data (cont.) 2896 B
   20.13  ← ss2 data (cont.) 5333 B
   20.17  ss1 → ACK
   20.19  ← ss2 data (cont.) 5792 B
   20.20  ss1 → ACK
   20.24  ← ss2 data (cont.) 2437 B
   20.24  ← ss2 data (cont.) 4344 B
   20.29  ← ss2 data (cont.) 2605 B
   20.29  ← ss2 data (cont.) 2896 B
   20.32  ss1 → ACK
   20.34  ← ss2 data (cont.) 5333 B
   20.34  ← ss2 data (cont.) 1448 B
   20.39  ← ss2 data (cont.) 5792 B
   20.45  ← ss2 data (cont.) 989 B
   20.45  ← ss2 data (cont.) 4344 B
   20.48  ss1 → ACK
   20.50  ← ss2 data (cont.) 3885 B
   20.50  ← ss2 data (cont.) 2896 B
   20.55  ← ss2 data (cont.) 5333 B
   20.61  ← ss2 data (cont.) 7240 B
   20.63  ss1 → ACK
   20.66  ← ss2 data (cont.) 989 B
   20.66  ← ss2 data (cont.) 4344 B
   20.67  ss1 → ACK
   20.71  ← ss2 data (cont.) 3885 B
   20.71  ← ss2 data (cont.) 2896 B
   20.76  ← ss2 data (cont.) 5333 B
   20.78  ss1 → ACK
   20.81  ← ss2 data (cont.) 5792 B
   20.86  ← ss2 data (cont.) 2437 B
   20.92  ← ss2 data (cont.) 1448 B
   20.93  ss1 → ACK
   20.97  ← ss2 data (cont.) 5792 B
   21.02  ← ss2 data (cont.) 5792 B
   21.08  ← ss2 data (cont.) 7240 B
   21.08  ss1 → ACK
   21.09  ss1 → ACK
   21.13  ← ss2 data (cont.) 5792 B
   21.18  ← ss2 data (cont.) 5792 B
   21.24  ss1 → ACK
   21.24  ← ss2 data (cont.) 1060 B
   21.24  ← ss2 data (cont.) 5792 B
   21.29  ← ss2 data (cont.) 2437 B
   21.34  ← ss2 data (cont.) 4344 B
   21.39  ss1 → ACK
   21.39  ← ss2 data (cont.) 5792 B
   21.44  ← ss2 data (cont.) 5792 B
   21.49  ← ss2 data (cont.) 7240 B
   21.55  ← ss2 data (cont.) 5792 B
   21.55  ss1 → ACK
   21.57  ss1 → ACK
   21.60  ← ss2 data (cont.) 3956 B
   21.60  ← ss2 data (cont.) 1448 B
   21.65  ← ss2 data (cont.) 6781 B
   21.70  ← ss2 data (cont.) 5792 B
   21.71  ss1 → ACK
   21.72  ss1 → ACK
   21.76  ← ss2 data (cont.) 5792 B
   21.81  ← ss2 data (cont.) 7240 B
   21.86  ← ss2 data (cont.) 5863 B
   21.87  ss1 → ACK
   21.88  ss1 → ACK
   21.91  ← ss2 data (cont.) 5792 B
   21.97  ← ss2 data (cont.) 2437 B
   21.97  ← ss2 data (cont.) 4344 B
   22.02  ← ss2 data (cont.) 5792 B
   22.02  ss1 → ACK
   22.03  ss1 → ACK
   22.07  ← ss2 data (cont.) 5792 B
   22.12  ← ss2 data (cont.) 5792 B
   22.18  ← ss2 data (cont.) 1687 B
   22.18  ← ss2 data (cont.) 4344 B
   22.18  ss1 → ACK
   22.19  ss1 → ACK
   22.23  ← ss2 data (cont.) 3885 B
   22.23  ← ss2 data (cont.) 2896 B
   22.28  ← ss2 data (cont.) 5792 B
   22.33  ← ss2 data (cont.) 7240 B
   22.34  ss1 → ACK
   22.39  ← ss2 data (cont.) 5792 B
   22.44  ← ss2 data (cont.) 2967 B
   22.44  ← ss2 data (cont.) 2896 B
   22.49  ← ss2 data (cont.) 5333 B
   22.49  ← ss2 data (cont.) 1448 B
   22.52  ss1 → ACK
   22.54  ← ss2 data (cont.) 5792 B
   22.55  ss1 → ACK
   22.59  ← ss2 data (cont.) 5792 B
   22.64  ← ss2 data (cont.) 5792 B
   22.68  ss1 → ACK
   22.70  ← ss2 data (cont.) 5863 B
   22.75  ← ss2 data (cont.) 5792 B
   22.80  ← ss2 data (cont.) 2437 B
   22.80  ← ss2 data (cont.) 4344 B
   22.83  ss1 → ACK
   22.85  ← ss2 data (cont.) 5792 B
   22.86  ss1 → ACK
   22.90  ← ss2 data (cont.) 5792 B
   22.96  ← ss2 data (cont.) 7240 B
   23.01  ss1 → ACK
   23.01  ← ss2 data (cont.) 1519 B
   23.01  ← ss2 data (cont.) 4344 B
   23.02  ss1 → ACK
   23.06  ← ss2 data (cont.) 3885 B
   23.06  ← ss2 data (cont.) 1448 B
   23.11  ← ss2 data (cont.) 5792 B
   23.17  ← ss2 data (cont.) 7240 B
   23.18  ss1 → ACK
   23.22  ← ss2 data (cont.) 5792 B
   23.27  ← ss2 data (cont.) 5792 B
   23.32  ss1 → ACK
   23.32  ← ss2 data (cont.) 6852 B
   23.37  ← ss2 data (cont.) 5792 B
   23.43  ← ss2 data (cont.) 5792 B
   23.47  ss1 → ACK
   23.49  ← ss2 data (cont.) 7240 B
   23.50  ss1 → ACK
   23.53  ← ss2 data (cont.) 5792 B
   23.59  ← ss2 data (cont.) 5792 B
   23.62  ss1 → ACK
   23.64  ← ss2 data (cont.) 1228 B
   23.64  ← ss2 data (cont.) 1448 B
   23.69  ← ss2 data (cont.) 5792 B
   23.74  ← ss2 data (cont.) 5792 B
   23.76  ss1 → ACK
   23.80  ← ss2 data (cont.) 7240 B
   23.85  ← ss2 data (cont.) 4415 B
   23.85  ← ss2 data (cont.) 1448 B
   23.90  ss1 → ACK
   23.90  ← ss2 data (cont.) 5792 B
   23.91  ss1 → ACK
   23.95  ← ss2 data (cont.) 989 B
   23.95  ← ss2 data (cont.) 5792 B
   24.00  ← ss2 data (cont.) 5792 B
   24.05  ss1 → ACK
   24.06  ← ss2 data (cont.) 5792 B
   24.11  ← ss2 data (cont.) 5792 B
   24.16  ← ss2 data (cont.) 1519 B
   24.16  ← ss2 data (cont.) 4344 B
   24.19  ss1 → ACK
   24.21  ← ss2 data (cont.) 3885 B
   24.21  ← ss2 data (cont.) 2896 B
   24.26  ← ss2 data (cont.) 5792 B
   24.32  ← ss2 data (cont.) 5792 B
   24.34  ss1 → ACK
   24.37  ← ss2 data (cont.) 5792 B
   24.38  ss1 → ACK
   24.43  ← ss2 data (cont.) 7240 B
   24.47  ← ss2 data (cont.) 5404 B
   24.49  ss1 → ACK
   24.53  ← ss2 data (cont.) 5792 B
   24.57  ← ss2 data (cont.) 5792 B
   24.63  ss1 → ACK
   24.63  ← ss2 data (cont.) 7240 B
   24.68  ← ss2 data (cont.) 5792 B
   24.73  ← ss2 data (cont.) 5792 B
   24.77  ss1 → ACK
   24.79  ← ss2 data (cont.) 2508 B
   24.79  ← ss2 data (cont.) 2896 B
   24.80  ss1 → ACK
   24.84  ← ss2 data (cont.) 5792 B
   24.89  ← ss2 data (cont.) 7240 B
   24.92  ss1 → ACK
   24.94  ← ss2 data (cont.) 5792 B
   24.99  ← ss2 data (cont.) 5792 B
   25.04  ← ss2 data (cont.) 5404 B
   25.07  ss1 → ACK
   25.10  ← ss2 data (cont.) 7240 B
   25.15  ← ss2 data (cont.) 2570 B
   25.21  ss1 → ACK
   51.04  ← ss2 data 36 B
   51.07  ← ss2 data 105 B
   51.07  ← ss2 data 36 B
   51.12  ← ss2 data 78 B
   51.26  ss1 → ACK
   51.26  ← ss2 data 1540 B
   51.30  ss1 → ACK
   51.37  ← ss2 data 5792 B
   51.43  ← ss2 data (cont.) 2566 B
   51.43  ← ss2 data 36 B
   51.47  ← ss2 data 213 B
```

## reuse, RTT 50 мс — медианный запрос (reused connection, 165.2 мс)

Паузы:
- 26.2 мс: после «ss1 → data (cont.) 7240 B» до «← ss2 ACK»
- 25.0 мс: после «← ss2 ACK» до «← ss2 ACK»
- 36.5 мс: после «ss1 → data (cont.) 842 B» до «← ss2 data 236 B»
- 24.4 мс: после «← ss2 data (cont.) 1202 B» до «← ss2 data (cont.) 1448 B»

```
    0.00  ss1 → data 2996 B
    0.14  ss1 → data (cont.) 7240 B
   26.34  ← ss2 ACK
   51.39  ← ss2 ACK
   51.41  ss1 → data (cont.) 842 B
   87.90  ← ss2 data 236 B
   87.95  ← ss2 data 258 B
   88.01  ← ss2 data 426 B
   88.14  ← ss2 data 36 B
   88.14  ← ss2 data 105 B
   88.23  ← ss2 data 185 B
   88.29  ← ss2 data (cont.) 1448 B
   88.34  ← ss2 data (cont.) 6660 B
   88.39  ← ss2 data (cont.) 2896 B
   88.45  ← ss2 data (cont.) 5333 B
   88.50  ← ss2 data (cont.) 4344 B
   88.55  ← ss2 data (cont.) 3885 B
   88.55  ← ss2 data (cont.) 2896 B
   88.60  ← ss2 data (cont.) 5792 B
   88.65  ← ss2 data (cont.) 5792 B
   88.71  ← ss2 data (cont.) 1978 B
   88.71  ← ss2 data (cont.) 4344 B
   88.76  ← ss2 data (cont.) 3885 B
   88.76  ← ss2 data (cont.) 2896 B
   88.81  ← ss2 data (cont.) 5792 B
   88.88  ← ss2 data (cont.) 5792 B
   88.92  ← ss2 data (cont.) 1978 B
   88.97  ← ss2 data (cont.) 1448 B
   89.02  ← ss2 data (cont.) 5792 B
   89.07  ← ss2 data (cont.) 7240 B
   89.13  ← ss2 data (cont.) 5792 B
   89.18  ← ss2 data (cont.) 5792 B
   89.23  ← ss2 data (cont.) 6852 B
   89.35  ← ss2 data (cont.) 1448 B
   89.40  ← ss2 data (cont.) 5792 B
   89.46  ← ss2 data (cont.) 5792 B
   89.50  ← ss2 data (cont.) 7240 B
   89.55  ← ss2 data (cont.) 5792 B
   89.61  ← ss2 data (cont.) 5792 B
   89.66  ← ss2 data (cont.) 5792 B
   89.71  ← ss2 data (cont.) 5792 B
   89.76  ← ss2 data (cont.) 1789 B
   89.76  ← ss2 data (cont.) 4344 B
   89.82  ← ss2 data (cont.) 7240 B
   89.87  ← ss2 data (cont.) 5792 B
   89.92  ← ss2 data (cont.) 5792 B
   89.97  ← ss2 data (cont.) 5792 B
   90.02  ← ss2 data (cont.) 3956 B
   90.02  ← ss2 data (cont.) 2896 B
   90.08  ← ss2 data (cont.) 5792 B
   90.12  ← ss2 data (cont.) 5792 B
   90.17  ← ss2 data (cont.) 5792 B
   90.23  ← ss2 data (cont.) 7240 B
   90.28  ← ss2 data (cont.) 5792 B
   90.33  ← ss2 data (cont.) 5792 B
   90.38  ← ss2 data (cont.) 2049 B
   90.38  ← ss2 data (cont.) 4344 B
   90.44  ← ss2 data (cont.) 7240 B
   90.49  ← ss2 data (cont.) 4344 B
   90.54  ← ss2 data (cont.) 5792 B
   90.59  ← ss2 data (cont.) 7240 B
   90.64  ← ss2 data (cont.) 5792 B
   90.70  ← ss2 data (cont.) 6393 B
   90.74  ← ss2 data (cont.) 5792 B
   90.80  ← ss2 data (cont.) 5792 B
   90.85  ← ss2 data (cont.) 5792 B
   90.90  ← ss2 data (cont.) 5792 B
   90.95  ← ss2 data (cont.) 5792 B
   91.01  ← ss2 data (cont.) 7240 B
   91.05  ← ss2 data (cont.) 4945 B
   91.11  ← ss2 data (cont.) 5792 B
   91.16  ← ss2 data (cont.) 7240 B
   91.21  ← ss2 data (cont.) 5792 B
   91.26  ← ss2 data (cont.) 5792 B
   91.32  ← ss2 data (cont.) 5792 B
   91.37  ← ss2 data (cont.) 5792 B
   91.42  ← ss2 data (cont.) 3665 B
   91.42  ← ss2 data (cont.) 2896 B
   91.47  ← ss2 data (cont.) 5792 B
   91.53  ← ss2 data (cont.) 5792 B
   91.57  ← ss2 data (cont.) 5792 B
   91.63  ← ss2 data (cont.) 7240 B
   91.68  ← ss2 data (cont.) 5792 B
   91.73  ← ss2 data (cont.) 5792 B
   91.78  ← ss2 data (cont.) 5792 B
   91.83  ← ss2 data (cont.) 5792 B
   91.89  ← ss2 data (cont.) 7240 B
   91.94  ← ss2 data (cont.) 5792 B
   91.99  ← ss2 data (cont.) 1448 B
   91.99  ← ss2 data (cont.) 4344 B
   92.04  ← ss2 data (cont.) 5792 B
   92.09  ← ss2 data (cont.) 5792 B
   92.14  ← ss2 data (cont.) 5792 B
   92.20  ← ss2 data (cont.) 7240 B
   92.25  ← ss2 data (cont.) 5792 B
   92.30  ← ss2 data (cont.) 5792 B
   92.35  ← ss2 data (cont.) 1273 B
   92.36  ← ss2 data (cont.) 4344 B
   92.40  ← ss2 data (cont.) 5792 B
   92.45  ← ss2 data (cont.) 7240 B
   92.50  ← ss2 data (cont.) 5792 B
   92.56  ← ss2 data (cont.) 5792 B
   92.61  ← ss2 data (cont.) 5792 B
   92.66  ← ss2 data (cont.) 6393 B
   92.71  ← ss2 data (cont.) 5792 B
   92.77  ← ss2 data (cont.) 5792 B
   92.82  ← ss2 data (cont.) 5792 B
   92.87  ← ss2 data (cont.) 7240 B
   92.92  ← ss2 data (cont.) 5792 B
   92.98  ← ss2 data (cont.) 5792 B
   93.03  ← ss2 data (cont.) 5792 B
   93.08  ← ss2 data (cont.) 7240 B
   93.13  ← ss2 data (cont.) 5792 B
   93.19  ← ss2 data (cont.) 5792 B
   93.23  ← ss2 data (cont.) 4344 B
   93.23  ← ss2 data (cont.) 1448 B
   93.29  ← ss2 data (cont.) 5792 B
   93.34  ← ss2 data (cont.) 5792 B
   93.39  ← ss2 data (cont.) 7240 B
   93.44  ← ss2 data (cont.) 5792 B
   93.49  ← ss2 data (cont.) 5792 B
   93.55  ← ss2 data (cont.) 5792 B
   93.60  ← ss2 data (cont.) 7240 B
   93.65  ← ss2 data (cont.) 3878 B
   93.65  ← ss2 data (cont.) 1448 B
   93.70  ← ss2 data (cont.) 5792 B
   93.76  ← ss2 data (cont.) 5792 B
   93.81  ← ss2 data (cont.) 7240 B
   93.86  ← ss2 data (cont.) 5792 B
   93.91  ← ss2 data (cont.) 5792 B
   93.96  ← ss2 data (cont.) 5792 B
   94.02  ← ss2 data (cont.) 7240 B
   94.07  ← ss2 data (cont.) 5792 B
   94.12  ← ss2 data (cont.) 5792 B
   94.17  ← ss2 data (cont.) 5792 B
   94.23  ← ss2 data (cont.) 2896 B
   94.23  ← ss2 data (cont.) 2896 B
   94.28  ← ss2 data (cont.) 7240 B
   94.33  ← ss2 data (cont.) 5792 B
   94.38  ← ss2 data (cont.) 5792 B
   94.43  ← ss2 data (cont.) 5792 B
   94.49  ← ss2 data (cont.) 5792 B
   94.54  ← ss2 data (cont.) 7240 B
   94.59  ← ss2 data (cont.) 5792 B
   94.64  ← ss2 data (cont.) 5792 B
   94.70  ← ss2 data (cont.) 5792 B
   94.75  ← ss2 data (cont.) 5792 B
   94.80  ← ss2 data (cont.) 1448 B
   94.80  ← ss2 data (cont.) 5792 B
   94.85  ← ss2 data (cont.) 5792 B
   94.91  ← ss2 data (cont.) 5792 B
   94.95  ← ss2 data (cont.) 5792 B
   95.01  ← ss2 data (cont.) 7240 B
   95.06  ← ss2 data (cont.) 5792 B
   95.12  ← ss2 data (cont.) 5792 B
   95.16  ← ss2 data (cont.) 5792 B
   95.22  ← ss2 data (cont.) 5792 B
   95.27  ← ss2 data (cont.) 7240 B
   95.32  ← ss2 data (cont.) 4344 B
   95.32  ← ss2 data (cont.) 1448 B
   95.37  ← ss2 data (cont.) 5792 B
   95.42  ← ss2 data (cont.) 5792 B
   95.48  ← ss2 data (cont.) 5792 B
   95.53  ← ss2 data (cont.) 7240 B
   95.58  ← ss2 data (cont.) 5792 B
   95.63  ← ss2 data (cont.) 5792 B
   95.69  ← ss2 data (cont.) 5792 B
   95.74  ← ss2 data (cont.) 5792 B
   95.79  ← ss2 data (cont.) 7240 B
   95.84  ← ss2 data (cont.) 5792 B
   95.89  ← ss2 data (cont.) 2896 B
   95.90  ← ss2 data (cont.) 2896 B
   95.95  ← ss2 data (cont.) 5792 B
   96.00  ← ss2 data (cont.) 5792 B
   96.05  ← ss2 data (cont.) 7240 B
   96.10  ← ss2 data (cont.) 5792 B
   96.16  ← ss2 data (cont.) 5792 B
   96.21  ← ss2 data (cont.) 5792 B
   96.26  ← ss2 data (cont.) 5792 B
   96.31  ← ss2 data (cont.) 7240 B
   96.36  ← ss2 data (cont.) 5792 B
   96.42  ← ss2 data (cont.) 5792 B
   96.47  ← ss2 data (cont.) 1448 B
   96.47  ← ss2 data (cont.) 4344 B
   96.52  ← ss2 data (cont.) 7240 B
   96.57  ← ss2 data (cont.) 5792 B
   96.63  ← ss2 data (cont.) 5792 B
   96.68  ← ss2 data (cont.) 5792 B
   96.73  ← ss2 data (cont.) 5792 B
   96.79  ← ss2 data (cont.) 7240 B
   96.84  ← ss2 data (cont.) 5792 B
   96.89  ← ss2 data (cont.) 5792 B
   96.94  ← ss2 data (cont.) 5792 B
   96.99  ← ss2 data (cont.) 5792 B
   97.04  ← ss2 data (cont.) 4344 B
  112.91  ← ss2 data 236 B
  112.96  ← ss2 data 258 B
  113.01  ← ss2 data 426 B
  113.14  ← ss2 data (cont.) 36 B
  113.14  ← ss2 data (cont.) 105 B
  113.24  ← ss2 data 185 B
  113.29  ← ss2 data (cont.) 1448 B
  113.34  ← ss2 data (cont.) 6660 B
  113.40  ← ss2 data (cont.) 2896 B
  113.45  ← ss2 data (cont.) 5333 B
  113.50  ← ss2 data (cont.) 4344 B
  113.55  ← ss2 data (cont.) 3885 B
  113.55  ← ss2 data (cont.) 2896 B
  113.61  ← ss2 data (cont.) 5792 B
  113.66  ← ss2 data (cont.) 5792 B
  113.71  ← ss2 data (cont.) 1978 B
  113.71  ← ss2 data (cont.) 4344 B
  113.76  ← ss2 data (cont.) 3885 B
  113.76  ← ss2 data (cont.) 2896 B
  113.81  ← ss2 data (cont.) 5792 B
  113.88  ← ss2 data (cont.) 5792 B
  113.92  ← ss2 data (cont.) 1978 B
  113.97  ← ss2 data (cont.) 1448 B
  114.03  ← ss2 data (cont.) 5792 B
  114.04  ss1 → ACK
  114.05  ss1 → ACK
  114.08  ← ss2 data (cont.) 7240 B
  114.09  ss1 → ACK
  114.13  ← ss2 data (cont.) 5792 B
  114.14  ss1 → ACK
  114.18  ← ss2 data (cont.) 5792 B
  114.23  ← ss2 data (cont.) 6852 B
  114.28  ss1 → ACK
  114.35  ← ss2 data (cont.) 1448 B
  114.40  ← ss2 data (cont.) 5792 B
  114.46  ← ss2 data (cont.) 5792 B
  114.51  ← ss2 data (cont.) 7240 B
  114.56  ← ss2 data (cont.) 5792 B
  114.61  ← ss2 data (cont.) 5792 B
  114.67  ← ss2 data (cont.) 5792 B
  114.70  ss1 → ACK
  114.72  ← ss2 data (cont.) 5792 B
  114.73  ss1 → ACK
  114.77  ← ss2 data (cont.) 1789 B
  114.77  ← ss2 data (cont.) 4344 B
  114.82  ← ss2 data (cont.) 7240 B
  114.88  ← ss2 data (cont.) 5792 B
  114.92  ← ss2 data (cont.) 5792 B
  114.97  ← ss2 data (cont.) 5792 B
  115.02  ← ss2 data (cont.) 3956 B
  115.03  ← ss2 data (cont.) 2896 B
  115.08  ← ss2 data (cont.) 5792 B
  115.13  ← ss2 data (cont.) 5792 B
  115.18  ← ss2 data (cont.) 5792 B
  115.23  ← ss2 data (cont.) 7240 B
  115.29  ← ss2 data (cont.) 5792 B
  115.33  ← ss2 data (cont.) 5792 B
  115.39  ← ss2 data (cont.) 2049 B
  115.39  ← ss2 data (cont.) 4344 B
  115.45  ← ss2 data (cont.) 7240 B
  115.49  ← ss2 data (cont.) 4344 B
  115.54  ← ss2 data (cont.) 5792 B
  115.59  ← ss2 data (cont.) 7240 B
  115.63  ss1 → ACK
  115.65  ← ss2 data (cont.) 5792 B
  115.70  ← ss2 data (cont.) 6393 B
  115.75  ← ss2 data (cont.) 5792 B
  115.80  ← ss2 data (cont.) 5792 B
  115.81  ss1 → ACK
  115.85  ← ss2 data (cont.) 5792 B
  115.86  ss1 → ACK
  115.91  ← ss2 data (cont.) 5792 B
  115.96  ← ss2 data (cont.) 5792 B
  116.00  ss1 → ACK
  116.01  ← ss2 data (cont.) 7240 B
  116.06  ← ss2 data (cont.) 4945 B
  116.11  ← ss2 data (cont.) 5792 B
  116.16  ss1 → ACK
  116.17  ← ss2 data (cont.) 7240 B
  116.18  ss1 → ACK
  116.21  ← ss2 data (cont.) 5792 B
  116.27  ← ss2 data (cont.) 5792 B
  116.32  ← ss2 data (cont.) 5792 B
  116.35  ss1 → ACK
  116.37  ← ss2 data (cont.) 5792 B
  116.38  ss1 → ACK
  116.42  ← ss2 data (cont.) 3665 B
  116.42  ← ss2 data (cont.) 2896 B
  116.48  ← ss2 data (cont.) 5792 B
  116.52  ss1 → ACK
  116.53  ← ss2 data (cont.) 5792 B
  116.58  ← ss2 data (cont.) 5792 B
  116.63  ← ss2 data (cont.) 7240 B
  116.68  ← ss2 data (cont.) 5792 B
  116.70  ss1 → ACK
  116.73  ← ss2 data (cont.) 5792 B
  116.78  ← ss2 data (cont.) 5792 B
  116.84  ← ss2 data (cont.) 5792 B
  116.86  ss1 → ACK
  116.89  ← ss2 data (cont.) 7240 B
  116.90  ss1 → ACK
  116.94  ← ss2 data (cont.) 5792 B
  116.99  ← ss2 data (cont.) 1448 B
  116.99  ← ss2 data (cont.) 4344 B
  117.05  ← ss2 data (cont.) 5792 B
  117.05  ss1 → ACK
  117.06  ss1 → ACK
  117.09  ← ss2 data (cont.) 5792 B
  117.15  ← ss2 data (cont.) 5792 B
  117.20  ← ss2 data (cont.) 7240 B
  117.22  ss1 → ACK
  117.25  ← ss2 data (cont.) 5792 B
  117.30  ← ss2 data (cont.) 5792 B
  117.36  ← ss2 data (cont.) 1273 B
  117.36  ← ss2 data (cont.) 4344 B
  117.40  ss1 → ACK
  117.41  ← ss2 data (cont.) 5792 B
  117.42  ss1 → ACK
  117.46  ← ss2 data (cont.) 7240 B
  117.51  ← ss2 data (cont.) 5792 B
  117.57  ← ss2 data (cont.) 5792 B
  117.58  ss1 → ACK
  117.61  ← ss2 data (cont.) 5792 B
  117.66  ← ss2 data (cont.) 6393 B
  117.72  ← ss2 data (cont.) 5792 B
  117.74  ss1 → ACK
  117.77  ← ss2 data (cont.) 5792 B
  117.78  ss1 → ACK
  117.82  ← ss2 data (cont.) 5792 B
  117.88  ← ss2 data (cont.) 7240 B
  117.93  ← ss2 data (cont.) 5792 B
  117.93  ss1 → ACK
  117.95  ss1 → ACK
  117.98  ← ss2 data (cont.) 5792 B
  118.03  ← ss2 data (cont.) 5792 B
  118.08  ← ss2 data (cont.) 7240 B
  118.10  ss1 → ACK
  118.13  ← ss2 data (cont.) 5792 B
  118.19  ← ss2 data (cont.) 5792 B
  118.24  ← ss2 data (cont.) 4344 B
  118.24  ← ss2 data (cont.) 1448 B
  118.26  ss1 → ACK
  118.29  ← ss2 data (cont.) 5792 B
  118.34  ← ss2 data (cont.) 5792 B
  118.35  ss1 → ACK
  118.36  ss1 → ACK
  118.40  ← ss2 data (cont.) 7240 B
  118.45  ← ss2 data (cont.) 5792 B
  118.50  ← ss2 data (cont.) 5792 B
  118.53  ss1 → ACK
  118.55  ← ss2 data (cont.) 5792 B
  118.61  ← ss2 data (cont.) 7240 B
  118.65  ← ss2 data (cont.) 3878 B
  118.65  ← ss2 data (cont.) 1448 B
  118.70  ss1 → ACK
  118.71  ← ss2 data (cont.) 5792 B
  118.76  ← ss2 data (cont.) 5792 B
  118.81  ← ss2 data (cont.) 7240 B
  118.85  ss1 → ACK
  118.86  ← ss2 data (cont.) 5792 B
  118.88  ss1 → ACK
  118.92  ← ss2 data (cont.) 5792 B
  118.97  ← ss2 data (cont.) 5792 B
  119.02  ← ss2 data (cont.) 7240 B
  119.04  ss1 → ACK
  119.07  ← ss2 data (cont.) 5792 B
  119.13  ← ss2 data (cont.) 5792 B
  119.18  ← ss2 data (cont.) 5792 B
  119.21  ss1 → ACK
  119.23  ← ss2 data (cont.) 2896 B
  119.23  ← ss2 data (cont.) 2896 B
  119.28  ← ss2 data (cont.) 7240 B
  119.33  ← ss2 data (cont.) 5792 B
  119.38  ss1 → ACK
  119.38  ← ss2 data (cont.) 5792 B
  119.40  ss1 → ACK
  119.44  ← ss2 data (cont.) 5792 B
  119.49  ← ss2 data (cont.) 5792 B
  119.54  ← ss2 data (cont.) 7240 B
  119.56  ss1 → ACK
  119.59  ← ss2 data (cont.) 5792 B
  119.65  ← ss2 data (cont.) 5792 B
  119.70  ← ss2 data (cont.) 5792 B
  119.72  ss1 → ACK
  119.75  ← ss2 data (cont.) 5792 B
  119.80  ← ss2 data (cont.) 1448 B
  119.80  ← ss2 data (cont.) 5792 B
  119.85  ← ss2 data (cont.) 5792 B
  119.90  ss1 → ACK
  119.91  ← ss2 data (cont.) 5792 B
  119.92  ss1 → ACK
  119.96  ← ss2 data (cont.) 5792 B
  120.01  ← ss2 data (cont.) 7240 B
  120.06  ss1 → ACK
  120.06  ← ss2 data (cont.) 5792 B
  120.08  ss1 → ACK
  120.12  ← ss2 data (cont.) 5792 B
  120.17  ← ss2 data (cont.) 5792 B
  120.22  ← ss2 data (cont.) 5792 B
  120.25  ss1 → ACK
  120.27  ← ss2 data (cont.) 7240 B
  120.28  ss1 → ACK
  120.33  ← ss2 data (cont.) 4344 B
  120.33  ← ss2 data (cont.) 1448 B
  120.38  ← ss2 data (cont.) 5792 B
  120.41  ss1 → ACK
  120.43  ← ss2 data (cont.) 5792 B
  120.48  ← ss2 data (cont.) 5792 B
  120.53  ← ss2 data (cont.) 7240 B
  120.57  ss1 → ACK
  120.59  ← ss2 data (cont.) 5792 B
  120.64  ← ss2 data (cont.) 5792 B
  120.69  ← ss2 data (cont.) 5792 B
  120.72  ss1 → ACK
  120.74  ← ss2 data (cont.) 5792 B
  120.75  ss1 → ACK
  120.79  ← ss2 data (cont.) 7240 B
  120.84  ← ss2 data (cont.) 5792 B
  120.89  ss1 → ACK
  120.90  ← ss2 data (cont.) 2896 B
  120.90  ← ss2 data (cont.) 2896 B
  120.95  ← ss2 data (cont.) 5792 B
  121.00  ← ss2 data (cont.) 5792 B
  121.05  ss1 → ACK
  121.06  ← ss2 data (cont.) 7240 B
  121.11  ← ss2 data (cont.) 5792 B
  121.16  ← ss2 data (cont.) 5792 B
  121.20  ss1 → ACK
  121.21  ← ss2 data (cont.) 5792 B
  121.22  ss1 → ACK
  121.26  ← ss2 data (cont.) 5792 B
  121.32  ← ss2 data (cont.) 7240 B
  121.36  ss1 → ACK
  121.37  ← ss2 data (cont.) 5792 B
  121.39  ss1 → ACK
  121.42  ← ss2 data (cont.) 5792 B
  121.47  ← ss2 data (cont.) 1448 B
  121.47  ← ss2 data (cont.) 4344 B
  121.53  ← ss2 data (cont.) 7240 B
  121.54  ss1 → ACK
  121.58  ← ss2 data (cont.) 5792 B
  121.63  ← ss2 data (cont.) 5792 B
  121.68  ← ss2 data (cont.) 5792 B
  121.70  ss1 → ACK
  121.73  ← ss2 data (cont.) 5792 B
  121.74  ss1 → ACK
  121.79  ← ss2 data (cont.) 7240 B
  121.84  ← ss2 data (cont.) 5792 B
  121.86  ss1 → ACK
  121.89  ← ss2 data (cont.) 5792 B
  121.90  ss1 → ACK
  121.94  ← ss2 data (cont.) 5792 B
  122.00  ← ss2 data (cont.) 5792 B
  122.05  ← ss2 data (cont.) 4344 B
  122.06  ss1 → ACK
  139.58  ← ss2 data (cont.) 1448 B
  139.63  ← ss2 data (cont.) 5792 B
  139.68  ← ss2 data (cont.) 7240 B
  139.74  ← ss2 data (cont.) 5792 B
  139.79  ← ss2 data (cont.) 5792 B
  139.84  ← ss2 data (cont.) 5792 B
  139.90  ← ss2 data (cont.) 7240 B
  139.95  ← ss2 data (cont.) 5792 B
  140.00  ← ss2 data (cont.) 5792 B
  140.05  ← ss2 data (cont.) 7240 B
  140.10  ← ss2 data (cont.) 5792 B
  140.16  ← ss2 data (cont.) 1448 B
  140.16  ← ss2 data (cont.) 1202 B
  164.59  ← ss2 data (cont.) 1448 B
  164.64  ← ss2 data (cont.) 5792 B
  164.65  ss1 → ACK
  164.69  ← ss2 data (cont.) 7240 B
  164.75  ← ss2 data (cont.) 5792 B
  164.79  ← ss2 data (cont.) 5792 B
  164.84  ss1 → ACK
  164.85  ← ss2 data (cont.) 5792 B
  164.86  ss1 → ACK
  164.90  ← ss2 data (cont.) 7240 B
  164.95  ← ss2 data (cont.) 5792 B
  165.00  ← ss2 data (cont.) 5792 B
  165.02  ss1 → ACK
  165.06  ← ss2 data (cont.) 7240 B
  165.11  ← ss2 data (cont.) 5792 B
  165.16  ← ss2 data (cont.) 1448 B
  165.16  ← ss2 data (cont.) 1202 B
```
