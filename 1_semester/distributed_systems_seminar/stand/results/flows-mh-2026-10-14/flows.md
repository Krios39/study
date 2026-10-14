# Обмены ss1 ↔ ss2: full, reuse × RTT 0 / 5 / 20 / 50 мс, 20 запросов по 10240 Б

| config | RTT задан | RTT потока (ядро) | соединения | запрос по записи, мс | curl, мс | паузы ≥0.4·RTT | сумма пауз, мс | др. порты |
|---|---|---|---|---|---|---|---|---|
| full | 0 | 0.68 (min 0.53) | new TCP + resumed TLS: 20 | 49.8 | 62.1 | 4 | 45.4 | — |
| full | 5 | 5.58 (min 5.54) | new TCP + resumed TLS: 20 | 61.7 | 78.1 | 12.5 | 58.5 | — |
| full | 20 | 21.26 (min 20.78) | new TCP + resumed TLS: 20 | 123.7 | 147.8 | 11 | 120.6 | — |
| full | 50 | 52.08 (min 51.11) | new TCP + resumed TLS: 20 | 258.8 | 297.9 | 7 | 179.7 | — |
| reuse | 0 | 4.80 (min 0.15) | reused connection: 20 | 27.4 | 58.3 | 2 | 25.6 | — |
| reuse | 5 | 10.70 (min 0.15) | reused connection: 19 | 31.0 | 60.2 | 5 | 30.1 | — |
| reuse | 20 | 26.00 (min 0.15) | reused connection: 20 | 53.3 | 91.1 | 4 | 52.3 | — |
| reuse | 50 | 56.25 (min 0.15) | reused connection: 20 | 99.4 | 153.3 | 3 | 87.3 | — |

RTT потока — сглаженный rtt сокетов ss1 → ss2:5500 по ядру (ss -tin) во время запросов, в скобках minrtt (у соединений пула — минимум с момента открытия, в т. ч. до смены задержки). В хронологии исходящие пакеты ss1 видны уже после очереди netem (сдвиг на RTT/2), входящие — по приходу. Запрос по записи — от первого пакета запроса до последних данных ответа на канале ss1 ↔ ss2. Пауза — промежуток между соседними пакетами запроса не меньше max(0.4·RTT, 1 мс).

## full, RTT 0 мс — медианный запрос (new TCP + resumed TLS, 50.7 мс)

Паузы:
- 2.2 мс: после «← ss2 ACK» до «← ss2 TLS hs 2+4 2660 B»
- 16.6 мс: после «ss1 → ChangeCipherSpec 6 B» до «ss1 → Finished (enc.) 2896 B»
- 11.5 мс: после «ss1 → data (cont.) 985 B» до «← ss2 data 224 B»
- 11.3 мс: после «ss1 → ACK» до «← ss2 data 31 B»
- 4.9 мс: после «← ss2 FIN 31 B» до «← ss2 FIN 31 B»

```
    0.00  ss1 → SYN
    0.50  ← ss2 SYN-ACK
    0.52  ss1 → ACK
    0.98  ss1 → ClientHello 2800 B
    1.14  ← ss2 ACK
    1.22  ← ss2 ACK
    3.46  ← ss2 TLS hs 2+4 2660 B
    3.46  ← ss2 ChangeCipherSpec 6 B
    3.46  ← ss2 Finished (enc.) 45 B
    3.47  ss1 → ACK
    3.47  ss1 → ACK
    3.48  ss1 → ACK
    3.92  ss1 → ChangeCipherSpec 6 B
   20.53  ss1 → Finished (enc.) 2896 B
   20.61  ss1 → data (cont.) 7240 B
   21.34  ← ss2 ACK
   21.35  ← ss2 ACK
   21.36  ss1 → data (cont.) 985 B
   32.88  ← ss2 data 224 B
   33.00  ← ss2 data 63 B
   33.00  ← ss2 data 106 B
   33.00  ← ss2 data 31 B
   33.00  ← ss2 data 31 B
   33.07  ← ss2 data 419 B
   33.28  ← ss2 data 31 B
   33.28  ← ss2 data 31 B
   33.28  ss1 → ACK
   33.33  ← ss2 data 63 B
   33.33  ← ss2 data 31 B
   33.38  ss1 → ACK
   33.39  ← ss2 data 102 B
   33.44  ← ss2 data 31 B
   33.55  ss1 → ACK
   33.62  ← ss2 data (cont.) 5792 B
   33.63  ss1 → ACK
   33.67  ← ss2 data (cont.) 2310 B
   33.67  ← ss2 data 2196 B
   33.69  ss1 → ACK
   45.00  ← ss2 data 31 B
   45.00  ← ss2 data 31 B
   45.00  ← ss2 data 63 B
   45.04  ← ss2 data 103 B
   45.14  ← ss2 data 62 B
   45.14  ← ss2 data 438 B
   45.23  ← ss2 data 62 B
   45.23  ← ss2 data 63 B
   45.23  ← ss2 data 31 B
   45.23  ← ss2 data 65 B
   45.33  ← ss2 data 31 B
   45.33  ← ss2 data 31 B
   45.33  ← ss2 data 696 B
   45.35  ss1 → ACK
   45.43  ← ss2 data 31 B
   45.43  ← ss2 data 94 B
   45.43  ← ss2 data 31 B
   45.53  ← ss2 data 64 B
   45.53  ← ss2 data 31 B
   45.53  ← ss2 data 31 B
   45.68  ← ss2 data 8031 B
   45.68  ← ss2 data 62 B
   45.70  ss1 → ACK
   45.72  ← ss2 data 94 B
   45.77  ← ss2 data 31 B
   45.77  ← ss2 FIN 31 B
   50.66  ← ss2 FIN 31 B
```

## full, RTT 5 мс — медианный запрос (new TCP + resumed TLS, 62.1 мс)

Паузы:
- 3.0 мс: после «ss1 → SYN» до «← ss2 SYN-ACK»
- 2.6 мс: после «← ss2 SYN-ACK» до «ss1 → ACK»
- 2.7 мс: после «ss1 → ClientHello 2800 B» до «← ss2 ACK»
- 2.5 мс: после «← ss2 Finished (enc.) 45 B» до «ss1 → ACK»
- 14.8 мс: после «ss1 → ChangeCipherSpec 6 B» до «ss1 → Finished (enc.) 2896 B»
- 3.0 мс: после «ss1 → data (cont.) 2896 B» до «← ss2 ACK»
- 2.5 мс: после «← ss2 ACK» до «ss1 → data (cont.) 985 B»
- 11.4 мс: после «ss1 → data (cont.) 985 B» до «← ss2 data 224 B»
- 2.7 мс: после «← ss2 data 63 B» до «ss1 → ACK»
- 2.8 мс: после «ss1 → ACK» до «← ss2 data 5792 B»
- 2.5 мс: после «← ss2 data (cont.) 326 B» до «ss1 → ACK»
- 3.0 мс: после «ss1 → ACK» до «← ss2 data 31 B»
- 2.5 мс: после «← ss2 data 31 B» до «ss1 → ACK»
- 2.6 мс: после «ss1 → ACK» до «← ss2 FIN 8375 B»

```
    0.00  ss1 → SYN
    3.03  ← ss2 SYN-ACK
    5.61  ss1 → ACK
    6.02  ss1 → ClientHello 2800 B
    8.70  ← ss2 ACK
    8.71  ← ss2 ACK
   10.44  ← ss2 TLS hs 2+4 2660 B
   10.44  ← ss2 ChangeCipherSpec 6 B
   10.44  ← ss2 Finished (enc.) 45 B
   12.97  ss1 → ACK
   12.98  ss1 → ACK
   12.98  ss1 → ACK
   13.39  ss1 → ChangeCipherSpec 6 B
   28.19  ss1 → Finished (enc.) 2896 B
   28.20  ss1 → data (cont.) 4344 B
   28.20  ss1 → data (cont.) 2896 B
   31.23  ← ss2 ACK
   31.23  ← ss2 ACK
   31.23  ← ss2 ACK
   33.76  ss1 → data (cont.) 985 B
   45.15  ← ss2 data 224 B
   45.15  ← ss2 data 63 B
   45.15  ← ss2 data 31 B
   45.25  ← ss2 data 75 B
   45.25  ← ss2 data 31 B
   45.25  ← ss2 data 31 B
   45.25  ← ss2 data 419 B
   45.39  ← ss2 data 31 B
   45.39  ← ss2 data 31 B
   45.45  ← ss2 data 63 B
   48.16  ss1 → ACK
   50.94  ← ss2 data 5792 B
   50.99  ← ss2 data (cont.) 4344 B
   50.99  ← ss2 data (cont.) 326 B
   53.52  ss1 → ACK
   53.52  ss1 → ACK
   56.56  ← ss2 data 31 B
   56.56  ← ss2 data 31 B
   56.56  ← ss2 data 63 B
   56.62  ← ss2 data 31 B
   56.62  ← ss2 data 72 B
   56.62  ← ss2 data 31 B
   56.62  ← ss2 data 31 B
   56.66  ← ss2 data 438 B
   56.66  ← ss2 data 31 B
   56.72  ← ss2 data 31 B
   56.72  ← ss2 data 63 B
   56.72  ← ss2 data 31 B
   56.72  ← ss2 data 65 B
   56.77  ← ss2 data 31 B
   56.77  ← ss2 data 31 B
   56.77  ← ss2 data 696 B
   56.77  ← ss2 data 31 B
   56.77  ← ss2 data 31 B
   56.77  ← ss2 data 63 B
   56.82  ← ss2 data 31 B
   59.32  ss1 → ACK
   59.49  ss1 → ACK
   62.09  ← ss2 FIN 8375 B
```

## full, RTT 20 мс — медианный запрос (new TCP + resumed TLS, 123.7 мс)

Паузы:
- 10.9 мс: после «ss1 → SYN» до «← ss2 SYN-ACK»
- 10.1 мс: после «← ss2 SYN-ACK» до «ss1 → ACK»
- 10.2 мс: после «ss1 → ClientHello 2800 B» до «← ss2 ACK»
- 10.0 мс: после «← ss2 Finished (enc.) 45 B» до «ss1 → ACK»
- 16.2 мс: после «ss1 → ChangeCipherSpec 6 B» до «ss1 → Finished (enc.) 2896 B»
- 11.3 мс: после «ss1 → data (cont.) 1448 B» до «← ss2 ACK»
- 10.1 мс: после «← ss2 ACK» до «ss1 → data (cont.) 985 B»
- 10.8 мс: после «ss1 → data (cont.) 985 B» до «← ss2 ACK»
- 8.7 мс: после «← ss2 ACK» до «← ss2 data 224 B»
- 10.3 мс: после «← ss2 data 63 B» до «ss1 → ACK»
- 11.4 мс: после «ss1 → ACK» до «← ss2 data 2896 B»

```
    0.00  ss1 → SYN
   10.94  ← ss2 SYN-ACK
   21.03  ss1 → ACK
   21.57  ss1 → ClientHello 2800 B
   31.77  ← ss2 ACK
   34.03  ← ss2 TLS hs 2+4 2660 B
   34.03  ← ss2 ChangeCipherSpec 6 B
   34.03  ← ss2 Finished (enc.) 45 B
   44.06  ss1 → ACK
   44.07  ss1 → ACK
   44.07  ss1 → ACK
   44.58  ss1 → ChangeCipherSpec 6 B
   60.83  ss1 → Finished (enc.) 2896 B
   60.84  ss1 → data (cont.) 2896 B
   60.84  ss1 → data (cont.) 2896 B
   60.84  ss1 → data (cont.) 1448 B
   72.11  ← ss2 ACK
   72.11  ← ss2 ACK
   72.11  ← ss2 ACK
   82.22  ss1 → data (cont.) 985 B
   92.98  ← ss2 ACK
  101.72  ← ss2 data 224 B
  101.72  ← ss2 data 63 B
  101.72  ← ss2 data 31 B
  101.72  ← ss2 data 75 B
  101.72  ← ss2 data 31 B
  101.72  ← ss2 data 31 B
  101.72  ← ss2 data 419 B
  101.85  ← ss2 data 31 B
  101.85  ← ss2 data 31 B
  101.85  ← ss2 data 63 B
  112.18  ss1 → ACK
  123.58  ← ss2 data 2896 B
  123.58  ← ss2 data (cont.) 2896 B
  123.58  ← ss2 data (cont.) 2896 B
  123.58  ← ss2 data (cont.) 2896 B
  123.68  ← ss2 data (cont.) 2896 B
  123.68  ← ss2 data (cont.) 2896 B
  123.68  ← ss2 data (cont.) 2896 B
  123.68  ← ss2 FIN 428 B
```

## full, RTT 50 мс — медианный запрос (new TCP + resumed TLS, 258.8 мс)

Паузы:
- 25.5 мс: после «← ss2 SYN-ACK» до «ss1 → ACK»
- 26.2 мс: после «ss1 → ClientHello 2800 B» до «← ss2 ACK»
- 25.1 мс: после «← ss2 Finished (enc.) 45 B» до «ss1 → ACK»
- 25.9 мс: после «ss1 → data (cont.) 1448 B» до «← ss2 ACK»
- 25.1 мс: после «← ss2 ACK» до «ss1 → data (cont.) 985 B»
- 26.0 мс: после «← ss2 data 63 B» до «ss1 → ACK»
- 26.3 мс: после «ss1 → ACK» до «← ss2 data 2896 B»

```
    0.00  ss1 → SYN
   11.19  ← ss2 ACK
   11.19  ← ss2 ACK
   25.98  ← ss2 SYN-ACK
   51.45  ss1 → ACK
   51.53  ss1 → ClientHello 2800 B
   77.74  ← ss2 ACK
   79.61  ← ss2 TLS hs 2+4 2660 B
   79.61  ← ss2 ChangeCipherSpec 6 B
   79.61  ← ss2 Finished (enc.) 45 B
  104.69  ss1 → ACK
  104.70  ss1 → ACK
  104.70  ss1 → ACK
  105.60  ss1 → ChangeCipherSpec 6 B
  120.04  ss1 → Finished (enc.) 2896 B
  120.08  ss1 → data (cont.) 2896 B
  120.09  ss1 → data (cont.) 2896 B
  120.09  ss1 → data (cont.) 1448 B
  146.00  ← ss2 ACK
  146.00  ← ss2 ACK
  146.00  ← ss2 ACK
  171.09  ss1 → data (cont.) 985 B
  188.16  ← ss2 ACK
  197.01  ← ss2 ACK
  206.48  ← ss2 data 224 B
  206.48  ← ss2 data 63 B
  206.48  ← ss2 data 31 B
  206.48  ← ss2 data 75 B
  206.48  ← ss2 data 31 B
  206.48  ← ss2 data 31 B
  206.48  ← ss2 data 419 B
  206.48  ← ss2 data 31 B
  206.53  ← ss2 data 31 B
  206.53  ← ss2 data 63 B
  232.53  ss1 → ACK
  258.78  ← ss2 data 2896 B
  258.78  ← ss2 data (cont.) 2896 B
  258.78  ← ss2 data (cont.) 2896 B
  258.78  ← ss2 data (cont.) 2896 B
  258.83  ← ss2 data (cont.) 2896 B
  258.83  ← ss2 data (cont.) 2896 B
  258.83  ← ss2 data (cont.) 2896 B
  258.83  ← ss2 FIN 428 B
```

## reuse, RTT 0 мс — медианный запрос (reused connection, 27.5 мс)

Паузы:
- 12.5 мс: после «ss1 → data (cont.) 842 B» до «← ss2 data 236 B»
- 13.1 мс: после «ss1 → ACK» до «← ss2 data 36 B»

```
    0.00  ss1 → data 2994 B
    0.11  ss1 → data (cont.) 7240 B
    0.78  ← ss2 ACK
    0.78  ← ss2 ACK
    0.79  ss1 → data (cont.) 842 B
   13.29  ← ss2 data 236 B
   13.29  ← ss2 data 105 B
   13.29  ← ss2 data 117 B
   13.29  ← ss2 data 462 B
   13.29  ← ss2 data 36 B
   13.29  ← ss2 data 105 B
   13.36  ← ss2 data 36 B
   13.36  ← ss2 data 77 B
   13.41  ← ss2 data 72 B
   13.55  ← ss2 data (cont.) 1448 B
   13.61  ← ss2 data (cont.) 6662 B
   13.66  ← ss2 data 2203 B
   14.04  ss1 → ACK
   27.17  ← ss2 data 36 B
   27.17  ← ss2 data 36 B
   27.17  ← ss2 data 69 B
   27.17  ← ss2 data 150 B
   27.17  ← ss2 data 481 B
   27.17  ← ss2 data 141 B
   27.17  ← ss2 data 143 B
   27.22  ← ss2 data 739 B
   27.22  ss1 → ACK
   27.32  ← ss2 data 283 B
   27.38  ← ss2 data 36 B
   27.38  ← ss2 data (cont.) 2896 B
   27.40  ss1 → ACK
   27.43  ← ss2 data (cont.) 5143 B
   27.43  ← ss2 data 36 B
   27.48  ← ss2 data 177 B
   27.53  ← ss2 data 36 B
```

## reuse, RTT 5 мс — медианный запрос (reused connection, 31.0 мс)

Паузы:
- 3.9 мс: после «ss1 → data (cont.) 7240 B» до «← ss2 ACK»
- 2.5 мс: после «← ss2 ACK» до «ss1 → data (cont.) 842 B»
- 12.7 мс: после «ss1 → data (cont.) 842 B» до «← ss2 data 236 B»
- 2.8 мс: после «← ss2 data 2203 B» до «ss1 → ACK»
- 8.1 мс: после «ss1 → ACK» до «← ss2 data 36 B»

```
    0.00  ss1 → data 2994 B
    0.01  ss1 → data (cont.) 7240 B
    3.90  ← ss2 ACK
    6.43  ss1 → data (cont.) 842 B
   19.17  ← ss2 data 236 B
   19.17  ← ss2 data 69 B
   19.17  ← ss2 data 36 B
   19.20  ← ss2 data 81 B
   19.20  ← ss2 data 36 B
   19.22  ← ss2 data 36 B
   19.22  ← ss2 data 426 B
   19.49  ← ss2 data 36 B
   19.49  ← ss2 data 36 B
   19.49  ← ss2 data 69 B
   19.57  ← ss2 data 36 B
   19.57  ← ss2 data 77 B
   19.57  ← ss2 data 36 B
   19.57  ← ss2 data 36 B
   19.81  ← ss2 data 8110 B
   19.81  ← ss2 data 2203 B
   22.61  ss1 → ACK
   30.71  ← ss2 data 36 B
   30.71  ← ss2 data 36 B
   30.71  ← ss2 data 69 B
   30.71  ← ss2 data 36 B
   30.71  ← ss2 data 78 B
   30.72  ← ss2 data 36 B
   30.72  ← ss2 data 36 B
   30.72  ← ss2 data 445 B
   30.74  ← ss2 data 36 B
   30.74  ← ss2 data 36 B
   30.74  ← ss2 data 69 B
   30.74  ← ss2 data 36 B
   30.74  ← ss2 data 71 B
   30.74  ← ss2 data 36 B
   30.74  ← ss2 data 36 B
   30.74  ← ss2 data 703 B
   30.76  ← ss2 data 36 B
   30.76  ← ss2 data 36 B
   30.76  ← ss2 data 69 B
   30.76  ← ss2 data 36 B
   30.76  ← ss2 data 70 B
   30.76  ← ss2 data 36 B
   30.76  ← ss2 data 36 B
   31.01  ← ss2 data 8039 B
   31.01  ← ss2 data 36 B
   31.01  ← ss2 data 36 B
   31.02  ← ss2 data 69 B
   31.02  ← ss2 data 36 B
   31.02  ← ss2 data 36 B
   31.02  ← ss2 data 36 B
```

## reuse, RTT 20 мс — медианный запрос (reused connection, 53.3 мс)

Паузы:
- 11.2 мс: после «ss1 → data (cont.) 7240 B» до «← ss2 ACK»
- 10.3 мс: после «← ss2 ACK» до «ss1 → data (cont.) 842 B»
- 21.2 мс: после «ss1 → data (cont.) 842 B» до «← ss2 data 236 B»
- 9.9 мс: после «← ss2 data 2203 B» до «← ss2 data 36 B»

```
    0.00  ss1 → data 2994 B
    0.05  ss1 → data (cont.) 7240 B
   11.25  ← ss2 ACK
   21.57  ss1 → data (cont.) 842 B
   42.76  ← ss2 data 236 B
   42.76  ← ss2 data 69 B
   42.76  ← ss2 data 36 B
   42.76  ← ss2 data 81 B
   42.76  ← ss2 data 36 B
   42.76  ← ss2 data 36 B
   42.76  ← ss2 data 426 B
   42.76  ← ss2 data 36 B
   42.81  ← ss2 data 36 B
   42.81  ← ss2 data 69 B
   42.81  ← ss2 data 36 B
   42.81  ← ss2 data 77 B
   42.81  ← ss2 data 36 B
   42.81  ← ss2 data 36 B
   43.04  ← ss2 data (cont.) 5792 B
   43.14  ← ss2 data (cont.) 2318 B
   43.15  ← ss2 data 2203 B
   53.06  ← ss2 data 36 B
   53.06  ← ss2 data 36 B
   53.06  ← ss2 data 69 B
   53.06  ← ss2 data 36 B
   53.06  ← ss2 data 78 B
   53.06  ← ss2 data 36 B
   53.06  ← ss2 data 36 B
   53.06  ← ss2 data 445 B
   53.09  ← ss2 data 36 B
   53.09  ← ss2 data 36 B
   53.09  ← ss2 data 69 B
   53.09  ← ss2 data 36 B
   53.09  ← ss2 data 71 B
   53.09  ← ss2 data 36 B
   53.09  ← ss2 data 36 B
   53.09  ← ss2 data 703 B
   53.12  ← ss2 data 36 B
   53.12  ← ss2 data 36 B
   53.12  ← ss2 data 69 B
   53.12  ← ss2 data 36 B
   53.12  ← ss2 data 70 B
   53.19  ss1 → ACK
   53.23  ← ss2 data 36 B
   53.23  ← ss2 data 36 B
   53.33  ← ss2 data 8039 B
   53.33  ← ss2 data 36 B
   53.33  ← ss2 data 36 B
   53.35  ← ss2 data 69 B
   53.35  ← ss2 data 36 B
   53.35  ← ss2 data 36 B
   53.35  ← ss2 data 36 B
```

## reuse, RTT 50 мс — медианный запрос (reused connection, 100.1 мс)

Паузы:
- 26.2 мс: после «ss1 → data (cont.) 7240 B» до «← ss2 ACK»
- 25.5 мс: после «← ss2 ACK» до «ss1 → data (cont.) 842 B»
- 36.5 мс: после «ss1 → data (cont.) 842 B» до «← ss2 data 236 B»

```
    0.00  ss1 → data 2994 B
    0.01  ss1 → data (cont.) 7240 B
   26.23  ← ss2 ACK
   51.70  ss1 → data (cont.) 842 B
   88.24  ← ss2 data 236 B
   88.24  ← ss2 data 69 B
   88.24  ← ss2 data 36 B
   88.24  ← ss2 data 81 B
   88.24  ← ss2 data 36 B
   88.24  ← ss2 data 36 B
   88.24  ← ss2 data 426 B
   88.38  ← ss2 data 36 B
   88.38  ← ss2 data 36 B
   88.38  ← ss2 data 69 B
   88.38  ← ss2 data 36 B
   88.38  ← ss2 data 77 B
   88.38  ← ss2 data 36 B
   88.38  ← ss2 data 36 B
   88.65  ← ss2 data 8110 B
   88.74  ← ss2 data 2203 B
  100.02  ← ss2 data 36 B
  100.02  ← ss2 data 36 B
  100.02  ← ss2 data 69 B
  100.02  ← ss2 data 36 B
  100.02  ← ss2 data 78 B
  100.02  ← ss2 data 36 B
  100.02  ← ss2 data 36 B
  100.02  ← ss2 data 445 B
  100.04  ← ss2 data 36 B
  100.05  ← ss2 data 36 B
  100.05  ← ss2 data 69 B
  100.05  ← ss2 data 36 B
  100.05  ← ss2 data 71 B
  100.05  ← ss2 data 36 B
  100.05  ← ss2 data 36 B
  100.05  ← ss2 data 703 B
  100.07  ← ss2 data 36 B
  100.07  ← ss2 data 36 B
  100.07  ← ss2 data 69 B
  100.07  ← ss2 data 36 B
  100.07  ← ss2 data 70 B
  100.07  ← ss2 data 36 B
  100.07  ← ss2 data 36 B
  100.07  ← ss2 data 8039 B
  100.09  ← ss2 data 36 B
  100.09  ← ss2 data 36 B
  100.09  ← ss2 data 69 B
  100.09  ← ss2 data 36 B
  100.09  ← ss2 data 36 B
  100.09  ← ss2 data 36 B
```
