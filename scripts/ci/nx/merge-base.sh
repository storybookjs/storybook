#!/usr/bin/env bash
# The commit a pull request branched from, for `nx affected` in CircleCI's NX DTE setup job
# (.circleci/config.yml), whose checkout is shallow. It is what the `nx/set-shas` orb command finds
# on a pull request (`git merge-base origin/<base> HEAD`) in 100 commits of history: those of the
# default branch, of the checked-out commit and of the base branch, without trees or blobs. That
# history goes into a bare repository of its own, since git cannot add it to a checkout that holds
# trees and blobs, and only the merge base itself into the checkout, whose files `nx affected` diffs.
# The history starts at the checked-out commit, not at the branch, which a force-push may have moved.
#
#   merge-base.sh <base-branch> <out>
#
# Writes the merge base to <out>, nothing when there is none in those commits (every task then
# runs, as with nx/set-shas), and creates <out>.failed when git fails. Runs from the checkout.
set -euo pipefail

base_branch=$1
out=$2
history=$out.history

trap '[ -e "$out" ] || touch "$out.failed"' EXIT

rm -rf "$history"
git clone --quiet --bare --depth 100 --filter=tree:0 --no-tags "$(git remote get-url origin)" "$history"
head=$(git rev-parse HEAD)
git -C "$history" fetch --quiet --depth 100 --filter=tree:0 --no-tags origin "$head"
git -C "$history" fetch --quiet --depth=100 --filter=tree:0 --no-tags origin \
  "$base_branch:refs/remotes/origin/$base_branch"

# Exit 1 means no common commit; anything else is a git error, which fails the job.
status=0
merge_base=$(git -C "$history" merge-base "refs/remotes/origin/$base_branch" "$head") || status=$?
if [ "$status" = 0 ]; then
  git fetch --quiet --depth=1 --no-tags origin "$merge_base"
elif [ "$status" = 1 ]; then
  echo "No merge base found between origin/$base_branch and HEAD within 100 commits." >&2
  merge_base=
else
  exit "$status"
fi
echo "$merge_base" > "$out.tmp"
mv "$out.tmp" "$out"
echo "Merge base: ${merge_base:-none}"
