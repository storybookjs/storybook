import { beforeEach, expect, test, vi } from 'vitest';

import { vol } from 'memfs';

import { getPackageExport } from './packageExports.ts';
import { invalidateCache } from './utils.ts';

vi.mock('node:fs');

beforeEach(() => {
  vol.reset();
  invalidateCache();
});

test('prefers the root when both entries export the component', () => {
  vol.fromJSON({
    '/app/dist/index.d.ts': 'export declare const Button: unknown;',
    '/app/dist/experimental.d.ts': 'export declare function Button(): void;',
  });
  expect(
    getPackageExport(
      '/app/package.json',
      '@acme/ui',
      {
        './experimental': { types: './dist/experimental.d.ts', default: './dist/experimental.js' },
        '.': { types: './dist/index.d.ts', default: './dist/index.js' },
      },
      'Button'
    )
  ).toBe('@acme/ui');
});

test('follows star exports and ignores type-only declarations', () => {
  vol.fromJSON({
    '/app/dist/index.d.ts': 'export interface Button {}',
    '/app/dist/experimental/index.d.ts': "export * from './components.js';",
    '/app/dist/experimental/components.d.ts': 'export declare function Button(): void;',
  });
  expect(
    getPackageExport(
      '/app/package.json',
      '@acme/ui',
      {
        '.': { types: './dist/index.d.ts', default: './dist/index.js' },
        './experimental': {
          types: './dist/experimental/index.d.ts',
          default: './dist/experimental/index.js',
        },
      },
      'Button'
    )
  ).toBe('@acme/ui/experimental');
});

test('does not replace a missing export with a package root', () => {
  vol.fromJSON({
    '/app/dist/index.d.ts': "export type { Button } from './button';",
  });
  expect(
    getPackageExport(
      '/app/package.json',
      '@acme/ui',
      { types: './dist/index.d.ts', default: './dist/index.js' },
      'Button'
    )
  ).toBeUndefined();
});

test('does not select a types-only entry', () => {
  vol.fromJSON({ '/app/dist/index.d.ts': 'export declare const Button: unknown;' });
  expect(
    getPackageExport('/app/package.json', '@acme/ui', { types: './dist/index.d.ts' }, 'Button')
  ).toBeUndefined();
});
