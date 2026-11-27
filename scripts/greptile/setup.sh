
#!/usr/bin/env bash
set -euo pipefail

NODE_VERSION="$(cat .nvmrc)"
SUDO=""
if [ "$(id -u)" -ne 0 ]; then SUDO="sudo"; fi

echo "== OS =="; cat /etc/os-release || true
echo "== CPU/RAM =="; nproc || true; free -g || true

if ! command -v node >/dev/null || [ "$(node -v)" != "v${NODE_VERSION}" ]; then
  case "$(uname -m)" in
    x86_64) ARCH=x64 ;;
    aarch64|arm64) ARCH=arm64 ;;
    *) echo "unsupported arch $(uname -m)"; exit 1 ;;
  esac
  curl -fsSL "https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-linux-${ARCH}.tar.xz" -o /tmp/node.tar.xz
  $SUDO rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack
  $SUDO tar -xJf /tmp/node.tar.xz -C /usr/local --strip-components=1
  rm /tmp/node.tar.xz
fi
node -v
npm -v
npm info storybook version

YARN_BIN="$(pwd)/$(awk '/^yarnPath:/ {print $2}' .yarnrc.yml)"
printf '#!/bin/sh\nexec node "%s" "$@"\n' "$YARN_BIN" | $SUDO tee /usr/local/bin/yarn >/dev/null
$SUDO chmod +x /usr/local/bin/yarn
yarn --version

export HUSKY=0
export NX_NO_CLOUD=true
export STORYBOOK_DISABLE_TELEMETRY=1
export NODE_OPTIONS="--max_old_space_size=8192"

yarn install --immutable

yarn nx run-many -t compile -c production --no-cloud --outputStyle=stream

cd code
$SUDO mkdir -p "$HOME/.cache/ms-playwright"
PW_DIR="$(readlink -f "$HOME/.cache/ms-playwright")"
$SUDO chown -R "$(id -u):$(id -g)" "$HOME/.cache" "$PW_DIR"
ls -la "$PW_DIR"
yarn exec playwright install chromium
$SUDO env "PATH=$PATH" yarn exec playwright install-deps chromium
$SUDO chown -R "$(id -u):$(id -g)" "$HOME/.cache" "$PW_DIR"
cd ..

test -f code/core/dist/bin/dispatcher.js

echo "Setup complete"