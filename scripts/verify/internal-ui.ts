// Boots the monorepo's internal Storybook UI for the verify harness.
//
// Builds `code/storybook-static/` once via `yarn storybook:ui:build` (skipped
// when the build artefact is already present), then serves it on the requested
// port via `yarn http-server --silent -c-1`. Returns once index.html responds.
//
// Used by the v6 verify-pr.ts when a recipe declares `// @verify-target: internal-ui`
// (the default).

import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync } from 'node:fs';
import * as path from 'node:path';
import { performance } from 'node:perf_hooks';

import waitOn from 'wait-on';

import { exec } from '../utils/exec.ts';

const repoRoot = path.resolve(import.meta.dirname, '..', '..');
const codeDir = path.join(repoRoot, 'code');
const staticDir = path.join(codeDir, 'storybook-static');

export interface InternalUiHandle {
  bootMs: number;
  child: ChildProcess;
}

export async function bootInternalUi(opts: {
  port: number;
  controller: AbortController;
  forceBuild?: boolean;
}): Promise<InternalUiHandle> {
  const bootStart = performance.now();

  const needBuild = opts.forceBuild || !existsSync(path.join(staticDir, 'index.html'));
  if (needBuild) {
    await exec(
      'yarn storybook:ui:build',
      { cwd: codeDir },
      {
        startMessage: '[internal-ui] building static UI',
        errorMessage: '[internal-ui] storybook:ui:build failed',
      }
    );
  } else {
    console.log('[internal-ui] storybook-static present — skipping build');
  }

  const child = spawn(
    'yarn',
    ['http-server', staticDir, '-p', String(opts.port), '--silent', '-c-1'],
    {
      cwd: repoRoot,
      stdio: ['ignore', 'pipe', 'pipe'],
      signal: opts.controller.signal,
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
    console.error('[internal-ui] http-server error:', err);
  });

  const abortPromise = new Promise<never>((_, reject) => {
    opts.controller.signal.addEventListener('abort', () => {
      reject(new Error('bootInternalUi aborted'));
    });
  });

  try {
    await Promise.race([
      waitOn({
        resources: [`http://localhost:${opts.port}/index.html`],
        interval: 100,
        timeout: 60_000,
      }),
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
