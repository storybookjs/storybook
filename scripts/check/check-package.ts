import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { basename, dirname, isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import { filterToPackageDiagnostics, getTSFilesAndConfig } from './utils/typescript.ts';

const ROOT_DIRECTORY = join(fileURLToPath(import.meta.url), '..', '..', '..');

const {
  values: { cwd },
} = parseArgs({
  options: {
    cwd: { type: 'string' },
  },
  allowNegative: true,
});

const normalizedCwd = cwd ? (isAbsolute(cwd) ? cwd : join(ROOT_DIRECTORY, cwd)) : process.cwd();

const require = createRequire(import.meta.url);
const tscPath = join(dirname(require.resolve('typescript-native/package.json')), 'bin', 'tsc');

// Generous per-package ceiling: a wedged native compiler must fail this one
// package fast instead of stalling the whole pooled check task until the CI
// job timeout.
const TSC_TIMEOUT_MS = 10 * 60 * 1000;

function checkProject(tsconfigPath: string, files?: string[]) {
  const result = spawnSync(
    process.execPath,
    [tscPath, '--project', tsconfigPath, '--noEmit', '--pretty', 'false'],
    {
      cwd: normalizedCwd,
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
      timeout: TSC_TIMEOUT_MS,
      killSignal: 'SIGTERM',
    }
  );

  const errorCode = result.error ? (result.error as NodeJS.ErrnoException).code : undefined;
  if (errorCode === 'ETIMEDOUT') {
    console.log(
      `tsc timed out after ${TSC_TIMEOUT_MS / 60_000} minutes for ${tsconfigPath} (hang, not a type error)`
    );
    process.exit(1);
  }
  // On ENOBUFS the captured (truncated) output is still the best triage
  // signal, so fall through to the diagnostic handling below.
  if (result.error && errorCode !== 'ENOBUFS') {
    throw result.error;
  }
  if (result.signal && errorCode !== 'ENOBUFS') {
    console.log(
      `tsc was terminated by signal ${result.signal} (compiler crash or OOM kill, not a type error)`
    );
    process.exit(1);
  }

  if (result.status === 0) {
    if (!process.env.CI) {
      console.log(`✅ No type errors (${basename(tsconfigPath)})`);
    }
  } else {
    const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
    const { kept, sawDiagnostic } = filterToPackageDiagnostics(output, normalizedCwd, files);

    if (errorCode === 'ENOBUFS') {
      console.log('tsc output exceeded 64MB and was truncated; showing partial diagnostics:');
      console.log(kept.length > 0 ? kept.join('\n') : output.slice(-20_000));
      process.exit(1);
    }
    if (kept.length > 0) {
      console.log(kept.join('\n'));
      process.exit(1);
    }
    if (!sawDiagnostic) {
      // Non-zero exit without a single parseable diagnostic: surface raw output.
      console.log(output);
      process.exit(1);
    }
    if (!process.env.CI) {
      console.log(
        `✅ No type errors in this package (${basename(tsconfigPath)}, external diagnostics ignored)`
      );
    }
  }
}

const tsconfigPath = join(normalizedCwd, 'tsconfig.json');
if (existsSync(tsconfigPath)) {
  checkProject(tsconfigPath);
}

// A package that isn't strict itself can type-check some files, such as type tests, the way strict
// projects use them. Only diagnostics in those files count, not in the package code they import.
const strictTsconfigPath = join(normalizedCwd, 'tsconfig.strict.json');
if (existsSync(strictTsconfigPath)) {
  const { fileNames } = getTSFilesAndConfig(strictTsconfigPath, normalizedCwd);
  checkProject(
    strictTsconfigPath,
    fileNames.map((file) => resolve(file))
  );
}

// TODO, add more package checks here, like:
// - check for missing dependencies/peerDependencies
// - check for unused exports
