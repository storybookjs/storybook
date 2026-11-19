import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const DTS_ARTIFACTS = [
  join(import.meta.dirname, '../dist/index.d.ts'),
  join(import.meta.dirname, '../dist/preview.d.ts'),
];
const TYPESCRIPT = createRequire(import.meta.url).resolve('typescript/bin/tsc');
const TYPESCRIPT_5 = createRequire(import.meta.url).resolve('typescript-5/bin/tsc');
const DTS_BUILT = DTS_ARTIFACTS.every(existsSync);
const REPOSITORY_ROOT = join(import.meta.dirname, '../../../..');
// Compiling the full declaration surface with tsc takes 30s+ on loaded Windows
// CI runners, so use a fixed generous timeout instead of the 10s default.
const compileTimeoutMs = 90_000;
const TSC_OPTIONS = [
  '--module',
  'Node16',
  '--moduleResolution',
  'node16',
  '--target',
  'ES2022',
  '--strict',
  '--skipLibCheck',
  'false',
  '--types',
  'node',
  '--noEmit',
  ...DTS_ARTIFACTS,
];

describe('React declaration contract', () => {
  it.runIf(process.env.CI)('is built before this suite runs', () => {
    expect(DTS_BUILT).toBe(true);
  });

  it.runIf(DTS_BUILT)(
    'compiles public declarations with the workspace compiler',
    () => {
      execFileSync(process.execPath, [TYPESCRIPT, ...TSC_OPTIONS], {
        cwd: REPOSITORY_ROOT,
        stdio: 'pipe',
      });
    },
    compileTimeoutMs
  );

  it.runIf(DTS_BUILT)(
    'compiles public declarations with TypeScript 5.9.3',
    () => {
      execFileSync(process.execPath, [TYPESCRIPT_5, ...TSC_OPTIONS], {
        cwd: REPOSITORY_ROOT,
        stdio: 'pipe',
      });
    },
    compileTimeoutMs
  );
});
