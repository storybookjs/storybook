import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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
async function getPluginConfig(invokingRoot: string) {
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
    { root: invokingRoot },
    { command: 'serve', mode: 'development' }
  );

  if (!config || !config.test) {
    throw new Error('The plugin config hook returned no test config');
  }

  return { root: config.root, test: config.test };
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
