import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { configDefaults, mergeConfig } from 'vitest/config';
import type { InlineConfig } from 'vitest/node';

import { validateConfigurationFiles } from 'storybook/internal/common';
import { StoryIndexGenerator, experimental_loadStorybook } from 'storybook/internal/core-server';
import { isTelemetryModuleEnabled } from 'storybook/internal/telemetry';

import { glob } from 'tinyglobby';

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

  return { root: config.root, test: config.test, plugin };
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

describe('test exclude', () => {
  beforeEach(() => {
    // The plugin excludes MDX files below the working directory.
    const cwd = vi.spyOn(process, 'cwd').mockReturnValue(PACKAGE_ROOT);
    return () => cwd.mockRestore();
  });

  const useStories = (stories: string[]) => {
    const applyPreset = presetApply.getMockImplementation()!;
    presetApply.mockImplementation(async (key: string, fallback?: unknown) =>
      key === 'stories' ? stories : applyPreset(key, fallback)
    );
  };

  it("keeps Vitest's default exclude when the user sets none", async () => {
    const { test } = await getPluginConfig(PACKAGE_ROOT);

    expect(test.exclude).toEqual([...configDefaults.exclude, '**/*.mdx']);
  });

  it("uses the user's exclude instead of Vitest's default", async () => {
    const { test } = await getPluginConfig(PACKAGE_ROOT, { exclude: ['**/legacy/**'] });

    expect(test.exclude).toEqual(['**/legacy/**', '**/*.mdx']);
  });

  // Vitest matches excludes against root-relative paths, and `**` never matches `..`. Without
  // the rebased patterns, stories under `node_modules` outside the root are collected.
  it('applies the exclude below story globs outside the Vitest root', async () => {
    useStories(['../../../packages/ui/src/**/*.stories.tsx', '../stories/**/*.stories.tsx']);

    const { test } = await getPluginConfig(PACKAGE_ROOT, { exclude: ['**/node_modules/**'] });

    expect(test.include).toEqual([
      '../../packages/ui/src/**/*.stories.tsx',
      'stories/**/*.stories.tsx',
    ]);
    expect(test.exclude).toEqual([
      '**/node_modules/**',
      '../../packages/ui/src/**/node_modules/**',
      '**/*.mdx',
    ]);
  });

  it('does not collect stories inside node_modules outside the Vitest root', async () => {
    useStories(['../../../packages/ui/**/*.stories.tsx']);
    // The same layout as REPO_ROOT, on disk.
    const repoRoot = await mkdtemp(join(tmpdir(), 'storybook-vitest-exclude-'));

    try {
      for (const file of [
        'packages/ui/src/Button.stories.tsx',
        'packages/ui/node_modules/some-dep/Fake.stories.tsx',
      ]) {
        await mkdir(dirname(join(repoRoot, file)), { recursive: true });
        await writeFile(join(repoRoot, file), '');
      }
      await mkdir(join(repoRoot, 'apps/storybook'), { recursive: true });

      const { test } = await getPluginConfig(PACKAGE_ROOT);

      // The options Vitest passes to tinyglobby when it collects test files.
      const files = await glob(test.include!, {
        cwd: join(repoRoot, 'apps/storybook'),
        ignore: test.exclude,
        expandDirectories: false,
        dot: true,
      });

      expect(files).toEqual(['../../packages/ui/src/Button.stories.tsx']);
    } finally {
      await rm(repoRoot, { recursive: true, force: true });
    }
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
