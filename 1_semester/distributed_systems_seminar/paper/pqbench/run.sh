#!/usr/bin/env bash
# Build and run the benchmark in WSL. Usage: run.sh [smoke]
set -euo pipefail
W=~/pqbench
HERE=$(cd "$(dirname "$0")" && pwd)
J=$W/jdk/bin
CP=$(ls "$W"/lib/*.jar | grep -v annprocess | tr '\n' ':')
rm -rf "$W/classes" && mkdir -p "$W/classes"
"$J/javac" -d "$W/classes" -cp "$CP" -processorpath "$W/lib/jmh-generator-annprocess-1.37.jar:$W/lib/jmh-core-1.37.jar" \
  "$HERE"/src/pqbench/*.java
CP="$W/classes:$CP"

stamp=$(date +%Y-%m-%d-%H-%M)
if [ "${1:-}" = smoke ]; then
  out=$W/smoke-$stamp
  mkdir -p "$out"
  "$J/java" -cp "$CP" org.openjdk.jmh.Main -f 1 -wi 1 -i 2 -w 1 -r 1 -rf csv -rff "$out/jmh.csv" 2>&1 | tail -40
  exit 0
fi

out=$HERE/results/$stamp
mkdir -p "$out"
{
  echo "date: $(date -Is)"
  echo "kernel: $(uname -r)"
  grep -m1 'model name' /proc/cpuinfo
  echo "cpus: $(nproc)"
  "$J/java" -version 2>&1
  ls "$W/lib"
} > "$out/env.txt"
"$J/java" -cp "$CP" pqbench.Sizes > "$out/sizes.csv"
"$J/java" -cp "$CP" org.openjdk.jmh.Main -rf csv -rff "$out/jmh.csv" -o "$out/jmh.log"
echo "done: $out"
