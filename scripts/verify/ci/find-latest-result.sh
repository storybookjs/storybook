#!/usr/bin/env bash
# CI helper: prints the path to the most recent `verify-result.json` under
# the provided run-output root. Exits non-zero (with no stdout) when no
# matching file exists, so callers can test with:
#
#   RESULT=$(./scripts/verify/ci/find-latest-result.sh "$PR_HEAD_DIR") || exit 0
#
# Replaces the repeated `compgen -G ... && ls -t ... | head -1` pair
# scattered through `.github/workflows/verify-pr.yml`.
set -euo pipefail
ROOT="${1:-$PR_HEAD_DIR}"
PATTERN="$ROOT/.verify-output/*/verify-result.json"
# shellcheck disable=SC2086
if ! compgen -G "$PATTERN" >/dev/null; then
  exit 1
fi
# shellcheck disable=SC2012
ls -t $PATTERN | head -n1
