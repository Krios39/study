#!/usr/bin/env bash
# Real-browser check of a scene-explainer page. Needs the agent-browser CLI.
# Usage: bash check.sh <page.html> <shots-dir> [wait-ms-per-step=3000]
# Steps through every beat, records page errors, screenshots every beat at desktop width and
# four beats at phone width, reports sideways overflow, then builds contact sheets.
set -u
PAGE="$(cd "$(dirname "$1")" && pwd)/$(basename "$1")"; OUT="$2"; WAIT="${3:-3000}"
HERE="$(cd "$(dirname "$0")" && pwd)"; S="scene-explainer-check"
command -v agent-browser >/dev/null || { echo "agent-browser not found"; exit 2; }
mkdir -p "$OUT"; rm -f "$OUT"/d_*.png "$OUT"/m_*.png "$OUT"/sheet_*.png
ab() { agent-browser --session "$S" "$@"; }
ab set viewport 1440 900 >/dev/null 2>&1
ab open "file://$PAGE#0" >/dev/null 2>&1
N=$(ab eval "BEATS.length" 2>/dev/null | tail -1 | tr -dc '0-9')
[ -n "$N" ] || { echo "page did not load or has no BEATS"; ab close >/dev/null 2>&1; exit 1; }
echo "beats: $N"
for ((b=0; b<N; b++)); do
  ab eval "go($b); 1" >/dev/null 2>&1; ab wait "$WAIT" >/dev/null 2>&1
  ab screenshot "$OUT/d_$b.png" >/dev/null 2>&1
done
ab set viewport 390 844 >/dev/null 2>&1
ab open "file://$PAGE#0" >/dev/null 2>&1
for b in 0 $((N/3)) $((2*N/3)) $((N-1)); do
  ab eval "go($b); window.scrollTo(0,0); 1" >/dev/null 2>&1; ab wait "$WAIT" >/dev/null 2>&1
  ab screenshot --full "$OUT/m_$b.png" >/dev/null 2>&1
  echo "phone beat $b: $(ab eval "JSON.stringify({viewport:innerWidth, pageWidth:document.documentElement.scrollWidth, nextAboveCode:(()=>{const n=document.querySelector('#next'),c=document.querySelector('#code');return !c||c.hidden||n.getBoundingClientRect().top<c.getBoundingClientRect().top})()})" 2>/dev/null | tail -1)"
done
echo "page errors:"; ab errors 2>&1 | sed 's/^/  /' | head -20
ab close >/dev/null 2>&1
python3 "$HERE/sheets.py" "$OUT" d_ 4 2 720 && python3 "$HERE/sheets.py" "$OUT" m_ 4 4 360
echo "Now open the sheet_*.png files and look at every step."
