#!/bin/bash
set -e

TEMPLATE=${1:?Usage: $0 <template> [renderer]}
RENDERER=${2:-}

# Install all dependencies
pnpm run task --task install

# If a renderer is specified, build it so it uses the resolution set by the ecosystem-ci
if [ -n "$RENDERER" ]; then
  pnpm --dir code run build "$RENDERER"
fi

pnpm run task build --template "$TEMPLATE" --start-from=compile --no-link --skip-cache
