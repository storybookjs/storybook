import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, isAbsolute } from 'node:path';
import { parseArgs } from 'node:util';

import { join } from 'pathe';

import { ROOT_DIRECTORY } from '../utils/constants.ts';

const {
  values: { cwd },
} = parseArgs({
  options: {
    cwd: { type: 'string' },
  },
  allowNegative: true,
});

const normalizedCwd = cwd ? (isAbsolute(cwd) ? cwd : join(ROOT_DIRECTORY, cwd)) : process.cwd();

const tsconfigPath = join(normalizedCwd, 'tsconfig.json');

if (existsSync(tsconfigPath)) {
  const require = createRequire(import.meta.url);
  // `typescript-native` is an npm alias for typescript@7 (the native compiler). Its `exports`
  // map only exposes the new API entry points, so resolve the package root via package.json and
  // spawn its tsc launcher directly.
  const tscPath = join(dirname(require.resolve('typescript-native/package.json')), 'bin/tsc');

  const result = spawnSync(
    process.execPath,
    [tscPath, '--project', tsconfigPath, '--noEmit', '--target', 'es2022', '--pretty', 'false'],
    { cwd: normalizedCwd, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }
  );

  if (result.error) {
    throw result.error;
  }

  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
  const diagnostics = filterDiagnosticsToCwd(output, normalizedCwd);

  if (diagnostics.length > 0) {
    console.log(diagnostics.join('\n'));
    process.exit(1);
  } else if (result.status !== 0 && !/: error TS\d+: /.test(output)) {
    // tsc failed without reporting any diagnostics (e.g. it crashed or rejected the CLI usage),
    // so surface its raw output instead of silently passing.
    console.log(output);
    process.exit(result.status ?? 1);
  } else if (!process.env.CI) {
    console.log('✅ No type errors');
  }
}

/**
 * Keeps only diagnostics for files inside `cwd` (plus file-less global errors), mirroring the
 * previous behavior of filtering `getPreEmitDiagnostics` down to the checked package. Diagnostics
 * for files outside the package (e.g. sibling workspaces pulled in through imports) are reported
 * by the owning package's own check instead.
 */
function filterDiagnosticsToCwd(output: string, cwd: string): string[] {
  const kept: string[] = [];
  let keepBlock = false;

  for (const line of output.split(/\r?\n/)) {
    const fileHeader = line.match(/^(.+?)\(\d+,\d+\): (?:error|warning) TS\d+: /);
    const globalHeader = fileHeader ? null : line.match(/^(?:error|warning) TS\d+: /);

    if (fileHeader) {
      const file = fileHeader[1];
      keepBlock = isAbsolute(file) ? file.startsWith(cwd) : !file.startsWith('..');
    } else if (globalHeader) {
      keepBlock = true;
    } else if (line !== '' && !/^\s/.test(line)) {
      // unrecognized non-indented line: not part of a diagnostic block
      keepBlock = false;
    }
    // indented lines are continuations (e.g. related-information) of the current diagnostic

    if (keepBlock && line !== '') {
      kept.push(line);
    }
  }

  return kept;
}

// TODO, add more package checks here, like:
// - check for missing dependencies/peerDependencies
// - check for unused exports
