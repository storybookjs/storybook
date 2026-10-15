import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { InlineConfig } from 'vitest/node';

import { validateConfigurationFiles } from 'storybook/internal/common';
import { StoryIndexGenerator, experimental_loadStorybook } from 'storybook/internal/core-server';
import { isTelemetryModuleEnabled } from 'storybook/internal/telemetry';

import { storybookTest } from './index.ts';

const REPO_ROOT = '/repo';
const PACKAGE_ROOT = '/repo/apps/storybook';
const CONFIG_DIR = '/repo/apps/storybook/.storybook';

vi.mock('storybook/internal/common', { spy: true });
vi.mock('storybook/internal/core-server', { spy: true });
vi.mock('storybook/internal/telemetry', { spy: true });

const presetApply = vi.fn();

beforeEach(() => {
  vi.stubEnv('VITEST', 'true');

  presetApply.mockImplementation(async (key: string, fallback?: unknown) => {
    switch (key) {
      case 'stories':
        return ['../stories/**/*.stories.tsx'];
      case 'framework':
        return { name: '@storybook/react-vite' };
      // Mirrors a project without its own `viteFinal`: the common config is returned untouched,
      // so the root the plugin proposes is the root it ends up returning.
      case 'viteFinal':
        return fallback;
      case 'core':
        return { disableTelemetry: true };
      default:
        return fallback;
    }
  });

  vi.mocked(experimental_loadStorybook).mockResolvedValue({
    presets: { apply: presetApply },
  } as unknown as Awaited<ReturnType<typeof experimental_loadStorybook>>);
  vi.mocked(StoryIndexGenerator.findMatchingFilesForSpecifiers).mockResolvedValue([]);
  vi.mocked(validateConfigurationFiles).mockResolvedValue(undefined as never);
  vi.mocked(isTelemetryModuleEnabled).mockReturnValue(false);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

/** Runs the plugin's `config` hook the way Vitest does, and returns the config it contributes. */
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
    const applyPreset = presetApply.getMockImplementation()!;
    presetApply.mockImplementation(async (key: string, fallback?: unknown) => {
      switch (key) {
        case 'frameworkOptions':
          return { strictMode: true };
        case 'previewHead':
          return '<meta name="preview-head" />';
        default:
          return applyPreset(key, fallback);
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
});

describe('dependency prebundling', () => {
  // The project-annotations setup file loads the framework renderer's entry previews through a
  // virtual module, and the renderer chunks contain a bare `import React from 'react'`. Browser
  // mode pre-bundles only the explicit `include` entries — there is no HTML-entry discovery — so
  // when `react` itself is missing from that list the browser loads react's CJS index.js raw and
  // module linking fails with "The requested module 'react/index.js' does not provide an export
  // named 'default'".
  it('prebundles react when the framework renders react components', async () => {
    const { optimizeDeps } = await getPluginConfig(REPO_ROOT);

    expect(optimizeDeps?.include).toContain('react');
  });

  describe('non-react frameworks', () => {
    beforeEach(() => {
      const applyPreset = presetApply.getMockImplementation()!;
      presetApply.mockImplementation(async (key: string, fallback?: unknown) => {
        if (key === 'framework') {
          return { name: '@storybook/vue3-vite' };
        }
        return applyPreset(key, fallback);
      });
    });

    it('does not prebundle react', async () => {
      const { optimizeDeps } = await getPluginConfig(REPO_ROOT);

      expect(optimizeDeps?.include).not.toContain('react');
    });
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
