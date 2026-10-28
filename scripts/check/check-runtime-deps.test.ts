import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  classifySpecifier,
  collectSpecifiers,
  findLowerPackageImports,
  getPackageName,
} from './check-runtime-deps.ts';

const MANIFEST = {
  name: '@storybook/ui',
  dependencies: { '@storybook/core': 'workspace:*', 'use-sync-external-store': '^1.5.0' },
  peerDependencies: { prettier: '^3' },
  optionalDependencies: { fsevents: '^2' },
};

describe('getPackageName', () => {
  it.each([
    ['semver', 'semver'],
    ['use-sync-external-store/shim/index.js', 'use-sync-external-store'],
    ['@storybook/core', '@storybook/core'],
    ['@storybook/core/internal/csf', '@storybook/core'],
    ['./chunk.js', undefined],
    ['../theming/index.js', undefined],
    ['/abs/path.js', undefined],
    ['#utils', undefined],
    ['node:fs', undefined],
    ['data:text/javascript,export {}', undefined],
  ])('%s', (input, expected) => {
    expect(getPackageName(input)).toBe(expected);
  });
});

describe('classifySpecifier', () => {
  it('classifies each specifier against the manifest', () => {
    const inputs = [
      'fs',
      'node:fs/promises',
      'node:test',
      './chunk.js',
      '#utils',
      '@storybook/ui/theming',
      'react',
      'react-dom/client',
      '@storybook/core/internal/csf',
      'use-sync-external-store/shim/index.js',
      'prettier',
      'fsevents',
      'picomatch',
      '@scope/missing/sub',
    ];

    expect(Object.fromEntries(inputs.map((input) => [input, classifySpecifier(input, MANIFEST)])))
      .toMatchInlineSnapshot(`
      {
        "#utils": {
          "kind": "local",
        },
        "./chunk.js": {
          "kind": "local",
        },
        "@scope/missing/sub": {
          "kind": "missing",
          "packageName": "@scope/missing",
        },
        "@storybook/core/internal/csf": {
          "kind": "declared",
          "packageName": "@storybook/core",
        },
        "@storybook/ui/theming": {
          "kind": "self",
        },
        "fs": {
          "kind": "builtin",
        },
        "fsevents": {
          "kind": "declared",
          "packageName": "fsevents",
        },
        "node:fs/promises": {
          "kind": "builtin",
        },
        "node:test": {
          "kind": "builtin",
        },
        "picomatch": {
          "kind": "missing",
          "packageName": "picomatch",
        },
        "prettier": {
          "kind": "declared",
          "packageName": "prettier",
        },
        "react": {
          "kind": "host",
          "packageName": "react",
        },
        "react-dom/client": {
          "kind": "host",
          "packageName": "react-dom",
        },
        "use-sync-external-store/shim/index.js": {
          "kind": "declared",
          "packageName": "use-sync-external-store",
        },
      }
    `);
  });
});

describe('collectSpecifiers', () => {
  it('collects static, dynamic and require specifiers but skips strings and guarded requires', () => {
    const input = [
      `import React from "react";`,
      `import "side-effect";`,
      `export { a } from "re-export";`,
      `export * from "./local.js";`,
      `const lazy = () => import("dynamic");`,
      `const fs = __require("fs");`,
      `const cjs = require("cjs-dep");`,
      `const message = 'from "not-an-import"';`,
      'const template = `import x from ${name}`;',
      `try { __require.resolve("picomatch"); pm = __require("picomatch"); } catch {}`,
    ].join('\n');

    expect(collectSpecifiers('input.js', input)).toMatchInlineSnapshot(`
      [
        "react",
        "side-effect",
        "re-export",
        "./local.js",
        "dynamic",
        "fs",
        "cjs-dep",
      ]
    `);
  });
});

describe('findLowerPackageImports', () => {
  it('lists dist files importing a package behind storybook', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'lower-imports-'));
    try {
      await mkdir(join(dir, 'dist'));
      await writeFile(join(dir, 'package.json'), JSON.stringify({ name: '@storybook/addon-x' }));
      await writeFile(
        join(dir, 'dist/index.js'),
        [
          `import * as docs from "@storybook/core/internal/toolsets-docs";`,
          `import { logger } from "storybook/internal/node-logger";`,
          `const name = "@storybook/manager";`,
          `const ui = () => import("@storybook/ui/theming");`,
        ].join('\n')
      );
      await writeFile(join(dir, 'dist/clean.js'), `import "storybook/theming";`);
      expect(await findLowerPackageImports(dir)).toMatchInlineSnapshot(`
        [
          {
            "files": [
              "dist/index.js",
            ],
            "packageName": "@storybook/core",
          },
          {
            "files": [
              "dist/index.js",
            ],
            "packageName": "@storybook/ui",
          },
        ]
      `);
    } finally {
      await rm(dir, { recursive: true });
    }
  });

  it('allows @storybook/core in a package that declares it, not ui or manager', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'lower-imports-'));
    try {
      await mkdir(join(dir, 'dist'));
      await writeFile(
        join(dir, 'package.json'),
        JSON.stringify({
          name: '@storybook/react-vite',
          peerDependencies: { '@storybook/core': 'workspace:^' },
        })
      );
      await writeFile(
        join(dir, 'dist/index.js'),
        [
          `import { logger } from "@storybook/core/internal/node-logger";`,
          `import { styled } from "@storybook/ui/theming";`,
        ].join('\n')
      );
      expect(await findLowerPackageImports(dir)).toMatchInlineSnapshot(`
        [
          {
            "files": [
              "dist/index.js",
            ],
            "packageName": "@storybook/ui",
          },
        ]
      `);
    } finally {
      await rm(dir, { recursive: true });
    }
  });
});
