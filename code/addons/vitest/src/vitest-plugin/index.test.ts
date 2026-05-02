import { beforeEach, describe, expect, it, vi } from 'vitest';

const vitestTransform = vi.hoisted(() => vi.fn(() => ({ code: 'transformed code' })));
const presetsApply = vi.hoisted(() => vi.fn());
const withoutVitePlugins = vi.hoisted(() => vi.fn(async (plugins) => plugins));

vi.mock('storybook/internal/common', () => ({
  DEFAULT_FILES_PATTERN: '**/*.stories.@(js|jsx|mjs|ts|tsx)',
  getInterpretedFile: vi.fn(() => undefined),
  normalizeStories: vi.fn((stories) => stories),
  optionalEnvToBoolean: vi.fn((value) => value === 'true'),
  resolvePathInStorybookCache: vi.fn((...parts) => parts.join('/')),
  validateConfigurationFiles: vi.fn(async () => {}),
}));

vi.mock('storybook/internal/core-server', () => ({
  StoryIndexGenerator: {
    findMatchingFilesForSpecifiers: vi.fn(async () => []),
    storyFileNames: vi.fn(() => []),
  },
  Tag: { TEST: 'test' },
  experimental_loadStorybook: vi.fn(async () => ({ presets: { apply: presetsApply } })),
  mapStaticDir: vi.fn(),
}));

vi.mock('storybook/internal/csf-tools', () => ({
  componentTransform: vi.fn(),
  readConfig: vi.fn(),
  vitestTransform,
}));

vi.mock('storybook/internal/server-errors', () => ({
  MainFileMissingError: class MainFileMissingError extends Error {},
}));

vi.mock('storybook/internal/telemetry', () => ({
  detectAgent: vi.fn(),
  isTelemetryModuleEnabled: vi.fn(() => false),
  isWithinInitialSession: vi.fn(),
  oneWayHash: vi.fn(() => 'project-id'),
  setTelemetryEnabled: vi.fn(async () => {}),
  telemetry: vi.fn(),
}));

vi.mock('../../../../builders/builder-vite/src/utils/without-vite-plugins.ts', () => ({
  withoutVitePlugins,
}));

vi.mock('./utils.ts', () => ({
  requiresProjectAnnotations: vi.fn(async () => false),
}));

describe('storybookTest transform matching', () => {
  const projectRoot = '/workspace/tést';

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.stubEnv('VITEST', 'true');
    vi.stubEnv('VITEST_STORYBOOK', 'false');

    presetsApply.mockImplementation(async (field, defaultValue) => {
      switch (field) {
        case 'stories':
          return ['../src/**/*.stories.svelte'];
        case 'viteCorePlugins':
          return [];
        case 'framework':
          return { name: '@storybook/svelte-vite' };
        case 'viteFinal':
          return { plugins: [], root: projectRoot };
        case 'staticDirs':
          return [];
        case 'core':
          return {};
        case 'features':
          return {};
        default:
          return defaultValue;
      }
    });
  });

  it('transforms URL-encoded story ids when the project path contains non-ASCII characters', async () => {
    const { storybookTest } = await import('./index.ts');
    const plugins = await storybookTest({ configDir: `${projectRoot}/.storybook` });
    const plugin = plugins.find((candidate) => candidate.name === 'vite-plugin-storybook-test');

    expect(plugin).toBeDefined();

    const configure = plugin!.config as unknown as (
      config: { root: string; test: Record<string, never> },
      env: { mode: string }
    ) => unknown | Promise<unknown>;
    const transform = plugin!.transform as unknown as (
      code: string,
      id: string
    ) => unknown | Promise<unknown>;

    await configure({ root: projectRoot, test: {} }, { mode: 'test' });
    const result = await transform(
      'export default {};',
      '/workspace/t%C3%A9st/src/stories/Button.stories.svelte'
    );

    expect(vitestTransform).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'export default {};',
        fileName: '/workspace/tést/src/stories/Button.stories.svelte',
        configDir: `${projectRoot}/.storybook`,
      })
    );
    expect(result).toEqual({ code: 'transformed code' });
  });
});
