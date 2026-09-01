import { execFileSync } from 'node:child_process';
import { homedir } from 'node:os';
import { join } from 'node:path';

/** Locate the uv binary: PATH first, then the official installer's default target. */
export function findUv(): string | null {
  for (const candidate of ['uv', join(homedir(), '.local', 'bin', 'uv')]) {
    try {
      execFileSync(candidate, ['--version'], { stdio: 'ignore' });
      return candidate;
    } catch {
      // Try the next candidate.
    }
  }
  return null;
}
