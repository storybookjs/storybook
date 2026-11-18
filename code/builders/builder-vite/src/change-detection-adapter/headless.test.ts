// Tests the headless Vite ChangeDetectionAdapter used by consumers without a dev server (the
// `storybook tools` CLI): resolve config comes from Vite's server-less config resolution over the
// same assembly (commonConfig + viteFinal) the dev server uses, and file watching is a no-op.
import { describe, expect, it, vi } from 'vitest';

import type { Options } from 'storybook/internal/types';

import { createHeadlessViteChangeDetectionAdapter } from './headless.ts';

const { resolveConfigMock, commonConfigMock } = vi.hoisted(() => ({
  resolveConfigMock: vi.fn(),
  commonConfigMock: vi.fn(),
}));

vi.mock('vite', () => ({ resolveConfig: resolveConfigMock }));
vi.mock('../vite-config.ts', () => ({ commonConfig: commonConfigMock }));

const alias = [{ find: '@', replacement: '/repo/src' }];
const conditions = ['import', 'module', 'default'];

function createOptions() {
  const apply = vi.fn(async (_name: string, config: unknown) => ({
    ...(config as object),
    fromViteFinal: true,
  }));
  return { options: { presets: { apply } } as unknown as Options, apply };
}

describe('createHeadlessViteChangeDetectionAdapter', () => {
  it('resolves the same three fields the server-bound adapter snapshots', async () => {
    commonConfigMock.mockResolvedValue({ root: '/repo' });
    resolveConfigMock.mockResolvedValue({
      root: '/repo',
      resolve: { alias, conditions },
    });
    const { options } = createOptions();

    const adapter = createHeadlessViteChangeDetectionAdapter(options);
    const config = await adapter.getResolveConfig();

    expect(config).toEqual({
      projectRoot: '/repo',
      alias,
      conditions,
    });
  });

  it('assembles config like the dev server: commonConfig in development mode, then viteFinal', async () => {
    commonConfigMock.mockResolvedValue({ root: '/repo' });
    resolveConfigMock.mockResolvedValue({ root: '/repo', resolve: {} });
    const { options, apply } = createOptions();

    const adapter = createHeadlessViteChangeDetectionAdapter(options);
    await adapter.getResolveConfig();

    expect(commonConfigMock).toHaveBeenCalledWith(options, 'development');
    expect(apply).toHaveBeenCalledWith('viteFinal', { root: '/repo' }, options);
    expect(resolveConfigMock).toHaveBeenCalledWith(
      { root: '/repo', fromViteFinal: true },
      'serve',
      'development'
    );
  });

  it('onFileChange is a no-op that still returns an unsubscribe function', () => {
    const { options } = createOptions();
    const adapter = createHeadlessViteChangeDetectionAdapter(options);

    const unsubscribe = adapter.onFileChange(vi.fn());

    expect(typeof unsubscribe).toBe('function');
    expect(() => unsubscribe()).not.toThrow();
  });
});
