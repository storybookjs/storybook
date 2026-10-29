import { fileURLToPath } from 'node:url';

import { createStorybook, type StorybookConfig } from 'storybook/internal/instance';

import { expect, it } from 'vitest';

import type { EmberTemplateOptions } from '../types.ts';
import { ember } from './index.ts';

const CONFIG_DIR = fileURLToPath(
  new URL('../../../../core/src/instance/__fixtures__/first', import.meta.url)
);
const CODE_DIR = fileURLToPath(new URL('../../../../', import.meta.url));

const CASES: Record<string, Partial<StorybookConfig> & { emberOptions?: EmberTemplateOptions }> = {
  'the default configuration': { framework: '@storybook/ember' },
  skipCompiler: {
    framework: '@storybook/ember',
    typescript: { skipCompiler: true } as StorybookConfig['typescript'],
  },
  'emberOptions in main': { framework: '@storybook/ember', emberOptions: { polyfills: [] } },
  'emberOptions in framework options': {
    framework: ember({ emberOptions: { polyfills: ['a'] } }),
    emberOptions: { polyfills: [] },
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
      results[name] = summarize({
        plugins: storybook.plugins
          .filter(({ kind }) => kind !== 'addon')
          .map(({ kind, name }) => `${kind} ${name}`),
        framework: await storybook.callHook('core:framework:extend', ''),
        previewAnnotations: await storybook.callHook('preview:annotations:collect', []),
        babel: await settle(() => storybook.callHook('builder:babel:extend', {})),
        webpackFinal: await settle(() => storybook.callHook('builder:webpack:extend', {})),
      });
    } finally {
      await storybook.close();
    }
  }
  expect(results).toMatchInlineSnapshot(`
    {
      "emberOptions in framework options": {
        "babel": {
          "error": "Cannot find package 'babel-plugin-htmlbars-inline-precompile'",
        },
        "framework": {
          "name": "@storybook/ember",
          "options": {
            "emberOptions": {
              "polyfills": [
                "a",
              ],
            },
          },
        },
        "plugins": [
          "builder @storybook/builder-webpack5",
          "renderer @storybook/ember/renderer",
          "framework @storybook/ember",
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
          "<code>/frameworks/ember/dist/client/preview/config",
        ],
        "webpackFinal": {
          "error": "Cannot find package 'babel-plugin-htmlbars-inline-precompile'",
        },
      },
      "emberOptions in main": {
        "babel": {
          "error": "Cannot find package 'babel-plugin-htmlbars-inline-precompile'",
        },
        "framework": {
          "name": "@storybook/ember",
          "options": {},
        },
        "plugins": [
          "builder @storybook/builder-webpack5",
          "renderer @storybook/ember/renderer",
          "framework @storybook/ember",
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
          "<code>/frameworks/ember/dist/client/preview/config",
        ],
        "webpackFinal": {
          "error": "Cannot find package 'babel-plugin-htmlbars-inline-precompile'",
        },
      },
      "skipCompiler": {
        "babel": {
          "error": "Cannot find package 'babel-plugin-htmlbars-inline-precompile'",
        },
        "framework": {
          "name": "@storybook/ember",
          "options": {},
        },
        "plugins": [
          "builder @storybook/builder-webpack5",
          "renderer @storybook/ember/renderer",
          "framework @storybook/ember",
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
          "<code>/frameworks/ember/dist/client/preview/config",
        ],
        "webpackFinal": {
          "error": "Cannot find package 'babel-plugin-htmlbars-inline-precompile'",
        },
      },
      "the default configuration": {
        "babel": {
          "error": "Cannot find package 'babel-plugin-htmlbars-inline-precompile'",
        },
        "framework": {
          "name": "@storybook/ember",
          "options": {},
        },
        "plugins": [
          "builder @storybook/builder-webpack5",
          "renderer @storybook/ember/renderer",
          "framework @storybook/ember",
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
          "<code>/frameworks/ember/dist/client/preview/config",
        ],
        "webpackFinal": {
          "error": "Cannot find package 'babel-plugin-htmlbars-inline-precompile'",
        },
      },
    }
  `);
});

/** Return the error message instead, since the template compiler is an optional peer. */
async function settle(run: () => Promise<unknown>): Promise<unknown> {
  try {
    return await run();
  } catch (error) {
    // The importing file differs between source and built entries.
    return { error: String(error instanceof Error ? error.message : error).split(' imported')[0] };
  }
}

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
