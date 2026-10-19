import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const declaration = join(import.meta.dirname, '../dist/theming.d.ts');
const bundle = join(import.meta.dirname, '../dist/theming.js');
const built = existsSync(declaration) && existsSync(bundle);

describe('@storybook/react/theming build', () => {
  it.runIf(process.env.CI)('is built before this suite runs', () => {
    expect(built).toBe(true);
  });

  it.runIf(built)('re-exports storybook/theming types', () => {
    expect(readFileSync(declaration, 'utf8')).toBe("export * from 'storybook/theming';\n");
  });

  it.runIf(built)('bundles the theming runtime', () => {
    const source = readFileSync(bundle, 'utf8');
    expect(source).not.toMatch(/from ["']storybook\/theming["']/);
    expect(source).toMatch(/from ["']react["']/);
  });
});
