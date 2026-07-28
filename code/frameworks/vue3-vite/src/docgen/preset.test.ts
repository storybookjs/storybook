import { describe, expect, it } from 'vitest';

import type { Options } from 'storybook/internal/types';

import type { FrameworkOptions } from '../types.ts';
import { experimental_docgenProvider } from './preset.ts';

const optionsWith = (docgen?: FrameworkOptions['docgen']) =>
  ({
    presets: {
      apply: async () => ({ name: '@storybook/vue3-vite', options: { docgen } }),
    },
  }) as unknown as Options;

describe('experimental_docgenProvider', () => {
  it('contributes a worker descriptor carrying the configured tsconfig', async () => {
    const descriptors = await experimental_docgenProvider(
      [],
      optionsWith({ plugin: 'vue-component-meta', tsconfig: 'tsconfig.app.json' })
    );

    expect(descriptors).toHaveLength(1);
    expect(descriptors[0].moduleSpecifier).toMatch(/docgen-worker\.js$/);
    expect(descriptors[0].options).toEqual({ tsconfigPath: 'tsconfig.app.json' });
  });

  it('appends to descriptors contributed by addons', async () => {
    const existing = [{ moduleSpecifier: '/addon/docgen-worker.js' }];

    const descriptors = await experimental_docgenProvider(
      existing,
      optionsWith('vue-component-meta')
    );

    expect(descriptors).toHaveLength(2);
    expect(descriptors[0]).toBe(existing[0]);
    expect(descriptors[1].options).toEqual({ tsconfigPath: undefined });
  });

  it.each([
    ['the default engine', undefined],
    ['vue-docgen-api', 'vue-docgen-api' as const],
    ['docgen disabled', false as const],
  ])('contributes nothing for %s', async (_label, docgen) => {
    await expect(experimental_docgenProvider([], optionsWith(docgen))).resolves.toEqual([]);
  });
});
