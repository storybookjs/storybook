import { fileURLToPath } from 'node:url';

import { createStorybook, type StorybookConfig } from 'storybook/internal/instance';

import { expect, it, vi } from 'vitest';

import webpack, { type Configuration } from 'webpack';

import { nextjs } from './index.ts';

vi.mock('@storybook/core/internal/node-logger', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  deprecate: vi.fn(),
}));

const CONFIG_DIR = fileURLToPath(
  new URL('../../../../core/src/instance/__fixtures__/first', import.meta.url)
);
const CODE_DIR = fileURLToPath(new URL('../../../../', import.meta.url));
const ROOT_DIR = fileURLToPath(new URL('../../../../../', import.meta.url));

const CASES: Record<string, Partial<StorybookConfig>> = {
  'server docgen': { framework: '@storybook/nextjs' },
  'builder docgen': {
    framework: nextjs(),
    features: { docgenServer: false },
    typescript: { reactDocgen: 'react-docgen' } as StorybookConfig['typescript'],
  },
  RSC: { framework: nextjs(), features: { experimentalRSC: true } },
  'framework options': {
    framework: { name: '@storybook/nextjs', options: { builder: { fsCache: true } } },
  },
};

it('registers the framework hooks', async () => {
  const results: Record<string, unknown> = {};
  for (const [name, main] of Object.entries(CASES)) {
    const storybook = await createStorybook({
      configDir: CONFIG_DIR,
      mode: 'headless',
      main: { ...main, stories: [] },
    });
    try {
      const ctx = { webpackInstance: webpack, configType: 'DEVELOPMENT' as const };
      const seed = () => ({ module: { rules: [] }, plugins: [], resolve: { alias: {} } });
      results[name] = summarize({
        plugins: storybook.plugins
          .filter(({ name }) => !name.startsWith('storybook/'))
          .map(({ kind, name }) => `${kind} ${name}`),
        core: (({ builder, renderer }) => ({ builder, renderer }))(
          await storybook.callHook('core:config:extend', {})
        ),
        framework: await storybook.callHook('core:framework:extend', ''),
        previewAnnotations: await storybook.callHook('preview:annotations:collect', []),
        babelPresets: ((await storybook.callHook('builder:babel:extend', {})).presets as unknown[])
          ?.length,
        webpackFinal: summarizeWebpack(
          (await storybook.callHook('builder:webpack:extend', seed(), ctx)) as Configuration
        ),
      });
    } finally {
      await storybook.close();
    }
  }
  expect(results).toMatchInlineSnapshot(`
        {
          "RSC": {
            "babelPresets": 1,
            "core": {
              "builder": {
                "name": "<code>/builders/builder-webpack5/dist/index.js",
                "options": {},
              },
              "renderer": "<code>/renderers/react/dist/node.js",
            },
            "framework": {
              "name": "@storybook/nextjs",
              "options": {},
            },
            "plugins": [
              "builder @storybook/builder-webpack5",
              "renderer @storybook/react",
              "addon @storybook/preset-react-webpack",
              "framework @storybook/nextjs",
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
              "<code>/renderers/react/dist/entry-preview-rsc.js",
              "<code>/frameworks/nextjs/dist/preview.js",
              "<code>/frameworks/nextjs/dist/config/preview.js",
            ],
            "webpackFinal": {
              "alias": [
                "@opentelemetry/api",
                "next",
                "next/cache",
                "next/config",
                "next/dist/shared/lib/app-router-context",
                "next/dist/shared/lib/app-router-context.shared-runtime",
                "next/headers",
                "next/image",
                "next/legacy/image",
                "next/link",
                "next/navigation",
                "next/router",
                "react",
                "react-dom$",
                "react-dom/client",
                "react-dom/server",
                "react-dom/test-utils",
                "sb-original/next/image",
                "sb-original/next/legacy/image",
                "server-only$",
                "styled-jsx",
              ],
              "plugins": [
                "DefinePlugin",
                "DefinePlugin",
                "NormalModuleReplacementPlugin",
                "ProvidePlugin",
                "ReactRefreshPlugin",
              ],
              "rules": [
                "/next(\\\\|\\/|\\\\\\\\).*(\\\\|\\/|\\\\\\\\)target\\.css$/",
                "/\\.(scss|sass)$/",
                "/\\.((c|m)?(j|t)sx?)$/",
              ],
            },
          },
          "builder docgen": {
            "babelPresets": 1,
            "core": {
              "builder": {
                "name": "<code>/builders/builder-webpack5/dist/index.js",
                "options": {},
              },
              "renderer": "<code>/renderers/react/dist/node.js",
            },
            "framework": {
              "name": "@storybook/nextjs",
              "options": {},
            },
            "plugins": [
              "builder @storybook/builder-webpack5",
              "renderer @storybook/react",
              "addon @storybook/preset-react-webpack",
              "framework @storybook/nextjs",
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
              "<code>/frameworks/nextjs/dist/preview.js",
              "<code>/frameworks/nextjs/dist/config/preview.js",
            ],
            "webpackFinal": {
              "alias": [
                "@opentelemetry/api",
                "next",
                "next/cache",
                "next/config",
                "next/dist/shared/lib/app-router-context",
                "next/dist/shared/lib/app-router-context.shared-runtime",
                "next/headers",
                "next/image",
                "next/legacy/image",
                "next/link",
                "next/navigation",
                "next/router",
                "react",
                "react-dom$",
                "react-dom/client",
                "react-dom/server",
                "react-dom/test-utils",
                "sb-original/next/image",
                "sb-original/next/legacy/image",
                "styled-jsx",
              ],
              "plugins": [
                "DefinePlugin",
                "DefinePlugin",
                "NormalModuleReplacementPlugin",
                "ProvidePlugin",
                "ReactRefreshPlugin",
              ],
              "rules": [
                "/\\.(cjs|mjs|tsx?|jsx?)$/",
                "/next(\\\\|\\/|\\\\\\\\).*(\\\\|\\/|\\\\\\\\)target\\.css$/",
                "/\\.(scss|sass)$/",
                "/\\.((c|m)?(j|t)sx?)$/",
              ],
            },
          },
          "framework options": {
            "babelPresets": 1,
            "core": {
              "builder": {
                "name": "<code>/builders/builder-webpack5/dist/index.js",
                "options": {
                  "fsCache": true,
                },
              },
              "renderer": "<code>/renderers/react/dist/node.js",
            },
            "framework": {
              "name": "@storybook/nextjs",
              "options": {
                "builder": {
                  "fsCache": true,
                },
              },
            },
            "plugins": [
              "builder @storybook/builder-webpack5",
              "renderer @storybook/react",
              "addon @storybook/preset-react-webpack",
              "framework @storybook/nextjs",
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
              "<code>/frameworks/nextjs/dist/preview.js",
              "<code>/frameworks/nextjs/dist/config/preview.js",
            ],
            "webpackFinal": {
              "alias": [
                "@opentelemetry/api",
                "next",
                "next/cache",
                "next/config",
                "next/dist/shared/lib/app-router-context",
                "next/dist/shared/lib/app-router-context.shared-runtime",
                "next/headers",
                "next/image",
                "next/legacy/image",
                "next/link",
                "next/navigation",
                "next/router",
                "react",
                "react-dom$",
                "react-dom/client",
                "react-dom/server",
                "react-dom/test-utils",
                "sb-original/next/image",
                "sb-original/next/legacy/image",
                "styled-jsx",
              ],
              "plugins": [
                "DefinePlugin",
                "DefinePlugin",
                "NormalModuleReplacementPlugin",
                "ProvidePlugin",
                "ReactRefreshPlugin",
              ],
              "rules": [
                "/next(\\\\|\\/|\\\\\\\\).*(\\\\|\\/|\\\\\\\\)target\\.css$/",
                "/\\.(scss|sass)$/",
                "/\\.((c|m)?(j|t)sx?)$/",
              ],
            },
          },
          "server docgen": {
            "babelPresets": 1,
            "core": {
              "builder": {
                "name": "<code>/builders/builder-webpack5/dist/index.js",
                "options": {},
              },
              "renderer": "<code>/renderers/react/dist/node.js",
            },
            "framework": {
              "name": "@storybook/nextjs",
              "options": {},
            },
            "plugins": [
              "builder @storybook/builder-webpack5",
              "renderer @storybook/react",
              "addon @storybook/preset-react-webpack",
              "framework @storybook/nextjs",
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
              "<code>/frameworks/nextjs/dist/preview.js",
              "<code>/frameworks/nextjs/dist/config/preview.js",
            ],
            "webpackFinal": {
              "alias": [
                "@opentelemetry/api",
                "next",
                "next/cache",
                "next/config",
                "next/dist/shared/lib/app-router-context",
                "next/dist/shared/lib/app-router-context.shared-runtime",
                "next/headers",
                "next/image",
                "next/legacy/image",
                "next/link",
                "next/navigation",
                "next/router",
                "react",
                "react-dom$",
                "react-dom/client",
                "react-dom/server",
                "react-dom/test-utils",
                "sb-original/next/image",
                "sb-original/next/legacy/image",
                "styled-jsx",
              ],
              "plugins": [
                "DefinePlugin",
                "DefinePlugin",
                "NormalModuleReplacementPlugin",
                "ProvidePlugin",
                "ReactRefreshPlugin",
              ],
              "rules": [
                "/next(\\\\|\\/|\\\\\\\\).*(\\\\|\\/|\\\\\\\\)target\\.css$/",
                "/\\.(scss|sass)$/",
                "/\\.((c|m)?(j|t)sx?)$/",
              ],
            },
          },
        }
      `);
});

/** Keep the parts of a Webpack config that the framework contributes, in a readable form. */
function summarizeWebpack(config: Configuration): unknown {
  return {
    rules: (config.module?.rules ?? []).map((rule) =>
      rule && typeof rule === 'object' ? String(rule.test ?? rule.oneOf?.length) : rule
    ),
    alias: Object.keys(config.resolve?.alias ?? {}).sort(),
    plugins: (config.plugins ?? []).map((plugin) => plugin?.constructor.name),
  };
}

/** Replace absolute paths and class instances so the snapshot is machine independent. */
function summarize(value: unknown): unknown {
  if (typeof value === 'string') {
    return value
      .replace(`file://${CODE_DIR}`, '<code>/')
      .replace(CODE_DIR, '<code>/')
      .replace(ROOT_DIR, '<root>/');
  }
  if (typeof value === 'function') {
    return '[Function]';
  }
  if (value === null || typeof value !== 'object' || value instanceof RegExp) {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(summarize);
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    return `[${value.constructor.name}]`;
  }
  return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, summarize(entry)]));
}
