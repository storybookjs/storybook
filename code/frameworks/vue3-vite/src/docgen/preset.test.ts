import { describe, expect, it } from 'vitest';

import type { DocgenProviderDescriptor, Options } from 'storybook/internal/types';

import type { FrameworkOptions } from '../types.ts';
import { experimental_docgenProvider, experimental_manifests } from './preset.ts';

const optionsWith = (docgen?: FrameworkOptions['docgen'], features: Record<string, boolean> = {}) =>
  ({
    presets: {
      apply: async (key: string) => {
        if (key === 'frameworkOptions') {
          return { docgen };
        }
        return key === 'features' ? features : {};
      },
    },
  }) as unknown as Options;

const existing: DocgenProviderDescriptor[] = [{ moduleSpecifier: '/addon/docgen-worker.js' }];
const docgenServerOn = { experimentalDocgenServer: true };
const componentsManifestOn = { ...docgenServerOn, componentsManifest: true };

describe('experimental_docgenProvider', () => {
  it.each(['vue-component-meta' as const, 'vue-docgen-api' as const, undefined, false as const])(
    'appends the renderer worker for legacy docgen: %s',
    async (docgen) => {
      const descriptors = await experimental_docgenProvider(
        existing,
        optionsWith(docgen, docgenServerOn)
      );

      expect(descriptors).toHaveLength(2);
      expect(descriptors[0]).toBe(existing[0]);
      expect(descriptors[1].moduleSpecifier).toMatch(/docgen-worker\.js$/);
    }
  );

  it('registers nothing when the docgen server is off', async () => {
    await expect(
      experimental_docgenProvider(existing, optionsWith('vue-component-meta'))
    ).resolves.toEqual(existing);
  });
});

describe('experimental_manifests', () => {
  const manifests = (docgen?: FrameworkOptions['docgen'], features?: Record<string, boolean>) =>
    experimental_manifests({}, optionsWith(docgen, features) as never);

  it.each(['vue-component-meta' as const, 'vue-docgen-api' as const, undefined, false as const])(
    'declares the server engine for legacy docgen: %s',
    async (docgen) => {
      await expect(manifests(docgen, componentsManifestOn)).resolves.toEqual({
        components: {
          v: 0,
          components: {},
          meta: { docgen: 'vue-component-meta', durationMs: 0 },
        },
      });
    }
  );

  it('contributes nothing when the docgen service is off', async () => {
    await expect(manifests('vue-component-meta')).resolves.toEqual({});
  });
});
