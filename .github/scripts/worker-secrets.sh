#!/usr/bin/env bash
# Writes the Worker's runtime secrets as a JSON file for `wrangler deploy --secrets-file`:
#   - every secret declared in foreman.json `secrets[]` (the app's own: BETTER_AUTH_SECRET,
#     OAUTH_*...). Required ones must be set; optional ones are left out when empty.
#   - DATABASE_URL: this environment's pooled connection string.
# Adding a secret to foreman.json is enough: Elfo writes it to the repository and every
# deploy puts it on the Worker. Secrets left out of the file keep their previous value.
#
# Usage: worker-secrets.sh <foreman.json> <out.json>
#   env SECRETS_JSON (`toJSON(secrets)` of the job), DATABASE_URL
# Never prints a value; the file is readable only by the runner user.
set -euo pipefail

manifest="${1:?usage: worker-secrets.sh <foreman.json> <out.json>}"
out="${2:?usage: worker-secrets.sh <foreman.json> <out.json>}"
: "${SECRETS_JSON:?SECRETS_JSON is not set}"

if [ -z "${DATABASE_URL:-}" ]; then
  echo "::error title=Sem DATABASE_URL::A connection string do banco deste ambiente está vazia."
  exit 1
fi

# Values are read from the environment ($ENV), never passed as arguments.
missing="$(jq -r '
  ($ENV.SECRETS_JSON | fromjson) as $s
  | [.secrets[]? | select((.optional // false) | not) | .name | select(($s[.] // "") == "")]
  | join(", ")' "$manifest")"
if [ -n "$missing" ]; then
  echo "::error title=Faltam secrets do app::$missing não está(ão) nos secrets do repositório. Conecte o deploy no Elfo (Board → Settings → Deploy), que gera e grava esses secrets, ou grave com \`gh secret set\`."
  exit 1
fi

umask 077
jq '
  ($ENV.SECRETS_JSON | fromjson) as $s
  | reduce (.secrets[]?.name) as $name ({};
      if ($s[$name] // "") != "" then .[$name] = $s[$name] else . end)
  | .DATABASE_URL = $ENV.DATABASE_URL' "$manifest" >"$out"

echo "Secrets do Worker: $(jq -r 'keys | join(", ")' "$out")."
