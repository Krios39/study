# Счётчики байт на канале ss1 <-> ss2: iptables в сетевом namespace ss1 (docker run --net container:ss1 --cap-add NET_ADMIN).
# Сам ss1 не меняется; правила живут, пока жив контейнер ss1.
# iproute2 (tc, ss) — эмуляция WAN: netem-задержка между ss1 и ss2 (bench/lib.js netem), правила живут до рестарта контейнера;
# ss -tin — фактический RTT соединений ss1 → ss2:5500 во время прогона (meta.flow_rtt).
# tcpdump, tshark — запись и разбор обменов ss1 ↔ ss2 (bench/flows.js).
FROM alpine:latest
RUN apk add --no-cache iptables iproute2 tcpdump tshark
