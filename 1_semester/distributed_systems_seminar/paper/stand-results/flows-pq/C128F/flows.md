# Обмены ss1 ↔ ss2: full × RTT 50 мс, 20 запросов по 87868 Б

| config | RTT задан | RTT потока (ядро) | соединения | запрос по записи, мс | curl, мс | паузы ≥0.4·RTT | сумма пауз, мс | др. порты |
|---|---|---|---|---|---|---|---|---|
| full | 50 | 50.67 (min 50.13) | new TCP + resumed TLS: 20 | 467.2 | 519.5 | 18 | 449.9 | — |

RTT потока — сглаженный rtt сокетов ss1 → ss2:5500 по ядру (ss -tin) во время запросов, в скобках minrtt (у соединений пула — минимум с момента открытия, в т. ч. до смены задержки). В хронологии исходящие пакеты ss1 видны уже после очереди netem (сдвиг на RTT/2), входящие — по приходу. Запрос по записи — от первого пакета запроса до последних данных ответа на канале ss1 ↔ ss2. Пауза — промежуток между соседними пакетами запроса не меньше max(0.4·RTT, 1 мс).

## full, RTT 50 мс — медианный запрос (new TCP + resumed TLS, 467.3 мс)

Паузы:
- 25.1 мс: после «ss1 → SYN» до «← ss2 SYN-ACK»
- 25.1 мс: после «← ss2 SYN-ACK» до «ss1 → ACK»
- 25.1 мс: после «ss1 → ClientHello 2800 B» до «← ss2 ACK»
- 25.0 мс: после «← ss2 Finished (enc.) 45 B» до «ss1 → ACK»
- 25.0 мс: после «ss1 → data (cont.) 2896 B» до «← ss2 ACK»
- 25.0 мс: после «← ss2 ACK» до «ss1 → data (cont.) 2896 B»
- 25.1 мс: после «ss1 → data (cont.) 2896 B» до «← ss2 ACK»
- 24.9 мс: после «← ss2 ACK» до «ss1 → data (cont.) 2896 B»
- 25.0 мс: после «ss1 → data (cont.) 2896 B» до «← ss2 ACK»
- 24.6 мс: после «← ss2 ACK» до «ss1 → data (cont.) 2896 B»
- 24.7 мс: после «ss1 → data (cont.) 604 B» до «← ss2 ACK»
- 24.2 мс: после «← ss2 ACK» до «← ss2 data 224 B»
- 25.5 мс: после «← ss2 data 63 B» до «ss1 → ACK»
- 25.1 мс: после «ss1 → ACK» до «← ss2 data 2896 B»
- 25.1 мс: после «← ss2 data (cont.) 2896 B» до «ss1 → ACK»
- 25.2 мс: после «ss1 → ACK» до «← ss2 data (cont.) 2896 B»
- 25.0 мс: после «← ss2 data (cont.) 2896 B» до «ss1 → ACK»
- 24.9 мс: после «ss1 → ACK» до «← ss2 data (cont.) 2896 B»

```
    0.00  ss1 → SYN
   25.12  ← ss2 SYN-ACK
   50.22  ss1 → ACK
   50.97  ss1 → ClientHello 2800 B
   76.08  ← ss2 ACK
   78.47  ← ss2 TLS hs 2+4 2660 B
   78.50  ← ss2 ChangeCipherSpec 6 B
   78.51  ← ss2 Finished (enc.) 45 B
  103.56  ss1 → ACK
  103.56  ss1 → ACK
  103.56  ss1 → ACK
  104.88  ss1 → ChangeCipherSpec 6 B
  114.94  ss1 → Finished (enc.) 2896 B
  114.94  ss1 → data (cont.) 2896 B
  115.00  ss1 → data (cont.) 2896 B
  115.00  ss1 → data (cont.) 1448 B
  115.01  ss1 → data (cont.) 2896 B
  140.04  ← ss2 ACK
  140.06  ← ss2 ACK
  140.08  ← ss2 ACK
  140.18  ← ss2 ACK
  165.16  ss1 → data (cont.) 2896 B
  165.16  ss1 → data (cont.) 2896 B
  165.16  ss1 → data (cont.) 2896 B
  165.16  ss1 → data (cont.) 2896 B
  165.16  ss1 → data (cont.) 2896 B
  165.16  ss1 → data (cont.) 2896 B
  165.17  ss1 → data (cont.) 2896 B
  165.28  ss1 → data (cont.) 2896 B
  165.28  ss1 → data (cont.) 2896 B
  165.28  ss1 → data (cont.) 2896 B
  190.36  ← ss2 ACK
  190.54  ← ss2 ACK
  215.42  ss1 → data (cont.) 2896 B
  215.43  ss1 → data (cont.) 2896 B
  215.58  ss1 → data (cont.) 2896 B
  215.58  ss1 → data (cont.) 2896 B
  215.58  ss1 → data (cont.) 2896 B
  215.58  ss1 → data (cont.) 2896 B
  215.58  ss1 → data (cont.) 2896 B
  215.58  ss1 → data (cont.) 2896 B
  215.58  ss1 → data (cont.) 2896 B
  215.58  ss1 → data (cont.) 2896 B
  215.58  ss1 → data (cont.) 2896 B
  215.59  ss1 → data (cont.) 2896 B
  215.59  ss1 → data (cont.) 2896 B
  215.59  ss1 → data (cont.) 2896 B
  215.59  ss1 → data (cont.) 2896 B
  215.59  ss1 → data (cont.) 2896 B
  215.59  ss1 → data (cont.) 2896 B
  215.59  ss1 → data (cont.) 2896 B
  215.59  ss1 → data (cont.) 2896 B
  215.59  ss1 → data (cont.) 2896 B
  240.55  ← ss2 ACK
  240.98  ← ss2 ACK
  265.62  ss1 → data (cont.) 2896 B
  265.63  ss1 → data (cont.) 2896 B
  266.05  ss1 → data (cont.) 4344 B
  266.06  ss1 → data (cont.) 4344 B
  266.06  ss1 → data (cont.) 4344 B
  266.06  ss1 → data (cont.) 4344 B
  266.06  ss1 → data (cont.) 604 B
  290.77  ← ss2 ACK
  291.00  ← ss2 ACK
  291.13  ← ss2 ACK
  291.13  ← ss2 ACK
  291.14  ← ss2 ACK
  291.14  ← ss2 ACK
  315.31  ← ss2 data 224 B
  315.34  ← ss2 data 63 B
  315.35  ← ss2 data 31 B
  315.36  ← ss2 data 75 B
  315.36  ← ss2 data 31 B
  315.36  ← ss2 data 31 B
  315.36  ← ss2 data 419 B
  315.88  ← ss2 data 31 B
  315.89  ← ss2 data 31 B
  315.90  ← ss2 data 63 B
  341.37  ss1 → ACK
  366.50  ← ss2 data 2896 B
  366.53  ← ss2 data (cont.) 2896 B
  366.54  ← ss2 data (cont.) 2896 B
  366.54  ← ss2 data (cont.) 2896 B
  366.54  ← ss2 data (cont.) 2896 B
  366.54  ← ss2 data (cont.) 2896 B
  366.54  ← ss2 data (cont.) 2896 B
  366.54  ← ss2 data (cont.) 2896 B
  366.54  ← ss2 data (cont.) 2896 B
  366.54  ← ss2 data (cont.) 2896 B
  391.63  ss1 → ACK
  391.63  ss1 → ACK
  391.63  ss1 → ACK
  391.63  ss1 → ACK
  416.84  ← ss2 data (cont.) 2896 B
  416.93  ← ss2 data (cont.) 2896 B
  416.94  ← ss2 data (cont.) 2896 B
  416.94  ← ss2 data (cont.) 2896 B
  416.94  ← ss2 data (cont.) 2896 B
  416.94  ← ss2 data (cont.) 2896 B
  416.95  ← ss2 data (cont.) 2896 B
  416.95  ← ss2 data (cont.) 2896 B
  416.95  ← ss2 data (cont.) 2896 B
  416.95  ← ss2 data (cont.) 2896 B
  416.95  ← ss2 data (cont.) 2896 B
  416.95  ← ss2 data (cont.) 2896 B
  416.95  ← ss2 data (cont.) 2896 B
  416.96  ← ss2 data (cont.) 2896 B
  416.96  ← ss2 data (cont.) 2896 B
  416.96  ← ss2 data (cont.) 2896 B
  416.96  ← ss2 data (cont.) 2896 B
  416.96  ← ss2 data (cont.) 2896 B
  416.96  ← ss2 data (cont.) 2896 B
  416.96  ← ss2 data (cont.) 2896 B
  442.00  ss1 → ACK
  442.01  ss1 → ACK
  442.21  ss1 → ACK
  442.37  ss1 → ACK
  467.25  ← ss2 data (cont.) 2896 B
  467.31  ← ss2 data (cont.) 2896 B
  467.31  ← ss2 data (cont.) 2896 B
  467.32  ← ss2 data (cont.) 2896 B
  467.32  ← ss2 FIN 141 B
```
