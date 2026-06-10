import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';

import { vol } from 'memfs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { isStorybookInstalled } from './installed-check.ts';

vi.mock('node:module', { spy: true });

// Spy-only mock: redirect the probe's existsSync to memfs.
vi.mock('node:fs', { spy: true });

function mockSearchPaths(paths: string[]) {
  vi.mocked(createRequire).mockReturnValue({
    resolve: Object.assign(() => '', { paths: () => paths }),
  } as unknown as ReturnType<typeof createRequire>);
}

beforeEach(async () => {
  const memfs = await vi.importActual<typeof import('memfs')>('memfs');
  vi.mocked(existsSync).mockImplementation(
    memfs.fs.existsSync as unknown as typeof import('node:fs').existsSync
  );
});

afterEach(() => {
  vol.reset();
  vi.mocked(createRequire).mockReset();
});

describe('isStorybookInstalled', () => {
  it('finds storybook in the nearest node_modules', () => {
    mockSearchPaths(['/proj/node_modules', '/node_modules']);
    vol.fromNestedJSON({ '/proj/node_modules/storybook/package.json': '{}' });
    expect(isStorybookInstalled('/proj')).toBe(true);
  });

  it('walks up the search paths (monorepo hoisting)', () => {
    mockSearchPaths(['/repo/packages/app/node_modules', '/repo/node_modules']);
    vol.fromNestedJSON({ '/repo/node_modules/storybook/package.json': '{}' });
    expect(isStorybookInstalled('/repo/packages/app')).toBe(true);
  });

  it('returns false when storybook is nowhere on the search paths', () => {
    mockSearchPaths(['/proj/node_modules']);
    vol.fromNestedJSON({ '/proj/node_modules': {} });
    expect(isStorybookInstalled('/proj')).toBe(false);
  });
});
