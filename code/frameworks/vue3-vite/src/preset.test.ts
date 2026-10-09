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
      expect(await pluginNames(docgen, { docgenServer: true })).toEqual(['template']);
    }
  );

  it('keeps template compilation when docgen is disabled', async () => {
    expect(await pluginNames(false)).toEqual(['template']);
  });

  it('runs no builder docgen and stays quiet in a test build, which turns the server off', async () => {
    const { viteFinal } = await import('./preset.ts');
    const options = {
      ...optionsWith(undefined, { docgenServer: false }),
      build: { test: { disableDocgen: true } },
    } as Options;

    const config = await viteFinal!({}, options);

    expect((config.plugins ?? []).map((plugin) => (plugin as { name: string }).name)).toEqual([
      'template',
    ]);
    expect(vi.mocked(deprecate)).not.toHaveBeenCalled();
  });
});

describe('builder docgen deprecation', () => {
  it.each([undefined, true as const, 'vue-docgen-api' as const, 'vue-component-meta' as const])(
    'warns for docgen: %s',
    async (docgen) => {
      await pluginNames(docgen);
      expect(vi.mocked(deprecate).mock.calls.map(([message]) => message)).toMatchInlineSnapshot(`
        [
          "Builder docgen (the \`docgen\` option of \`@storybook/vue3-vite\`, with \`vue-docgen-api\` or \`vue-component-meta\`) is deprecated and will be removed in Storybook 12. It runs because \`features.docgenServer\` is off. Server-side docgen needs the \`typescript\` package: install it and remove any \`docgenServer: false\` from your \`.storybook/main.ts\`.",
        ]
      `);
    }
  );

  it.each([
    [false as const, {}],
    [undefined, { docgenServer: true }],
  ])('stays quiet for docgen: %s with features %o', async (docgen, features) => {
    await pluginNames(docgen, features);
    expect(vi.mocked(deprecate)).not.toHaveBeenCalled();
  });
});
