import { fileURLToPath, pathToFileURL } from 'node:url';

import { createStorybook, type StorybookConfig } from 'storybook/internal/instance';

import type { PluginOption } from 'vite';
import { expect, it } from 'vitest';

import type { StorybookConfig as ReactViteConfig } from '@storybook/react-vite';

const CONFIG_DIR = fileURLToPath(new URL('.', import.meta.url));
const CODE_DIR = fileURLToPath(new URL('../../../../', import.meta.url));
const CASES: Record<string, Partial<StorybookConfig>> = {
  'string entry': { framework: '@storybook/tanstack-react' },
  'builder docgen': {
    framework: '@storybook/tanstack-react',
    features: { docgenServer: false },
    typescript: { reactDocgen: 'react-docgen' } as StorybookConfig['typescript'],
  },
  'framework options': {
    framework: {
      name: '@storybook/tanstack-react',
      options: { strictMode: true, builder: { viteConfigPath: '/project/vite.config.ts' } },
    },
  },
};

it('registers the framework hooks for each main.ts entry', async () => {
  const results: Record<string, unknown> = {};
  for (const [name, main] of Object.entries(CASES)) {
    const storybook = await createStorybook({
      configDir: CONFIG_DIR,
      mode: 'headless',
      main: { ...main, stories: [] },
    });
    try {
      const core = await storybook.callHook('core:config:extend', {});
      results[name] = {
        plugins: storybook.plugins
          .filter((plugin) => plugin.kind !== 'addon')
          .map((plugin) => `${plugin.kind} ${plugin.name}`),
        builder: core.builder,
        renderer: core.renderer,
        framework: await storybook.callHook('core:framework:extend', undefined),
        frameworkOptions: await storybook.callHook('core:framework-options:extend', undefined),
        reactDocgen: (
          (await storybook.callHook('core:typescript:extend', {})) as ReactViteConfig['typescript']
        )?.reactDocgen,
        previewAnnotations: await storybook.callHook('preview:annotations:collect', []),
        optimizeViteDeps: await storybook.callHook('builder:vite-deps:collect', []),
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
        "builder": {
          "name": "file://<code>/builders/builder-vite/dist/index.js",
          "options": {},
        },
        "framework": {
          "name": "@storybook/tanstack-react",
          "options": {},
        },
        "frameworkOptions": {},
        "optimizeViteDeps": [
          "react",
          "react-dom/client",
          "react-dom/test-utils",
          "react/jsx-runtime",
          "@tanstack/react-router > @tanstack/react-store",
          "@tanstack/react-router > @tanstack/react-store > use-sync-external-store/shim/with-selector",
        ],
        "plugins": [
          "builder @storybook/builder-vite",
          "renderer @storybook/react",
          "framework @storybook/tanstack-react",
        ],
        "previewAnnotations": [
          "<code>/renderers/react/dist/entry-preview.js",
          "<code>/renderers/react/dist/entry-preview-argtypes.js",
          "<code>/frameworks/tanstack-react/dist/preview.js",
        ],
        "reactDocgen": "react-docgen",
        "renderer": "file://<code>/renderers/react/dist/node.js",
        "vitePlugins": [
          "storybook:react-docgen-plugin",
          "storybook:tanstack-react:server-code-elimination",
          "storybook:tanstack-react:server-only-stub",
          "storybook:tanstack-react:module-interception",
        ],
      },
      "framework options": {
        "builder": {
          "name": "file://<code>/builders/builder-vite/dist/index.js",
          "options": {
            "viteConfigPath": "/project/vite.config.ts",
          },
        },
        "framework": {
          "name": "@storybook/tanstack-react",
          "options": {
            "builder": {
              "viteConfigPath": "/project/vite.config.ts",
            },
            "strictMode": true,
          },
        },
        "frameworkOptions": {
          "builder": {
            "viteConfigPath": "/project/vite.config.ts",
          },
          "strictMode": true,
        },
        "optimizeViteDeps": [
          "react",
          "react-dom/client",
          "react-dom/test-utils",
          "react/jsx-runtime",
          "@tanstack/react-router > @tanstack/react-store",
          "@tanstack/react-router > @tanstack/react-store > use-sync-external-store/shim/with-selector",
        ],
        "plugins": [
          "builder @storybook/builder-vite",
          "renderer @storybook/react",
          "framework @storybook/tanstack-react",
        ],
        "previewAnnotations": [
          "<code>/renderers/react/dist/entry-preview.js",
          "<code>/renderers/react/dist/entry-preview-argtypes.js",
          "<code>/frameworks/tanstack-react/dist/preview.js",
        ],
        "reactDocgen": "react-docgen",
        "renderer": "file://<code>/renderers/react/dist/node.js",
        "vitePlugins": [
          "storybook:tanstack-react:server-code-elimination",
          "storybook:tanstack-react:server-only-stub",
          "storybook:tanstack-react:module-interception",
        ],
      },
      "string entry": {
        "builder": {
          "name": "file://<code>/builders/builder-vite/dist/index.js",
          "options": {},
        },
        "framework": {
          "name": "@storybook/tanstack-react",
          "options": {},
        },
        "frameworkOptions": {},
        "optimizeViteDeps": [
          "react",
          "react-dom/client",
          "react-dom/test-utils",
          "react/jsx-runtime",
          "@tanstack/react-router > @tanstack/react-store",
          "@tanstack/react-router > @tanstack/react-store > use-sync-external-store/shim/with-selector",
        ],
        "plugins": [
          "builder @storybook/builder-vite",
          "renderer @storybook/react",
          "framework @storybook/tanstack-react",
        ],
        "previewAnnotations": [
          "<code>/renderers/react/dist/entry-preview.js",
          "<code>/renderers/react/dist/entry-preview-argtypes.js",
          "<code>/frameworks/tanstack-react/dist/preview.js",
        ],
        "reactDocgen": "react-docgen",
        "renderer": "file://<code>/renderers/react/dist/node.js",
        "vitePlugins": [
          "storybook:tanstack-react:server-code-elimination",
          "storybook:tanstack-react:server-only-stub",
          "storybook:tanstack-react:module-interception",
        ],
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
