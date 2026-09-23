import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const DTS_ARTIFACT = join(import.meta.dirname, '../../dist/test/index.d.ts');
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
});
