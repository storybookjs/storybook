#!/usr/bin/env node
/**
 * Cross-platform script to compute a hash of all tracked files in the scripts directory.
 * This is used by Nx to determine when the scripts directory has changed for cache invalidation.
 * 
 * The script:
 * 1. Gets all tracked files in the scripts directory using git
 * 2. Sorts them for consistency
 * 3. Computes a hash of their content using git hash-object
 * 4. Outputs a final hash
 * 
 * This replaces the Unix-only shell command:
 * cd .. && git ls-files scripts | sort | git hash-object --stdin-paths | git hash-object --stdin
 */

import { execSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = resolve(__dirname, '..');

try {
  // Get all tracked files in the scripts directory
  const files = execSync('git ls-files scripts', {
    cwd: repoRoot,
    encoding: 'utf-8',
  })
    .trim()
    .split(/\r?\n/) // Handle both Unix (\n) and Windows (\r\n) line endings
    .filter(Boolean)
    .sort();

  if (files.length === 0) {
    // No files found, output empty hash
    process.stdout.write('0000000000000000000000000000000000000000\n');
    process.exit(0);
  }

  // Compute hash of file contents
  const fileHashes = execSync('git hash-object --stdin-paths', {
    cwd: repoRoot,
    input: files.join('\n'),
    encoding: 'utf-8',
  });

  // Compute final hash (note: fileHashes already includes trailing newline from git command)
  const finalHash = execSync('git hash-object --stdin', {
    cwd: repoRoot,
    input: fileHashes,
    encoding: 'utf-8',
  }).trim();

  process.stdout.write(finalHash + '\n');
  process.exit(0);
} catch (error) {
  // If git commands fail, output a fallback hash
  process.stderr.write(`Warning: Failed to compute scripts hash: ${error.message}\n`);
  process.stdout.write('0000000000000000000000000000000000000000\n');
  process.exit(0);
}
