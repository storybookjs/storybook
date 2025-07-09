#!/bin/bash

set -e
cd code

echo "Splitting tests across containers..."
circleci tests glob "**/*.{test,spec}.{ts,tsx,js,jsx}" | circleci tests split --split-by=timings --timings-type=filename > /tmp/test-files.txt

# Check if we have test files for this shard
if [ -s /tmp/test-files.txt ]; then
    echo "Running test files for this shard:"
    cat /tmp/test-files.txt

    # Convert file list to Vitest patterns
    TEST_PATTERNS=$(cat /tmp/test-files.txt | tr '\n' ' ')

    # Run tests with the files for this shard
    yarn test --reporter=blob --reporter=default $TEST_PATTERNS
else
    echo "No test files found for this shard"
    exit 0
fi
