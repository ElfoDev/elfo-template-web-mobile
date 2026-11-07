#!/usr/bin/env bash
# Name of the Worker on Cloudflare (it becomes <name>.<account subdomain>.workers.dev).
# The repository variable CLOUDFLARE_WORKER_NAME if set, otherwise the repository name,
# normalized (lowercase, only [a-z0-9-]), then the environment suffix (`-staging` or nothing).
# The whole name, suffix included, is at most 63 characters.
# Usage: worker-name.sh <repo-name> [suffix]   -> prints the name
set -euo pipefail

raw="${CLOUDFLARE_WORKER_NAME:-${1:?usage: worker-name.sh <repo-name> [suffix]}}"
suffix="${2:-}"

name="$(printf '%s' "$raw" | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9-]+/-/g; s/-+/-/g; s/^-+//; s/-+$//')"
name="${name:0:$((63 - ${#suffix}))}"
while [ "${name%-}" != "$name" ]; do name="${name%-}"; done

if [ -z "$name" ]; then
  echo "::error title=Nome do Worker inválido::'$raw' não gera um nome válido; defina a variável CLOUDFLARE_WORKER_NAME (só a-z, 0-9 e -)." >&2
  exit 1
fi

printf '%s%s\n' "$name" "$suffix"
