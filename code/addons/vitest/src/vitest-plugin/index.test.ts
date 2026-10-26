import { Module, createRequire } from 'node:module';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ViteUserConfig } from 'vitest/config';

import { validateConfigurationFiles } from 'storybook/internal/common';

const PACKAGE_ROOT = '/repo/apps/storybook';
const CONFIG_DIR = '/repo/apps/storybook/.storybook';

vi.mock('storybook/internal/common', async (importOriginal) => ({
  ...(await importOriginal<typeof import('storybook/internal/common')>()),
  validateConfigurationFiles: vi.fn(),
}));

// The plugin loads core-server through a native `require`, which `vi.mock` cannot intercept, so
// the stub is placed in the require cache before the plugin module is imported.
const presetApply = vi.fn();
const coreServer = {
  experimental_loadStorybook: vi.fn(),
  StoryIndexGenerator: { findMatchingFilesForSpecifiers: vi.fn(), storyFileNames: vi.fn() },
  mapStaticDir: vi.fn(),
};
const require = createRequire(import.meta.url);
const coreServerId = require.resolve('storybook/internal/core-server');
const coreServerModule = new Module(coreServerId);
coreServerModule.exports = coreServer;
coreServerModule.loaded = true;
require.cache[coreServerId] = coreServerModule;

const { storybookTest } = await import('./index');

beforeEach(() => {
  vi.stubEnv('VITEST', 'true');

  presetApply.mockImplementation(async (key: string, fallback?: unknown) => {
    switch (key) {
      case 'stories':
        return ['../stories/**/*.stories.tsx'];
      case 'framework':
        return { name: '@storybook/react-vite' };
      case 'core':
        return { disableTelemetry: true };
      default:
        return fallback;
    }
  });

  coreServer.experimental_loadStorybook.mockResolvedValue({ presets: { apply: presetApply } });
  coreServer.StoryIndexGenerator.findMatchingFilesForSpecifiers.mockResolvedValue([]);
  coreServer.StoryIndexGenerator.storyFileNames.mockReturnValue([]);
  vi.mocked(validateConfigurationFiles).mockResolvedValue(undefined as never);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

/** Runs the plugin's `config` hook the way Vitest does, and returns the config it contributes. */
async function getPluginConfig(invokingRoot: string, inputTestConfig?: ViteUserConfig['test']) {
  const plugins = await storybookTest({ configDir: CONFIG_DIR });
  const plugin = plugins.find((p) => p.name === 'vite-plugin-storybook-test')!;

  const configHook = plugin.config!;
  const handler = typeof configHook === 'function' ? configHook : configHook.handler;

  const config = await handler.call(
    {
      meta: { rollupVersion: '4.0.0', viteVersion: '6.0.0' },
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

  return { test: config.test, plugin };
}

describe('browser API permissions', () => {
  it('disallows file writes and command execution from the browser by default', async () => {
    const { test } = await getPluginConfig(PACKAGE_ROOT, { browser: { enabled: true } });

    expect(test.browser?.api).toEqual({ allowWrite: false, allowExec: false });
  });

  it('keeps a browser API port given as a number', async () => {
    const { test } = await getPluginConfig(PACKAGE_ROOT, { browser: { api: 63400 } });

    expect(test.browser?.api).toEqual({ port: 63400, allowWrite: false, allowExec: false });
  });

  it('keeps permissions the user set explicitly', async () => {
    const userApi = { host: '127.0.0.1', allowWrite: true, allowExec: true };
    const { test } = await getPluginConfig(PACKAGE_ROOT, { browser: { api: userApi } });

    expect(test.browser?.api).toEqual(userApi);
  });
});
