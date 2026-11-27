#!/usr/bin/env bash
set -euo pipefail

dry=false
if [[ "${1:-}" == "--dry" ]]; then
  dry=true
  shift
fi
pins="${1:?Usage: fork-tier2.sh [--dry] <pins.jsonl>}"
catalog="$(dirname "$0")/../catalog.json"

# gh reads no input here, and the loop below feeds the rows on stdin.
write_gh() {
  if $dry; then
    echo "dry: gh $*" >&2
  else
    echo "gh $*" >&2
    gh "$@" </dev/null
  fi
}

read_or_missing() {
  echo "gh $*" >&2
  local out err status=0
  err=$(mktemp)
  out=$(gh "$@" </dev/null 2>"$err") || status=$?
  if [[ $status -eq 0 ]]; then
    echo "$out"
  elif ! grep -q "HTTP 404" "$err"; then
    cat "$err" >&2
    rm -f "$err"
    return 1
  fi
  rm -f "$err"
}

rows=$(node -e '
  const { readFileSync } = require("node:fs");
  const [catalogFile, pinsFile] = process.argv.slice(1);
  const pins = new Map(
    readFileSync(pinsFile, "utf8").trim().split("\n").map((line) => {
      const pin = JSON.parse(line);
      return [pin.repo, pin.commit];
    })
  );
  for (const entry of JSON.parse(readFileSync(catalogFile, "utf8"))) {
    if (entry.class !== "tier2" || !entry.pushTo) continue;
    const commit = pins.get(entry.repo);
    if (!commit) throw new Error(`No pin for ${entry.repo} in ${pinsFile}`);
    console.log([entry.repo, entry.pushTo, commit].join(" "));
  }
' "$catalog" "$pins")

while read -r repo fork commit; do
  echo "== $repo -> $fork at $commit" >&2
  parent=$(read_or_missing api "repos/$fork" --jq '.parent.full_name // "none"')
  if [[ -z "$parent" ]]; then
    write_gh repo fork "$repo" --org "${fork%%/*}" --fork-name "${fork#*/}" --default-branch-only --clone=false
    if $dry; then
      write_gh api -X POST "repos/$fork/git/refs" -f "ref=refs/heads/qa/base" -f "sha=$commit"
      continue
    fi
    # GitHub creates a fork in the background, so the repository answers only after a while.
    for _ in $(seq 1 30); do
      [[ -n "$(read_or_missing api "repos/$fork" --jq .full_name)" ]] && break
      sleep 5
    done
  elif [[ "$parent" != "$repo" ]]; then
    echo "$fork exists but is a fork of $parent, not of $repo. Stopping." >&2
    exit 1
  fi
  base=$(read_or_missing api "repos/$fork/git/ref/heads/qa/base" --jq .object.sha)
  if [[ -z "$base" ]]; then
    write_gh api -X POST "repos/$fork/git/refs" -f "ref=refs/heads/qa/base" -f "sha=$commit"
  elif [[ "$base" != "$commit" ]]; then
    echo "$fork has qa/base at $base, not at the pin $commit. Stopping, because qa/base is never moved." >&2
    exit 1
  fi
done <<<"$rows"
