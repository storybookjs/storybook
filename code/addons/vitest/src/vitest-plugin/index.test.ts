import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const apply = vi.hoisted(() =>
  vi.fn(async (key: string, defaultValue?: unknown) => {
    switch (key) {
      case 'stories':
        return ['../src/**/*.stories.tsx'];
      case 'viteCorePlugins':
        return [];
      case 'framework':
        return '@storybook/react-vite';
      case 'viteFinal':
        return { plugins: [], root: process.cwd() };
      case 'staticDirs':
        return [];
      case 'core':
        return {};
      case 'features':
        return {};
      case 'env':
        return {};
      case 'previewHead':
      case 'previewBody':
        return '';
      case 'optimizeViteDeps':
        return ['react-dom/test-utils', 'react/jsx-dev-runtime'];
      default:
        return defaultValue;
    }
  })
);

vi.mock('storybook/internal/common', () => ({
  DEFAULT_FILES_PATTERN: '**/*.stories.@(ts|tsx|js|jsx|mjs|cjs)',
  getInterpretedFile: vi.fn(),
  loadPreviewOrConfigFile: vi.fn(() => undefined),
  normalizeStories: vi.fn((stories: unknown) => stories),
  optionalEnvToBoolean: (value: unknown) => value === true || value === 'true',
  resolvePathInStorybookCache: vi.fn(
    (name: string, cacheKey: string) => `/cache/${name}/${cacheKey}`
  ),
  validateConfigurationFiles: vi.fn(),
}));

vi.mock('storybook/internal/core-server', () => ({
  StoryIndexGenerator: {
    findMatchingFilesForSpecifiers: vi.fn(async () => []),
    storyFileNames: vi.fn(() => []),
  },
  Tag: { TEST: 'test' },
  experimental_loadStorybook: vi.fn(async () => ({
    presets: {
      apply,
    },
  })),
  mapStaticDir: vi.fn(),
}));

vi.mock('storybook/internal/csf-tools', () => ({
  componentTransform: vi.fn(),
  isCsfFactoryPreview: vi.fn(() => false),
  readConfig: vi.fn(),
  vitestTransform: vi.fn(),
}));

vi.mock('storybook/internal/telemetry', () => ({
  oneWayHash: vi.fn(() => 'project-id'),
  telemetry: vi.fn(),
}));

vi.mock('storybook/internal/server-errors', () => ({
  MainFileMissingError: class MainFileMissingError extends Error {},
}));

vi.mock('./utils', () => ({
  requiresProjectAnnotations: vi.fn(async () => false),
}));

import { storybookTest } from './index';

describe('storybookTest', () => {
  beforeEach(() => {
    process.env.VITEST = 'true';
  });

  afterEach(() => {
    delete process.env.VITEST;
    delete process.env.VITEST_STORYBOOK;
    delete process.env.BUILD_TARGET;
    vi.clearAllMocks();
  });

  it('includes preset-provided optimize deps in the Vitest config', async () => {
    const plugins = await storybookTest({ configDir: '.storybook' });
    const plugin = plugins.find(({ name }) => name === 'vite-plugin-storybook-test');

    expect(plugin?.config).toBeTypeOf('function');

    const config = await plugin!.config!(
      { root: process.cwd(), test: {} } as never,
      {
        mode: 'test',
      } as never
    );

    expect(apply).toHaveBeenCalledWith('optimizeViteDeps', []);
    expect(config.optimizeDeps?.include).toEqual(
      expect.arrayContaining(['react-dom/test-utils', 'react/jsx-dev-runtime'])
    );
  });
});
