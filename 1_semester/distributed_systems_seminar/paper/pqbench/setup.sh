#!/usr/bin/env bash
# JDK 21 and jars for the benchmark, into ~/pqbench (no root needed)
set -euo pipefail
W=~/pqbench
mkdir -p "$W/lib" "$W/jdk"
if [ ! -x "$W/jdk/bin/java" ]; then
  curl -fsSL -o "$W/jdk.tar.gz" "https://api.adoptium.net/v3/binary/latest/21/ga/linux/x64/jdk/hotspot/normal/eclipse"
  tar -xzf "$W/jdk.tar.gz" -C "$W/jdk" --strip-components=1
  rm "$W/jdk.tar.gz"
fi
M=https://repo1.maven.org/maven2
cd "$W/lib"
for p in \
  org/bouncycastle/bcprov-jdk18on/1.84/bcprov-jdk18on-1.84.jar \
  org/openjdk/jmh/jmh-core/1.37/jmh-core-1.37.jar \
  org/openjdk/jmh/jmh-generator-annprocess/1.37/jmh-generator-annprocess-1.37.jar \
  net/sf/jopt-simple/jopt-simple/5.0.4/jopt-simple-5.0.4.jar \
  org/apache/commons/commons-math3/3.6.1/commons-math3-3.6.1.jar; do
  f=$(basename "$p")
  [ -f "$f" ] || curl -fsSLO "$M/$p"
  echo "$(curl -fsSL "$M/$p.sha1" | cut -c1-40)  $f" | sha1sum -c -
done
ls -la "$W/lib"
"$W/jdk/bin/java" -version
