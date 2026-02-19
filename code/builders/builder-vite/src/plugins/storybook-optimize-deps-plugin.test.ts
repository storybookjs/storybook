import { describe, expect, it, vi } from 'vitest';

import type { Options, Presets, StoryIndex } from 'storybook/internal/types';

import { storybookOptimizeDepsPlugin } from './storybook-optimize-deps-plugin';

vi.mock('storybook/internal/common', () => ({
  loadPreviewOrConfigFile: vi.fn(() => undefined),
}));

const { loadPreviewOrConfigFile } = await import('storybook/internal/common');
const loadPreviewOrConfigFileMock = vi.mocked(loadPreviewOrConfigFile);

const storyIndex: StoryIndex = {
  v: 5,
  entries: {
    'story-one': {
      id: 'story-one',
      title: 'Story One',
      name: 'Default',
      importPath: './src/Story.stories.ts',
      type: 'story',
      subtype: 'story',
    },
    'story-two': {
      id: 'story-two',
      title: 'Story Two',
      name: 'Default',
      importPath: './src/Story.stories.ts', // duplicate, should be deduped
      type: 'story',
      subtype: 'story',
    },
    'story-three': {
      id: 'story-three',
      title: 'Story Three',
      name: 'Default',
      importPath: './src/Other.stories.ts',
      type: 'story',
      subtype: 'story',
    },
  },
};

const storyIndexGenerator = { getIndex: vi.fn(async () => storyIndex) };

function makeOptions(overrides: Partial<Record<string, unknown>> = {}): Options {
  return {
    configType: 'DEVELOPMENT',
    configDir: '/project/.storybook',
    packageJson: {},
    presets: {
      apply: vi.fn(async (key: string) => {
        if (key === 'storyIndexGenerator') return storyIndexGenerator;
        if (key === 'optimizeViteDeps') return overrides.extraDeps ?? [];
        if (key === 'previewAnnotations') return overrides.previewAnnotations ?? [];
        return undefined;
      }),
    } as unknown as Presets,
    presetsList: [],
  };
}

describe('storybookOptimizeDepsPlugin', () => {
  it('returns a plugin with the correct name', () => {
    const plugin = storybookOptimizeDepsPlugin(makeOptions());
    expect(plugin.name).toBe('storybook:optimize-deps-plugin');
  });

  it('returns undefined (no-op) for non-serve commands', async () => {
    const plugin = storybookOptimizeDepsPlugin(makeOptions());
    const result = await (plugin.config as Function)({}, { command: 'build' });
    expect(result).toBeUndefined();
  });

  it('adds story import paths as optimizeDeps entries', async () => {
    const plugin = storybookOptimizeDepsPlugin(makeOptions());
    const result = await (plugin.config as Function)({}, { command: 'serve' });

    expect(result.optimizeDeps.entries).toContain('./src/Story.stories.ts');
    expect(result.optimizeDeps.entries).toContain('./src/Other.stories.ts');
  });

  it('deduplicates story import paths', async () => {
    const plugin = storybookOptimizeDepsPlugin(makeOptions());
    const result = await (plugin.config as Function)({}, { command: 'serve' });

    const storyEntries = result.optimizeDeps.entries.filter((e: string) =>
      e.endsWith('Story.stories.ts')
    );
    expect(storyEntries).toHaveLength(1);
  });

  it('adds preview annotation files as optimizeDeps entries', async () => {
    const previewAnnotations = ['/project/addon/preview.ts', '/project/.storybook/preview.ts'];
    const plugin = storybookOptimizeDepsPlugin(makeOptions({ previewAnnotations }));
    const result = await (plugin.config as Function)({}, { command: 'serve' });

    expect(result.optimizeDeps.entries).toContain('/project/addon/preview.ts');
    expect(result.optimizeDeps.entries).toContain('/project/.storybook/preview.ts');
  });

  it('adds the user preview config file as an entry when it exists', async () => {
    loadPreviewOrConfigFileMock.mockReturnValueOnce('/project/.storybook/preview.ts' as any);
    const plugin = storybookOptimizeDepsPlugin(makeOptions());
    const result = await (plugin.config as Function)({}, { command: 'serve' });

    expect(result.optimizeDeps.entries).toContain('/project/.storybook/preview.ts');
  });

  it('skips undefined preview config file (no user preview)', async () => {
    loadPreviewOrConfigFileMock.mockReturnValueOnce(undefined as any);
    const plugin = storybookOptimizeDepsPlugin(makeOptions());
    const result = await (plugin.config as Function)({}, { command: 'serve' });

    expect(result.optimizeDeps.entries).not.toContain(undefined);
  });

  it('merges existing optimizeDeps entries from config', async () => {
    const plugin = storybookOptimizeDepsPlugin(makeOptions());
    const result = await (plugin.config as Function)(
      { optimizeDeps: { entries: ['/some/custom/entry.ts'] } },
      { command: 'serve' }
    );

    expect(result.optimizeDeps.entries).toContain('/some/custom/entry.ts');
    expect(result.optimizeDeps.entries).toContain('./src/Story.stories.ts');
  });

  it('handles a string entries value in existing config', async () => {
    const plugin = storybookOptimizeDepsPlugin(makeOptions());
    const result = await (plugin.config as Function)(
      { optimizeDeps: { entries: '/some/single/entry.ts' } },
      { command: 'serve' }
    );

    expect(result.optimizeDeps.entries).toContain('/some/single/entry.ts');
  });

  it('includes extra optimizeViteDeps from presets', async () => {
    const extraDeps = ['some-cjs-package', 'another-package'];
    const plugin = storybookOptimizeDepsPlugin(makeOptions({ extraDeps }));
    const result = await (plugin.config as Function)({}, { command: 'serve' });

    expect(result.optimizeDeps.include).toContain('some-cjs-package');
    expect(result.optimizeDeps.include).toContain('another-package');
  });

  it('merges existing optimizeDeps include from config', async () => {
    const plugin = storybookOptimizeDepsPlugin(makeOptions());
    const result = await (plugin.config as Function)(
      { optimizeDeps: { include: ['existing-dep'] } },
      { command: 'serve' }
    );

    expect(result.optimizeDeps.include).toContain('existing-dep');
  });
});
