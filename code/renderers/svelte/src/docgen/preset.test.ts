// @vitest-environment node
import type { DocgenProviderDescriptor, Options } from 'storybook/internal/types';

import { describe, expect, it } from 'vitest';

import { experimental_docgenProvider, experimental_manifests } from './preset.ts';

const EXISTING: DocgenProviderDescriptor[] = [{ moduleSpecifier: '/addon/docgen-worker.js' }];

const optionsWith = (features: Record<string, unknown>): Options =>
  ({
    presets: { apply: async (key: string) => (key === 'features' ? features : undefined) },
  }) as unknown as Options;

describe('experimental_docgenProvider', () => {
  it('appends the Svelte docgen worker after existing descriptors', async () => {
    await expect(
      experimental_docgenProvider(EXISTING, optionsWith({ experimentalDocgenServer: true }))
    ).resolves.toEqual([
      EXISTING[0],
      {
        moduleSpecifier: expect.stringMatching(/svelte[\\/]dist[\\/]docgen[\\/]docgen-worker\.js$/),
      },
    ]);
  });

  it('registers nothing when the docgen server is off', async () => {
    await expect(experimental_docgenProvider(EXISTING, optionsWith({}))).resolves.toBe(EXISTING);
  });
});

describe('experimental_manifests', () => {
  it.each([
    { name: 'docgen server off', features: { componentsManifest: true }, expected: {} },
    { name: 'components manifest off', features: { experimentalDocgenServer: true }, expected: {} },
    {
      name: 'both on',
      features: { experimentalDocgenServer: true, componentsManifest: true },
      expected: {
        components: { v: 0, components: {}, meta: { docgen: 'svelte2tsx', durationMs: 0 } },
      },
    },
  ])('$name', async ({ features, expected }) => {
    await expect(experimental_manifests({}, optionsWith(features) as never)).resolves.toEqual(
      expected
    );
  });
});
