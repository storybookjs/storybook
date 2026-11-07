#!/usr/bin/env bash
# EXPERIMENT, not for merging. Measures, on a CircleCI Docker large machine, how long the NX DTE
# node_modules archive takes to extract with zlib's default 16 KiB chunks (as on next) and with the
# 1 MiB chunks of this branch's zstd-stream.mjs. Runs after CircleCI restored the archive.
set -uo pipefail
cd "$(dirname "$0")/../../.."
ARCHIVE=/tmp/nx-dte-node_modules.tar.zst

bench() {
  local name=$1
  shift
  local start end
  start=$(date +%s.%N)
  "$@"
  local status=$?
  end=$(date +%s.%N)
  awk -v a="$start" -v b="$end" -v n="$name" -v s="$status" 'BEGIN { printf "BENCH %-50s %7.1fs (exit %s)\n", n, b - a, s }'
}

ls -la "$ARCHIVE"
echo "Node $(node --version), $(nproc) CPUs"
# This branch's script without its chunk size: zlib's default, as on next.
sed -e 's/createZstdDecompress({ chunkSize })/createZstdDecompress()/' -e '/^ *chunkSize,$/d' \
  scripts/ci/zstd-stream.mjs > /tmp/zstd-stream-16k.mjs
grep -c chunkSize /tmp/zstd-stream-16k.mjs

for round in 1; do
  bench "decompress only, 16 KiB chunks (round $round)" bash -c "node /tmp/zstd-stream-16k.mjs decompress < $ARCHIVE > /dev/null"
  bench "decompress only, 1 MiB chunks (round $round)" bash -c "node scripts/ci/zstd-stream.mjs decompress < $ARCHIVE > /dev/null"
  rm -rf /tmp/x && mkdir /tmp/x
  bench "extract, 16 KiB chunks (round $round)" bash -c "cd /tmp/x && node /tmp/zstd-stream-16k.mjs decompress < $ARCHIVE | tar --extract"
  rm -rf /tmp/x && mkdir /tmp/x
  bench "extract, 1 MiB chunks (round $round)" bash -c "cd /tmp/x && node $PWD/scripts/ci/zstd-stream.mjs decompress < $ARCHIVE | tar --extract"
done
rm -rf /tmp/x && mkdir /tmp/x
node scripts/ci/zstd-stream.mjs decompress < "$ARCHIVE" > /tmp/nm.tar
bench 'compress, 16 KiB chunks' bash -c 'node /tmp/zstd-stream-16k.mjs compress 3 < /tmp/nm.tar > /tmp/a.zst'
bench 'compress, 1 MiB chunks' bash -c 'node scripts/ci/zstd-stream.mjs compress 3 < /tmp/nm.tar > /tmp/b.zst'
cmp /tmp/a.zst /tmp/b.zst && echo 'Both chunk sizes write the same archive.'

# What nx-main does before Nx hands out the first task, on this machine.
cd "$(dirname "$0")/../../.."
bash scripts/ci/nx/circleci-node-modules.sh restore "$ARCHIVE" > /dev/null
export NX_DAEMON=false NX_NO_CLOUD=true NX_TUI=false
bench 'npx nx-cloud@19.1.5 --help (start-ci-run download)' bash -c 'npx --yes nx-cloud@19.1.5 --help > /dev/null 2>&1'
bench 'yarn nx --version' bash -c 'yarn nx --version > /dev/null'
bench 'nx graph --file (cold)' bash -c 'yarn nx graph --file=/tmp/g.json > /dev/null'
bench 'nx graph --file (warm)' bash -c 'yarn nx graph --file=/tmp/g.json > /dev/null'
bench 'run.ts --dry-run normal (its work before the nx command)' bash -c 'yarn exec jiti ./scripts/ci/nx/run.ts --workflow=normal --env=linux --dry-run > /dev/null'
bench 'run.ts --graph normal (dry-run + the nx command computing its task graph)' bash -c 'yarn exec jiti ./scripts/ci/nx/run.ts --workflow=normal --env=linux --graph=/tmp/sel.json > /dev/null'

# One archive per CPU, extracted at the same time: tar writes the 222k files on one core otherwise.
LIST=node_modules/.circleci-node-modules-dirs
while read -r dir; do find "$dir" -mindepth 1 -maxdepth 1; done < "$LIST" > /tmp/entries
xargs -d '\n' du -s --apparent-size < /tmp/entries | sort -rn > /tmp/sizes
echo "$(wc -l < /tmp/entries) entries to split"
for parts in 4 8; do
  rm -f /tmp/bin*
  # Greedy: each entry, largest first, goes to the lightest part.
  awk -v n=$parts '{ m = 0; for (i = 1; i < n; i++) if (w[i] < w[m]) m = i; w[m] += $1; sub(/^[0-9]+\t/, ""); print > ("/tmp/bin" m) }' /tmp/sizes
  echo .yarn/root-install-state.gz >> /tmp/bin0
  pack_parts() {
    for ((i = 0; i < parts; i++)); do
      (tar --create -T /tmp/bin$i | node scripts/ci/zstd-stream.mjs compress 3 > /tmp/part$i.tar.zst) &
    done
    wait
  }
  extract_parts() {
    for ((i = 0; i < parts; i++)); do
      (node "$PWD/scripts/ci/zstd-stream.mjs" decompress < /tmp/part$i.tar.zst | tar --extract -C /tmp/x) &
    done
    wait
  }
  bench "pack in $parts parts at once" pack_parts
  du -ch /tmp/part*.tar.zst | tail -1
  for round in 1 2; do
    rm -rf /tmp/x && mkdir /tmp/x
    bench "extract $parts parts at once (round $round)" extract_parts
  done
  echo "files: $(find /tmp/x | wc -l) (one archive: $(find . -path ./.git -prune -o -print | wc -l) in the checkout)"
  rm -f /tmp/part*.tar.zst
done
