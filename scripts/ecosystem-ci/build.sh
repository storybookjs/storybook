#!/bin/bash
set -e

TEMPLATE=${1:?Usage: $0 <template> [renderer]}
RENDERER=${2:-}

# Install all dependencies
yarn task --task install

# If a renderer is specified, build it so it uses the resolution set by the ecosystem-ci
if [ -n "$RENDERER" ]; then
  yarn --cwd code build "$RENDERER"
fi

# Create the storybook-sandboxes directory with a package.json that specifies Yarn as the package manager.
# This is required because the ecosystem-ci repo uses pnpm, and yarn refuses to install in the sandbox dir
# if it sees a different packageManager field higher up in the directory tree.
mkdir -p ../storybook-sandboxes
echo "{ \"packageManager\": \"yarn@$(yarn -v)\" }" > ../storybook-sandboxes/package.json

yarn task build --template "$TEMPLATE" --start-from=compile --no-link --skip-cache
