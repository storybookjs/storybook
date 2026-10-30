import { fileURLToPath, pathToFileURL } from 'node:url';

import { createStorybook, type StorybookConfig } from 'storybook/internal/instance';

import { expect, it } from 'vitest';

const CONFIG_DIR = fileURLToPath(new URL('.', import.meta.url));
const CODE_DIR = fileURLToPath(new URL('../../../../', import.meta.url));
const CASES: Record<string, StorybookConfig['framework']> = {
  'string entry': '@storybook/html-vite',
  'builder options': {
    name: '@storybook/html-vite',
    options: { builder: { viteConfigPath: 'custom.ts' } },
  },
};

it('registers the framework hooks for each main.ts entry', async () => {
  const results: Record<string, unknown> = {};
  for (const [name, framework] of Object.entries(CASES)) {
    const storybook = createStorybook({
      configDir: CONFIG_DIR,
      mode: 'headless',
      main: { framework, stories: [] },
    });
    await storybook.ready();
    try {
      results[name] = {
        addons: storybook.addons
          .filter((addon) => addon.kind !== 'addon')
          .map((addon) => `${addon.kind} ${addon.name}`),
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
      "builder options": {
        "addons": [
          "builder @storybook/builder-vite",
          "renderer @storybook/html",
          "framework @storybook/html-vite",
        ],
        "framework": {
          "name": "@storybook/html-vite",
          "options": {
            "builder": {
              "viteConfigPath": "custom.ts",
            },
          },
        },
        "frameworkOptions": {
          "builder": {
            "viteConfigPath": "custom.ts",
          },
        },
        "renderer": "file://<code>/renderers/html/dist/node.js",
      },
      "string entry": {
        "addons": [
          "builder @storybook/builder-vite",
          "renderer @storybook/html",
          "framework @storybook/html-vite",
        ],
        "framework": {
          "name": "@storybook/html-vite",
          "options": {},
        },
        "frameworkOptions": {},
        "renderer": "file://<code>/renderers/html/dist/node.js",
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
