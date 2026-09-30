# Счётчики байт на канале ss1 <-> ss2: iptables в сетевом namespace ss1 (docker run --net container:ss1 --cap-add NET_ADMIN).
# Сам ss1 не меняется; правила живут, пока жив контейнер ss1.
FROM alpine:latest
RUN apk add --no-cache iptables
