#!/usr/bin/env bash
# EXPERIMENT, not for merging. Ways to put the NX DTE node_modules on a CircleCI Windows machine
# without `yarn install`. Runs after an install. Prints one BENCH line per measurement.
set -uo pipefail
PATH="/usr/bin:$PATH"
cd "$(dirname "$0")/../../.."
find=/usr/bin/find
echo "STATE sample:"; grep -m1 -A4 "workspace:code/core\"" node_modules/.yarn-state.yml | od -c | head -12
LIST=node_modules/.circleci-node-modules-dirs
WINTAR=/c/Windows/System32/tar.exe

bench() {
  local name=$1; shift
  local start end status
  start=$(date +%s.%N); "$@"; status=$?; end=$(date +%s.%N)
  awk -v a="$start" -v b="$end" -v n="$name" -v s="$status" 'BEGIN { printf "BENCH %-55s %7.1fs (exit %s)\n", n, b - a, s }'
}
check() {
  node scripts/ci/nx/workspace-links.mjs make
  node -e "
    const fs = require('fs');
    const dirs = fs.readFileSync('$LIST', 'utf8').split('\n').filter(Boolean);
    const missing = dirs.filter((d) => !fs.existsSync(d));
    let files = 0;
    const walk = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { if (e.isSymbolicLink()) continue; if (e.isDirectory()) walk(d + '/' + e.name); else files++; } };
    for (const d of dirs) if (fs.existsSync(d)) walk(d);
    console.log('CHECK $1: ' + dirs.length + ' dirs, missing ' + missing.length + ', ' + files + ' files, node_modules/storybook -> ' + fs.realpathSync('node_modules/storybook'));
  "
  yarn nx show projects --json > nx-projects.json 2> nx-projects.err \
    && echo "CHECK $1: nx sees $(node -p "require('./nx-projects.json').length") projects" \
    || { echo "CHECK $1: nx failed"; tail -3 nx-projects.err; }
  rm -f nx-projects.json nx-projects.err
}
remove_tree() { while read -r dir; do rm -rf "$dir"; done < /c/bench-dirs; rm -f .yarn/root-install-state.gz; }
extract_with() {
  local tool=$1 dir=$2 pids=() status=0
  for part in "$dir"/part-*.tar.zst; do
    if [ "$tool" = msys ]; then
      (node scripts/ci/zstd-stream.mjs decompress < "$part" | /usr/bin/tar --extract) &
    else
      (node scripts/ci/zstd-stream.mjs decompress < "$part" | "$WINTAR" -xf -) &
    fi
    pids+=($!)
  done
  for pid in "${pids[@]}"; do wait "$pid" || status=1; done
  return $status
}

echo "Node $(node --version), $(nproc) CPUs; tar: $(command -v tar), find: $(command -v find), sort: $(command -v sort)"
"$find" . -path ./node_modules -prune -o -name node_modules -type d -prune -print > "$LIST"
echo ./node_modules >> "$LIST"
cp "$LIST" /c/bench-dirs
echo "$(wc -l < "$LIST") node_modules directories:"; cat "$LIST"
bench 'prune other platforms' node .nx/workflows/prune-other-platforms.cjs "$LIST"
check after-install
for parts in 4 8; do
  touch /c/a$parts.fresh
  NODE_MODULES_PARTS=$parts bench "pack $parts parts (circleci-node-modules.sh)" bash scripts/ci/nx/circleci-node-modules.sh pack /c/a$parts
  du -sh /c/a$parts
done
for variant in "msys 4" "wintar 4" "msys 8" "wintar 8"; do
  set -- $variant
  bench "rm -rf the tree" remove_tree
  bench "extract $2 parts at once with $1 tar" extract_with "$1" "/c/a$2"
  check "$1-$2"
done
