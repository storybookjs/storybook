#!/usr/bin/env bash
# The installed tree for the CircleCI NX jobs (scripts/ci/nx/circleci-dte.ts), as a few zstd
# archives in one directory that CircleCI caches. A few files restore much faster than CircleCI's
# own tar of ~200k files, and they hold every node_modules directory, including the nested ones the
# other CircleCI jobs leave out. One tar writes the files on one CPU, so there is one archive per
# CPU of a large machine, extracted at the same time: an agent restores the tree in about 8 s on
# Linux (4 CPUs) instead of 18 s, and in about 80 s on Windows (8 CPUs) instead of the 200 s that
# CircleCI's Windows cache and `yarn install` took.
#
#   circleci-node-modules.sh restore <directory>  extract the archives, or install when there are none
#   circleci-node-modules.sh pack <directory>     archive the tree a fresh install left
#
# On Linux and on Windows (Git Bash). Runs from the repository root. Changing this file changes the
# cache key, and every NX task's hash.
set -euo pipefail
# Git Bash on Windows.
case "$(uname -s)" in MINGW* | MSYS* | CYGWIN*) windows=true ;; *) windows=false ;; esac
if [ "$windows" = true ]; then
  # Git Bash's own tools first: on CircleCI's Windows machines, Windows' find, sort and tar and
  # Sysinternals' du come first on the PATH.
  PATH="/usr/bin:$PATH"
  PARTS=8
else
  PARTS=4
fi

mode=$1
archives=$2
# Every node_modules directory the install created, so a restore can tell a complete tree.
list=node_modules/.circleci-node-modules-dirs
# Set by a fresh install in this job: only that tree is packed, never one restored from the cache.
fresh="$archives.fresh"
# The last entry of each archive, so a restore can tell an archive that ended early.
marker=node_modules/.circleci-node-modules-part

extract() {
  local count i pids=() status=0
  count=$(cat "$archives/parts" 2>/dev/null) || return 1
  # Every archive is there before any is extracted, so a fallback install never races an extraction.
  for ((i = 0; i < count; i++)); do [ -s "$archives/part-$i.tar.zst" ] || return 1; done
  for ((i = 0; i < count; i++)); do
    (node scripts/ci/zstd-stream.mjs decompress < "$archives/part-$i.tar.zst" | tar --extract) &
    pids+=($!)
  done
  for pid in "${pids[@]}"; do wait "$pid" || status=1; done
  for ((i = 0; i < count; i++)); do
    [ -f "$marker-$i" ] || { echo "Archive $i ended early."; status=1; }
    rm -f "$marker-$i"
  done
  return "$status"
}

case "$mode" in
  restore)
    # A broken archive falls through to the install below instead of failing the job.
    if extract && [ -f "$list" ]; then
      missing=0
      while read -r dir; do
        [ -d "$dir" ] || { echo "The restored tree lacks $dir; installing instead."; missing=1; }
      done < "$list"
      # The archives leave the links into the repository out (see pack).
      if [ "$missing" = 0 ] && node --experimental-transform-types scripts/ci/nx/workspace-links.ts make; then
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
    # Drops the binaries .yarnrc.yml installs for other platforms: about 2 GB on Linux x64 and on
    # Windows. windows-graph.ts hashes the Windows tasks for a tree pruned this way.
    node .nx/workflows/prune-other-platforms.cjs "$list"
    touch "$fresh"
    ;;
  pack)
    [ -f "$fresh" ] || { echo "node_modules came from the cache; nothing to pack."; exit 0; }
    # Left out: the links into the repository, which on Windows are junctions that tar copies as
    # directories (a restore makes them again), and the tool caches that tasks write into
    # node_modules/.cache and .vite, and that `start-ci-run` uses while a restore runs.
    node --experimental-transform-types scripts/ci/nx/workspace-links.ts record > "$archives.excluded"
    while read -r dir; do echo "$dir/.cache"; echo "$dir/.vite"; done < "$list" >> "$archives.excluded"
    # Each top-level entry of a node_modules directory, largest first, goes to the lightest part.
    while read -r dir; do find "$dir" -mindepth 1 -maxdepth 1; done < "$list" \
      | grep -vxF -f "$archives.excluded" \
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
      touch "$archives.part-$i" "$marker-$i"
      echo "$marker-$i" >> "$archives.part-$i"
      (tar --create --anchored --exclude-from="$archives.excluded" -T "$archives.part-$i" \
        | node scripts/ci/zstd-stream.mjs compress 3 > "$archives.tmp/part-$i.tar.zst") &
      pids+=($!)
    done
    for pid in "${pids[@]}"; do wait "$pid"; done
    rm -f "$marker"-*
    echo "$PARTS" > "$archives.tmp/parts"
    rm -rf "$archives" && mv "$archives.tmp" "$archives"
    ls -la "$archives"
    ;;
  *)
    echo "Usage: circleci-node-modules.sh restore|pack <directory>" >&2
    exit 2
    ;;
esac
