#!/usr/bin/env bash
# Postgres (Neon) connection strings for one deploy, written to $GITHUB_OUTPUT and masked:
#   direct_url  migrations (a direct connection)
#   pooled_url  the Worker at runtime (through Neon's connection pooler)
#
# production: the DATABASE_URL (direct) and DATABASE_URL_POOLED secrets Elfo writes when Neon
#             is connected (the project's default branch).
# staging:    the Neon branch named `staging` (NEON_BRANCH) in NEON_PROJECT_ID, created from the
#             project's default branch on the first staging deploy. Database `neondb` if it
#             exists, else the branch's first database; role = that database's owner.
#
# Usage: database-urls.sh <production|staging>
#   env DATABASE_URL, DATABASE_URL_POOLED (production); NEON_API_KEY, NEON_PROJECT_ID (staging)
# Never prints a connection string.
set -euo pipefail

target="${1:?usage: database-urls.sh <production|staging>}"
output="${GITHUB_OUTPUT:-/dev/null}"
NEON_API="${NEON_API:-https://console.neon.tech/api/v2}"
NEON_BRANCH="${NEON_BRANCH:-staging}"

connect_hint="Conecte o Neon no Elfo (Board → Settings → Deploy): o Elfo grava os secrets e publica de novo."

# Masks a connection string and its password in every later log line.
mask_url() {
  local url="$1" password
  echo "::add-mask::$url"
  password="$(sed -nE 's#^[a-z]+://[^:/@]+:([^@]+)@.*#\1#p' <<<"$url")"
  [ -z "$password" ] || echo "::add-mask::$password"
}

write_urls() {
  local direct="$1" pooled="$2"
  mask_url "$direct"
  mask_url "$pooled"
  {
    echo "direct_url=$direct"
    echo "pooled_url=$pooled"
  } >>"$output"
}

uri() { jq -rn --arg v "$1" '$v | @uri'; }

# neon_api METHOD PATH [JSON]: prints the response body; on an HTTP error prints Neon's message
# (never a credential) and fails. Only GETs are retried: a retried POST could create twice.
neon_api() {
  local method="$1" path="$2" data="${3:-}" body status message
  body="$(mktemp)"
  local args=(-sS -X "$method" -o "$body" -w '%{http_code}' --max-time 60
    -H "Authorization: Bearer ${NEON_API_KEY}" -H "Accept: application/json")
  [ "$method" != "GET" ] || args+=(--retry 3 --retry-delay 2 --retry-all-errors)
  [ -z "$data" ] || args+=(-H "Content-Type: application/json" --data "$data")
  status="$(curl "${args[@]}" "${NEON_API}${path}")" || true
  if [[ "${status:-000}" != 2* ]]; then
    message="$(jq -r '.message // empty' "$body" 2>/dev/null | head -c 300 || true)"
    rm -f "$body"
    echo "::error title=Erro na API do Neon::$method ${path%%\?*} respondeu HTTP ${status:-000}${message:+: $message}" >&2
    return 1
  fi
  cat "$body"
  rm -f "$body"
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
      sleep 2
    done
    if [[ ! "$status" =~ ^(finished|skipped|cancelled)$ ]]; then
      echo "::error title=Neon demorou demais::A operação $id ainda está '$status' depois de 2 minutos." >&2
      return 1
    fi
  done
}

production() {
  local direct="${DATABASE_URL:-}" pooled="${DATABASE_URL_POOLED:-}"
  if [ -z "$direct" ]; then
    echo "::error title=Neon não conectado::Falta o secret DATABASE_URL. $connect_hint"
    exit 1
  fi
  if [ -z "$pooled" ]; then
    echo "::warning title=Sem DATABASE_URL_POOLED::O Worker vai usar a conexão direta (DATABASE_URL). Reconecte o Neon no Elfo para gravar a conexão com pooling."
    pooled="$direct"
  fi
  write_urls "$direct" "$pooled"
  echo "Banco de produção: a branch padrão do projeto Neon (secrets DATABASE_URL*)."
}

staging() {
  local missing=() branches branch_id created endpoints database role databases direct pooled
  [ -n "${NEON_API_KEY:-}" ] || missing+=("NEON_API_KEY")
  [ -n "${NEON_PROJECT_ID:-}" ] || missing+=("NEON_PROJECT_ID")
  if [ "${#missing[@]}" -gt 0 ]; then
    echo "::error title=Neon não conectado::Faltam ${missing[*]} (staging usa a branch '$NEON_BRANCH' do Neon). $connect_hint"
    exit 1
  fi
  local project="/projects/${NEON_PROJECT_ID}"

  branches="$(neon_api GET "$project/branches?search=$(uri "$NEON_BRANCH")")"
  branch_id="$(jq -r --arg n "$NEON_BRANCH" '[.branches[]? | select(.name == $n)][0].id // empty' <<<"$branches")"

  if [ -z "$branch_id" ]; then
    # No parent_id: Neon branches from the project's default branch (schema and data as of now).
    created="$(neon_api POST "$project/branches" \
      "$(jq -nc --arg n "$NEON_BRANCH" '{branch: {name: $n}, endpoints: [{type: "read_write"}]}')")"
    branch_id="$(jq -r '.branch.id' <<<"$created")"
    # shellcheck disable=SC2046 # one operation id per word
    wait_for_operations $(jq -r '.operations[]?.id' <<<"$created")
    echo "::notice title=Branch '$NEON_BRANCH' criada no Neon::Criada a partir da branch padrão do projeto (cópia do banco de produção de agora)."
  else
    # A branch made by hand may have no compute: give it one, or nothing can connect.
    endpoints="$(neon_api GET "$project/branches/${branch_id}/endpoints")"
    if [ "$(jq '[.endpoints[]? | select(.type == "read_write")] | length' <<<"$endpoints")" = "0" ]; then
      created="$(neon_api POST "$project/endpoints" \
        "$(jq -nc --arg b "$branch_id" '{endpoint: {branch_id: $b, type: "read_write"}}')")"
      # shellcheck disable=SC2046
      wait_for_operations $(jq -r '.operations[]?.id' <<<"$created")
    fi
    echo "Branch '$NEON_BRANCH' do Neon já existe ($branch_id)."
  fi

  databases="$(neon_api GET "$project/branches/${branch_id}/databases")"
  database="$(jq -r '([.databases[]? | select(.name == "neondb")][0] // .databases[0]) | .name // empty' <<<"$databases")"
  role="$(jq -r --arg d "$database" '[.databases[]? | select(.name == $d)][0].owner_name // empty' <<<"$databases")"
  if [ -z "$database" ] || [ -z "$role" ]; then
    echo "::error title=Branch sem banco::A branch '$NEON_BRANCH' do Neon não tem nenhum banco de dados."
    exit 1
  fi

  local query
  query="branch_id=$(uri "$branch_id")&database_name=$(uri "$database")&role_name=$(uri "$role")"
  direct="$(neon_api GET "$project/connection_uri?${query}&pooled=false" | jq -r '.uri // empty')"
  pooled="$(neon_api GET "$project/connection_uri?${query}&pooled=true" | jq -r '.uri // empty')"
  if [ -z "$direct" ] || [ -z "$pooled" ]; then
    echo "::error title=Sem connection string::O Neon não devolveu a connection string da branch '$NEON_BRANCH'."
    exit 1
  fi
  write_urls "$direct" "$pooled"
  echo "Banco de staging: branch '$NEON_BRANCH' do Neon, banco '$database', role '$role'."
}

case "$target" in
  production) production ;;
  staging) staging ;;
  *)
    echo "::error::Ambiente desconhecido: '$target' (use production ou staging)."
    exit 1
    ;;
esac
