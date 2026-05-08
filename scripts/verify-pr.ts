// Entry point for the PR verification harness.
// Usage: bun scripts/verify-pr.ts [--resync] [--keep-open] [--no-screenshot] [--restore-sandbox]

import { parseArgs } from 'node:util';
import { performance } from 'node:perf_hooks';

import {
  buildRunPaths,
  computeVerdict,
  ensureRunDir,
  pruneOldRuns,
  writeResult,
} from './verify/core.ts';
import type { CaptureMetadata, CaptureResult, VerifyResult } from './verify/core.ts';
import {
  resolveSandboxDir,
  restoreSandbox,
  sanitizeResolutions,
  snapshotSandbox,
} from './verify/sandbox.ts';
import { syncCorePackage } from './verify/sync.ts';
import { bootStorybook, installSignalHandlers, preflightPort } from './verify/boot.ts';
import { capture } from './verify/capture.ts';

const HELP = `
Usage: bun scripts/verify-pr.ts [options]

Options:
  --resync           Recompile affected packages and hard-reload running Storybook (requires --keep-open session)
  --keep-open        Leave Storybook running after capture; print URL
  --no-screenshot    Skip capture entirely; write verdict: "skipped"; exit 0
  --restore-sandbox  Copy .verify-snapshot/* back to sandbox and exit
  --help             Show this help

Examples:
  bun scripts/verify-pr.ts
  bun scripts/verify-pr.ts --keep-open
  bun scripts/verify-pr.ts --resync
  bun scripts/verify-pr.ts --restore-sandbox
`.trim();

async function main(argv: string[]): Promise<number> {
  const { values: flags } = parseArgs({
    args: argv,
    options: {
      resync: { type: 'boolean', default: false },
      'keep-open': { type: 'boolean', default: false },
      'no-screenshot': { type: 'boolean', default: false },
      'restore-sandbox': { type: 'boolean', default: false },
      help: { type: 'boolean', default: false },
    },
    strict: true,
  });

  if (flags.help) {
    console.log(HELP);
    return 0;
  }

  const totalStart = performance.now();
  const paths = buildRunPaths();
  await pruneOldRuns();
  await ensureRunDir(paths);

  // --restore-sandbox: copy snapshot back and exit
  if (flags['restore-sandbox']) {
    const sandboxDir = resolveSandboxDir();
    await restoreSandbox(sandboxDir);
    return 0;
  }

  // --no-screenshot: write skipped verdict and exit 0
  if (flags['no-screenshot']) {
    const skipped: VerifyResult = {
      runId: paths.runId,
      verdict: 'skipped',
      template: 'react-vite/default-ts',
      storyIds: [],
      capture: {
        pageErrors: [],
        consoleErrors: [],
        errorDisplayHidden: true,
        previewHasChildren: false,
        screenshotPath: '',
      },
      durations: { totalMs: performance.now() - totalStart },
      createdAt: new Date().toISOString(),
    };
    await writeResult(paths, skipped);
    console.log(`[verify] skipped — result at ${paths.resultJson}`);
    return 0;
  }

  const sandboxDir = resolveSandboxDir();

  // --resync: recompile affected, refresh symlinks, hard-reload running Storybook
  if (flags.resync) {
    // Verify Storybook is running
    const { default: fetch } = await import('node-fetch').catch(() => ({
      default: globalThis.fetch as typeof import('node-fetch').default,
    }));
    let alive = false;
    try {
      const res = await (fetch as any)('http://localhost:6006/index.html', { method: 'GET' });
      alive = res.ok;
    } catch {
      alive = false;
    }
    if (!alive) {
      console.error(
        '[verify] --resync requires a running Storybook on :6006. Bootstrap with:\n  bun scripts/verify-pr.ts --keep-open'
      );
      return 1;
    }

    const { exec } = await import('./utils/exec.ts');
    const { resolve } = await import('node:path');
    const repoRoot = resolve(import.meta.dirname, '..');
    await exec(
      'yarn nx affected -t compile --base=HEAD~1',
      { cwd: repoRoot },
      { startMessage: '[resync] compiling affected', errorMessage: '[resync] compile failed' }
    );
    await syncCorePackage({ sandboxDir });

    // Hard-reload: navigate to cache-busted URL
    try {
      await (fetch as any)(`http://localhost:6006/__reload`, { method: 'POST' });
    } catch {
      // __reload endpoint not available; use navigation (precondition: --keep-open tab open)
      console.log('[resync] __reload not available; hard-reload via navigation cache-bust');
    }

    const resyncPaths = buildRunPaths();
    await ensureRunDir(resyncPaths);
    const captureResult = await capture({
      baseURL: 'http://localhost:6006',
      storyId: 'example-button--primary',
      runPaths: resyncPaths,
    });
    const verdict = computeVerdict(captureResult);
    const result: VerifyResult = {
      runId: resyncPaths.runId,
      verdict,
      template: 'react-vite/default-ts',
      storyIds: ['example-button--primary'],
      capture: captureResult as CaptureMetadata,
      durations: { totalMs: performance.now() - totalStart },
      createdAt: new Date().toISOString(),
    };
    await writeResult(resyncPaths, result);
    console.log(`[verify] resync — verdict: ${verdict} — result at ${resyncPaths.resultJson}`);
    return verdict === 'verified' ? 0 : 1;
  }

  // Full run
  await snapshotSandbox(sandboxDir);
  await sanitizeResolutions(sandboxDir);

  const controller = new AbortController();
  installSignalHandlers(controller);
  await preflightPort(6006);

  const syncResult = await syncCorePackage({ sandboxDir });

  const { bootMs } = await bootStorybook({ sandboxDir, port: 6006, controller });

  let captureResult: CaptureResult;
  let captureMs: number;
  try {
    const captureStart = performance.now();
    captureResult = await capture({
      baseURL: 'http://localhost:6006',
      storyId: 'example-button--primary',
      runPaths: paths,
      controller,
    });
    captureMs = performance.now() - captureStart;
  } finally {
    if (!flags['keep-open']) {
      controller.abort();
    }
  }

  const verdict = computeVerdict(captureResult!);
  const totalMs = performance.now() - totalStart;

  const result: VerifyResult = {
    runId: paths.runId,
    verdict,
    template: 'react-vite/default-ts',
    storyIds: ['example-button--primary'],
    capture: captureResult! as CaptureMetadata,
    durations: {
      compileMs: syncResult.compileMs,
      symlinkMs: syncResult.symlinkMs,
      bootMs,
      captureMs: captureMs!,
      totalMs,
    },
    createdAt: new Date().toISOString(),
  };

  await writeResult(paths, result);
  console.log(`[verify] verdict: ${verdict} — result at ${paths.resultJson}`);

  if (flags['keep-open']) {
    console.log('[verify] --keep-open: Storybook running at http://localhost:6006');
  }

  return verdict === 'verified' ? 0 : 1;
}

main(process.argv.slice(2))
  .then((code) => process.exit(code))
  .catch((err) => {
    console.error('[verify] fatal:', err);
    process.exit(1);
  });
