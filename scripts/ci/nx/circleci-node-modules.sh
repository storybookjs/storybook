#!/usr/bin/env bash
# The installed tree for the CircleCI NX jobs (scripts/ci/nx/circleci-dte.ts), as a few zstd
# archives in one directory that CircleCI caches. A few files restore much faster than CircleCI's
# own tar of ~200k files, and they hold every node_modules directory, including the nested ones the
# other CircleCI jobs leave out. One tar writes the files on one CPU, so there is one archive per
# CPU of a large machine, extracted at the same time: 6 s instead of 16 s on Linux.
#
#   circleci-node-modules.sh restore <directory>  extract the archives, or install when there are none
#   circleci-node-modules.sh pack <directory>     archive the tree a fresh install left
#
# On Linux and on Windows (Git Bash). Runs from the repository root. Changing this file changes the
# cache key.
set -euo pipefail
# Git Bash's own tools first: on CircleCI's Windows machines, Windows' find, sort and tar and
# Sysinternals' du come first on the PATH.
PATH="/usr/bin:$PATH"

mode=$1
archives=$2
# Every node_modules directory the install created, so a restore can tell a complete tree.
list=node_modules/.circleci-node-modules-dirs
# Set by a fresh install in this job: only that tree is packed, never one restored from the cache.
fresh="$archives.fresh"
PARTS=4

extract() {
  local pids=() part status=0
  for part in "$archives"/part-*.tar.zst; do
    [ -s "$part" ] || return 1
    (node scripts/ci/zstd-stream.mjs decompress < "$part" | tar --extract) &
    pids+=($!)
  done
  for pid in "${pids[@]}"; do wait "$pid" || status=1; done
  return "$status"
}

case "$mode" in
  restore)
    # A broken archive falls through to the install below instead of failing the job.
    if [ -s "$archives/part-0.tar.zst" ] && extract && [ -f "$list" ]; then
      missing=0
      while read -r dir; do
        [ -d "$dir" ] || { echo "The restored tree lacks $dir; installing instead."; missing=1; }
      done < "$list"
      # The archives leave the workspace links out (see pack).
      if [ "$missing" = 0 ] && node scripts/ci/nx/workspace-links.mjs make; then
        # Tool caches that tasks may have written into the tree before it was archived.
        while read -r dir; do rm -rf "$dir/.cache" "$dir/.vite"; done < "$list"
        echo "node_modules restored from the cache; skipping yarn install."
        exit 0
      fi
    fi
    if [ -d "$archives" ]; then
      # Whatever a broken or incomplete archive left behind, so the install starts clean.
      echo "The cached node_modules could not be used; installing instead."
      find . -path ./.git -prune -o -name node_modules -type d -prune -exec rm -rf {} +
      rm -f .yarn/root-install-state.gz
    fi
    # Three tries: up to 20 agents install at once.
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
    # The links into the workspaces stay out: on Windows they are junctions, which tar would copy
    # or follow. A restore makes them again.
    node scripts/ci/nx/workspace-links.mjs list | sed 's|^|./|' > "$archives.links"
    # Each top-level entry of a node_modules directory, largest first, goes to the lightest part.
    while read -r dir; do find "$dir" -mindepth 1 -maxdepth 1; done < "$list" \
      | grep -vxF -f "$archives.links" \
      | tr '\n' '\0' | xargs -0 du -s --apparent-size | sort -rn \
      | awk -v n="$PARTS" -v out="$archives.part" '{
          m = 0; for (i = 1; i < n; i++) if (w[i] < w[m]) m = i
          w[m] += $1; sub(/^[0-9]+\t/, ""); print > (out "-" m)
        }'
    echo .yarn/root-install-state.gz >> "$archives.part-0"
    # Into a temporary directory first: a half-written archive must never reach the cache, whose key
    # no later run could overwrite.
    rm -rf "$archives.tmp" && mkdir -p "$archives.tmp"
    pids=()
    for ((i = 0; i < PARTS; i++)); do
      touch "$archives.part-$i"
      (tar --create --anchored --exclude-from="$archives.links" -T "$archives.part-$i" \
        | node scripts/ci/zstd-stream.mjs compress 3 > "$archives.tmp/part-$i.tar.zst") &
      pids+=($!)
    done
    for pid in "${pids[@]}"; do wait "$pid"; done
    rm -rf "$archives" && mv "$archives.tmp" "$archives"
    ls -la "$archives"
    ;;
  *)
    echo "Usage: circleci-node-modules.sh restore|pack <directory>" >&2
    exit 2
    ;;
esac
