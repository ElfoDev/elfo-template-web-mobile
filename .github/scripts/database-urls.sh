#!/usr/bin/env bash
# Postgres (Neon) connection strings for one deploy, written to $GITHUB_OUTPUT and masked:
#   direct_url  migrations (a direct connection)
#   pooled_url  the Worker at runtime (through Neon's connection pooler)
#
# production: the DATABASE_URL (direct) and DATABASE_URL_POOLED secrets Elfo writes when Neon
#             is connected (the project's default branch).
# staging:    the Neon branch named `staging` (NEON_BRANCH) in NEON_PROJECT_ID, created from the
#             project's default branch on the first staging deploy.
# preview:    the Neon branch NEON_BRANCH (`preview/pr-<n>`, set by preview.yml), created on the
#             PR's first preview as a copy of the `staging` branch when there is one, else of the
#             project's default branch. Later pushes reuse it (its data stays).
# For a Neon branch: database `neondb` if it exists, else the branch's first database; role = that
# database's owner.
#
# Usage: database-urls.sh <production|staging|preview>
#   env DATABASE_URL, DATABASE_URL_POOLED (production); NEON_API_KEY, NEON_PROJECT_ID (staging,
#   preview); NEON_BRANCH (preview)
# Never prints a connection string.
set -euo pipefail

# shellcheck source=neon-api.sh
source "$(dirname "${BASH_SOURCE[0]}")/neon-api.sh"

target="${1:?usage: database-urls.sh <production|staging|preview>}"
output="${GITHUB_OUTPUT:-/dev/null}"

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

# branch_urls <label> <branch> [parent]: the URLs of Neon branch <branch>, created if missing from
# the branch named <parent> when it exists, else from the project's default branch.
branch_urls() {
  local label="$1" name="$2" parent_name="${3:-}"
  local missing=() branch branch_id parent parent_id="" from created endpoints database role databases direct pooled
  [ -n "${NEON_API_KEY:-}" ] || missing+=("NEON_API_KEY")
  [ -n "${NEON_PROJECT_ID:-}" ] || missing+=("NEON_PROJECT_ID")
  if [ "${#missing[@]}" -gt 0 ]; then
    echo "::error title=Neon não conectado::Faltam ${missing[*]} ($label usa a branch '$name' do Neon). $connect_hint"
    exit 1
  fi
  local project="/projects/${NEON_PROJECT_ID}"

  branch="$(neon_branch_by_name "$name")"
  branch_id="$(jq -r '.id // empty' <<<"${branch:-null}")"

  if [ -z "$branch_id" ]; then
    from="da branch padrão do projeto (cópia do banco de produção de agora)"
    if [ -n "$parent_name" ]; then
      parent="$(neon_branch_by_name "$parent_name")"
      parent_id="$(jq -r '.id // empty' <<<"${parent:-null}")"
      [ -z "$parent_id" ] || from="da branch '$parent_name' (cópia do banco de $parent_name de agora)"
    fi
    # Without parent_id Neon branches from the project's default branch (schema and data as of now).
    if ! created="$(neon_api POST "$project/branches" "$(jq -nc --arg n "$name" --arg p "$parent_id" \
      '{branch: ({name: $n} + (if $p == "" then {} else {parent_id: $p} end)), endpoints: [{type: "read_write"}]}')")"; then
      echo "::error title=Não deu para criar a branch '$name' no Neon::Veja o erro do Neon acima. Se for o limite de branches ou de computes do plano, feche PRs antigos (o preview de cada PR fechado é apagado) ou apague branches que sobraram no painel do Neon."
      exit 1
    fi
    branch_id="$(jq -r '.branch.id' <<<"$created")"
    # shellcheck disable=SC2046 # one operation id per word
    wait_for_operations $(jq -r '.operations[]?.id' <<<"$created")
    echo "::notice title=Branch '$name' criada no Neon::Criada a partir $from."
  else
    # Never point a deploy that owns its branch at the project's main data.
    if [ "$target" = "preview" ] && [ "$(jq -r '.default or .protected' <<<"$branch")" = "true" ]; then
      echo "::error title=Branch '$name' recusada::A branch '$name' do Neon é a branch padrão ou protegida do projeto; o preview só usa uma branch própria."
      exit 1
    fi
    # A branch made by hand may have no compute: give it one, or nothing can connect.
    endpoints="$(neon_api GET "$project/branches/${branch_id}/endpoints")"
    if [ "$(jq '[.endpoints[]? | select(.type == "read_write")] | length' <<<"$endpoints")" = "0" ]; then
      created="$(neon_api POST "$project/endpoints" \
        "$(jq -nc --arg b "$branch_id" '{endpoint: {branch_id: $b, type: "read_write"}}')")"
      # shellcheck disable=SC2046
      wait_for_operations $(jq -r '.operations[]?.id' <<<"$created")
    fi
    echo "Branch '$name' do Neon já existe ($branch_id)."
  fi

  databases="$(neon_api GET "$project/branches/${branch_id}/databases")"
  database="$(jq -r '([.databases[]? | select(.name == "neondb")][0] // .databases[0]) | .name // empty' <<<"$databases")"
  role="$(jq -r --arg d "$database" '[.databases[]? | select(.name == $d)][0].owner_name // empty' <<<"$databases")"
  if [ -z "$database" ] || [ -z "$role" ]; then
    echo "::error title=Branch sem banco::A branch '$name' do Neon não tem nenhum banco de dados."
    exit 1
  fi

  local query
  query="branch_id=$(uri "$branch_id")&database_name=$(uri "$database")&role_name=$(uri "$role")"
  direct="$(neon_api GET "$project/connection_uri?${query}&pooled=false" | jq -r '.uri // empty')"
  pooled="$(neon_api GET "$project/connection_uri?${query}&pooled=true" | jq -r '.uri // empty')"
  if [ -z "$direct" ] || [ -z "$pooled" ]; then
    echo "::error title=Sem connection string::O Neon não devolveu a connection string da branch '$name'."
    exit 1
  fi
  write_urls "$direct" "$pooled"
  echo "branch=$name" >>"$output"
  echo "Banco de $label: branch '$name' do Neon, banco '$database', role '$role'."
}

case "$target" in
  production) production ;;
  staging) branch_urls staging "${NEON_BRANCH:-staging}" ;;
  preview)
    # Only a PR's own branch: never staging, production or anything else.
    if [[ ! "${NEON_BRANCH:-}" =~ ^preview/pr-[1-9][0-9]*$ ]]; then
      echo "::error title=Branch de preview inválida::NEON_BRANCH deve ser 'preview/pr-<número do PR>' (recebido: '${NEON_BRANCH:-}')."
      exit 1
    fi
    branch_urls preview "$NEON_BRANCH" staging
    ;;
  *)
    echo "::error::Ambiente desconhecido: '$target' (use production, staging ou preview)."
    exit 1
    ;;
esac
