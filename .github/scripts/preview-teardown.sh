#!/usr/bin/env bash
# Deletes one pull request's preview (preview.yml, when the PR is closed or merged):
#   - the Worker <name>-pr-<n> on Cloudflare (preview-worker-name.sh), and
#   - the Neon branch `preview/pr-<n>` in NEON_PROJECT_ID (its compute goes with it).
# Only those exact names: never the production or staging Worker, never the project's default or
# protected branch, `production` or `staging`. Nothing to delete is fine (a notice); a missing
# secret skips that half. An API error fails the run, so a leftover (which costs) shows up.
#
# Usage: preview-teardown.sh <repo-name> <pr-number>
#   env CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID, NEON_API_KEY, NEON_PROJECT_ID,
#   CLOUDFLARE_WORKER_NAME (optional, as in deploy.yml)
# Writes worker=, worker_state=, branch=, branch_state= (deleted|absent|skipped|failed) to
# $GITHUB_OUTPUT. Never prints a credential.
set -euo pipefail

dir="$(dirname "${BASH_SOURCE[0]}")"
# shellcheck source=neon-api.sh
source "$dir/neon-api.sh"

repo_name="${1:?usage: preview-teardown.sh <repo-name> <pr-number>}"
pr="${2:?usage: preview-teardown.sh <repo-name> <pr-number>}"
output="${GITHUB_OUTPUT:-/dev/null}"
CLOUDFLARE_API="${CLOUDFLARE_API:-https://api.cloudflare.com/client/v4}"

worker="$("$dir/preview-worker-name.sh" "$repo_name" "$pr")"
branch="preview/pr-$pr"
failed=false

delete_worker() {
  if [ -z "${CLOUDFLARE_API_TOKEN:-}" ] || [ -z "${CLOUDFLARE_ACCOUNT_ID:-}" ]; then
    echo "::notice title=Worker do preview não verificado::Sem os secrets da Cloudflare, o Worker '$worker' não foi procurado nem apagado."
    worker_state=skipped
    return
  fi
  local body status message
  body="$(mktemp)"
  status="$(curl -sS -X DELETE -o "$body" -w '%{http_code}' --max-time 60 --retry 3 --retry-delay 2 \
    -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" \
    "${CLOUDFLARE_API}/accounts/${CLOUDFLARE_ACCOUNT_ID}/workers/scripts/${worker}")" || true
  message="$(jq -r '[.errors[]?.message] | join("; ")' "$body" 2>/dev/null | head -c 300 || true)"
  rm -f "$body"
  case "${status:-000}" in
    2*)
      echo "Worker '$worker' apagado."
      worker_state=deleted
      ;;
    404)
      echo "::notice title=Nada a apagar na Cloudflare::O Worker '$worker' não existe."
      worker_state=absent
      ;;
    *)
      echo "::error title=Não deu para apagar o Worker do preview::A Cloudflare respondeu HTTP ${status:-000}${message:+: $message} ao apagar '$worker'. Apague-o no painel (Workers & Pages) para não deixar sobra."
      worker_state=failed
      failed=true
      ;;
  esac
}

delete_branch() {
  if [ -z "${NEON_API_KEY:-}" ] || [ -z "${NEON_PROJECT_ID:-}" ]; then
    echo "::notice title=Branch do preview não verificada::Sem NEON_API_KEY/NEON_PROJECT_ID, a branch '$branch' do Neon não foi procurada nem apagada."
    branch_state=skipped
    return
  fi
  local found id
  if ! found="$(neon_branch_by_name "$branch")"; then
    branch_state=failed
    failed=true
    return
  fi
  if [ -z "$found" ]; then
    echo "::notice title=Nada a apagar no Neon::A branch '$branch' não existe."
    branch_state=absent
    return
  fi
  if [ "$(jq -r '.default or .protected or (.name | IN("production", "staging", "main"))' <<<"$found")" = "true" ] ||
    [ "$(jq -r '.name' <<<"$found")" != "$branch" ]; then
    echo "::error title=Branch recusada::A branch '$branch' do Neon é a padrão ou protegida do projeto; o preview nunca a apaga."
    branch_state=failed
    failed=true
    return
  fi
  id="$(jq -r '.id' <<<"$found")"

  # 423: the branch is busy with another operation (a compute starting or suspending); retry.
  local attempt message
  for attempt in $(seq 1 "${NEON_DELETE_ATTEMPTS:-6}"); do
    neon_call DELETE "/projects/${NEON_PROJECT_ID}/branches/${id}"
    case "$NEON_STATUS" in
      2*)
        # shellcheck disable=SC2046 # one operation id per word
        if wait_for_operations $(jq -r '.operations[]?.id' <<<"$NEON_BODY"); then
          echo "Branch '$branch' do Neon apagada ($id)."
          branch_state=deleted
        else
          branch_state=failed
          failed=true
        fi
        return
        ;;
      404)
        echo "::notice title=Nada a apagar no Neon::A branch '$branch' não existe mais."
        branch_state=absent
        return
        ;;
      000 | 409 | 423 | 429 | 5*)
        echo "Neon respondeu HTTP $NEON_STATUS ao apagar '$branch' (tentativa $attempt)."
        [ "$attempt" -eq "${NEON_DELETE_ATTEMPTS:-6}" ] || sleep "${NEON_POLL_DELAY:-5}"
        ;;
      *) break ;;
    esac
  done
  message="$(neon_message)"
  echo "::error title=Não deu para apagar a branch do preview::O Neon respondeu HTTP $NEON_STATUS${message:+: $message} ao apagar '$branch'. Apague-a no painel do Neon (Branches) para não deixar sobra."
  branch_state=failed
  failed=true
}

delete_worker
delete_branch

{
  echo "worker=$worker"
  echo "worker_state=$worker_state"
  echo "branch=$branch"
  echo "branch_state=$branch_state"
} >>"$output"

label() {
  case "$1" in
    deleted) echo "apagado(a)" ;;
    absent) echo "não existia" ;;
    skipped) echo "não verificado(a) (faltam secrets)" ;;
    *) echo "**falhou**" ;;
  esac
}
{
  if $failed; then echo "## ⚠️ Preview do PR #$pr: algo não foi apagado"; else echo "## 🧹 Preview do PR #$pr"; fi
  echo
  echo "- Worker \`$worker\`: $(label "$worker_state")"
  echo "- Branch \`$branch\` do Neon: $(label "$branch_state")"
} >>"${GITHUB_STEP_SUMMARY:-/dev/stderr}"

if $failed; then exit 1; fi
