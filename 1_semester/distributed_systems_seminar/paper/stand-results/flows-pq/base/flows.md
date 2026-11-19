# Обмены ss1 ↔ ss2: full, reuse × RTT 50 мс, 20 запросов по 10240 Б

| config | RTT задан | RTT потока (ядро) | соединения | запрос по записи, мс | curl, мс | паузы ≥0.4·RTT | сумма пауз, мс | др. порты |
|---|---|---|---|---|---|---|---|---|
| full | 50 | 57.21 (min 50.13) | new TCP + resumed TLS: 20 | 291.5 | 340.7 | 10 | 257.8 | — |
| reuse | 50 | 61.39 (min 50.04) | reused connection: 1 | 3859.7 | 185.3 | 92 | 3105.3 | — |

RTT потока — сглаженный rtt сокетов ss1 → ss2:5500 по ядру (ss -tin) во время запросов, в скобках minrtt (у соединений пула — минимум с момента открытия, в т. ч. до смены задержки). В хронологии исходящие пакеты ss1 видны уже после очереди netem (сдвиг на RTT/2), входящие — по приходу. Запрос по записи — от первого пакета запроса до последних данных ответа на канале ss1 ↔ ss2. Пауза — промежуток между соседними пакетами запроса не меньше max(0.4·RTT, 1 мс).

## full, RTT 50 мс — медианный запрос (new TCP + resumed TLS, 291.9 мс)

Паузы:
- 23.8 мс: после «← ss2 ACK» до «← ss2 SYN-ACK»
- 25.2 мс: после «← ss2 SYN-ACK» до «ss1 → ACK»
- 25.1 мс: после «ss1 → ClientHello 2800 B» до «← ss2 ACK»
- 25.1 мс: после «← ss2 Finished (enc.) 45 B» до «ss1 → ACK»
- 35.3 мс: после «ss1 → ChangeCipherSpec 6 B» до «ss1 → Finished (enc.) 2896 B»
- 25.1 мс: после «ss1 → data (cont.) 1448 B» до «← ss2 ACK»
- 25.1 мс: после «← ss2 ACK» до «ss1 → data (cont.) 978 B»
- 25.7 мс: после «← ss2 ACK» до «← ss2 data 224 B»
- 25.5 мс: после «← ss2 data 63 B» до «ss1 → ACK»
- 25.1 мс: после «ss1 → ACK» до «← ss2 data 2896 B»

```
    0.00  ss1 → SYN
    1.32  ← ss2 ACK
    1.34  ← ss2 ACK
   25.17  ← ss2 SYN-ACK
   50.34  ss1 → ACK
   51.16  ss1 → ClientHello 2800 B
   76.28  ← ss2 ACK
   79.06  ← ss2 TLS hs 2+4 2660 B
   79.10  ← ss2 ChangeCipherSpec 6 B
   79.10  ← ss2 Finished (enc.) 45 B
  104.20  ss1 → ACK
  104.20  ss1 → ACK
  104.20  ss1 → ACK
  104.73  ss1 → ChangeCipherSpec 6 B
  139.99  ss1 → Finished (enc.) 2896 B
  139.99  ss1 → data (cont.) 1448 B
  139.99  ss1 → data (cont.) 2896 B
  139.99  ss1 → data (cont.) 2896 B
  139.99  ss1 → data (cont.) 1448 B
  165.10  ← ss2 ACK
  165.13  ← ss2 ACK
  165.13  ← ss2 ACK
  190.19  ss1 → data (cont.) 978 B
  206.03  ← ss2 ACK
  215.41  ← ss2 ACK
  241.06  ← ss2 data 224 B
  241.10  ← ss2 data 63 B
  241.10  ← ss2 data 31 B
  241.10  ← ss2 data 75 B
  241.10  ← ss2 data 31 B
  241.10  ← ss2 data 31 B
  241.10  ← ss2 data 419 B
  241.32  ← ss2 data 31 B
  241.32  ← ss2 data 31 B
  241.33  ← ss2 data 63 B
  266.82  ss1 → ACK
  291.89  ← ss2 data 2896 B
  291.92  ← ss2 data (cont.) 2896 B
  291.92  ← ss2 data (cont.) 2896 B
  291.93  ← ss2 data (cont.) 2896 B
  291.93  ← ss2 data (cont.) 2896 B
  291.93  ← ss2 data (cont.) 2896 B
  291.93  ← ss2 data (cont.) 2896 B
  291.93  ← ss2 FIN 428 B
```

## reuse, RTT 50 мс — медианный запрос (reused connection, 3859.7 мс)

Паузы:
- 25.2 мс: после «ss1 → data (cont.) 1448 B» до «← ss2 ACK»
- 25.0 мс: после «← ss2 ACK» до «ss1 → data (cont.) 875 B»
- 20.5 мс: после «← ss2 ACK» до «← ss2 data 236 B»
- 24.7 мс: после «← ss2 data 69 B» до «ss1 → ACK»
- 24.9 мс: после «ss1 → ACK» до «← ss2 data 2896 B»
- 25.0 мс: после «← ss2 data (cont.) 628 B» до «ss1 → ACK»
- 52.1 мс: после «ss1 → ACK» до «ss1 → data (cont.) 2896 B»
- 25.2 мс: после «ss1 → data (cont.) 1448 B» до «← ss2 ACK»
- 25.1 мс: после «← ss2 ACK» до «ss1 → data (cont.) 875 B»
- 51.3 мс: после «ss1 → data (cont.) 875 B» до «← ss2 data 236 B»
- 20.0 мс: после «← ss2 data 2203 B» до «← ss2 data 36 B»
- 20.1 мс: после «ss1 → ACK» до «ss1 → ACK»
- 25.1 мс: после «← ss2 data (cont.) 694 B» до «ss1 → ACK»
- 40.9 мс: после «ss1 → ACK» до «ss1 → data (cont.) 2896 B»
- 25.2 мс: после «ss1 → data (cont.) 1448 B» до «← ss2 ACK»
- 25.0 мс: после «← ss2 ACK» до «ss1 → data (cont.) 875 B»
- 51.1 мс: после «ss1 → data (cont.) 875 B» до «← ss2 data 236 B»
- 21.4 мс: после «← ss2 data (cont.) 259 B» до «← ss2 data 36 B»
- 21.5 мс: после «ss1 → ACK» до «ss1 → ACK»
- 35.1 мс: после «ss1 → ACK» до «ss1 → data (cont.) 2896 B»
- 25.3 мс: после «ss1 → data (cont.) 1448 B» до «← ss2 ACK»
- 25.1 мс: после «← ss2 ACK» до «ss1 → data (cont.) 875 B»
- 50.5 мс: после «ss1 → data (cont.) 875 B» до «← ss2 data 236 B»
- 52.6 мс: после «ss1 → ACK» до «ss1 → data (cont.) 2896 B»
- 25.6 мс: после «ss1 → data (cont.) 1448 B» до «← ss2 ACK»
- 25.1 мс: после «← ss2 ACK» до «ss1 → data (cont.) 875 B»
- 70.2 мс: после «ss1 → data (cont.) 875 B» до «← ss2 data 236 B»
- 24.9 мс: после «← ss2 data 36 B» до «ss1 → ACK»
- 43.2 мс: после «ss1 → ACK» до «ss1 → data (cont.) 2896 B»
- 25.4 мс: после «ss1 → data (cont.) 1448 B» до «← ss2 ACK»
- 25.1 мс: после «← ss2 ACK» до «ss1 → data (cont.) 875 B»
- 45.9 мс: после «ss1 → data (cont.) 875 B» до «← ss2 data 236 B»
- 69.7 мс: после «ss1 → ACK» до «ss1 → data (cont.) 2896 B»
- 25.5 мс: после «ss1 → data (cont.) 1448 B» до «← ss2 ACK»
- 25.1 мс: после «← ss2 ACK» до «ss1 → data (cont.) 875 B»
- 46.4 мс: после «ss1 → data (cont.) 875 B» до «← ss2 data 236 B»
- 25.3 мс: после «← ss2 data 3155 B» до «ss1 → ACK»
- 24.8 мс: после «← ss2 data 36 B» до «ss1 → ACK»
- 61.4 мс: после «ss1 → ACK» до «ss1 → data (cont.) 2896 B»
- 25.5 мс: после «ss1 → data (cont.) 1448 B» до «← ss2 ACK»
- 25.1 мс: после «← ss2 ACK» до «ss1 → data (cont.) 875 B»
- 43.1 мс: после «ss1 → data (cont.) 875 B» до «← ss2 data 236 B»
- 35.0 мс: после «ss1 → ACK» до «ss1 → data (cont.) 2896 B»
- 25.4 мс: после «ss1 → data (cont.) 1448 B» до «← ss2 ACK»
- 25.1 мс: после «← ss2 ACK» до «ss1 → data (cont.) 875 B»
- 46.0 мс: после «ss1 → data (cont.) 875 B» до «← ss2 data 236 B»
- 36.1 мс: после «ss1 → ACK» до «ss1 → data (cont.) 2896 B»
- 25.4 мс: после «ss1 → data (cont.) 1448 B» до «← ss2 ACK»
- 25.1 мс: после «← ss2 ACK» до «ss1 → data (cont.) 875 B»
- 54.3 мс: после «ss1 → data (cont.) 875 B» до «← ss2 data 236 B»
- 44.8 мс: после «ss1 → ACK» до «ss1 → data (cont.) 2896 B»
- 25.6 мс: после «ss1 → data (cont.) 1448 B» до «← ss2 ACK»
- 25.1 мс: после «← ss2 ACK» до «ss1 → data (cont.) 875 B»
- 49.9 мс: после «ss1 → data (cont.) 875 B» до «← ss2 data 236 B»
- 33.6 мс: после «ss1 → ACK» до «ss1 → data (cont.) 2896 B»
- 25.5 мс: после «ss1 → data (cont.) 1448 B» до «← ss2 ACK»
- 25.1 мс: после «← ss2 ACK» до «ss1 → data (cont.) 875 B»
- 51.7 мс: после «ss1 → data (cont.) 875 B» до «← ss2 data 236 B»
- 45.2 мс: после «ss1 → ACK» до «ss1 → data (cont.) 2896 B»
- 25.4 мс: после «ss1 → data (cont.) 1448 B» до «← ss2 ACK»
- 25.0 мс: после «← ss2 ACK» до «ss1 → data (cont.) 875 B»
- 50.6 мс: после «ss1 → data (cont.) 875 B» до «← ss2 data 236 B»
- 40.3 мс: после «ss1 → ACK» до «ss1 → data (cont.) 2896 B»
- 25.4 мс: после «ss1 → data (cont.) 1448 B» до «← ss2 ACK»
- 25.0 мс: после «← ss2 ACK» до «ss1 → data (cont.) 875 B»
- 48.3 мс: после «ss1 → data (cont.) 875 B» до «← ss2 data 236 B»
- 38.9 мс: после «ss1 → ACK» до «ss1 → data (cont.) 2896 B»
- 25.4 мс: после «ss1 → data (cont.) 1448 B» до «← ss2 ACK»
- 25.1 мс: после «← ss2 ACK» до «ss1 → data (cont.) 875 B»
- 51.5 мс: после «ss1 → data (cont.) 875 B» до «← ss2 data 236 B»
- 41.9 мс: после «ss1 → ACK» до «ss1 → ACK»
- 25.4 мс: после «ss1 → data (cont.) 1448 B» до «← ss2 ACK»
- 25.0 мс: после «← ss2 ACK» до «ss1 → data (cont.) 875 B»
- 43.3 мс: после «ss1 → data (cont.) 875 B» до «← ss2 data 236 B»
- 20.7 мс: после «← ss2 data 2203 B» до «← ss2 data 36 B»
- 20.8 мс: после «ss1 → ACK» до «ss1 → ACK»
- 41.6 мс: после «ss1 → ACK» до «ss1 → data (cont.) 2896 B»
- 25.4 мс: после «ss1 → data (cont.) 1448 B» до «← ss2 ACK»
- 25.1 мс: после «← ss2 ACK» до «ss1 → data (cont.) 875 B»
- 50.7 мс: после «ss1 → data (cont.) 875 B» до «← ss2 data 236 B»
- 40.3 мс: после «ss1 → ACK» до «ss1 → data (cont.) 2896 B»
- 25.4 мс: после «ss1 → data (cont.) 1448 B» до «← ss2 ACK»
- 25.1 мс: после «← ss2 ACK» до «ss1 → data (cont.) 875 B»
- 43.9 мс: после «ss1 → data (cont.) 875 B» до «← ss2 data 236 B»
- 43.2 мс: после «ss1 → ACK» до «ss1 → data (cont.) 2896 B»
- 25.3 мс: после «ss1 → data (cont.) 1448 B» до «← ss2 ACK»
- 25.1 мс: после «← ss2 ACK» до «ss1 → data (cont.) 875 B»
- 53.4 мс: после «ss1 → data (cont.) 875 B» до «← ss2 data 236 B»
- 38.2 мс: после «ss1 → ACK» до «ss1 → data (cont.) 2896 B»
- 25.3 мс: после «ss1 → data (cont.) 1448 B» до «← ss2 ACK»
- 25.1 мс: после «← ss2 ACK» до «ss1 → data (cont.) 875 B»
- 40.4 мс: после «ss1 → data (cont.) 875 B» до «← ss2 data 236 B»

```
    0.00  ss1 → data (cont.) 2896 B
    0.00  ss1 → data (cont.) 1506 B
    0.01  ss1 → data (cont.) 2896 B
    0.01  ss1 → data (cont.) 2896 B
    0.01  ss1 → data (cont.) 1448 B
   25.24  ← ss2 ACK
   25.26  ← ss2 ACK
   25.27  ← ss2 ACK
   25.27  ← ss2 ACK
   50.29  ss1 → data (cont.) 875 B
   68.17  ← ss2 ACK
   75.44  ← ss2 ACK
   95.90  ← ss2 data 236 B
   95.95  ← ss2 data 69 B
   95.95  ← ss2 data 36 B
   95.95  ← ss2 data 81 B
   95.95  ← ss2 data 36 B
   95.95  ← ss2 data 36 B
   95.95  ← ss2 data 426 B
   96.29  ← ss2 data 36 B
   96.32  ← ss2 data 36 B
   96.32  ← ss2 data 69 B
  121.00  ss1 → ACK
  121.00  ss1 → ACK
  121.00  ss1 → ACK
  121.00  ss1 → ACK
  121.00  ss1 → ACK
  121.01  ss1 → ACK
  121.01  ss1 → ACK
  121.30  ss1 → ACK
  121.33  ss1 → ACK
  121.33  ss1 → ACK
  146.19  ← ss2 data 2896 B
  146.22  ← ss2 data (cont.) 2896 B
  146.22  ← ss2 data (cont.) 2896 B
  146.22  ← ss2 data (cont.) 2896 B
  146.23  ← ss2 data (cont.) 2896 B
  146.23  ← ss2 data (cont.) 2896 B
  146.23  ← ss2 data (cont.) 2896 B
  146.31  ← ss2 data (cont.) 628 B
  171.27  ss1 → ACK
  171.27  ss1 → ACK
  171.27  ss1 → ACK
  171.27  ss1 → ACK
  171.27  ss1 → ACK
  171.27  ss1 → ACK
  171.27  ss1 → ACK
  178.10  ss1 → ACK
  230.17  ss1 → data (cont.) 2896 B
  230.18  ss1 → data (cont.) 1506 B
  230.18  ss1 → data (cont.) 2896 B
  230.18  ss1 → data (cont.) 2896 B
  230.18  ss1 → data (cont.) 1448 B
  255.36  ← ss2 ACK
  255.80  ← ss2 ACK
  280.88  ss1 → data (cont.) 875 B
  332.18  ← ss2 data 236 B
  332.20  ← ss2 data 69 B
  332.20  ← ss2 data 36 B
  332.20  ← ss2 data 81 B
  332.20  ← ss2 data 36 B
  332.20  ← ss2 data 36 B
  332.20  ← ss2 data 426 B
  332.44  ← ss2 data 36 B
  332.44  ← ss2 data 36 B
  332.44  ← ss2 data 69 B
  332.47  ← ss2 data 36 B
  332.47  ← ss2 data 77 B
  332.47  ← ss2 data 36 B
  332.47  ← ss2 data 36 B
  332.58  ← ss2 data (cont.) 2896 B
  332.59  ← ss2 data (cont.) 2896 B
  332.59  ← ss2 data (cont.) 2318 B
  332.61  ← ss2 data 2203 B
  352.66  ← ss2 data 36 B
  352.68  ← ss2 data 36 B
  352.68  ← ss2 data 69 B
  352.68  ← ss2 data 36 B
  352.68  ← ss2 data 78 B
  352.68  ← ss2 data 36 B
  352.68  ← ss2 data 36 B
  352.70  ← ss2 data 445 B
  352.70  ← ss2 data 36 B
  352.70  ← ss2 data 36 B
  352.70  ← ss2 data 69 B
  352.70  ← ss2 data 36 B
  352.70  ← ss2 data 71 B
  358.04  ss1 → ACK
  378.17  ss1 → ACK
  383.13  ← ss2 data 2896 B
  383.14  ← ss2 data (cont.) 2896 B
  383.14  ← ss2 data (cont.) 2896 B
  383.14  ← ss2 data (cont.) 694 B
  408.24  ss1 → ACK
  449.16  ss1 → data (cont.) 2896 B
  449.17  ss1 → data (cont.) 1506 B
  449.33  ss1 → data (cont.) 2896 B
  449.33  ss1 → data (cont.) 2896 B
  449.33  ss1 → data (cont.) 1448 B
  474.53  ← ss2 ACK
  499.58  ss1 → data (cont.) 875 B
  550.71  ← ss2 data 236 B
  550.76  ← ss2 data 69 B
  550.77  ← ss2 data 36 B
  550.77  ← ss2 data 81 B
  550.79  ← ss2 data 36 B
  550.79  ← ss2 data 36 B
  550.79  ← ss2 data 426 B
  551.15  ← ss2 data 36 B
  551.16  ← ss2 data 36 B
  551.16  ← ss2 data 69 B
  551.16  ← ss2 data 36 B
  551.16  ← ss2 data 77 B
  551.16  ← ss2 data 36 B
  551.17  ← ss2 data 36 B
  551.30  ← ss2 data (cont.) 2896 B
  551.30  ← ss2 data (cont.) 2896 B
  551.30  ← ss2 data (cont.) 1366 B
  551.30  ← ss2 data (cont.) 2896 B
  551.30  ← ss2 data (cont.) 259 B
  572.66  ← ss2 data 36 B
  572.72  ← ss2 data 36 B
  572.76  ← ss2 data 69 B
  572.76  ← ss2 data 36 B
  572.78  ← ss2 data 78 B
  572.78  ← ss2 data 36 B
  572.79  ← ss2 data 36 B
  572.86  ← ss2 data 445 B
  572.88  ← ss2 data 36 B
  572.88  ← ss2 data 36 B
  572.88  ← ss2 data 69 B
  572.89  ← ss2 data 36 B
  572.89  ← ss2 data 71 B
  572.91  ← ss2 data 36 B
  572.91  ← ss2 data 36 B
  572.91  ← ss2 data 703 B
  572.93  ← ss2 data 36 B
  572.93  ← ss2 data 36 B
  572.93  ← ss2 data 69 B
  572.94  ← ss2 data 36 B
  572.94  ← ss2 data 70 B
  572.95  ← ss2 data 36 B
  572.95  ← ss2 data 36 B
  572.99  ← ss2 data (cont.) 2896 B
  572.99  ← ss2 data (cont.) 2896 B
  573.00  ← ss2 data (cont.) 2247 B
  573.00  ← ss2 data 36 B
  573.01  ← ss2 data 36 B
  573.01  ← ss2 data 69 B
  573.05  ← ss2 data 36 B
  573.05  ← ss2 data 36 B
  573.08  ← ss2 data 36 B
  576.51  ss1 → ACK
  597.97  ss1 → ACK
  598.07  ss1 → ACK
  604.94  ss1 → ACK
  640.07  ss1 → data (cont.) 2896 B
  640.07  ss1 → data (cont.) 1506 B
  640.13  ss1 → data (cont.) 2896 B
  640.13  ss1 → data (cont.) 2896 B
  640.13  ss1 → data (cont.) 1448 B
  665.46  ← ss2 ACK
  690.58  ss1 → data (cont.) 875 B
  741.12  ← ss2 data 236 B
  741.14  ← ss2 data 69 B
  741.15  ← ss2 data 36 B
  741.16  ← ss2 data 81 B
  741.16  ← ss2 data 36 B
  741.16  ← ss2 data 36 B
  741.16  ← ss2 data 426 B
  741.42  ← ss2 data 36 B
  741.43  ← ss2 data 36 B
  741.44  ← ss2 data 69 B
  741.44  ← ss2 data 36 B
  741.45  ← ss2 data 77 B
  741.46  ← ss2 data 36 B
  741.46  ← ss2 data 36 B
  741.55  ← ss2 data (cont.) 5792 B
  741.55  ← ss2 data (cont.) 2318 B
  741.58  ← ss2 data 2203 B
  758.95  ← ss2 data 36 B
  758.98  ← ss2 data 36 B
  759.05  ← ss2 data 69 B
  759.05  ← ss2 data 36 B
  759.05  ← ss2 data 78 B
  759.05  ← ss2 data 36 B
  759.05  ← ss2 data 36 B
  759.05  ← ss2 data 445 B
  759.06  ← ss2 data 36 B
  759.06  ← ss2 data 36 B
  759.06  ← ss2 data 69 B
  759.06  ← ss2 data 36 B
  759.06  ← ss2 data 71 B
  759.06  ← ss2 data 36 B
  759.08  ← ss2 data 36 B
  759.08  ← ss2 data 703 B
  759.08  ← ss2 data 36 B
  759.08  ← ss2 data 36 B
  759.08  ← ss2 data 69 B
  759.09  ← ss2 data 36 B
  759.09  ← ss2 data 70 B
  759.09  ← ss2 data 36 B
  759.10  ← ss2 data 36 B
  759.17  ← ss2 data (cont.) 5792 B
  759.18  ← ss2 data (cont.) 2247 B
  759.18  ← ss2 data 36 B
  759.26  ← ss2 data 36 B
  759.27  ← ss2 data 69 B
  759.27  ← ss2 data 36 B
  759.27  ← ss2 data 36 B
  759.28  ← ss2 data 36 B
  766.80  ss1 → ACK
  784.17  ss1 → ACK
  784.33  ss1 → ACK
  836.94  ss1 → data (cont.) 2896 B
  836.94  ss1 → data (cont.) 1506 B
  837.02  ss1 → data (cont.) 2896 B
  837.02  ss1 → data (cont.) 2896 B
  837.02  ss1 → data (cont.) 1448 B
  862.62  ← ss2 ACK
  887.72  ss1 → data (cont.) 875 B
  957.89  ← ss2 data 236 B
  958.07  ← ss2 data 69 B
  958.16  ← ss2 data 36 B
  958.26  ← ss2 data 81 B
  958.27  ← ss2 data 36 B
  958.41  ← ss2 data 36 B
  958.46  ← ss2 data 426 B
  959.11  ← ss2 data 36 B
  959.18  ← ss2 data 36 B
  959.20  ← ss2 data 69 B
  959.24  ← ss2 data 36 B
  959.30  ← ss2 data 77 B
  959.31  ← ss2 data 36 B
  959.31  ← ss2 data 36 B
  959.78  ← ss2 data (cont.) 5792 B
  959.83  ← ss2 data (cont.) 1366 B
  964.99  ← ss2 data 3155 B
  983.10  ss1 → ACK
  983.97  ss1 → ACK
  984.18  ss1 → ACK
  984.22  ss1 → ACK
  984.22  ss1 → ACK
  984.70  ss1 → ACK
  984.91  ss1 → ACK
  990.10  ss1 → ACK
 1003.85  ← ss2 data 36 B
 1003.94  ← ss2 data 36 B
 1003.95  ← ss2 data 69 B
 1003.95  ← ss2 data 36 B
 1003.95  ← ss2 data 78 B
 1003.96  ← ss2 data 36 B
 1003.96  ← ss2 data 36 B
 1003.96  ← ss2 data 445 B
 1003.96  ← ss2 data 36 B
 1003.96  ← ss2 data 36 B
 1003.96  ← ss2 data 69 B
 1003.96  ← ss2 data 36 B
 1003.96  ← ss2 data 71 B
 1003.99  ← ss2 data 36 B
 1003.99  ← ss2 data 36 B
 1003.99  ← ss2 data 703 B
 1003.99  ← ss2 data 36 B
 1004.00  ← ss2 data 36 B
 1004.00  ← ss2 data 69 B
 1004.00  ← ss2 data 36 B
 1004.00  ← ss2 data 70 B
 1004.00  ← ss2 data 36 B
 1004.01  ← ss2 data 36 B
 1004.08  ← ss2 data (cont.) 5792 B
 1004.09  ← ss2 data (cont.) 2247 B
 1004.10  ← ss2 data 36 B
 1004.11  ← ss2 data 36 B
 1004.11  ← ss2 data 69 B
 1004.11  ← ss2 data 36 B
 1004.12  ← ss2 data 36 B
 1004.25  ← ss2 data 36 B
 1029.17  ss1 → ACK
 1039.05  ss1 → ACK
 1082.26  ss1 → data (cont.) 2896 B
 1082.27  ss1 → data (cont.) 1506 B
 1082.39  ss1 → data (cont.) 2896 B
 1082.39  ss1 → data (cont.) 2896 B
 1082.39  ss1 → data (cont.) 1448 B
 1107.84  ← ss2 ACK
 1132.94  ss1 → data (cont.) 875 B
 1178.89  ← ss2 data 236 B
 1178.91  ← ss2 data 69 B
 1178.91  ← ss2 data 36 B
 1178.91  ← ss2 data 81 B
 1178.91  ← ss2 data 36 B
 1178.91  ← ss2 data 36 B
 1178.91  ← ss2 data 426 B
 1179.12  ← ss2 data 36 B
 1179.12  ← ss2 data 36 B
 1179.12  ← ss2 data 69 B
 1179.12  ← ss2 data 36 B
 1179.13  ← ss2 data 77 B
 1179.23  ← ss2 data 36 B
 1179.24  ← ss2 data 36 B
 1179.32  ← ss2 data (cont.) 5792 B
 1179.32  ← ss2 data (cont.) 1366 B
 1179.33  ← ss2 data 3155 B
 1198.65  ← ss2 data 36 B
 1198.70  ← ss2 data 36 B
 1198.70  ← ss2 data 69 B
 1198.71  ← ss2 data 36 B
 1198.71  ← ss2 data 78 B
 1198.71  ← ss2 data 36 B
 1198.71  ← ss2 data 36 B
 1198.71  ← ss2 data 445 B
 1198.71  ← ss2 data 36 B
 1198.71  ← ss2 data 36 B
 1198.71  ← ss2 data 69 B
 1198.71  ← ss2 data 36 B
 1198.72  ← ss2 data 71 B
 1198.72  ← ss2 data 36 B
 1198.72  ← ss2 data 36 B
 1198.72  ← ss2 data 703 B
 1198.74  ← ss2 data 36 B
 1198.74  ← ss2 data 36 B
 1198.74  ← ss2 data 69 B
 1198.74  ← ss2 data 36 B
 1198.74  ← ss2 data 70 B
 1198.74  ← ss2 data 36 B
 1198.74  ← ss2 data 36 B
 1198.74  ← ss2 data (cont.) 5792 B
 1198.74  ← ss2 data (cont.) 2247 B
 1198.74  ← ss2 data 36 B
 1198.75  ← ss2 data 36 B
 1198.75  ← ss2 data 69 B
 1198.75  ← ss2 data 36 B
 1198.75  ← ss2 data 36 B
 1198.75  ← ss2 data 36 B
 1204.52  ss1 → ACK
 1223.84  ss1 → ACK
 1223.84  ss1 → ACK
 1293.56  ss1 → data (cont.) 2896 B
 1293.57  ss1 → data (cont.) 1506 B
 1293.57  ss1 → data (cont.) 2896 B
 1293.57  ss1 → data (cont.) 2896 B
 1293.57  ss1 → data (cont.) 1448 B
 1319.12  ← ss2 ACK
 1344.19  ss1 → data (cont.) 875 B
 1390.64  ← ss2 data 236 B
 1390.74  ← ss2 data 69 B
 1390.74  ← ss2 data 36 B
 1390.74  ← ss2 data 81 B
 1390.75  ← ss2 data 36 B
 1390.75  ← ss2 data 36 B
 1390.75  ← ss2 data 426 B
 1391.06  ← ss2 data 36 B
 1391.07  ← ss2 data 36 B
 1391.07  ← ss2 data 69 B
 1391.07  ← ss2 data 36 B
 1391.13  ← ss2 data 77 B
 1391.14  ← ss2 data 36 B
 1391.14  ← ss2 data 36 B
 1391.36  ← ss2 data (cont.) 5792 B
 1391.37  ← ss2 data (cont.) 1366 B
 1391.49  ← ss2 data 3155 B
 1416.82  ss1 → ACK
 1423.63  ← ss2 data 36 B
 1423.70  ← ss2 data 36 B
 1423.71  ← ss2 data 69 B
 1423.71  ← ss2 data 36 B
 1423.71  ← ss2 data 78 B
 1423.71  ← ss2 data 36 B
 1423.71  ← ss2 data 36 B
 1423.91  ← ss2 data 445 B
 1423.92  ← ss2 data 36 B
 1423.92  ← ss2 data 36 B
 1423.94  ← ss2 data 69 B
 1423.94  ← ss2 data 36 B
 1423.94  ← ss2 data 71 B
 1423.94  ← ss2 data 36 B
 1423.94  ← ss2 data 36 B
 1423.95  ← ss2 data 703 B
 1423.97  ← ss2 data 36 B
 1423.98  ← ss2 data 36 B
 1423.98  ← ss2 data 69 B
 1423.98  ← ss2 data 36 B
 1423.99  ← ss2 data 70 B
 1423.99  ← ss2 data 36 B
 1424.01  ← ss2 data 36 B
 1424.11  ← ss2 data (cont.) 5792 B
 1424.13  ← ss2 data (cont.) 2247 B
 1424.13  ← ss2 data 36 B
 1424.13  ← ss2 data 36 B
 1424.14  ← ss2 data 69 B
 1424.15  ← ss2 data 36 B
 1424.16  ← ss2 data 36 B
 1424.23  ← ss2 data 36 B
 1449.01  ss1 → ACK
 1449.20  ss1 → ACK
 1465.95  ss1 → ACK
 1527.35  ss1 → data (cont.) 2896 B
 1527.35  ss1 → data (cont.) 1506 B
 1527.35  ss1 → data (cont.) 2896 B
 1527.35  ss1 → data (cont.) 2896 B
 1527.35  ss1 → data (cont.) 1448 B
 1552.89  ← ss2 ACK
 1578.02  ss1 → data (cont.) 875 B
 1621.09  ← ss2 data 236 B
 1621.13  ← ss2 data 69 B
 1621.13  ← ss2 data 36 B
 1621.13  ← ss2 data 81 B
 1621.13  ← ss2 data 36 B
 1621.14  ← ss2 data 36 B
 1621.14  ← ss2 data 426 B
 1621.23  ← ss2 data 36 B
 1621.42  ← ss2 data 36 B
 1621.42  ← ss2 data 69 B
 1621.42  ← ss2 data 36 B
 1621.43  ← ss2 data 77 B
 1621.43  ← ss2 data 36 B
 1621.43  ← ss2 data 36 B
 1621.55  ← ss2 data (cont.) 5792 B
 1621.55  ← ss2 data (cont.) 2318 B
 1621.56  ← ss2 data 2203 B
 1641.39  ← ss2 data 36 B
 1641.43  ← ss2 data 36 B
 1641.43  ← ss2 data 69 B
 1641.43  ← ss2 data 36 B
 1641.43  ← ss2 data 78 B
 1641.43  ← ss2 data 36 B
 1641.43  ← ss2 data 36 B
 1641.43  ← ss2 data 445 B
 1641.44  ← ss2 data 36 B
 1641.44  ← ss2 data 36 B
 1641.45  ← ss2 data 69 B
 1641.46  ← ss2 data 36 B
 1641.46  ← ss2 data 71 B
 1641.47  ← ss2 data 36 B
 1641.47  ← ss2 data 36 B
 1641.48  ← ss2 data 703 B
 1641.49  ← ss2 data 36 B
 1641.49  ← ss2 data 36 B
 1641.52  ← ss2 data 69 B
 1641.52  ← ss2 data 36 B
 1641.52  ← ss2 data 70 B
 1641.52  ← ss2 data 36 B
 1641.53  ← ss2 data 36 B
 1641.57  ← ss2 data (cont.) 5792 B
 1641.57  ← ss2 data (cont.) 2247 B
 1641.57  ← ss2 data 36 B
 1641.57  ← ss2 data 36 B
 1641.58  ← ss2 data 69 B
 1641.58  ← ss2 data 36 B
 1641.59  ← ss2 data 36 B
 1641.71  ← ss2 data 36 B
 1646.91  ss1 → ACK
 1666.53  ss1 → ACK
 1666.68  ss1 → ACK
 1673.29  ss1 → ACK
 1708.25  ss1 → data (cont.) 2896 B
 1708.25  ss1 → data (cont.) 1506 B
 1708.25  ss1 → data (cont.) 2896 B
 1708.25  ss1 → data (cont.) 2896 B
 1708.25  ss1 → data (cont.) 1448 B
 1733.62  ← ss2 ACK
 1758.72  ss1 → data (cont.) 875 B
 1804.69  ← ss2 data 236 B
 1804.74  ← ss2 data 69 B
 1804.74  ← ss2 data 36 B
 1804.75  ← ss2 data 81 B
 1804.75  ← ss2 data 36 B
 1804.75  ← ss2 data 36 B
 1804.75  ← ss2 data 426 B
 1804.96  ← ss2 data 36 B
 1804.97  ← ss2 data 36 B
 1804.97  ← ss2 data 69 B
 1804.97  ← ss2 data 36 B
 1804.97  ← ss2 data 77 B
 1804.97  ← ss2 data 36 B
 1804.97  ← ss2 data 36 B
 1805.06  ← ss2 data (cont.) 5792 B
 1805.06  ← ss2 data (cont.) 1366 B
 1805.07  ← ss2 data 3155 B
 1821.93  ← ss2 data 36 B
 1821.95  ← ss2 data 36 B
 1821.95  ← ss2 data 69 B
 1821.95  ← ss2 data 36 B
 1821.95  ← ss2 data 78 B
 1821.95  ← ss2 data 36 B
 1821.95  ← ss2 data 36 B
 1821.95  ← ss2 data 445 B
 1821.95  ← ss2 data 36 B
 1821.95  ← ss2 data 36 B
 1821.96  ← ss2 data 69 B
 1821.96  ← ss2 data 36 B
 1821.96  ← ss2 data 71 B
 1821.96  ← ss2 data 36 B
 1821.96  ← ss2 data 36 B
 1821.96  ← ss2 data 703 B
 1821.99  ← ss2 data 36 B
 1821.99  ← ss2 data 36 B
 1821.99  ← ss2 data 69 B
 1821.99  ← ss2 data 36 B
 1821.99  ← ss2 data 70 B
 1821.99  ← ss2 data 36 B
 1821.99  ← ss2 data 36 B
 1821.99  ← ss2 data (cont.) 5792 B
 1821.99  ← ss2 data (cont.) 2247 B
 1821.99  ← ss2 data 36 B
 1821.99  ← ss2 data 36 B
 1822.00  ← ss2 data 69 B
 1822.00  ← ss2 data 36 B
 1822.00  ← ss2 data 36 B
 1822.02  ← ss2 data 36 B
 1830.38  ss1 → ACK
 1847.04  ss1 → ACK
 1847.05  ss1 → ACK
 1853.66  ss1 → ACK
 1889.79  ss1 → data (cont.) 2896 B
 1889.79  ss1 → data (cont.) 1506 B
 1889.79  ss1 → data (cont.) 2896 B
 1889.79  ss1 → data (cont.) 2896 B
 1889.80  ss1 → data (cont.) 1448 B
 1915.15  ← ss2 ACK
 1940.20  ss1 → data (cont.) 875 B
 1994.51  ← ss2 data 236 B
 1994.54  ← ss2 data 69 B
 1994.54  ← ss2 data 36 B
 1994.54  ← ss2 data 81 B
 1994.54  ← ss2 data 36 B
 1994.54  ← ss2 data 36 B
 1994.54  ← ss2 data 426 B
 1994.78  ← ss2 data 36 B
 1994.78  ← ss2 data 36 B
 1994.79  ← ss2 data 69 B
 1994.91  ← ss2 data 36 B
 1994.92  ← ss2 data 77 B
 1994.92  ← ss2 data 36 B
 1994.93  ← ss2 data 36 B
 1995.08  ← ss2 data (cont.) 5792 B
 1995.09  ← ss2 data (cont.) 2318 B
 1995.09  ← ss2 data 2203 B
 2014.64  ← ss2 data 36 B
 2014.65  ← ss2 data 36 B
 2014.66  ← ss2 data 69 B
 2014.66  ← ss2 data 36 B
 2014.66  ← ss2 data 78 B
 2014.66  ← ss2 data 36 B
 2014.67  ← ss2 data 36 B
 2014.67  ← ss2 data 445 B
 2014.67  ← ss2 data 36 B
 2014.68  ← ss2 data 36 B
 2014.68  ← ss2 data 69 B
 2014.69  ← ss2 data 36 B
 2014.76  ← ss2 data 71 B
 2014.76  ← ss2 data 36 B
 2014.77  ← ss2 data 36 B
 2014.78  ← ss2 data 703 B
 2014.79  ← ss2 data 36 B
 2014.80  ← ss2 data 36 B
 2014.80  ← ss2 data 69 B
 2014.80  ← ss2 data 36 B
 2014.82  ← ss2 data 70 B
 2014.82  ← ss2 data 36 B
 2014.82  ← ss2 data 36 B
 2014.86  ← ss2 data (cont.) 5792 B
 2014.86  ← ss2 data (cont.) 2247 B
 2014.86  ← ss2 data 36 B
 2014.87  ← ss2 data 36 B
 2014.87  ← ss2 data 69 B
 2014.88  ← ss2 data 36 B
 2014.88  ← ss2 data 36 B
 2014.90  ← ss2 data 36 B
 2020.12  ss1 → ACK
 2039.81  ss1 → ACK
 2039.97  ss1 → ACK
 2084.77  ss1 → data (cont.) 2896 B
 2084.77  ss1 → data (cont.) 1506 B
 2084.78  ss1 → data (cont.) 2896 B
 2084.78  ss1 → data (cont.) 2896 B
 2084.78  ss1 → data (cont.) 1448 B
 2110.38  ← ss2 ACK
 2135.43  ss1 → data (cont.) 875 B
 2185.38  ← ss2 data 236 B
 2185.42  ← ss2 data 69 B
 2185.42  ← ss2 data 36 B
 2185.43  ← ss2 data 81 B
 2185.43  ← ss2 data 36 B
 2185.43  ← ss2 data 36 B
 2185.43  ← ss2 data 426 B
 2185.74  ← ss2 data 36 B
 2185.75  ← ss2 data 36 B
 2185.77  ← ss2 data 69 B
 2185.77  ← ss2 data 36 B
 2185.77  ← ss2 data 77 B
 2185.77  ← ss2 data 36 B
 2185.78  ← ss2 data 36 B
 2185.86  ← ss2 data (cont.) 5792 B
 2185.86  ← ss2 data (cont.) 2318 B
 2185.89  ← ss2 data 2203 B
 2203.26  ← ss2 data 36 B
 2203.30  ← ss2 data 36 B
 2203.30  ← ss2 data 69 B
 2203.30  ← ss2 data 36 B
 2203.30  ← ss2 data 78 B
 2203.30  ← ss2 data 36 B
 2203.30  ← ss2 data 36 B
 2203.30  ← ss2 data 445 B
 2203.30  ← ss2 data 36 B
 2203.31  ← ss2 data 36 B
 2203.31  ← ss2 data 69 B
 2203.31  ← ss2 data 36 B
 2203.32  ← ss2 data 71 B
 2203.33  ← ss2 data 36 B
 2203.33  ← ss2 data 36 B
 2203.35  ← ss2 data 703 B
 2203.36  ← ss2 data 36 B
 2203.37  ← ss2 data 36 B
 2203.37  ← ss2 data 69 B
 2203.37  ← ss2 data 36 B
 2203.38  ← ss2 data 70 B
 2203.38  ← ss2 data 36 B
 2203.38  ← ss2 data 36 B
 2203.43  ← ss2 data (cont.) 5792 B
 2203.43  ← ss2 data (cont.) 2247 B
 2203.43  ← ss2 data 36 B
 2203.44  ← ss2 data 36 B
 2203.44  ← ss2 data 69 B
 2203.45  ← ss2 data 36 B
 2203.46  ← ss2 data 36 B
 2203.48  ← ss2 data 36 B
 2210.99  ss1 → ACK
 2228.44  ss1 → ACK
 2228.49  ss1 → ACK
 2235.19  ss1 → ACK
 2268.75  ss1 → data (cont.) 2896 B
 2268.76  ss1 → data (cont.) 1506 B
 2268.76  ss1 → data (cont.) 2896 B
 2268.76  ss1 → data (cont.) 2896 B
 2268.76  ss1 → data (cont.) 1448 B
 2294.22  ← ss2 ACK
 2319.28  ss1 → data (cont.) 875 B
 2370.94  ← ss2 data 236 B
 2370.97  ← ss2 data 69 B
 2370.97  ← ss2 data 36 B
 2370.97  ← ss2 data 81 B
 2370.97  ← ss2 data 36 B
 2370.97  ← ss2 data 36 B
 2370.97  ← ss2 data 426 B
 2371.07  ← ss2 data 36 B
 2371.07  ← ss2 data 36 B
 2371.07  ← ss2 data 69 B
 2371.07  ← ss2 data 36 B
 2371.08  ← ss2 data 77 B
 2371.08  ← ss2 data 36 B
 2371.13  ← ss2 data 36 B
 2371.20  ← ss2 data (cont.) 5792 B
 2371.20  ← ss2 data (cont.) 1366 B
 2371.21  ← ss2 data 3155 B
 2388.73  ← ss2 data 36 B
 2388.78  ← ss2 data 36 B
 2388.79  ← ss2 data 69 B
 2388.79  ← ss2 data 36 B
 2388.79  ← ss2 data 78 B
 2388.79  ← ss2 data 36 B
 2388.79  ← ss2 data 36 B
 2388.79  ← ss2 data 445 B
 2388.79  ← ss2 data 36 B
 2388.79  ← ss2 data 36 B
 2388.80  ← ss2 data 69 B
 2388.80  ← ss2 data 36 B
 2388.80  ← ss2 data 71 B
 2388.80  ← ss2 data 36 B
 2388.80  ← ss2 data 36 B
 2388.81  ← ss2 data 703 B
 2388.83  ← ss2 data 36 B
 2388.84  ← ss2 data 36 B
 2388.84  ← ss2 data 69 B
 2388.84  ← ss2 data 36 B
 2388.84  ← ss2 data 70 B
 2388.85  ← ss2 data 36 B
 2388.87  ← ss2 data 36 B
 2388.90  ← ss2 data (cont.) 5792 B
 2388.90  ← ss2 data (cont.) 2247 B
 2388.90  ← ss2 data 36 B
 2388.91  ← ss2 data 36 B
 2388.91  ← ss2 data 69 B
 2388.92  ← ss2 data 36 B
 2388.92  ← ss2 data 36 B
 2389.02  ← ss2 data 36 B
 2396.82  ss1 → ACK
 2413.84  ss1 → ACK
 2414.14  ss1 → ACK
 2459.32  ss1 → data (cont.) 2896 B
 2459.33  ss1 → data (cont.) 1506 B
 2459.38  ss1 → data (cont.) 2896 B
 2459.38  ss1 → data (cont.) 2896 B
 2459.38  ss1 → data (cont.) 1448 B
 2484.75  ← ss2 ACK
 2509.79  ss1 → data (cont.) 875 B
 2560.43  ← ss2 data 236 B
 2560.45  ← ss2 data 69 B
 2560.45  ← ss2 data 36 B
 2560.45  ← ss2 data 81 B
 2560.46  ← ss2 data 36 B
 2560.46  ← ss2 data 36 B
 2560.46  ← ss2 data 426 B
 2560.60  ← ss2 data 36 B
 2560.60  ← ss2 data 36 B
 2560.61  ← ss2 data 69 B
 2560.61  ← ss2 data 36 B
 2560.62  ← ss2 data 77 B
 2560.62  ← ss2 data 36 B
 2560.62  ← ss2 data 36 B
 2560.72  ← ss2 data (cont.) 5792 B
 2560.72  ← ss2 data (cont.) 2318 B
 2560.75  ← ss2 data 2203 B
 2577.46  ← ss2 data 36 B
 2577.48  ← ss2 data 36 B
 2577.48  ← ss2 data 69 B
 2577.48  ← ss2 data 36 B
 2577.48  ← ss2 data 78 B
 2577.48  ← ss2 data 36 B
 2577.48  ← ss2 data 36 B
 2577.48  ← ss2 data 445 B
 2577.48  ← ss2 data 36 B
 2577.48  ← ss2 data 36 B
 2577.48  ← ss2 data 69 B
 2577.50  ← ss2 data 36 B
 2577.51  ← ss2 data 71 B
 2577.51  ← ss2 data 36 B
 2577.51  ← ss2 data 36 B
 2577.51  ← ss2 data 703 B
 2577.51  ← ss2 data 36 B
 2577.51  ← ss2 data 36 B
 2577.52  ← ss2 data 69 B
 2577.52  ← ss2 data 36 B
 2577.52  ← ss2 data 70 B
 2577.52  ← ss2 data 36 B
 2577.52  ← ss2 data 36 B
 2577.53  ← ss2 data (cont.) 5792 B
 2577.53  ← ss2 data (cont.) 2247 B
 2577.54  ← ss2 data 36 B
 2577.54  ← ss2 data 36 B
 2577.55  ← ss2 data 69 B
 2577.55  ← ss2 data 36 B
 2577.55  ← ss2 data 36 B
 2577.58  ← ss2 data 36 B
 2586.06  ss1 → ACK
 2602.58  ss1 → ACK
 2602.58  ss1 → ACK
 2608.42  ss1 → ACK
 2648.69  ss1 → data (cont.) 2896 B
 2648.69  ss1 → data (cont.) 1506 B
 2648.74  ss1 → data (cont.) 2896 B
 2648.74  ss1 → data (cont.) 2896 B
 2648.74  ss1 → data (cont.) 1448 B
 2674.10  ← ss2 ACK
 2699.14  ss1 → data (cont.) 875 B
 2747.43  ← ss2 data 236 B
 2747.46  ← ss2 data 69 B
 2747.47  ← ss2 data 36 B
 2747.47  ← ss2 data 81 B
 2747.47  ← ss2 data 36 B
 2747.47  ← ss2 data 36 B
 2747.47  ← ss2 data 426 B
 2747.69  ← ss2 data 36 B
 2747.69  ← ss2 data 36 B
 2747.70  ← ss2 data 69 B
 2747.70  ← ss2 data 36 B
 2747.71  ← ss2 data 77 B
 2747.72  ← ss2 data 36 B
 2747.72  ← ss2 data 36 B
 2747.80  ← ss2 data (cont.) 5792 B
 2747.80  ← ss2 data (cont.) 1366 B
 2747.83  ← ss2 data 3155 B
 2763.52  ← ss2 data 36 B
 2763.54  ← ss2 data 36 B
 2763.55  ← ss2 data 69 B
 2763.55  ← ss2 data 36 B
 2763.55  ← ss2 data 78 B
 2763.55  ← ss2 data 36 B
 2763.55  ← ss2 data 36 B
 2763.55  ← ss2 data 445 B
 2763.55  ← ss2 data 36 B
 2763.56  ← ss2 data 36 B
 2763.56  ← ss2 data 69 B
 2763.56  ← ss2 data 36 B
 2763.57  ← ss2 data 71 B
 2763.57  ← ss2 data 36 B
 2763.57  ← ss2 data 36 B
 2763.60  ← ss2 data 703 B
 2763.61  ← ss2 data 36 B
 2763.61  ← ss2 data 36 B
 2763.62  ← ss2 data 69 B
 2763.62  ← ss2 data 36 B
 2763.64  ← ss2 data 70 B
 2763.64  ← ss2 data 36 B
 2763.64  ← ss2 data 36 B
 2763.69  ← ss2 data (cont.) 5792 B
 2763.69  ← ss2 data (cont.) 2247 B
 2763.71  ← ss2 data 36 B
 2763.71  ← ss2 data 36 B
 2763.72  ← ss2 data 69 B
 2763.72  ← ss2 data 36 B
 2763.72  ← ss2 data 36 B
 2763.75  ← ss2 data 36 B
 2773.12  ss1 → ACK
 2788.69  ss1 → ACK
 2788.81  ss1 → ACK
 2827.72  ss1 → data (cont.) 2896 B
 2827.72  ss1 → data (cont.) 1506 B
 2827.72  ss1 → data (cont.) 2896 B
 2827.72  ss1 → data (cont.) 2896 B
 2827.72  ss1 → data (cont.) 1448 B
 2853.11  ← ss2 ACK
 2878.25  ss1 → data (cont.) 875 B
 2929.74  ← ss2 data 236 B
 2929.79  ← ss2 data 69 B
 2929.79  ← ss2 data 36 B
 2929.81  ← ss2 data 81 B
 2929.82  ← ss2 data 36 B
 2929.82  ← ss2 data 36 B
 2929.82  ← ss2 data 426 B
 2930.03  ← ss2 data 36 B
 2930.03  ← ss2 data 36 B
 2930.04  ← ss2 data 69 B
 2930.04  ← ss2 data 36 B
 2930.04  ← ss2 data 77 B
 2930.04  ← ss2 data 36 B
 2930.04  ← ss2 data 36 B
 2930.11  ← ss2 data (cont.) 5792 B
 2930.11  ← ss2 data (cont.) 2318 B
 2930.13  ← ss2 data 2203 B
 2949.06  ← ss2 data 36 B
 2949.10  ← ss2 data 36 B
 2949.10  ← ss2 data 69 B
 2949.10  ← ss2 data 36 B
 2949.10  ← ss2 data 78 B
 2949.10  ← ss2 data 36 B
 2949.10  ← ss2 data 36 B
 2949.11  ← ss2 data 445 B
 2949.11  ← ss2 data 36 B
 2949.12  ← ss2 data 36 B
 2949.13  ← ss2 data 69 B
 2949.13  ← ss2 data 36 B
 2949.14  ← ss2 data 71 B
 2949.14  ← ss2 data 36 B
 2949.15  ← ss2 data 36 B
 2949.15  ← ss2 data 703 B
 2949.16  ← ss2 data 36 B
 2949.18  ← ss2 data 36 B
 2949.18  ← ss2 data 69 B
 2949.18  ← ss2 data 36 B
 2949.18  ← ss2 data 70 B
 2949.18  ← ss2 data 36 B
 2949.18  ← ss2 data 36 B
 2949.22  ← ss2 data (cont.) 5792 B
 2949.23  ← ss2 data (cont.) 2247 B
 2949.23  ← ss2 data 36 B
 2949.23  ← ss2 data 36 B
 2949.23  ← ss2 data 69 B
 2949.24  ← ss2 data 36 B
 2949.24  ← ss2 data 36 B
 2949.27  ← ss2 data 36 B
 2955.57  ss1 → ACK
 2974.20  ss1 → ACK
 2974.26  ss1 → ACK
 3016.13  ss1 → ACK
 3016.74  ss1 → data (cont.) 2896 B
 3016.75  ss1 → data (cont.) 1506 B
 3016.75  ss1 → data (cont.) 2896 B
 3016.75  ss1 → data (cont.) 2896 B
 3016.75  ss1 → data (cont.) 1448 B
 3042.12  ← ss2 ACK
 3067.17  ss1 → data (cont.) 875 B
 3110.43  ← ss2 data 236 B
 3110.47  ← ss2 data 69 B
 3110.49  ← ss2 data 36 B
 3110.70  ← ss2 data 81 B
 3110.83  ← ss2 data 36 B
 3110.84  ← ss2 data 36 B
 3110.84  ← ss2 data 426 B
 3111.20  ← ss2 data 36 B
 3111.21  ← ss2 data 36 B
 3111.22  ← ss2 data 69 B
 3111.23  ← ss2 data 36 B
 3111.25  ← ss2 data 77 B
 3111.26  ← ss2 data 36 B
 3111.30  ← ss2 data 36 B
 3111.44  ← ss2 data (cont.) 5792 B
 3111.45  ← ss2 data (cont.) 2318 B
 3111.49  ← ss2 data 2203 B
 3132.22  ← ss2 data 36 B
 3132.25  ← ss2 data 36 B
 3132.25  ← ss2 data 69 B
 3132.25  ← ss2 data 36 B
 3132.25  ← ss2 data 78 B
 3132.25  ← ss2 data 36 B
 3132.25  ← ss2 data 36 B
 3132.25  ← ss2 data 445 B
 3132.25  ← ss2 data 36 B
 3132.26  ← ss2 data 36 B
 3132.27  ← ss2 data 69 B
 3132.27  ← ss2 data 36 B
 3132.27  ← ss2 data 71 B
 3132.27  ← ss2 data 36 B
 3132.27  ← ss2 data 36 B
 3132.28  ← ss2 data 703 B
 3132.28  ← ss2 data 36 B
 3132.28  ← ss2 data 36 B
 3132.28  ← ss2 data 69 B
 3132.28  ← ss2 data 36 B
 3132.28  ← ss2 data 70 B
 3132.28  ← ss2 data 36 B
 3132.28  ← ss2 data 36 B
 3132.32  ← ss2 data (cont.) 5792 B
 3132.32  ← ss2 data (cont.) 2247 B
 3132.32  ← ss2 data 36 B
 3132.33  ← ss2 data 36 B
 3132.34  ← ss2 data 69 B
 3132.34  ← ss2 data 36 B
 3132.34  ← ss2 data 36 B
 3132.37  ← ss2 data 36 B
 3136.57  ss1 → ACK
 3157.36  ss1 → ACK
 3157.44  ss1 → ACK
 3199.06  ss1 → data (cont.) 2896 B
 3199.06  ss1 → data (cont.) 1506 B
 3199.06  ss1 → data (cont.) 2896 B
 3199.06  ss1 → data (cont.) 2896 B
 3199.06  ss1 → data (cont.) 1448 B
 3224.44  ← ss2 ACK
 3249.52  ss1 → data (cont.) 875 B
 3300.21  ← ss2 data 236 B
 3300.23  ← ss2 data 69 B
 3300.23  ← ss2 data 36 B
 3300.23  ← ss2 data 81 B
 3300.23  ← ss2 data 36 B
 3300.23  ← ss2 data 36 B
 3300.23  ← ss2 data 426 B
 3300.37  ← ss2 data 36 B
 3300.37  ← ss2 data 36 B
 3300.38  ← ss2 data 69 B
 3300.38  ← ss2 data 36 B
 3300.39  ← ss2 data 77 B
 3300.39  ← ss2 data 36 B
 3300.40  ← ss2 data 36 B
 3300.50  ← ss2 data (cont.) 5792 B
 3300.51  ← ss2 data (cont.) 2318 B
 3300.57  ← ss2 data 2203 B
 3317.53  ← ss2 data 36 B
 3317.55  ← ss2 data 36 B
 3317.55  ← ss2 data 69 B
 3317.55  ← ss2 data 36 B
 3317.56  ← ss2 data 78 B
 3317.56  ← ss2 data 36 B
 3317.56  ← ss2 data 36 B
 3317.61  ← ss2 data 445 B
 3317.61  ← ss2 data 36 B
 3317.62  ← ss2 data 36 B
 3317.62  ← ss2 data 69 B
 3317.63  ← ss2 data 36 B
 3317.64  ← ss2 data 71 B
 3317.64  ← ss2 data 36 B
 3317.64  ← ss2 data 36 B
 3317.64  ← ss2 data 703 B
 3317.66  ← ss2 data 36 B
 3317.67  ← ss2 data 36 B
 3317.67  ← ss2 data 69 B
 3317.67  ← ss2 data 36 B
 3317.67  ← ss2 data 70 B
 3317.67  ← ss2 data 36 B
 3317.68  ← ss2 data 36 B
 3317.72  ← ss2 data (cont.) 5792 B
 3317.72  ← ss2 data (cont.) 2247 B
 3317.72  ← ss2 data 36 B
 3317.73  ← ss2 data 36 B
 3317.74  ← ss2 data 69 B
 3317.74  ← ss2 data 36 B
 3317.74  ← ss2 data 36 B
 3317.77  ← ss2 data 36 B
 3325.77  ss1 → ACK
 3342.69  ss1 → ACK
 3342.81  ss1 → ACK
 3383.07  ss1 → data (cont.) 2896 B
 3383.08  ss1 → data (cont.) 1506 B
 3383.12  ss1 → data (cont.) 2896 B
 3383.12  ss1 → data (cont.) 2896 B
 3383.12  ss1 → data (cont.) 1448 B
 3408.49  ← ss2 ACK
 3433.61  ss1 → data (cont.) 875 B
 3477.47  ← ss2 data 236 B
 3477.49  ← ss2 data 69 B
 3477.49  ← ss2 data 36 B
 3477.49  ← ss2 data 81 B
 3477.49  ← ss2 data 36 B
 3477.49  ← ss2 data 36 B
 3477.49  ← ss2 data 426 B
 3477.66  ← ss2 data 36 B
 3477.66  ← ss2 data 36 B
 3477.67  ← ss2 data 69 B
 3477.67  ← ss2 data 36 B
 3477.69  ← ss2 data 77 B
 3477.69  ← ss2 data 36 B
 3477.69  ← ss2 data 36 B
 3477.76  ← ss2 data (cont.) 5792 B
 3477.76  ← ss2 data (cont.) 1366 B
 3477.78  ← ss2 data 3155 B
 3494.26  ← ss2 data 36 B
 3494.29  ← ss2 data 36 B
 3494.29  ← ss2 data 69 B
 3494.29  ← ss2 data 36 B
 3494.30  ← ss2 data 78 B
 3494.30  ← ss2 data 36 B
 3494.30  ← ss2 data 36 B
 3494.30  ← ss2 data 445 B
 3494.30  ← ss2 data 36 B
 3494.31  ← ss2 data 36 B
 3494.32  ← ss2 data 69 B
 3494.32  ← ss2 data 36 B
 3494.32  ← ss2 data 71 B
 3494.34  ← ss2 data 36 B
 3494.34  ← ss2 data 36 B
 3494.34  ← ss2 data 703 B
 3494.38  ← ss2 data 36 B
 3494.38  ← ss2 data 36 B
 3494.38  ← ss2 data 69 B
 3494.38  ← ss2 data 36 B
 3494.38  ← ss2 data 70 B
 3494.40  ← ss2 data 36 B
 3494.40  ← ss2 data 36 B
 3494.44  ← ss2 data (cont.) 5792 B
 3494.44  ← ss2 data (cont.) 2247 B
 3494.44  ← ss2 data 36 B
 3494.45  ← ss2 data 36 B
 3494.45  ← ss2 data 69 B
 3494.47  ← ss2 data 36 B
 3494.47  ← ss2 data 36 B
 3494.49  ← ss2 data 36 B
 3503.07  ss1 → ACK
 3519.43  ss1 → ACK
 3519.48  ss1 → ACK
 3525.48  ss1 → ACK
 3568.64  ss1 → data (cont.) 2896 B
 3568.64  ss1 → data (cont.) 1506 B
 3568.77  ss1 → data (cont.) 2896 B
 3568.77  ss1 → data (cont.) 2896 B
 3568.77  ss1 → data (cont.) 1448 B
 3594.07  ← ss2 ACK
 3619.15  ss1 → data (cont.) 875 B
 3672.59  ← ss2 data 236 B
 3672.61  ← ss2 data 69 B
 3672.61  ← ss2 data 36 B
 3672.61  ← ss2 data 81 B
 3672.61  ← ss2 data 36 B
 3672.61  ← ss2 data 36 B
 3672.61  ← ss2 data 426 B
 3672.73  ← ss2 data 36 B
 3672.73  ← ss2 data 36 B
 3672.74  ← ss2 data 69 B
 3672.74  ← ss2 data 36 B
 3672.75  ← ss2 data 77 B
 3672.76  ← ss2 data 36 B
 3672.76  ← ss2 data 36 B
 3672.83  ← ss2 data (cont.) 5792 B
 3672.83  ← ss2 data (cont.) 1366 B
 3672.86  ← ss2 data 3155 B
 3688.74  ← ss2 data 36 B
 3688.76  ← ss2 data 36 B
 3688.76  ← ss2 data 69 B
 3688.76  ← ss2 data 36 B
 3688.76  ← ss2 data 78 B
 3688.76  ← ss2 data 36 B
 3688.76  ← ss2 data 36 B
 3688.76  ← ss2 data 445 B
 3688.76  ← ss2 data 36 B
 3688.77  ← ss2 data 36 B
 3688.77  ← ss2 data 69 B
 3688.77  ← ss2 data 36 B
 3688.77  ← ss2 data 71 B
 3688.77  ← ss2 data 36 B
 3688.77  ← ss2 data 36 B
 3688.77  ← ss2 data 703 B
 3688.78  ← ss2 data 36 B
 3688.78  ← ss2 data 36 B
 3688.78  ← ss2 data 69 B
 3688.78  ← ss2 data 36 B
 3688.78  ← ss2 data 70 B
 3688.78  ← ss2 data 36 B
 3688.78  ← ss2 data 36 B
 3688.79  ← ss2 data (cont.) 5792 B
 3688.79  ← ss2 data (cont.) 2247 B
 3688.79  ← ss2 data 36 B
 3688.79  ← ss2 data 36 B
 3688.79  ← ss2 data 69 B
 3688.79  ← ss2 data 36 B
 3688.79  ← ss2 data 36 B
 3688.79  ← ss2 data 36 B
 3698.14  ss1 → ACK
 3713.80  ss1 → ACK
 3713.85  ss1 → ACK
 3752.00  ss1 → data (cont.) 2896 B
 3752.00  ss1 → data (cont.) 1506 B
 3752.08  ss1 → data (cont.) 2896 B
 3752.08  ss1 → data (cont.) 2896 B
 3752.08  ss1 → data (cont.) 1448 B
 3777.36  ← ss2 ACK
 3802.45  ss1 → data (cont.) 875 B
 3842.88  ← ss2 data 236 B
 3842.90  ← ss2 data 69 B
 3842.92  ← ss2 data 36 B
 3842.92  ← ss2 data 81 B
 3842.92  ← ss2 data 36 B
 3842.92  ← ss2 data 36 B
 3842.93  ← ss2 data 426 B
 3843.12  ← ss2 data 36 B
 3843.13  ← ss2 data 36 B
 3843.13  ← ss2 data 69 B
 3843.13  ← ss2 data 36 B
 3843.13  ← ss2 data 77 B
 3843.13  ← ss2 data 36 B
 3843.14  ← ss2 data 36 B
 3843.22  ← ss2 data (cont.) 5792 B
 3843.23  ← ss2 data (cont.) 2318 B
 3843.23  ← ss2 data 2203 B
 3859.45  ← ss2 data 36 B
 3859.47  ← ss2 data 36 B
 3859.47  ← ss2 data 69 B
 3859.47  ← ss2 data 36 B
 3859.47  ← ss2 data 78 B
 3859.47  ← ss2 data 36 B
 3859.50  ← ss2 data 36 B
 3859.52  ← ss2 data 445 B
 3859.52  ← ss2 data 36 B
 3859.53  ← ss2 data 36 B
 3859.53  ← ss2 data 69 B
 3859.54  ← ss2 data 36 B
 3859.55  ← ss2 data 71 B
 3859.55  ← ss2 data 36 B
 3859.55  ← ss2 data 36 B
 3859.57  ← ss2 data 703 B
 3859.58  ← ss2 data 36 B
 3859.58  ← ss2 data 36 B
 3859.59  ← ss2 data 69 B
 3859.59  ← ss2 data 36 B
 3859.59  ← ss2 data 70 B
 3859.59  ← ss2 data 36 B
 3859.59  ← ss2 data 36 B
 3859.63  ← ss2 data (cont.) 5792 B
 3859.63  ← ss2 data (cont.) 2247 B
 3859.64  ← ss2 data 36 B
 3859.65  ← ss2 data 36 B
 3859.65  ← ss2 data 69 B
 3859.65  ← ss2 data 36 B
 3859.65  ← ss2 data 36 B
 3859.67  ← ss2 data 36 B
```
