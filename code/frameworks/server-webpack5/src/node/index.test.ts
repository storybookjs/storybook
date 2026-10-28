import { fileURLToPath } from 'node:url';

import { createStorybook, type StorybookConfig } from 'storybook/internal/instance';

import { expect, it } from 'vitest';

import { serverWebpack5 } from './index.ts';

const CONFIG_DIR = fileURLToPath(
  new URL('../../../../core/src/instance/__fixtures__/first', import.meta.url)
);
const CODE_DIR = fileURLToPath(new URL('../../../../', import.meta.url));
const ROOT_DIR = fileURLToPath(new URL('../../../../../', import.meta.url));

const CASES: Record<string, Partial<StorybookConfig>> = {
  'a framework name': { framework: '@storybook/server-webpack5' },
  'a framework factory': { framework: serverWebpack5() },
  'framework options': {
    framework: { name: '@storybook/server-webpack5', options: { builder: { fsCache: true } } },
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
          .filter(({ name }) => !name.startsWith('storybook/'))
          .map(({ kind, name }) => `${kind} ${name}`),
        renderer: (await storybook.callHook('core:config:extend', {})).renderer,
        framework: await storybook.callHook('core:framework:extend', ''),
        frameworkOptions: await storybook.callHook('core:framework-options:extend', {}),
        webpackConfig: await storybook.callHook('builder:webpack-config:extend', {
          module: { rules: [] },
        }),
      });
    } finally {
      await storybook.close();
    }
  }
  expect(results).toMatchInlineSnapshot(`
    {
      "a framework factory": {
        "framework": {
          "name": "@storybook/server-webpack5",
          "options": {},
        },
        "frameworkOptions": {},
        "plugins": [
          "builder @storybook/builder-webpack5",
          "renderer @storybook/server",
          "addon @storybook/preset-server-webpack",
          "framework @storybook/server-webpack5",
        ],
        "renderer": "<code>/renderers/server/dist/node.js",
        "webpackConfig": {
          "module": {
            "rules": [
              {
                "test": /\\\\\\.stories\\\\\\.json\\$/,
                "type": "javascript/auto",
                "use": "<code>/presets/server-webpack/dist/loader.js",
              },
              {
                "test": /\\\\\\.stories\\\\\\.ya\\?ml/,
                "type": "javascript/auto",
                "use": [
                  "<code>/presets/server-webpack/dist/loader.js",
                  {
                    "loader": "<root>/node_modules/yaml-loader/index.js",
                    "options": {
                      "asJSON": true,
                    },
                  },
                ],
              },
            ],
          },
        },
      },
      "a framework name": {
        "framework": {
          "name": "@storybook/server-webpack5",
          "options": {},
        },
        "frameworkOptions": {},
        "plugins": [
          "builder @storybook/builder-webpack5",
          "renderer @storybook/server",
          "addon @storybook/preset-server-webpack",
          "framework @storybook/server-webpack5",
        ],
        "renderer": "<code>/renderers/server/dist/node.js",
        "webpackConfig": {
          "module": {
            "rules": [
              {
                "test": /\\\\\\.stories\\\\\\.json\\$/,
                "type": "javascript/auto",
                "use": "<code>/presets/server-webpack/dist/loader.js",
              },
              {
                "test": /\\\\\\.stories\\\\\\.ya\\?ml/,
                "type": "javascript/auto",
                "use": [
                  "<code>/presets/server-webpack/dist/loader.js",
                  {
                    "loader": "<root>/node_modules/yaml-loader/index.js",
                    "options": {
                      "asJSON": true,
                    },
                  },
                ],
              },
            ],
          },
        },
      },
      "framework options": {
        "framework": {
          "name": "@storybook/server-webpack5",
          "options": {
            "builder": {
              "fsCache": true,
            },
          },
        },
        "frameworkOptions": {
          "builder": {
            "fsCache": true,
          },
        },
        "plugins": [
          "builder @storybook/builder-webpack5",
          "renderer @storybook/server",
          "addon @storybook/preset-server-webpack",
          "framework @storybook/server-webpack5",
        ],
        "renderer": "<code>/renderers/server/dist/node.js",
        "webpackConfig": {
          "module": {
            "rules": [
              {
                "test": /\\\\\\.stories\\\\\\.json\\$/,
                "type": "javascript/auto",
                "use": "<code>/presets/server-webpack/dist/loader.js",
              },
              {
                "test": /\\\\\\.stories\\\\\\.ya\\?ml/,
                "type": "javascript/auto",
                "use": [
                  "<code>/presets/server-webpack/dist/loader.js",
                  {
                    "loader": "<root>/node_modules/yaml-loader/index.js",
                    "options": {
                      "asJSON": true,
                    },
                  },
                ],
              },
            ],
          },
        },
      },
    }
  `);
});

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
