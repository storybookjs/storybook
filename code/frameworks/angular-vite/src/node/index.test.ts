import { fileURLToPath } from 'node:url';

import {
  createStorybook,
  type CreateStorybookInput,
  type StorybookConfig,
} from 'storybook/internal/instance';

import { expect, it, vi } from 'vitest';

import type { UserConfig } from 'vite';

import { angularVite } from './index.ts';

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

const CASES: Record<
  string,
  { main: Partial<StorybookConfig>; cliOptions?: Record<string, unknown> }
> = {
  defaults: { main: { framework: '@storybook/angular-vite' } },
  // The Angular builders pass these to Storybook as host options.
  'builder options': {
    main: { framework: '@storybook/angular-vite' },
    cliOptions: {
      enableProdMode: true,
      angularBrowserTarget: null,
      angularBuilderOptions: { zoneless: false },
      tsConfig: 'tsconfig.storybook.json',
    },
  },
  'Compodoc docgen off': {
    main: {
      framework: angularVite({ compodoc: false, propsTable: 'inputs', jit: false }),
      features: { docgenServer: false },
    },
  },
};

it('registers the framework hooks', async () => {
  const results: Record<string, unknown> = {};
  for (const [name, { main, cliOptions }] of Object.entries(CASES)) {
    const storybook = await createStorybook({
      configDir: CONFIG_DIR,
      mode: 'headless',
      main: { ...main, stories: [] },
      cliOptions: cliOptions as CreateStorybookInput['cliOptions'],
    });
    try {
      const { componentsManifest, docgenServer } = storybook.options.features ?? {};
      const vite = (await storybook.callHook('builder:vite:extend', {}, {
        ...cliOptions,
        configDir: CONFIG_DIR,
      } as never)) as UserConfig;
      results[name] = summarize({
        plugins: storybook.plugins
          .filter(({ name }) => !name.startsWith('storybook/'))
          .map(({ kind, name }) => `${kind} ${name}`),
        core: (({ builder }) => ({ builder }))(await storybook.callHook('core:config:extend', {})),
        framework: await storybook.callHook('core:framework:extend', ''),
        features: { componentsManifest, docgenServer },
        previewAnnotations: (storybook.options.previewAnnotations as string[]).filter((entry) =>
          entry.includes('/frameworks/angular-vite/')
        ),
        skipCompiler: (await storybook.callHook('core:typescript:extend', {})).skipCompiler,
        docgenProviders: await storybook.callHook('core:docgen-providers:collect', []),
        manifests: await storybook.callHook('index:manifests:extend', {}),
        vite: {
          plugins: (vite.plugins ?? [])
            .flat()
            .map((plugin) => (plugin && 'name' in plugin ? plugin.name : plugin)),
          define: vite.define,
        },
      });
    } finally {
      await storybook.close();
    }
  }
  expect(results).toMatchInlineSnapshot(`
    {
      "Compodoc docgen off": {
        "core": {
          "builder": {
            "name": "<code>/builders/builder-vite/dist/index.js",
            "options": {},
          },
        },
        "docgenProviders": [
          {
            "moduleSpecifier": "<code>/frameworks/angular-vite/dist/docgen/docgen-worker.js",
            "options": {
              "propsTable": "inputs",
            },
          },
        ],
        "features": {
          "componentsManifest": true,
          "docgenServer": false,
        },
        "framework": {
          "name": "@storybook/angular-vite",
          "options": {
            "compodoc": false,
            "jit": false,
            "propsTable": "inputs",
          },
        },
        "manifests": {},
        "plugins": [
          "builder @storybook/builder-vite",
          "renderer @storybook/angular-vite",
          "framework @storybook/angular-vite",
        ],
        "previewAnnotations": [
          "<code>/frameworks/angular-vite/dist/client/config.js",
        ],
        "skipCompiler": true,
        "vite": {
          "define": {
            "STORYBOOK_ANGULAR_OPTIONS": "{"zoneless":true,"propsTable":"inputs"}",
          },
          "plugins": [
            "@analogjs/vite-plugin-angular",
            "@analogjs/vitest-angular-esm-plugin",
            "@analogjs/vitest-angular-esbuild-oxc-plugin",
            "@analogjs/vitest-angular-sourcemap-plugin",
            "@analogjs/vite-plugin-angular-optimizer",
            "analogjs-router-optimization",
            "analogjs-nx-folder-plugin",
            "storybook-angular-vite-redirect-reapply",
            "storybook-angular-vite-options-plugin",
            "storybook-angular-vite-style-preprocessor-check",
            "storybook-angular-vite-oxc-config",
          ],
        },
      },
      "builder options": {
        "core": {
          "builder": {
            "name": "<code>/builders/builder-vite/dist/index.js",
            "options": {},
          },
        },
        "docgenProviders": [
          {
            "moduleSpecifier": "<code>/frameworks/angular-vite/dist/docgen/docgen-worker.js",
            "options": {
              "propsTable": "api",
            },
          },
        ],
        "features": {
          "componentsManifest": true,
          "docgenServer": true,
        },
        "framework": {
          "name": "@storybook/angular-vite",
          "options": {},
        },
        "manifests": {
          "components": {
            "components": {},
            "meta": {
              "docgen": "angular-component-meta",
              "durationMs": 0,
            },
            "v": 0,
          },
        },
        "plugins": [
          "builder @storybook/builder-vite",
          "renderer @storybook/angular-vite",
          "framework @storybook/angular-vite",
        ],
        "previewAnnotations": [
          "<code>/frameworks/angular-vite/dist/client/preview-prod.js",
          "<code>/frameworks/angular-vite/dist/client/config.js",
        ],
        "skipCompiler": true,
        "vite": {
          "define": {
            "STORYBOOK_ANGULAR_OPTIONS": "{"zoneless":false,"propsTable":"api"}",
          },
          "plugins": [
            "@analogjs/vite-plugin-angular",
            "@analogjs/vitest-angular-esm-plugin",
            "@analogjs/vitest-angular-esbuild-oxc-plugin",
            "@analogjs/vitest-angular-sourcemap-plugin",
            "@analogjs/vite-plugin-angular-jit",
            "@analogjs/vite-plugin-angular-optimizer",
            "analogjs-router-optimization",
            "analogjs-nx-folder-plugin",
            "storybook-angular-vite-redirect-reapply",
            "storybook-angular-vite-options-plugin",
            "storybook-angular-vite-style-preprocessor-check",
            "storybook-angular-vite-oxc-config",
            "storybook-angular-vite-compodoc-json-stub",
          ],
        },
      },
      "defaults": {
        "core": {
          "builder": {
            "name": "<code>/builders/builder-vite/dist/index.js",
            "options": {},
          },
        },
        "docgenProviders": [
          {
            "moduleSpecifier": "<code>/frameworks/angular-vite/dist/docgen/docgen-worker.js",
            "options": {
              "propsTable": "api",
            },
          },
        ],
        "features": {
          "componentsManifest": true,
          "docgenServer": true,
        },
        "framework": {
          "name": "@storybook/angular-vite",
          "options": {},
        },
        "manifests": {
          "components": {
            "components": {},
            "meta": {
              "docgen": "angular-component-meta",
              "durationMs": 0,
            },
            "v": 0,
          },
        },
        "plugins": [
          "builder @storybook/builder-vite",
          "renderer @storybook/angular-vite",
          "framework @storybook/angular-vite",
        ],
        "previewAnnotations": [
          "<code>/frameworks/angular-vite/dist/client/config.js",
        ],
        "skipCompiler": true,
        "vite": {
          "define": {
            "STORYBOOK_ANGULAR_OPTIONS": "{"zoneless":true,"propsTable":"api"}",
          },
          "plugins": [
            "@analogjs/vite-plugin-angular",
            "@analogjs/vitest-angular-esm-plugin",
            "@analogjs/vitest-angular-esbuild-oxc-plugin",
            "@analogjs/vitest-angular-sourcemap-plugin",
            "@analogjs/vite-plugin-angular-jit",
            "@analogjs/vite-plugin-angular-optimizer",
            "analogjs-router-optimization",
            "analogjs-nx-folder-plugin",
            "storybook-angular-vite-redirect-reapply",
            "storybook-angular-vite-options-plugin",
            "storybook-angular-vite-style-preprocessor-check",
            "storybook-angular-vite-oxc-config",
            "storybook-angular-vite-compodoc-json-stub",
          ],
        },
      },
    }
  `);
});

/** Replace absolute paths and class instances so the snapshot is machine independent. */
function summarize(value: unknown): unknown {
  if (typeof value === 'string') {
    return value.replace(`file://${CODE_DIR}`, '<code>/').replaceAll(CODE_DIR, '<code>/');
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
