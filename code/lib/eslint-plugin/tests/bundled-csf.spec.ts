import { readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const distFile = join(dirname(fileURLToPath(import.meta.url)), '../dist/index.js');
const MAX_BUNDLE_BYTES = 150_000;

describe('eslint-plugin-storybook bundle', () => {
  it('inlines CSF helpers instead of importing storybook/internal/csf', () => {
    const bundle = readFileSync(distFile, 'utf8');

    expect(bundle).not.toMatch(/storybook\/internal\/csf/);
  });

  it('bundles only the minimal CSF export helpers', () => {
    expect(statSync(distFile).size).toBeLessThan(MAX_BUNDLE_BYTES);
  });
});
