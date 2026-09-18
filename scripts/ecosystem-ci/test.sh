#!/bin/bash
set -e

TEMPLATE=${1:?Usage: $0 <template>}

# Run Vitest integration tests
yarn task --task vitest-integration --template "$TEMPLATE" --start-from=vitest-integration --no-link --skip-cache
