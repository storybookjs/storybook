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

for round in 1 2; do
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
