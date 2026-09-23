import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const DTS_ARTIFACT = join(import.meta.dirname, '../../dist/test/index.d.ts');
const CONSUMER_FIXTURE = join(import.meta.dirname, '__testfixtures__/typescript-consumer.ts');
const TYPESCRIPT = join(import.meta.dirname, '../../../../node_modules/typescript/bin/tsc');
const DTS_BUILT = existsSync(DTS_ARTIFACT);

describe('storybook/test declaration contract', () => {
  it.runIf(process.env.CI)('is built before this suite runs', () => {
    expect(DTS_BUILT).toBe(true);
  });

  it.runIf(DTS_BUILT)('uses public dependencies compatible with TypeScript 5', () => {
    const declarations = readFileSync(DTS_ARTIFACT, 'utf-8');

    expect(declarations).toContain('from "@testing-library/jest-dom/matchers"');
    expect(declarations).not.toContain('@testing-library/jest-dom/types/');
    expect(declarations).not.toMatch(/(?:from|import\()\s*['"]@vitest\//);
    expect(declarations).not.toContain('WeakKey');
    expect(declarations).not.toContain('Disposable');
    expect(declarations).not.toContain('Chai.');
  });

  it.runIf(DTS_BUILT)('compiles the public test API consumer fixture', () => {
    execFileSync(
      process.execPath,
      [
        TYPESCRIPT,
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
      ],
      { stdio: 'pipe' }
    );
  });
});
