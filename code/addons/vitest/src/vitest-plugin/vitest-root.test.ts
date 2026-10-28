import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mergeConfig } from 'vitest/config';
import type { InlineConfig } from 'vitest/node';

import { validateConfigurationFiles } from '@storybook/core/internal/common';
import { StoryIndexGenerator } from '@storybook/core/internal/story-index';
import { isTelemetryModuleEnabled } from '@storybook/core/internal/telemetry';
import { createStorybook } from 'storybook/internal/instance';
import { getPreviewSources } from 'storybook/internal/preview-page';

import { viteCorePlugins } from '@storybook/builder-vite/node';

import { storybookTest } from './index.ts';

const REPO_ROOT = '/repo';
const PACKAGE_ROOT = '/repo/apps/storybook';
const CONFIG_DIR = '/repo/apps/storybook/.storybook';
const PREVIEW_SOURCES = { previewConfigPath: '/repo/apps/storybook/.storybook/preview.ts' };

vi.mock('@storybook/core/internal/common', { spy: true });
vi.mock('@storybook/core/internal/story-index', { spy: true });
vi.mock('storybook/internal/instance', { spy: true });
vi.mock('@storybook/core/internal/telemetry', { spy: true });
vi.mock('storybook/internal/preview-page', () => ({ getPreviewSources: vi.fn() }));
vi.mock('@storybook/builder-vite/node', () => ({ viteCorePlugins: vi.fn() }));

const presetApply = vi.fn();
const callHook = vi.fn();
const close = vi.fn();

beforeEach(() => {
  vi.stubEnv('VITEST', 'true');

  presetApply.mockImplementation(async (_key: string, fallback?: unknown) => fallback);
  close.mockResolvedValue(undefined);
  callHook.mockImplementation(async (key: string, fallback?: unknown) => {
    switch (key) {
      case 'core:config:extend':
        return { disableTelemetry: true };
      default:
        return fallback;
    }
  });
  vi.mocked(getPreviewSources).mockResolvedValue(
    PREVIEW_SOURCES as Awaited<ReturnType<typeof getPreviewSources>>
  );
  vi.mocked(viteCorePlugins).mockResolvedValue([]);
  vi.mocked(createStorybook).mockResolvedValue({
    options: {
      stories: ['../stories/**/*.stories.tsx'],
      framework: { meta: { name: '@storybook/react-vite', kind: 'framework' } },
      staticDirs: [],
      features: { docgenServer: true },
    },
    presets: { apply: presetApply },
    callHook,
    close,
  } as unknown as Awaited<ReturnType<typeof createStorybook>>);
  vi.mocked(StoryIndexGenerator.findMatchingFilesForSpecifiers).mockResolvedValue([]);
  vi.mocked(validateConfigurationFiles).mockResolvedValue(undefined as never);
  vi.mocked(isTelemetryModuleEnabled).mockReturnValue(false);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

async function getPluginConfig(invokingRoot: string, inputTestConfig?: InlineConfig) {
  const plugins = await storybookTest({ configDir: CONFIG_DIR });
  const plugin = plugins.find((p) => p.name === 'vite-plugin-storybook-test')!;

  const configHook = plugin.config!;
  const handler = typeof configHook === 'function' ? configHook : configHook.handler;

  const config = await handler.call(
    {
      meta: { rollupVersion: '4.0.0', viteVersion: '7.0.0' },
      debug: () => {},
      info: () => {},
      warn: () => {},
      error: (message: unknown): never => {
        throw new Error(String(message));
      },
    },
    { root: invokingRoot, test: inputTestConfig },
    { command: 'serve', mode: 'development' }
  );

  if (!config || !config.test) {
    throw new Error('The plugin config hook returned no test config');
  }

  return { root: config.root, test: config.test, optimizeDeps: config.optimizeDeps, plugin };
}

describe('story test patterns', () => {
  // The plugin sets the project root itself, so story globs have to be written relative to that
  // root rather than to whichever root Vitest happened to be invoked with. When a Vitest config
  // lives above the package — a monorepo root — the two differ, and globs built against the
  // invoking root resolve outside the project and match no story files at all, silently.
  it('resolves story globs against the root it returns, not the invoking root', async () => {
    const config = await getPluginConfig(REPO_ROOT);

    expect(config.root).toBe(PACKAGE_ROOT);
    expect(config.test.include).toEqual(['stories/**/*.stories.tsx']);
  });

  it('resolves story globs the same way when the invoking root already matches', async () => {
    const config = await getPluginConfig(PACKAGE_ROOT);

    expect(config.root).toBe(PACKAGE_ROOT);
    expect(config.test.include).toEqual(['stories/**/*.stories.tsx']);
  });
});

describe('preview html', () => {
  it('sets the framework options global ahead of the preview head', async () => {
    const applyHook = callHook.getMockImplementation()!;
    callHook.mockImplementation(async (key: string, fallback?: unknown) => {
      switch (key) {
        case 'core:framework-options:extend':
          return { strictMode: true };
        case 'preview:head:extend':
          return '<meta name="preview-head" />';
        default:
          return applyHook(key, fallback);
      }
    });

    const plugins = await storybookTest({ configDir: CONFIG_DIR });
    const plugin = plugins.find((p) => p.name === 'vite-plugin-storybook-test')!;
    const transformIndexHtml = plugin.transformIndexHtml as (html: string) => Promise<string>;

    expect(await transformIndexHtml('<html><head></head><body></body></html>')).toBe(
      '<html><head><script>window.FRAMEWORK_OPTIONS = {"strictMode":true};</script><meta name="preview-head" /></head><body></body></html>'
    );
  });
});

describe('internal setup files', () => {
  it('preserves the Vitest runtime includes during server setup', async () => {
    const { optimizeDeps, plugin } = await getPluginConfig(REPO_ROOT);
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

    await (plugin.configureServer as (server: unknown) => Promise<void>)(server);

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
    expect(createStorybook).toHaveBeenCalledWith({
      configDir: CONFIG_DIR,
      workingDir: process.cwd(),
      mode: 'headless',
    });
    expect(Object.values(test.provide ?? {})).toContainEqual({ docgenServer: true });
    const storybook = await vi.mocked(createStorybook).mock.results[0].value;
    expect(getPreviewSources).toHaveBeenCalledWith(storybook, { hmr: 'vite' });
    expect(viteCorePlugins).toHaveBeenCalledWith(storybook, PREVIEW_SOURCES);
    expect(presetApply).not.toHaveBeenCalled();
    expect(callHook).toHaveBeenCalledWith('builder:vite:extend', { root: PACKAGE_ROOT });
    expect(callHook).toHaveBeenCalledWith('core:env:extend', {});
  });

  it('closes the instance when Vitest closes the bundle', async () => {
    const { plugin } = await getPluginConfig(REPO_ROOT);
    const hook = plugin.closeBundle!;
    const handler = typeof hook === 'function' ? hook : hook.handler;
    await handler.call({} as never);
    expect(close).toHaveBeenCalledOnce();
  });

  it('closes the instance if plugin creation fails', async () => {
    callHook.mockRejectedValueOnce(new Error('Invalid Vite config'));
    await expect(storybookTest({ configDir: CONFIG_DIR })).rejects.toThrow('Invalid Vite config');
    expect(close).toHaveBeenCalledOnce();
  });
});
