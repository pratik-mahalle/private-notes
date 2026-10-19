#!/usr/bin/env bash
# Usage: bash scripts/check-headers.sh <base-url>   (run `npm run build` first; reads dist/assets/*.wasm)
base="${1:?usage: check-headers.sh <base-url>}"; base="${base%/}"
cd "$(dirname "$0")/.." || exit 1
fail=0
ok()  { echo "OK   $1"; }
bad() { echo "FAIL $1"; fail=1; }
hdr() { curl -sI "$1" | tr -d '\r' | grep -i "^$2:" | head -1 | cut -d: -f2- | xargs; }

h=$(hdr "$base/" cross-origin-opener-policy);   [ "$h" = "same-origin" ]  && ok "/ COOP same-origin"  || bad "/ COOP (got '${h:-none}')"
h=$(hdr "$base/" cross-origin-embedder-policy); [ "$h" = "require-corp" ] && ok "/ COEP require-corp" || bad "/ COEP (got '${h:-none}')"

shopt -s nullglob
files=(dist/assets/*.wasm)
[ ${#files[@]} -gt 0 ] || bad "no dist/assets/*.wasm (run npm run build)"
for f in "${files[@]}"; do
  p="/assets/$(basename "$f")"
  t=$(hdr "$base$p" content-type)
  size=$(curl -s -o /dev/null -w '%{size_download}' "$base$p")
  if [ "$t" = "application/wasm" ] && [ "${size:-0}" -gt 1000000 ]; then ok "$p application/wasm, $size bytes"
  else bad "$p (type '${t:-none}', $size bytes)"; fi
done
exit $fail
