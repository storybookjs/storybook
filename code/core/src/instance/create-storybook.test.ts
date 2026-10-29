import { fileURLToPath } from 'node:url';

import { expect, it, vi } from 'vitest';

import { logger } from '@storybook/core/internal/node-logger';

import { invokeToolsetMethod } from '../shared/open-service/toolset-definition.ts';
import fixtureFramework from './__fixtures__/annotation-order/framework/node.ts';
import dedupeAddon from './__fixtures__/dedupe-addon/node.ts';
import { createStorybook } from './create-storybook.ts';
import { defineAddon, PLUGIN_OPTIONS } from './plugins.ts';
import type { CreateStorybookOptions } from './types.ts';

const CONFIG_DIR = fileURLToPath(new URL('./__fixtures__/first', import.meta.url));
const DEDUPE_ADDON = fileURLToPath(new URL('./__fixtures__/dedupe-addon', import.meta.url));
const HOST_COMMON = defineAddon(() => ({ meta: { name: 'host/common' }, setup(): void {} }))();
const HOST_ADDON = defineAddon(() => ({ meta: { name: 'host/addon' }, setup(): void {} }))();

// The stories path in indexing errors depends on the test runner's cwd.
const toMessage = (error: Error): string =>
  error.message.split('\n')[0].replace(/ \S*first\.stories\.ts$/, ' first.stories.ts');

async function describeInstance(options?: CreateStorybookOptions): Promise<unknown> {
  const storybook = await createStorybook({ configDir: CONFIG_DIR, mode: 'headless' }, options);
  try {
    const index = await storybook.getIndex().then((value) => Object.keys(value.entries), toMessage);
    const docs = storybook.toolsets.values().find((toolset) => toolset.id === 'docs');
    const docsList = docs
      ? await invokeToolsetMethod(
          docs,
          'list',
          {},
          {
            transport: 'sdk',
            getService: storybook.services.get,
          }
        ).then(
          ({ data }) =>
            Object.fromEntries(
              Object.entries(
                (data as { manifests: { componentManifest: { components: object } } }).manifests
                  .componentManifest.components as Record<string, { error?: Error }>
              ).map(([id, entry]) => [id, entry.error?.name ?? 'documented'])
            ),
          toMessage
        )
      : 'no docs toolset';
    return {
      plugins: storybook.plugins.map((plugin) => plugin.name),
      toolsets: storybook.toolsets.values().map((toolset) => toolset.id),
      index,
      docsList,
    };
  } finally {
    await storybook.close();
  }
}

it('fills omitted options with core defaults', async () => {
  const cases: Record<string, CreateStorybookOptions | undefined> = {
    none: undefined,
    'common only': { common: HOST_COMMON },
    'builtInAddons only': { builtInAddons: [HOST_ADDON] },
    both: { common: HOST_COMMON, builtInAddons: [HOST_ADDON] },
  };
  const results: Record<string, unknown> = {};
  for (const [name, options] of Object.entries(cases)) {
    results[name] = await describeInstance(options);
  }
  expect(results).toMatchInlineSnapshot(`
    {
      "both": {
        "docsList": "no docs toolset",
        "index": "Unable to index first.stories.ts",
        "plugins": [
          "@storybook/builder-vite",
          "@storybook/react",
          "@storybook/react-vite",
          "host/addon",
        ],
        "toolsets": [],
      },
      "builtInAddons only": {
        "docsList": "no docs toolset",
        "index": [
          "first--example",
        ],
        "plugins": [
          "@storybook/builder-vite",
          "@storybook/react",
          "@storybook/react-vite",
          "host/addon",
        ],
        "toolsets": [
          "stories",
        ],
      },
      "common only": {
        "docsList": "Unable to index first.stories.ts",
        "index": "Unable to index first.stories.ts",
        "plugins": [
          "@storybook/builder-vite",
          "@storybook/react",
          "@storybook/react-vite",
          "storybook/docgen",
          "storybook/story-docs",
          "storybook/change-detection",
        ],
        "toolsets": [
          "docs",
        ],
      },
      "none": {
        "docsList": {
          "first": "documented",
        },
        "index": [
          "first--example",
        ],
        "plugins": [
          "@storybook/builder-vite",
          "@storybook/react",
          "@storybook/react-vite",
          "storybook/docgen",
          "storybook/story-docs",
          "storybook/change-detection",
        ],
        "toolsets": [
          "docs",
          "stories",
        ],
      },
    }
  `);
});

it('loads string addons with a native entry as plugins, without the legacy adapter', async () => {
  const storybook = await createStorybook({
    configDir: CONFIG_DIR,
    mode: 'headless',
    main: {
      stories: [],
      addons: ['@storybook/addon-themes', { name: '@storybook/addon-links' }],
    },
  });
  try {
    expect(
      storybook.plugins
        .filter((plugin) => plugin.kind === 'addon')
        .map((plugin) => plugin.name)
        .slice(-2)
    ).toMatchInlineSnapshot(`
      [
        "@storybook/addon-themes",
        "@storybook/addon-links",
      ]
    `);
  } finally {
    await storybook.close();
  }
});

it('keeps each instance index isolated within one process', async () => {
  const indexed = await createStorybook({ configDir: CONFIG_DIR, mode: 'headless' });
  const unindexed = await createStorybook(
    { configDir: CONFIG_DIR, mode: 'headless' },
    { common: HOST_COMMON, builtInAddons: [HOST_ADDON] }
  );
  try {
    const results = {
      indexed: await indexed.getIndex().then((value) => Object.keys(value.entries), toMessage),
      unindexed: await unindexed.getIndex().then((value) => Object.keys(value.entries), toMessage),
    };
    expect(results).toMatchInlineSnapshot(`
      {
        "indexed": [
          "first--example",
        ],
        "unindexed": "Unable to index first.stories.ts",
      }
    `);
  } finally {
    await Promise.all([indexed.close(), unindexed.close()]);
  }
});

it.each([
  {
    name: 'the same string twice',
    input: { addons: [DEDUPE_ADDON, DEDUPE_ADDON] },
    expected: { setups: ['addon:fixture-dedupe-addon'], warnings: [] },
  },
  {
    name: 'a string, then a native plugin with options',
    input: { addons: [DEDUPE_ADDON, dedupeAddon({ color: 'red' })] },
    expected: { setups: ['addon:fixture-dedupe-addon {"color":"red"}'], warnings: [] },
  },
  {
    name: 'a native plugin with options, then a string',
    input: { addons: [dedupeAddon({ color: 'red' }), DEDUPE_ADDON] },
    expected: { setups: ['addon:fixture-dedupe-addon {"color":"red"}'], warnings: [] },
  },
  {
    name: 'an entry with options, then a string',
    input: { addons: [{ name: DEDUPE_ADDON, options: { color: 'red' } }, DEDUPE_ADDON] },
    expected: { setups: ['addon:fixture-dedupe-addon {"color":"red"}'], warnings: [] },
  },
  {
    name: 'two native plugins with equal options',
    input: { addons: [dedupeAddon({ color: 'red' }), dedupeAddon({ color: 'red' })] },
    expected: { setups: ['addon:fixture-dedupe-addon {"color":"red"}'], warnings: [] },
  },
  {
    name: 'two native plugins with different options',
    input: { addons: [dedupeAddon({ color: 'red' }), dedupeAddon({ color: 'blue' })] },
    expected: {
      setups: ['addon:fixture-dedupe-addon {"color":"red"}'],
      warnings: [
        '"fixture-dedupe-addon" is configured more than once with different options; using the first.',
      ],
    },
  },
  {
    name: 'a deprecated preset specifier and its package',
    input: { addons: ['@storybook/addon-themes/preset', '@storybook/addon-themes'] },
    expected: { setups: ['addon:@storybook/addon-themes'], warnings: [] },
  },
  {
    name: 'a built-in addon listed in main',
    input: { builtInAddons: [dedupeAddon()], addons: [DEDUPE_ADDON] },
    expected: { setups: ['addon:fixture-dedupe-addon'], warnings: [] },
  },
  {
    name: 'a framework addon listed in main with options',
    input: {
      framework: { ...fixtureFramework(), addons: [dedupeAddon()] },
      addons: [dedupeAddon({ color: 'red' })],
    },
    expected: {
      setups: [
        'builder:fixture-annotation-builder',
        'renderer:fixture-annotation-renderer',
        'addon:fixture-dedupe-addon {"color":"red"}',
        'framework:fixture-annotation-framework',
      ],
      warnings: [],
    },
  },
])('sets a plugin up once for $name', async ({ input, expected }) => {
  const warn = vi.spyOn(logger, 'warn');
  const setups: string[] = [];
  const { builtInAddons = [], ...main } = input as typeof input & {
    builtInAddons?: CreateStorybookOptions['builtInAddons'];
  };
  const storybook = await createStorybook(
    { configDir: CONFIG_DIR, mode: 'headless', main: { stories: [], ...main } },
    {
      builtInAddons,
      setupPlugin(plugin): void {
        const options = (plugin as { [PLUGIN_OPTIONS]?: unknown })[PLUGIN_OPTIONS];
        setups.push(
          `${plugin.meta.kind}:${plugin.meta.name}${options ? ` ${JSON.stringify(options)}` : ''}`
        );
      },
    }
  );
  try {
    expect({
      setups,
      warnings: warn.mock.calls
        .map(([message]) => String(message))
        .filter((message) => message.includes('configured more than once')),
    }).toEqual(expected);
  } finally {
    warn.mockRestore();
    await storybook.close();
  }
});
