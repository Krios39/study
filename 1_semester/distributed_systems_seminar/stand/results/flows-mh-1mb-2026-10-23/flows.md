# Обмены ss1 ↔ ss2: full, reuse × RTT 0 / 50 мс, 10 запросов по 1048576 Б

| config | RTT задан | RTT потока (ядро) | соединения | запрос по записи, мс | curl, мс | паузы ≥0.4·RTT | сумма пауз, мс | др. порты |
|---|---|---|---|---|---|---|---|---|
| full | 0 | 3.84 (min 0.23) | new TCP + resumed TLS: 10 | 76.5 | 125.5 | 4 | 57.7 | — |
| full | 50 | 57.03 (min 50.55) | new TCP + resumed TLS: 10 | 520.1 | 589.4 | 18 | 442.8 | — |
| reuse | 0 | 7.06 (min 0.11) | reused connection: 10 | 51.7 | 119.3 | 2 | 39.4 | — |
| reuse | 50 | 57.08 (min 0.11) | reused connection: 10 | 140.1 | 216.5 | 3 | 88.2 | — |

RTT потока — сглаженный rtt сокетов ss1 → ss2:5500 по ядру (ss -tin) во время запросов, в скобках minrtt (у соединений пула — минимум с момента открытия, в т. ч. до смены задержки). В хронологии исходящие пакеты ss1 видны уже после очереди netem (сдвиг на RTT/2), входящие — по приходу. Запрос по записи — от первого пакета запроса до последних данных ответа на канале ss1 ↔ ss2. Пауза — промежуток между соседними пакетами запроса не меньше max(0.4·RTT, 1 мс).

## full, RTT 0 мс — медианный запрос (new TCP + resumed TLS, 76.6 мс)

Паузы:
- 1.9 мс: после «← ss2 ACK» до «← ss2 data (cont.) 1448 B»
- 21.7 мс: после «ss1 → ChangeCipherSpec 6 B» до «ss1 → Finished (enc.) 2896 B»
- 12.0 мс: после «← ss2 ACK» до «← ss2 data 224 B»
- 21.1 мс: после «ss1 → ACK» до «← ss2 data 31 B»

```
    0.00  ss1 → SYN
    0.12  ← ss2 SYN-ACK
    0.14  ss1 → ACK
    0.56  ss1 → ClientHello 2800 B
    0.71  ← ss2 ACK
    2.64  ← ss2 data (cont.) 1448 B
    2.65  ss1 → ACK
    2.70  ← ss2 data (cont.) 1212 B
    2.70  ← ss2 ChangeCipherSpec 51 B
    2.71  ss1 → ACK
    2.71  ss1 → ACK
    3.25  ss1 → ChangeCipherSpec 6 B
   24.91  ss1 → Finished (enc.) 2896 B
   25.00  ss1 → data (cont.) 7240 B
   25.11  ← ss2 ACK
   25.12  ss1 → data (cont.) 987 B
   25.21  ← ss2 ACK
   25.33  ← ss2 ACK
   37.38  ← ss2 data 224 B
   37.43  ← ss2 data 63 B
   37.48  ← ss2 data 31 B
   37.48  ← ss2 data 75 B
   37.53  ← ss2 data 481 B
   37.70  ← ss2 data 31 B
   37.75  ← ss2 data 31 B
   37.75  ← ss2 data 63 B
   37.81  ← ss2 data 164 B
   38.15  ← ss2 data (cont.) 1448 B
   38.16  ss1 → ACK
   38.29  ← ss2 data (cont.) 1448 B
   38.35  ← ss2 data (cont.) 5792 B
   38.39  ss1 → ACK
   38.40  ← ss2 data (cont.) 7240 B
   38.42  ss1 → ACK
   38.46  ← ss2 data (cont.) 5792 B
   38.50  ← ss2 data (cont.) 5792 B
   38.56  ← ss2 data (cont.) 2896 B
   38.56  ← ss2 data (cont.) 4344 B
   38.61  ← ss2 data (cont.) 5792 B
   38.66  ← ss2 data (cont.) 4344 B
   38.66  ← ss2 data (cont.) 1448 B
   38.71  ← ss2 data (cont.) 5792 B
   38.77  ← ss2 data (cont.) 5792 B
   38.82  ← ss2 data (cont.) 1448 B
   39.04  ss1 → ACK
   39.17  ← ss2 data (cont.) 1448 B
   39.22  ← ss2 data (cont.) 5792 B
   39.23  ss1 → ACK
   39.27  ← ss2 data (cont.) 7240 B
   39.31  ss1 → ACK
   39.33  ← ss2 data (cont.) 5792 B
   39.38  ← ss2 data (cont.) 5792 B
   39.43  ← ss2 data (cont.) 6704 B
   39.46  ss1 → ACK
   39.48  ← ss2 data (cont.) 5792 B
   39.54  ← ss2 data (cont.) 5792 B
   39.59  ← ss2 data (cont.) 7240 B
   39.60  ss1 → ACK
   39.61  ss1 → ACK
   39.64  ← ss2 data (cont.) 3776 B
   39.74  ← ss2 data (cont.) 1448 B
   39.75  ss1 → ACK
   39.79  ← ss2 data (cont.) 1944 B
   39.79  ← ss2 data (cont.) 4344 B
   39.84  ← ss2 data (cont.) 5792 B
   39.89  ss1 → ACK
   39.89  ← ss2 data (cont.) 5792 B
   39.94  ← ss2 data (cont.) 5576 B
   40.02  ss1 → ACK
   40.05  ss1 → ACK
   40.20  ← ss2 data (cont.) 1448 B
   40.25  ← ss2 data (cont.) 5792 B
   40.30  ss1 → ACK
   40.31  ← ss2 data (cont.) 7240 B
   40.35  ← ss2 data (cont.) 4976 B
   40.44  ss1 → ACK
   40.45  ss1 → ACK
   40.56  ← ss2 data (cont.) 2048 B
   40.57  ← ss2 data (cont.) 1448 B
   40.62  ← ss2 data (cont.) 5792 B
   40.67  ← ss2 data (cont.) 5792 B
   40.70  ss1 → ACK
   40.72  ← ss2 data (cont.) 5792 B
   40.77  ← ss2 data (cont.) 3704 B
   40.85  ss1 → ACK
   40.86  ss1 → ACK
   40.98  ← ss2 data (cont.) 1448 B
   41.03  ← ss2 data (cont.) 5792 B
   41.08  ← ss2 data (cont.) 5792 B
   41.11  ss1 → ACK
   41.14  ← ss2 data (cont.) 7240 B
   41.19  ss1 → ACK
   41.19  ← ss2 data (cont.) 3280 B
   41.20  ss1 → ACK
   41.30  ← ss2 data (cont.) 1840 B
   41.33  ss1 → ACK
   41.36  ← ss2 data (cont.) 5792 B
   41.41  ← ss2 data (cont.) 5792 B
   41.46  ← ss2 data (cont.) 7240 B
   41.47  ss1 → ACK
   41.48  ss1 → ACK
   41.52  ← ss2 data (cont.) 3912 B
   41.62  ss1 → ACK
   41.63  ss1 → ACK
   41.75  ← ss2 data (cont.) 2048 B
   41.75  ← ss2 data (cont.) 1448 B
   41.78  ss1 → ACK
   41.80  ← ss2 data (cont.) 5792 B
   41.82  ss1 → ACK
   41.86  ← ss2 data 5792 B
   41.90  ← ss2 data (cont.) 5792 B
   41.96  ← ss2 data (cont.) 1656 B
   41.98  ss1 → ACK
   42.09  ← ss2 data (cont.) 2048 B
   42.11  ss1 → ACK
   42.12  ss1 → ACK
   42.23  ← ss2 data (cont.) 1448 B
   42.29  ← ss2 data (cont.) 5792 B
   42.34  ← ss2 data (cont.) 7240 B
   42.37  ss1 → ACK
   42.38  ss1 → ACK
   42.39  ← ss2 data (cont.) 3952 B
   42.50  ← ss2 data (cont.) 1448 B
   42.51  ss1 → ACK
   42.55  ← ss2 data (cont.) 5792 B
   42.60  ← ss2 data (cont.) 5792 B
   42.64  ss1 → ACK
   42.66  ← ss2 data (cont.) 7240 B
   42.71  ← ss2 data (cont.) 4448 B
   42.78  ss1 → ACK
   42.79  ss1 → ACK
   42.90  ← ss2 data (cont.) 2048 B
   42.92  ss1 → ACK
   42.96  ← ss2 data (cont.) 7240 B
   43.01  ← ss2 data (cont.) 5792 B
   43.04  ss1 → ACK
   43.06  ← ss2 data (cont.) 5792 B
   43.11  ← ss2 data (cont.) 4728 B
   43.17  ss1 → ACK
   43.19  ss1 → ACK
   43.31  ← ss2 data (cont.) 1448 B
   43.36  ← ss2 data (cont.) 5792 B
   43.42  ← ss2 data (cont.) 5792 B
   43.44  ss1 → ACK
   43.47  ← ss2 data (cont.) 7240 B
   43.52  ← ss2 data (cont.) 3280 B
   43.57  ss1 → ACK
   43.58  ss1 → ACK
   43.70  ← ss2 data (cont.) 2048 B
   43.71  ss1 → ACK
   43.79  ← ss2 data (cont.) 10136 B
   43.80  ← ss2 data (cont.) 2896 B
   43.86  ss1 → ACK
   43.87  ss1 → ACK
   44.07  ← ss2 data (cont.) 8472 B
   44.07  ← ss2 data (cont.) 8688 B
   44.12  ss1 → ACK
   44.18  ← ss2 data (cont.) 8440 B
   44.25  ss1 → ACK
   44.26  ss1 → ACK
   44.44  ← ss2 data (cont.) 2048 B
   44.44  ← ss2 data (cont.) 8688 B
   44.49  ss1 → ACK
   44.62  ss1 → ACK
   44.70  ← ss2 data (cont.) 11792 B
   44.75  ss1 → ACK
   44.95  ← ss2 data (cont.) 23024 B
   44.99  ss1 → ACK
   45.21  ← ss2 data (cont.) 13032 B
   45.23  ss1 → ACK
   45.36  ss1 → ACK
   45.47  ← ss2 data (cont.) 8472 B
   45.49  ss1 → ACK
   45.74  ← ss2 data (cont.) 24296 B
   45.75  ss1 → ACK
   45.98  ← ss2 data (cont.) 14480 B
   46.00  ss1 → ACK
   46.01  ss1 → ACK
   46.24  ← ss2 data (cont.) 10096 B
   46.24  ← ss2 data (cont.) 11584 B
   46.26  ss1 → ACK
   46.39  ss1 → ACK
   46.49  ← ss2 data (cont.) 11088 B
   46.52  ss1 → ACK
   46.75  ← ss2 data (cont.) 21680 B
   46.78  ss1 → ACK
   46.79  ss1 → ACK
   47.01  ← ss2 data (cont.) 13032 B
   47.03  ss1 → ACK
   47.17  ss1 → ACK
   47.26  ← ss2 data (cont.) 11544 B
   47.27  ss1 → ACK
   47.52  ← ss2 data (cont.) 23272 B
   47.66  ss1 → ACK
   47.77  ← ss2 data (cont.) 1448 B
   48.03  ← ss2 data (cont.) 23128 B
   48.06  ss1 → ACK
   48.20  ss1 → ACK
   48.40  ← ss2 data (cont.) 21504 B
   48.42  ← ss2 data (cont.) 7240 B
   48.44  ss1 → ACK
   48.57  ss1 → ACK
   48.66  ← ss2 data (cont.) 15288 B
   48.70  ss1 → ACK
   48.92  ← ss2 data (cont.) 23624 B
   48.95  ss1 → ACK
   48.96  ss1 → ACK
   49.17  ← ss2 data (cont.) 8688 B
   49.21  ss1 → ACK
   49.34  ss1 → ACK
   49.43  ← ss2 data (cont.) 15888 B
   49.47  ss1 → ACK
   49.69  ← ss2 data (cont.) 19952 B
   49.70  ss1 → ACK
   49.70  ← ss2 data (cont.) 2576 B
   49.72  ss1 → ACK
   49.94  ← ss2 data (cont.) 14480 B
   49.97  ss1 → ACK
   49.98  ss1 → ACK
   50.20  ← ss2 data (cont.) 7520 B
   50.20  ← ss2 data (cont.) 13032 B
   50.21  ss1 → ACK
   50.23  ss1 → ACK
   50.34  ss1 → ACK
   50.45  ← ss2 data (cont.) 10168 B
   50.47  ss1 → ACK
   50.71  ← ss2 data (cont.) 23624 B
   50.83  ss1 → ACK
   51.18  ss1 → ACK
   51.22  ← ss2 data (cont.) 22528 B
   51.31  ss1 → ACK
   51.48  ← ss2 data (cont.) 18824 B
   51.55  ss1 → ACK
   51.73  ← ss2 data (cont.) 14968 B
   51.74  ss1 → ACK
   51.76  ← ss2 data (cont.) 12680 B
   51.81  ss1 → ACK
   51.99  ← ss2 data (cont.) 14480 B
   52.05  ss1 → ACK
   52.06  ss1 → ACK
   52.25  ← ss2 data (cont.) 7656 B
   52.25  ← ss2 data (cont.) 7240 B
   52.30  ss1 → ACK
   52.43  ss1 → ACK
   52.50  ← ss2 data (cont.) 15824 B
   52.56  ss1 → ACK
   52.76  ← ss2 data (cont.) 17968 B
   52.77  ← ss2 data (cont.) 1488 B
   52.81  ss1 → ACK
   53.01  ← ss2 data (cont.) 10136 B
   53.02  ss1 → ACK
   53.16  ss1 → ACK
   53.27  ← ss2 data (cont.) 5224 B
   53.27  ← ss2 data (cont.) 12184 B
   53.41  ss1 → ACK
   53.53  ← ss2 data (cont.) 20480 B
   53.54  ss1 → ACK
   53.78  ← ss2 data (cont.) 14480 B
   53.80  ss1 → ACK
   54.04  ← ss2 data (cont.) 8048 B
   54.05  ← ss2 data (cont.) 17376 B
   54.06  ss1 → ACK
   54.17  ss1 → ACK
   54.18  ss1 → ACK
   54.29  ← ss2 data (cont.) 3248 B
   54.29  ← ss2 data (cont.) 1448 B
   54.42  ss1 → ACK
   54.55  ← ss2 data (cont.) 9640 B
   54.55  ← ss2 data (cont.) 10786 B
   54.56  ss1 → ACK
   54.67  ss1 → ACK
   55.16  ss1 → ACK
   76.30  ← ss2 data 31 B
   76.41  ← ss2 data 31 B
   76.41  ← ss2 data 63 B
   76.41  ← ss2 data 165 B
   76.41  ← ss2 data 438 B
   76.49  ← ss2 data 221 B
   76.49  ← ss2 data 758 B
   76.49  ← ss2 data 156 B
   76.51  ss1 → ACK
   76.54  ← ss2 data 1448 B
   76.58  ss1 → ACK
   76.60  ← ss2 data (cont.) 6709 B
   76.60  ← ss2 data 187 B
   76.62  ss1 → ACK
   76.65  ← ss2 data (cont.) 31 B
```

## full, RTT 50 мс — медианный запрос (new TCP + resumed TLS, 520.5 мс)

Паузы:
- 25.7 мс: после «ss1 → SYN» до «← ss2 SYN-ACK»
- 25.1 мс: после «← ss2 SYN-ACK» до «ss1 → ACK»
- 25.2 мс: после «ss1 → ClientHello 2800 B» до «← ss2 ACK»
- 25.0 мс: после «← ss2 Finished (enc.) 45 B» до «ss1 → ACK»
- 26.1 мс: после «ss1 → data (cont.) 1448 B» до «← ss2 ACK»
- 25.1 мс: после «← ss2 ACK» до «ss1 → data (cont.) 987 B»
- 25.5 мс: после «← ss2 data 63 B» до «ss1 → ACK»
- 25.8 мс: после «ss1 → ACK» до «← ss2 data 2896 B»
- 24.8 мс: после «← ss2 data (cont.) 2896 B» до «ss1 → ACK»
- 25.2 мс: после «ss1 → ACK» до «← ss2 data (cont.) 2896 B»
- 24.5 мс: после «← ss2 data (cont.) 2896 B» до «ss1 → ACK»
- 25.2 мс: после «ss1 → ACK» до «← ss2 data (cont.) 2896 B»
- 24.1 мс: после «← ss2 data (cont.) 2896 B» до «ss1 → ACK»
- 25.1 мс: после «ss1 → ACK» до «← ss2 data (cont.) 1448 B»
- 23.2 мс: после «← ss2 data (cont.) 2464 B» до «ss1 → ACK»
- 23.8 мс: после «ss1 → ACK» до «← ss2 data (cont.) 5792 B»
- 21.1 мс: после «← ss2 data (cont.) 10136 B» до «ss1 → ACK»
- 21.4 мс: после «ss1 → ACK» до «← ss2 data (cont.) 1448 B»

```
    0.00  ss1 → SYN
   25.70  ← ss2 SYN-ACK
   50.75  ss1 → ACK
   51.37  ss1 → ClientHello 2800 B
   76.59  ← ss2 ACK
   79.56  ← ss2 TLS hs 2+4 2660 B
   79.56  ← ss2 ChangeCipherSpec 6 B
   79.56  ← ss2 Finished (enc.) 45 B
  104.58  ss1 → ACK
  104.59  ss1 → ACK
  104.59  ss1 → ACK
  104.96  ss1 → ChangeCipherSpec 6 B
  123.49  ss1 → Finished (enc.) 2896 B
  123.54  ss1 → data (cont.) 2896 B
  123.54  ss1 → data (cont.) 2896 B
  123.54  ss1 → data (cont.) 1448 B
  149.65  ← ss2 ACK
  149.65  ← ss2 ACK
  149.65  ← ss2 ACK
  174.71  ss1 → data (cont.) 987 B
  191.87  ← ss2 ACK
  200.71  ← ss2 ACK
  213.73  ← ss2 data 224 B
  213.73  ← ss2 data 63 B
  213.73  ← ss2 data 31 B
  213.73  ← ss2 data 75 B
  213.73  ← ss2 data 31 B
  213.73  ← ss2 data 31 B
  213.78  ← ss2 data 419 B
  213.78  ← ss2 data 31 B
  213.78  ← ss2 data 31 B
  213.78  ← ss2 data 63 B
  239.31  ss1 → ACK
  265.16  ← ss2 data 2896 B
  265.16  ← ss2 data (cont.) 2896 B
  265.21  ← ss2 data (cont.) 2896 B
  265.21  ← ss2 data (cont.) 2896 B
  265.26  ← ss2 data (cont.) 2896 B
  265.26  ← ss2 data (cont.) 2896 B
  265.31  ← ss2 data (cont.) 2896 B
  265.31  ← ss2 data (cont.) 2896 B
  265.37  ← ss2 data (cont.) 2896 B
  265.37  ← ss2 data (cont.) 2896 B
  290.18  ss1 → ACK
  290.20  ss1 → ACK
  290.35  ss1 → ACK
  290.38  ss1 → ACK
  315.60  ← ss2 data (cont.) 2896 B
  315.60  ← ss2 data (cont.) 2896 B
  315.65  ← ss2 data (cont.) 2896 B
  315.65  ← ss2 data (cont.) 2896 B
  315.83  ← ss2 data (cont.) 2896 B
  315.83  ← ss2 data (cont.) 2896 B
  315.88  ← ss2 data (cont.) 2896 B
  315.88  ← ss2 data (cont.) 2896 B
  315.93  ← ss2 data (cont.) 2896 B
  315.93  ← ss2 data (cont.) 2896 B
  315.98  ← ss2 data (cont.) 2896 B
  315.98  ← ss2 data (cont.) 2896 B
  315.98  ← ss2 data (cont.) 1448 B
  316.03  ← ss2 data (cont.) 1448 B
  316.03  ← ss2 data (cont.) 2896 B
  316.03  ← ss2 data (cont.) 1448 B
  316.09  ← ss2 data (cont.) 1448 B
  316.09  ← ss2 data (cont.) 2896 B
  316.09  ← ss2 data (cont.) 1448 B
  316.14  ← ss2 data (cont.) 1448 B
  316.14  ← ss2 data (cont.) 2896 B
  316.14  ← ss2 data (cont.) 1448 B
  316.19  ← ss2 data (cont.) 1448 B
  316.19  ← ss2 data (cont.) 2896 B
  340.66  ss1 → ACK
  340.66  ss1 → ACK
  340.66  ss1 → ACK
  340.66  ss1 → ACK
  340.84  ss1 → ACK
  340.85  ss1 → ACK
  340.89  ss1 → ACK
  340.89  ss1 → ACK
  340.94  ss1 → ACK
  340.94  ss1 → ACK
  341.00  ss1 → ACK
  341.04  ss1 → ACK
  341.09  ss1 → ACK
  341.10  ss1 → ACK
  341.15  ss1 → ACK
  341.15  ss1 → ACK
  341.22  ss1 → ACK
  366.38  ← ss2 data (cont.) 2896 B
  366.38  ← ss2 data (cont.) 2896 B
  366.43  ← ss2 data (cont.) 2896 B
  366.43  ← ss2 data (cont.) 2896 B
  366.49  ← ss2 data (cont.) 2896 B
  366.49  ← ss2 data (cont.) 2896 B
  366.54  ← ss2 data (cont.) 2896 B
  366.54  ← ss2 data (cont.) 2896 B
  366.54  ← ss2 data (cont.) 1448 B
  366.59  ← ss2 data (cont.) 1448 B
  366.59  ← ss2 data (cont.) 2896 B
  366.59  ← ss2 data (cont.) 1448 B
  366.64  ← ss2 data (cont.) 1448 B
  366.64  ← ss2 data (cont.) 2896 B
  366.64  ← ss2 data (cont.) 1448 B
  366.69  ← ss2 data (cont.) 1448 B
  366.69  ← ss2 data (cont.) 2896 B
  366.69  ← ss2 data (cont.) 1448 B
  366.74  ← ss2 data (cont.) 1448 B
  366.74  ← ss2 data (cont.) 2896 B
  366.74  ← ss2 data (cont.) 1448 B
  366.80  ← ss2 data (cont.) 1448 B
  366.80  ← ss2 data (cont.) 2896 B
  366.80  ← ss2 data (cont.) 2896 B
  366.85  ← ss2 data (cont.) 2896 B
  366.85  ← ss2 data (cont.) 2896 B
  366.90  ← ss2 data (cont.) 2896 B
  366.90  ← ss2 data (cont.) 2896 B
  366.95  ← ss2 data (cont.) 2896 B
  366.95  ← ss2 data (cont.) 2896 B
  367.00  ← ss2 data (cont.) 2896 B
  367.01  ← ss2 data (cont.) 2896 B
  367.01  ← ss2 data (cont.) 1448 B
  367.05  ← ss2 data (cont.) 1448 B
  367.05  ← ss2 data (cont.) 2896 B
  367.05  ← ss2 data (cont.) 1448 B
  367.11  ← ss2 data (cont.) 1448 B
  367.11  ← ss2 data (cont.) 2896 B
  367.11  ← ss2 data (cont.) 1448 B
  367.16  ← ss2 data (cont.) 1448 B
  367.16  ← ss2 data (cont.) 2896 B
  367.16  ← ss2 data (cont.) 1448 B
  367.21  ← ss2 data (cont.) 1448 B
  367.21  ← ss2 data (cont.) 2896 B
  367.21  ← ss2 data (cont.) 1448 B
  367.26  ← ss2 data (cont.) 1448 B
  367.26  ← ss2 data (cont.) 4344 B
  367.26  ← ss2 data (cont.) 1448 B
  367.31  ← ss2 data (cont.) 2896 B
  367.31  ← ss2 data (cont.) 2896 B
  391.44  ss1 → ACK
  391.44  ss1 → ACK
  391.45  ss1 → ACK
  391.45  ss1 → ACK
  391.49  ss1 → ACK
  391.50  ss1 → ACK
  391.55  ss1 → ACK
  391.60  ss1 → ACK
  391.65  ss1 → ACK
  391.65  ss1 → ACK
  391.70  ss1 → ACK
  391.70  ss1 → ACK
  391.76  ss1 → ACK
  391.80  ss1 → ACK
  391.80  ss1 → ACK
  391.86  ss1 → ACK
  391.95  ss1 → ACK
  391.96  ss1 → ACK
  392.10  ss1 → ACK
  392.15  ss1 → ACK
  392.17  ss1 → ACK
  392.25  ss1 → ACK
  392.36  ss1 → ACK
  417.49  ← ss2 data (cont.) 1448 B
  417.54  ← ss2 data (cont.) 2896 B
  417.54  ← ss2 data (cont.) 2896 B
  417.59  ← ss2 data (cont.) 1448 B
  417.59  ← ss2 data (cont.) 4344 B
  417.65  ← ss2 data (cont.) 4344 B
  417.65  ← ss2 data (cont.) 2896 B
  417.70  ← ss2 data (cont.) 1448 B
  417.70  ← ss2 data (cont.) 4344 B
  417.75  ← ss2 data (cont.) 4344 B
  417.75  ← ss2 data (cont.) 1448 B
  417.80  ← ss2 data (cont.) 2896 B
  417.80  ← ss2 data (cont.) 2896 B
  417.85  ← ss2 data (cont.) 1448 B
  417.85  ← ss2 data (cont.) 4344 B
  417.85  ← ss2 data (cont.) 1448 B
  417.90  ← ss2 data (cont.) 2896 B
  417.90  ← ss2 data (cont.) 2896 B
  417.96  ← ss2 data (cont.) 1448 B
  417.96  ← ss2 data (cont.) 4344 B
  418.01  ← ss2 data (cont.) 4344 B
  418.01  ← ss2 data (cont.) 1448 B
  418.07  ← ss2 data (cont.) 4344 B
  418.07  ← ss2 data (cont.) 2896 B
  418.11  ← ss2 data (cont.) 2896 B
  418.11  ← ss2 data (cont.) 2896 B
  418.16  ← ss2 data (cont.) 2896 B
  418.16  ← ss2 data (cont.) 2896 B
  418.21  ← ss2 data (cont.) 2896 B
  418.22  ← ss2 data (cont.) 2896 B
  418.27  ← ss2 data (cont.) 2896 B
  418.27  ← ss2 data (cont.) 2896 B
  418.32  ← ss2 data (cont.) 2896 B
  418.32  ← ss2 data (cont.) 4344 B
  418.37  ← ss2 data (cont.) 1448 B
  418.37  ← ss2 data (cont.) 4344 B
  418.42  ← ss2 data (cont.) 1448 B
  418.42  ← ss2 data (cont.) 4344 B
  418.48  ← ss2 data (cont.) 1448 B
  418.48  ← ss2 data (cont.) 4344 B
  418.53  ← ss2 data (cont.) 1448 B
  418.53  ← ss2 data (cont.) 5792 B
  418.58  ← ss2 data (cont.) 5792 B
  418.63  ← ss2 data (cont.) 5792 B
  418.69  ← ss2 data (cont.) 5792 B
  418.74  ← ss2 data (cont.) 5792 B
  418.79  ← ss2 data (cont.) 1448 B
  418.79  ← ss2 data (cont.) 5792 B
  418.84  ← ss2 data (cont.) 1448 B
  418.84  ← ss2 data (cont.) 4344 B
  418.89  ← ss2 data (cont.) 2896 B
  418.89  ← ss2 data (cont.) 2896 B
  418.95  ← ss2 data (cont.) 4344 B
  418.95  ← ss2 data (cont.) 1448 B
  418.99  ← ss2 data (cont.) 5792 B
  419.05  ← ss2 data (cont.) 7240 B
  419.10  ← ss2 data (cont.) 5792 B
  419.16  ← ss2 data (cont.) 1448 B
  419.16  ← ss2 data (cont.) 4344 B
  419.21  ← ss2 data (cont.) 2896 B
  419.21  ← ss2 data (cont.) 4344 B
  419.26  ← ss2 data (cont.) 4344 B
  419.26  ← ss2 data (cont.) 1448 B
  419.31  ← ss2 data (cont.) 5792 B
  419.37  ← ss2 data (cont.) 1448 B
  419.37  ← ss2 data (cont.) 4344 B
  419.42  ← ss2 data (cont.) 4344 B
  419.42  ← ss2 data (cont.) 2464 B
  442.60  ss1 → ACK
  442.60  ss1 → ACK
  442.60  ss1 → ACK
  442.66  ss1 → ACK
  442.66  ss1 → ACK
  442.71  ss1 → ACK
  442.76  ss1 → ACK
  442.81  ss1 → ACK
  442.87  ss1 → ACK
  442.91  ss1 → ACK
  442.91  ss1 → ACK
  442.97  ss1 → ACK
  443.02  ss1 → ACK
  443.07  ss1 → ACK
  443.08  ss1 → ACK
  443.12  ss1 → ACK
  443.13  ss1 → ACK
  443.17  ss1 → ACK
  443.18  ss1 → ACK
  443.22  ss1 → ACK
  443.23  ss1 → ACK
  443.28  ss1 → ACK
  443.28  ss1 → ACK
  443.33  ss1 → ACK
  443.34  ss1 → ACK
  443.38  ss1 → ACK
  443.43  ss1 → ACK
  443.49  ss1 → ACK
  443.54  ss1 → ACK
  443.59  ss1 → ACK
  443.65  ss1 → ACK
  443.69  ss1 → ACK
  443.74  ss1 → ACK
  443.80  ss1 → ACK
  443.85  ss1 → ACK
  443.90  ss1 → ACK
  443.90  ss1 → ACK
  443.96  ss1 → ACK
  444.00  ss1 → ACK
  444.06  ss1 → ACK
  444.11  ss1 → ACK
  444.17  ss1 → ACK
  444.22  ss1 → ACK
  444.22  ss1 → ACK
  444.27  ss1 → ACK
  444.32  ss1 → ACK
  444.38  ss1 → ACK
  444.43  ss1 → ACK
  444.43  ss1 → ACK
  468.25  ← ss2 data (cont.) 5792 B
  468.34  ← ss2 data (cont.) 2896 B
  468.34  ← ss2 data (cont.) 7240 B
  468.43  ← ss2 data (cont.) 1448 B
  468.43  ← ss2 data (cont.) 8688 B
  468.72  ← ss2 data (cont.) 8688 B
  468.72  ← ss2 data (cont.) 8688 B
  468.74  ← ss2 data (cont.) 8688 B
  468.74  ← ss2 data (cont.) 8688 B
  468.75  ← ss2 data (cont.) 4344 B
  469.00  ← ss2 data (cont.) 5792 B
  469.00  ← ss2 data (cont.) 10136 B
  469.03  ← ss2 data (cont.) 10136 B
  469.03  ← ss2 data (cont.) 7240 B
  469.30  ← ss2 data (cont.) 10136 B
  469.30  ← ss2 data (cont.) 10136 B
  469.33  ← ss2 data (cont.) 10136 B
  469.34  ← ss2 data (cont.) 5792 B
  469.58  ← ss2 data (cont.) 4344 B
  469.58  ← ss2 data (cont.) 11584 B
  469.61  ← ss2 data (cont.) 11584 B
  469.61  ← ss2 data (cont.) 2896 B
  469.61  ← ss2 data (cont.) 1448 B
  469.84  ← ss2 data (cont.) 10136 B
  469.84  ← ss2 data (cont.) 11584 B
  469.86  ← ss2 data (cont.) 7240 B
  470.09  ← ss2 data (cont.) 4344 B
  470.09  ← ss2 data (cont.) 11584 B
  470.11  ← ss2 data (cont.) 13032 B
  470.34  ← ss2 data (cont.) 13032 B
  470.35  ← ss2 data (cont.) 13032 B
  470.36  ← ss2 data (cont.) 2896 B
  470.60  ← ss2 data (cont.) 10136 B
  470.60  ← ss2 data (cont.) 13032 B
  470.62  ← ss2 data (cont.) 7240 B
  470.85  ← ss2 data (cont.) 5792 B
  470.85  ← ss2 data (cont.) 8688 B
  470.86  ← ss2 data (cont.) 14480 B
  471.10  ← ss2 data (cont.) 14480 B
  471.11  ← ss2 data (cont.) 14480 B
  471.35  ← ss2 data (cont.) 14480 B
  471.36  ← ss2 data (cont.) 2896 B
  471.36  ← ss2 data (cont.) 11584 B
  471.61  ← ss2 data (cont.) 2896 B
  471.61  ← ss2 data (cont.) 15928 B
  471.62  ← ss2 data (cont.) 11584 B
  471.86  ← ss2 data (cont.) 4344 B
  471.86  ← ss2 data (cont.) 15928 B
  471.87  ← ss2 data (cont.) 8688 B
  472.11  ← ss2 data (cont.) 4344 B
  472.11  ← ss2 data (cont.) 15928 B
  472.13  ← ss2 data (cont.) 10136 B
  493.26  ss1 → ACK
  493.35  ss1 → ACK
  493.36  ss1 → ACK
  493.44  ss1 → ACK
  493.73  ss1 → ACK
  493.73  ss1 → ACK
  493.75  ss1 → ACK
  493.75  ss1 → ACK
  493.76  ss1 → ACK
  494.02  ss1 → ACK
  494.02  ss1 → ACK
  494.03  ss1 → ACK
  494.03  ss1 → ACK
  494.31  ss1 → ACK
  494.31  ss1 → ACK
  494.33  ss1 → ACK
  494.34  ss1 → ACK
  494.60  ss1 → ACK
  494.60  ss1 → ACK
  494.61  ss1 → ACK
  494.62  ss1 → ACK
  494.85  ss1 → ACK
  494.86  ss1 → ACK
  494.86  ss1 → ACK
  495.10  ss1 → ACK
  495.10  ss1 → ACK
  495.12  ss1 → ACK
  495.35  ss1 → ACK
  495.36  ss1 → ACK
  495.36  ss1 → ACK
  495.61  ss1 → ACK
  495.61  ss1 → ACK
  495.62  ss1 → ACK
  495.85  ss1 → ACK
  495.90  ss1 → ACK
  496.11  ss1 → ACK
  496.17  ss1 → ACK
  496.42  ss1 → ACK
  496.61  ss1 → ACK
  496.70  ss1 → ACK
  496.86  ss1 → ACK
  496.88  ss1 → ACK
  497.12  ss1 → ACK
  497.15  ss1 → ACK
  518.50  ← ss2 data (cont.) 1448 B
  518.58  ← ss2 data (cont.) 8688 B
  518.63  ← ss2 data (cont.) 1448 B
  519.14  ← ss2 data (cont.) 1448 B
  519.19  ← ss2 data (cont.) 5792 B
  519.24  ← ss2 data (cont.) 5792 B
  519.30  ← ss2 data (cont.) 4344 B
  519.30  ← ss2 data (cont.) 2896 B
  519.35  ← ss2 data (cont.) 5792 B
  519.40  ← ss2 data (cont.) 5792 B
  519.45  ← ss2 data (cont.) 2896 B
  519.45  ← ss2 data (cont.) 2896 B
  519.50  ← ss2 data (cont.) 5792 B
  519.56  ← ss2 data (cont.) 7240 B
  519.61  ← ss2 data (cont.) 2896 B
  519.61  ← ss2 data (cont.) 2896 B
  519.66  ← ss2 data (cont.) 5792 B
  519.71  ← ss2 data (cont.) 5792 B
  519.76  ← ss2 data (cont.) 4344 B
  519.76  ← ss2 data (cont.) 2896 B
  519.81  ← ss2 data (cont.) 5792 B
  519.87  ← ss2 data (cont.) 5792 B
  519.92  ← ss2 data (cont.) 4344 B
  519.92  ← ss2 data (cont.) 1448 B
  519.97  ← ss2 data (cont.) 7240 B
  520.02  ← ss2 data (cont.) 5792 B
  520.08  ← ss2 data (cont.) 4344 B
  520.08  ← ss2 data (cont.) 1448 B
  520.13  ← ss2 data (cont.) 5792 B
  520.18  ← ss2 data (cont.) 7240 B
  520.23  ← ss2 data (cont.) 5792 B
  520.28  ← ss2 data (cont.) 5792 B
  520.33  ← ss2 data (cont.) 5792 B
  520.39  ← ss2 data (cont.) 5792 B
  520.44  ← ss2 data (cont.) 2896 B
  520.44  ← ss2 data (cont.) 4344 B
  520.49  ← ss2 FIN 4692 B
```

## reuse, RTT 0 мс — медианный запрос (reused connection, 52.2 мс)

Паузы:
- 11.4 мс: после «ss1 → data (cont.) 842 B» до «← ss2 data 236 B»
- 23.9 мс: после «ss1 → ACK» до «← ss2 data 36 B»
- 5.8 мс: после «← ss2 data 249 B» до «← ss2 data 249 B»

```
    0.00  ss1 → data 2996 B
    0.09  ss1 → data (cont.) 7240 B
    1.04  ← ss2 ACK
    1.05  ss1 → data (cont.) 842 B
   12.41  ← ss2 data 236 B
   12.47  ← ss2 data 258 B
   12.52  ← ss2 data 426 B
   12.69  ← ss2 data 36 B
   12.74  ← ss2 data 105 B
   12.79  ← ss2 data 185 B
   12.86  ← ss2 data (cont.) 1448 B
   12.87  ss1 → ACK
   12.91  ← ss2 data (cont.) 6660 B
   12.94  ss1 → ACK
   13.03  ← ss2 data (cont.) 7240 B
   13.07  ← ss2 data (cont.) 989 B
   13.07  ← ss2 data (cont.) 4344 B
   13.11  ss1 → ACK
   13.12  ← ss2 data (cont.) 3885 B
   13.13  ss1 → ACK
   13.18  ← ss2 data (cont.) 5792 B
   13.23  ← ss2 data (cont.) 5792 B
   13.28  ← ss2 data (cont.) 4874 B
   13.29  ← ss2 data (cont.) 2896 B
   13.33  ← ss2 data (cont.) 5333 B
   13.39  ← ss2 data (cont.) 5792 B
   13.44  ← ss2 data (cont.) 2437 B
   13.49  ← ss2 data (cont.) 2896 B
   13.54  ← ss2 data (cont.) 5792 B
   13.60  ← ss2 data (cont.) 5792 B
   13.61  ss1 → ACK
   13.65  ← ss2 data (cont.) 7240 B
   13.71  ← ss2 data (cont.) 2967 B
   13.71  ← ss2 data (cont.) 2896 B
   13.72  ss1 → ACK
   13.75  ← ss2 data (cont.) 5792 B
   13.76  ss1 → ACK
   13.81  ← ss2 data (cont.) 7240 B
   13.82  ss1 → ACK
   13.86  ← ss2 data (cont.) 530 B
   13.93  ← ss2 data (cont.) 1448 B
   13.99  ← ss2 data (cont.) 5792 B
   14.02  ss1 → ACK
   14.04  ← ss2 data (cont.) 7240 B
   14.05  ss1 → ACK
   14.09  ← ss2 data (cont.) 5792 B
   14.15  ← ss2 data (cont.) 5792 B
   14.17  ss1 → ACK
   14.20  ← ss2 data (cont.) 5792 B
   14.25  ← ss2 data (cont.) 5792 B
   14.30  ← ss2 data (cont.) 3497 B
   14.30  ← ss2 data (cont.) 2896 B
   14.31  ss1 → ACK
   14.35  ← ss2 data (cont.) 7240 B
   14.41  ← ss2 data (cont.) 5792 B
   14.46  ← ss2 data (cont.) 5792 B
   14.46  ss1 → ACK
   14.47  ss1 → ACK
   14.52  ← ss2 data (cont.) 2967 B
   14.52  ← ss2 data (cont.) 4344 B
   14.56  ← ss2 data (cont.) 2221 B
   14.56  ← ss2 data (cont.) 2896 B
   14.62  ← ss2 data (cont.) 5792 B
   14.62  ss1 → ACK
   14.63  ss1 → ACK
   14.67  ← ss2 data (cont.) 7240 B
   14.72  ← ss2 data (cont.) 5792 B
   14.77  ss1 → ACK
   14.77  ← ss2 data (cont.) 2967 B
   14.77  ← ss2 data (cont.) 2896 B
   14.83  ← ss2 data (cont.) 5333 B
   14.83  ← ss2 data (cont.) 1448 B
   14.88  ← ss2 data (cont.) 5792 B
   14.92  ss1 → ACK
   14.93  ← ss2 data (cont.) 5792 B
   14.98  ← ss2 data (cont.) 7240 B
   15.04  ← ss2 data (cont.) 4415 B
   15.04  ← ss2 data (cont.) 1448 B
   15.07  ss1 → ACK
   15.09  ← ss2 data (cont.) 5792 B
   15.10  ss1 → ACK
   15.14  ← ss2 data (cont.) 989 B
   15.14  ← ss2 data (cont.) 4344 B
   15.19  ← ss2 data (cont.) 7240 B
   15.25  ← ss2 data (cont.) 5792 B
   15.25  ss1 → ACK
   15.26  ss1 → ACK
   15.29  ← ss2 data (cont.) 5792 B
   15.35  ← ss2 data (cont.) 1519 B
   15.35  ← ss2 data (cont.) 4344 B
   15.40  ← ss2 data (cont.) 3885 B
   15.40  ← ss2 data (cont.) 2896 B
   15.41  ss1 → ACK
   15.42  ss1 → ACK
   15.46  ← ss2 data (cont.) 5792 B
   15.51  ← ss2 data (cont.) 5792 B
   15.56  ← ss2 data (cont.) 5792 B
   15.56  ss1 → ACK
   15.58  ss1 → ACK
   15.62  ← ss2 data (cont.) 7240 B
   15.66  ← ss2 data (cont.) 5404 B
   15.71  ← ss2 data (cont.) 5792 B
   15.73  ss1 → ACK
   15.77  ← ss2 data (cont.) 7240 B
   15.82  ← ss2 data (cont.) 5792 B
   15.88  ← ss2 data (cont.) 5792 B
   15.88  ss1 → ACK
   15.89  ss1 → ACK
   15.93  ← ss2 data (cont.) 5792 B
   15.98  ← ss2 data (cont.) 2508 B
   15.98  ← ss2 data (cont.) 4344 B
   16.03  ss1 → ACK
   16.03  ← ss2 data (cont.) 5792 B
   16.04  ss1 → ACK
   16.09  ← ss2 data (cont.) 5792 B
   16.13  ← ss2 data (cont.) 5792 B
   16.19  ← ss2 data (cont.) 7240 B
   16.19  ss1 → ACK
   16.23  ss1 → ACK
   16.24  ← ss2 data (cont.) 2676 B
   16.24  ← ss2 data (cont.) 2896 B
   16.29  ← ss2 data (cont.) 5792 B
   16.34  ← ss2 data (cont.) 5792 B
   16.37  ss1 → ACK
   16.40  ← ss2 data (cont.) 7240 B
   16.45  ← ss2 data (cont.) 5792 B
   16.49  ss1 → ACK
   16.50  ← ss2 data (cont.) 5792 B
   16.55  ← ss2 data (cont.) 5792 B
   16.61  ← ss2 data (cont.) 2049 B
   16.61  ← ss2 data (cont.) 4344 B
   16.64  ss1 → ACK
   16.66  ← ss2 data (cont.) 5792 B
   16.67  ss1 → ACK
   16.71  ← ss2 data (cont.) 7240 B
   16.76  ← ss2 data (cont.) 5792 B
   16.78  ss1 → ACK
   16.82  ← ss2 data (cont.) 1519 B
   16.82  ← ss2 data (cont.) 4344 B
   16.83  ss1 → ACK
   16.87  ← ss2 data (cont.) 5792 B
   16.92  ss1 → ACK
   16.93  ← ss2 data (cont.) 5792 B
   16.98  ← ss2 data (cont.) 7240 B
   17.03  ← ss2 data (cont.) 5792 B
   17.07  ss1 → ACK
   17.08  ← ss2 data (cont.) 5792 B
   17.14  ← ss2 data (cont.) 6393 B
   17.19  ← ss2 data (cont.) 5792 B
   17.23  ss1 → ACK
   17.24  ← ss2 data (cont.) 5792 B
   17.24  ss1 → ACK
   17.29  ← ss2 data (cont.) 7240 B
   17.34  ← ss2 data (cont.) 5792 B
   17.39  ss1 → ACK
   17.39  ← ss2 data (cont.) 5792 B
   17.40  ss1 → ACK
   17.45  ← ss2 data (cont.) 2508 B
   17.45  ← ss2 data (cont.) 4344 B
   17.50  ← ss2 data (cont.) 5792 B
   17.53  ss1 → ACK
   17.55  ← ss2 data (cont.) 5792 B
   17.60  ← ss2 data (cont.) 5792 B
   17.65  ← ss2 data (cont.) 5792 B
   17.68  ss1 → ACK
   17.71  ← ss2 data (cont.) 5404 B
   17.71  ← ss2 data (cont.) 1448 B
   17.76  ← ss2 data (cont.) 5792 B
   17.81  ← ss2 data (cont.) 5792 B
   17.82  ss1 → ACK
   17.86  ← ss2 data (cont.) 7240 B
   17.92  ← ss2 data (cont.) 5792 B
   17.97  ← ss2 data (cont.) 5572 B
   17.98  ss1 → ACK
   17.99  ss1 → ACK
   18.02  ← ss2 data (cont.) 5792 B
   18.07  ← ss2 data (cont.) 7240 B
   18.13  ← ss2 data (cont.) 5792 B
   18.13  ss1 → ACK
   18.18  ← ss2 data (cont.) 5792 B
   18.23  ← ss2 data (cont.) 5792 B
   18.28  ← ss2 data (cont.) 2508 B
   18.28  ← ss2 data (cont.) 4344 B
   18.31  ss1 → ACK
   18.33  ← ss2 data (cont.) 3885 B
   18.34  ← ss2 data (cont.) 1448 B
   18.39  ← ss2 data (cont.) 5792 B
   18.44  ← ss2 data (cont.) 7240 B
   18.45  ss1 → ACK
   18.49  ← ss2 data (cont.) 5792 B
   18.50  ss1 → ACK
   18.55  ← ss2 data (cont.) 4415 B
   18.55  ← ss2 data (cont.) 1448 B
   18.60  ss1 → ACK
   18.60  ← ss2 data (cont.) 6781 B
   18.65  ← ss2 data (cont.) 5792 B
   18.70  ← ss2 data (cont.) 5792 B
   18.75  ss1 → ACK
   18.76  ← ss2 data (cont.) 5792 B
   18.81  ← ss2 data (cont.) 7311 B
   18.86  ← ss2 data (cont.) 5792 B
   18.89  ss1 → ACK
   18.91  ← ss2 data (cont.) 2437 B
   18.91  ← ss2 data (cont.) 2896 B
   18.92  ss1 → ACK
   18.96  ← ss2 data (cont.) 5792 B
   19.02  ← ss2 data (cont.) 7240 B
   19.04  ss1 → ACK
   19.07  ← ss2 data (cont.) 5792 B
   19.12  ← ss2 data (cont.) 5792 B
   19.18  ← ss2 data (cont.) 5404 B
   19.18  ← ss2 data (cont.) 1448 B
   19.23  ss1 → ACK
   19.23  ← ss2 data (cont.) 5792 B
   19.28  ← ss2 data (cont.) 5792 B
   19.33  ← ss2 data (cont.) 5792 B
   19.38  ← ss2 data (cont.) 5792 B
   19.39  ss1 → ACK
   19.40  ss1 → ACK
   19.44  ← ss2 data (cont.) 7020 B
   19.49  ← ss2 data (cont.) 5792 B
   19.54  ← ss2 data (cont.) 5792 B
   19.54  ss1 → ACK
   19.55  ss1 → ACK
   19.60  ← ss2 data (cont.) 7240 B
   19.65  ← ss2 data (cont.) 5792 B
   19.70  ss1 → ACK
   19.70  ← ss2 data (cont.) 5792 B
   19.75  ← ss2 data (cont.) 7240 B
   19.81  ← ss2 data (cont.) 3497 B
   19.81  ← ss2 data (cont.) 1448 B
   19.85  ss1 → ACK
   19.86  ← ss2 data (cont.) 5792 B
   19.86  ss1 → ACK
   19.91  ← ss2 data (cont.) 7240 B
   19.96  ← ss2 data (cont.) 5792 B
   19.97  ss1 → ACK
   19.98  ss1 → ACK
   20.02  ← ss2 data (cont.) 5792 B
   20.06  ← ss2 data (cont.) 5792 B
   20.12  ← ss2 data (cont.) 1060 B
   20.12  ← ss2 data (cont.) 5792 B
   20.13  ss1 → ACK
   20.14  ss1 → ACK
   20.17  ← ss2 data (cont.) 5792 B
   20.23  ← ss2 data (cont.) 5792 B
   20.28  ← ss2 data (cont.) 7240 B
   20.30  ss1 → ACK
   20.33  ← ss2 data (cont.) 5792 B
   20.34  ss1 → ACK
   20.38  ← ss2 data (cont.) 5792 B
   20.44  ← ss2 data (cont.) 4945 B
   20.44  ← ss2 data (cont.) 1448 B
   20.45  ss1 → ACK
   20.49  ← ss2 data (cont.) 5792 B
   20.54  ← ss2 data (cont.) 5792 B
   20.59  ← ss2 data (cont.) 5792 B
   20.60  ss1 → ACK
   20.65  ← ss2 data (cont.) 7240 B
   20.70  ← ss2 data (cont.) 5792 B
   20.75  ← ss2 data (cont.) 1060 B
   20.75  ← ss2 data (cont.) 4344 B
   20.75  ss1 → ACK
   20.76  ss1 → ACK
   20.81  ← ss2 data (cont.) 7240 B
   20.85  ← ss2 data (cont.) 5792 B
   20.90  ← ss2 data (cont.) 5792 B
   20.91  ss1 → ACK
   20.92  ss1 → ACK
   20.96  ← ss2 data (cont.) 5792 B
   21.01  ← ss2 data (cont.) 2676 B
   21.01  ← ss2 data (cont.) 4344 B
   21.07  ← ss2 data (cont.) 3885 B
   21.07  ← ss2 data (cont.) 1448 B
   21.07  ss1 → ACK
   21.08  ss1 → ACK
   21.12  ← ss2 data (cont.) 5792 B
   21.17  ← ss2 data (cont.) 7240 B
   21.22  ← ss2 data (cont.) 5792 B
   21.23  ss1 → ACK
   21.28  ← ss2 data (cont.) 5792 B
   21.28  ss1 → ACK
   21.33  ← ss2 data (cont.) 6852 B
   21.38  ← ss2 data (cont.) 5792 B
   21.38  ss1 → ACK
   21.40  ss1 → ACK
   21.43  ← ss2 data (cont.) 5792 B
   21.48  ← ss2 data (cont.) 5792 B
   21.53  ← ss2 data (cont.) 5792 B
   21.54  ss1 → ACK
   21.55  ss1 → ACK
   21.59  ← ss2 data (cont.) 7240 B
   21.64  ← ss2 data (cont.) 2508 B
   21.64  ← ss2 data (cont.) 2896 B
   21.69  ← ss2 data (cont.) 5792 B
   21.70  ss1 → ACK
   21.71  ss1 → ACK
   21.75  ← ss2 data (cont.) 7240 B
   21.79  ← ss2 data (cont.) 5792 B
   21.85  ← ss2 data (cont.) 5792 B
   21.85  ss1 → ACK
   21.86  ss1 → ACK
   21.90  ← ss2 data (cont.) 5404 B
   21.95  ← ss2 data (cont.) 5792 B
   22.00  ← ss2 data (cont.) 7240 B
   22.00  ss1 → ACK
   22.02  ss1 → ACK
   22.05  ← ss2 data (cont.) 5792 B
   22.11  ← ss2 data (cont.) 4576 B
   22.17  ss1 → ACK
   46.06  ← ss2 data 36 B
   46.11  ss1 → ACK
   46.14  ← ss2 data 36 B
   46.14  ← ss2 data 69 B
   46.20  ss1 → ACK
   46.28  ← ss2 data 1654 B
   46.30  ss1 → ACK
   46.33  ← ss2 data 1448 B
   46.39  ← ss2 data (cont.) 5792 B
   46.40  ss1 → ACK
   46.44  ← ss2 data (cont.) 1118 B
   46.44  ← ss2 data 249 B
   52.24  ← ss2 data 249 B
```

## reuse, RTT 50 мс — медианный запрос (reused connection, 140.3 мс)

Паузы:
- 26.0 мс: после «ss1 → data (cont.) 7240 B» до «← ss2 ACK»
- 25.0 мс: после «← ss2 ACK» до «ss1 → data (cont.) 842 B»
- 36.7 мс: после «ss1 → data (cont.) 842 B» до «← ss2 data 236 B»

```
    0.00  ss1 → data 2996 B
    0.11  ss1 → data (cont.) 7240 B
   26.13  ← ss2 ACK
   51.15  ss1 → data (cont.) 842 B
   87.81  ← ss2 data 236 B
   87.81  ← ss2 data 69 B
   87.81  ← ss2 data 36 B
   87.81  ← ss2 data 81 B
   87.81  ← ss2 data 36 B
   87.81  ← ss2 data 36 B
   87.81  ← ss2 data 426 B
   88.12  ← ss2 data 36 B
   88.12  ← ss2 data 36 B
   88.12  ← ss2 data 69 B
   88.12  ← ss2 data 36 B
   88.12  ← ss2 data 77 B
   88.12  ← ss2 data 36 B
   88.17  ← ss2 data 36 B
   88.51  ← ss2 data 8108 B
   88.56  ← ss2 data (cont.) 2896 B
   88.61  ← ss2 data (cont.) 5333 B
   88.66  ← ss2 data (cont.) 4344 B
   88.71  ← ss2 data (cont.) 3885 B
   88.71  ← ss2 data (cont.) 2896 B
   88.76  ← ss2 data (cont.) 5333 B
   88.82  ← ss2 data (cont.) 5792 B
   88.87  ← ss2 data (cont.) 2437 B
   88.87  ← ss2 data (cont.) 4344 B
   88.92  ← ss2 data (cont.) 3885 B
   88.92  ← ss2 data (cont.) 2896 B
   88.97  ← ss2 data (cont.) 5333 B
   89.03  ← ss2 data (cont.) 5792 B
   89.08  ← ss2 data (cont.) 2437 B
   89.08  ← ss2 data (cont.) 4344 B
   89.13  ← ss2 data (cont.) 3885 B
   89.13  ← ss2 data (cont.) 1448 B
   89.18  ← ss2 data (cont.) 6781 B
   89.23  ← ss2 data (cont.) 5792 B
   89.28  ← ss2 data (cont.) 2437 B
   89.28  ← ss2 data (cont.) 4344 B
   89.33  ← ss2 data (cont.) 3885 B
   89.33  ← ss2 data (cont.) 1448 B
   89.39  ← ss2 data (cont.) 6781 B
   89.44  ← ss2 data (cont.) 5792 B
   89.49  ← ss2 data (cont.) 2437 B
   89.49  ← ss2 data (cont.) 2896 B
   89.54  ← ss2 data (cont.) 5333 B
   89.54  ← ss2 data (cont.) 1448 B
   89.59  ← ss2 data (cont.) 5792 B
   89.65  ← ss2 data (cont.) 989 B
   89.65  ← ss2 data 2068 B
   89.70  ← ss2 data (cont.) 1448 B
   89.75  ← ss2 data (cont.) 6781 B
   89.80  ← ss2 data (cont.) 5792 B
   89.85  ← ss2 data (cont.) 2437 B
   89.85  ← ss2 data (cont.) 4344 B
   89.91  ← ss2 data (cont.) 3885 B
   89.91  ← ss2 data (cont.) 1448 B
   89.96  ← ss2 data (cont.) 5792 B
   90.01  ← ss2 data (cont.) 989 B
   90.01  ← ss2 data (cont.) 5792 B
   90.06  ← ss2 data (cont.) 2437 B
   90.06  ← ss2 data (cont.) 2896 B
   90.11  ← ss2 data (cont.) 5333 B
   90.16  ← ss2 data (cont.) 7240 B
   90.21  ← ss2 data (cont.) 989 B
   90.21  ← ss2 data (cont.) 4344 B
   90.27  ← ss2 data (cont.) 3885 B
   90.27  ← ss2 data (cont.) 2896 B
   90.32  ← ss2 data (cont.) 5333 B
   90.37  ← ss2 data (cont.) 5792 B
   90.42  ← ss2 data (cont.) 2437 B
   90.42  ← ss2 data (cont.) 4344 B
   90.47  ← ss2 data (cont.) 3885 B
   90.47  ← ss2 data (cont.) 1448 B
   90.52  ← ss2 data (cont.) 6781 B
   90.57  ← ss2 data (cont.) 5792 B
   90.63  ← ss2 data (cont.) 2437 B
   90.63  ← ss2 data (cont.) 2896 B
   90.68  ← ss2 data (cont.) 5333 B
   90.68  ← ss2 data (cont.) 1448 B
   90.73  ← ss2 data (cont.) 5792 B
   90.78  ← ss2 data (cont.) 989 B
   90.78  ← ss2 data (cont.) 4344 B
   90.84  ← ss2 data (cont.) 3885 B
   90.84  ← ss2 data (cont.) 2896 B
   90.89  ← ss2 data (cont.) 5333 B
   90.94  ← ss2 data (cont.) 5792 B
   90.99  ← ss2 data (cont.) 2437 B
   90.99  ← ss2 data (cont.) 4344 B
   91.04  ← ss2 data (cont.) 3885 B
   91.04  ← ss2 data (cont.) 1448 B
   91.10  ← ss2 data (cont.) 6781 B
   91.15  ← ss2 data (cont.) 5792 B
   91.20  ← ss2 data (cont.) 2437 B
   91.20  ← ss2 data (cont.) 2896 B
   91.25  ← ss2 data (cont.) 5333 B
   91.25  ← ss2 data 420 B
   91.25  ← ss2 data (cont.) 1448 B
   91.30  ← ss2 data (cont.) 5792 B
   91.35  ← ss2 data (cont.) 989 B
   91.35  ← ss2 data (cont.) 4344 B
   91.40  ← ss2 data (cont.) 3885 B
   91.40  ← ss2 data (cont.) 2896 B
   91.45  ← ss2 data (cont.) 5333 B
   91.51  ← ss2 data (cont.) 5792 B
   91.56  ← ss2 data (cont.) 2437 B
   91.56  ← ss2 data (cont.) 4344 B
   91.61  ← ss2 data (cont.) 3885 B
   91.61  ← ss2 data (cont.) 1448 B
   91.66  ← ss2 data (cont.) 6781 B
   91.71  ← ss2 data (cont.) 5792 B
   91.76  ← ss2 data (cont.) 2437 B
   91.76  ← ss2 data (cont.) 2896 B
   91.81  ← ss2 data (cont.) 5333 B
   91.82  ← ss2 data (cont.) 1448 B
   91.87  ← ss2 data (cont.) 5792 B
   91.92  ← ss2 data (cont.) 989 B
   91.92  ← ss2 data (cont.) 4344 B
   91.97  ← ss2 data (cont.) 3885 B
   91.97  ← ss2 data (cont.) 2896 B
   92.02  ← ss2 data (cont.) 5333 B
   92.07  ← ss2 data (cont.) 5792 B
   92.12  ← ss2 data (cont.) 2437 B
   92.13  ← ss2 data (cont.) 4344 B
   92.18  ← ss2 data (cont.) 3885 B
   92.18  ← ss2 data (cont.) 1448 B
   92.23  ← ss2 data (cont.) 6781 B
   92.28  ← ss2 data (cont.) 5792 B
   92.33  ← ss2 data (cont.) 2437 B
   92.33  ← ss2 data (cont.) 2896 B
   92.39  ← ss2 data (cont.) 5333 B
   92.39  ← ss2 data (cont.) 1448 B
   92.44  ← ss2 data (cont.) 6781 B
   92.49  ← ss2 data (cont.) 5792 B
   92.54  ← ss2 data (cont.) 2437 B
   92.54  ← ss2 data (cont.) 2896 B
   92.59  ← ss2 data (cont.) 5333 B
   92.59  ← ss2 data (cont.) 1448 B
   92.64  ← ss2 data (cont.) 5792 B
   92.70  ← ss2 data (cont.) 989 B
   92.70  ← ss2 data (cont.) 4344 B
   92.75  ← ss2 data (cont.) 3885 B
   92.75  ← ss2 data (cont.) 2896 B
   92.80  ← ss2 data (cont.) 5333 B
   92.85  ← ss2 data 6949 B
   92.90  ← ss2 data (cont.) 5792 B
   92.95  ← ss2 data (cont.) 2437 B
   92.95  ← ss2 data (cont.) 2896 B
   93.00  ← ss2 data (cont.) 5333 B
   93.00  ← ss2 data (cont.) 1448 B
   93.06  ← ss2 data (cont.) 5792 B
   93.11  ← ss2 data (cont.) 989 B
   93.11  ← ss2 data (cont.) 4344 B
   93.16  ← ss2 data (cont.) 3885 B
   93.16  ← ss2 data (cont.) 2896 B
   93.21  ← ss2 data (cont.) 5333 B
   93.26  ← ss2 data (cont.) 5792 B
   93.32  ← ss2 data (cont.) 2437 B
   93.32  ← ss2 data (cont.) 4344 B
   93.37  ← ss2 data (cont.) 3885 B
   93.37  ← ss2 data (cont.) 1448 B
   93.42  ← ss2 data (cont.) 6781 B
   93.47  ← ss2 data (cont.) 5792 B
   93.52  ← ss2 data (cont.) 2437 B
   93.52  ← ss2 data (cont.) 2896 B
   93.57  ← ss2 data (cont.) 5333 B
   93.57  ← ss2 data (cont.) 1448 B
   93.62  ← ss2 data (cont.) 5792 B
   93.68  ← ss2 data (cont.) 989 B
   93.68  ← ss2 data (cont.) 4344 B
   93.73  ← ss2 data (cont.) 3885 B
   93.73  ← ss2 data (cont.) 2896 B
   93.78  ← ss2 data (cont.) 5333 B
   93.83  ← ss2 data (cont.) 7240 B
   93.89  ← ss2 data (cont.) 989 B
   93.89  ← ss2 data (cont.) 4344 B
   93.94  ← ss2 data (cont.) 3885 B
   93.94  ← ss2 data (cont.) 2896 B
   93.99  ← ss2 data (cont.) 5333 B
   94.04  ← ss2 data (cont.) 5792 B
   94.09  ← ss2 data (cont.) 2437 B
   94.10  ← ss2 data (cont.) 4344 B
   94.14  ← ss2 data (cont.) 3885 B
   94.14  ← ss2 data (cont.) 1448 B
   94.19  ← ss2 data (cont.) 6781 B
   94.25  ← ss2 data (cont.) 5792 B
   94.30  ← ss2 data (cont.) 2437 B
   94.30  ← ss2 data (cont.) 2896 B
   94.35  ← ss2 data (cont.) 5333 B
   94.35  ← ss2 data (cont.) 1448 B
   94.40  ← ss2 data (cont.) 6781 B
   94.45  ← ss2 data (cont.) 5792 B
   94.51  ← ss2 data (cont.) 1157 B
   94.51  ← ss2 data (cont.) 4344 B
   94.56  ← ss2 data (cont.) 3885 B
   94.56  ← ss2 data (cont.) 1448 B
   94.61  ← ss2 data (cont.) 6781 B
   94.66  ← ss2 data (cont.) 5792 B
   94.71  ← ss2 data (cont.) 2437 B
   94.71  ← ss2 data (cont.) 2896 B
   94.76  ← ss2 data (cont.) 5333 B
   94.76  ← ss2 data (cont.) 1448 B
   94.81  ← ss2 data (cont.) 5792 B
   94.87  ← ss2 data (cont.) 989 B
   94.87  ← ss2 data (cont.) 5792 B
   94.92  ← ss2 data (cont.) 2437 B
   94.92  ← ss2 data (cont.) 2896 B
   94.97  ← ss2 data (cont.) 5333 B
   94.97  ← ss2 data (cont.) 1448 B
   95.02  ← ss2 data (cont.) 5792 B
   95.08  ← ss2 data (cont.) 989 B
   95.08  ← ss2 data (cont.) 4344 B
   95.13  ← ss2 data (cont.) 3885 B
   95.13  ← ss2 data (cont.) 2896 B
   95.18  ← ss2 data (cont.) 5333 B
   95.23  ← ss2 data (cont.) 5792 B
   95.28  ← ss2 data (cont.) 2437 B
   95.28  ← ss2 data (cont.) 4344 B
   95.33  ← ss2 data (cont.) 3885 B
   95.33  ← ss2 data (cont.) 1448 B
   95.38  ← ss2 data (cont.) 6781 B
   95.44  ← ss2 data (cont.) 5792 B
   95.49  ← ss2 data (cont.) 2437 B
   95.49  ← ss2 data (cont.) 2896 B
   95.54  ← ss2 data (cont.) 5333 B
   95.54  ← ss2 data (cont.) 1448 B
   95.59  ← ss2 data (cont.) 5792 B
   95.64  ← ss2 data (cont.) 989 B
   95.64  ← ss2 data (cont.) 4344 B
   95.70  ← ss2 data (cont.) 3885 B
   95.70  ← ss2 data (cont.) 2896 B
   95.75  ← ss2 data (cont.) 5333 B
   95.80  ← ss2 data (cont.) 7240 B
   95.85  ← ss2 data (cont.) 989 B
   95.85  ← ss2 data (cont.) 4344 B
   95.90  ← ss2 data (cont.) 3885 B
   95.90  ← ss2 data (cont.) 2896 B
   95.95  ← ss2 data (cont.) 5333 B
   96.00  ← ss2 data (cont.) 5792 B
   96.06  ← ss2 data (cont.) 2437 B
   96.06  ← ss2 data (cont.) 4344 B
   96.11  ← ss2 data (cont.) 2605 B
   96.11  ← ss2 data (cont.) 2896 B
   96.16  ← ss2 data (cont.) 5333 B
   96.16  ← ss2 data (cont.) 1448 B
   96.21  ← ss2 data (cont.) 5792 B
   96.26  ← ss2 data (cont.) 989 B
   96.26  ← ss2 data (cont.) 4344 B
   96.32  ← ss2 data (cont.) 3885 B
   96.32  ← ss2 data (cont.) 2896 B
   96.37  ← ss2 data (cont.) 5333 B
   96.42  ← ss2 data (cont.) 5792 B
   96.47  ← ss2 data (cont.) 2437 B
   96.47  ← ss2 data (cont.) 4344 B
   96.52  ← ss2 data (cont.) 3885 B
   96.52  ← ss2 data (cont.) 1448 B
   96.57  ← ss2 data (cont.) 6781 B
   96.62  ← ss2 data (cont.) 5792 B
   96.68  ← ss2 data (cont.) 2437 B
   96.68  ← ss2 data (cont.) 2896 B
   96.73  ← ss2 data (cont.) 5333 B
   96.73  ← ss2 data (cont.) 1448 B
   96.78  ← ss2 data (cont.) 5792 B
   96.83  ← ss2 data (cont.) 989 B
   96.83  ← ss2 data (cont.) 4344 B
   96.89  ← ss2 data (cont.) 3885 B
   96.89  ← ss2 data (cont.) 1448 B
  113.48  ss1 → ACK
  113.54  ss1 → ACK
  113.56  ss1 → ACK
  114.13  ss1 → ACK
  114.13  ss1 → ACK
  114.22  ss1 → ACK
  114.33  ss1 → ACK
  114.34  ss1 → ACK
  114.43  ss1 → ACK
  114.54  ss1 → ACK
  114.55  ss1 → ACK
  114.64  ss1 → ACK
  114.66  ss1 → ACK
  114.84  ss1 → ACK
  114.95  ss1 → ACK
  114.96  ss1 → ACK
  115.05  ss1 → ACK
  115.17  ss1 → ACK
  115.28  ss1 → ACK
  115.28  ss1 → ACK
  115.38  ss1 → ACK
  115.49  ss1 → ACK
  115.59  ss1 → ACK
  115.63  ss1 → ACK
  115.70  ss1 → ACK
  115.82  ss1 → ACK
  115.93  ss1 → ACK
  115.95  ss1 → ACK
  116.04  ss1 → ACK
  116.15  ss1 → ACK
  116.26  ss1 → ACK
  116.27  ss1 → ACK
  116.36  ss1 → ACK
  116.46  ss1 → ACK
  116.57  ss1 → ACK
  116.57  ss1 → ACK
  116.67  ss1 → ACK
  116.77  ss1 → ACK
  116.78  ss1 → ACK
  116.88  ss1 → ACK
  116.88  ss1 → ACK
  116.98  ss1 → ACK
  117.08  ss1 → ACK
  117.09  ss1 → ACK
  117.20  ss1 → ACK
  117.24  ss1 → ACK
  117.30  ss1 → ACK
  117.41  ss1 → ACK
  117.44  ss1 → ACK
  117.51  ss1 → ACK
  117.62  ss1 → ACK
  117.72  ss1 → ACK
  117.75  ss1 → ACK
  117.82  ss1 → ACK
  117.92  ss1 → ACK
  118.03  ss1 → ACK
  118.06  ss1 → ACK
  118.15  ss1 → ACK
  118.27  ss1 → ACK
  118.28  ss1 → ACK
  118.38  ss1 → ACK
  118.42  ss1 → ACK
  118.48  ss1 → ACK
  118.58  ss1 → ACK
  118.69  ss1 → ACK
  118.69  ss1 → ACK
  118.79  ss1 → ACK
  118.89  ss1 → ACK
  118.90  ss1 → ACK
  119.00  ss1 → ACK
  119.05  ss1 → ACK
  119.12  ss1 → ACK
  119.22  ss1 → ACK
  119.32  ss1 → ACK
  119.36  ss1 → ACK
  119.43  ss1 → ACK
  119.53  ss1 → ACK
  119.63  ss1 → ACK
  119.67  ss1 → ACK
  119.74  ss1 → ACK
  119.84  ss1 → ACK
  119.95  ss1 → ACK
  119.98  ss1 → ACK
  120.05  ss1 → ACK
  120.16  ss1 → ACK
  120.27  ss1 → ACK
  120.29  ss1 → ACK
  120.40  ss1 → ACK
  120.47  ss1 → ACK
  120.58  ss1 → ACK
  120.60  ss1 → ACK
  120.68  ss1 → ACK
  120.79  ss1 → ACK
  120.89  ss1 → ACK
  120.91  ss1 → ACK
  121.00  ss1 → ACK
  121.12  ss1 → ACK
  121.13  ss1 → ACK
  121.23  ss1 → ACK
  121.27  ss1 → ACK
  121.34  ss1 → ACK
  121.44  ss1 → ACK
  121.55  ss1 → ACK
  121.58  ss1 → ACK
  121.65  ss1 → ACK
  121.75  ss1 → ACK
  121.79  ss1 → ACK
  121.86  ss1 → ACK
  121.95  ss1 → ACK
  139.45  ← ss2 data (cont.) 1448 B
  139.51  ← ss2 data (cont.) 7240 B
  139.56  ← ss2 data (cont.) 5792 B
  139.61  ← ss2 data (cont.) 7240 B
  139.73  ← ss2 data (cont.) 5792 B
  139.78  ← ss2 data (cont.) 5792 B
  139.83  ← ss2 data (cont.) 5792 B
  139.88  ← ss2 data (cont.) 7240 B
  139.94  ← ss2 data (cont.) 5792 B
  139.99  ← ss2 data (cont.) 5792 B
  140.04  ← ss2 data (cont.) 7240 B
  140.10  ← ss2 data (cont.) 5792 B
  140.16  ← ss2 data (cont.) 7240 B
  140.20  ← ss2 data (cont.) 5792 B
  140.25  ← ss2 data (cont.) 2896 B
  140.25  ← ss2 data (cont.) 2896 B
  140.31  ← ss2 data (cont.) 3049 B
```
