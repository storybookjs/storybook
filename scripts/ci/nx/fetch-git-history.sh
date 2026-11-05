#!/usr/bin/env bash
# Chromatic finds its baselines (and TurboSnap the changed files) in the git history, but NX Cloud
# workers clone a single commit. Fetch the commits without their trees and blobs: about 40 MB and a
# few seconds, and git fetches the trees a diff needs on demand.
set -euo pipefail

if [ "$(git rev-parse --is-shallow-repository)" = "true" ]; then
  git fetch --unshallow --filter=tree:0 --no-tags --quiet origin "$(git rev-parse HEAD)"
fi
