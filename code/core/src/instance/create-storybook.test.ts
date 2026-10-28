import { fileURLToPath } from 'node:url';

import { expect, it } from 'vitest';

import { invokeToolsetMethod } from '../shared/open-service/toolset-definition.ts';
import { createStorybook } from './create-storybook.ts';
import { defineAddon } from './plugins.ts';
import type { CreateStorybookOptions } from './types.ts';

const CONFIG_DIR = fileURLToPath(new URL('./__fixtures__/first', import.meta.url));
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
          "review",
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
        ],
        "toolsets": [
          "docs",
          "stories",
          "review",
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
