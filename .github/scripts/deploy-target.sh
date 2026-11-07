#!/usr/bin/env bash
# Which environment this run deploys: the `production` branch deploys production, the
# `staging` branch (optional) deploys staging. Anything else (a dispatch on a feature branch,
# a tag) fails with a clear message instead of deploying it somewhere.
# Usage: deploy-target.sh <branch> [ref-type]   -> writes `environment=` to $GITHUB_OUTPUT
set -euo pipefail

branch="${1:?usage: deploy-target.sh <branch> [ref-type]}"
ref_type="${2:-branch}"
output="${GITHUB_OUTPUT:-/dev/stdout}"

if [ "$ref_type" = "branch" ]; then
  case "$branch" in
    production | staging)
      echo "Deploying '$branch'."
      echo "environment=$branch" >>"$output"
      exit 0
      ;;
  esac
fi

echo "::error title=Nada para publicar a partir de '$branch'::Só a branch 'production' (produção) e a branch 'staging' (opcional) publicam. Rode o workflow em uma delas, ou abra um PR para 'staging'/'production'."
exit 1
