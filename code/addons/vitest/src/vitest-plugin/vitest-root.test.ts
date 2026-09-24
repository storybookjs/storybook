import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { validateConfigurationFiles } from 'storybook/internal/common';
import { StoryIndexGenerator, experimental_loadStorybook } from 'storybook/internal/core-server';
import { isTelemetryModuleEnabled } from 'storybook/internal/telemetry';
import type { NormalizedStoriesSpecifier, StoryIndex } from 'storybook/internal/types';

import { relative } from 'pathe';

import { storybookTest } from './index.ts';
import type { UserOptions } from './types.ts';

const REPO_ROOT = '/repo';
const PACKAGE_ROOT = '/repo/apps/storybook';
const CONFIG_DIR = '/repo/apps/storybook/.storybook';
const BUTTON_STORIES = '/repo/apps/storybook/stories/Button.stories.tsx';
const HEADER_STORIES = '/repo/apps/storybook/stories/Header.stories.tsx';

vi.mock('storybook/internal/common', { spy: true });
vi.mock('storybook/internal/core-server', { spy: true });
vi.mock('storybook/internal/telemetry', { spy: true });

const presetApply = vi.fn();

// The plugin relativizes index entries against the process cwd it captured at import time.
const storyEntry = (file: string, exportName: string, tags: string[]) =>
  ({
    type: 'story',
    subtype: 'story',
    id: `${file}--${exportName}`,
    name: exportName,
    title: file,
    importPath: relative(process.cwd(), file),
    tags,
  }) as StoryIndex['entries'][string];

const mockIndex = (...entries: StoryIndex['entries'][string][]) => {
  vi.spyOn(StoryIndexGenerator.prototype, 'getIndex').mockResolvedValue({
    v: 5,
    entries: Object.fromEntries(entries.map((entry) => [entry.id, entry])),
  });
};

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
  vi.mocked(StoryIndexGenerator.findMatchingFilesForSpecifiers).mockResolvedValue([
    [{} as NormalizedStoriesSpecifier, { [BUTTON_STORIES]: false, [HEADER_STORIES]: false }],
  ]);
  vi.spyOn(StoryIndexGenerator.prototype, 'initialize').mockResolvedValue();
  mockIndex(
    storyEntry(BUTTON_STORIES, 'Primary', ['dev', 'test']),
    storyEntry(HEADER_STORIES, 'LoggedIn', ['dev', 'test'])
  );
  vi.mocked(validateConfigurationFiles).mockResolvedValue(undefined as never);
  vi.mocked(isTelemetryModuleEnabled).mockReturnValue(false);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

/** Runs the plugin's `config` hook the way Vitest does, and returns the config it contributes. */
async function getPluginConfig(invokingRoot: string, options: UserOptions = {}) {
  const plugins = await storybookTest({ configDir: CONFIG_DIR, ...options });
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
  // The plugin sets the project root itself, so story files have to be listed relative to that
  // root rather than to whichever root Vitest happened to be invoked with. When a Vitest config
  // lives above the package — a monorepo root — the two differ, and paths built against the
  // invoking root resolve outside the project and match no story files at all, silently.
  it('lists story files relative to the root it returns, not the invoking root', async () => {
    const config = await getPluginConfig(REPO_ROOT);

    expect(config.root).toBe(PACKAGE_ROOT);
    expect(config.test.include).toEqual([
      'stories/Button.stories.tsx',
      'stories/Header.stories.tsx',
    ]);
  });

  it('lists story files the same way when the invoking root already matches', async () => {
    const config = await getPluginConfig(PACKAGE_ROOT);

    expect(config.root).toBe(PACKAGE_ROOT);
    expect(config.test.include).toEqual([
      'stories/Button.stories.tsx',
      'stories/Header.stories.tsx',
    ]);
  });
});

describe('story file selection', () => {
  it('leaves out story files whose stories are all excluded by the tags filter', async () => {
    mockIndex(
      storyEntry(BUTTON_STORIES, 'Primary', ['dev', 'test']),
      storyEntry(HEADER_STORIES, 'LoggedIn', ['dev'])
    );

    const config = await getPluginConfig(PACKAGE_ROOT);

    expect(config.test.include).toEqual(['stories/Button.stories.tsx']);
  });

  it('keeps story files whose only matching story is skipped', async () => {
    mockIndex(
      storyEntry(BUTTON_STORIES, 'Primary', ['dev', 'test']),
      storyEntry(HEADER_STORIES, 'LoggedIn', ['dev', 'test', 'flaky'])
    );

    const config = await getPluginConfig(PACKAGE_ROOT, { tags: { skip: ['flaky'] } });

    expect(config.test.include).toEqual([
      'stories/Button.stories.tsx',
      'stories/Header.stories.tsx',
    ]);
  });

  it('escapes glob characters in story file paths', async () => {
    const groupedStories = '/repo/apps/storybook/stories/(marketing)/Hero.stories.tsx';
    vi.mocked(StoryIndexGenerator.findMatchingFilesForSpecifiers).mockResolvedValue([
      [{} as NormalizedStoriesSpecifier, { [groupedStories]: false }],
    ]);
    mockIndex(storyEntry(groupedStories, 'Primary', ['dev', 'test']));

    const config = await getPluginConfig(PACKAGE_ROOT);

    expect(config.test.include).toEqual(['stories/\\(marketing\\)/Hero.stories.tsx']);
  });

  it('falls back to the story globs when the stories cannot be indexed', async () => {
    vi.spyOn(StoryIndexGenerator.prototype, 'getIndex').mockRejectedValue(
      new Error('Duplicate stories')
    );

    const config = await getPluginConfig(PACKAGE_ROOT);

    expect(config.test.include).toEqual(['stories/**/*.stories.tsx']);
  });
});
