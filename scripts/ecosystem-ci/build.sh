#!/bin/bash
set -e

TEMPLATE=${1:?Usage: $0 <template> [renderer]}
RENDERER=${2:-}

# Install all dependencies
pnpm task --task install

# If a renderer is specified, build it so it uses the resolution set by the ecosystem-ci
if [ -n "$RENDERER" ]; then
  pnpm --dir code build "$RENDERER"
fi

# Create the storybook-sandboxes directory with a package.json that specifies Yarn as the package manager.
# Sandboxes use yarn by default for user project simulation.
mkdir -p ../storybook-sandboxes
echo "{ \"packageManager\": \"yarn@4.10.3\" }" > ../storybook-sandboxes/package.json

pnpm task build --template "$TEMPLATE" --start-from=compile --no-link --skip-cache
