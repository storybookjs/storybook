import { describe, expect, it } from 'vitest';

import type { DocgenProviderDescriptor, Options } from 'storybook/internal/types';

import { experimental_docgenProvider, experimental_manifests } from './preset.ts';

const optionsWith = (features: Record<string, boolean> = {}): Options =>
  ({
    presets: {
      apply: async (key: string) => (key === 'features' ? features : {}),
    },
  }) as unknown as Options;

const existing: DocgenProviderDescriptor[] = [{ moduleSpecifier: '/addon/docgen-worker.js' }];
const docgenServerOn = { experimentalDocgenServer: true };

describe('experimental_docgenProvider', () => {
  it('appends the renderer worker', async () => {
    const descriptors = await experimental_docgenProvider(existing, optionsWith(docgenServerOn));

    expect(descriptors).toHaveLength(2);
    expect(descriptors[0]).toBe(existing[0]);
    expect(descriptors[1].moduleSpecifier).toMatch(/docgen-worker\.js$/);
  });

  it('registers nothing when the docgen server is off', async () => {
    await expect(experimental_docgenProvider(existing, optionsWith())).resolves.toEqual(existing);
  });
});

describe('experimental_manifests', () => {
  const manifests = (features?: Record<string, boolean>) =>
    experimental_manifests({}, optionsWith(features) as never);

  it('declares the server engine', async () => {
    await expect(manifests(docgenServerOn)).resolves.toEqual({
      components: {
        v: 0,
        components: {},
        meta: { docgen: 'vue-component-meta', durationMs: 0 },
      },
    });
  });

  it('contributes nothing when the docgen service is off', async () => {
    await expect(manifests()).resolves.toEqual({});
  });
});
