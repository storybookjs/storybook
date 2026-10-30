import { fileURLToPath } from 'node:url';

import {
  createStorybook,
  type CreateStorybookInput,
  type StorybookConfig,
} from 'storybook/internal/instance';

import { expect, it, vi } from 'vitest';

import type { Configuration } from 'webpack';

import { angular } from './index.ts';

// The Angular test setup loads zone.js, which crashes on the TypeScript loader thread's messages.
// Every module this test imports is compiled JavaScript, so the loader is not needed.
vi.mock('node:module', async (importOriginal) => {
  const original = await importOriginal<typeof import('node:module')>();
  const register = (): void => {};
  return { ...original, register, default: { ...original, register } };
});

const CONFIG_DIR = fileURLToPath(
  new URL('../../../../core/src/instance/__fixtures__/first', import.meta.url)
);
const CODE_DIR = fileURLToPath(new URL('../../../../', import.meta.url));
const WEBPACK_CONFIG = (): Configuration => ({
  entry: [],
  resolve: { modules: [] },
  module: { rules: [] },
  plugins: [],
});

const CASES: Record<
  string,
  { framework: StorybookConfig['framework']; cliOptions?: Record<string, unknown> }
> = {
  // Without the Angular builders, the CLI config refuses to build.
  defaults: { framework: '@storybook/angular' },
  // The Angular builders pass these; `null` means "started by a builder without a browser target".
  'builder options': {
    framework: '@storybook/angular',
    cliOptions: { enableProdMode: true, angularBrowserTarget: null },
  },
  'Ivy off': { framework: angular({ enableIvy: false }) },
};

it('registers the framework hooks', async () => {
  const results: Record<string, unknown> = {};
  for (const [name, { framework, cliOptions }] of Object.entries(CASES)) {
    const storybook = createStorybook({
      configDir: CONFIG_DIR,
      mode: 'headless',
      main: { framework, stories: [] },
      cliOptions: cliOptions as CreateStorybookInput['cliOptions'],
    });
    await storybook.ready();
    try {
      const ctx = { ...cliOptions, configType: 'DEVELOPMENT', configDir: CONFIG_DIR } as never;
      results[name] = summarize({
        addons: storybook.addons
          .filter(({ name }) => !name.startsWith('storybook/'))
          .map(({ kind, name }) => `${kind} ${name}`),
        framework: await storybook.callHook('core:framework:extend', ''),
        previewAnnotations: (storybook.options.previewAnnotations as string[]).filter((entry) =>
          entry.includes('/frameworks/angular/')
        ),
        typescript: await storybook.callHook('core:typescript:extend', {}),
        webpackConfig: await storybook.callHook(
          'builder:webpack-config:extend',
          WEBPACK_CONFIG(),
          ctx
        ),
        webpackFinal: await storybook
          .callHook('builder:webpack:extend', WEBPACK_CONFIG(), ctx)
          .then(
            (config) => ({
              plugins: (config.plugins ?? []).map((plugin) => plugin?.constructor.name),
              rules: config.module?.rules?.length,
            }),
            (error: Error) => ({ error: error.name })
          ),
      });
    } finally {
      await storybook.close();
    }
  }
  expect(results).toMatchInlineSnapshot(`
    {
      "Ivy off": {
        "addons": [
          "builder @storybook/builder-webpack5",
          "renderer @storybook/angular",
          "framework @storybook/angular",
        ],
        "framework": {
          "name": "@storybook/angular",
          "options": {
            "enableIvy": false,
          },
        },
        "previewAnnotations": [
          "<code>/frameworks/angular/dist/client/config.js",
        ],
        "typescript": {
          "check": false,
          "reactDocgen": "react-docgen",
          "reactDocgenTypescriptOptions": {
            "propFilter": "[Function]",
            "savePropValueAsString": true,
            "shouldExtractLiteralValuesFromEnum": true,
            "shouldRemoveUndefinedFromOptional": true,
          },
          "skipCompiler": true,
        },
        "webpackConfig": {
          "entry": [],
          "module": {
            "rules": [],
          },
          "plugins": [],
          "resolve": {
            "modules": [],
          },
        },
        "webpackFinal": {
          "error": "SB_FRAMEWORK_ANGULAR_0001 (AngularLegacyBuildOptionsError)",
        },
      },
      "builder options": {
        "addons": [
          "builder @storybook/builder-webpack5",
          "renderer @storybook/angular",
          "framework @storybook/angular",
        ],
        "framework": {
          "name": "@storybook/angular",
          "options": {},
        },
        "previewAnnotations": [
          "<code>/frameworks/angular/dist/client/preview-prod.js",
          "<code>/frameworks/angular/dist/client/config.js",
        ],
        "typescript": {
          "check": false,
          "reactDocgen": "react-docgen",
          "reactDocgenTypescriptOptions": {
            "propFilter": "[Function]",
            "savePropValueAsString": true,
            "shouldExtractLiteralValuesFromEnum": true,
            "shouldRemoveUndefinedFromOptional": true,
          },
          "skipCompiler": true,
        },
        "webpackConfig": {
          "entry": [],
          "module": {
            "rules": [],
          },
          "plugins": [],
          "resolve": {
            "mainFields": [
              "browser",
              "module",
              "main",
            ],
            "modules": [],
          },
        },
        "webpackFinal": {
          "plugins": [
            "NamedChunksPlugin",
            "OccurrencesPlugin",
            "DedupeModuleResolvePlugin",
            "AngularWebpackPlugin",
            "AnyComponentStyleBudgetChecker",
            "Object",
            "MiniCssExtractPlugin",
            "SuppressExtractedTextChunksWebpackPlugin",
            "StorybookNormalizeAngularEntryPlugin",
            "DefinePlugin",
          ],
          "rules": 8,
        },
      },
      "defaults": {
        "addons": [
          "builder @storybook/builder-webpack5",
          "renderer @storybook/angular",
          "framework @storybook/angular",
        ],
        "framework": {
          "name": "@storybook/angular",
          "options": {},
        },
        "previewAnnotations": [
          "<code>/frameworks/angular/dist/client/config.js",
        ],
        "typescript": {
          "check": false,
          "reactDocgen": "react-docgen",
          "reactDocgenTypescriptOptions": {
            "propFilter": "[Function]",
            "savePropValueAsString": true,
            "shouldExtractLiteralValuesFromEnum": true,
            "shouldRemoveUndefinedFromOptional": true,
          },
          "skipCompiler": true,
        },
        "webpackConfig": {
          "entry": [],
          "module": {
            "rules": [],
          },
          "plugins": [],
          "resolve": {
            "mainFields": [
              "browser",
              "module",
              "main",
            ],
            "modules": [],
          },
        },
        "webpackFinal": {
          "error": "SB_FRAMEWORK_ANGULAR_0001 (AngularLegacyBuildOptionsError)",
        },
      },
    }
  `);
});

/** Replace absolute paths and class instances so the snapshot is machine independent. */
function summarize(value: unknown): unknown {
  if (typeof value === 'string') {
    return value.replace(`file://${CODE_DIR}`, '<code>/').replace(CODE_DIR, '<code>/');
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
