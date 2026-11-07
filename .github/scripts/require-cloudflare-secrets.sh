#!/usr/bin/env bash
# Fails with a clear message when the Cloudflare secrets are missing.
# Usage: env CLOUDFLARE_API_TOKEN / CLOUDFLARE_ACCOUNT_ID from `secrets`.
# Writes `ready=true|false` to $GITHUB_OUTPUT.
# With SKIP_IF_MISSING=true (the template repository itself, which has no Cloudflare account)
# missing secrets become a notice and `ready=false`, so the deploy is skipped instead of failing.
# Repositories created from the template fail until Elfo (or someone) writes the secrets.
set -euo pipefail

output="${GITHUB_OUTPUT:-/dev/null}"

missing=()
[ -n "${CLOUDFLARE_API_TOKEN:-}" ] || missing+=("CLOUDFLARE_API_TOKEN")
[ -n "${CLOUDFLARE_ACCOUNT_ID:-}" ] || missing+=("CLOUDFLARE_ACCOUNT_ID")

if [ "${#missing[@]}" -eq 0 ]; then
  echo "Secrets da Cloudflare configurados."
  echo "ready=true" >>"$output"
  exit 0
fi

echo "ready=false" >>"$output"

repo="${GITHUB_REPOSITORY:-<dono>/<repo>}"
list="${missing[*]}"

if [ "${SKIP_IF_MISSING:-false}" = "true" ]; then
  echo "::notice title=Deploy pulado no template::Este é o repositório-template e não tem ${list// /, }; nada foi publicado. Projetos criados a partir dele publicam sozinhos depois de conectar a Cloudflare no Elfo."
  {
    echo "## ⏭️ Deploy pulado"
    echo
    echo "\`${repo}\` é um repositório-template sem os secrets da Cloudflare"
    echo "(faltando: \`${list// /\`, \`}\`), então nada foi publicado."
  } >>"${GITHUB_STEP_SUMMARY:-/dev/stderr}"
  exit 0
fi

echo "::error title=Cloudflare não conectada::Faltam ${list// /, }. Conecte a Cloudflare no Elfo (Board → Settings → Deploy): o Elfo grava os secrets e publica de novo."

{
  echo "## ❌ Cloudflare não conectada"
  echo
  echo "O deploy precisa dos secrets \`CLOUDFLARE_API_TOKEN\` e \`CLOUDFLARE_ACCOUNT_ID\`."
  echo "Faltando: \`${list// /\`, \`}\`."
  echo
  echo "**No Elfo:** abra o board deste repositório → **Settings → Deploy** e conecte a Cloudflare"
  echo "(e o Neon). O Elfo grava os secrets e dispara o deploy sozinho."
  echo
  echo "**À mão:** um token com o template *Edit Cloudflare Workers*"
  echo "(https://dash.cloudflare.com/profile/api-tokens) e o Account ID do painel:"
  echo
  echo '```sh'
  echo "gh secret set CLOUDFLARE_API_TOKEN --repo ${repo}"
  echo "gh secret set CLOUDFLARE_ACCOUNT_ID --repo ${repo}"
  echo '```'
  echo
  echo "Depois rode este workflow de novo (*Re-run jobs*)."
} >>"${GITHUB_STEP_SUMMARY:-/dev/stderr}"

exit 1
