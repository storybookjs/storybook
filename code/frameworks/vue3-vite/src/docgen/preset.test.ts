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
  it('appends a descriptor pointing at the renderer worker module', async () => {
    const descriptors = await experimental_docgenProvider(
      existing,
      optionsWith('vue-component-meta', docgenServerOn)
    );

    expect(descriptors).toHaveLength(2);
    // Appended, so addon providers stack on top of ours rather than replacing it.
    expect(descriptors[0]).toBe(existing[0]);
    expect(descriptors[1].moduleSpecifier).toMatch(/docgen-worker\.js$/);
  });

  // The worker extracts with vue-component-meta only. Registering for vue-docgen-api would
  // silently swap the engine the project asked for; `docgen: false` opted out of extraction
  // altogether and must stay opted out.
  it.each(['vue-docgen-api' as const, undefined, false as const])(
    'registers nothing for docgen: %s',
    async (docgen) => {
      await expect(
        experimental_docgenProvider(existing, optionsWith(docgen, docgenServerOn))
      ).resolves.toEqual(existing);
    }
  );
});

describe('experimental_manifests', () => {
  const manifests = (docgen?: FrameworkOptions['docgen'], features?: Record<string, boolean>) =>
    experimental_manifests({}, optionsWith(docgen, features) as never);

  // Core asserts `components.meta.docgen` is present whenever the feature is on, so omitting it
  // fails a Vue `storybook build` outright rather than degrading the debugger.
  it('declares the engine so core can label the components debugger', async () => {
    await expect(manifests('vue-component-meta', componentsManifestOn)).resolves.toEqual({
      components: { v: 0, components: {}, meta: { docgen: 'vue-component-meta', durationMs: 0 } },
    });
  });

  it.each(['vue-docgen-api' as const, undefined, false as const])(
    'rejects the components manifest for docgen: %s',
    async (docgen) => {
      await expect(manifests(docgen, componentsManifestOn)).rejects.toThrow(
        "The Vue docgen manifest currently requires `docgen: 'vue-component-meta'` in `framework.options`."
      );
    }
  );

  // The manifest is populated from docgen-service payloads. When another engine (or none) runs,
  // there are no payloads, so claiming an engine here would report "0 components" against it.
  it.each(['vue-docgen-api' as const, undefined, false as const])(
    'contributes nothing for docgen: %s',
    async (docgen) => {
      await expect(manifests(docgen, docgenServerOn)).resolves.toEqual({});
    }
  );

  // Vue has no legacy component manifest, so with the feature off there is nothing to contribute.
  it('contributes nothing when the docgen service is off', async () => {
    await expect(manifests('vue-component-meta')).resolves.toEqual({});
  });
});
