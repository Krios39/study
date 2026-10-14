# Обмены ss1 ↔ ss2: full, reuse × RTT 0 / 20 мс, 20 запросов по 10240 Б

| config | RTT задан | RTT потока (ядро) | соединения | запрос по записи, мс | curl, мс | паузы ≥0.4·RTT | сумма пауз, мс | др. порты |
|---|---|---|---|---|---|---|---|---|
| full | 0 | 3.19 (min 0.04) | new TCP + resumed TLS: 20 | 68.8 | 91.3 | 4 | 65.7 | — |
| full | 20 | 24.89 (min 20.17) | new TCP + resumed TLS: 20 | 132.8 | 161.4 | 11 | 129.0 | — |
| reuse | 0 | 5.92 (min 0.04) | reused connection: 20 | 38.2 | 74.7 | 2 | 36.4 | — |
| reuse | 20 | 27.74 (min 0.04) | reused connection: 20 | 63.8 | 109.1 | 4 | 55.7 | — |

RTT потока — сглаженный rtt сокетов ss1 → ss2:5500 по ядру (ss -tin) во время запросов, в скобках minrtt (у соединений пула — минимум с момента открытия, в т. ч. до смены задержки). В хронологии исходящие пакеты ss1 видны уже после очереди netem (сдвиг на RTT/2), входящие — по приходу. Запрос по записи — от первого пакета запроса до последних данных ответа на канале ss1 ↔ ss2. Пауза — промежуток между соседними пакетами запроса не меньше max(0.4·RTT, 1 мс).

## full, RTT 0 мс — медианный запрос (new TCP + resumed TLS, 69.4 мс)

Паузы:
- 2.3 мс: после «← ss2 ACK» до «← ss2 TLS hs 2+4 2660 B»
- 26.8 мс: после «ss1 → ChangeCipherSpec 6 B» до «ss1 → Finished (enc.) 2896 B»
- 18.6 мс: после «ss1 → data (cont.) 808 B» до «← ss2 data 224 B»
- 18.7 мс: после «ss1 → ACK» до «← ss2 data 31 B»

```
    0.00  ss1 → SYN
    0.05  ← ss2 SYN-ACK
    0.08  ss1 → ACK
    0.69  ss1 → ClientHello 2800 B
    0.71  ← ss2 ACK
    2.97  ← ss2 TLS hs 2+4 2660 B
    2.99  ss1 → ACK
    3.02  ← ss2 ChangeCipherSpec 6 B
    3.02  ss1 → ACK
    3.05  ← ss2 Finished (enc.) 45 B
    3.05  ss1 → ACK
    3.87  ss1 → ChangeCipherSpec 6 B
   30.63  ss1 → Finished (enc.) 2896 B
   30.69  ← ss2 ACK
   30.70  ss1 → data (cont.) 141 B
   30.78  ss1 → data (cont.) 7240 B
   30.79  ← ss2 ACK
   30.79  ss1 → data (cont.) 808 B
   49.42  ← ss2 data 224 B
   49.43  ss1 → data 34 B
   49.50  ← ss2 data 63 B
   49.50  ← ss2 data 31 B
   49.52  ← ss2 data 75 B
   49.52  ← ss2 data 31 B
   49.53  ← ss2 data 31 B
   49.55  ← ss2 data 419 B
   49.86  ← ss2 data 31 B
   49.87  ← ss2 data 31 B
   49.88  ← ss2 data 63 B
   49.89  ← ss2 data 31 B
   50.22  ss1 → ACK
   50.24  ← ss2 data 10431 B
   50.25  ss1 → ACK
   68.96  ← ss2 data 31 B
   69.05  ← ss2 data 31 B
   69.07  ← ss2 data 63 B
   69.07  ← ss2 data 31 B
   69.08  ← ss2 data 72 B
   69.09  ← ss2 data 31 B
   69.15  ← ss2 data 31 B
   69.16  ← ss2 data 438 B
   69.17  ← ss2 data 31 B
   69.18  ← ss2 data 31 B
   69.19  ← ss2 data 63 B
   69.20  ← ss2 data 31 B
   69.20  ← ss2 data 65 B
   69.21  ← ss2 data 31 B
   69.22  ← ss2 data 31 B
   69.23  ← ss2 data 696 B
   69.23  ss1 → ACK
   69.24  ← ss2 data 31 B
   69.25  ← ss2 data 31 B
   69.26  ← ss2 data 63 B
   69.26  ← ss2 data 31 B
   69.27  ← ss2 data 64 B
   69.28  ← ss2 data 31 B
   69.28  ← ss2 data 31 B
   69.31  ← ss2 data 8031 B
   69.33  ← ss2 data 31 B
   69.33  ← ss2 data 31 B
   69.34  ← ss2 data 63 B
   69.35  ← ss2 data 31 B
   69.35  ← ss2 data 31 B
   69.42  ← ss2 data (cont.) 31 B
```

## full, RTT 20 мс — медианный запрос (new TCP + resumed TLS, 134.0 мс)

Паузы:
- 10.2 мс: после «ss1 → SYN» до «← ss2 SYN-ACK»
- 10.1 мс: после «← ss2 SYN-ACK» до «ss1 → ACK»
- 10.1 мс: после «ss1 → ClientHello 2800 B» до «← ss2 ACK»
- 10.0 мс: после «← ss2 Finished (enc.) 45 B» до «ss1 → ACK»
- 24.0 мс: после «ss1 → ChangeCipherSpec 6 B» до «ss1 → Finished (enc.) 2896 B»
- 10.1 мс: после «ss1 → data (cont.) 1448 B» до «← ss2 ACK»
- 10.1 мс: после «← ss2 ACK» до «ss1 → data (cont.) 983 B»
- 10.2 мс: после «ss1 → data (cont.) 983 B» до «← ss2 ACK»
- 14.2 мс: после «← ss2 ACK» до «← ss2 data 224 B»
- 10.6 мс: после «← ss2 data 63 B» до «ss1 → ACK»
- 10.1 мс: после «ss1 → ACK» до «← ss2 data 2896 B»

```
    0.00  ss1 → SYN
   10.21  ← ss2 SYN-ACK
   20.33  ss1 → ACK
   20.95  ss1 → ClientHello 2800 B
   31.10  ← ss2 ACK
   33.72  ← ss2 TLS hs 2+4 2660 B
   33.74  ← ss2 ChangeCipherSpec 6 B
   33.74  ← ss2 Finished (enc.) 45 B
   43.77  ss1 → ACK
   43.77  ss1 → ACK
   43.77  ss1 → ACK
   44.37  ss1 → ChangeCipherSpec 6 B
   68.41  ss1 → Finished (enc.) 2896 B
   68.42  ss1 → data (cont.) 2896 B
   68.43  ss1 → data (cont.) 2896 B
   68.43  ss1 → data (cont.) 1448 B
   78.55  ← ss2 ACK
   78.56  ← ss2 ACK
   78.56  ← ss2 ACK
   88.64  ss1 → data (cont.) 983 B
   98.80  ← ss2 ACK
  113.00  ← ss2 data 224 B
  113.04  ← ss2 data 63 B
  113.05  ← ss2 data 31 B
  113.05  ← ss2 data 75 B
  113.05  ← ss2 data 31 B
  113.05  ← ss2 data 31 B
  113.05  ← ss2 data 419 B
  113.22  ← ss2 data 31 B
  113.23  ← ss2 data 31 B
  113.23  ← ss2 data 63 B
  123.88  ss1 → ACK
  134.00  ← ss2 data 2896 B
  134.03  ← ss2 data (cont.) 2896 B
  134.03  ← ss2 data (cont.) 2896 B
  134.04  ← ss2 data (cont.) 2896 B
  134.04  ← ss2 data (cont.) 2896 B
  134.04  ← ss2 data (cont.) 2896 B
  134.04  ← ss2 data (cont.) 2896 B
  134.04  ← ss2 FIN 428 B
```

## reuse, RTT 0 мс — медианный запрос (reused connection, 39.1 мс)

Паузы:
- 16.9 мс: после «ss1 → data 34 B» до «← ss2 data 236 B»
- 20.5 мс: после «ss1 → ACK» до «← ss2 data 36 B»

```
    0.00  ss1 → data 2992 B
    0.05  ← ss2 ACK
    0.11  ss1 → data 8048 B
    0.43  ← ss2 ACK
    0.44  ss1 → data 34 B
   17.33  ← ss2 data 236 B
   17.40  ← ss2 data 69 B
   17.41  ← ss2 data 36 B
   17.46  ← ss2 data 81 B
   17.47  ← ss2 data 36 B
   17.48  ← ss2 data 36 B
   17.49  ← ss2 data 426 B
   17.84  ← ss2 data 36 B
   17.87  ← ss2 data 36 B
   17.88  ← ss2 data 69 B
   17.89  ← ss2 data 36 B
   17.90  ← ss2 data 77 B
   17.90  ← ss2 data 36 B
   17.91  ← ss2 data 36 B
   18.13  ← ss2 data 8110 B
   18.19  ← ss2 data 2203 B
   18.23  ss1 → ACK
   38.73  ← ss2 data 36 B
   38.81  ← ss2 data 36 B
   38.83  ← ss2 data 69 B
   38.83  ← ss2 data 36 B
   38.84  ← ss2 data 78 B
   38.85  ← ss2 data 36 B
   38.86  ← ss2 data 36 B
   38.87  ← ss2 data 445 B
   38.88  ← ss2 data 36 B
   38.88  ← ss2 data 36 B
   38.89  ← ss2 data 69 B
   38.90  ← ss2 data 36 B
   38.91  ← ss2 data 71 B
   38.91  ← ss2 data 36 B
   38.92  ← ss2 data 36 B
   38.93  ← ss2 data 703 B
   38.94  ← ss2 data 36 B
   38.94  ← ss2 data 36 B
   38.95  ← ss2 data 69 B
   38.95  ← ss2 data 36 B
   38.96  ← ss2 data 70 B
   38.97  ← ss2 data 36 B
   39.01  ← ss2 data 36 B
   39.04  ss1 → ACK
   39.04  ← ss2 data 8039 B
   39.06  ← ss2 data 36 B
   39.07  ss1 → ACK
   39.07  ← ss2 data 36 B
   39.08  ← ss2 data 69 B
   39.08  ← ss2 data 36 B
   39.09  ← ss2 data 36 B
   39.11  ← ss2 data 36 B
```

## reuse, RTT 20 мс — медианный запрос (reused connection, 63.9 мс)

Паузы:
- 10.3 мс: после «ss1 → data (cont.) 7240 B» до «← ss2 ACK»
- 10.1 мс: после «← ss2 ACK» до «ss1 → data (cont.) 842 B»
- 25.0 мс: после «ss1 → data (cont.) 842 B» до «← ss2 data 236 B»
- 9.7 мс: после «← ss2 data 3155 B» до «ss1 → ACK»

```
    0.00  ss1 → data 2992 B
    0.06  ss1 → data (cont.) 7240 B
   10.40  ← ss2 ACK
   20.50  ss1 → data (cont.) 842 B
   45.54  ← ss2 data 236 B
   45.58  ← ss2 data 69 B
   45.58  ← ss2 data 36 B
   45.58  ← ss2 data 81 B
   45.59  ← ss2 data 36 B
   45.59  ← ss2 data 36 B
   45.60  ← ss2 data 426 B
   46.30  ← ss2 data 36 B
   46.34  ← ss2 data 36 B
   46.36  ← ss2 data 69 B
   46.36  ← ss2 data 36 B
   46.36  ← ss2 data 77 B
   46.36  ← ss2 data 36 B
   46.36  ← ss2 data 36 B
   46.46  ← ss2 data 7158 B
   46.47  ← ss2 data 3155 B
   56.20  ss1 → ACK
   56.53  ss1 → ACK
   63.80  ← ss2 data 36 B
   63.82  ← ss2 data 36 B
   63.82  ← ss2 data 69 B
   63.82  ← ss2 data 36 B
   63.82  ← ss2 data 78 B
   63.82  ← ss2 data 36 B
   63.82  ← ss2 data 36 B
   63.82  ← ss2 data 445 B
   63.82  ← ss2 data 36 B
   63.82  ← ss2 data 36 B
   63.82  ← ss2 data 69 B
   63.82  ← ss2 data 36 B
   63.82  ← ss2 data 71 B
   63.82  ← ss2 data 36 B
   63.84  ← ss2 data 36 B
   63.84  ← ss2 data 703 B
   63.84  ← ss2 data 36 B
   63.84  ← ss2 data 36 B
   63.84  ← ss2 data 69 B
   63.84  ← ss2 data 36 B
   63.84  ← ss2 data 70 B
   63.84  ← ss2 data 36 B
   63.84  ← ss2 data 36 B
   63.88  ← ss2 data 8039 B
   63.89  ← ss2 data 36 B
   63.89  ← ss2 data 36 B
   63.89  ← ss2 data 69 B
   63.90  ← ss2 data 36 B
   63.90  ← ss2 data 36 B
   63.94  ← ss2 data 36 B
```
