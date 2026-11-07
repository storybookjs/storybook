#!/usr/bin/env bash
# EXPERIMENT, not for merging. Measures, on a CircleCI Windows machine, how node_modules could be
# put in place without `yarn install`. Runs after CircleCI restored the v11-windows-node_modules
# cache (as the NX DTE Windows jobs do now). Prints one `BENCH` line per measurement.
set -uo pipefail
cd "$(dirname "$0")/../../.."

ARCHIVE=/c/nm-bench.tar.zst
LIST=/c/nm-bench-dirs.txt

bench() {
  local name=$1
  shift
  local start end
  start=$(date +%s.%N)
  "$@"
  local status=$?
  end=$(date +%s.%N)
  awk -v a="$start" -v b="$end" -v n="$name" -v s="$status" 'BEGIN { printf "BENCH %-55s %7.1fs (exit %s)\n", n, b - a, s }'
  return 0
}

# The workspace links Yarn makes (junctions on Windows), and whether Node and Nx find the workspaces.
links() {
  node -e "
    const fs = require('fs');
    let links = 0, dirs = 0, broken = 0;
    for (const root of ['node_modules', 'code/node_modules', 'scripts/node_modules']) {
      if (!fs.existsSync(root)) continue;
      for (const name of fs.readdirSync(root)) {
        const paths = name.startsWith('@') ? fs.readdirSync(root + '/' + name).map((m) => root + '/' + name + '/' + m) : [root + '/' + name];
        for (const p of paths) {
          const st = fs.lstatSync(p);
          if (st.isSymbolicLink()) { links++; try { fs.statSync(p); } catch { broken++; } }
          else if (st.isDirectory()) dirs++;
        }
      }
    }
    let real = '?';
    try { real = fs.realpathSync('node_modules/storybook'); } catch (e) { real = 'ERROR ' + e.message; }
    console.log('LINKS ' + process.argv[1] + ': links=' + links + ' broken=' + broken + ' dirs=' + dirs + ' node_modules/storybook -> ' + real);
  " "$1"
  yarn nx show projects --json > /c/projects.json 2> /c/projects.err \
    && echo "LINKS $1: nx sees $(node -e "console.log(require('/c/projects.json').length)") projects" \
    || { echo "LINKS $1: nx failed"; tail -5 /c/projects.err; }
}

remove_tree() {
  while read -r dir; do rm -rf "$dir"; done < "$LIST"
  rm -f .yarn/root-install-state.gz
}

extract_gitbash() { node scripts/ci/zstd-stream.mjs decompress < "$ARCHIVE" | tar --extract; }
extract_native_symlinks() { MSYS=winsymlinks:nativestrict extract_gitbash; }
extract_bsdtar() {
  node scripts/ci/zstd-stream.mjs decompress < "$ARCHIVE" > /c/nm-bench.tar
  /c/Windows/System32/tar.exe -xf 'C:\nm-bench.tar'
}

echo "Node $(node --version), $(nproc) CPUs, MSYS=${MSYS:-unset}"
links after-circleci-restore

bench 'yarn install --immutable, as the jobs do now' yarn install --immutable
links after-yarn-install

find . -path ./.git -prune -o -path ./node_modules -prune -o -name node_modules -type d -prune -print > "$LIST"
echo ./node_modules >> "$LIST"
echo "$(wc -l < "$LIST") node_modules directories"
bench 'prune other platforms (as Linux)' node .nx/workflows/prune-other-platforms.cjs "$LIST"
# shellcheck disable=SC2046
bench 'pack: git-bash tar | node zstd 3' bash -c "tar --create .yarn/root-install-state.gz $(tr '\n' ' ' < "$LIST") | node scripts/ci/zstd-stream.mjs compress 3 > $ARCHIVE"
ls -la "$ARCHIVE"

bench 'rm -rf the tree' remove_tree
bench 'restore: node zstd | git-bash tar' extract_gitbash
links after-gitbash-tar

bench 'rm -rf the tree' remove_tree
bench 'restore: node zstd | git-bash tar, MSYS native symlinks' extract_native_symlinks
links after-gitbash-tar-native-symlinks

bench 'rm -rf the tree' remove_tree
bench 'restore: node zstd to file, then Windows tar.exe' extract_bsdtar
links after-windows-tar

bench 'yarn install --immutable after the archive restore' yarn install --immutable
links after-final-yarn-install
