#!/usr/bin/env bash
# One sticky comment per PR for the preview: created once, then edited in place (found by a
# hidden marker and the github-actions author). With --update-only nothing is created.
# Usage: pr-comment.sh <pr-number> <body-file> [--update-only]
#   env GH_TOKEN (pull-requests: write), GITHUB_REPOSITORY
# A comment that can't be written is a warning: it never fails the preview.
set -euo pipefail

pr="${1:?usage: pr-comment.sh <pr-number> <body-file> [--update-only]}"
file="${2:?usage: pr-comment.sh <pr-number> <body-file> [--update-only]}"
mode="${3:-}"
repo="${GITHUB_REPOSITORY:?GITHUB_REPOSITORY is not set}"
marker="<!-- foreman-web-mobile-preview -->"

body="$marker"$'\n'"$(cat "$file")"

if ! id="$(gh api --paginate "repos/$repo/issues/$pr/comments?per_page=100" \
  --jq ".[] | select(.user.login == \"github-actions[bot]\" and (.body // \"\" | contains(\"$marker\"))) | .id")"; then
  echo "::warning title=Comentário do preview::Não deu para ler os comentários do PR #$pr."
  exit 0
fi
id="$(head -n1 <<<"$id")"

if [ -n "$id" ]; then
  gh api -X PATCH "repos/$repo/issues/comments/$id" -f body="$body" >/dev/null ||
    echo "::warning title=Comentário do preview::Não deu para atualizar o comentário do PR #$pr."
elif [ "$mode" != "--update-only" ]; then
  gh api -X POST "repos/$repo/issues/$pr/comments" -f body="$body" >/dev/null ||
    echo "::warning title=Comentário do preview::Não deu para comentar no PR #$pr."
fi
