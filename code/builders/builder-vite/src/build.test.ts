import { Channel } from '@storybook/core/internal/channels';
import type { Storybook } from '@storybook/core';
import {
  VITE_PREVIEW_MODULE_IDS,
  type PreviewSources,
} from '@storybook/core/internal/preview-page';

import type { InlineConfig, Plugin } from 'vite';
import { resolveConfig, build as viteBuild } from 'vite';
import { expect, it, vi } from 'vitest';

import { build } from './build.ts';

vi.mock(import('vite'), async (importOriginal) => ({
  ...(await importOriginal()),
  build: vi.fn(async () => []),
  loadConfigFromFile: vi.fn(async () => null),
}));

const PREVIEW = {
  modules: { entry: '', projectAnnotations: '', addonSetup: '' },
  virtualModuleIds: VITE_PREVIEW_MODULE_IDS,
  externals: {},
  define: () => ({}),
  previewAnnotations: [],
  previewConfigPath: undefined,
  previewRuntimePath: '/storybook/dist/core/preview/runtime.js',
} as unknown as PreviewSources;

function fakeStorybook(extend: (config: InlineConfig) => InlineConfig = (config) => config) {
  return {
    mode: 'build',
    configDir: '',
    channel: new Channel({}),
    options: { configType: 'PRODUCTION' },
    callHook: async (name: string, value: unknown) =>
      name === 'builder:vite:extend' ? extend(value as InlineConfig) : value,
  } as unknown as Storybook;
}

it('keeps Vite from copying the public dir, which Storybook copies through staticDirs', async () => {
  await build(fakeStorybook(), { preview: PREVIEW, options: {}, outDir: 'storybook-static' });

  expect(viteBuild).toHaveBeenCalledWith(
    expect.objectContaining({
      build: expect.objectContaining({
        copyPublicDir: false,
      }),
    })
  );
});

it("re-asserts Storybook's build options when a user plugin's config hook overrides them", async () => {
  // Mimics @adonisjs/vite, whose `config` hook returns hardcoded build options that would
  // otherwise win Vite's config merge and empty Storybook's output directory mid-build.
  const clobberingPlugin: Plugin = {
    name: 'test:clobber-build-options',
    enforce: 'post',
    config: () => ({
      build: { outDir: 'clobbered', emptyOutDir: true },
    }),
    configEnvironment: () => ({
      build: { outDir: 'clobbered', emptyOutDir: true },
    }),
  };

  await build(
    fakeStorybook((config) => ({
      ...config,
      plugins: [...(config.plugins ?? []), clobberingPlugin],
    })),
    { preview: PREVIEW, options: {}, outDir: 'storybook-static-test' }
  );

  const finalConfig = vi.mocked(viteBuild).mock.lastCall?.[0] as InlineConfig;
  const guardPlugins = (finalConfig.plugins ?? []).filter(
    (p): p is Plugin =>
      !!p && !Array.isArray(p) && 'name' in p && p.name === 'storybook:enforce-build-options'
  );

  const resolved = await resolveConfig(
    {
      configFile: false,
      logLevel: 'silent',
      root: process.cwd(),
      build: finalConfig.build,
      plugins: [clobberingPlugin, ...guardPlugins],
    },
    'build'
  );

  const enforced = {
    outDir: 'storybook-static-test',
    emptyOutDir: false,
  };
  expect(resolved.build).toMatchObject(enforced);
  expect(resolved.environments.client.build).toMatchObject(enforced);
});
