#!/usr/bin/env bash
# Whether this repository can publish PR previews (preview.yml): a preview needs Cloudflare (the
# Worker) and the Neon API (the PR's own database branch).
#   env CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID, NEON_API_KEY, NEON_PROJECT_ID
# Writes `ready=true|false` and `missing=<names, comma-separated>` to $GITHUB_OUTPUT. Missing
# secrets are a notice, not a failure: the preview is skipped until Elfo (or someone) writes them.
# Never prints a value.
set -euo pipefail

output="${GITHUB_OUTPUT:-/dev/null}"

missing=()
for name in CLOUDFLARE_API_TOKEN CLOUDFLARE_ACCOUNT_ID NEON_API_KEY NEON_PROJECT_ID; do
  [ -n "${!name:-}" ] || missing+=("$name")
done

if [ "${#missing[@]}" -eq 0 ]; then
  echo "Secrets da Cloudflare e do Neon configurados."
  {
    echo "ready=true"
    echo "missing="
  } >>"$output"
  exit 0
fi

list="${missing[*]}"
list="${list// /, }"
{
  echo "ready=false"
  echo "missing=$list"
} >>"$output"

echo "::notice title=Preview pulado::Faltam $list. Conecte a Cloudflare e o Neon no Elfo (Board → Settings → Deploy) para ter um preview por PR."
{
  echo "## ⏭️ Preview pulado"
  echo
  echo "Cada PR ganha um Worker e uma branch do Neon próprios, mas faltam secrets: \`${list//, /\`, \`}\`."
  echo
  echo "**No Elfo:** abra o board deste repositório → **Settings → Deploy** e conecte a Cloudflare"
  echo "e o Neon. O próximo push no PR publica o preview."
} >>"${GITHUB_STEP_SUMMARY:-/dev/stderr}"
