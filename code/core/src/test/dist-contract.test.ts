import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { existsSync, readFileSync } from 'node:fs';
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

  it.runIf(DTS_BUILT)('uses public dependencies compatible with TypeScript 5.9', () => {
    const declarations = readFileSync(DTS_ARTIFACT, 'utf-8');

    expect(declarations).toContain('/// <reference types="chai" preserve="true" />');
    expect(declarations).toContain('from "@testing-library/jest-dom/matchers"');
    expect(declarations).toContain('from "@vitest/expect"');
    expect(declarations).not.toContain('@testing-library/jest-dom/types/');
    expect(declarations).not.toContain('Chai.');
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
