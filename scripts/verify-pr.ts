// Entry point for the PR verification harness.
// Usage: bun scripts/verify-pr.ts [--resync] [--keep-open] [--skip-recipe] [--restore-sandbox] [--recipe-spec <path>] [--port <n>]

import { parseArgs } from 'node:util';
import { performance } from 'node:perf_hooks';
import * as path from 'node:path';

import {
  SCHEMA_VERSION,
  buildRunPaths,
  computeVerdict,
  ensureRunDir,
  parsePlaywrightReport,
  pruneOldRuns,
  writeResult,
} from './verify/core.ts';
import type { VerifyResult } from './verify/core.ts';
import {
  resolveSandboxDir,
  restoreSandbox,
  sanitizeResolutions,
  snapshotSandbox,
} from './verify/sandbox.ts';
import { syncCorePackage } from './verify/sync.ts';
import { bootStorybook, installSignalHandlers, preflightPort } from './verify/boot.ts';
import { runRecipe } from './verify/runner.ts';

const repoRoot = path.resolve(import.meta.dirname, '..');
const DEFAULT_RECIPE_SPEC = path.resolve(repoRoot, '.verify-recipes/example-smoke.spec.ts');

const HELP = `
Usage: bun scripts/verify-pr.ts [options]

Options:
  --resync                Recompile affected packages and hard-reload running Storybook (requires --keep-open session)
  --keep-open             Leave Storybook running after the recipe completes; print URL
  --skip-recipe           Skip the Playwright recipe entirely; write verdict: "skipped"; exit 0
  --restore-sandbox       Copy .verify-snapshot/* back to sandbox and exit
  --recipe-spec <path>    Path to the Playwright spec to run (default: .verify-recipes/example-smoke.spec.ts)
  --port <n>              Port for Storybook (default: 6006). Use to avoid collisions with side processes.
  --help                  Show this help

Examples:
  bun scripts/verify-pr.ts
  bun scripts/verify-pr.ts --keep-open
  bun scripts/verify-pr.ts --resync
  bun scripts/verify-pr.ts --restore-sandbox
  bun scripts/verify-pr.ts --recipe-spec .verify-recipes/my-recipe.spec.ts
`.trim();

function resolveRecipeSpec(flagValue: string | undefined): string {
  const raw = flagValue ?? DEFAULT_RECIPE_SPEC;
  return path.isAbsolute(raw) ? raw : path.resolve(repoRoot, raw);
}

async function main(argv: string[]): Promise<number> {
  const { values: flags } = parseArgs({
    args: argv,
    options: {
      resync: { type: 'boolean', default: false },
      'keep-open': { type: 'boolean', default: false },
      'skip-recipe': { type: 'boolean', default: false },
      'restore-sandbox': { type: 'boolean', default: false },
      'recipe-spec': { type: 'string' },
      port: { type: 'string' },
      help: { type: 'boolean', default: false },
    },
    strict: true,
  });

  if (flags.help) {
    console.log(HELP);
    return 0;
  }

  const recipeSpec = resolveRecipeSpec(flags['recipe-spec']);
  const port = flags.port ? Number(flags.port) : 6006;
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    console.error(`[verify] --port must be an integer in 1..65535, got: ${flags.port}`);
    return 1;
  }
  const baseURL = `http://localhost:${port}`;
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

  // --skip-recipe: write skipped verdict and exit 0
  if (flags['skip-recipe']) {
    const skipped: VerifyResult = {
      schemaVersion: SCHEMA_VERSION,
      runId: paths.runId,
      verdict: 'skipped',
      template: 'react-vite/default-ts',
      storyIds: [],
      recipeSpecPath: recipeSpec,
      tests: [],
      traceZipPaths: [],
      durations: { totalMs: performance.now() - totalStart },
      createdAt: new Date().toISOString(),
    };
    await writeResult(paths, skipped);
    console.log(`[verify] skipped — result at ${paths.resultJson}`);
    return 0;
  }

  const sandboxDir = resolveSandboxDir();

  // --resync: recompile affected, refresh symlinks, re-run recipe against the running Storybook
  if (flags.resync) {
    const { default: fetch } = await import('node-fetch').catch(() => ({
      default: globalThis.fetch as typeof import('node-fetch').default,
    }));
    let alive = false;
    try {
      const res = await (fetch as any)(`${baseURL}/index.html`, { method: 'GET' });
      alive = res.ok;
    } catch {
      alive = false;
    }
    if (!alive) {
      console.error(
        `[verify] --resync requires a running Storybook on :${port}. Bootstrap with:\n  bun scripts/verify-pr.ts --keep-open --port ${port}`
      );
      return 1;
    }

    const { exec } = await import('./utils/exec.ts');
    await exec(
      'yarn nx affected -t compile --base=HEAD~1',
      { cwd: repoRoot },
      { startMessage: '[resync] compiling affected', errorMessage: '[resync] compile failed' }
    );
    await syncCorePackage({ sandboxDir });

    try {
      await (fetch as any)(`${baseURL}/__reload`, { method: 'POST' });
    } catch {
      console.log('[resync] __reload not available; hard-reload via navigation cache-bust');
    }

    const resyncPaths = buildRunPaths();
    await ensureRunDir(resyncPaths);

    const recipeStart = performance.now();
    const { reportPath } = await runRecipe({
      specPath: recipeSpec,
      baseURL,
      runPaths: resyncPaths,
    });
    const { tests, traceZipPaths } = await parsePlaywrightReport(reportPath);
    const recipeMs = performance.now() - recipeStart;
    const verdict = computeVerdict(tests);

    const result: VerifyResult = {
      schemaVersion: SCHEMA_VERSION,
      runId: resyncPaths.runId,
      verdict,
      template: 'react-vite/default-ts',
      storyIds: ['example-button--primary'],
      recipeSpecPath: recipeSpec,
      tests,
      traceZipPaths,
      durations: { recipeMs, totalMs: performance.now() - totalStart },
      createdAt: new Date().toISOString(),
    };
    await writeResult(resyncPaths, result);
    console.log(`[verify] resync — verdict: ${verdict} — result at ${resyncPaths.resultJson}`);
    if (traceZipPaths.length > 0) {
      console.log(`[verify] traces: ${traceZipPaths.join(', ')}`);
    }
    return verdict === 'verified' ? 0 : 1;
  }

  // Full run
  await snapshotSandbox(sandboxDir);
  await sanitizeResolutions(sandboxDir);

  const controller = new AbortController();
  installSignalHandlers(controller);
  await preflightPort(port);

  const syncResult = await syncCorePackage({ sandboxDir });

  const { bootMs } = await bootStorybook({ sandboxDir, port, controller });

  let reportPath: string;
  let recipeMs: number;
  try {
    const recipeStart = performance.now();
    const runResult = await runRecipe({
      specPath: recipeSpec,
      baseURL,
      runPaths: paths,
      controller,
    });
    reportPath = runResult.reportPath;
    recipeMs = performance.now() - recipeStart;
  } finally {
    if (!flags['keep-open']) {
      controller.abort();
    }
  }

  const { tests, traceZipPaths } = await parsePlaywrightReport(reportPath);
  const verdict = computeVerdict(tests);
  const totalMs = performance.now() - totalStart;

  const result: VerifyResult = {
    schemaVersion: SCHEMA_VERSION,
    runId: paths.runId,
    verdict,
    template: 'react-vite/default-ts',
    storyIds: ['example-button--primary'],
    recipeSpecPath: recipeSpec,
    tests,
    traceZipPaths,
    durations: {
      compileMs: syncResult.compileMs,
      symlinkMs: syncResult.symlinkMs,
      bootMs,
      recipeMs,
      totalMs,
    },
    createdAt: new Date().toISOString(),
  };

  await writeResult(paths, result);
  console.log(`[verify] verdict: ${verdict} — result at ${paths.resultJson}`);
  if (traceZipPaths.length > 0) {
    console.log(`[verify] traces: ${traceZipPaths.join(', ')}`);
  }

  if (flags['keep-open']) {
    console.log(`[verify] --keep-open: Storybook running at ${baseURL}`);
  }

  return verdict === 'verified' ? 0 : 1;
}

main(process.argv.slice(2))
  .then((code) => process.exit(code))
  .catch((err) => {
    console.error('[verify] fatal:', err);
    process.exit(1);
  });
