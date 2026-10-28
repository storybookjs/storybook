import { fileURLToPath, pathToFileURL } from 'node:url';

import { createStorybook, type StorybookConfig } from 'storybook/internal/instance';

import { expect, it } from 'vitest';

const CONFIG_DIR = fileURLToPath(new URL('.', import.meta.url));
const CODE_DIR = fileURLToPath(new URL('../../../../', import.meta.url));
const CASES: Record<string, StorybookConfig['framework']> = {
  'string entry': '@storybook/vue3-vite',
  'docgen disabled': { name: '@storybook/vue3-vite', options: { docgen: false } },
};

it('registers the framework hooks for each main.ts entry', async () => {
  const results: Record<string, unknown> = {};
  for (const [name, framework] of Object.entries(CASES)) {
    const storybook = await createStorybook({
      configDir: CONFIG_DIR,
      mode: 'headless',
      main: { framework, stories: [] },
    });
    try {
      results[name] = {
        plugins: storybook.plugins
          .filter((plugin) => plugin.kind !== 'addon')
          .map((plugin) => `${plugin.kind} ${plugin.name}`),
        renderer: (await storybook.callHook('core:config:extend', {})).renderer,
        framework: await storybook.callHook('core:framework:extend', undefined),
        frameworkOptions: await storybook.callHook('core:framework-options:extend', undefined),
      };
    } finally {
      await storybook.close();
    }
  }
  expect(normalize(results)).toMatchInlineSnapshot(`
    {
      "docgen disabled": {
        "framework": {
          "name": "@storybook/vue3-vite",
          "options": {
            "docgen": false,
          },
        },
        "frameworkOptions": {
          "docgen": false,
        },
        "plugins": [
          "builder @storybook/builder-vite",
          "renderer @storybook/vue3",
          "framework @storybook/vue3-vite",
        ],
        "renderer": "file://<code>/renderers/vue3/dist/node.js",
      },
      "string entry": {
        "framework": {
          "name": "@storybook/vue3-vite",
          "options": {},
        },
        "frameworkOptions": {},
        "plugins": [
          "builder @storybook/builder-vite",
          "renderer @storybook/vue3",
          "framework @storybook/vue3-vite",
        ],
        "renderer": "file://<code>/renderers/vue3/dist/node.js",
      },
    }
  `);
});

/** Replace the checkout path so the snapshot is machine independent. */
function normalize(value: unknown): unknown {
  return JSON.parse(
    JSON.stringify(value)
      .replaceAll(pathToFileURL(CODE_DIR).href, 'file://<code>/')
      .replaceAll(CODE_DIR, '<code>/')
  );
}
