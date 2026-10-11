import type { Options } from 'storybook/internal/types';

import { isAbsolute } from 'pathe';
import { describe, expect, it, vi } from 'vitest';

import { optimizeViteDeps, staticDirs } from './preset.ts';
import { previewRuntimePath } from './utils/preview-runtime-path.ts';
import { resolveVitePublicDir } from './vite-config.ts';

vi.mock('./vite-config.ts', () => ({ resolveVitePublicDir: vi.fn() }));

const options = { configDir: '/project/.storybook', configType: 'PRODUCTION' } as Options;

describe('staticDirs preset', () => {
  it('appends the Vite public dir at the root after the existing entries', async () => {
    vi.mocked(resolveVitePublicDir).mockResolvedValue('/project/public');

    expect(await staticDirs(['../static'], options)).toEqual([
      '../static',
      { from: '/project/public', to: '/' },
    ]);
  });

  it('leaves the entries untouched when Vite has no public dir', async () => {
    vi.mocked(resolveVitePublicDir).mockResolvedValue(undefined);

    expect(await staticDirs(['../static'], options)).toEqual(['../static']);
  });

  it('leaves the entries untouched in dev mode, where Vite serves the public dir itself', async () => {
    vi.mocked(resolveVitePublicDir).mockResolvedValue('/project/public');

    expect(await staticDirs(['../static'], { ...options, configType: 'DEVELOPMENT' })).toEqual([
      '../static',
    ]);
  });
});

describe('optimizeViteDeps preset', () => {
  it('prebundles the preview runtime resolved from the builder context, not a bare specifier', () => {
    expect(optimizeViteDeps).toEqual([previewRuntimePath]);
    expect(isAbsolute(previewRuntimePath)).toBe(true);
    expect(previewRuntimePath.endsWith('dist/preview/runtime.js')).toBe(true);
  });
});
