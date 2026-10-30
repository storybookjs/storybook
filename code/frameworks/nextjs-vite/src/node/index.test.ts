import { fileURLToPath, pathToFileURL } from 'node:url';

import { createStorybook, type StorybookConfig } from 'storybook/internal/instance';

import type { PluginOption } from 'vite';
import { expect, it } from 'vitest';

import type { StorybookConfig as ReactViteConfig } from '@storybook/react-vite';

const CONFIG_DIR = fileURLToPath(new URL('.', import.meta.url));
const CODE_DIR = fileURLToPath(new URL('../../../../', import.meta.url));
const CASES: Record<string, Partial<StorybookConfig>> = {
  'string entry': { framework: '@storybook/nextjs-vite' },
  'builder docgen': {
    framework: '@storybook/nextjs-vite',
    features: { docgenServer: false },
    typescript: { reactDocgen: 'react-docgen' } as StorybookConfig['typescript'],
  },
  'framework options': {
    framework: {
      name: '@storybook/nextjs-vite',
      options: {
        image: { excludeFiles: ['**/skip.png'] },
        builder: { viteConfigPath: '/project/vite.config.ts' },
      },
    },
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
                "addons": [
                  "builder @storybook/builder-vite",
                  "renderer @storybook/react",
                  "framework @storybook/nextjs-vite",
                ],
                "framework": {
                  "name": "@storybook/nextjs-vite",
                  "options": {},
                },
                "frameworkOptions": {},
                "optimizeViteDeps": [
                  "react",
                  "react-dom/client",
                  "react-dom/test-utils",
                  "react/jsx-runtime",
                  "@storybook/nextjs-vite/link.mock",
                  "@storybook/nextjs-vite/navigation.mock",
                  "@storybook/nextjs-vite/router.mock",
                  "@storybook/nextjs-vite > styled-jsx",
                  "@storybook/nextjs-vite > styled-jsx/style",
                  "@opentelemetry/api",
                ],
                "previewAnnotations": [
                  "<code>/lib/storybook/dist/features/measure/preview.js",
                  "<code>/lib/storybook/dist/features/backgrounds/preview.js",
                  "<code>/lib/storybook/dist/features/highlight/preview.js",
                  "<code>/lib/storybook/dist/features/outline/preview.js",
                  "<code>/lib/storybook/dist/features/viewport/preview.js",
                  "<code>/lib/storybook/dist/features/actions/preview.js",
                  "<code>/lib/storybook/dist/features/component-testing/preview.js",
                  "<code>/core/dist/test/preview.js",
                  "<code>/core/dist/story-index/ghost-stories/test-annotations.js",
                  "<code>/core/dist/shared/open-service/services/docgen/preview.js",
                  "<code>/core/dist/shared/open-service/services/story-docs/preview.js",
                  "<code>/renderers/react/dist/entry-preview.js",
                  "<code>/renderers/react/dist/entry-preview-argtypes.js",
                  "<code>/frameworks/nextjs-vite/dist/preview.js",
                  "<code>/frameworks/nextjs-vite/dist/config/preview.js",
                ],
                "reactDocgen": "react-docgen",
                "renderer": "file://<code>/renderers/react/dist/node.js",
                "vitePlugins": [
                  "storybook:react-docgen-plugin",
                  "vite-tsconfig-paths",
                  "vite-plugin-storybook-nextjs",
                  "vite-plugin-storybook-nextjs-font",
                  "vite-plugin-storybook-nextjs-swc",
                  "vite-plugin-storybook-nextjs-env",
                  "vite-plugin-storybook-nextjs-image",
                  "vite-plugin-next-mocks",
                  "vite-plugin-storybook-nextjs-dynamic",
                ],
              },
              "framework options": {
                "addons": [
                  "builder @storybook/builder-vite",
                  "renderer @storybook/react",
                  "framework @storybook/nextjs-vite",
                ],
                "framework": {
                  "name": "@storybook/nextjs-vite",
                  "options": {
                    "builder": {
                      "viteConfigPath": "/project/vite.config.ts",
                    },
                    "image": {
                      "excludeFiles": [
                        "**/skip.png",
                      ],
                    },
                  },
                },
                "frameworkOptions": {
                  "builder": {
                    "viteConfigPath": "/project/vite.config.ts",
                  },
                  "image": {
                    "excludeFiles": [
                      "**/skip.png",
                    ],
                  },
                },
                "optimizeViteDeps": [
                  "react",
                  "react-dom/client",
                  "react-dom/test-utils",
                  "react/jsx-runtime",
                  "@storybook/nextjs-vite/link.mock",
                  "@storybook/nextjs-vite/navigation.mock",
                  "@storybook/nextjs-vite/router.mock",
                  "@storybook/nextjs-vite > styled-jsx",
                  "@storybook/nextjs-vite > styled-jsx/style",
                  "@opentelemetry/api",
                ],
                "previewAnnotations": [
                  "<code>/lib/storybook/dist/features/measure/preview.js",
                  "<code>/lib/storybook/dist/features/backgrounds/preview.js",
                  "<code>/lib/storybook/dist/features/highlight/preview.js",
                  "<code>/lib/storybook/dist/features/outline/preview.js",
                  "<code>/lib/storybook/dist/features/viewport/preview.js",
                  "<code>/lib/storybook/dist/features/actions/preview.js",
                  "<code>/lib/storybook/dist/features/component-testing/preview.js",
                  "<code>/core/dist/test/preview.js",
                  "<code>/core/dist/story-index/ghost-stories/test-annotations.js",
                  "<code>/core/dist/shared/open-service/services/docgen/preview.js",
                  "<code>/core/dist/shared/open-service/services/story-docs/preview.js",
                  "<code>/renderers/react/dist/entry-preview.js",
                  "<code>/renderers/react/dist/entry-preview-argtypes.js",
                  "<code>/frameworks/nextjs-vite/dist/preview.js",
                  "<code>/frameworks/nextjs-vite/dist/config/preview.js",
                ],
                "reactDocgen": "react-docgen",
                "renderer": "file://<code>/renderers/react/dist/node.js",
                "vitePlugins": [
                  "vite-tsconfig-paths",
                  "vite-plugin-storybook-nextjs",
                  "vite-plugin-storybook-nextjs-font",
                  "vite-plugin-storybook-nextjs-swc",
                  "vite-plugin-storybook-nextjs-env",
                  "vite-plugin-storybook-nextjs-image",
                  "vite-plugin-next-mocks",
                  "vite-plugin-storybook-nextjs-dynamic",
                ],
              },
              "string entry": {
                "addons": [
                  "builder @storybook/builder-vite",
                  "renderer @storybook/react",
                  "framework @storybook/nextjs-vite",
                ],
                "framework": {
                  "name": "@storybook/nextjs-vite",
                  "options": {},
                },
                "frameworkOptions": {},
                "optimizeViteDeps": [
                  "react",
                  "react-dom/client",
                  "react-dom/test-utils",
                  "react/jsx-runtime",
                  "@storybook/nextjs-vite/link.mock",
                  "@storybook/nextjs-vite/navigation.mock",
                  "@storybook/nextjs-vite/router.mock",
                  "@storybook/nextjs-vite > styled-jsx",
                  "@storybook/nextjs-vite > styled-jsx/style",
                  "@opentelemetry/api",
                ],
                "previewAnnotations": [
                  "<code>/lib/storybook/dist/features/measure/preview.js",
                  "<code>/lib/storybook/dist/features/backgrounds/preview.js",
                  "<code>/lib/storybook/dist/features/highlight/preview.js",
                  "<code>/lib/storybook/dist/features/outline/preview.js",
                  "<code>/lib/storybook/dist/features/viewport/preview.js",
                  "<code>/lib/storybook/dist/features/actions/preview.js",
                  "<code>/lib/storybook/dist/features/component-testing/preview.js",
                  "<code>/core/dist/test/preview.js",
                  "<code>/core/dist/story-index/ghost-stories/test-annotations.js",
                  "<code>/core/dist/shared/open-service/services/docgen/preview.js",
                  "<code>/core/dist/shared/open-service/services/story-docs/preview.js",
                  "<code>/renderers/react/dist/entry-preview.js",
                  "<code>/renderers/react/dist/entry-preview-argtypes.js",
                  "<code>/frameworks/nextjs-vite/dist/preview.js",
                  "<code>/frameworks/nextjs-vite/dist/config/preview.js",
                ],
                "reactDocgen": "react-docgen",
                "renderer": "file://<code>/renderers/react/dist/node.js",
                "vitePlugins": [
                  "vite-tsconfig-paths",
                  "vite-plugin-storybook-nextjs",
                  "vite-plugin-storybook-nextjs-font",
                  "vite-plugin-storybook-nextjs-swc",
                  "vite-plugin-storybook-nextjs-env",
                  "vite-plugin-storybook-nextjs-image",
                  "vite-plugin-next-mocks",
                  "vite-plugin-storybook-nextjs-dynamic",
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
