#!/bin/bash
set -e

TEMPLATE=${1:?Usage: $0 <template>}
SANDBOX_NAME=${TEMPLATE//\//-}

# Run the before-test script to copy resolutions and set up Playwright
node ./scripts/ecosystem-ci/before-test.js "$TEMPLATE"

# Install dependencies in the sandbox
cd "../storybook-sandboxes/$SANDBOX_NAME"
yarn install
