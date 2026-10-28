import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { findPresetShape, isPluginPackage } from './check-no-preset.ts';

const CODE = fileURLToPath(new URL('../../code/', import.meta.url));

describe('findPresetShape', () => {
  it('lists every preset trace and nothing for a node-only package', () => {
    const node = { types: './dist/node.d.ts', default: './dist/node.js' };
    const cases = {
      'node-only package': {
        exports: { '.': './dist/index.js', './node': node, './package.json': './package.json' },
        rootFiles: ['package.json', 'preview.js'],
        sources: [{ file: 'src/node.ts', code: "storybook.callHook('core:docs:extend', {})" }],
      },
      'renderer with a ./preset alias of ./node': {
        exports: { './node': node, './preset': { ...node } },
        rootFiles: ['package.json'],
        sources: [],
      },
      'renderer with a ./preset that differs from ./node': {
        exports: { './node': node, './preset': { ...node, default: './dist/preset.js' } },
        rootFiles: ['package.json'],
        sources: [],
      },
      'preset package': {
        exports: {
          '.': './dist/index.js',
          './preset': './dist/preset.js',
          './preset-react-docs': './dist/preset-react-docs.js',
          './server/framework-preset-angular-cli': './dist/angular-cli.js',
          './node': node,
        },
        rootFiles: ['package.json', 'preset.js'],
        sources: [
          { file: 'src/node.ts', code: "await options.presets.apply('docs', {})" },
          { file: 'src/vite.ts', code: "await options.presets?.apply('features')" },
        ],
      },
    };
    expect(
      Object.fromEntries(
        Object.entries(cases).map(([name, input]) => [name, findPresetShape(input)])
      )
    ).toMatchInlineSnapshot(`
      {
        "node-only package": [],
        "preset package": [
          "exports "./preset"",
          "exports "./preset-react-docs"",
          "exports "./server/framework-preset-angular-cli"",
          "ships root preset.js",
          "calls presets.apply in src/node.ts",
          "calls presets.apply in src/vite.ts",
        ],
        "renderer with a ./preset alias of ./node": [],
        "renderer with a ./preset that differs from ./node": [
          "exports "./preset"",
        ],
      }
    `);
  });
});

describe('isPluginPackage', () => {
  it('checks addons, builders, frameworks, presets and renderers only', () => {
    expect(
      Object.fromEntries(
        [
          'addons/docs',
          'builders/builder-vite',
          'frameworks/react-vite',
          'presets/react-webpack',
          'renderers/react',
          'core',
          'lib/storybook',
        ].map((dir) => [dir, isPluginPackage(`${CODE}${dir}`)])
      )
    ).toMatchInlineSnapshot(`
      {
        "addons/docs": true,
        "builders/builder-vite": true,
        "core": false,
        "frameworks/react-vite": true,
        "lib/storybook": false,
        "presets/react-webpack": true,
        "renderers/react": true,
      }
    `);
  });
});
