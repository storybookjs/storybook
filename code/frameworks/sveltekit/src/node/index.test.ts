import { fileURLToPath, pathToFileURL } from 'node:url';

import { createStorybook, type StorybookConfig } from 'storybook/internal/instance';

import type { PluginOption } from 'vite';
import { expect, it } from 'vitest';

// The fixture project has a `static` directory beside its config directory.
const CONFIG_DIR = fileURLToPath(new URL('../__fixtures__/project/.storybook', import.meta.url));
const CODE_DIR = fileURLToPath(new URL('../../../../', import.meta.url));
const CASES: Record<
  string,
  { mode: 'headless' | 'build'; framework: StorybookConfig['framework'] }
> = {
  development: { mode: 'headless', framework: '@storybook/sveltekit' },
  production: { mode: 'build', framework: '@storybook/sveltekit' },
  'docgen disabled': {
    mode: 'headless',
    framework: { name: '@storybook/sveltekit', options: { docgen: false } },
  },
};

it('registers the framework hooks for each main.ts entry', async () => {
  const results: Record<string, unknown> = {};
  for (const [name, { mode, framework }] of Object.entries(CASES)) {
    const storybook = createStorybook({
      configDir: CONFIG_DIR,
      mode,
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
        previewAnnotations: await storybook.callHook('preview:annotations:collect', []),
        staticDirs: await storybook.callHook('core:static-dirs:collect', []),
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
      "development": {
        "addons": [
          "builder @storybook/builder-vite",
          "renderer @storybook/svelte",
          "framework @storybook/sveltekit",
        ],
        "framework": {
          "name": "@storybook/sveltekit",
          "options": {},
        },
        "frameworkOptions": {},
        "optimizeViteDeps": [
          "@storybook/sveltekit/internal/mocks/app/forms",
          "@storybook/sveltekit/internal/mocks/app/navigation",
          "@storybook/sveltekit/internal/mocks/app/state.svelte.js",
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
          "<code>/renderers/svelte/dist/entry-preview.js",
          "<code>/frameworks/sveltekit/dist/preview.js",
        ],
        "renderer": "file://<code>/renderers/svelte/dist/node.js",
        "staticDirs": [
          {
            "from": "<code>/core/assets/browser",
            "to": "/sb-common-assets",
          },
        ],
        "vitePlugins": [
          "storybook:svelte-docgen-plugin",
          "storybook:svelte-csf",
          "storybook:sveltekit-overrides",
          "storybook:sveltekit-sync",
          "storybook:sveltekit-dev-public-env",
          "storybook:sveltekit-mock-modules",
          "storybook:sveltekit-guard-server-modules",
        ],
      },
      "docgen disabled": {
        "addons": [
          "builder @storybook/builder-vite",
          "renderer @storybook/svelte",
          "framework @storybook/sveltekit",
        ],
        "framework": {
          "name": "@storybook/sveltekit",
          "options": {
            "docgen": false,
          },
        },
        "frameworkOptions": {
          "docgen": false,
        },
        "optimizeViteDeps": [
          "@storybook/sveltekit/internal/mocks/app/forms",
          "@storybook/sveltekit/internal/mocks/app/navigation",
          "@storybook/sveltekit/internal/mocks/app/state.svelte.js",
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
          "<code>/renderers/svelte/dist/entry-preview.js",
          "<code>/frameworks/sveltekit/dist/preview.js",
        ],
        "renderer": "file://<code>/renderers/svelte/dist/node.js",
        "staticDirs": [
          {
            "from": "<code>/core/assets/browser",
            "to": "/sb-common-assets",
          },
        ],
        "vitePlugins": [
          "storybook:svelte-csf",
          "storybook:sveltekit-overrides",
          "storybook:sveltekit-sync",
          "storybook:sveltekit-dev-public-env",
          "storybook:sveltekit-mock-modules",
          "storybook:sveltekit-guard-server-modules",
        ],
      },
      "production": {
        "addons": [
          "builder @storybook/builder-vite",
          "renderer @storybook/svelte",
          "framework @storybook/sveltekit",
        ],
        "framework": {
          "name": "@storybook/sveltekit",
          "options": {},
        },
        "frameworkOptions": {},
        "optimizeViteDeps": [
          "@storybook/sveltekit/internal/mocks/app/forms",
          "@storybook/sveltekit/internal/mocks/app/navigation",
          "@storybook/sveltekit/internal/mocks/app/state.svelte.js",
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
          "<code>/renderers/svelte/dist/entry-preview.js",
          "<code>/frameworks/sveltekit/dist/preview.js",
        ],
        "renderer": "file://<code>/renderers/svelte/dist/node.js",
        "staticDirs": [
          {
            "from": "<code>/core/assets/browser",
            "to": "/sb-common-assets",
          },
          {
            "from": "<code>/frameworks/sveltekit/src/__fixtures__/project/static",
            "to": "/",
          },
        ],
        "vitePlugins": [
          "storybook:svelte-docgen-plugin",
          "storybook:svelte-csf",
          "storybook:sveltekit-overrides",
          "storybook:sveltekit-sync",
          "storybook:sveltekit-dev-public-env",
          "storybook:sveltekit-mock-modules",
          "storybook:sveltekit-guard-server-modules",
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
