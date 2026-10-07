import { existsSync } from 'node:fs';
import { cp } from 'node:fs/promises';
import { resolve } from 'node:path';

import { Channel } from 'storybook/internal/channels';
import type { Presets } from 'storybook/internal/types';

import type { InlineConfig, Plugin } from 'vite';
import { resolveConfig, build as viteBuild } from 'vite';
import { afterEach, expect, it, vi } from 'vitest';

import { build } from './build.ts';

vi.mock('node:fs', { spy: true });
vi.mock('node:fs/promises', { spy: true });
vi.mock(import('vite'), async (importOriginal) => ({
  ...(await importOriginal()),
  build: vi.fn(async () => []),
  loadConfigFromFile: vi.fn(async () => null),
}));

afterEach(() => {
  vi.mocked(existsSync).mockReset();
  vi.mocked(cp).mockReset();
});

it('keeps Vite from copying the public dir during its own build', async () => {
  await build({
    configType: 'PRODUCTION',
    configDir: '',
    channel: new Channel({}),
    presets: {
      apply: async (key: string, config: unknown) =>
        ({ core: { builder: {} }, viteFinal: config })[key],
    } as Presets,
  });

  expect(viteBuild).toHaveBeenCalledWith(
    expect.objectContaining({
      build: expect.objectContaining({
        copyPublicDir: false,
      }),
    })
  );
});

it('does not copy public assets when viteFinal disables publicDir', async () => {
  vi.mocked(existsSync).mockReturnValue(true);
  vi.mocked(cp).mockResolvedValue();

  await build({
    configType: 'PRODUCTION',
    configDir: '/project/.storybook',
    outputDir: '/project/storybook-static',
    channel: new Channel({}),
    presets: {
      apply: async (key: string, config: InlineConfig) =>
        ({ core: { builder: {} }, viteFinal: { ...config, publicDir: false } })[key],
    } as Presets,
  });

  expect(cp).not.toHaveBeenCalled();
});

it('copies a custom publicDir from viteFinal without overriding staticDirs or Storybook files', async () => {
  vi.mocked(existsSync).mockReturnValue(true);
  vi.mocked(cp).mockResolvedValue();

  await build({
    configType: 'PRODUCTION',
    configDir: '/project/.storybook',
    outputDir: '/project/storybook-static',
    channel: new Channel({}),
    presets: {
      apply: async (key: string, config: InlineConfig) =>
        ({ core: { builder: {} }, viteFinal: { ...config, publicDir: 'assets/public' } })[key],
    } as Presets,
  });

  expect(cp).toHaveBeenCalledWith(
    resolve('/project/assets/public'),
    '/project/storybook-static',
    expect.objectContaining({ force: false, recursive: true })
  );

  const filter = vi.mocked(cp).mock.lastCall?.[2]?.filter;
  expect(
    filter?.('/project/assets/public/index.json', '/project/storybook-static/index.json')
  ).toBe(false);
  expect(filter?.('/project/assets/public/asset.txt', '/project/storybook-static/asset.txt')).toBe(
    true
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
