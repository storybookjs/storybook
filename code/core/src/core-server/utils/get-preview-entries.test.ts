import { join, resolve } from 'pathe';
import { describe, expect, it, vi } from 'vitest';

import { loadPreviewOrConfigFile } from 'storybook/internal/common';
import type { Options } from 'storybook/internal/types';

import { getPreviewEntries } from './get-preview-entries.ts';

vi.mock('storybook/internal/common', { spy: true });

function options(annotations: unknown[]): Options {
  return {
    configDir: '/repo/.storybook',
    presets: { apply: vi.fn(async () => annotations) },
  } as unknown as Options;
}

describe('getPreviewEntries', () => {
  it('lists the config directory, every preview annotation and the preview file', async () => {
    vi.mocked(loadPreviewOrConfigFile).mockReturnValue('/repo/.storybook/preview.tsx');

    const entries = await getPreviewEntries(
      options([
        '/repo/node_modules/addon/preview.js',
        { bare: 'addon-b/preview', absolute: '/repo/node_modules/addon-b/preview.js' },
        './src/decorators',
        { bare: 'nuxt/preview', absolute: '' },
      ])
    );

    expect(entries).toEqual([
      '/repo/.storybook',
      '/repo/node_modules/addon/preview.js',
      '/repo/node_modules/addon-b/preview.js',
      resolve(process.cwd(), 'src/decorators'),
      '/repo/.storybook/preview.tsx',
    ]);
  });

  it('leaves out a preview file that does not exist', async () => {
    vi.mocked(loadPreviewOrConfigFile).mockReturnValue(undefined);

    expect(await getPreviewEntries(options([]))).toEqual([join('/repo', '.storybook')]);
  });
});
