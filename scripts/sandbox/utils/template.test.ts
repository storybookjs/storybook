import { describe, expect, it } from 'vitest';

import { join } from 'pathe';

import { getStackblitzUrl, renderTemplate } from './template.ts';

describe('the after-storybook README', () => {
  it('says which pnpm the sandbox needs and how to get it', async () => {
    const readme = await renderTemplate(join(import.meta.dirname, '../templates/item.ejs'), {
      name: 'React Latest (Vite | TypeScript)',
      stackblitzUrl: getStackblitzUrl('react-vite/default-ts'),
    });
    const text = readme.replace(/\s+/g, ' ');

    expect(text).toContain('Requires pnpm 10 or later');
    expect(text).toContain('<code>npm install -g pnpm</code>');
    expect(text).toContain('pnpm install');
    expect(text).toContain('pnpm storybook');
    expect(text).not.toMatch(/yarn/i);
  });
});
