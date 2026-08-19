import { beforeEach, describe, expect, it, vi } from 'vitest';

import { deprecate } from 'storybook/internal/node-logger';

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

vi.mock('storybook/internal/node-logger', { spy: true });

beforeEach(() => {
  vi.mocked(deprecate).mockImplementation(() => {});
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

  it.each(['vue-component-meta' as const, 'vue-docgen-api' as const, undefined, false as const])(
    'omits the legacy docgen plugin for docgen: %s when the server is on',
    async (docgen) => {
      expect(await pluginNames(docgen, { experimentalDocgenServer: true })).toEqual(['template']);
    }
  );

  it('keeps template compilation when docgen is disabled', async () => {
    expect(await pluginNames(false)).toEqual(['template']);
  });
});

describe('vue-docgen-api deprecation', () => {
  it.each([undefined, true as const, 'vue-docgen-api' as const])(
    'warns for docgen: %s',
    async (docgen) => {
      await pluginNames(docgen);
      expect(vi.mocked(deprecate).mock.calls.map(([message]) => message)).toMatchInlineSnapshot(`
        [
          "\`vue-docgen-api\` is deprecated and will be removed in the next major release of Storybook. It is still the default docgen engine, so this also applies when you have not set the \`docgen\` framework option. Enable server-side docgen with \`features: { experimentalDocgenServer: true }\` in your \`.storybook/main.ts\`, which becomes the default in Storybook 11, or set \`framework: { name: '@storybook/vue3-vite', options: { docgen: 'vue-component-meta' } }\` to keep docgen in the builder.",
        ]
      `);
    }
  );

  it.each([
    ['vue-component-meta' as const, {}],
    [false as const, {}],
    [undefined, { experimentalDocgenServer: true }],
  ])('stays quiet for docgen: %s with features %o', async (docgen, features) => {
    await pluginNames(docgen, features);
    expect(vi.mocked(deprecate)).not.toHaveBeenCalled();
  });
});
