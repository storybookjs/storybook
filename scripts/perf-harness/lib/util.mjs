import { spawn, spawnSync } from 'node:child_process';
import { homedir } from 'node:os';
import { join } from 'node:path';

export const HARNESS_DIR = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
export const DEFAULT_WORK_DIR =
  process.env.PERF_HARNESS_WORK_DIR ?? join(homedir(), '.cache/storybook-perf-harness');

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export const log = (...args) =>
  console.log(`[perf ${new Date().toISOString().slice(11, 19)}]`, ...args);

// Runs a command, returns trimmed stdout, throws with stderr on a non-zero exit.
export function sh(cmd, args, options = {}) {
  const result = spawnSync(cmd, args, { encoding: 'utf8', maxBuffer: 256 * 2 ** 20, ...options });
  if (result.status !== 0) {
    throw new Error(
      `${cmd} ${args.join(' ')} failed (${result.status}) in ${options.cwd ?? process.cwd()}:\n${result.stderr}\n${result.stdout}`.slice(
        0,
        8000
      )
    );
  }
  return result.stdout.trim();
}

// Runs a command with output streamed to this process, resolves on exit 0.
export function run(cmd, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: 'inherit', ...options });
    child.on('error', reject);
    child.on('exit', (code) =>
      code === 0 ? resolve() : reject(new Error(`${cmd} ${args.join(' ')} exited ${code}`))
    );
  });
}

export const sum = (xs) => xs.reduce((a, b) => a + b, 0);

export const median = (xs) => {
  const s = xs.filter((x) => typeof x === 'number' && !Number.isNaN(x)).sort((a, b) => a - b);
  if (s.length === 0) return null;
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};

export const percentile = (xs, p) => {
  const s = xs.filter((x) => typeof x === 'number' && !Number.isNaN(x)).sort((a, b) => a - b);
  if (s.length === 0) return null;
  return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))];
};
