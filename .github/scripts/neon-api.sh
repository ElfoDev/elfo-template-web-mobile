# Neon API v2 helpers (curl + jq), sourced by database-urls.sh and preview-teardown.sh.
#   env NEON_API_KEY, NEON_PROJECT_ID; NEON_API (the API base URL, overridable for tests)
# Never prints a credential: errors show the HTTP status and Neon's own message.
# shellcheck shell=bash

NEON_API="${NEON_API:-https://console.neon.tech/api/v2}"

uri() { jq -rn --arg v "$1" '$v | @uri'; }

# neon_call METHOD PATH [JSON]: sets NEON_STATUS (the HTTP code, 000 without a response) and
# NEON_BODY. Never fails and prints nothing: call it outside $(...) to read both. Only GETs are
# retried: a retried POST could create twice.
neon_call() {
  local method="$1" path="$2" data="${3:-}" body
  body="$(mktemp)"
  local args=(-sS -X "$method" -o "$body" -w '%{http_code}' --max-time 60
    -H "Authorization: Bearer ${NEON_API_KEY}" -H "Accept: application/json")
  [ "$method" != "GET" ] || args+=(--retry 3 --retry-delay 2 --retry-all-errors)
  [ -z "$data" ] || args+=(-H "Content-Type: application/json" --data "$data")
  NEON_STATUS="$(curl "${args[@]}" "${NEON_API}${path}")" || true
  NEON_STATUS="${NEON_STATUS:-000}"
  NEON_BODY="$(cat "$body")"
  rm -f "$body"
}

# Neon's error message in NEON_BODY (never a credential), at most 300 characters.
neon_message() { jq -r '.message // empty' <<<"$NEON_BODY" 2>/dev/null | head -c 300 || true; }

# neon_api METHOD PATH [JSON]: prints the response body; on an HTTP error prints Neon's message
# and fails.
neon_api() {
  neon_call "$@"
  if [[ "$NEON_STATUS" != 2* ]]; then
    local message
    message="$(neon_message)"
    echo "::error title=Erro na API do Neon::$1 ${2%%\?*} respondeu HTTP $NEON_STATUS${message:+: $message}" >&2
    return 1
  fi
  printf '%s\n' "$NEON_BODY"
}

# Waits until the given Neon operations finish (a new branch or compute is not usable before).
wait_for_operations() {
  local id status
  for id in "$@"; do
    for _ in $(seq 1 60); do
      status="$(neon_api GET "/projects/${NEON_PROJECT_ID}/operations/${id}" | jq -r '.operation.status')"
      case "$status" in
        finished | skipped | cancelled) break ;;
        failed | error)
          echo "::error title=Operação do Neon falhou::A operação $id terminou como '$status'." >&2
          return 1
          ;;
      esac
      sleep "${NEON_POLL_DELAY:-2}"
    done
    if [[ ! "$status" =~ ^(finished|skipped|cancelled)$ ]]; then
      echo "::error title=Neon demorou demais::A operação $id ainda está '$status' depois de 2 minutos." >&2
      return 1
    fi
  done
}

# The branch named exactly $1 (Neon's `search` also matches other names) as compact JSON
# ({id, name, default, protected}), or nothing when there is none.
neon_branch_by_name() {
  neon_api GET "/projects/${NEON_PROJECT_ID}/branches?search=$(uri "$1")" |
    jq -c --arg n "$1" '[.branches[]? | select(.name == $n)][0] // empty
      | {id, name, default: (.default // .primary // false), protected: (.protected // false)}'
}
