#!/usr/bin/env bash
# Name of a pull request's preview Worker: <name>-pr-<n> (worker-name.sh, so the variable
# CLOUDFLARE_WORKER_NAME applies and the whole name stays within 63 characters).
# Refuses a name that is the production or the staging Worker (a long name cut to fit could
# land on it): a preview never deploys over them, and its teardown never deletes them.
# Usage: preview-worker-name.sh <repo-name> <pr-number>   -> prints the name
set -euo pipefail

dir="$(dirname "${BASH_SOURCE[0]}")"
repo_name="${1:?usage: preview-worker-name.sh <repo-name> <pr-number>}"
pr="${2:?usage: preview-worker-name.sh <repo-name> <pr-number>}"

if [[ ! "$pr" =~ ^[1-9][0-9]*$ ]]; then
  echo "::error title=Número de PR inválido::'$pr' não é o número de um PR." >&2
  exit 1
fi

name="$("$dir/worker-name.sh" "$repo_name" "-pr-$pr")"
for taken in "$("$dir/worker-name.sh" "$repo_name")" "$("$dir/worker-name.sh" "$repo_name" "-staging")"; do
  if [ "$name" = "$taken" ]; then
    echo "::error title=Nome do Worker do preview em conflito::'$name' é o nome do Worker de produção ou de staging. Defina um nome mais curto na variável CLOUDFLARE_WORKER_NAME." >&2
    exit 1
  fi
done

printf '%s\n' "$name"
