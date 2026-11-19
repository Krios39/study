# Обмены ss1 ↔ ss2: full, reuse × RTT 50 мс, 20 запросов по 19866 Б

| config | RTT задан | RTT потока (ядро) | соединения | запрос по записи, мс | curl, мс | паузы ≥0.4·RTT | сумма пауз, мс | др. порты |
|---|---|---|---|---|---|---|---|---|
| full | 50 | 51.30 (min 50.19) | new TCP + resumed TLS: 20 | 312.5 | 361.9 | 10 | 249.9 | — |
| reuse | 50 | 59.07 (min 50.07) | reused connection: 1 | 3509.5 | 168.0 | 54 | 1816.5 | — |

RTT потока — сглаженный rtt сокетов ss1 → ss2:5500 по ядру (ss -tin) во время запросов, в скобках minrtt (у соединений пула — минимум с момента открытия, в т. ч. до смены задержки). В хронологии исходящие пакеты ss1 видны уже после очереди netem (сдвиг на RTT/2), входящие — по приходу. Запрос по записи — от первого пакета запроса до последних данных ответа на канале ss1 ↔ ss2. Пауза — промежуток между соседними пакетами запроса не меньше max(0.4·RTT, 1 мс).

## full, RTT 50 мс — медианный запрос (new TCP + resumed TLS, 312.8 мс)

Паузы:
- 22.1 мс: после «← ss2 ACK» до «← ss2 SYN-ACK»
- 25.1 мс: после «← ss2 SYN-ACK» до «ss1 → ACK»
- 25.1 мс: после «ss1 → ClientHello 2800 B» до «← ss2 ACK»
- 25.0 мс: после «← ss2 Finished (enc.) 45 B» до «ss1 → ACK»
- 25.1 мс: после «ss1 → data (cont.) 502 B» до «← ss2 ACK»
- 23.5 мс: после «← ss2 ACK» до «← ss2 data 224 B»
- 25.7 мс: после «← ss2 data 63 B» до «ss1 → ACK»
- 25.1 мс: после «ss1 → ACK» до «← ss2 data 2896 B»
- 25.0 мс: после «← ss2 data (cont.) 2896 B» до «ss1 → ACK»
- 25.2 мс: после «ss1 → ACK» до «← ss2 FIN 1411 B»

```
    0.00  ss1 → SYN
    3.01  ← ss2 ACK
    3.01  ← ss2 ACK
   25.11  ← ss2 SYN-ACK
   50.22  ss1 → ACK
   51.19  ss1 → ClientHello 2800 B
   76.29  ← ss2 ACK
   77.73  ← ss2 TLS hs 2+4 2660 B
   77.77  ← ss2 ChangeCipherSpec 6 B
   77.77  ← ss2 Finished (enc.) 45 B
  102.80  ss1 → ACK
  102.80  ss1 → ACK
  102.80  ss1 → ACK
  103.82  ss1 → ChangeCipherSpec 6 B
  112.39  ss1 → Finished (enc.) 2896 B
  112.39  ss1 → data (cont.) 2896 B
  130.87  ss1 → data (cont.) 2896 B
  130.87  ss1 → data (cont.) 2896 B
  130.87  ss1 → data (cont.) 1448 B
  137.52  ← ss2 ACK
  137.55  ← ss2 ACK
  156.06  ← ss2 ACK
  156.07  ← ss2 ACK
  162.60  ss1 → data (cont.) 2896 B
  162.60  ss1 → data (cont.) 2896 B
  162.60  ss1 → data (cont.) 2896 B
  162.60  ss1 → data (cont.) 502 B
  187.72  ← ss2 ACK
  187.95  ← ss2 ACK
  211.50  ← ss2 data 224 B
  211.52  ← ss2 data 63 B
  211.52  ← ss2 data 31 B
  211.53  ← ss2 data 75 B
  211.53  ← ss2 data 31 B
  211.53  ← ss2 data 31 B
  211.53  ← ss2 data 419 B
  211.69  ← ss2 data 31 B
  211.69  ← ss2 data 31 B
  211.69  ← ss2 data 63 B
  237.41  ss1 → ACK
  262.54  ← ss2 data 2896 B
  262.57  ← ss2 data (cont.) 2896 B
  262.58  ← ss2 data (cont.) 2896 B
  262.58  ← ss2 data (cont.) 2896 B
  262.58  ← ss2 data (cont.) 2896 B
  262.58  ← ss2 data (cont.) 2896 B
  262.58  ← ss2 data (cont.) 2896 B
  262.58  ← ss2 data (cont.) 2896 B
  262.58  ← ss2 data (cont.) 2896 B
  262.58  ← ss2 data (cont.) 2896 B
  287.63  ss1 → ACK
  287.63  ss1 → ACK
  287.63  ss1 → ACK
  287.63  ss1 → ACK
  312.82  ← ss2 FIN 1411 B
```

## reuse, RTT 50 мс — медианный запрос (reused connection, 3509.5 мс)

Паузы:
- 21.1 мс: после «ss1 → data (cont.) 1374 B» до «ss1 → data (cont.) 2896 B»
- 21.2 мс: после «← ss2 ACK» до «← ss2 ACK»
- 25.4 мс: после «ss1 → data (cont.) 1979 B» до «← ss2 ACK»
- 33.1 мс: после «← ss2 ACK» до «← ss2 data 236 B»
- 24.9 мс: после «← ss2 data 69 B» до «ss1 → ACK»
- 24.9 мс: после «ss1 → ACK» до «← ss2 data 2896 B»
- 25.0 мс: после «← ss2 data (cont.) 2896 B» до «ss1 → ACK»
- 25.2 мс: после «ss1 → ACK» до «← ss2 data (cont.) 1619 B»
- 25.1 мс: после «← ss2 data (cont.) 1619 B» до «ss1 → ACK»
- 36.9 мс: после «ss1 → ACK» до «ss1 → data (cont.) 2896 B»
- 52.3 мс: после «ss1 → data (cont.) 531 B» до «← ss2 data 236 B»
- 24.4 мс: после «← ss2 data (cont.) 1694 B» до «← ss2 data 36 B»
- 25.1 мс: после «ss1 → ACK» до «← ss2 data 2896 B»
- 25.1 мс: после «ss1 → ACK» до «ss1 → ACK»
- 26.9 мс: после «ss1 → ACK» до «ss1 → data (cont.) 2896 B»
- 41.1 мс: после «ss1 → data (cont.) 531 B» до «← ss2 data 236 B»
- 28.5 мс: после «ss1 → ACK» до «ss1 → data (cont.) 2896 B»
- 50.1 мс: после «ss1 → data (cont.) 531 B» до «← ss2 data 236 B»
- 24.5 мс: после «ss1 → ACK» до «ss1 → data (cont.) 2896 B»
- 50.1 мс: после «ss1 → data (cont.) 531 B» до «← ss2 data 236 B»
- 31.3 мс: после «ss1 → ACK» до «ss1 → data (cont.) 2896 B»
- 49.4 мс: после «ss1 → data (cont.) 531 B» до «← ss2 data 236 B»
- 50.2 мс: после «ss1 → data (cont.) 531 B» до «← ss2 data 236 B»
- 25.9 мс: после «ss1 → ACK» до «ss1 → data (cont.) 2896 B»
- 50.1 мс: после «ss1 → data (cont.) 531 B» до «← ss2 data 236 B»
- 30.0 мс: после «ss1 → ACK» до «ss1 → data (cont.) 2896 B»
- 50.2 мс: после «ss1 → data (cont.) 531 B» до «← ss2 data 236 B»
- 28.0 мс: после «ss1 → ACK» до «ss1 → data (cont.) 2896 B»
- 52.2 мс: после «ss1 → data (cont.) 531 B» до «← ss2 data 236 B»
- 25.0 мс: после «← ss2 data 3637 B» до «ss1 → ACK»
- 25.0 мс: после «← ss2 data 36 B» до «ss1 → ACK»
- 53.0 мс: после «ss1 → data (cont.) 531 B» до «← ss2 data 236 B»
- 20.5 мс: после «← ss2 data 4590 B» до «← ss2 data 36 B»
- 20.6 мс: после «ss1 → ACK» до «ss1 → ACK»
- 27.2 мс: после «ss1 → ACK» до «ss1 → data (cont.) 2896 B»
- 50.2 мс: после «ss1 → data (cont.) 531 B» до «← ss2 data 236 B»
- 26.0 мс: после «ss1 → ACK» до «ss1 → data (cont.) 2896 B»
- 50.2 мс: после «ss1 → data (cont.) 531 B» до «← ss2 data 236 B»
- 20.2 мс: после «← ss2 data 4590 B» до «← ss2 data 36 B»
- 20.1 мс: после «ss1 → ACK» до «ss1 → ACK»
- 25.1 мс: после «ss1 → ACK» до «ss1 → data (cont.) 2896 B»
- 49.7 мс: после «ss1 → data (cont.) 531 B» до «← ss2 data 236 B»
- 40.5 мс: после «ss1 → data (cont.) 531 B» до «← ss2 data 236 B»
- 49.4 мс: после «ss1 → data (cont.) 531 B» до «← ss2 data 236 B»
- 24.2 мс: после «← ss2 data 4590 B» до «← ss2 data 36 B»
- 24.4 мс: после «ss1 → ACK» до «ss1 → ACK»
- 50.3 мс: после «ss1 → data (cont.) 531 B» до «← ss2 data 236 B»
- 21.3 мс: после «← ss2 data 3637 B» до «← ss2 data 36 B»
- 21.3 мс: после «ss1 → ACK» до «ss1 → ACK»
- 49.3 мс: после «ss1 → data (cont.) 531 B» до «← ss2 data 236 B»
- 49.2 мс: после «ss1 → data (cont.) 531 B» до «← ss2 data 236 B»
- 23.6 мс: после «ss1 → ACK» до «ss1 → data (cont.) 2896 B»
- 49.1 мс: после «ss1 → data (cont.) 531 B» до «← ss2 data 236 B»
- 22.8 мс: после «← ss2 data 4590 B» до «← ss2 data 36 B»

```
    0.00  ss1 → data (cont.) 2896 B
    0.01  ss1 → data (cont.) 2896 B
    0.01  ss1 → data (cont.) 1374 B
   21.15  ss1 → data (cont.) 2896 B
   21.16  ss1 → data (cont.) 2896 B
   21.16  ss1 → data (cont.) 1448 B
   25.55  ← ss2 ACK
   46.71  ← ss2 ACK
   50.61  ss1 → data (cont.) 2896 B
   50.61  ss1 → data (cont.) 2896 B
   50.61  ss1 → data (cont.) 1979 B
   76.03  ← ss2 ACK
  109.17  ← ss2 data 236 B
  109.25  ← ss2 data 69 B
  109.28  ← ss2 data 36 B
  109.31  ← ss2 data 81 B
  109.33  ← ss2 data 36 B
  109.34  ← ss2 data 36 B
  109.36  ← ss2 data 426 B
  109.91  ← ss2 data 36 B
  109.93  ← ss2 data 36 B
  109.99  ← ss2 data 69 B
  134.89  ss1 → ACK
  135.08  ss1 → ACK
  160.01  ← ss2 data 2896 B
  160.05  ← ss2 data (cont.) 2896 B
  160.06  ← ss2 data (cont.) 2896 B
  160.06  ← ss2 data (cont.) 2896 B
  160.07  ← ss2 data (cont.) 2896 B
  160.07  ← ss2 data (cont.) 2896 B
  160.07  ← ss2 data (cont.) 2896 B
  160.12  ← ss2 data (cont.) 2896 B
  160.13  ← ss2 data (cont.) 2896 B
  160.13  ← ss2 data (cont.) 2896 B
  185.16  ss1 → ACK
  185.17  ss1 → ACK
  210.32  ← ss2 data (cont.) 1619 B
  235.44  ss1 → ACK
  272.35  ss1 → data (cont.) 2896 B
  272.36  ss1 → data (cont.) 2896 B
  272.36  ss1 → data (cont.) 1374 B
  291.48  ss1 → data (cont.) 2896 B
  291.49  ss1 → data (cont.) 2896 B
  291.49  ss1 → data (cont.) 2896 B
  291.49  ss1 → data (cont.) 2896 B
  291.49  ss1 → data (cont.) 2896 B
  297.79  ← ss2 ACK
  316.91  ← ss2 ACK
  322.92  ss1 → data (cont.) 531 B
  375.26  ← ss2 data 236 B
  375.30  ← ss2 data 69 B
  375.30  ← ss2 data 36 B
  375.30  ← ss2 data 81 B
  375.31  ← ss2 data 36 B
  375.31  ← ss2 data 36 B
  375.31  ← ss2 data 426 B
  375.88  ← ss2 data 36 B
  375.90  ← ss2 data 36 B
  375.93  ← ss2 data 69 B
  375.94  ← ss2 data 36 B
  375.95  ← ss2 data 77 B
  375.96  ← ss2 data 36 B
  375.97  ← ss2 data 36 B
  376.09  ← ss2 data (cont.) 2896 B
  376.10  ← ss2 data (cont.) 2896 B
  376.10  ← ss2 data (cont.) 1366 B
  376.16  ← ss2 data (cont.) 2896 B
  376.17  ← ss2 data (cont.) 2896 B
  376.17  ← ss2 data (cont.) 2437 B
  376.17  ← ss2 data (cont.) 2896 B
  376.18  ← ss2 data (cont.) 1694 B
  400.57  ← ss2 data 36 B
  400.61  ← ss2 data 36 B
  400.62  ← ss2 data 69 B
  400.62  ← ss2 data 36 B
  400.62  ← ss2 data 78 B
  400.63  ← ss2 data 36 B
  400.63  ← ss2 data 36 B
  400.63  ← ss2 data 441 B
  400.63  ← ss2 data 36 B
  400.63  ← ss2 data 36 B
  400.63  ← ss2 data 69 B
  400.63  ← ss2 data 36 B
  400.63  ← ss2 data 71 B
  401.25  ss1 → ACK
  426.38  ← ss2 data 2896 B
  426.40  ← ss2 data (cont.) 2896 B
  426.40  ← ss2 data (cont.) 2896 B
  426.40  ← ss2 data (cont.) 714 B
  426.41  ss1 → ACK
  451.53  ss1 → ACK
  478.46  ss1 → data (cont.) 2896 B
  478.46  ss1 → data (cont.) 2896 B
  478.46  ss1 → data (cont.) 1374 B
  496.36  ss1 → data (cont.) 2896 B
  496.37  ss1 → data (cont.) 2896 B
  496.37  ss1 → data (cont.) 2896 B
  496.37  ss1 → data (cont.) 2896 B
  496.37  ss1 → data (cont.) 2896 B
  503.84  ← ss2 ACK
  521.72  ← ss2 ACK
  528.91  ss1 → data (cont.) 531 B
  569.98  ← ss2 data 236 B
  570.02  ← ss2 data 69 B
  570.02  ← ss2 data 36 B
  570.02  ← ss2 data 81 B
  570.02  ← ss2 data 36 B
  570.02  ← ss2 data 36 B
  570.02  ← ss2 data 426 B
  570.40  ← ss2 data 36 B
  570.41  ← ss2 data 36 B
  570.42  ← ss2 data 69 B
  570.42  ← ss2 data 36 B
  570.42  ← ss2 data 77 B
  570.42  ← ss2 data 36 B
  570.42  ← ss2 data 36 B
  570.54  ← ss2 data (cont.) 4344 B
  570.54  ← ss2 data (cont.) 2814 B
  570.60  ← ss2 data (cont.) 4344 B
  570.61  ← ss2 data (cont.) 3885 B
  570.61  ← ss2 data (cont.) 4344 B
  570.61  ← ss2 data (cont.) 246 B
  589.43  ← ss2 data 36 B
  589.46  ← ss2 data 36 B
  589.47  ← ss2 data 69 B
  589.48  ← ss2 data 36 B
  589.48  ← ss2 data 78 B
  589.48  ← ss2 data 36 B
  589.48  ← ss2 data 36 B
  589.48  ← ss2 data 441 B
  589.49  ← ss2 data 36 B
  589.49  ← ss2 data 36 B
  589.50  ← ss2 data 69 B
  589.51  ← ss2 data 36 B
  589.51  ← ss2 data 71 B
  589.52  ← ss2 data 36 B
  589.52  ← ss2 data 36 B
  589.53  ← ss2 data 723 B
  589.55  ← ss2 data 36 B
  589.55  ← ss2 data 36 B
  589.56  ← ss2 data 69 B
  589.58  ← ss2 data 36 B
  589.58  ← ss2 data 70 B
  589.59  ← ss2 data 36 B
  589.59  ← ss2 data 36 B
  589.67  ← ss2 data (cont.) 4344 B
  589.67  ← ss2 data (cont.) 3695 B
  589.68  ← ss2 data 36 B
  589.68  ← ss2 data 36 B
  589.68  ← ss2 data 69 B
  589.68  ← ss2 data 36 B
  589.69  ← ss2 data 36 B
  589.69  ← ss2 data 36 B
  595.72  ss1 → ACK
  614.58  ss1 → ACK
  614.71  ss1 → ACK
  643.19  ss1 → data (cont.) 2896 B
  643.20  ss1 → data (cont.) 2896 B
  643.20  ss1 → data (cont.) 1374 B
  660.40  ss1 → data (cont.) 2896 B
  660.40  ss1 → data (cont.) 2896 B
  660.46  ss1 → data (cont.) 2896 B
  660.46  ss1 → data (cont.) 2896 B
  660.46  ss1 → data (cont.) 2896 B
  668.64  ← ss2 ACK
  685.84  ← ss2 ACK
  693.73  ss1 → data (cont.) 531 B
  743.83  ← ss2 data 236 B
  743.85  ← ss2 data 69 B
  743.86  ← ss2 data 36 B
  743.87  ← ss2 data 81 B
  743.88  ← ss2 data 36 B
  743.88  ← ss2 data 36 B
  743.89  ← ss2 data 426 B
  744.15  ← ss2 data 36 B
  744.16  ← ss2 data 36 B
  744.17  ← ss2 data 69 B
  744.18  ← ss2 data 36 B
  744.18  ← ss2 data 77 B
  744.19  ← ss2 data 36 B
  744.20  ← ss2 data 36 B
  744.43  ← ss2 data 7158 B
  744.53  ← ss2 data (cont.) 7240 B
  744.53  ← ss2 data (cont.) 989 B
  744.56  ← ss2 data 4590 B
  762.67  ← ss2 data 36 B
  762.69  ← ss2 data 36 B
  762.69  ← ss2 data 69 B
  762.69  ← ss2 data 36 B
  762.69  ← ss2 data 78 B
  762.69  ← ss2 data 36 B
  762.69  ← ss2 data 36 B
  762.69  ← ss2 data 441 B
  762.69  ← ss2 data 36 B
  762.69  ← ss2 data 36 B
  762.69  ← ss2 data 69 B
  762.71  ← ss2 data 36 B
  762.71  ← ss2 data 71 B
  762.71  ← ss2 data 36 B
  762.71  ← ss2 data 36 B
  762.71  ← ss2 data 723 B
  762.72  ← ss2 data 36 B
  762.72  ← ss2 data 36 B
  762.73  ← ss2 data 69 B
  762.73  ← ss2 data 36 B
  762.73  ← ss2 data 70 B
  762.73  ← ss2 data 36 B
  762.73  ← ss2 data 36 B
  762.76  ← ss2 data (cont.) 7240 B
  762.77  ← ss2 data (cont.) 799 B
  762.77  ← ss2 data 36 B
  762.78  ← ss2 data 36 B
  762.79  ← ss2 data 69 B
  762.79  ← ss2 data 36 B
  762.79  ← ss2 data 36 B
  762.81  ← ss2 data 36 B
  769.47  ss1 → ACK
  769.58  ss1 → ACK
  787.76  ss1 → ACK
  787.81  ss1 → ACK
  812.35  ss1 → data (cont.) 2896 B
  812.36  ss1 → data (cont.) 2896 B
  812.36  ss1 → data (cont.) 1374 B
  830.84  ss1 → data (cont.) 2896 B
  830.84  ss1 → data (cont.) 2896 B
  830.84  ss1 → data (cont.) 2896 B
  830.84  ss1 → data (cont.) 2896 B
  830.84  ss1 → data (cont.) 2896 B
  837.80  ← ss2 ACK
  856.16  ← ss2 ACK
  862.85  ss1 → data (cont.) 531 B
  912.96  ← ss2 data 236 B
  912.99  ← ss2 data 69 B
  912.99  ← ss2 data 36 B
  913.00  ← ss2 data 81 B
  913.00  ← ss2 data 36 B
  913.00  ← ss2 data 36 B
  913.00  ← ss2 data 426 B
  913.25  ← ss2 data 36 B
  913.26  ← ss2 data 36 B
  913.27  ← ss2 data 69 B
  913.27  ← ss2 data 36 B
  913.28  ← ss2 data 77 B
  913.29  ← ss2 data 36 B
  913.29  ← ss2 data 36 B
  913.49  ← ss2 data (cont.) 5792 B
  913.49  ← ss2 data (cont.) 1366 B
  913.56  ← ss2 data (cont.) 5792 B
  913.57  ← ss2 data (cont.) 2437 B
  913.60  ← ss2 data 4590 B
  930.52  ← ss2 data 36 B
  930.55  ← ss2 data 36 B
  930.56  ← ss2 data 69 B
  930.56  ← ss2 data 36 B
  930.56  ← ss2 data 78 B
  930.56  ← ss2 data 36 B
  930.56  ← ss2 data 36 B
  930.56  ← ss2 data 441 B
  930.56  ← ss2 data 36 B
  930.56  ← ss2 data 36 B
  930.57  ← ss2 data 69 B
  930.58  ← ss2 data 36 B
  930.59  ← ss2 data 71 B
  930.60  ← ss2 data 36 B
  930.60  ← ss2 data 36 B
  930.61  ← ss2 data 723 B
  930.65  ← ss2 data 36 B
  930.65  ← ss2 data 36 B
  930.65  ← ss2 data 69 B
  930.65  ← ss2 data 36 B
  930.65  ← ss2 data 70 B
  930.65  ← ss2 data 36 B
  930.65  ← ss2 data 36 B
  930.70  ← ss2 data (cont.) 5792 B
  930.70  ← ss2 data (cont.) 2247 B
  930.71  ← ss2 data 36 B
  930.71  ← ss2 data 36 B
  930.72  ← ss2 data 69 B
  930.72  ← ss2 data 36 B
  930.73  ← ss2 data 36 B
  930.75  ← ss2 data 36 B
  938.66  ss1 → ACK
  955.67  ss1 → ACK
  955.80  ss1 → ACK
  987.06  ss1 → data (cont.) 2896 B
  987.06  ss1 → data (cont.) 2896 B
  987.06  ss1 → data (cont.) 1374 B
 1006.19  ss1 → data (cont.) 2896 B
 1006.19  ss1 → data (cont.) 2896 B
 1006.25  ss1 → data (cont.) 2896 B
 1006.25  ss1 → data (cont.) 2896 B
 1006.25  ss1 → data (cont.) 2896 B
 1012.51  ← ss2 ACK
 1031.47  ← ss2 ACK
 1037.56  ss1 → data (cont.) 531 B
 1086.97  ← ss2 data 236 B
 1087.01  ← ss2 data 69 B
 1087.02  ← ss2 data 36 B
 1087.03  ← ss2 data 81 B
 1087.04  ← ss2 data 36 B
 1087.04  ← ss2 data 36 B
 1087.04  ← ss2 data 426 B
 1087.32  ← ss2 data 36 B
 1087.33  ← ss2 data 36 B
 1087.33  ← ss2 data 69 B
 1087.33  ← ss2 data 36 B
 1087.33  ← ss2 data 77 B
 1087.33  ← ss2 data 36 B
 1087.33  ← ss2 data 36 B
 1087.40  ← ss2 data 7158 B
 1087.45  ← ss2 data (cont.) 7240 B
 1087.46  ← ss2 data (cont.) 989 B
 1087.46  ← ss2 data 4590 B
 1105.00  ← ss2 data 36 B
 1105.04  ← ss2 data 36 B
 1105.05  ← ss2 data 69 B
 1105.05  ← ss2 data 36 B
 1105.05  ← ss2 data 78 B
 1105.05  ← ss2 data 36 B
 1105.05  ← ss2 data 36 B
 1105.05  ← ss2 data 441 B
 1105.08  ← ss2 data 36 B
 1105.08  ← ss2 data 36 B
 1105.08  ← ss2 data 69 B
 1105.10  ← ss2 data 36 B
 1105.10  ← ss2 data 71 B
 1105.19  ← ss2 data 36 B
 1105.20  ← ss2 data 36 B
 1105.20  ← ss2 data 723 B
 1105.21  ← ss2 data 36 B
 1105.21  ← ss2 data 36 B
 1105.22  ← ss2 data 69 B
 1105.22  ← ss2 data 36 B
 1105.22  ← ss2 data 70 B
 1105.22  ← ss2 data 36 B
 1105.22  ← ss2 data 36 B
 1105.23  ← ss2 data (cont.) 7240 B
 1105.23  ← ss2 data (cont.) 799 B
 1105.23  ← ss2 data 36 B
 1105.23  ← ss2 data 36 B
 1105.23  ← ss2 data 69 B
 1105.31  ← ss2 data 36 B
 1105.31  ← ss2 data 36 B
 1105.31  ← ss2 data 36 B
 1112.63  ss1 → ACK
 1130.25  ss1 → ACK
 1130.30  ss1 → ACK
 1136.70  ss1 → ACK
 1155.39  ss1 → data (cont.) 2896 B
 1155.39  ss1 → data (cont.) 2896 B
 1155.39  ss1 → data (cont.) 1374 B
 1172.75  ss1 → data (cont.) 2896 B
 1172.76  ss1 → data (cont.) 2896 B
 1172.76  ss1 → data (cont.) 2896 B
 1172.77  ss1 → data (cont.) 2896 B
 1172.77  ss1 → data (cont.) 2896 B
 1180.81  ← ss2 ACK
 1198.06  ← ss2 ACK
 1205.90  ss1 → data (cont.) 531 B
 1256.07  ← ss2 data 236 B
 1256.08  ← ss2 data 69 B
 1256.09  ← ss2 data 36 B
 1256.10  ← ss2 data 81 B
 1256.10  ← ss2 data 36 B
 1256.10  ← ss2 data 36 B
 1256.18  ← ss2 data 426 B
 1256.43  ← ss2 data 36 B
 1256.46  ← ss2 data 36 B
 1256.47  ← ss2 data 69 B
 1256.48  ← ss2 data 36 B
 1256.48  ← ss2 data 77 B
 1256.49  ← ss2 data 36 B
 1256.49  ← ss2 data 36 B
 1256.60  ← ss2 data (cont.) 7240 B
 1256.60  ← ss2 data (cont.) 870 B
 1256.66  ← ss2 data (cont.) 7240 B
 1256.66  ← ss2 data (cont.) 989 B
 1256.70  ← ss2 data 3637 B
 1274.51  ← ss2 data 36 B
 1274.53  ← ss2 data 36 B
 1274.55  ← ss2 data 69 B
 1274.55  ← ss2 data 36 B
 1274.55  ← ss2 data 78 B
 1274.55  ← ss2 data 36 B
 1274.55  ← ss2 data 36 B
 1274.56  ← ss2 data 441 B
 1274.56  ← ss2 data 36 B
 1274.56  ← ss2 data 36 B
 1274.56  ← ss2 data 69 B
 1274.56  ← ss2 data 36 B
 1274.56  ← ss2 data 71 B
 1274.58  ← ss2 data 36 B
 1274.58  ← ss2 data 36 B
 1274.58  ← ss2 data 723 B
 1274.61  ← ss2 data 36 B
 1274.61  ← ss2 data 36 B
 1274.61  ← ss2 data 69 B
 1274.61  ← ss2 data 36 B
 1274.61  ← ss2 data 70 B
 1274.62  ← ss2 data 36 B
 1274.62  ← ss2 data 36 B
 1274.65  ← ss2 data (cont.) 7240 B
 1274.65  ← ss2 data (cont.) 799 B
 1274.66  ← ss2 data 36 B
 1274.67  ← ss2 data 36 B
 1274.67  ← ss2 data 69 B
 1274.68  ← ss2 data 36 B
 1274.68  ← ss2 data 36 B
 1274.70  ← ss2 data 36 B
 1281.90  ss1 → ACK
 1299.63  ss1 → ACK
 1299.73  ss1 → ACK
 1325.60  ss1 → data (cont.) 2896 B
 1325.60  ss1 → data (cont.) 2896 B
 1325.60  ss1 → data (cont.) 1374 B
 1343.19  ss1 → data (cont.) 2896 B
 1343.19  ss1 → data (cont.) 2896 B
 1343.19  ss1 → data (cont.) 2896 B
 1343.19  ss1 → data (cont.) 2896 B
 1343.19  ss1 → data (cont.) 2896 B
 1350.92  ← ss2 ACK
 1368.57  ← ss2 ACK
 1375.96  ss1 → data (cont.) 531 B
 1426.08  ← ss2 data 236 B
 1426.11  ← ss2 data 69 B
 1426.11  ← ss2 data 36 B
 1426.11  ← ss2 data 81 B
 1426.12  ← ss2 data 36 B
 1426.12  ← ss2 data 36 B
 1426.12  ← ss2 data 426 B
 1426.30  ← ss2 data 36 B
 1426.31  ← ss2 data 36 B
 1426.31  ← ss2 data 69 B
 1426.31  ← ss2 data 36 B
 1426.32  ← ss2 data 77 B
 1426.32  ← ss2 data 36 B
 1426.32  ← ss2 data 36 B
 1426.42  ← ss2 data (cont.) 7240 B
 1426.42  ← ss2 data (cont.) 870 B
 1426.49  ← ss2 data (cont.) 7240 B
 1426.49  ← ss2 data (cont.) 989 B
 1426.51  ← ss2 data 3637 B
 1442.90  ← ss2 data 36 B
 1442.93  ← ss2 data 36 B
 1442.94  ← ss2 data 69 B
 1442.94  ← ss2 data 36 B
 1442.94  ← ss2 data 78 B
 1442.94  ← ss2 data 36 B
 1442.94  ← ss2 data 36 B
 1442.94  ← ss2 data 441 B
 1442.96  ← ss2 data 36 B
 1442.96  ← ss2 data 36 B
 1442.96  ← ss2 data 69 B
 1442.96  ← ss2 data 36 B
 1442.96  ← ss2 data 71 B
 1442.96  ← ss2 data 36 B
 1442.96  ← ss2 data 36 B
 1442.96  ← ss2 data 723 B
 1442.97  ← ss2 data 36 B
 1442.97  ← ss2 data 36 B
 1442.97  ← ss2 data 69 B
 1442.97  ← ss2 data 36 B
 1442.97  ← ss2 data 70 B
 1442.97  ← ss2 data 36 B
 1442.97  ← ss2 data 36 B
 1443.01  ← ss2 data (cont.) 7240 B
 1443.02  ← ss2 data (cont.) 799 B
 1443.02  ← ss2 data 36 B
 1443.03  ← ss2 data 36 B
 1443.03  ← ss2 data 69 B
 1443.04  ← ss2 data 36 B
 1443.04  ← ss2 data 36 B
 1443.06  ← ss2 data 36 B
 1451.71  ss1 → ACK
 1468.07  ss1 → ACK
 1468.25  ss1 → ACK
 1498.26  ss1 → data (cont.) 2896 B
 1498.27  ss1 → data (cont.) 2896 B
 1498.27  ss1 → data (cont.) 1374 B
 1514.35  ss1 → data (cont.) 2896 B
 1514.35  ss1 → data (cont.) 2896 B
 1514.39  ss1 → data (cont.) 2896 B
 1514.39  ss1 → data (cont.) 2896 B
 1514.39  ss1 → data (cont.) 2896 B
 1523.61  ← ss2 ACK
 1539.61  ← ss2 ACK
 1548.64  ss1 → data (cont.) 531 B
 1598.79  ← ss2 data 236 B
 1598.82  ← ss2 data 69 B
 1598.82  ← ss2 data 36 B
 1598.82  ← ss2 data 81 B
 1598.82  ← ss2 data 36 B
 1598.82  ← ss2 data 36 B
 1598.82  ← ss2 data 426 B
 1599.10  ← ss2 data 36 B
 1599.11  ← ss2 data 36 B
 1599.12  ← ss2 data 69 B
 1599.14  ← ss2 data 36 B
 1599.14  ← ss2 data 77 B
 1599.15  ← ss2 data 36 B
 1599.15  ← ss2 data 36 B
 1599.23  ← ss2 data 7158 B
 1599.29  ← ss2 data (cont.) 7240 B
 1599.30  ← ss2 data (cont.) 989 B
 1599.33  ← ss2 data 4590 B
 1616.98  ← ss2 data 36 B
 1617.01  ← ss2 data 36 B
 1617.01  ← ss2 data 69 B
 1617.01  ← ss2 data 36 B
 1617.03  ← ss2 data 78 B
 1617.03  ← ss2 data 36 B
 1617.03  ← ss2 data 36 B
 1617.03  ← ss2 data 441 B
 1617.03  ← ss2 data 36 B
 1617.03  ← ss2 data 36 B
 1617.03  ← ss2 data 69 B
 1617.03  ← ss2 data 36 B
 1617.03  ← ss2 data 71 B
 1617.03  ← ss2 data 36 B
 1617.03  ← ss2 data 36 B
 1617.03  ← ss2 data 723 B
 1617.05  ← ss2 data 36 B
 1617.06  ← ss2 data 36 B
 1617.07  ← ss2 data 69 B
 1617.07  ← ss2 data 36 B
 1617.08  ← ss2 data 70 B
 1617.08  ← ss2 data 36 B
 1617.09  ← ss2 data 36 B
 1617.13  ← ss2 data (cont.) 7240 B
 1617.13  ← ss2 data (cont.) 799 B
 1617.14  ← ss2 data 36 B
 1617.14  ← ss2 data 36 B
 1617.15  ← ss2 data 69 B
 1617.16  ← ss2 data 36 B
 1617.16  ← ss2 data 36 B
 1617.18  ← ss2 data 36 B
 1624.48  ss1 → ACK
 1642.09  ss1 → ACK
 1642.19  ss1 → ACK
 1670.20  ss1 → data (cont.) 2896 B
 1670.20  ss1 → data (cont.) 2896 B
 1670.20  ss1 → data (cont.) 1374 B
 1687.97  ss1 → data (cont.) 2896 B
 1687.98  ss1 → data (cont.) 2896 B
 1687.98  ss1 → data (cont.) 2896 B
 1687.98  ss1 → data (cont.) 2896 B
 1687.98  ss1 → data (cont.) 2896 B
 1695.73  ← ss2 ACK
 1713.32  ← ss2 ACK
 1720.80  ss1 → data (cont.) 531 B
 1772.98  ← ss2 data 236 B
 1773.01  ← ss2 data 69 B
 1773.01  ← ss2 data 36 B
 1773.12  ← ss2 data 81 B
 1773.12  ← ss2 data 36 B
 1773.12  ← ss2 data 36 B
 1773.13  ← ss2 data 426 B
 1773.50  ← ss2 data 36 B
 1773.52  ← ss2 data 36 B
 1773.52  ← ss2 data 69 B
 1773.53  ← ss2 data 36 B
 1773.53  ← ss2 data 77 B
 1773.54  ← ss2 data 36 B
 1773.54  ← ss2 data 36 B
 1773.66  ← ss2 data (cont.) 5792 B
 1773.66  ← ss2 data (cont.) 2318 B
 1773.75  ← ss2 data (cont.) 5792 B
 1773.75  ← ss2 data (cont.) 2437 B
 1773.77  ← ss2 data 3637 B
 1798.81  ss1 → ACK
 1798.81  ss1 → ACK
 1799.14  ss1 → ACK
 1802.38  ← ss2 data 36 B
 1802.42  ← ss2 data 36 B
 1802.43  ← ss2 data 69 B
 1802.43  ← ss2 data 36 B
 1802.45  ← ss2 data 78 B
 1802.46  ← ss2 data 36 B
 1802.46  ← ss2 data 36 B
 1802.47  ← ss2 data 441 B
 1802.48  ← ss2 data 36 B
 1802.49  ← ss2 data 36 B
 1802.49  ← ss2 data 69 B
 1802.51  ← ss2 data 36 B
 1802.52  ← ss2 data 71 B
 1802.52  ← ss2 data 36 B
 1802.53  ← ss2 data 36 B
 1802.53  ← ss2 data 723 B
 1802.54  ← ss2 data 36 B
 1802.55  ← ss2 data 36 B
 1802.55  ← ss2 data 69 B
 1802.55  ← ss2 data 36 B
 1802.56  ← ss2 data 70 B
 1802.57  ← ss2 data 36 B
 1802.57  ← ss2 data 36 B
 1802.66  ← ss2 data (cont.) 5792 B
 1802.66  ← ss2 data (cont.) 2247 B
 1802.67  ← ss2 data 36 B
 1802.67  ← ss2 data 36 B
 1802.67  ← ss2 data 69 B
 1802.67  ← ss2 data 36 B
 1802.68  ← ss2 data 36 B
 1802.68  ← ss2 data 36 B
 1827.66  ss1 → ACK
 1827.71  ss1 → ACK
 1833.67  ss1 → ACK
 1853.16  ss1 → data (cont.) 2896 B
 1853.16  ss1 → data (cont.) 2896 B
 1853.16  ss1 → data (cont.) 1374 B
 1868.82  ss1 → data (cont.) 2896 B
 1868.82  ss1 → data (cont.) 2896 B
 1868.89  ss1 → data (cont.) 2896 B
 1868.89  ss1 → data (cont.) 2896 B
 1868.89  ss1 → data (cont.) 2896 B
 1878.74  ← ss2 ACK
 1894.31  ← ss2 ACK
 1903.79  ss1 → data (cont.) 531 B
 1956.77  ← ss2 data 236 B
 1956.80  ← ss2 data 69 B
 1956.80  ← ss2 data 36 B
 1956.80  ← ss2 data 81 B
 1956.81  ← ss2 data 36 B
 1956.81  ← ss2 data 36 B
 1956.81  ← ss2 data 426 B
 1957.13  ← ss2 data 36 B
 1957.14  ← ss2 data 36 B
 1957.14  ← ss2 data 69 B
 1957.14  ← ss2 data 36 B
 1957.15  ← ss2 data 77 B
 1957.15  ← ss2 data 36 B
 1957.15  ← ss2 data 36 B
 1957.24  ← ss2 data 7158 B
 1957.35  ← ss2 data (cont.) 7240 B
 1957.35  ← ss2 data (cont.) 989 B
 1957.35  ← ss2 data 4590 B
 1977.82  ← ss2 data 36 B
 1977.86  ← ss2 data 36 B
 1977.86  ← ss2 data 69 B
 1977.86  ← ss2 data 36 B
 1977.86  ← ss2 data 78 B
 1977.87  ← ss2 data 36 B
 1977.87  ← ss2 data 36 B
 1977.88  ← ss2 data 441 B
 1977.88  ← ss2 data 36 B
 1977.91  ← ss2 data 36 B
 1977.92  ← ss2 data 69 B
 1977.92  ← ss2 data 36 B
 1977.93  ← ss2 data 71 B
 1977.93  ← ss2 data 36 B
 1977.93  ← ss2 data 36 B
 1977.97  ← ss2 data 723 B
 1977.98  ← ss2 data 36 B
 1977.98  ← ss2 data 36 B
 1977.98  ← ss2 data 69 B
 1977.99  ← ss2 data 36 B
 1977.99  ← ss2 data 70 B
 1977.99  ← ss2 data 36 B
 1978.00  ← ss2 data 36 B
 1978.01  ← ss2 data (cont.) 7240 B
 1978.01  ← ss2 data (cont.) 799 B
 1978.02  ← ss2 data 36 B
 1978.03  ← ss2 data 36 B
 1978.03  ← ss2 data 69 B
 1978.03  ← ss2 data 36 B
 1978.04  ← ss2 data 36 B
 1978.06  ← ss2 data 36 B
 1982.51  ss1 → ACK
 2003.08  ss1 → ACK
 2003.09  ss1 → ACK
 2030.24  ss1 → data (cont.) 2896 B
 2030.25  ss1 → data (cont.) 2896 B
 2030.25  ss1 → data (cont.) 1374 B
 2049.08  ss1 → data (cont.) 2896 B
 2049.11  ss1 → data (cont.) 2896 B
 2049.11  ss1 → data (cont.) 2896 B
 2049.11  ss1 → data (cont.) 2896 B
 2049.11  ss1 → data (cont.) 2896 B
 2055.68  ← ss2 ACK
 2074.44  ← ss2 ACK
 2080.81  ss1 → data (cont.) 531 B
 2130.98  ← ss2 data 236 B
 2131.00  ← ss2 data 69 B
 2131.00  ← ss2 data 36 B
 2131.00  ← ss2 data 81 B
 2131.00  ← ss2 data 36 B
 2131.00  ← ss2 data 36 B
 2131.00  ← ss2 data 426 B
 2131.27  ← ss2 data 36 B
 2131.27  ← ss2 data 36 B
 2131.28  ← ss2 data 69 B
 2131.28  ← ss2 data 36 B
 2131.29  ← ss2 data 77 B
 2131.29  ← ss2 data 36 B
 2131.29  ← ss2 data 36 B
 2131.38  ← ss2 data (cont.) 5792 B
 2131.38  ← ss2 data (cont.) 2318 B
 2131.44  ← ss2 data (cont.) 5792 B
 2131.44  ← ss2 data (cont.) 2437 B
 2131.47  ← ss2 data 3637 B
 2149.84  ← ss2 data 36 B
 2149.88  ← ss2 data 36 B
 2149.88  ← ss2 data 69 B
 2149.88  ← ss2 data 36 B
 2149.88  ← ss2 data 78 B
 2149.88  ← ss2 data 36 B
 2149.89  ← ss2 data 36 B
 2149.95  ← ss2 data 441 B
 2149.96  ← ss2 data 36 B
 2149.96  ← ss2 data 36 B
 2149.97  ← ss2 data 69 B
 2150.05  ← ss2 data 36 B
 2150.06  ← ss2 data 71 B
 2150.06  ← ss2 data 36 B
 2150.06  ← ss2 data 36 B
 2150.06  ← ss2 data 723 B
 2150.08  ← ss2 data 36 B
 2150.08  ← ss2 data 36 B
 2150.08  ← ss2 data 69 B
 2150.08  ← ss2 data 36 B
 2150.09  ← ss2 data 70 B
 2150.09  ← ss2 data 36 B
 2150.09  ← ss2 data 36 B
 2150.10  ← ss2 data (cont.) 5792 B
 2150.10  ← ss2 data (cont.) 2247 B
 2150.11  ← ss2 data 36 B
 2150.11  ← ss2 data 36 B
 2150.11  ← ss2 data 69 B
 2150.11  ← ss2 data 36 B
 2150.11  ← ss2 data 36 B
 2150.16  ← ss2 data 36 B
 2156.60  ss1 → ACK
 2175.12  ss1 → ACK
 2175.19  ss1 → ACK
 2201.17  ss1 → data (cont.) 2896 B
 2201.17  ss1 → data (cont.) 2896 B
 2201.17  ss1 → data (cont.) 1374 B
 2216.64  ss1 → data (cont.) 2896 B
 2216.65  ss1 → data (cont.) 2896 B
 2216.65  ss1 → data (cont.) 2896 B
 2216.65  ss1 → data (cont.) 2896 B
 2216.65  ss1 → data (cont.) 2896 B
 2226.50  ← ss2 ACK
 2241.89  ← ss2 ACK
 2251.55  ss1 → data (cont.) 531 B
 2301.72  ← ss2 data 236 B
 2301.74  ← ss2 data 69 B
 2301.74  ← ss2 data 36 B
 2301.90  ← ss2 data 81 B
 2301.93  ← ss2 data 36 B
 2301.93  ← ss2 data 36 B
 2301.98  ← ss2 data 426 B
 2302.19  ← ss2 data 36 B
 2302.20  ← ss2 data 36 B
 2302.20  ← ss2 data 69 B
 2302.21  ← ss2 data 36 B
 2302.22  ← ss2 data 77 B
 2302.22  ← ss2 data 36 B
 2302.23  ← ss2 data 36 B
 2302.32  ← ss2 data (cont.) 5792 B
 2302.32  ← ss2 data (cont.) 1366 B
 2302.38  ← ss2 data (cont.) 5792 B
 2302.38  ← ss2 data (cont.) 2437 B
 2302.42  ← ss2 data 4590 B
 2322.66  ← ss2 data 36 B
 2322.68  ← ss2 data 36 B
 2322.68  ← ss2 data 69 B
 2322.68  ← ss2 data 36 B
 2322.68  ← ss2 data 78 B
 2322.68  ← ss2 data 36 B
 2322.68  ← ss2 data 36 B
 2322.68  ← ss2 data 441 B
 2322.68  ← ss2 data 36 B
 2322.68  ← ss2 data 36 B
 2322.71  ← ss2 data 69 B
 2322.71  ← ss2 data 36 B
 2322.71  ← ss2 data 71 B
 2322.71  ← ss2 data 36 B
 2322.71  ← ss2 data 36 B
 2322.71  ← ss2 data 723 B
 2322.72  ← ss2 data 36 B
 2322.72  ← ss2 data 36 B
 2322.72  ← ss2 data 69 B
 2322.72  ← ss2 data 36 B
 2322.72  ← ss2 data 70 B
 2322.72  ← ss2 data 36 B
 2322.72  ← ss2 data 36 B
 2322.74  ← ss2 data (cont.) 5792 B
 2322.74  ← ss2 data (cont.) 2247 B
 2322.75  ← ss2 data 36 B
 2322.76  ← ss2 data 36 B
 2322.76  ← ss2 data 69 B
 2322.76  ← ss2 data 36 B
 2322.76  ← ss2 data 36 B
 2322.83  ← ss2 data 36 B
 2327.65  ss1 → ACK
 2347.75  ss1 → ACK
 2347.79  ss1 → ACK
 2372.91  ss1 → data (cont.) 2896 B
 2372.92  ss1 → data (cont.) 2896 B
 2372.92  ss1 → data (cont.) 1374 B
 2390.02  ss1 → data (cont.) 2896 B
 2390.03  ss1 → data (cont.) 2896 B
 2390.03  ss1 → data (cont.) 2896 B
 2390.03  ss1 → data (cont.) 2896 B
 2390.03  ss1 → data (cont.) 2896 B
 2398.27  ← ss2 ACK
 2415.42  ← ss2 ACK
 2423.35  ss1 → data (cont.) 531 B
 2473.10  ← ss2 data 236 B
 2473.12  ← ss2 data 69 B
 2473.12  ← ss2 data 36 B
 2473.12  ← ss2 data 81 B
 2473.13  ← ss2 data 36 B
 2473.13  ← ss2 data 36 B
 2473.13  ← ss2 data 426 B
 2473.48  ← ss2 data 36 B
 2473.48  ← ss2 data 36 B
 2473.48  ← ss2 data 69 B
 2473.48  ← ss2 data 36 B
 2473.49  ← ss2 data 77 B
 2473.49  ← ss2 data 36 B
 2473.49  ← ss2 data 36 B
 2473.62  ← ss2 data (cont.) 5792 B
 2473.62  ← ss2 data (cont.) 2318 B
 2473.68  ← ss2 data (cont.) 5792 B
 2473.68  ← ss2 data (cont.) 2437 B
 2473.70  ← ss2 data 3637 B
 2490.44  ← ss2 data 36 B
 2490.48  ← ss2 data 36 B
 2490.48  ← ss2 data 69 B
 2490.48  ← ss2 data 36 B
 2490.48  ← ss2 data 78 B
 2490.48  ← ss2 data 36 B
 2490.48  ← ss2 data 36 B
 2490.48  ← ss2 data 441 B
 2490.48  ← ss2 data 36 B
 2490.48  ← ss2 data 36 B
 2490.49  ← ss2 data 69 B
 2490.49  ← ss2 data 36 B
 2490.49  ← ss2 data 71 B
 2490.49  ← ss2 data 36 B
 2490.50  ← ss2 data 36 B
 2490.50  ← ss2 data 723 B
 2490.52  ← ss2 data 36 B
 2490.52  ← ss2 data 36 B
 2490.52  ← ss2 data 69 B
 2490.52  ← ss2 data 36 B
 2490.53  ← ss2 data 70 B
 2490.53  ← ss2 data 36 B
 2490.53  ← ss2 data 36 B
 2490.59  ← ss2 data (cont.) 5792 B
 2490.59  ← ss2 data (cont.) 2247 B
 2490.62  ← ss2 data 36 B
 2490.62  ← ss2 data 36 B
 2490.63  ← ss2 data 69 B
 2490.63  ← ss2 data 36 B
 2490.63  ← ss2 data 36 B
 2490.66  ← ss2 data 36 B
 2498.67  ss1 → ACK
 2498.80  ss1 → ACK
 2515.64  ss1 → ACK
 2515.64  ss1 → ACK
 2526.38  ss1 → ACK
 2544.01  ss1 → data (cont.) 2896 B
 2544.01  ss1 → data (cont.) 2896 B
 2544.01  ss1 → data (cont.) 1374 B
 2559.64  ss1 → data (cont.) 2896 B
 2559.64  ss1 → data (cont.) 2896 B
 2559.64  ss1 → data (cont.) 2896 B
 2559.64  ss1 → data (cont.) 2896 B
 2559.64  ss1 → data (cont.) 2896 B
 2569.41  ← ss2 ACK
 2585.06  ← ss2 ACK
 2594.51  ss1 → data (cont.) 531 B
 2635.05  ← ss2 data 236 B
 2635.09  ← ss2 data 69 B
 2635.09  ← ss2 data 36 B
 2635.09  ← ss2 data 81 B
 2635.09  ← ss2 data 36 B
 2635.09  ← ss2 data 36 B
 2635.09  ← ss2 data 426 B
 2635.33  ← ss2 data 36 B
 2635.33  ← ss2 data 36 B
 2635.34  ← ss2 data 69 B
 2635.34  ← ss2 data 36 B
 2635.34  ← ss2 data 77 B
 2635.34  ← ss2 data 36 B
 2635.36  ← ss2 data 36 B
 2635.48  ← ss2 data (cont.) 5792 B
 2635.48  ← ss2 data (cont.) 2318 B
 2635.54  ← ss2 data (cont.) 5792 B
 2635.54  ← ss2 data (cont.) 2437 B
 2635.55  ← ss2 data 3637 B
 2652.44  ← ss2 data 36 B
 2652.49  ← ss2 data 36 B
 2652.49  ← ss2 data 69 B
 2652.49  ← ss2 data 36 B
 2652.49  ← ss2 data 78 B
 2652.50  ← ss2 data 36 B
 2652.50  ← ss2 data 36 B
 2652.50  ← ss2 data 441 B
 2652.50  ← ss2 data 36 B
 2652.50  ← ss2 data 36 B
 2652.50  ← ss2 data 69 B
 2652.54  ← ss2 data 36 B
 2652.54  ← ss2 data 71 B
 2652.54  ← ss2 data 36 B
 2652.54  ← ss2 data 36 B
 2652.55  ← ss2 data 723 B
 2652.56  ← ss2 data 36 B
 2652.56  ← ss2 data 36 B
 2652.56  ← ss2 data 69 B
 2652.56  ← ss2 data 36 B
 2652.56  ← ss2 data 70 B
 2652.56  ← ss2 data 36 B
 2652.56  ← ss2 data 36 B
 2652.57  ← ss2 data (cont.) 5792 B
 2652.57  ← ss2 data (cont.) 2247 B
 2652.57  ← ss2 data 36 B
 2652.57  ← ss2 data 36 B
 2652.57  ← ss2 data 69 B
 2652.57  ← ss2 data 36 B
 2652.57  ← ss2 data 36 B
 2652.57  ← ss2 data 36 B
 2660.74  ss1 → ACK
 2677.61  ss1 → ACK
 2677.61  ss1 → ACK
 2684.06  ss1 → ACK
 2703.90  ss1 → data (cont.) 2896 B
 2703.90  ss1 → data (cont.) 2896 B
 2703.90  ss1 → data (cont.) 1374 B
 2720.36  ss1 → data (cont.) 2896 B
 2720.36  ss1 → data (cont.) 2896 B
 2720.42  ss1 → data (cont.) 2896 B
 2720.42  ss1 → data (cont.) 2896 B
 2720.42  ss1 → data (cont.) 2896 B
 2729.44  ← ss2 ACK
 2745.72  ← ss2 ACK
 2754.54  ss1 → data (cont.) 531 B
 2803.94  ← ss2 data 236 B
 2803.98  ← ss2 data 69 B
 2803.98  ← ss2 data 36 B
 2803.98  ← ss2 data 81 B
 2803.98  ← ss2 data 36 B
 2803.99  ← ss2 data 36 B
 2803.99  ← ss2 data 426 B
 2804.23  ← ss2 data 36 B
 2804.23  ← ss2 data 36 B
 2804.23  ← ss2 data 69 B
 2804.24  ← ss2 data 36 B
 2804.24  ← ss2 data 77 B
 2804.25  ← ss2 data 36 B
 2804.25  ← ss2 data 36 B
 2804.38  ← ss2 data (cont.) 5792 B
 2804.38  ← ss2 data (cont.) 1366 B
 2804.39  ← ss2 data (cont.) 5792 B
 2804.39  ← ss2 data (cont.) 2437 B
 2804.46  ← ss2 data 4590 B
 2828.70  ← ss2 data 36 B
 2828.75  ← ss2 data 36 B
 2828.75  ← ss2 data 69 B
 2828.75  ← ss2 data 36 B
 2828.75  ← ss2 data 78 B
 2828.75  ← ss2 data 36 B
 2828.75  ← ss2 data 36 B
 2828.75  ← ss2 data 441 B
 2828.75  ← ss2 data 36 B
 2828.76  ← ss2 data 36 B
 2828.76  ← ss2 data 69 B
 2828.76  ← ss2 data 36 B
 2828.76  ← ss2 data 71 B
 2828.77  ← ss2 data 36 B
 2828.77  ← ss2 data 36 B
 2828.78  ← ss2 data 723 B
 2828.79  ← ss2 data 36 B
 2828.80  ← ss2 data 36 B
 2828.80  ← ss2 data 69 B
 2828.80  ← ss2 data 36 B
 2828.80  ← ss2 data 70 B
 2828.81  ← ss2 data 36 B
 2828.81  ← ss2 data 36 B
 2828.85  ← ss2 data (cont.) 5792 B
 2828.85  ← ss2 data (cont.) 2247 B
 2828.87  ← ss2 data 36 B
 2828.88  ← ss2 data 36 B
 2828.88  ← ss2 data 69 B
 2828.89  ← ss2 data 36 B
 2828.89  ← ss2 data 36 B
 2828.92  ← ss2 data 36 B
 2829.49  ss1 → ACK
 2853.85  ss1 → ACK
 2853.89  ss1 → ACK
 2860.85  ss1 → ACK
 2879.71  ss1 → data (cont.) 2896 B
 2879.71  ss1 → data (cont.) 2896 B
 2879.71  ss1 → data (cont.) 1374 B
 2896.32  ss1 → data (cont.) 2896 B
 2896.33  ss1 → data (cont.) 2896 B
 2896.33  ss1 → data (cont.) 2896 B
 2896.33  ss1 → data (cont.) 2896 B
 2896.33  ss1 → data (cont.) 2896 B
 2905.03  ← ss2 ACK
 2921.74  ← ss2 ACK
 2930.10  ss1 → data (cont.) 531 B
 2980.43  ← ss2 data 236 B
 2980.49  ← ss2 data 69 B
 2980.49  ← ss2 data 36 B
 2980.49  ← ss2 data 81 B
 2980.50  ← ss2 data 36 B
 2980.50  ← ss2 data 36 B
 2980.50  ← ss2 data 426 B
 2980.73  ← ss2 data 36 B
 2980.75  ← ss2 data 36 B
 2980.76  ← ss2 data 69 B
 2980.76  ← ss2 data 36 B
 2980.76  ← ss2 data 77 B
 2980.76  ← ss2 data 36 B
 2980.83  ← ss2 data 36 B
 2980.94  ← ss2 data (cont.) 7240 B
 2980.94  ← ss2 data (cont.) 870 B
 2981.00  ← ss2 data (cont.) 7240 B
 2981.00  ← ss2 data (cont.) 989 B
 2981.01  ← ss2 data 3637 B
 3002.29  ← ss2 data 36 B
 3002.33  ← ss2 data 36 B
 3002.33  ← ss2 data 69 B
 3002.33  ← ss2 data 36 B
 3002.33  ← ss2 data 78 B
 3002.33  ← ss2 data 36 B
 3002.33  ← ss2 data 36 B
 3002.33  ← ss2 data 441 B
 3002.33  ← ss2 data 36 B
 3002.33  ← ss2 data 36 B
 3002.33  ← ss2 data 69 B
 3002.38  ← ss2 data 36 B
 3002.38  ← ss2 data 71 B
 3002.39  ← ss2 data 36 B
 3002.39  ← ss2 data 36 B
 3002.40  ← ss2 data 723 B
 3002.41  ← ss2 data 36 B
 3002.43  ← ss2 data 36 B
 3002.43  ← ss2 data 69 B
 3002.43  ← ss2 data 36 B
 3002.44  ← ss2 data 70 B
 3002.44  ← ss2 data 36 B
 3002.44  ← ss2 data 36 B
 3002.51  ← ss2 data (cont.) 7240 B
 3002.52  ← ss2 data (cont.) 799 B
 3002.52  ← ss2 data 36 B
 3002.54  ← ss2 data 36 B
 3002.54  ← ss2 data 69 B
 3002.54  ← ss2 data 36 B
 3002.54  ← ss2 data 36 B
 3002.57  ← ss2 data 36 B
 3006.16  ss1 → ACK
 3027.44  ss1 → ACK
 3027.58  ss1 → ACK
 3033.98  ss1 → ACK
 3053.08  ss1 → data (cont.) 2896 B
 3053.08  ss1 → data (cont.) 2896 B
 3053.08  ss1 → data (cont.) 1374 B
 3071.96  ss1 → data (cont.) 2896 B
 3071.96  ss1 → data (cont.) 2896 B
 3072.02  ss1 → data (cont.) 2896 B
 3072.02  ss1 → data (cont.) 2896 B
 3072.02  ss1 → data (cont.) 2896 B
 3078.54  ← ss2 ACK
 3097.42  ← ss2 ACK
 3103.61  ss1 → data (cont.) 531 B
 3152.92  ← ss2 data 236 B
 3152.95  ← ss2 data 69 B
 3152.95  ← ss2 data 36 B
 3152.95  ← ss2 data 81 B
 3152.95  ← ss2 data 36 B
 3152.95  ← ss2 data 36 B
 3152.95  ← ss2 data 426 B
 3153.18  ← ss2 data 36 B
 3153.18  ← ss2 data 36 B
 3153.18  ← ss2 data 69 B
 3153.19  ← ss2 data 36 B
 3153.19  ← ss2 data 77 B
 3153.19  ← ss2 data 36 B
 3153.19  ← ss2 data 36 B
 3153.41  ← ss2 data (cont.) 7240 B
 3153.41  ← ss2 data (cont.) 870 B
 3153.58  ← ss2 data (cont.) 7240 B
 3153.58  ← ss2 data (cont.) 989 B
 3153.60  ← ss2 data 3637 B
 3170.84  ← ss2 data 36 B
 3170.88  ← ss2 data 36 B
 3170.88  ← ss2 data 69 B
 3170.88  ← ss2 data 36 B
 3170.88  ← ss2 data 78 B
 3170.88  ← ss2 data 36 B
 3170.88  ← ss2 data 36 B
 3170.88  ← ss2 data 441 B
 3170.89  ← ss2 data 36 B
 3170.89  ← ss2 data 36 B
 3170.89  ← ss2 data 69 B
 3170.90  ← ss2 data 36 B
 3170.90  ← ss2 data 71 B
 3170.91  ← ss2 data 36 B
 3170.91  ← ss2 data 36 B
 3170.92  ← ss2 data 723 B
 3170.94  ← ss2 data 36 B
 3170.94  ← ss2 data 36 B
 3170.94  ← ss2 data 69 B
 3170.94  ← ss2 data 36 B
 3170.94  ← ss2 data 70 B
 3171.00  ← ss2 data 36 B
 3171.01  ← ss2 data 36 B
 3171.03  ← ss2 data (cont.) 7240 B
 3171.03  ← ss2 data (cont.) 799 B
 3171.03  ← ss2 data 36 B
 3171.04  ← ss2 data 36 B
 3171.04  ← ss2 data 69 B
 3171.04  ← ss2 data 36 B
 3171.05  ← ss2 data 36 B
 3171.07  ← ss2 data 36 B
 3178.51  ss1 → ACK
 3178.58  ss1 → ACK
 3178.72  ss1 → ACK
 3195.97  ss1 → ACK
 3196.07  ss1 → ACK
 3202.07  ss1 → ACK
 3220.15  ss1 → data (cont.) 2896 B
 3220.15  ss1 → data (cont.) 2896 B
 3220.15  ss1 → data (cont.) 1374 B
 3236.13  ss1 → data (cont.) 2896 B
 3236.14  ss1 → data (cont.) 2896 B
 3236.14  ss1 → data (cont.) 2896 B
 3236.14  ss1 → data (cont.) 2896 B
 3236.14  ss1 → data (cont.) 2896 B
 3245.47  ← ss2 ACK
 3261.53  ← ss2 ACK
 3270.51  ss1 → data (cont.) 531 B
 3319.70  ← ss2 data 236 B
 3319.74  ← ss2 data 69 B
 3319.74  ← ss2 data 36 B
 3319.74  ← ss2 data 81 B
 3319.74  ← ss2 data 36 B
 3319.74  ← ss2 data 36 B
 3319.74  ← ss2 data 426 B
 3319.96  ← ss2 data 36 B
 3319.96  ← ss2 data 36 B
 3319.97  ← ss2 data 69 B
 3319.99  ← ss2 data 36 B
 3319.99  ← ss2 data 77 B
 3320.00  ← ss2 data 36 B
 3320.00  ← ss2 data 36 B
 3320.08  ← ss2 data 7158 B
 3320.17  ← ss2 data (cont.) 7240 B
 3320.17  ← ss2 data (cont.) 989 B
 3320.28  ← ss2 data 4590 B
 3337.13  ← ss2 data 36 B
 3337.15  ← ss2 data 36 B
 3337.16  ← ss2 data 69 B
 3337.16  ← ss2 data 36 B
 3337.16  ← ss2 data 78 B
 3337.16  ← ss2 data 36 B
 3337.16  ← ss2 data 36 B
 3337.16  ← ss2 data 441 B
 3337.16  ← ss2 data 36 B
 3337.16  ← ss2 data 36 B
 3337.16  ← ss2 data 69 B
 3337.16  ← ss2 data 36 B
 3337.16  ← ss2 data 71 B
 3337.18  ← ss2 data 36 B
 3337.18  ← ss2 data 36 B
 3337.18  ← ss2 data 723 B
 3337.19  ← ss2 data 36 B
 3337.19  ← ss2 data 36 B
 3337.19  ← ss2 data 69 B
 3337.19  ← ss2 data 36 B
 3337.19  ← ss2 data 70 B
 3337.19  ← ss2 data 36 B
 3337.19  ← ss2 data 36 B
 3337.21  ← ss2 data (cont.) 7240 B
 3337.21  ← ss2 data (cont.) 799 B
 3337.21  ← ss2 data 36 B
 3337.21  ← ss2 data 36 B
 3337.21  ← ss2 data 69 B
 3337.22  ← ss2 data 36 B
 3337.22  ← ss2 data 36 B
 3337.24  ← ss2 data 36 B
 3345.42  ss1 → ACK
 3362.20  ss1 → ACK
 3362.30  ss1 → ACK
 3385.89  ss1 → data (cont.) 2896 B
 3385.90  ss1 → data (cont.) 2896 B
 3385.90  ss1 → data (cont.) 1374 B
 3401.04  ss1 → data (cont.) 2896 B
 3401.04  ss1 → data (cont.) 2896 B
 3401.11  ss1 → data (cont.) 2896 B
 3401.11  ss1 → data (cont.) 2896 B
 3401.11  ss1 → data (cont.) 2896 B
 3411.44  ← ss2 ACK
 3426.39  ← ss2 ACK
 3436.50  ss1 → data (cont.) 531 B
 3485.59  ← ss2 data 236 B
 3485.63  ← ss2 data 69 B
 3485.63  ← ss2 data 36 B
 3485.63  ← ss2 data 81 B
 3485.63  ← ss2 data 36 B
 3485.63  ← ss2 data 36 B
 3485.63  ← ss2 data 426 B
 3486.07  ← ss2 data 36 B
 3486.08  ← ss2 data 36 B
 3486.08  ← ss2 data 69 B
 3486.08  ← ss2 data 36 B
 3486.08  ← ss2 data 77 B
 3486.08  ← ss2 data 36 B
 3486.08  ← ss2 data 36 B
 3486.09  ← ss2 data 7158 B
 3486.26  ← ss2 data (cont.) 7240 B
 3486.27  ← ss2 data (cont.) 989 B
 3486.27  ← ss2 data 4590 B
 3509.07  ← ss2 data 36 B
 3509.12  ← ss2 data 36 B
 3509.12  ← ss2 data 69 B
 3509.12  ← ss2 data 36 B
 3509.12  ← ss2 data 78 B
 3509.12  ← ss2 data 36 B
 3509.13  ← ss2 data 36 B
 3509.13  ← ss2 data 441 B
 3509.14  ← ss2 data 36 B
 3509.15  ← ss2 data 36 B
 3509.15  ← ss2 data 69 B
 3509.17  ← ss2 data 36 B
 3509.18  ← ss2 data 71 B
 3509.18  ← ss2 data 36 B
 3509.20  ← ss2 data 36 B
 3509.21  ← ss2 data 723 B
 3509.22  ← ss2 data 36 B
 3509.23  ← ss2 data 36 B
 3509.27  ← ss2 data 69 B
 3509.28  ← ss2 data 36 B
 3509.30  ← ss2 data 70 B
 3509.31  ← ss2 data 36 B
 3509.31  ← ss2 data 36 B
 3509.40  ← ss2 data (cont.) 7240 B
 3509.40  ← ss2 data (cont.) 799 B
 3509.42  ← ss2 data 36 B
 3509.43  ← ss2 data 36 B
 3509.45  ← ss2 data 69 B
 3509.45  ← ss2 data 36 B
 3509.46  ← ss2 data 36 B
 3509.50  ← ss2 data 36 B
```
