import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const DTS_ARTIFACT = join(import.meta.dirname, '../../dist/test/index.d.ts');
const CONSUMER_FIXTURE = join(import.meta.dirname, '__testfixtures__/typescript-consumer.ts');
const TYPESCRIPT = createRequire(import.meta.url).resolve('typescript/bin/tsc');
const TYPESCRIPT_5 = createRequire(import.meta.url).resolve('typescript-5/bin/tsc');
const DTS_BUILT = existsSync(DTS_ARTIFACT);
const REPOSITORY_ROOT = join(import.meta.dirname, '../../../..');
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
  CONSUMER_FIXTURE,
];

describe('storybook/test declaration contract', () => {
  it.runIf(process.env.CI)('is built before this suite runs', () => {
    expect(DTS_BUILT).toBe(true);
  });

  it.runIf(DTS_BUILT)('inlines the types of the test libraries it bundles', () => {
    // The test types also land in chunks shared with other entries, so check every declaration.
    const distDirectory = join(import.meta.dirname, '../../dist');
    const declarationFiles = readdirSync(distDirectory, { recursive: true, encoding: 'utf-8' })
      .filter((file) => file.endsWith('.d.ts'))
      .map((file) => ({ file, declarations: readFileSync(join(distDirectory, file), 'utf-8') }));

    // These packages are devDependencies of storybook, so users don't have them installed.
    const testLibraryImport =
      /from "(@testing-library\/|@vitest\/|chai"|@types\/chai|tinyspy|aria-query)|typeof import\("(@testing-library|@vitest)\/|reference types="chai"/;
    expect(
      declarationFiles.filter(({ declarations }) => testLibraryImport.test(declarations))
    ).toEqual([]);

    // Chai's types are global; inlining them would declare globals in the user's project.
    expect(readFileSync(DTS_ARTIFACT, 'utf-8')).not.toContain('declare global');
  });

  it.runIf(DTS_BUILT)(
    'compiles the public test API consumer fixture with the workspace compiler',
    () => {
      execFileSync(process.execPath, [TYPESCRIPT, ...TSC_OPTIONS], {
        cwd: REPOSITORY_ROOT,
        stdio: 'pipe',
      });
    }
  );

  it.runIf(DTS_BUILT)('compiles the public test API consumer fixture with TypeScript 5.9.3', () => {
    execFileSync(process.execPath, [TYPESCRIPT_5, ...TSC_OPTIONS], {
      cwd: REPOSITORY_ROOT,
      stdio: 'pipe',
    });
  });
});
