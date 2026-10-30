import { fileURLToPath, pathToFileURL } from 'node:url';

import { createStorybook, type StorybookConfig } from 'storybook/internal/instance';

import type { PluginOption } from 'vite';
import { expect, it } from 'vitest';

import type { StorybookConfig as ReactViteConfig } from '../types.ts';

const CONFIG_DIR = fileURLToPath(new URL('.', import.meta.url));
const CODE_DIR = fileURLToPath(new URL('../../../../', import.meta.url));
const CASES: Record<string, Partial<StorybookConfig>> = {
  'server docgen': { framework: '@storybook/react-vite' },
  'builder docgen': {
    framework: '@storybook/react-vite',
    features: { docgenServer: false },
    typescript: { reactDocgen: 'react-docgen' } as StorybookConfig['typescript'],
  },
  // Builder plugins go, the typescript options component tests extract argTypes with stay.
  'builder docgen off': {
    framework: '@storybook/react-vite',
    features: { docgenServer: false },
    typescript: { reactDocgen: 'react-docgen' } as StorybookConfig['typescript'],
    docs: { builderDocgen: false },
  },
  'docgen option': {
    framework: { name: '@storybook/react-vite', options: { docgen: 'react-docgen-typescript' } },
    features: { docgenServer: false },
  },
};

it('registers the framework hooks for each main.ts entry', async () => {
  const results: Record<string, unknown> = {};
  for (const [name, main] of Object.entries(CASES)) {
    const storybook = createStorybook({
      configDir: CONFIG_DIR,
      mode: 'headless',
      main: { ...main, stories: [] },
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
        reactDocgen: (
          (await storybook.callHook('core:typescript:extend', {})) as ReactViteConfig['typescript']
        )?.reactDocgen,
        vitePlugins: await pluginNames(
          (await storybook.callHook('builder:vite:extend', {})).plugins
        ),
      };
    } finally {
      await storybook.close();
    }
  }
  expect(normalize(results)).toMatchInlineSnapshot(`
    {
      "builder docgen": {
        "addons": [
          "builder @storybook/builder-vite",
          "renderer @storybook/react",
          "framework @storybook/react-vite",
        ],
        "framework": {
          "name": "@storybook/react-vite",
          "options": {},
        },
        "frameworkOptions": {},
        "reactDocgen": "react-docgen",
        "renderer": "file://<code>/renderers/react/dist/node.js",
        "vitePlugins": [
          "storybook:react-docgen-plugin",
        ],
      },
      "builder docgen off": {
        "addons": [
          "builder @storybook/builder-vite",
          "renderer @storybook/react",
          "framework @storybook/react-vite",
        ],
        "framework": {
          "name": "@storybook/react-vite",
          "options": {},
        },
        "frameworkOptions": {},
        "reactDocgen": "react-docgen",
        "renderer": "file://<code>/renderers/react/dist/node.js",
        "vitePlugins": [],
      },
      "docgen option": {
        "addons": [
          "builder @storybook/builder-vite",
          "renderer @storybook/react",
          "framework @storybook/react-vite",
        ],
        "framework": {
          "name": "@storybook/react-vite",
          "options": {
            "docgen": "react-docgen-typescript",
          },
        },
        "frameworkOptions": {
          "docgen": "react-docgen-typescript",
        },
        "reactDocgen": "react-docgen-typescript",
        "renderer": "file://<code>/renderers/react/dist/node.js",
        "vitePlugins": [
          "storybook:react-docgen-plugin",
          "vite:react-docgen-typescript",
        ],
      },
      "server docgen": {
        "addons": [
          "builder @storybook/builder-vite",
          "renderer @storybook/react",
          "framework @storybook/react-vite",
        ],
        "framework": {
          "name": "@storybook/react-vite",
          "options": {},
        },
        "frameworkOptions": {},
        "reactDocgen": "react-docgen",
        "renderer": "file://<code>/renderers/react/dist/node.js",
        "vitePlugins": [],
      },
    }
  `);
});

async function pluginNames(options: PluginOption[] = []): Promise<string[]> {
  const names: string[] = [];
  for (const option of options) {
    const plugin = await option;
    if (Array.isArray(plugin)) {
      names.push(...(await pluginNames(plugin)));
    } else if (plugin) {
      names.push(plugin.name);
    }
  }
  return names;
}

/** Replace the checkout path so the snapshot is machine independent. */
function normalize(value: unknown): unknown {
  return JSON.parse(
    JSON.stringify(value)
      .replaceAll(pathToFileURL(CODE_DIR).href, 'file://<code>/')
      .replaceAll(CODE_DIR, '<code>/')
  );
}
