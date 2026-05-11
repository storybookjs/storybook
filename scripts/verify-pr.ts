// Entry point for the PR verification harness (v6, local-first).
//
// Usage:
//   node scripts/verify-pr.ts [<PR#>] [options]
//
// Two execution targets, selected per recipe via a `// @verify-target:` header:
//
//   internal-ui (default)  — builds code/storybook-static once, serves it on
//                            the requested port via http-server. Fast path
//                            for fixes that exercise the monorepo's own UI
//                            against the PR head's compiled packages.
//
//   sandbox:<template>     — pre-existing sandbox flow: snapshotSandbox,
//                            sanitizeResolutions, syncCorePackage (symlink
//                            code/core/dist into the sandbox), then boot
//                            the sandbox's own `yarn storybook --ci`.
//                            Use only when a fix is template-specific.

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
import { bootInternalUi } from './verify/internal-ui.ts';
import { runRecipe } from './verify/runner.ts';
import { describeTarget, parseTargetFromSpec, type VerifyTarget } from './verify/target.ts';
import { exec } from './utils/exec.ts';

const repoRoot = path.resolve(import.meta.dirname, '..');
const DEFAULT_RECIPE_SPEC = path.resolve(repoRoot, '.verify-recipes/example-smoke.spec.ts');

const HELP = `
Usage: node scripts/verify-pr.ts [<PR#>] [options]

Positional:
  <PR#>                   Resolves recipe-spec to .verify-recipes/pr-<#>.spec.ts.
                          Ignored when --recipe-spec is supplied.

Options:
  --resync                Recompile affected packages and re-run the recipe
                          against a running Storybook (sandbox target only;
                          requires a prior --keep-open session).
  --keep-open             Leave Storybook running after the recipe completes.
  --skip-recipe           Skip the Playwright recipe; emit verdict: "skipped".
  --restore-sandbox       Copy .verify-snapshot/* back to sandbox and exit.
                          Sandbox target only.
  --recipe-spec <path>    Path to the Playwright spec to run. Overrides PR#.
                          Default: .verify-recipes/example-smoke.spec.ts.
  --port <n>              Storybook port (default 6006).
  --help                  Show this help.

Examples:
  yarn verify-pr 34762
  yarn verify-pr --recipe-spec .verify-recipes/example-smoke.spec.ts
  yarn verify-pr --keep-open
  yarn verify-pr --restore-sandbox --recipe-spec .verify-recipes/pr-N.spec.ts
`.trim();

function resolveRecipeSpec(flagValue: string | undefined, positional?: string): string {
  if (flagValue) {
    return path.isAbsolute(flagValue) ? flagValue : path.resolve(repoRoot, flagValue);
  }
  if (positional && /^\d+$/.test(positional)) {
    return path.resolve(repoRoot, `.verify-recipes/pr-${positional}.spec.ts`);
  }
  return DEFAULT_RECIPE_SPEC;
}

function templateLabel(target: VerifyTarget): string {
  return target.kind === 'sandbox' ? target.template : 'internal-ui';
}

interface RunResyncArgs {
  recipeSpec: string;
  baseURL: string;
  port: number;
  sandboxDir: string;
  totalStart: number;
}

async function runResync(args: RunResyncArgs): Promise<number> {
  const { default: fetchImpl } = await import('node-fetch').catch(() => ({
    default: globalThis.fetch as typeof import('node-fetch').default,
  }));
  let alive = false;
  try {
    const res = await (fetchImpl as any)(`${args.baseURL}/index.html`, { method: 'GET' });
    alive = res.ok;
  } catch {
    alive = false;
  }
  if (!alive) {
    console.error(
      `[verify] --resync requires a running Storybook on :${args.port}. Bootstrap with:\n  yarn verify-pr --keep-open --port ${args.port}`
    );
    return 1;
  }

  await exec(
    'yarn nx affected -t compile --base=HEAD~1',
    { cwd: repoRoot },
    { startMessage: '[resync] compiling affected', errorMessage: '[resync] compile failed' }
  );
  await syncCorePackage({ sandboxDir: args.sandboxDir });

  try {
    await (fetchImpl as any)(`${args.baseURL}/__reload`, { method: 'POST' });
  } catch {
    console.log('[resync] __reload not available; hard-reload via navigation cache-bust');
  }

  const resyncPaths = buildRunPaths();
  await ensureRunDir(resyncPaths);

  const recipeStart = performance.now();
  const { reportPath } = await runRecipe({
    specPath: args.recipeSpec,
    baseURL: args.baseURL,
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
    storyIds: [],
    recipeSpecPath: args.recipeSpec,
    tests,
    traceZipPaths,
    durations: { recipeMs, totalMs: performance.now() - args.totalStart },
    createdAt: new Date().toISOString(),
  };
  await writeResult(resyncPaths, result);
  console.log(`[verify] resync — verdict: ${verdict} — result at ${resyncPaths.resultJson}`);
  if (traceZipPaths.length > 0) {
    console.log(`[verify] traces: ${traceZipPaths.join(', ')}`);
  }
  return verdict === 'verified' ? 0 : 1;
}

async function main(argv: string[]): Promise<number> {
  const { values: flags, positionals } = parseArgs({
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
    allowPositionals: true,
    strict: true,
  });

  if (flags.help) {
    console.log(HELP);
    return 0;
  }

  const recipeSpec = resolveRecipeSpec(flags['recipe-spec'], positionals[0]);
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

  const target: VerifyTarget = parseTargetFromSpec(recipeSpec);
  console.log(`[verify] recipe: ${recipeSpec}`);
  console.log(`[verify] target: ${describeTarget(target)}`);

  if (flags['restore-sandbox']) {
    if (target.kind !== 'sandbox') {
      console.error('[verify] --restore-sandbox only applies to sandbox-target recipes.');
      return 1;
    }
    const sandboxDir = resolveSandboxDir(target.template as 'react-vite/default-ts');
    await restoreSandbox(sandboxDir);
    return 0;
  }

  if (flags['skip-recipe']) {
    const skipped: VerifyResult = {
      schemaVersion: SCHEMA_VERSION,
      runId: paths.runId,
      verdict: 'skipped',
      template: templateLabel(target),
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

  if (flags.resync && target.kind !== 'sandbox') {
    console.error('[verify] --resync only applies to sandbox-target recipes.');
    return 1;
  }

  const controller = new AbortController();
  installSignalHandlers(controller);
  await preflightPort(port);

  let compileMs: number | undefined;
  let symlinkMs: number | undefined;
  let bootMs: number;

  if (target.kind === 'internal-ui') {
    const handle = await bootInternalUi({ port, controller });
    bootMs = handle.bootMs;
  } else {
    const sandboxDir = resolveSandboxDir(target.template as 'react-vite/default-ts');

    if (flags.resync) {
      return runResync({ recipeSpec, baseURL, port, sandboxDir, totalStart });
    }

    await snapshotSandbox(sandboxDir);
    await sanitizeResolutions(sandboxDir);
    const sync = await syncCorePackage({ sandboxDir });
    compileMs = sync.compileMs;
    symlinkMs = sync.symlinkMs;
    const boot = await bootStorybook({ sandboxDir, port, controller });
    bootMs = boot.bootMs;
  }

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
    template: templateLabel(target),
    storyIds: [],
    recipeSpecPath: recipeSpec,
    tests,
    traceZipPaths,
    durations: { compileMs, symlinkMs, bootMs, recipeMs, totalMs },
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
