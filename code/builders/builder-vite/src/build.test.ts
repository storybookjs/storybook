import { Channel } from 'storybook/internal/channels';
import type { Presets } from 'storybook/internal/types';

import type { InlineConfig, Plugin, ViteBuilder } from 'vite';
import { createBuilder, resolveConfig } from 'vite';
import { expect, it, vi } from 'vitest';

import { build } from './build.ts';

const buildApp = vi.hoisted(() => vi.fn(async () => {}));

vi.mock(import('vite'), async (importOriginal) => ({
  ...(await importOriginal()),
  createBuilder: vi.fn(async () => ({ buildApp }) as unknown as ViteBuilder),
  loadConfigFromFile: vi.fn(async () => null),
}));

it("builds as `vite build` does, with Vite's app builder", async () => {
  await build({
    configType: 'PRODUCTION',
    configDir: '',
    channel: new Channel({}),
    presets: {
      apply: async (key: string, config: unknown) =>
        ({ core: { builder: {} }, viteFinal: config })[key],
    } as Presets,
  });

  // `null` builds only the client environment, unless the config sets `builder`.
  expect(createBuilder).toHaveBeenCalledWith(expect.any(Object), null);
  expect(buildApp).toHaveBeenCalledOnce();
});

it('keeps Vite from copying the public dir, which Storybook copies through staticDirs', async () => {
  await build({
    configType: 'PRODUCTION',
    configDir: '',
    channel: new Channel({}),
    presets: {
      apply: async (key: string, config: unknown) =>
        ({ core: { builder: {} }, viteFinal: config })[key],
    } as Presets,
  });

  expect(createBuilder).toHaveBeenCalledWith(
    expect.objectContaining({
      build: expect.objectContaining({
        copyPublicDir: false,
      }),
    }),
    null
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

  await build({
    configType: 'PRODUCTION',
    configDir: '',
    outputDir: 'storybook-static-test',
    channel: new Channel({}),
    presets: {
      apply: async (key: string, config?: InlineConfig) =>
        ({
          core: { builder: {} },
          viteFinal: { ...config, plugins: [...(config?.plugins ?? []), clobberingPlugin] },
        })[key],
    } as Presets,
  });

  const finalConfig = vi.mocked(createBuilder).mock.lastCall?.[0] as InlineConfig;
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
