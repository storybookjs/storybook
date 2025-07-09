#!/bin/bash

# Script to run tests with CircleCI test splitting
# This enables the rerun failed tests feature

set -e

# Change to the code directory where tests are located
cd code

# Ensure the vitest-reports directory exists
mkdir -p .vitest-reports

# Get the list of test files for this shard
echo "Splitting tests across containers..."
echo "Current directory: $(pwd)"
echo "Looking for test files with pattern: **/*.{test,spec}.{ts,tsx}"

# First, let's see what test files exist
echo "Available test files:"
find . -name "*.test.*" -o -name "*.spec.*" | head -10

# Test the circleci tests glob command directly
echo "Testing circleci tests glob command:"
circleci tests glob "**/*.{test,spec}.{ts,tsx}" > /tmp/glob-output.txt
echo "Glob output:"
cat /tmp/glob-output.txt

# Get the list of test files for this shard
circleci tests glob "**/*.{test,spec}.{ts,tsx}" | circleci tests split --split-by=timings --timings-type=filename > /tmp/test-files.txt

echo "Test files assigned to this shard:"
cat /tmp/test-files.txt

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
    echo "This might be normal for the first run or if there are no tests in this shard"
    # Create an empty report to ensure the workspace step doesn't fail
    echo "Creating empty test report for workspace persistence"
    echo '<?xml version="1.0" encoding="UTF-8"?><testsuites></testsuites>' > .vitest-reports/empty.xml
    exit 0
fi
