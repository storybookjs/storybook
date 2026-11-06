import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

import { vol, fs as memfs } from 'memfs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Options } from 'storybook/internal/types';

import { staticDirs } from './preset.ts';

vi.mock('node:fs', { spy: true });

const options = { configDir: '/project/.storybook', configType: 'PRODUCTION' } as Options;

describe('staticDirs preset', () => {
  beforeEach(() => {
    vol.reset();
    vi.mocked(existsSync).mockImplementation(memfs.existsSync);
  });

  it("appends SvelteKit's static directory at the root after the existing entries", async () => {
    vol.fromNestedJSON({ '/project/static/robots.txt': '' });

    expect(await staticDirs(['./public'], options)).toEqual([
      './public',
      { from: resolve('/project/static'), to: '/' },
    ]);
  });

  it('leaves the entries untouched when the project has no static directory', async () => {
    expect(await staticDirs(['./public'], options)).toEqual(['./public']);
  });

  it('leaves the entries untouched in dev mode, where Vite serves the static directory', async () => {
    vol.fromNestedJSON({ '/project/static/robots.txt': '' });

    expect(await staticDirs(['./public'], { ...options, configType: 'DEVELOPMENT' })).toEqual([
      './public',
    ]);
  });
});
