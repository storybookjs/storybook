import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { InlineConfig } from 'vitest/node';

import { getInterpretedFile, validateConfigurationFiles } from 'storybook/internal/common';
import { StoryIndexGenerator, experimental_loadStorybook } from 'storybook/internal/core-server';

import { storybookTest } from './index';

vi.mock('storybook/internal/common', { spy: true });
vi.mock('storybook/internal/core-server', { spy: true });

const CONFIG_DIR = '/repo/.storybook';

const presetApply = vi.fn();

beforeEach(() => {
  presetApply.mockImplementation(async (key: string, fallback?: unknown) => {
    switch (key) {
      case 'stories':
        return ['../stories/**/*.stories.tsx'];
      case 'framework':
        return { name: '@storybook/react-vite' };
      default:
        return fallback;
    }
  });

  vi.mocked(experimental_loadStorybook).mockResolvedValue({
    presets: { apply: presetApply },
  } as unknown as Awaited<ReturnType<typeof experimental_loadStorybook>>);
  vi.mocked(StoryIndexGenerator).mockImplementation(
    () =>
      ({
        initialize: async () => {},
        storyFileNames: () => [],
      }) as unknown as StoryIndexGenerator
  );
  vi.mocked(getInterpretedFile).mockReturnValue(undefined);
  vi.mocked(validateConfigurationFiles).mockResolvedValue(undefined as never);
});

/** Runs the plugin's `config` hook the way Vitest does, and returns the config it contributes. */
async function getPluginConfig(inputTestConfig?: InlineConfig) {
  const plugins = await storybookTest({ configDir: CONFIG_DIR });
  const plugin = plugins.find((p) => p.name === 'vite-plugin-storybook-test')!;

  const configHook = plugin.config!;
  const handler = typeof configHook === 'function' ? configHook : configHook.handler;

  const config = await handler(
    { root: '/repo', test: inputTestConfig },
    { command: 'serve', mode: 'development' }
  );

  if (!config || !config.test) {
    throw new Error('The plugin config hook returned no test config');
  }

  return { test: config.test };
}

describe('browser API permissions', () => {
  it('disallows file writes and command execution from the browser by default', async () => {
    const { test } = await getPluginConfig({ browser: { enabled: true } });

    expect(test.browser?.api).toEqual({ allowWrite: false, allowExec: false });
  });

  it('keeps a browser API port given as a number', async () => {
    const { test } = await getPluginConfig({ browser: { api: 63400 } });

    expect(test.browser?.api).toEqual({ port: 63400, allowWrite: false, allowExec: false });
  });

  it('keeps permissions the user set explicitly', async () => {
    const { test } = await getPluginConfig({
      browser: { api: { host: '127.0.0.1', allowWrite: true, allowExec: true } as never },
    });

    expect(test.browser?.api).toEqual({ host: '127.0.0.1', allowWrite: true, allowExec: true });
  });
});
