import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Plugin } from 'vitest/config';

const REPO_ROOT = '/repo';
const PACKAGE_ROOT = '/repo/apps/storybook';
const CONFIG_DIR = '/repo/apps/storybook/.storybook';

const presetApply = vi.fn(async (key: string, fallback?: unknown) => {
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

vi.mock('storybook/internal/core-server', () => ({
  experimental_loadStorybook: vi.fn(async () => ({ presets: { apply: presetApply } })),
  StoryIndexGenerator: {
    findMatchingFilesForSpecifiers: vi.fn(async () => []),
    storyFileNames: vi.fn(() => []),
  },
  Tag: { TEST: 'test' },
  mapStaticDir: vi.fn(),
}));

vi.mock('storybook/internal/common', async (importOriginal) => ({
  ...(await importOriginal<typeof import('storybook/internal/common')>()),
  validateConfigurationFiles: vi.fn(async () => {}),
  getInterpretedFile: vi.fn(() => undefined),
}));

vi.mock('storybook/internal/telemetry', () => ({
  detectAgent: vi.fn(() => undefined),
  isTelemetryModuleEnabled: vi.fn(() => false),
  isWithinInitialSession: vi.fn(async () => false),
  oneWayHash: vi.fn(() => 'project-hash'),
  telemetry: vi.fn(),
  setTelemetryEnabled: vi.fn(),
}));

vi.mock('storybook/internal/csf-tools', () => ({
  componentTransform: vi.fn(),
  readConfig: vi.fn(),
  vitestTransform: vi.fn(),
}));

const { storybookTest } = await import('./index.ts');

/** Runs the plugin's `config` hook the way Vitest does, and returns the config it contributes. */
async function getPluginConfig(invokingRoot: string) {
  const plugins = await storybookTest({ configDir: CONFIG_DIR });
  const plugin = plugins.find(
    (p) => (p as Plugin)?.name === 'vite-plugin-storybook-test'
  ) as Plugin;

  const configHook = plugin.config!;
  const handler = typeof configHook === 'function' ? configHook : configHook.handler;

  return handler.call({}, { root: invokingRoot }, { command: 'serve', mode: 'development' });
}

describe('story test patterns', () => {
  beforeEach(() => {
    vi.stubEnv('VITEST', 'true');
  });

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
