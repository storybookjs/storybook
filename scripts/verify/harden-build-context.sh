#!/usr/bin/env bash
# scripts/verify/harden-build-context.sh
# v5-0 — overlay maintainer-controlled supply-chain files from base.sha onto
# the head checkout AT $1. Run on the bare GHA runner BEFORE docker build.
# Argument: HEAD_DIR (relative path to head checkout, e.g. "pr-head")

set -euo pipefail

HEAD_DIR="${1:?usage: harden-build-context.sh <head-checkout-dir>}"
[ -d "$HEAD_DIR" ] || { echo "::error::head dir $HEAD_DIR not found"; exit 1; }
[ -L "$HEAD_DIR" ] && { echo "::error::head dir $HEAD_DIR is a symlink"; exit 1; }

# ─── helpers ─────────────────────────────────────────────────────────────────

# Defuse a target path: if a symlink, unlink it; if a directory, rm -rf;
# if a file, unlink. NEVER follow into a symlinked location.
defuse_target() {
  local target="$1"
  if [ -L "$target" ]; then
    rm -f "$target"
  elif [ -d "$target" ]; then
    rm -rf "$target"
  elif [ -e "$target" ]; then
    rm -f "$target"
  fi
}

# Install a single file with deterministic 0644 perms. Defuses the target first
# so symlinked targets cannot escape the head dir.
safe_install_file() {
  local src="$1" dst="$2"
  [ -f "$src" ] || { echo "::error::missing source file $src"; exit 1; }
  defuse_target "$dst"
  install -m 0644 "$src" "$dst"
}

# Install a directory tree by replacing the target. -P (--no-dereference) on
# Linux GNU cp keeps source-side symlinks as symlinks (not what we want, but
# we have validated source separately). We use rsync if available for atomicity.
safe_install_dir() {
  local src="$1" dst="$2"
  [ -d "$src" ] || { echo "::error::missing source dir $src"; exit 1; }
  defuse_target "$dst"
  mkdir -p "$(dirname "$dst")"
  cp -RL "$src" "$dst"   # -L = dereference into a plain dir copy.
}

# Verify sha256 byte-identity between two files.
sha256_check() {
  local a b ha hb
  a="$1"; b="$2"
  ha="$(sha256sum "$a" | awk '{print $1}')"
  hb="$(sha256sum "$b" | awk '{print $1}')"
  [ "$ha" = "$hb" ] || { echo "::error::sha256 mismatch: $a vs $b"; exit 1; }
}

# ─── 1. .yarn symlink guard ──────────────────────────────────────────────────
# Head could ship `.yarn` as a symlink to `/etc` (or wherever). Detect+remove
# BEFORE any cp/mkdir/rm-rf reaches inside.
if [ -L "$HEAD_DIR/.yarn" ]; then
  echo "[harden] removing $HEAD_DIR/.yarn symlink"
  rm -f "$HEAD_DIR/.yarn"
fi
if [ -L "$HEAD_DIR/.yarn/plugins" ]; then
  echo "[harden] removing $HEAD_DIR/.yarn/plugins symlink"
  rm -f "$HEAD_DIR/.yarn/plugins"
fi
if [ -L "$HEAD_DIR/.yarn/releases" ]; then
  echo "[harden] removing $HEAD_DIR/.yarn/releases symlink"
  rm -f "$HEAD_DIR/.yarn/releases"
fi
mkdir -p "$HEAD_DIR/.yarn"

# ─── 2. Overlay supply-chain files from base.sha ────────────────────────────
safe_install_file .dockerignore "$HEAD_DIR/.dockerignore"
sha256_check     .dockerignore "$HEAD_DIR/.dockerignore"

safe_install_file .yarnrc.yml   "$HEAD_DIR/.yarnrc.yml"
sha256_check     .yarnrc.yml   "$HEAD_DIR/.yarnrc.yml"

defuse_target "$HEAD_DIR/.yarn/releases"
defuse_target "$HEAD_DIR/.yarn/plugins"   # auto-loaded by yarn; not whitelisted.
if [ -d .yarn/releases ]; then
  safe_install_dir .yarn/releases "$HEAD_DIR/.yarn/releases"
fi

# Also delete head-supplied .npmrc anywhere (HIGH #2 — corepack registry override).
# Fail loud: an unremovable .npmrc in head means the registry-tamper surface is open.
find "$HEAD_DIR" -name '.npmrc' -type f -print -delete

# ─── 3. Force-disable yarn supply-chain knobs ───────────────────────────────
{
  echo ''
  echo '# v5-0 hardening — appended by harden-build-context.sh'
  echo 'enableScripts: false'
  echo 'enableTelemetry: false'
  echo 'enableImmutableInstalls: true'
  echo 'enableGlobalCache: false'
} >> "$HEAD_DIR/.yarnrc.yml"

# ─── 4+5. Single hardened walker pass — strip lifecycle scripts AND normalise
# the root packageManager field in one pass through every workspace package.json.
# BLOCKER (iter-4 F-3.1) — folding packageManager normalisation into the
# already-hardened walker eliminates the asymmetric attack surface where the
# previous heredoc read pr-head/package.json without lstat / size cap / try-catch.
#
# Source the base-sha packageManager value from base.sha's TRUSTED package.json
# (no hardening needed on this read — it's the maintainer-reviewed checkout).
# Pass the value (or the literal "EMPTY") to the walker via CLI arg.
BASE_PM="$(node -e 'const p=require("./package.json"); process.stdout.write(p.packageManager || "EMPTY")')"
node ./scripts/verify/strip-lifecycle-scripts.mjs "$HEAD_DIR" --packageManager "$BASE_PM"

# ─── 6. Refuse to build if Dockerfile diverges (LOW — missing-in-head OK) ──
if [ -f "$HEAD_DIR/scripts/verify/Dockerfile" ]; then
  if ! diff -q scripts/verify/Dockerfile "$HEAD_DIR/scripts/verify/Dockerfile" > /dev/null; then
    echo "::error::Dockerfile diverges between base.sha and head.sha — refuse to build."
    exit 1
  fi
fi
# If head doesn't ship the Dockerfile (older base), succeed silently — the
# workflow's `file:` arg points at the base-sha copy anyway.

echo "[harden] build context hardened successfully at $HEAD_DIR"
