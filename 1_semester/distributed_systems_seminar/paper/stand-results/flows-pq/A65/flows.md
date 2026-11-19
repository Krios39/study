# Обмены ss1 ↔ ss2: full, reuse × RTT 50 мс, 20 запросов по 17049 Б

| config | RTT задан | RTT потока (ядро) | соединения | запрос по записи, мс | curl, мс | паузы ≥0.4·RTT | сумма пауз, мс | др. порты |
|---|---|---|---|---|---|---|---|---|
| full | 50 | 50.27 (min 50.23) | new TCP + resumed TLS: 20 | 257.5 | 309.9 | 9 | 222.3 | — |
| reuse | 50 | 59.01 (min 50.08) | reused connection: 1 | 3403.2 | 163.8 | 49 | 1670.0 | — |

RTT потока — сглаженный rtt сокетов ss1 → ss2:5500 по ядру (ss -tin) во время запросов, в скобках minrtt (у соединений пула — минимум с момента открытия, в т. ч. до смены задержки). В хронологии исходящие пакеты ss1 видны уже после очереди netem (сдвиг на RTT/2), входящие — по приходу. Запрос по записи — от первого пакета запроса до последних данных ответа на канале ss1 ↔ ss2. Пауза — промежуток между соседними пакетами запроса не меньше max(0.4·RTT, 1 мс).

## full, RTT 50 мс — медианный запрос (new TCP + resumed TLS, 257.6 мс)

Паузы:
- 25.2 мс: после «← ss2 SYN-ACK» до «ss1 → ACK»
- 25.1 мс: после «ss1 → ClientHello 2800 B» до «← ss2 ACK»
- 25.0 мс: после «← ss2 Finished (enc.) 45 B» до «ss1 → ACK»
- 25.1 мс: после «ss1 → data (cont.) 2896 B» до «← ss2 ACK»
- 23.7 мс: после «ss1 → data (cont.) 2896 B» до «ss1 → data (cont.) 2896 B»
- 23.7 мс: после «← ss2 ACK» до «← ss2 ACK»
- 25.5 мс: после «← ss2 data 63 B» до «ss1 → ACK»
- 25.1 мс: после «ss1 → ACK» до «← ss2 data 2896 B»

```
    0.00  ss1 → SYN
   10.49  ← ss2 ACK
   10.51  ← ss2 ACK
   25.15  ← ss2 SYN-ACK
   50.31  ss1 → ACK
   51.12  ss1 → ClientHello 2800 B
   76.25  ← ss2 ACK
   79.27  ← ss2 TLS hs 2+4 2660 B
   79.31  ← ss2 ChangeCipherSpec 6 B
   79.32  ← ss2 Finished (enc.) 45 B
  104.35  ss1 → ACK
  104.35  ss1 → ACK
  104.35  ss1 → ACK
  105.17  ss1 → ChangeCipherSpec 6 B
  116.90  ss1 → Finished (enc.) 2896 B
  116.90  ss1 → data (cont.) 2896 B
  142.03  ← ss2 ACK
  142.05  ← ss2 ACK
  143.41  ss1 → data (cont.) 2896 B
  143.42  ss1 → data (cont.) 1448 B
  143.42  ss1 → data (cont.) 2896 B
  167.08  ss1 → data (cont.) 2896 B
  167.09  ss1 → data (cont.) 2896 B
  167.09  ss1 → data (cont.) 574 B
  168.62  ← ss2 ACK
  168.64  ← ss2 ACK
  192.32  ← ss2 ACK
  192.36  ← ss2 ACK
  206.71  ← ss2 data 224 B
  206.72  ← ss2 data 63 B
  206.72  ← ss2 data 31 B
  206.72  ← ss2 data 75 B
  206.72  ← ss2 data 31 B
  206.73  ← ss2 data 31 B
  206.73  ← ss2 data 419 B
  206.88  ← ss2 data 31 B
  206.89  ← ss2 data 31 B
  206.89  ← ss2 data 63 B
  232.40  ss1 → ACK
  257.52  ← ss2 data 2896 B
  257.55  ← ss2 data (cont.) 2896 B
  257.56  ← ss2 data (cont.) 2896 B
  257.56  ← ss2 data (cont.) 2896 B
  257.56  ← ss2 data (cont.) 2896 B
  257.57  ← ss2 data (cont.) 2896 B
  257.57  ← ss2 data (cont.) 2896 B
  257.57  ← ss2 data (cont.) 2896 B
  257.57  ← ss2 data (cont.) 2896 B
  257.57  ← ss2 FIN 1490 B
```

## reuse, RTT 50 мс — медианный запрос (reused connection, 3403.2 мс)

Паузы:
- 23.3 мс: после «ss1 → data (cont.) 1374 B» до «ss1 → data (cont.) 2896 B»
- 23.4 мс: после «← ss2 ACK» до «← ss2 ACK»
- 25.4 мс: после «ss1 → data (cont.) 2051 B» до «← ss2 ACK»
- 26.7 мс: после «← ss2 ACK» до «← ss2 data 236 B»
- 25.3 мс: после «← ss2 data 69 B» до «ss1 → ACK»
- 25.1 мс: после «ss1 → ACK» до «← ss2 data 2896 B»
- 25.1 мс: после «← ss2 data (cont.) 1698 B» до «ss1 → ACK»
- 30.3 мс: после «ss1 → ACK» до «ss1 → data (cont.) 2896 B»
- 51.7 мс: после «ss1 → data (cont.) 603 B» до «← ss2 data 236 B»
- 25.4 мс: после «← ss2 data (cont.) 714 B» до «ss1 → ACK»
- 25.9 мс: после «ss1 → ACK» до «ss1 → data (cont.) 2896 B»
- 40.3 мс: после «ss1 → data (cont.) 603 B» до «← ss2 data 236 B»
- 24.7 мс: после «ss1 → ACK» до «ss1 → data (cont.) 2896 B»
- 50.0 мс: после «ss1 → data (cont.) 603 B» до «← ss2 data 236 B»
- 24.4 мс: после «ss1 → ACK» до «ss1 → data (cont.) 2896 B»
- 48.8 мс: после «ss1 → data (cont.) 603 B» до «← ss2 data 236 B»
- 47.2 мс: после «ss1 → data (cont.) 603 B» до «← ss2 data 236 B»
- 21.2 мс: после «← ss2 data 1772 B» до «← ss2 data 36 B»
- 21.0 мс: после «ss1 → ACK» до «ss1 → ACK»
- 38.3 мс: после «ss1 → ACK» до «ss1 → data (cont.) 2896 B»
- 25.4 мс: после «ss1 → data (cont.) 1374 B» до «← ss2 ACK»
- 23.6 мс: после «ss1 → data (cont.) 2896 B» до «ss1 → data (cont.) 603 B»
- 39.9 мс: после «← ss2 ACK» до «← ss2 data 236 B»
- 24.8 мс: после «ss1 → ACK» до «ss1 → data (cont.) 2896 B»
- 50.3 мс: после «ss1 → data (cont.) 603 B» до «← ss2 data 236 B»
- 41.0 мс: после «ss1 → data (cont.) 603 B» до «← ss2 data 236 B»
- 49.8 мс: после «ss1 → data (cont.) 603 B» до «← ss2 data 236 B»
- 24.8 мс: после «ss1 → ACK» до «ss1 → data (cont.) 2896 B»
- 63.2 мс: после «ss1 → data (cont.) 603 B» до «← ss2 data 236 B»
- 24.9 мс: после «← ss2 data 1772 B» до «ss1 → ACK»
- 25.0 мс: после «← ss2 data 36 B» до «ss1 → ACK»
- 27.6 мс: после «ss1 → ACK» до «ss1 → data (cont.) 2896 B»
- 54.5 мс: после «ss1 → data (cont.) 603 B» до «← ss2 data 236 B»
- 25.7 мс: после «ss1 → ACK» до «ss1 → data (cont.) 2896 B»
- 49.3 мс: после «ss1 → data (cont.) 603 B» до «← ss2 data 236 B»
- 24.2 мс: после «ss1 → ACK» до «ss1 → data (cont.) 2896 B»
- 49.2 мс: после «ss1 → data (cont.) 603 B» до «← ss2 data 236 B»
- 23.3 мс: после «ss1 → ACK» до «ss1 → data (cont.) 2896 B»
- 48.6 мс: после «ss1 → data (cont.) 603 B» до «← ss2 data 236 B»
- 23.5 мс: после «ss1 → ACK» до «ss1 → data (cont.) 2896 B»
- 49.2 мс: после «ss1 → data (cont.) 603 B» до «← ss2 data 236 B»
- 25.1 мс: после «ss1 → ACK» до «ss1 → data (cont.) 2896 B»
- 40.2 мс: после «ss1 → data (cont.) 603 B» до «← ss2 data 236 B»
- 43.2 мс: после «ss1 → data (cont.) 603 B» до «← ss2 data 236 B»
- 20.4 мс: после «← ss2 data 820 B» до «← ss2 data 36 B»
- 20.6 мс: после «ss1 → ACK» до «ss1 → ACK»
- 24.8 мс: после «ss1 → ACK» до «ss1 → data (cont.) 2896 B»
- 51.6 мс: после «ss1 → data (cont.) 603 B» до «← ss2 data 236 B»
- 53.1 мс: после «ss1 → data (cont.) 603 B» до «← ss2 data 236 B»

```
    0.00  ss1 → data (cont.) 2896 B
    0.00  ss1 → data (cont.) 2896 B
    0.00  ss1 → data (cont.) 1374 B
   23.29  ss1 → data (cont.) 2896 B
   23.29  ss1 → data (cont.) 2896 B
   23.29  ss1 → data (cont.) 1448 B
   25.42  ← ss2 ACK
   48.82  ← ss2 ACK
   50.49  ss1 → data (cont.) 2896 B
   50.50  ss1 → data (cont.) 2051 B
   75.89  ← ss2 ACK
  102.59  ← ss2 data 236 B
  102.62  ← ss2 data 69 B
  102.62  ← ss2 data 36 B
  102.62  ← ss2 data 81 B
  102.62  ← ss2 data 36 B
  102.62  ← ss2 data 36 B
  102.63  ← ss2 data 426 B
  103.16  ← ss2 data 36 B
  103.17  ← ss2 data 36 B
  103.17  ← ss2 data 69 B
  128.51  ss1 → ACK
  153.65  ← ss2 data 2896 B
  153.67  ← ss2 data (cont.) 2896 B
  153.67  ← ss2 data (cont.) 2896 B
  153.67  ← ss2 data (cont.) 2896 B
  153.67  ← ss2 data (cont.) 2896 B
  153.67  ← ss2 data (cont.) 2896 B
  153.67  ← ss2 data (cont.) 2896 B
  153.67  ← ss2 data (cont.) 2896 B
  153.67  ← ss2 data (cont.) 2896 B
  153.68  ← ss2 data (cont.) 1698 B
  178.73  ss1 → ACK
  209.00  ss1 → data (cont.) 2896 B
  209.01  ss1 → data (cont.) 2896 B
  209.01  ss1 → data (cont.) 1374 B
  227.55  ss1 → data (cont.) 2896 B
  227.56  ss1 → data (cont.) 2896 B
  227.56  ss1 → data (cont.) 2896 B
  227.56  ss1 → data (cont.) 2896 B
  234.40  ← ss2 ACK
  253.17  ← ss2 ACK
  259.44  ss1 → data (cont.) 603 B
  311.13  ← ss2 data 236 B
  311.16  ← ss2 data 69 B
  311.16  ← ss2 data 36 B
  311.18  ← ss2 data 81 B
  311.19  ← ss2 data 36 B
  311.19  ← ss2 data 36 B
  311.20  ← ss2 data 426 B
  311.59  ← ss2 data 36 B
  311.61  ← ss2 data 36 B
  311.62  ← ss2 data 69 B
  311.63  ← ss2 data 36 B
  311.64  ← ss2 data 77 B
  311.65  ← ss2 data 36 B
  311.66  ← ss2 data 36 B
  311.83  ← ss2 data (cont.) 2896 B
  311.83  ← ss2 data (cont.) 2896 B
  311.83  ← ss2 data (cont.) 1366 B
  311.92  ← ss2 data (cont.) 2896 B
  311.92  ← ss2 data (cont.) 2896 B
  311.92  ← ss2 data (cont.) 2437 B
  311.94  ← ss2 data 1772 B
  331.16  ← ss2 data 36 B
  331.18  ← ss2 data 36 B
  331.20  ← ss2 data 69 B
  331.20  ← ss2 data 36 B
  331.20  ← ss2 data 78 B
  331.20  ← ss2 data 36 B
  331.20  ← ss2 data 36 B
  331.20  ← ss2 data 441 B
  331.22  ← ss2 data 36 B
  331.22  ← ss2 data 36 B
  331.22  ← ss2 data 69 B
  331.22  ← ss2 data 36 B
  331.23  ← ss2 data 71 B
  336.88  ss1 → ACK
  337.05  ss1 → ACK
  356.85  ss1 → ACK
  361.99  ← ss2 data 2896 B
  362.01  ← ss2 data (cont.) 2896 B
  362.01  ← ss2 data (cont.) 2896 B
  362.02  ← ss2 data (cont.) 714 B
  387.41  ss1 → ACK
  413.34  ss1 → data (cont.) 2896 B
  413.34  ss1 → data (cont.) 2896 B
  413.34  ss1 → data (cont.) 1374 B
  430.71  ss1 → data (cont.) 2896 B
  430.72  ss1 → data (cont.) 2896 B
  430.72  ss1 → data (cont.) 2896 B
  430.72  ss1 → data (cont.) 2896 B
  438.72  ← ss2 ACK
  455.97  ← ss2 ACK
  463.78  ss1 → data (cont.) 603 B
  504.03  ← ss2 data 236 B
  504.05  ← ss2 data 69 B
  504.05  ← ss2 data 36 B
  504.06  ← ss2 data 81 B
  504.06  ← ss2 data 36 B
  504.06  ← ss2 data 36 B
  504.06  ← ss2 data 426 B
  504.28  ← ss2 data 36 B
  504.28  ← ss2 data 36 B
  504.29  ← ss2 data 69 B
  504.29  ← ss2 data 36 B
  504.29  ← ss2 data 77 B
  504.29  ← ss2 data 36 B
  504.29  ← ss2 data 36 B
  504.39  ← ss2 data (cont.) 4344 B
  504.39  ← ss2 data (cont.) 2814 B
  504.45  ← ss2 data (cont.) 4344 B
  504.45  ← ss2 data (cont.) 3885 B
  504.45  ← ss2 data 1772 B
  522.78  ← ss2 data 36 B
  522.79  ← ss2 data 36 B
  522.79  ← ss2 data 69 B
  522.79  ← ss2 data 36 B
  522.79  ← ss2 data 78 B
  522.80  ← ss2 data 36 B
  522.80  ← ss2 data 36 B
  522.81  ← ss2 data 441 B
  522.81  ← ss2 data 36 B
  522.81  ← ss2 data 36 B
  522.81  ← ss2 data 69 B
  522.81  ← ss2 data 36 B
  522.81  ← ss2 data 71 B
  522.82  ← ss2 data 36 B
  522.82  ← ss2 data 36 B
  522.83  ← ss2 data 723 B
  522.84  ← ss2 data 36 B
  522.85  ← ss2 data 36 B
  522.85  ← ss2 data 69 B
  522.86  ← ss2 data 36 B
  522.86  ← ss2 data 70 B
  522.87  ← ss2 data 36 B
  522.87  ← ss2 data 36 B
  522.91  ← ss2 data (cont.) 4344 B
  522.91  ← ss2 data (cont.) 3695 B
  522.91  ← ss2 data 36 B
  522.92  ← ss2 data 36 B
  522.92  ← ss2 data 69 B
  522.93  ← ss2 data 36 B
  522.93  ← ss2 data 36 B
  522.96  ← ss2 data 36 B
  529.74  ss1 → ACK
  547.89  ss1 → ACK
  547.97  ss1 → ACK
  572.70  ss1 → data (cont.) 2896 B
  572.71  ss1 → data (cont.) 2896 B
  572.71  ss1 → data (cont.) 1374 B
  589.21  ss1 → data (cont.) 2896 B
  589.21  ss1 → data (cont.) 2896 B
  589.21  ss1 → data (cont.) 2896 B
  589.21  ss1 → data (cont.) 2896 B
  598.10  ← ss2 ACK
  614.44  ← ss2 ACK
  623.23  ss1 → data (cont.) 603 B
  673.22  ← ss2 data 236 B
  673.24  ← ss2 data 69 B
  673.24  ← ss2 data 36 B
  673.24  ← ss2 data 81 B
  673.24  ← ss2 data 36 B
  673.24  ← ss2 data 36 B
  673.25  ← ss2 data 426 B
  673.48  ← ss2 data 36 B
  673.54  ← ss2 data 36 B
  673.54  ← ss2 data 69 B
  673.54  ← ss2 data 36 B
  673.54  ← ss2 data 77 B
  673.54  ← ss2 data 36 B
  673.54  ← ss2 data 36 B
  673.65  ← ss2 data (cont.) 5792 B
  673.65  ← ss2 data (cont.) 2318 B
  673.71  ← ss2 data (cont.) 5792 B
  673.71  ← ss2 data (cont.) 2437 B
  673.72  ← ss2 data 820 B
  692.54  ← ss2 data 36 B
  692.56  ← ss2 data 36 B
  692.56  ← ss2 data 69 B
  692.56  ← ss2 data 36 B
  692.57  ← ss2 data 78 B
  692.58  ← ss2 data 36 B
  692.58  ← ss2 data 36 B
  692.59  ← ss2 data 441 B
  692.60  ← ss2 data 36 B
  692.61  ← ss2 data 36 B
  692.61  ← ss2 data 69 B
  692.66  ← ss2 data 36 B
  692.68  ← ss2 data 71 B
  692.68  ← ss2 data 36 B
  692.69  ← ss2 data 36 B
  692.70  ← ss2 data 723 B
  692.72  ← ss2 data 36 B
  692.72  ← ss2 data 36 B
  692.72  ← ss2 data 69 B
  692.73  ← ss2 data 36 B
  692.73  ← ss2 data 70 B
  692.74  ← ss2 data 36 B
  692.74  ← ss2 data 36 B
  692.78  ← ss2 data (cont.) 5792 B
  692.78  ← ss2 data (cont.) 2247 B
  692.79  ← ss2 data 36 B
  692.79  ← ss2 data 36 B
  692.81  ← ss2 data 69 B
  692.81  ← ss2 data 36 B
  692.81  ← ss2 data 36 B
  692.87  ← ss2 data 36 B
  698.86  ss1 → ACK
  717.79  ss1 → ACK
  717.84  ss1 → ACK
  742.23  ss1 → data (cont.) 2896 B
  742.23  ss1 → data (cont.) 2896 B
  742.23  ss1 → data (cont.) 1374 B
  760.62  ss1 → data (cont.) 2896 B
  760.67  ss1 → data (cont.) 2896 B
  760.67  ss1 → data (cont.) 2896 B
  760.68  ss1 → data (cont.) 2896 B
  767.63  ← ss2 ACK
  785.92  ← ss2 ACK
  792.69  ss1 → data (cont.) 603 B
  841.51  ← ss2 data 236 B
  841.55  ← ss2 data 69 B
  841.56  ← ss2 data 36 B
  841.56  ← ss2 data 81 B
  841.56  ← ss2 data 36 B
  841.56  ← ss2 data 36 B
  841.56  ← ss2 data 426 B
  841.73  ← ss2 data 36 B
  841.73  ← ss2 data 36 B
  841.73  ← ss2 data 69 B
  841.73  ← ss2 data 36 B
  841.73  ← ss2 data 77 B
  841.74  ← ss2 data 36 B
  841.74  ← ss2 data 36 B
  841.84  ← ss2 data (cont.) 5792 B
  841.84  ← ss2 data (cont.) 2318 B
  841.90  ← ss2 data (cont.) 5792 B
  841.91  ← ss2 data (cont.) 2437 B
  841.91  ← ss2 data 820 B
  859.78  ← ss2 data 36 B
  859.80  ← ss2 data 36 B
  859.80  ← ss2 data 69 B
  859.82  ← ss2 data 36 B
  859.82  ← ss2 data 78 B
  859.82  ← ss2 data 36 B
  859.82  ← ss2 data 36 B
  859.82  ← ss2 data 441 B
  859.82  ← ss2 data 36 B
  859.82  ← ss2 data 36 B
  859.82  ← ss2 data 69 B
  859.82  ← ss2 data 36 B
  859.82  ← ss2 data 71 B
  859.83  ← ss2 data 36 B
  859.83  ← ss2 data 36 B
  859.83  ← ss2 data 723 B
  859.85  ← ss2 data 36 B
  859.85  ← ss2 data 36 B
  859.86  ← ss2 data 69 B
  859.86  ← ss2 data 36 B
  859.88  ← ss2 data 70 B
  859.88  ← ss2 data 36 B
  859.88  ← ss2 data 36 B
  859.93  ← ss2 data (cont.) 5792 B
  859.93  ← ss2 data (cont.) 2247 B
  859.93  ← ss2 data 36 B
  859.94  ← ss2 data 36 B
  859.94  ← ss2 data 69 B
  859.95  ← ss2 data 36 B
  859.95  ← ss2 data 36 B
  859.97  ← ss2 data 36 B
  867.36  ss1 → ACK
  884.87  ss1 → ACK
  884.96  ss1 → ACK
  890.92  ss1 → ACK
  908.76  ss1 → data (cont.) 2896 B
  908.76  ss1 → data (cont.) 2896 B
  908.76  ss1 → data (cont.) 1374 B
  925.15  ss1 → data (cont.) 2896 B
  925.23  ss1 → data (cont.) 2896 B
  925.24  ss1 → data (cont.) 2896 B
  925.24  ss1 → data (cont.) 2896 B
  934.09  ← ss2 ACK
  950.44  ← ss2 ACK
  959.14  ss1 → data (cont.) 603 B
 1006.35  ← ss2 data 236 B
 1006.40  ← ss2 data 69 B
 1006.40  ← ss2 data 36 B
 1006.40  ← ss2 data 81 B
 1006.40  ← ss2 data 36 B
 1006.41  ← ss2 data 36 B
 1006.41  ← ss2 data 426 B
 1006.65  ← ss2 data 36 B
 1006.66  ← ss2 data 36 B
 1006.66  ← ss2 data 69 B
 1006.66  ← ss2 data 36 B
 1006.67  ← ss2 data 77 B
 1006.67  ← ss2 data 36 B
 1006.67  ← ss2 data 36 B
 1006.75  ← ss2 data (cont.) 5792 B
 1006.76  ← ss2 data (cont.) 1366 B
 1006.82  ← ss2 data (cont.) 5792 B
 1006.82  ← ss2 data (cont.) 2437 B
 1006.87  ← ss2 data 1772 B
 1028.11  ← ss2 data 36 B
 1028.14  ← ss2 data 36 B
 1028.14  ← ss2 data 69 B
 1028.14  ← ss2 data 36 B
 1028.18  ← ss2 data 78 B
 1028.18  ← ss2 data 36 B
 1028.18  ← ss2 data 36 B
 1028.18  ← ss2 data 441 B
 1028.18  ← ss2 data 36 B
 1028.18  ← ss2 data 36 B
 1028.19  ← ss2 data 69 B
 1028.19  ← ss2 data 36 B
 1028.19  ← ss2 data 71 B
 1028.19  ← ss2 data 36 B
 1028.19  ← ss2 data 36 B
 1028.21  ← ss2 data 723 B
 1028.23  ← ss2 data 36 B
 1028.23  ← ss2 data 36 B
 1028.23  ← ss2 data 69 B
 1028.23  ← ss2 data 36 B
 1028.24  ← ss2 data 70 B
 1028.24  ← ss2 data 36 B
 1028.25  ← ss2 data 36 B
 1028.25  ← ss2 data (cont.) 5792 B
 1028.25  ← ss2 data (cont.) 2247 B
 1028.27  ← ss2 data 36 B
 1028.27  ← ss2 data 36 B
 1028.27  ← ss2 data 69 B
 1028.28  ← ss2 data 36 B
 1028.28  ← ss2 data 36 B
 1028.29  ← ss2 data 36 B
 1032.28  ss1 → ACK
 1053.25  ss1 → ACK
 1053.36  ss1 → ACK
 1091.66  ss1 → data (cont.) 2896 B
 1091.66  ss1 → data (cont.) 2896 B
 1091.66  ss1 → data (cont.) 1374 B
 1117.11  ← ss2 ACK
 1118.55  ss1 → data (cont.) 2896 B
 1118.56  ss1 → data (cont.) 2896 B
 1118.56  ss1 → data (cont.) 2896 B
 1118.56  ss1 → data (cont.) 2896 B
 1142.16  ss1 → data (cont.) 603 B
 1143.98  ← ss2 ACK
 1183.83  ← ss2 data 236 B
 1183.93  ← ss2 data 69 B
 1183.93  ← ss2 data 36 B
 1183.93  ← ss2 data 81 B
 1183.95  ← ss2 data 36 B
 1183.95  ← ss2 data 36 B
 1183.95  ← ss2 data 426 B
 1184.31  ← ss2 data 36 B
 1184.31  ← ss2 data 36 B
 1184.33  ← ss2 data 69 B
 1184.33  ← ss2 data 36 B
 1184.33  ← ss2 data 77 B
 1184.34  ← ss2 data 36 B
 1184.34  ← ss2 data 36 B
 1184.67  ← ss2 data (cont.) 5792 B
 1184.67  ← ss2 data (cont.) 1366 B
 1184.75  ← ss2 data (cont.) 5792 B
 1184.76  ← ss2 data (cont.) 2437 B
 1184.76  ← ss2 data 1772 B
 1201.70  ← ss2 data 36 B
 1201.72  ← ss2 data 36 B
 1201.73  ← ss2 data 69 B
 1201.73  ← ss2 data 36 B
 1201.73  ← ss2 data 78 B
 1201.73  ← ss2 data 36 B
 1201.73  ← ss2 data 36 B
 1201.73  ← ss2 data 441 B
 1201.75  ← ss2 data 36 B
 1201.75  ← ss2 data 36 B
 1201.75  ← ss2 data 69 B
 1201.75  ← ss2 data 36 B
 1201.75  ← ss2 data 71 B
 1201.75  ← ss2 data 36 B
 1201.75  ← ss2 data 36 B
 1201.75  ← ss2 data 723 B
 1201.75  ← ss2 data 36 B
 1201.75  ← ss2 data 36 B
 1201.75  ← ss2 data 69 B
 1201.75  ← ss2 data 36 B
 1201.80  ← ss2 data 70 B
 1201.81  ← ss2 data 36 B
 1201.81  ← ss2 data 36 B
 1201.86  ← ss2 data (cont.) 5792 B
 1201.86  ← ss2 data (cont.) 2247 B
 1201.86  ← ss2 data 36 B
 1201.86  ← ss2 data 36 B
 1201.91  ← ss2 data 69 B
 1201.91  ← ss2 data 36 B
 1201.91  ← ss2 data 36 B
 1201.93  ← ss2 data 36 B
 1209.75  ss1 → ACK
 1209.78  ss1 → ACK
 1210.13  ss1 → ACK
 1226.80  ss1 → ACK
 1226.97  ss1 → ACK
 1251.75  ss1 → data (cont.) 2896 B
 1251.76  ss1 → data (cont.) 2896 B
 1251.76  ss1 → data (cont.) 1374 B
 1268.55  ss1 → data (cont.) 2896 B
 1268.55  ss1 → data (cont.) 2896 B
 1268.56  ss1 → data (cont.) 2896 B
 1268.56  ss1 → data (cont.) 2896 B
 1277.14  ← ss2 ACK
 1293.88  ← ss2 ACK
 1302.19  ss1 → data (cont.) 603 B
 1352.54  ← ss2 data 236 B
 1352.56  ← ss2 data 69 B
 1352.57  ← ss2 data 36 B
 1352.57  ← ss2 data 81 B
 1352.57  ← ss2 data 36 B
 1352.57  ← ss2 data 36 B
 1352.57  ← ss2 data 426 B
 1352.76  ← ss2 data 36 B
 1352.76  ← ss2 data 36 B
 1352.76  ← ss2 data 69 B
 1352.76  ← ss2 data 36 B
 1352.77  ← ss2 data 77 B
 1352.77  ← ss2 data 36 B
 1352.77  ← ss2 data 36 B
 1352.85  ← ss2 data (cont.) 5792 B
 1352.85  ← ss2 data (cont.) 2318 B
 1352.92  ← ss2 data (cont.) 5792 B
 1352.92  ← ss2 data (cont.) 2437 B
 1352.93  ← ss2 data 820 B
 1369.33  ← ss2 data 36 B
 1369.34  ← ss2 data 36 B
 1369.35  ← ss2 data 69 B
 1369.36  ← ss2 data 36 B
 1369.36  ← ss2 data 78 B
 1369.36  ← ss2 data 36 B
 1369.37  ← ss2 data 36 B
 1369.37  ← ss2 data 441 B
 1369.37  ← ss2 data 36 B
 1369.38  ← ss2 data 36 B
 1369.38  ← ss2 data 69 B
 1369.38  ← ss2 data 36 B
 1369.38  ← ss2 data 71 B
 1369.39  ← ss2 data 36 B
 1369.39  ← ss2 data 36 B
 1369.39  ← ss2 data 723 B
 1369.40  ← ss2 data 36 B
 1369.42  ← ss2 data 36 B
 1369.42  ← ss2 data 69 B
 1369.42  ← ss2 data 36 B
 1369.42  ← ss2 data 70 B
 1369.42  ← ss2 data 36 B
 1369.43  ← ss2 data 36 B
 1369.46  ← ss2 data (cont.) 5792 B
 1369.46  ← ss2 data (cont.) 2247 B
 1369.46  ← ss2 data 36 B
 1369.47  ← ss2 data 36 B
 1369.48  ← ss2 data 69 B
 1369.48  ← ss2 data 36 B
 1369.48  ← ss2 data 36 B
 1369.51  ← ss2 data 36 B
 1378.20  ss1 → ACK
 1394.44  ss1 → ACK
 1394.49  ss1 → ACK
 1401.00  ss1 → ACK
 1420.39  ss1 → data (cont.) 2896 B
 1420.39  ss1 → data (cont.) 2896 B
 1420.39  ss1 → data (cont.) 1374 B
 1439.70  ss1 → data (cont.) 2896 B
 1439.70  ss1 → data (cont.) 2896 B
 1439.70  ss1 → data (cont.) 2896 B
 1439.71  ss1 → data (cont.) 2896 B
 1445.83  ← ss2 ACK
 1465.03  ← ss2 ACK
 1470.94  ss1 → data (cont.) 603 B
 1511.91  ← ss2 data 236 B
 1511.94  ← ss2 data 69 B
 1511.94  ← ss2 data 36 B
 1511.94  ← ss2 data 81 B
 1511.94  ← ss2 data 36 B
 1511.94  ← ss2 data 36 B
 1511.94  ← ss2 data 426 B
 1512.18  ← ss2 data 36 B
 1512.18  ← ss2 data 36 B
 1512.18  ← ss2 data 69 B
 1512.19  ← ss2 data 36 B
 1512.19  ← ss2 data 77 B
 1512.19  ← ss2 data 36 B
 1512.20  ← ss2 data 36 B
 1512.32  ← ss2 data (cont.) 5792 B
 1512.33  ← ss2 data (cont.) 1366 B
 1512.40  ← ss2 data (cont.) 5792 B
 1512.41  ← ss2 data (cont.) 2437 B
 1512.41  ← ss2 data 1772 B
 1530.40  ← ss2 data 36 B
 1530.43  ← ss2 data 36 B
 1530.43  ← ss2 data 69 B
 1530.43  ← ss2 data 36 B
 1530.43  ← ss2 data 78 B
 1530.43  ← ss2 data 36 B
 1530.43  ← ss2 data 36 B
 1530.44  ← ss2 data 441 B
 1530.44  ← ss2 data 36 B
 1530.44  ← ss2 data 36 B
 1530.45  ← ss2 data 69 B
 1530.45  ← ss2 data 36 B
 1530.46  ← ss2 data 71 B
 1530.46  ← ss2 data 36 B
 1530.48  ← ss2 data 36 B
 1530.48  ← ss2 data 723 B
 1530.49  ← ss2 data 36 B
 1530.50  ← ss2 data 36 B
 1530.50  ← ss2 data 69 B
 1530.50  ← ss2 data 36 B
 1530.50  ← ss2 data 70 B
 1530.57  ← ss2 data 36 B
 1530.57  ← ss2 data 36 B
 1530.61  ← ss2 data (cont.) 5792 B
 1530.61  ← ss2 data (cont.) 2247 B
 1530.61  ← ss2 data 36 B
 1530.63  ← ss2 data 36 B
 1530.63  ← ss2 data 69 B
 1530.64  ← ss2 data 36 B
 1530.64  ← ss2 data 36 B
 1530.66  ← ss2 data 36 B
 1537.67  ss1 → ACK
 1555.55  ss1 → ACK
 1555.66  ss1 → ACK
 1562.32  ss1 → ACK
 1580.09  ss1 → data (cont.) 2896 B
 1580.09  ss1 → data (cont.) 2896 B
 1580.09  ss1 → data (cont.) 1374 B
 1597.71  ss1 → data (cont.) 2896 B
 1597.78  ss1 → data (cont.) 2896 B
 1597.78  ss1 → data (cont.) 2896 B
 1597.78  ss1 → data (cont.) 2896 B
 1605.52  ← ss2 ACK
 1623.30  ← ss2 ACK
 1630.57  ss1 → data (cont.) 603 B
 1680.36  ← ss2 data 236 B
 1680.39  ← ss2 data 69 B
 1680.40  ← ss2 data 36 B
 1680.40  ← ss2 data 81 B
 1680.40  ← ss2 data 36 B
 1680.40  ← ss2 data 36 B
 1680.40  ← ss2 data 426 B
 1680.62  ← ss2 data 36 B
 1680.62  ← ss2 data 36 B
 1680.62  ← ss2 data 69 B
 1680.62  ← ss2 data 36 B
 1680.63  ← ss2 data 77 B
 1680.63  ← ss2 data 36 B
 1680.63  ← ss2 data 36 B
 1680.71  ← ss2 data (cont.) 5792 B
 1680.71  ← ss2 data (cont.) 1366 B
 1680.76  ← ss2 data (cont.) 5792 B
 1680.77  ← ss2 data (cont.) 2437 B
 1680.78  ← ss2 data 1772 B
 1699.21  ← ss2 data 36 B
 1699.23  ← ss2 data 36 B
 1699.23  ← ss2 data 69 B
 1699.23  ← ss2 data 36 B
 1699.23  ← ss2 data 78 B
 1699.23  ← ss2 data 36 B
 1699.23  ← ss2 data 36 B
 1699.23  ← ss2 data 441 B
 1699.23  ← ss2 data 36 B
 1699.24  ← ss2 data 36 B
 1699.24  ← ss2 data 69 B
 1699.24  ← ss2 data 36 B
 1699.24  ← ss2 data 71 B
 1699.24  ← ss2 data 36 B
 1699.24  ← ss2 data 36 B
 1699.25  ← ss2 data 723 B
 1699.26  ← ss2 data 36 B
 1699.26  ← ss2 data 36 B
 1699.26  ← ss2 data 69 B
 1699.26  ← ss2 data 36 B
 1699.26  ← ss2 data 70 B
 1699.26  ← ss2 data 36 B
 1699.26  ← ss2 data 36 B
 1699.27  ← ss2 data (cont.) 5792 B
 1699.27  ← ss2 data (cont.) 2247 B
 1699.27  ← ss2 data 36 B
 1699.29  ← ss2 data 36 B
 1699.29  ← ss2 data 69 B
 1699.29  ← ss2 data 36 B
 1699.29  ← ss2 data 36 B
 1699.31  ← ss2 data 36 B
 1705.95  ss1 → ACK
 1724.29  ss1 → ACK
 1724.33  ss1 → ACK
 1749.09  ss1 → data (cont.) 2896 B
 1749.09  ss1 → data (cont.) 2896 B
 1749.09  ss1 → data (cont.) 1374 B
 1763.69  ss1 → data (cont.) 2896 B
 1763.69  ss1 → data (cont.) 2896 B
 1763.69  ss1 → data (cont.) 2896 B
 1763.69  ss1 → data (cont.) 2896 B
 1774.45  ← ss2 ACK
 1789.11  ← ss2 ACK
 1799.53  ss1 → data (cont.) 603 B
 1862.70  ← ss2 data 236 B
 1862.77  ← ss2 data 69 B
 1862.77  ← ss2 data 36 B
 1862.78  ← ss2 data 81 B
 1862.79  ← ss2 data 36 B
 1862.79  ← ss2 data 36 B
 1862.79  ← ss2 data 426 B
 1863.11  ← ss2 data 36 B
 1863.13  ← ss2 data 36 B
 1863.13  ← ss2 data 69 B
 1863.13  ← ss2 data 36 B
 1863.14  ← ss2 data 77 B
 1863.14  ← ss2 data 36 B
 1863.14  ← ss2 data 36 B
 1863.23  ← ss2 data (cont.) 5792 B
 1863.23  ← ss2 data (cont.) 1366 B
 1863.49  ← ss2 data (cont.) 5792 B
 1863.49  ← ss2 data (cont.) 2437 B
 1863.52  ← ss2 data 1772 B
 1888.43  ss1 → ACK
 1888.52  ss1 → ACK
 1888.54  ss1 → ACK
 1898.13  ← ss2 data 36 B
 1898.15  ← ss2 data 36 B
 1898.15  ← ss2 data 69 B
 1898.15  ← ss2 data 36 B
 1898.15  ← ss2 data 78 B
 1898.15  ← ss2 data 36 B
 1898.15  ← ss2 data 36 B
 1898.15  ← ss2 data 441 B
 1898.15  ← ss2 data 36 B
 1898.15  ← ss2 data 36 B
 1898.15  ← ss2 data 69 B
 1898.16  ← ss2 data 36 B
 1898.16  ← ss2 data 71 B
 1898.16  ← ss2 data 36 B
 1898.16  ← ss2 data 36 B
 1898.16  ← ss2 data 723 B
 1898.16  ← ss2 data 36 B
 1898.17  ← ss2 data 36 B
 1898.17  ← ss2 data 69 B
 1898.17  ← ss2 data 36 B
 1898.17  ← ss2 data 70 B
 1898.17  ← ss2 data 36 B
 1898.18  ← ss2 data 36 B
 1898.18  ← ss2 data (cont.) 5792 B
 1898.18  ← ss2 data (cont.) 2247 B
 1898.18  ← ss2 data 36 B
 1898.18  ← ss2 data 36 B
 1898.18  ← ss2 data 69 B
 1898.19  ← ss2 data 36 B
 1898.19  ← ss2 data 36 B
 1898.19  ← ss2 data 36 B
 1923.20  ss1 → ACK
 1923.21  ss1 → ACK
 1950.83  ss1 → data (cont.) 2896 B
 1950.84  ss1 → data (cont.) 2896 B
 1950.84  ss1 → data (cont.) 1374 B
 1968.91  ss1 → data (cont.) 2896 B
 1968.98  ss1 → data (cont.) 2896 B
 1968.99  ss1 → data (cont.) 2896 B
 1968.99  ss1 → data (cont.) 2896 B
 1976.23  ← ss2 ACK
 1994.30  ← ss2 ACK
 2001.29  ss1 → data (cont.) 603 B
 2055.75  ← ss2 data 236 B
 2055.78  ← ss2 data 69 B
 2055.78  ← ss2 data 36 B
 2055.78  ← ss2 data 81 B
 2055.79  ← ss2 data 36 B
 2055.79  ← ss2 data 36 B
 2055.79  ← ss2 data 426 B
 2056.06  ← ss2 data 36 B
 2056.06  ← ss2 data 36 B
 2056.07  ← ss2 data 69 B
 2056.07  ← ss2 data 36 B
 2056.08  ← ss2 data 77 B
 2056.08  ← ss2 data 36 B
 2056.13  ← ss2 data 36 B
 2056.24  ← ss2 data (cont.) 5792 B
 2056.25  ← ss2 data (cont.) 2318 B
 2056.31  ← ss2 data (cont.) 5792 B
 2056.31  ← ss2 data (cont.) 2437 B
 2056.31  ← ss2 data 820 B
 2075.03  ← ss2 data 36 B
 2075.05  ← ss2 data 36 B
 2075.05  ← ss2 data 69 B
 2075.05  ← ss2 data 36 B
 2075.05  ← ss2 data 78 B
 2075.05  ← ss2 data 36 B
 2075.08  ← ss2 data 36 B
 2075.12  ← ss2 data 441 B
 2075.12  ← ss2 data 36 B
 2075.13  ← ss2 data 36 B
 2075.13  ← ss2 data 69 B
 2075.14  ← ss2 data 36 B
 2075.15  ← ss2 data 71 B
 2075.15  ← ss2 data 36 B
 2075.16  ← ss2 data 36 B
 2075.18  ← ss2 data 723 B
 2075.18  ← ss2 data 36 B
 2075.19  ← ss2 data 36 B
 2075.19  ← ss2 data 69 B
 2075.20  ← ss2 data 36 B
 2075.21  ← ss2 data 70 B
 2075.21  ← ss2 data 36 B
 2075.21  ← ss2 data 36 B
 2075.33  ← ss2 data (cont.) 5792 B
 2075.33  ← ss2 data (cont.) 2247 B
 2075.33  ← ss2 data 36 B
 2075.33  ← ss2 data 36 B
 2075.33  ← ss2 data 69 B
 2075.34  ← ss2 data 36 B
 2075.34  ← ss2 data 36 B
 2075.34  ← ss2 data 36 B
 2081.49  ss1 → ACK
 2100.20  ss1 → ACK
 2100.36  ss1 → ACK
 2100.36  ss1 → ACK
 2126.10  ss1 → data (cont.) 2896 B
 2126.10  ss1 → data (cont.) 2896 B
 2126.10  ss1 → data (cont.) 1374 B
 2144.54  ss1 → data (cont.) 2896 B
 2144.61  ss1 → data (cont.) 2896 B
 2144.61  ss1 → data (cont.) 2896 B
 2144.62  ss1 → data (cont.) 2896 B
 2151.52  ← ss2 ACK
 2169.90  ← ss2 ACK
 2176.61  ss1 → data (cont.) 603 B
 2225.95  ← ss2 data 236 B
 2225.98  ← ss2 data 69 B
 2225.98  ← ss2 data 36 B
 2225.98  ← ss2 data 81 B
 2225.99  ← ss2 data 36 B
 2225.99  ← ss2 data 36 B
 2225.99  ← ss2 data 426 B
 2226.20  ← ss2 data 36 B
 2226.21  ← ss2 data 36 B
 2226.21  ← ss2 data 69 B
 2226.21  ← ss2 data 36 B
 2226.22  ← ss2 data 77 B
 2226.23  ← ss2 data 36 B
 2226.23  ← ss2 data 36 B
 2226.36  ← ss2 data (cont.) 5792 B
 2226.36  ← ss2 data (cont.) 2318 B
 2226.42  ← ss2 data (cont.) 5792 B
 2226.42  ← ss2 data (cont.) 2437 B
 2226.43  ← ss2 data 820 B
 2242.33  ← ss2 data 36 B
 2242.36  ← ss2 data 36 B
 2242.36  ← ss2 data 69 B
 2242.36  ← ss2 data 36 B
 2242.37  ← ss2 data 78 B
 2242.37  ← ss2 data 36 B
 2242.38  ← ss2 data 36 B
 2242.38  ← ss2 data 441 B
 2242.39  ← ss2 data 36 B
 2242.40  ← ss2 data 36 B
 2242.41  ← ss2 data 69 B
 2242.42  ← ss2 data 36 B
 2242.42  ← ss2 data 71 B
 2242.43  ← ss2 data 36 B
 2242.43  ← ss2 data 36 B
 2242.44  ← ss2 data 723 B
 2242.46  ← ss2 data 36 B
 2242.46  ← ss2 data 36 B
 2242.46  ← ss2 data 69 B
 2242.46  ← ss2 data 36 B
 2242.47  ← ss2 data 70 B
 2242.47  ← ss2 data 36 B
 2242.48  ← ss2 data 36 B
 2242.51  ← ss2 data (cont.) 5792 B
 2242.52  ← ss2 data (cont.) 2247 B
 2242.52  ← ss2 data 36 B
 2242.53  ← ss2 data 36 B
 2242.54  ← ss2 data 69 B
 2242.54  ← ss2 data 36 B
 2242.54  ← ss2 data 36 B
 2242.56  ← ss2 data 36 B
 2251.61  ss1 → ACK
 2267.47  ss1 → ACK
 2267.56  ss1 → ACK
 2291.72  ss1 → data (cont.) 2896 B
 2291.72  ss1 → data (cont.) 2896 B
 2291.72  ss1 → data (cont.) 1374 B
 2308.01  ss1 → data (cont.) 2896 B
 2308.05  ss1 → data (cont.) 2896 B
 2308.05  ss1 → data (cont.) 2896 B
 2308.05  ss1 → data (cont.) 2896 B
 2317.08  ← ss2 ACK
 2333.32  ← ss2 ACK
 2342.13  ss1 → data (cont.) 603 B
 2391.31  ← ss2 data 236 B
 2391.33  ← ss2 data 69 B
 2391.33  ← ss2 data 36 B
 2391.33  ← ss2 data 81 B
 2391.33  ← ss2 data 36 B
 2391.33  ← ss2 data 36 B
 2391.33  ← ss2 data 426 B
 2391.59  ← ss2 data 36 B
 2391.61  ← ss2 data 36 B
 2391.63  ← ss2 data 69 B
 2391.63  ← ss2 data 36 B
 2391.64  ← ss2 data 77 B
 2391.64  ← ss2 data 36 B
 2391.64  ← ss2 data 36 B
 2391.73  ← ss2 data (cont.) 5792 B
 2391.74  ← ss2 data (cont.) 2318 B
 2391.79  ← ss2 data (cont.) 5792 B
 2391.79  ← ss2 data (cont.) 2437 B
 2391.80  ← ss2 data 820 B
 2409.32  ← ss2 data 36 B
 2409.35  ← ss2 data 36 B
 2409.35  ← ss2 data 69 B
 2409.35  ← ss2 data 36 B
 2409.35  ← ss2 data 78 B
 2409.36  ← ss2 data 36 B
 2409.36  ← ss2 data 36 B
 2409.37  ← ss2 data 441 B
 2409.37  ← ss2 data 36 B
 2409.37  ← ss2 data 36 B
 2409.38  ← ss2 data 69 B
 2409.39  ← ss2 data 36 B
 2409.39  ← ss2 data 71 B
 2409.39  ← ss2 data 36 B
 2409.40  ← ss2 data 36 B
 2409.40  ← ss2 data 723 B
 2409.40  ← ss2 data 36 B
 2409.42  ← ss2 data 36 B
 2409.42  ← ss2 data 69 B
 2409.42  ← ss2 data 36 B
 2409.42  ← ss2 data 70 B
 2409.43  ← ss2 data 36 B
 2409.43  ← ss2 data 36 B
 2409.47  ← ss2 data (cont.) 5792 B
 2409.48  ← ss2 data (cont.) 2247 B
 2409.48  ← ss2 data 36 B
 2409.48  ← ss2 data 36 B
 2409.48  ← ss2 data 69 B
 2409.49  ← ss2 data 36 B
 2409.49  ← ss2 data 36 B
 2409.52  ← ss2 data 36 B
 2416.85  ss1 → ACK
 2434.44  ss1 → ACK
 2434.57  ss1 → ACK
 2457.87  ss1 → data (cont.) 2896 B
 2457.88  ss1 → data (cont.) 2896 B
 2457.88  ss1 → data (cont.) 1374 B
 2473.12  ss1 → data (cont.) 2896 B
 2473.13  ss1 → data (cont.) 2896 B
 2473.13  ss1 → data (cont.) 2896 B
 2473.13  ss1 → data (cont.) 2896 B
 2483.29  ← ss2 ACK
 2498.43  ← ss2 ACK
 2508.39  ss1 → data (cont.) 603 B
 2556.97  ← ss2 data 236 B
 2556.98  ← ss2 data 69 B
 2556.98  ← ss2 data 36 B
 2556.98  ← ss2 data 81 B
 2556.98  ← ss2 data 36 B
 2556.98  ← ss2 data 36 B
 2556.98  ← ss2 data 426 B
 2557.14  ← ss2 data 36 B
 2557.15  ← ss2 data 36 B
 2557.15  ← ss2 data 69 B
 2557.16  ← ss2 data 36 B
 2557.16  ← ss2 data 77 B
 2557.17  ← ss2 data 36 B
 2557.17  ← ss2 data 36 B
 2557.24  ← ss2 data (cont.) 5792 B
 2557.24  ← ss2 data (cont.) 1366 B
 2557.30  ← ss2 data (cont.) 5792 B
 2557.30  ← ss2 data (cont.) 2437 B
 2557.31  ← ss2 data 1772 B
 2573.41  ← ss2 data 36 B
 2573.42  ← ss2 data 36 B
 2573.42  ← ss2 data 69 B
 2573.43  ← ss2 data 36 B
 2573.43  ← ss2 data 78 B
 2573.43  ← ss2 data 36 B
 2573.43  ← ss2 data 36 B
 2573.43  ← ss2 data 441 B
 2573.43  ← ss2 data 36 B
 2573.43  ← ss2 data 36 B
 2573.43  ← ss2 data 69 B
 2573.43  ← ss2 data 36 B
 2573.44  ← ss2 data 71 B
 2573.44  ← ss2 data 36 B
 2573.44  ← ss2 data 36 B
 2573.45  ← ss2 data 723 B
 2573.46  ← ss2 data 36 B
 2573.47  ← ss2 data 36 B
 2573.47  ← ss2 data 69 B
 2573.48  ← ss2 data 36 B
 2573.48  ← ss2 data 70 B
 2573.49  ← ss2 data 36 B
 2573.49  ← ss2 data 36 B
 2573.52  ← ss2 data (cont.) 5792 B
 2573.53  ← ss2 data (cont.) 2247 B
 2573.53  ← ss2 data 36 B
 2573.55  ← ss2 data 36 B
 2573.55  ← ss2 data 69 B
 2573.55  ← ss2 data 36 B
 2573.55  ← ss2 data 36 B
 2573.59  ← ss2 data 36 B
 2582.64  ss1 → ACK
 2598.49  ss1 → ACK
 2598.63  ss1 → ACK
 2622.09  ss1 → data (cont.) 2896 B
 2622.10  ss1 → data (cont.) 2896 B
 2622.10  ss1 → data (cont.) 1374 B
 2636.32  ss1 → data (cont.) 2896 B
 2636.32  ss1 → data (cont.) 2896 B
 2636.32  ss1 → data (cont.) 2896 B
 2636.32  ss1 → data (cont.) 2896 B
 2647.47  ← ss2 ACK
 2661.65  ← ss2 ACK
 2672.57  ss1 → data (cont.) 603 B
 2721.76  ← ss2 data 236 B
 2721.78  ← ss2 data 69 B
 2721.78  ← ss2 data 36 B
 2721.78  ← ss2 data 81 B
 2721.79  ← ss2 data 36 B
 2721.79  ← ss2 data 36 B
 2721.79  ← ss2 data 426 B
 2722.05  ← ss2 data 36 B
 2722.05  ← ss2 data 36 B
 2722.05  ← ss2 data 69 B
 2722.05  ← ss2 data 36 B
 2722.06  ← ss2 data 77 B
 2722.06  ← ss2 data 36 B
 2722.06  ← ss2 data 36 B
 2722.13  ← ss2 data (cont.) 5792 B
 2722.13  ← ss2 data (cont.) 2318 B
 2722.18  ← ss2 data (cont.) 5792 B
 2722.19  ← ss2 data (cont.) 2437 B
 2722.20  ← ss2 data 820 B
 2739.90  ← ss2 data 36 B
 2739.97  ← ss2 data 36 B
 2739.98  ← ss2 data 69 B
 2739.98  ← ss2 data 36 B
 2739.98  ← ss2 data 78 B
 2739.98  ← ss2 data 36 B
 2739.98  ← ss2 data 36 B
 2739.98  ← ss2 data 441 B
 2739.98  ← ss2 data 36 B
 2739.98  ← ss2 data 36 B
 2739.98  ← ss2 data 69 B
 2739.98  ← ss2 data 36 B
 2739.99  ← ss2 data 71 B
 2739.99  ← ss2 data 36 B
 2739.99  ← ss2 data 36 B
 2739.99  ← ss2 data 723 B
 2740.02  ← ss2 data 36 B
 2740.02  ← ss2 data 36 B
 2740.02  ← ss2 data 69 B
 2740.03  ← ss2 data 36 B
 2740.03  ← ss2 data 70 B
 2740.06  ← ss2 data 36 B
 2740.06  ← ss2 data 36 B
 2740.13  ← ss2 data (cont.) 5792 B
 2740.14  ← ss2 data (cont.) 2247 B
 2740.14  ← ss2 data 36 B
 2740.14  ← ss2 data 36 B
 2740.14  ← ss2 data 69 B
 2740.14  ← ss2 data 36 B
 2740.14  ← ss2 data 36 B
 2740.15  ← ss2 data 36 B
 2747.43  ss1 → ACK
 2765.07  ss1 → ACK
 2765.26  ss1 → ACK
 2790.34  ss1 → data (cont.) 2896 B
 2790.34  ss1 → data (cont.) 2896 B
 2790.34  ss1 → data (cont.) 1374 B
 2807.30  ss1 → data (cont.) 2896 B
 2807.31  ss1 → data (cont.) 2896 B
 2807.31  ss1 → data (cont.) 2896 B
 2807.31  ss1 → data (cont.) 2896 B
 2815.68  ← ss2 ACK
 2832.68  ← ss2 ACK
 2840.75  ss1 → data (cont.) 603 B
 2880.91  ← ss2 data 236 B
 2880.93  ← ss2 data 69 B
 2880.94  ← ss2 data 36 B
 2880.94  ← ss2 data 81 B
 2880.95  ← ss2 data 36 B
 2880.95  ← ss2 data 36 B
 2880.95  ← ss2 data 426 B
 2881.16  ← ss2 data 36 B
 2881.16  ← ss2 data 36 B
 2881.17  ← ss2 data 69 B
 2881.18  ← ss2 data 36 B
 2881.19  ← ss2 data 77 B
 2881.19  ← ss2 data 36 B
 2881.19  ← ss2 data 36 B
 2881.27  ← ss2 data (cont.) 5792 B
 2881.27  ← ss2 data (cont.) 2318 B
 2881.33  ← ss2 data (cont.) 5792 B
 2881.33  ← ss2 data (cont.) 2437 B
 2881.34  ← ss2 data 820 B
 2898.26  ← ss2 data 36 B
 2898.28  ← ss2 data 36 B
 2898.34  ← ss2 data 69 B
 2898.34  ← ss2 data 36 B
 2898.34  ← ss2 data 78 B
 2898.34  ← ss2 data 36 B
 2898.34  ← ss2 data 36 B
 2898.36  ← ss2 data 441 B
 2898.36  ← ss2 data 36 B
 2898.36  ← ss2 data 36 B
 2898.37  ← ss2 data 69 B
 2898.38  ← ss2 data 36 B
 2898.38  ← ss2 data 71 B
 2898.39  ← ss2 data 36 B
 2898.39  ← ss2 data 36 B
 2898.41  ← ss2 data 723 B
 2898.42  ← ss2 data 36 B
 2898.42  ← ss2 data 36 B
 2898.42  ← ss2 data 69 B
 2898.44  ← ss2 data 36 B
 2898.45  ← ss2 data 70 B
 2898.46  ← ss2 data 36 B
 2898.46  ← ss2 data 36 B
 2898.49  ← ss2 data (cont.) 5792 B
 2898.49  ← ss2 data (cont.) 2247 B
 2898.50  ← ss2 data 36 B
 2898.52  ← ss2 data 36 B
 2898.53  ← ss2 data 69 B
 2898.53  ← ss2 data 36 B
 2898.53  ← ss2 data 36 B
 2898.55  ← ss2 data 36 B
 2906.56  ss1 → ACK
 2923.45  ss1 → ACK
 2923.52  ss1 → ACK
 2929.27  ss1 → ACK
 2947.11  ss1 → data (cont.) 2896 B
 2947.11  ss1 → data (cont.) 2896 B
 2947.12  ss1 → data (cont.) 1374 B
 2964.23  ss1 → data (cont.) 2896 B
 2964.28  ss1 → data (cont.) 2896 B
 2964.28  ss1 → data (cont.) 2896 B
 2964.28  ss1 → data (cont.) 2896 B
 2972.47  ← ss2 ACK
 2989.72  ← ss2 ACK
 2997.53  ss1 → data (cont.) 603 B
 3040.74  ← ss2 data 236 B
 3040.82  ← ss2 data 69 B
 3040.82  ← ss2 data 36 B
 3040.82  ← ss2 data 81 B
 3040.83  ← ss2 data 36 B
 3040.83  ← ss2 data 36 B
 3040.83  ← ss2 data 426 B
 3041.14  ← ss2 data 36 B
 3041.15  ← ss2 data 36 B
 3041.15  ← ss2 data 69 B
 3041.16  ← ss2 data 36 B
 3041.17  ← ss2 data 77 B
 3041.17  ← ss2 data 36 B
 3041.17  ← ss2 data 36 B
 3041.50  ← ss2 data (cont.) 5792 B
 3041.51  ← ss2 data (cont.) 2318 B
 3041.62  ← ss2 data (cont.) 5792 B
 3041.63  ← ss2 data (cont.) 2437 B
 3041.83  ← ss2 data 820 B
 3062.22  ← ss2 data 36 B
 3062.25  ← ss2 data 36 B
 3062.27  ← ss2 data 69 B
 3062.27  ← ss2 data 36 B
 3062.27  ← ss2 data 78 B
 3062.27  ← ss2 data 36 B
 3062.27  ← ss2 data 36 B
 3062.27  ← ss2 data 441 B
 3062.29  ← ss2 data 36 B
 3062.29  ← ss2 data 36 B
 3062.29  ← ss2 data 69 B
 3062.29  ← ss2 data 36 B
 3062.29  ← ss2 data 71 B
 3062.29  ← ss2 data 36 B
 3062.29  ← ss2 data 36 B
 3062.30  ← ss2 data 723 B
 3062.30  ← ss2 data 36 B
 3062.30  ← ss2 data 36 B
 3062.30  ← ss2 data 69 B
 3062.30  ← ss2 data 36 B
 3062.30  ← ss2 data 70 B
 3062.30  ← ss2 data 36 B
 3062.31  ← ss2 data 36 B
 3062.34  ← ss2 data (cont.) 5792 B
 3062.35  ← ss2 data (cont.) 2247 B
 3062.35  ← ss2 data 36 B
 3062.36  ← ss2 data 36 B
 3062.36  ← ss2 data 69 B
 3062.36  ← ss2 data 36 B
 3062.37  ← ss2 data 36 B
 3062.41  ← ss2 data 36 B
 3066.56  ss1 → ACK
 3066.70  ss1 → ACK
 3087.31  ss1 → ACK
 3087.54  ss1 → ACK
 3112.29  ss1 → data (cont.) 2896 B
 3112.30  ss1 → data (cont.) 2896 B
 3112.30  ss1 → data (cont.) 1374 B
 3128.20  ss1 → data (cont.) 2896 B
 3128.20  ss1 → data (cont.) 2896 B
 3128.21  ss1 → data (cont.) 2896 B
 3128.21  ss1 → data (cont.) 2896 B
 3137.65  ← ss2 ACK
 3153.67  ← ss2 ACK
 3162.72  ss1 → data (cont.) 603 B
 3214.28  ← ss2 data 236 B
 3214.34  ← ss2 data 69 B
 3214.34  ← ss2 data 36 B
 3214.34  ← ss2 data 81 B
 3214.35  ← ss2 data 36 B
 3214.35  ← ss2 data 36 B
 3214.35  ← ss2 data 426 B
 3214.63  ← ss2 data 36 B
 3214.63  ← ss2 data 36 B
 3214.63  ← ss2 data 69 B
 3214.63  ← ss2 data 36 B
 3214.63  ← ss2 data 77 B
 3214.63  ← ss2 data 36 B
 3214.64  ← ss2 data 36 B
 3214.86  ← ss2 data (cont.) 5792 B
 3214.86  ← ss2 data (cont.) 2318 B
 3214.92  ← ss2 data (cont.) 5792 B
 3214.92  ← ss2 data (cont.) 2437 B
 3214.92  ← ss2 data 820 B
 3232.27  ← ss2 data 36 B
 3232.30  ← ss2 data 36 B
 3232.31  ← ss2 data 69 B
 3232.31  ← ss2 data 36 B
 3232.31  ← ss2 data 78 B
 3232.31  ← ss2 data 36 B
 3232.31  ← ss2 data 36 B
 3232.31  ← ss2 data 441 B
 3232.31  ← ss2 data 36 B
 3232.31  ← ss2 data 36 B
 3232.31  ← ss2 data 69 B
 3232.31  ← ss2 data 36 B
 3232.31  ← ss2 data 71 B
 3232.31  ← ss2 data 36 B
 3232.31  ← ss2 data 36 B
 3232.31  ← ss2 data 723 B
 3232.32  ← ss2 data 36 B
 3232.32  ← ss2 data 36 B
 3232.33  ← ss2 data 69 B
 3232.33  ← ss2 data 36 B
 3232.34  ← ss2 data 70 B
 3232.34  ← ss2 data 36 B
 3232.34  ← ss2 data 36 B
 3232.34  ← ss2 data (cont.) 5792 B
 3232.34  ← ss2 data (cont.) 2247 B
 3232.34  ← ss2 data 36 B
 3232.34  ← ss2 data 36 B
 3232.34  ← ss2 data 69 B
 3232.34  ← ss2 data 36 B
 3232.34  ← ss2 data 36 B
 3232.34  ← ss2 data 36 B
 3240.08  ss1 → ACK
 3257.41  ss1 → ACK
 3257.42  ss1 → ACK
 3264.02  ss1 → ACK
 3281.86  ss1 → data (cont.) 2896 B
 3281.86  ss1 → data (cont.) 2896 B
 3281.86  ss1 → data (cont.) 1374 B
 3297.71  ss1 → data (cont.) 2896 B
 3297.72  ss1 → data (cont.) 2896 B
 3297.72  ss1 → data (cont.) 2896 B
 3297.72  ss1 → data (cont.) 2896 B
 3307.28  ← ss2 ACK
 3323.00  ← ss2 ACK
 3332.37  ss1 → data (cont.) 603 B
 3385.45  ← ss2 data 236 B
 3385.48  ← ss2 data 69 B
 3385.48  ← ss2 data 36 B
 3385.48  ← ss2 data 81 B
 3385.48  ← ss2 data 36 B
 3385.48  ← ss2 data 36 B
 3385.48  ← ss2 data 426 B
 3385.86  ← ss2 data 36 B
 3385.86  ← ss2 data 36 B
 3385.86  ← ss2 data 69 B
 3385.86  ← ss2 data 36 B
 3385.86  ← ss2 data 77 B
 3385.86  ← ss2 data 36 B
 3385.86  ← ss2 data 36 B
 3386.05  ← ss2 data (cont.) 5792 B
 3386.05  ← ss2 data (cont.) 2318 B
 3386.11  ← ss2 data (cont.) 5792 B
 3386.11  ← ss2 data (cont.) 2437 B
 3386.11  ← ss2 data 820 B
 3402.78  ← ss2 data 36 B
 3402.79  ← ss2 data 36 B
 3402.79  ← ss2 data 69 B
 3402.79  ← ss2 data 36 B
 3402.80  ← ss2 data 78 B
 3402.80  ← ss2 data 36 B
 3402.80  ← ss2 data 36 B
 3402.80  ← ss2 data 441 B
 3402.81  ← ss2 data 36 B
 3402.81  ← ss2 data 36 B
 3402.88  ← ss2 data 69 B
 3402.88  ← ss2 data 36 B
 3402.89  ← ss2 data 71 B
 3402.89  ← ss2 data 36 B
 3402.89  ← ss2 data 36 B
 3402.90  ← ss2 data 723 B
 3402.91  ← ss2 data 36 B
 3402.92  ← ss2 data 36 B
 3402.92  ← ss2 data 69 B
 3402.92  ← ss2 data 36 B
 3402.92  ← ss2 data 70 B
 3402.92  ← ss2 data 36 B
 3402.93  ← ss2 data 36 B
 3402.98  ← ss2 data (cont.) 5792 B
 3402.99  ← ss2 data (cont.) 2247 B
 3403.17  ← ss2 data 36 B
 3403.19  ← ss2 data 36 B
 3403.19  ← ss2 data 69 B
 3403.19  ← ss2 data 36 B
 3403.19  ← ss2 data 36 B
 3403.22  ← ss2 data 36 B
```
