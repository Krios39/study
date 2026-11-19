# Обмены ss1 ↔ ss2: full × RTT 50 мс, 20 запросов по 142742 Б

| config | RTT задан | RTT потока (ядро) | соединения | запрос по записи, мс | curl, мс | паузы ≥0.4·RTT | сумма пауз, мс | др. порты |
|---|---|---|---|---|---|---|---|---|
| full | 50 | 50.82 (min 50.16) | new TCP + resumed TLS: 20 | 519.0 | 564.7 | 19 | 479.1 | — |

RTT потока — сглаженный rtt сокетов ss1 → ss2:5500 по ядру (ss -tin) во время запросов, в скобках minrtt (у соединений пула — минимум с момента открытия, в т. ч. до смены задержки). В хронологии исходящие пакеты ss1 видны уже после очереди netem (сдвиг на RTT/2), входящие — по приходу. Запрос по записи — от первого пакета запроса до последних данных ответа на канале ss1 ↔ ss2. Пауза — промежуток между соседними пакетами запроса не меньше max(0.4·RTT, 1 мс).

## full, RTT 50 мс — медианный запрос (new TCP + resumed TLS, 519.1 мс)

Паузы:
- 25.1 мс: после «← ss2 ACK» до «← ss2 SYN-ACK»
- 25.1 мс: после «← ss2 SYN-ACK» до «ss1 → ACK»
- 25.1 мс: после «ss1 → ClientHello 2800 B» до «← ss2 ACK»
- 25.0 мс: после «← ss2 Finished (enc.) 45 B» до «ss1 → ACK»
- 25.1 мс: после «ss1 → data (cont.) 2896 B» до «← ss2 ACK»
- 25.1 мс: после «← ss2 ACK» до «ss1 → data (cont.) 2896 B»
- 25.2 мс: после «ss1 → data (cont.) 2896 B» до «← ss2 ACK»
- 25.0 мс: после «← ss2 ACK» до «ss1 → data (cont.) 2896 B»
- 25.0 мс: после «ss1 → data (cont.) 2896 B» до «← ss2 ACK»
- 24.9 мс: после «← ss2 ACK» до «ss1 → data (cont.) 2896 B»
- 25.1 мс: после «ss1 → data (cont.) 2992 B» до «← ss2 ACK»
- 25.0 мс: после «← ss2 ACK» до «ss1 → data (cont.) 4344 B»
- 25.0 мс: после «ss1 → data (cont.) 3291 B» до «← ss2 ACK»
- 27.4 мс: после «← ss2 ACK» до «← ss2 data 224 B»
- 25.4 мс: после «← ss2 data 63 B» до «ss1 → ACK»
- 25.1 мс: после «ss1 → ACK» до «← ss2 data 2896 B»
- 25.1 мс: после «← ss2 data (cont.) 2896 B» до «ss1 → ACK»
- 25.2 мс: после «ss1 → ACK» до «← ss2 data (cont.) 2896 B»
- 25.1 мс: после «← ss2 data (cont.) 2896 B» до «ss1 → ACK»
- 25.0 мс: после «ss1 → ACK» до «← ss2 data (cont.) 2896 B»

```
    0.00  ss1 → SYN
    0.02  ← ss2 ACK
   25.10  ← ss2 SYN-ACK
   50.17  ss1 → ACK
   50.95  ss1 → ClientHello 2800 B
   76.08  ← ss2 ACK
   78.48  ← ss2 TLS hs 2+4 2660 B
   78.51  ← ss2 ChangeCipherSpec 6 B
   78.62  ← ss2 Finished (enc.) 45 B
  103.59  ss1 → ACK
  103.60  ss1 → ACK
  103.63  ss1 → ACK
  104.27  ss1 → ChangeCipherSpec 6 B
  113.35  ss1 → Finished (enc.) 2896 B
  113.35  ss1 → data (cont.) 2896 B
  113.41  ss1 → data (cont.) 2896 B
  113.41  ss1 → data (cont.) 1448 B
  113.41  ss1 → data (cont.) 2896 B
  138.54  ← ss2 ACK
  138.56  ← ss2 ACK
  138.56  ← ss2 ACK
  138.57  ← ss2 ACK
  163.63  ss1 → data (cont.) 2896 B
  163.63  ss1 → data (cont.) 2896 B
  163.64  ss1 → data (cont.) 2896 B
  163.64  ss1 → data (cont.) 2896 B
  163.64  ss1 → data (cont.) 2896 B
  163.64  ss1 → data (cont.) 2896 B
  163.64  ss1 → data (cont.) 2896 B
  163.64  ss1 → data (cont.) 2896 B
  163.64  ss1 → data (cont.) 2896 B
  163.64  ss1 → data (cont.) 2896 B
  188.89  ← ss2 ACK
  189.02  ← ss2 ACK
  213.98  ss1 → data (cont.) 2896 B
  213.99  ss1 → data (cont.) 2896 B
  214.04  ss1 → data (cont.) 2896 B
  214.04  ss1 → data (cont.) 2896 B
  214.04  ss1 → data (cont.) 2896 B
  214.04  ss1 → data (cont.) 2896 B
  214.05  ss1 → data (cont.) 2896 B
  214.05  ss1 → data (cont.) 2896 B
  214.05  ss1 → data (cont.) 2896 B
  214.05  ss1 → data (cont.) 2896 B
  214.05  ss1 → data (cont.) 2896 B
  214.05  ss1 → data (cont.) 2896 B
  214.05  ss1 → data (cont.) 2896 B
  214.05  ss1 → data (cont.) 2896 B
  214.06  ss1 → data (cont.) 2896 B
  214.06  ss1 → data (cont.) 2896 B
  214.06  ss1 → data (cont.) 2896 B
  214.06  ss1 → data (cont.) 2896 B
  214.06  ss1 → data (cont.) 2896 B
  214.06  ss1 → data (cont.) 2896 B
  239.09  ← ss2 ACK
  239.23  ← ss2 ACK
  264.18  ss1 → data (cont.) 2896 B
  264.18  ss1 → data (cont.) 2896 B
  264.33  ss1 → data (cont.) 4344 B
  264.33  ss1 → data (cont.) 4344 B
  264.33  ss1 → data (cont.) 4344 B
  264.34  ss1 → data (cont.) 4344 B
  264.34  ss1 → data (cont.) 4344 B
  264.34  ss1 → data (cont.) 4344 B
  264.34  ss1 → data (cont.) 4344 B
  264.34  ss1 → data (cont.) 4344 B
  264.34  ss1 → data (cont.) 4344 B
  264.34  ss1 → data (cont.) 4344 B
  264.34  ss1 → data (cont.) 2992 B
  289.45  ← ss2 ACK
  289.52  ← ss2 ACK
  314.51  ss1 → data (cont.) 4344 B
  314.51  ss1 → data (cont.) 4344 B
  314.51  ss1 → data (cont.) 4344 B
  314.51  ss1 → data (cont.) 4344 B
  314.52  ss1 → data (cont.) 4344 B
  314.52  ss1 → ChangeCipherSpec 4344 B
  314.52  ss1 → data (cont.) 4344 B
  314.52  ss1 → data (cont.) 4344 B
  314.52  ss1 → data (cont.) 4344 B
  314.52  ss1 → data (cont.) 4344 B
  314.63  ss1 → data (cont.) 5792 B
  314.63  ss1 → data (cont.) 3291 B
  339.67  ← ss2 ACK
  339.90  ← ss2 ACK
  367.34  ← ss2 data 224 B
  367.41  ← ss2 data 63 B
  367.41  ← ss2 data 31 B
  367.43  ← ss2 data 75 B
  367.43  ← ss2 data 31 B
  367.43  ← ss2 data 31 B
  367.44  ← ss2 data 419 B
  367.69  ← ss2 data 31 B
  367.69  ← ss2 data 31 B
  367.69  ← ss2 data 63 B
  393.14  ss1 → ACK
  418.27  ← ss2 data 2896 B
  418.30  ← ss2 data (cont.) 2896 B
  418.31  ← ss2 data (cont.) 2896 B
  418.31  ← ss2 data (cont.) 2896 B
  418.31  ← ss2 data (cont.) 2896 B
  418.31  ← ss2 data (cont.) 2896 B
  418.31  ← ss2 data (cont.) 2896 B
  418.31  ← ss2 data (cont.) 2896 B
  418.31  ← ss2 data (cont.) 2896 B
  418.31  ← ss2 data (cont.) 2896 B
  443.37  ss1 → ACK
  443.37  ss1 → ACK
  443.37  ss1 → ACK
  443.37  ss1 → ACK
  468.59  ← ss2 data (cont.) 2896 B
  468.61  ← ss2 data (cont.) 2896 B
  468.61  ← ss2 data (cont.) 2896 B
  468.61  ← ss2 data (cont.) 2896 B
  468.61  ← ss2 data (cont.) 2896 B
  468.61  ← ss2 data (cont.) 2896 B
  468.62  ← ss2 data (cont.) 2896 B
  468.62  ← ss2 data (cont.) 2896 B
  468.62  ← ss2 data (cont.) 2896 B
  468.62  ← ss2 data (cont.) 2896 B
  468.62  ← ss2 data (cont.) 2896 B
  468.62  ← ss2 data (cont.) 2896 B
  468.62  ← ss2 data (cont.) 2896 B
  468.62  ← ss2 data (cont.) 2896 B
  468.62  ← ss2 data (cont.) 2896 B
  468.62  ← ss2 data (cont.) 2896 B
  468.62  ← ss2 data (cont.) 2896 B
  468.62  ← ss2 data (cont.) 2896 B
  468.62  ← ss2 data (cont.) 2896 B
  468.63  ← ss2 data (cont.) 2896 B
  493.71  ss1 → ACK
  493.72  ss1 → ACK
  493.95  ss1 → ACK
  518.92  ← ss2 data (cont.) 2896 B
  518.94  ← ss2 data (cont.) 2896 B
  518.94  ← ss2 data (cont.) 4344 B
  518.94  ← ss2 data (cont.) 4344 B
  518.95  ← ss2 data (cont.) 4344 B
  518.95  ← ss2 data (cont.) 4344 B
  518.95  ← ss2 data (cont.) 4344 B
  518.95  ← ss2 data (cont.) 4344 B
  518.96  ← ss2 data (cont.) 4344 B
  518.96  ← ss2 data (cont.) 4344 B
  519.07  ← ss2 data (cont.) 4344 B
  519.08  ← ss2 data (cont.) 4344 B
  519.08  ← ss2 data (cont.) 4344 B
  519.08  ← ss2 data (cont.) 4344 B
  519.08  ← ss2 data (cont.) 4344 B
  519.08  ← ss2 data (cont.) 4344 B
  519.08  ← ss2 FIN 207 B
```
