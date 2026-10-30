import { fileURLToPath } from 'node:url';

import { createStorybook, type StorybookConfig } from 'storybook/internal/instance';

import { expect, it, vi } from 'vitest';

import { reactWebpack5 } from './index.ts';

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
  'a framework name': { framework: '@storybook/react-webpack5' },
  'react-docgen': {
    framework: reactWebpack5(),
    features: { docgenServer: false },
    typescript: { reactDocgen: 'react-docgen' } as StorybookConfig['typescript'],
  },
  'react-docgen-typescript': {
    framework: reactWebpack5(),
    features: { docgenServer: false },
    typescript: { reactDocgen: 'react-docgen-typescript' } as StorybookConfig['typescript'],
  },
  'development mode for build': {
    framework: reactWebpack5(),
    features: { developmentModeForBuild: true },
  },
  'framework options': {
    framework: {
      name: '@storybook/react-webpack5',
      options: { strictMode: true, builder: { fsCache: true } },
    },
  },
};

it('registers the framework hooks', async () => {
  const results: Record<string, unknown> = {};
  for (const [name, main] of Object.entries(CASES)) {
    const storybook = createStorybook({
      configDir: CONFIG_DIR,
      mode: 'headless',
      main: { ...main, stories: [] },
    });
    await storybook.ready();
    try {
      results[name] = summarize({
        addons: storybook.addons
          .filter(({ name }) => !name.startsWith('storybook/'))
          .map(({ kind, name }) => `${kind} ${name}`),
        renderer: (await storybook.callHook('core:config:extend', {})).renderer,
        framework: await storybook.callHook('core:framework:extend', ''),
        frameworkOptions: await storybook.callHook('core:framework-options:extend', {}),
        webpackConfig: await storybook.callHook('builder:webpack-config:extend', { plugins: [] }),
        webpackFinal: await storybook.callHook('builder:webpack:extend', { plugins: [] }),
      });
    } finally {
      await storybook.close();
    }
  }
  expect(results).toMatchInlineSnapshot(`
    {
      "a framework name": {
        "addons": [
          "builder @storybook/builder-webpack5",
          "renderer @storybook/react",
          "addon @storybook/preset-react-webpack",
          "framework @storybook/react-webpack5",
        ],
        "framework": {
          "name": "@storybook/react-webpack5",
          "options": {},
        },
        "frameworkOptions": {},
        "renderer": "<code>/renderers/react/dist/node.js",
        "webpackConfig": {
          "plugins": [],
          "resolve": {
            "alias": {
              "@storybook/react": "<code>/renderers/react/dist/index.js",
            },
          },
        },
        "webpackFinal": {
          "plugins": [],
        },
      },
      "development mode for build": {
        "addons": [
          "builder @storybook/builder-webpack5",
          "renderer @storybook/react",
          "addon @storybook/preset-react-webpack",
          "framework @storybook/react-webpack5",
        ],
        "framework": {
          "name": "@storybook/react-webpack5",
          "options": {},
        },
        "frameworkOptions": {},
        "renderer": "<code>/renderers/react/dist/node.js",
        "webpackConfig": {
          "plugins": [
            "[DefinePlugin]",
          ],
          "resolve": {
            "alias": {
              "@storybook/react": "<code>/renderers/react/dist/index.js",
            },
          },
        },
        "webpackFinal": {
          "plugins": [],
        },
      },
      "framework options": {
        "addons": [
          "builder @storybook/builder-webpack5",
          "renderer @storybook/react",
          "addon @storybook/preset-react-webpack",
          "framework @storybook/react-webpack5",
        ],
        "framework": {
          "name": "@storybook/react-webpack5",
          "options": {
            "builder": {
              "fsCache": true,
            },
            "strictMode": true,
          },
        },
        "frameworkOptions": {
          "builder": {
            "fsCache": true,
          },
          "strictMode": true,
        },
        "renderer": "<code>/renderers/react/dist/node.js",
        "webpackConfig": {
          "plugins": [],
          "resolve": {
            "alias": {
              "@storybook/react": "<code>/renderers/react/dist/index.js",
            },
          },
        },
        "webpackFinal": {
          "plugins": [],
        },
      },
      "react-docgen": {
        "addons": [
          "builder @storybook/builder-webpack5",
          "renderer @storybook/react",
          "addon @storybook/preset-react-webpack",
          "framework @storybook/react-webpack5",
        ],
        "framework": {
          "name": "@storybook/react-webpack5",
          "options": {},
        },
        "frameworkOptions": {},
        "renderer": "<code>/renderers/react/dist/node.js",
        "webpackConfig": {
          "plugins": [],
          "resolve": {
            "alias": {
              "@storybook/react": "<code>/renderers/react/dist/index.js",
            },
          },
        },
        "webpackFinal": {
          "module": {
            "rules": [
              {
                "enforce": "pre",
                "exclude": /\\(\\\\\\.\\(stories\\|story\\)\\\\\\.\\(js\\|jsx\\|ts\\|tsx\\)\\)\\|\\(node_modules\\)/,
                "loader": "<code>/presets/react-webpack/dist/loaders/react-docgen-loader.js",
                "options": {
                  "debug": false,
                },
                "test": /\\\\\\.\\(cjs\\|mjs\\|tsx\\?\\|jsx\\?\\)\\$/,
              },
            ],
          },
          "plugins": [],
        },
      },
      "react-docgen-typescript": {
        "addons": [
          "builder @storybook/builder-webpack5",
          "renderer @storybook/react",
          "addon @storybook/preset-react-webpack",
          "framework @storybook/react-webpack5",
        ],
        "framework": {
          "name": "@storybook/react-webpack5",
          "options": {},
        },
        "frameworkOptions": {},
        "renderer": "<code>/renderers/react/dist/node.js",
        "webpackConfig": {
          "plugins": [],
          "resolve": {
            "alias": {
              "@storybook/react": "<code>/renderers/react/dist/index.js",
            },
          },
        },
        "webpackFinal": {
          "module": {
            "rules": [
              {
                "enforce": "pre",
                "exclude": /\\(\\\\\\.\\(stories\\|story\\)\\\\\\.\\(js\\|jsx\\|ts\\|tsx\\)\\)\\|\\(node_modules\\)/,
                "loader": "<code>/presets/react-webpack/dist/loaders/react-docgen-loader.js",
                "options": {
                  "debug": false,
                },
                "test": /\\\\\\.\\(cjs\\|mjs\\|jsx\\?\\)\\$/,
              },
            ],
          },
          "plugins": [
            "[DocgenPlugin]",
          ],
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
