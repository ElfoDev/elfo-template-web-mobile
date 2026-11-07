#!/usr/bin/env bash
# Smoke test of a deployed environment:
#   <url>/              200 with the Expo web app (the page loads the app bundle)
#   <url>/api/health/db 200 {"database":"ok"} (the Worker reaches the database: secrets and
#                       migrations are in place)
# Retries SMOKE_ATTEMPTS times (default 12, ~2 min) every 10 s: a brand-new workers.dev URL can
# take a little while to answer.
# Usage: smoke-test.sh <url>
set -euo pipefail

url="${1:?usage: smoke-test.sh <url>}"
url="${url%/}"
attempts="${SMOKE_ATTEMPTS:-12}"
delay="${SMOKE_DELAY:-10}"
body="$(mktemp)"
trap 'rm -f "$body"' EXIT

fetch() { curl -sS -L -o "$body" -w '%{http_code}' --max-time 20 "$1" || true; }

web="000"
api="000"
for i in $(seq 1 "$attempts"); do
  web="$(fetch "$url/")"
  web_ok=false
  if [ "$web" = "200" ] && grep -q '_expo/static/js/' "$body"; then web_ok=true; fi

  api="$(fetch "$url/api/health/db")"
  api_ok=false
  if [ "$api" = "200" ] && [ "$(jq -r '.database // empty' "$body" 2>/dev/null)" = "ok" ]; then
    api_ok=true
  fi
  # The API's error bodies name a missing setting, never a value: safe to show.
  api_error="$(jq -r '.error // empty' "$body" 2>/dev/null | head -c 300 || true)"

  if $web_ok && $api_ok; then
    echo "✅ $url/ respondeu 200 (app web) e $url/api/health/db respondeu 200 (banco ok), tentativa $i."
    exit 0
  fi
  echo "Tentativa $i/$attempts: app web HTTP $web, API/banco HTTP $api${api_error:+ ($api_error)}."
  [ "$i" -eq "$attempts" ] || sleep "$delay"
done

if ! $web_ok; then
  echo "::error title=Smoke test falhou (app web)::$url/ respondeu HTTP $web; esperado 200 com o app Expo."
fi
if ! $api_ok; then
  echo "::error title=Smoke test falhou (API/banco)::$url/api/health/db respondeu HTTP $api${api_error:+: $api_error}. Confira os secrets do banco e os logs do Worker."
fi
exit 1
