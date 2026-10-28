// Tests the headless Vite ChangeDetectionAdapter used by consumers without a dev server (the
// `storybook tools` CLI): resolve config comes from Vite's server-less config resolution over the
// same assembly (commonConfig + builder:vite:extend) the dev server uses, and file watching is a no-op.
import { describe, expect, it, vi } from 'vitest';

import type { Storybook } from '@storybook/core';

import { createHeadlessViteChangeDetectionAdapter } from './headless.ts';

const { resolveConfigMock, commonConfigMock } = vi.hoisted(() => ({
  resolveConfigMock: vi.fn(),
  commonConfigMock: vi.fn(),
}));

vi.mock('vite', () => ({ resolveConfig: resolveConfigMock }));
vi.mock('storybook/internal/preview-page', () => ({
  getPreviewSources: vi.fn(async () => 'preview-sources'),
}));
vi.mock('../vite-config.ts', () => ({
  commonConfig: commonConfigMock,
  getViteHookContext: () => ({ configType: 'DEVELOPMENT' }),
}));

const alias = [{ find: '@', replacement: '/repo/src' }];
const conditions = ['import', 'module', 'default'];

function createStorybook() {
  const callHook = vi.fn(async (_name: string, config: unknown) => ({
    ...(config as object),
    fromViteFinal: true,
  }));
  return { storybook: { callHook } as unknown as Storybook, callHook };
}

describe('createHeadlessViteChangeDetectionAdapter', () => {
  it('resolves the same three fields the server-bound adapter snapshots', async () => {
    commonConfigMock.mockResolvedValue({ root: '/repo' });
    resolveConfigMock.mockResolvedValue({
      root: '/repo',
      resolve: { alias, conditions },
    });
    const { storybook } = createStorybook();

    const adapter = createHeadlessViteChangeDetectionAdapter(storybook, {});
    const config = await adapter.getResolveConfig();

    expect(config).toEqual({
      projectRoot: '/repo',
      alias,
      conditions,
    });
  });

  it('assembles config like the dev server: commonConfig in development mode, then builder:vite:extend', async () => {
    commonConfigMock.mockResolvedValue({ root: '/repo' });
    resolveConfigMock.mockResolvedValue({ root: '/repo', resolve: {} });
    const { storybook, callHook } = createStorybook();

    const adapter = createHeadlessViteChangeDetectionAdapter(storybook, { viteConfigPath: null });
    await adapter.getResolveConfig();

    expect(commonConfigMock).toHaveBeenCalledWith(
      storybook,
      { preview: 'preview-sources', options: { viteConfigPath: null } },
      'development'
    );
    expect(callHook).toHaveBeenCalledWith(
      'builder:vite:extend',
      { root: '/repo' },
      { configType: 'DEVELOPMENT' }
    );
    expect(resolveConfigMock).toHaveBeenCalledWith(
      { root: '/repo', fromViteFinal: true },
      'serve',
      'development'
    );
  });

  it('onFileChange is a no-op that still returns an unsubscribe function', () => {
    const { storybook } = createStorybook();
    const adapter = createHeadlessViteChangeDetectionAdapter(storybook, {});

    const unsubscribe = adapter.onFileChange(vi.fn());

    expect(typeof unsubscribe).toBe('function');
    expect(() => unsubscribe()).not.toThrow();
  });

  it('names the missing `storybook` package when the preview runtime cannot load', async () => {
    vi.resetModules();
    vi.doMock('storybook/internal/preview-page', () => {
      throw new Error("Cannot find package 'storybook'");
    });
    const { createHeadlessViteChangeDetectionAdapter: create } = await import('./headless.ts');
    const { storybook } = createStorybook();

    await expect(create(storybook, {}).getResolveConfig()).rejects.toThrow(
      'Headless Vite change detection needs the `storybook` package, which is not installed.'
    );
    vi.doUnmock('storybook/internal/preview-page');
  });
});
