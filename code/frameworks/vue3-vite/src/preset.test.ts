import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Options } from 'storybook/internal/types';

import { vueComponentMeta } from './plugins/vue-component-meta.ts';
import { vueDocgen } from './plugins/vue-docgen.ts';
import { templateCompilation } from './plugins/vue-template.ts';
import type { FrameworkOptions } from './types.ts';

// The real plugin factories build a vue-component-meta checker / vue-docgen-api parser, which is
// far too heavy for a preset test. Identify them by name instead.
vi.mock('./plugins/vue-template.ts', { spy: true });
vi.mock('./plugins/vue-component-meta.ts', { spy: true });
vi.mock('./plugins/vue-docgen.ts', { spy: true });

beforeEach(() => {
  vi.mocked(templateCompilation).mockResolvedValue({ name: 'template' });
  vi.mocked(vueComponentMeta).mockResolvedValue({ name: 'vue-component-meta' });
  vi.mocked(vueDocgen).mockResolvedValue({ name: 'vue-docgen-api' });
});

const optionsWith = (docgen: FrameworkOptions['docgen'], features: Record<string, boolean> = {}) =>
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

const pluginNames = async (
  docgen: FrameworkOptions['docgen'],
  features?: Record<string, boolean>
) => {
  const { viteFinal } = await import('./preset.ts');
  const config = await viteFinal!({}, optionsWith(docgen, features));
  return (config.plugins ?? []).map((plugin) => (plugin as { name: string }).name);
};

describe('viteFinal', () => {
  it.each([
    ['vue-component-meta' as const, 'vue-component-meta'],
    [undefined, 'vue-docgen-api'],
  ])('adds the %s docgen plugin when the docgen service is off', async (docgen, expected) => {
    expect(await pluginNames(docgen)).toEqual(['template', expected]);
  });

  // The service extracts the same metadata, so leaving the plugin on would compile every component
  // twice and put a `__docgenInfo` in the preview bundle that nothing reads.
  it('omits the vue-component-meta plugin when the docgen service is on', async () => {
    expect(await pluginNames('vue-component-meta', { experimentalDocgenServer: true })).toEqual([
      'template',
    ]);
  });

  // vue-docgen-api has no worker-side extractor, so the feature flag must not strip its plugin —
  // that would leave these projects with no docgen at all.
  it.each(['vue-docgen-api' as const, undefined])(
    'keeps the docgen plugin for docgen: %s even when the docgen service is on',
    async (docgen) => {
      expect(await pluginNames(docgen, { experimentalDocgenServer: true })).toEqual([
        'template',
        'vue-docgen-api',
      ]);
    }
  );

  it('keeps template compilation when docgen is disabled', async () => {
    expect(await pluginNames(false)).toEqual(['template']);
  });
});
