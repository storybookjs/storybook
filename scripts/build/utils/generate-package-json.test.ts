import { expect, it } from 'vitest';

import { collapseDeepExports, putCodeConditionFirst } from './generate-package-json.ts';

const TAGS = {
  code: './src/constants/tags.ts',
  types: './dist/constants/tags.d.ts',
  default: './dist/constants/tags.js',
};
const STATUS_STORE = {
  code: './src/shared/status-store/index.ts',
  types: './dist/shared/status-store/index.d.ts',
  default: './dist/shared/status-store/index.js',
};
const TEST_NODE = {
  code: './src/test/node.ts',
  types: './dist/test/node.d.ts',
  node: './dist/_node/test/node.js',
  default: './dist/test/node.js',
};
const ICON_TSX = {
  code: './src/components/icon.tsx',
  types: './dist/components/icon.d.ts',
  default: './dist/components/icon.js',
};

it.each([
  {
    name: 'collapses uniform deep entries; index, `node` and .tsx entries stay explicit',
    input: {
      './package.json': './package.json',
      './internal/deep/constants/tags': TAGS,
      './internal/deep/shared/status-store': STATUS_STORE,
      './internal/deep/test/node': TEST_NODE,
      './internal/deep/components/icon': ICON_TSX,
    },
    expected: {
      './package.json': './package.json',
      './internal/deep/shared/status-store': STATUS_STORE,
      './internal/deep/test/node': TEST_NODE,
      './internal/deep/components/icon': ICON_TSX,
      './internal/deep/*': {
        code: './src/*.ts',
        types: './dist/*.d.ts',
        default: './dist/*.js',
      },
    },
  },
  {
    name: 'adds no pattern without a uniform deep entry',
    input: {
      './package.json': './package.json',
      './internal/deep/shared/status-store': STATUS_STORE,
    },
    expected: {
      './package.json': './package.json',
      './internal/deep/shared/status-store': STATUS_STORE,
    },
  },
])('$name', ({ input, expected }) => {
  expect(collapseDeepExports(input)).toEqual(expected);
});

it('puts the `code` condition first so a workspace type check never reads built `.d.ts`', () => {
  const input = {
    './package.json': './package.json',
    './internal/types': {
      types: './dist/types/index.d.ts',
      code: './src/types/index.ts',
      default: './dist/types/index.js',
    },
    './internal/test': {
      types: './dist/test/node.d.ts',
      code: './src/test/node.ts',
      node: './dist/_node/test/node.js',
      default: './dist/test/node.js',
    },
  };

  // Stringified because snapshots sort keys, and key order is the point.
  expect(JSON.stringify(putCodeConditionFirst(input), null, 2)).toMatchInlineSnapshot(`
    "{
      "./package.json": "./package.json",
      "./internal/types": {
        "code": "./src/types/index.ts",
        "types": "./dist/types/index.d.ts",
        "default": "./dist/types/index.js"
      },
      "./internal/test": {
        "code": "./src/test/node.ts",
        "types": "./dist/test/node.d.ts",
        "node": "./dist/_node/test/node.js",
        "default": "./dist/test/node.js"
      }
    }"
  `);
});
