import { createServer } from 'node:http';

import { Channel } from '@storybook/core/internal/channels';
import type { Storybook } from '@storybook/core';
import type { PreviewSources } from '@storybook/core/internal/preview-page';
import type { ServerApp } from '@storybook/core/internal/types';

import type { Compiler, Stats } from 'webpack';
import webpackDevMiddleware from 'webpack-dev-middleware';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createWebpackBuilder } from './builder.ts';

vi.mock('@storybook/core/internal/node-logger', { spy: true });
vi.mock('storybook/internal/preview-page', async (importOriginal) => ({
  ...(await importOriginal<typeof import('storybook/internal/preview-page')>()),
  getPreviewSources: async () => ({ previewRuntimePath: '/storybook/preview/runtime.js' }),
}));
vi.mock('webpack', () => ({
  default: {
    ProgressPlugin: vi.fn(function () {
      return { apply: vi.fn() };
    }),
  },
}));
vi.mock('webpack-dev-middleware', () => ({ default: vi.fn() }));
vi.mock('webpack-hot-middleware', () => ({ default: vi.fn() }));
vi.mock('./preview/iframe-webpack.config.ts', () => ({
  createIframeWebpackConfig: () => ({
    output: { publicPath: '' },
    resolve: { alias: { example: '/project/example.ts' }, conditionNames: ['browser'] },
  }),
}));

const PREVIEW = { previewRuntimePath: '/storybook/preview/runtime.js' } as PreviewSources;

function fakeStorybook(compilerFactory?: unknown): Storybook {
  return {
    mode: 'dev',
    configDir: '/project/.storybook',
    workingDir: '/project',
    options: {},
    plugins: [],
    channel: new Channel({}),
    callHook: vi.fn(async (name: string, value: unknown) =>
      name === 'builder:webpack-instance:extend' && compilerFactory ? compilerFactory : value
    ),
  } as unknown as Storybook;
}

afterEach(() => vi.restoreAllMocks());

describe('Webpack builder state', () => {
  it('keeps compilers, cancellation, and change detection in their owning builder', async () => {
    const compilers = ['/first', '/second'].map(
      (context) => ({ context, options: { resolve: {} } }) as Compiler
    );
    const factory = vi.fn().mockReturnValueOnce(compilers[0]).mockReturnValueOnce(compilers[1]);
    const storybook = fakeStorybook(factory);
    const stats = { toJson: () => ({ warnings: [], errors: [] }) } as unknown as Stats;
    const middleware = [0, 1].map(() => ({
      waitUntilValid: (done: (stats: Stats) => void) => done(stats),
      close: vi.fn((done: () => void) => done()),
    }));
    vi.mocked(webpackDevMiddleware)
      .mockReturnValueOnce(middleware[0] as unknown as ReturnType<typeof webpackDevMiddleware>)
      .mockReturnValueOnce(middleware[1] as unknown as ReturnType<typeof webpackDevMiddleware>);
    const host = {
      router: { use: vi.fn() } as unknown as ServerApp,
      server: createServer(),
      startTime: process.hrtime(),
      preview: PREVIEW,
    };
    const first = createWebpackBuilder(undefined);
    const second = createWebpackBuilder(undefined);
    const firstResult = await first.dev(storybook, host);
    const secondResult = await second.dev(storybook, host);
    expect(await first.changeDetectionAdapter(storybook).getResolveConfig()).toMatchObject({
      projectRoot: '/first',
    });
    expect(await second.changeDetectionAdapter(storybook).getResolveConfig()).toMatchObject({
      projectRoot: '/second',
    });
    await firstResult.bail();
    expect(middleware[0].close).toHaveBeenCalledOnce();
    expect(middleware[1].close).not.toHaveBeenCalled();
    expect(await second.changeDetectionAdapter(storybook).getResolveConfig()).toMatchObject({
      projectRoot: '/second',
    });
    await secondResult.bail();
    expect(middleware[1].close).toHaveBeenCalledOnce();
  });

  it('resolves a headless config without starting a compiler', async () => {
    const builder = createWebpackBuilder(undefined);
    const adapter = builder.changeDetectionAdapter(fakeStorybook());
    await expect(adapter.getResolveConfig()).resolves.toEqual({
      projectRoot: '/project',
      alias: { example: '/project/example.ts' },
      conditions: ['browser', 'storybook', 'stories', 'test', '...'],
    });
    expect(webpackDevMiddleware).not.toHaveBeenCalled();
    expect(adapter.onFileChange(vi.fn())).toEqual(expect.any(Function));
  });
});
