#!/bin/bash
set -euo pipefail

TEMPLATE=${1:?Usage: $0 <template>}
SANDBOX_NAME=${TEMPLATE//\//-}

# Offload registry to make sure sandbox will be able to install dependencies
echo "Starting registry..."
nohup yarn local-registry --open > local-registry.log 2>&1 < /dev/null &

REGISTRY_PID=$!

# Utils to wait for the registry and clean it up on exit
cleanup() {
  echo "Cleaning up registry..."
  kill -TERM "$REGISTRY_PID" 2>/dev/null || true
  wait "$REGISTRY_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

wait_for_port() {
  local port=$1
  until nc -z localhost "$port"; do
    sleep 0.5
  done
  echo "Port $port ready."
}

wait_for_port 6001
wait_for_port 6002

echo "Registry ready."

echo "Executing before-test.js script"
node ./scripts/ecosystem-ci/before-test.js "$TEMPLATE"

cd "../storybook-sandboxes/$SANDBOX_NAME"
yarn install