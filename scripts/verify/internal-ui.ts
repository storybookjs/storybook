// Boots the monorepo's internal Storybook UI dev server for the verify
// harness.
//
// Spawns the same `storybook dev` entry that `yarn storybook:ui` uses
// (with a configurable port and `--ci` to suppress the auto-open) and
// waits for both `/iframe.html` and `/index.html` to respond. Used by
// the v6 verify-pr.ts when a recipe declares
// `// @verify-target: internal-ui` (the default).
//
// Dev server instead of `storybook build` + `http-server`: Vite serves
// on-demand instead of producing a full static bundle, so cold boot is
// ~30 s on a fresh runner instead of the 3-5 min the static path needs.
// HMR is available for any iterative dev-loop tooling that reuses this
// handle.
//
// The previously-blocking addon-vitest universal-store follower/leader
// init race ("TypeError: No existing state found for follower with id:
// 'storybook/test'") is fixed at the source in
// code/core/src/shared/universal-store/index.ts (the rejection is now
// marked handled so it no longer surfaces as a top-frame pageerror).

import { spawn, type ChildProcess } from 'node:child_process';
import * as path from 'node:path';
import { performance } from 'node:perf_hooks';

import waitOn from 'wait-on';

import { pickEnv } from '../utils/env.ts';

const repoRoot = path.resolve(import.meta.dirname, '..', '..');
const codeDir = path.join(repoRoot, 'code');
const dispatcherJs = path.join(codeDir, 'core', 'dist', 'bin', 'dispatcher.js');

export interface InternalUiHandle {
  bootMs: number;
  child: ChildProcess;
}

export async function bootInternalUi(opts: {
  port: number;
  controller: AbortController;
}): Promise<InternalUiHandle> {
  const bootStart = performance.now();

  const child = spawn(
    process.execPath,
    [dispatcherJs, 'dev', '--port', String(opts.port), '--config-dir', './.storybook', '--ci'],
    {
      cwd: codeDir,
      stdio: ['ignore', 'pipe', 'pipe'],
      signal: opts.controller.signal,
      env: pickEnv({
        allow: [
          'PATH',
          'HOME',
          'RUNNER_TEMP',
          'VERIFY_RUN_DIR',
          'STORYBOOK_URL',
          'NODE_OPTIONS',
          'CI',
          'NODE_ENV',
        ],
        extra: {
          NODE_OPTIONS: `${process.env.NODE_OPTIONS ?? ''} --max_old_space_size=4096`.trim(),
          STORYBOOK_DISABLE_TELEMETRY: '1',
        },
      }),
    }
  );

  child.stdout?.on('data', (chunk: Buffer) => {
    process.stdout.write(`[internal-ui] ${chunk}`);
  });
  child.stderr?.on('data', (chunk: Buffer) => {
    process.stderr.write(`[internal-ui] ${chunk}`);
  });
  child.on('error', (err: NodeJS.ErrnoException) => {
    if (err.name === 'AbortError') return;
    console.error('[internal-ui] dev server error:', err);
  });

  const abortPromise = new Promise<never>((_, reject) => {
    opts.controller.signal.addEventListener('abort', () => {
      reject(new Error('bootInternalUi aborted'));
    });
  });

  try {
    await Promise.race([
      Promise.all([
        waitOn({
          resources: [`http://localhost:${opts.port}/iframe.html`],
          interval: 250,
          timeout: 200_000,
        }),
        waitOn({
          resources: [`http://localhost:${opts.port}/index.html`],
          interval: 250,
          timeout: 200_000,
        }),
      ]),
      abortPromise,
    ]);
  } catch (err: unknown) {
    opts.controller.abort();
    throw new Error(
      `bootInternalUi failed: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  return { bootMs: performance.now() - bootStart, child };
}
