#!/bin/bash
# Screenshot a page top to bottom and dump its rendered text, for review and cold reads.
# Usage: shoot.sh <page.html> <out dir> [page height px, default 20000]
set -e
PAGE="$(cd "$(dirname "$1")" && pwd)/$(basename "$1")"; OUT="$2"; H="${3:-20000}"; mkdir -p "$OUT"
CH="${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
UD="${TMPDIR:-/tmp}/codebase-audit-chrome.noindex"   # isolated profile: the user's own profile makes headless Chrome hang
run() { perl -e 'alarm 90; exec @ARGV' "$CH" --headless=new --user-data-dir="$UD" --no-first-run --disable-gpu --hide-scrollbars "$@"; }
run --force-device-scale-factor=1 --window-size=1280,$H --virtual-time-budget=3000 --screenshot="$OUT/full.png" "file://$PAGE" 2>&1 | grep -c written
run --virtual-time-budget=3000 --dump-dom "file://$PAGE" 2>/dev/null > "$OUT/dom.html"
python3 - "$OUT" <<'PY'
import re, html, sys
o = sys.argv[1]; s = open(o + "/dom.html", encoding="utf-8").read()
s = re.sub(r"<script.*?</script>|<style.*?</style>", "", s, flags=re.S)
s = re.sub(r"</(p|div|h1|h2|h3|li|tr|summary|text|section|blockquote|td|th)>", "\n", s)
s = re.sub(r"\n\s*\n+", "\n", re.sub(r"[ \t]+", " ", html.unescape(re.sub(r"<[^>]+>", " ", s))))
open(o + "/page-text.txt", "w", encoding="utf-8").write(s); print(len(s), "chars of text")
PY
cd "$OUT" && rm -f c*.png && i=0 && for ((y=0; y<H; y+=1300)); do
  ffmpeg -loglevel error -y -i full.png -vf "crop=1280:$(( y+1300>H ? H-y : 1300 )):0:$y" "c$(printf %02d $i).png"; i=$((i+1)); done
echo "crops: $i (read them in order; trailing blank crops mean the page is shorter than $H)"
