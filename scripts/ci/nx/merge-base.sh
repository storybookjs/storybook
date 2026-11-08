#!/usr/bin/env bash
# The commit a pull request branched from, for `nx affected` in CircleCI's NX DTE setup job
# (.circleci/config.yml), whose checkout holds one commit. It is what the `nx/set-shas` orb command
# finds on a pull request (`git merge-base origin/<base> HEAD`) in the history that job used to
# check out: the latest 100 commits of the default branch, of the pull request's branch and of the
# base branch, without trees or blobs, fetched in the same order. That history goes into a bare
# repository of its own, since git cannot add it to a checkout that holds trees and blobs, and only
# the merge base itself into the checkout, whose files `nx affected` diffs.
#
#   merge-base.sh <branch> <base-branch> <out>
#
# Writes the merge base to <out>, nothing when there is none in those commits (every task then
# runs, as with nx/set-shas), and creates <out>.failed when git fails. Runs from the checkout.
set -euo pipefail

branch=$1
base_branch=$2
out=$3
history=$out.history

trap '[ -e "$out" ] || touch "$out.failed"' EXIT

rm -rf "$history"
git clone --quiet --bare --depth 100 --filter=tree:0 --no-tags "$(git remote get-url origin)" "$history"
git -C "$history" fetch --quiet --depth 100 --filter=tree:0 --no-tags --force origin \
  "+refs/heads/$branch:refs/remotes/origin/$branch"
git -C "$history" fetch --quiet --depth=100 --filter=tree:0 --no-tags origin \
  "$base_branch:refs/remotes/origin/$base_branch"

head=$(git rev-parse HEAD)
if merge_base=$(git -C "$history" merge-base "refs/remotes/origin/$base_branch" "$head"); then
  git fetch --quiet --depth=1 --no-tags origin "$merge_base"
else
  echo "No merge base found between origin/$base_branch and HEAD within 100 commits." >&2
  merge_base=
fi
echo "$merge_base" > "$out.tmp"
mv "$out.tmp" "$out"
echo "Merge base: ${merge_base:-none}"
