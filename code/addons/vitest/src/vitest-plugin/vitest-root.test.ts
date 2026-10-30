import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mergeConfig, type Plugin, type ViteUserConfig } from 'vitest/config';
import type { InlineConfig } from 'vitest/node';

import type { StorybookAddon } from '@storybook/core';
import { validateConfigurationFiles } from '@storybook/core/internal/common';
import { StoryIndexGenerator } from '@storybook/core/internal/story-index';
import { isTelemetryModuleEnabled } from '@storybook/core/internal/telemetry';
import { createStorybook } from 'storybook/internal/instance';

import { vitePreviewPlugins } from '@storybook/builder-vite/node';

import { storybookTest } from './index.ts';

const REPO_ROOT = '/repo';
const PACKAGE_ROOT = '/repo/apps/storybook';
const CONFIG_DIR = '/repo/apps/storybook/.storybook';
const CONFIG_HOOK_ORDER: unknown[] = ['pre', undefined, 'post'];

vi.mock('@storybook/core/internal/common', { spy: true });
vi.mock('@storybook/core/internal/story-index', { spy: true });
vi.mock('storybook/internal/instance', { spy: true });
vi.mock('@storybook/core/internal/telemetry', { spy: true });
vi.mock('@storybook/builder-vite/node', () => ({ vitePreviewPlugins: vi.fn() }));

// Stands in for the preview host plugin, which follows the `builder:vite:extend` plugins and
// applies the extend config's root.
const PREVIEW_HOST_PLUGIN: Plugin = {
  name: 'preview-host',
  config: () => ({ root: PACKAGE_ROOT }),
};

type ExtendHandler = (config: ViteUserConfig) => Promise<ViteUserConfig>;

const presetApply = vi.fn();
const close = vi.fn();
const addAddon = vi.fn();

/** An instance that sets added addons up on `ready()` and reduces their `builder:vite:extend` handlers. */
function fakeStorybook(configDir: string): ReturnType<typeof createStorybook> {
  const added: StorybookAddon[] = [];
  const extendHandlers: ExtendHandler[] = [];
  const storybook = {
    configDir,
    options: {
      stories: ['../stories/**/*.stories.tsx'],
      framework: { meta: { name: '@storybook/react-vite', kind: 'framework' } },
      staticDirs: [],
      features: { docgenServer: true },
    },
    presets: { apply: presetApply },
    addAddon: addAddon.mockImplementation((addon: StorybookAddon) => added.push(addon)),
    hook: vi.fn((name: string, handler: ExtendHandler) => {
      if (name === 'builder:vite:extend') {
        extendHandlers.push(handler);
      }
    }),
    callHook: vi.fn(async (key: string, fallback?: unknown) => {
      switch (key) {
        case 'core:config:extend':
          return { disableTelemetry: true };
        case 'builder:vite:extend': {
          let config = fallback as ViteUserConfig;
          for (const handler of extendHandlers) {
            config = await handler(config);
          }
          return config;
        }
        default:
          return fallback;
      }
    }),
    async ready(): Promise<void> {
      for (const addon of added) {
        await addon.setup(storybook as never);
      }
    },
    close,
  };
  return storybook as unknown as ReturnType<typeof createStorybook>;
}

beforeEach(() => {
  vi.stubEnv('VITEST', 'true');

  presetApply.mockImplementation(async (_key: string, fallback?: unknown) => fallback);
  close.mockResolvedValue(undefined);
  vi.mocked(createStorybook).mockImplementation((input) => fakeStorybook(input.configDir));
  vi.mocked(vitePreviewPlugins).mockImplementation(async (storybook) => {
    const { plugins = [] } = await storybook.callHook('builder:vite:extend', {
      root: PACKAGE_ROOT,
    });
    return [...plugins, PREVIEW_HOST_PLUGIN];
  });
  vi.mocked(StoryIndexGenerator.findMatchingFilesForSpecifiers).mockResolvedValue([]);
  vi.mocked(validateConfigurationFiles).mockResolvedValue(undefined as never);
  vi.mocked(isTelemetryModuleEnabled).mockReturnValue(false);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

// Like Vite, config hooks run by their `order`, each seeing the config merged before it.
async function getPluginConfig(invokingRoot: string, inputTestConfig?: InlineConfig) {
  const plugins = await storybookTest({ configDir: CONFIG_DIR });
  const plugin = plugins.find((p) => p.name === 'vite-plugin-storybook-test')!;
  const hooks = plugins
    .flatMap(({ config: hook }) =>
      hook ? [typeof hook === 'function' ? { handler: hook } : hook] : []
    )
    .sort((a, b) => CONFIG_HOOK_ORDER.indexOf(a.order) - CONFIG_HOOK_ORDER.indexOf(b.order));

  let inputConfig: ViteUserConfig = { root: invokingRoot, test: inputTestConfig };
  let config: ViteUserConfig | undefined;
  for (const hook of hooks) {
    const result = await (hook.handler as (...args: unknown[]) => Promise<ViteUserConfig>).call(
      {
        meta: { rollupVersion: '4.0.0', viteVersion: '7.0.0' },
        debug: () => {},
        info: () => {},
        warn: () => {},
        error: (message: unknown): never => {
          throw new Error(String(message));
        },
      },
      inputConfig,
      { command: 'serve', mode: 'development' }
    );
    if (hook === plugin.config) {
      config = result;
    }
    inputConfig = result ? mergeConfig(inputConfig, result) : inputConfig;
  }

  if (!config || !config.test) {
    throw new Error('The plugin config hook returned no test config');
  }

  return { test: config.test, optimizeDeps: config.optimizeDeps, plugin, plugins };
}

describe('story test patterns', () => {
  // Story globs have to be relative to the root the preview plugins set, rather than to whichever
  // root Vitest happened to be invoked with. When a Vitest config lives above the package — a
  // monorepo root — the two differ, and globs built against the invoking root resolve outside
  // the project and match no story files at all, silently.
  it.each([
    { name: 'a monorepo root', invokingRoot: REPO_ROOT },
    { name: 'the package root', invokingRoot: PACKAGE_ROOT },
  ])(
    'resolves story globs against the preview root when invoked from $name',
    async ({ invokingRoot }) => {
      const { test } = await getPluginConfig(invokingRoot);

      expect(test.include).toEqual(['stories/**/*.stories.tsx']);
    }
  );

  it('lets an explicit test root win over the preview root', async () => {
    const { test } = await getPluginConfig(REPO_ROOT, { root: REPO_ROOT });

    expect(test.include).toEqual(['apps/storybook/stories/**/*.stories.tsx']);
  });
});

describe('internal setup files', () => {
  it('preserves the Vitest runtime includes during server setup', async () => {
    const { optimizeDeps, plugins } = await getPluginConfig(REPO_ROOT);
    const includes = [
      ...optimizeDeps!.include!,
      'vitest',
      'vitest/internal/browser',
      'vitest/internal/traces',
      'vitest > chai',
    ];
    const server = {
      config: { optimizeDeps: { ...optimizeDeps, include: [...includes] } },
      environments: {
        client: { config: { optimizeDeps: { ...optimizeDeps, include: [...includes] } } },
      },
    };

    for (const { configureServer } of plugins) {
      await (configureServer as ((server: unknown) => Promise<void>) | undefined)?.(server);
    }

    expect(optimizeDeps?.exclude).not.toContain('vitest');
    for (const config of [server.config, server.environments.client.config]) {
      expect(config.optimizeDeps.include).toEqual(includes);
    }
  });

  it('registers internal setup files', async () => {
    const { test, plugin } = await getPluginConfig(REPO_ROOT);
    const project = {
      config: { browser: { enabled: true }, setupFiles: ['/repo/my-own-setup.ts'] },
    };

    await (plugin.configureVitest as (context: unknown) => Promise<void>)({
      vitest: { config: { coverage: { exclude: [] }, reporters: [] } },
      project,
    });

    const resolve = (specifier: string) => fileURLToPath(import.meta.resolve(specifier));
    expect([...project.config.setupFiles, ...(test.setupFiles as string[])]).toEqual([
      '/repo/my-own-setup.ts',
      resolve('@storybook/addon-vitest/internal/setup-file.browser.4'),
      '@storybook/addon-vitest/internal/setup-file',
      '@storybook/addon-vitest/internal/setup-file-with-project-annotations',
    ]);
  });

  it.each([
    ['a string', '/repo/my-own-setup.ts'],
    ['an array', ['/repo/my-own-setup.ts']],
  ])("keeps the user's setup file exactly once when it is %s", async (_kind, setupFiles) => {
    const { test } = await getPluginConfig(PACKAGE_ROOT, { setupFiles });

    const merged = mergeConfig({ test: { setupFiles } }, { test });

    expect(merged.test.setupFiles).toEqual([
      '/repo/my-own-setup.ts',
      '@storybook/addon-vitest/internal/setup-file',
      '@storybook/addon-vitest/internal/setup-file-with-project-annotations',
    ]);
  });
});

describe('browser API permissions', () => {
  interface ApiPermissions {
    allowWrite?: boolean;
    allowExec?: boolean;
  }
  interface ProjectConfig {
    api: ApiPermissions;
    browser?: { enabled: boolean; api?: ApiPermissions };
  }

  const configureVitest = async (inputTestConfig: InlineConfig, projectConfig: ProjectConfig) => {
    const { plugin } = await getPluginConfig(PACKAGE_ROOT, inputTestConfig);
    const project = { config: { setupFiles: [], ...projectConfig } };
    await (plugin.configureVitest as (context: unknown) => Promise<void>)({
      vitest: { config: { coverage: { exclude: [] }, reporters: [] } },
      project,
    });
    return project.config;
  };

  // What Vitest resolves when the server is bound to loopback.
  const loopbackDefaults = (): ApiPermissions => ({ allowWrite: true, allowExec: true });

  it('disallows file writes and command execution from the browser by default', async () => {
    const config = await configureVitest(
      { browser: { enabled: true } },
      { api: loopbackDefaults(), browser: { enabled: true, api: loopbackDefaults() } }
    );

    expect(config.api).toEqual({ allowWrite: false, allowExec: false });
    expect(config.browser?.api).toEqual({ allowWrite: false, allowExec: false });
  });

  it('keeps permissions the user set on api', async () => {
    const config = await configureVitest(
      { browser: { enabled: true }, api: { allowWrite: true } },
      { api: loopbackDefaults(), browser: { enabled: true } }
    );

    expect(config.api).toEqual({ allowWrite: true, allowExec: false });
  });

  it('keeps permissions the user set on browser.api, as Vitest 4 reads them', async () => {
    const config = await configureVitest(
      { browser: { enabled: true, api: { allowExec: true } } } as InlineConfig,
      { api: loopbackDefaults(), browser: { enabled: true, api: loopbackDefaults() } }
    );

    expect(config.api).toEqual({ allowWrite: false, allowExec: true });
    expect(config.browser?.api).toEqual({ allowWrite: false, allowExec: true });
  });

  it('leaves permissions alone when browser mode is disabled', async () => {
    const config = await configureVitest({}, { api: loopbackDefaults() });

    expect(config.api).toEqual(loopbackDefaults());
  });
});

describe('instance lifecycle', () => {
  it('loads native framework options through the instance', async () => {
    const { test } = await getPluginConfig(REPO_ROOT);
    expect(Object.values(test.provide ?? {})).toContainEqual({ docgenServer: true });
    const storybook = vi.mocked(createStorybook).mock.results[0].value;
    expect(vi.mocked(vitePreviewPlugins).mock.calls).toEqual([[storybook]]);
    expect(addAddon.mock.calls.map(([addon]) => addon.meta)).toEqual([
      { name: '@storybook/addon-vitest/vitest-plugin', kind: 'addon' },
    ]);
    expect(presetApply).not.toHaveBeenCalled();
    expect(storybook.callHook).toHaveBeenCalledWith('core:env:extend', {});
  });

  it.each([
    {
      name: 'by default',
      input: {},
      expected: {
        overrides: { docs: { builderDocgen: false, mdx: false } },
        plugins: ['storybook:stub-mdx-plugin', 'vite-plugin-storybook-test', 'preview-host'],
      },
    },
    {
      name: 'with addon docs enabled',
      input: { disableAddonDocs: false },
      expected: {
        overrides: { docs: { builderDocgen: false } },
        plugins: ['vite-plugin-storybook-test', 'preview-host'],
      },
    },
  ])('turns builder docgen and MDX off through overrides $name', async ({ input, expected }) => {
    const plugins = await storybookTest({ configDir: CONFIG_DIR, ...input });
    expect({
      overrides: vi.mocked(createStorybook).mock.calls[0][0].overrides,
      plugins: plugins.map((plugin) => plugin.name),
    }).toEqual(expected);
    expect(vi.mocked(createStorybook).mock.calls[0][0]).toMatchObject({
      configDir: CONFIG_DIR,
      workingDir: process.cwd(),
      mode: 'headless',
    });
  });

  it('closes the instance when Vitest closes the bundle', async () => {
    const { plugin } = await getPluginConfig(REPO_ROOT);
    const hook = plugin.closeBundle!;
    const handler = typeof hook === 'function' ? hook : hook.handler;
    await handler.call({} as never);
    expect(close).toHaveBeenCalledOnce();
  });

  it('closes the instance if plugin creation fails', async () => {
    vi.mocked(vitePreviewPlugins).mockRejectedValueOnce(new Error('Invalid Vite config'));
    await expect(storybookTest({ configDir: CONFIG_DIR })).rejects.toThrow('Invalid Vite config');
    expect(close).toHaveBeenCalledOnce();
  });
});
