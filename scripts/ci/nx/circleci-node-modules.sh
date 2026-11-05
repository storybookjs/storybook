#!/usr/bin/env bash
# The installed tree for the CircleCI NX jobs (scripts/ci/nx/circleci-dte.ts), as one zstd archive
# that CircleCI caches. One file restores much faster than CircleCI's own tar of ~200k files, and it
# holds every node_modules directory, including the nested ones the other CircleCI jobs leave out.
#
#   circleci-node-modules.sh restore <archive>  extract the archive, or install when there is none
#   circleci-node-modules.sh pack <archive>     archive the tree a fresh install left
#
# Runs from the repository root. Changing this file changes the cache key.
set -euo pipefail

mode=$1
archive=$2
# Every node_modules directory the install created, so a restore can tell a complete tree.
list=node_modules/.circleci-node-modules-dirs
# Set by a fresh install in this job: only that tree is packed, never one restored from the cache.
fresh="$archive.fresh"

case "$mode" in
  restore)
    # A broken archive falls through to the install below instead of failing the job.
    if [ -s "$archive" ] && node scripts/ci/zstd-stream.mjs decompress < "$archive" | tar --extract \
      && [ -f "$list" ]; then
      missing=0
      while read -r dir; do
        [ -d "$dir" ] || { echo "The restored tree lacks $dir; installing instead."; missing=1; }
      done < "$list"
      if [ "$missing" = 0 ]; then
        # Tool caches that tasks may have written into the tree before it was archived.
        while read -r dir; do rm -rf "$dir/.cache" "$dir/.vite"; done < "$list"
        echo "node_modules restored from the cache; skipping yarn install."
        exit 0
      fi
    fi
    if [ -s "$archive" ]; then
      # Whatever a broken or incomplete archive left behind, so the install starts clean.
      echo "The cached node_modules could not be used; installing instead."
      find . -path ./.git -prune -o -name node_modules -type d -prune -exec rm -rf {} +
      rm -f .yarn/root-install-state.gz
    fi
    # Three tries, as the NX Cloud workers do (.nx/workflows/agents.yaml): 20 agents install at once.
    for try in 1 2 3; do
      if yarn install --immutable; then break; fi
      [ "$try" = 3 ] && exit 1
      sleep $((try * 15))
    done
    find . -path ./node_modules -prune -o -name node_modules -type d -prune -print > "$list"
    echo ./node_modules >> "$list"
    # Drops the binaries .yarnrc.yml installs for other platforms: about 2 GB on Linux x64.
    node .nx/workflows/prune-other-platforms.cjs "$list"
    touch "$fresh"
    ;;
  pack)
    [ -f "$fresh" ] || { echo "node_modules came from the cache; nothing to pack."; exit 0; }
    # Into a temporary file first: a half-written archive must never reach the cache, whose key no
    # later run could overwrite.
    # shellcheck disable=SC2046
    tar --create .yarn/root-install-state.gz $(cat "$list") \
      | node scripts/ci/zstd-stream.mjs compress 3 > "$archive.tmp"
    mv "$archive.tmp" "$archive"
    ls -la "$archive"
    ;;
  *)
    echo "Usage: circleci-node-modules.sh restore|pack <archive>" >&2
    exit 2
    ;;
esac
