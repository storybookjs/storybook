import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const distFile = join(dirname(fileURLToPath(import.meta.url)), '../dist/index.js');

describe('eslint-plugin-storybook bundle', () => {
  it('inlines CSF helpers instead of importing storybook/internal/csf', () => {
    const bundle = readFileSync(distFile, 'utf8');

    expect(bundle).not.toMatch(/storybook\/internal\/csf/);
  });
});
