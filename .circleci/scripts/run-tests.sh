#!/bin/bash

# Script to run tests with CircleCI test splitting
# This enables the rerun failed tests feature

set -e

# Change to the code directory where tests are located
cd code

# Get the list of test files for this shard
echo "Splitting tests across containers..."
circleci tests glob "**/*.{test,spec}.?(c|m)[jt]s?(x)" | circleci tests split --split-by=timings --timings-type=filename > /tmp/test-files.txt

# Check if we have test files for this shard
if [ -s /tmp/test-files.txt ]; then
    echo "Running tests for this shard..."
    echo "Test files:"
    cat /tmp/test-files.txt

    # Convert file list to Vitest patterns
    TEST_PATTERNS=$(cat /tmp/test-files.txt | tr '\n' ' ')

    # Run tests with the files for this shard
    yarn test --reporter=blob --reporter=default $TEST_PATTERNS
else
    echo "No test files found for this shard"
    exit 0
fi
