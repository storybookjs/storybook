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

# Create the storybook-sandboxes directory with a package.json that specifies Yarn as the package manager.
# This is required because the ecosystem-ci repo uses pnpm, and yarn refuses to install in the sandbox dir
# if it sees a different packageManager field higher up in the directory tree.
# Use the Yarn version the published sandboxes pin in their own packageManager field. It cannot come
# from `yarn -v`, because corepack refuses to run Yarn inside this pnpm repository.
SANDBOX_YARN_VERSION=4.18.0
mkdir -p ../storybook-sandboxes
echo "{ \"packageManager\": \"yarn@$SANDBOX_YARN_VERSION\" }" > ../storybook-sandboxes/package.json

pnpm run task build --template "$TEMPLATE" --start-from=compile --no-link --skip-cache
