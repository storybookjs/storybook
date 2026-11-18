import { execFileSync } from 'node:child_process';
import type { ExecFileSyncOptions } from 'node:child_process';

const MAX_BUFFER = 50 * 1024 * 1024;

/**
 * Runs the GitHub CLI and returns its stdout as a Buffer (pass
 * `encoding: 'utf8'` for a string). Throws a contributor-friendly error when
 * `gh` is not installed, and a message naming the failed invocation otherwise.
 */
export function gh(args: string[], options: ExecFileSyncOptions = {}): Buffer | string {
  try {
    return execFileSync('gh', args, { maxBuffer: MAX_BUFFER, ...options });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new Error('The GitHub CLI (gh) is required. Install it and run: gh auth login');
    }
    throw error;
  }
}

/** Runs the GitHub CLI and parses its stdout as JSON. */
export function ghJson<T>(args: string[], options: ExecFileSyncOptions = {}): T {
  const stdout = gh(args, { ...options, encoding: 'utf8' }) as string;
  return JSON.parse(stdout.trim()) as T;
}
