#!/usr/bin/env bash
# Installs pnpm and Yarn from the package-lock.json next to this script, which pins their integrity.
# Usage: install.sh <pnpm|yarn>[=<expected version>]...
set -euo pipefail
export npm_config_update_notifier=false
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
dir="$(mktemp -d "${RUNNER_TEMP:-${TMPDIR:-/tmp}}/storybook-package-managers.XXXXXX")"
trap 'rm -rf "$dir"' EXIT
cp "$here/package.json" "$here/package-lock.json" "$dir/"
npm ci --prefix "$dir" --ignore-scripts --no-audit --no-fund
global="$(npm root --global)"
for arg in "$@"; do
  tool="${arg%%=*}"
  want=""
  if [[ "$arg" == *=* ]]; then want="${arg#*=}"; fi
  case "$tool" in
    pnpm) package=pnpm ;;
    yarn) package=@yarnpkg/cli-dist ;;
    *) echo "Unknown package manager: $tool" >&2; exit 1 ;;
  esac
  # The cimg images install their own pnpm as root into a global directory the job user can write.
  sudo=""
  case "${OSTYPE:-}" in
    msys* | cygwin*) ;;
    *) if { { [ -e "$global" ] && [ ! -w "$global" ]; } || { [ -e "$global/$package" ] && [ ! -O "$global/$package" ]; }; } &&
      command -v sudo >/dev/null; then sudo=sudo; fi ;;
  esac
  # `--force` replaces an image's own pnpm and yarn, and `--install-links` copies the verified tree
  # rather than linking to the temporary directory.
  $sudo npm install --global --install-links --force --ignore-scripts --no-audit --no-fund \
    --no-update-notifier "$dir/node_modules/$package"
  expected="${want:-$(node -p 'require(process.argv[1]).version' "$dir/node_modules/$package/package.json")}"
  # $dir's package.json pins no package manager, so pnpm runs the binary on PATH without switching.
  actual="$(cd "$dir" && "$tool" --version)"
  if [ "$actual" != "$expected" ]; then
    echo "$tool on PATH ($(command -v "$tool")) is $actual, not $expected" >&2
    exit 1
  fi
done
