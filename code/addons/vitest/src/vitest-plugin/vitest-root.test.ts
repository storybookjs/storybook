import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Plugin } from 'vitest/config';

import { validateConfigurationFiles } from 'storybook/internal/common';
import {
  StoryIndexGenerator,
  experimental_loadStorybook,
  watchStorySpecifiers,
} from 'storybook/internal/core-server';
import { isTelemetryModuleEnabled, telemetry } from 'storybook/internal/telemetry';
import type { StoryIndex } from 'storybook/internal/types';

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
const stopWatching = vi.fn();

// The plugin relativizes index entries against the process cwd it captured at import time.
const importPath = (file: string) => relative(process.cwd(), file);

const storyEntry = (file: string, exportName: string, tags: string[]) =>
  ({
    type: 'story',
    subtype: 'story',
    id: `${file}--${exportName}`,
    name: exportName,
    title: file,
    importPath: importPath(file),
    tags,
  }) as StoryIndex['entries'][string];

const mockIndex = (...entries: StoryIndex['entries'][string][]) => {
  vi.mocked(StoryIndexGenerator.prototype.getIndex).mockResolvedValue({
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
  vi.mocked(StoryIndexGenerator.findMatchingFilesForSpecifiers).mockResolvedValue([]);
  vi.mocked(StoryIndexGenerator.prototype.initialize).mockResolvedValue();
  mockIndex(
    storyEntry(BUTTON_STORIES, 'Primary', ['dev', 'test']),
    storyEntry(HEADER_STORIES, 'LoggedIn', ['dev', 'test'])
  );
  vi.mocked(watchStorySpecifiers).mockReturnValue(stopWatching);
  vi.mocked(validateConfigurationFiles).mockResolvedValue(undefined as never);
  vi.mocked(isTelemetryModuleEnabled).mockReturnValue(false);
  vi.mocked(telemetry).mockResolvedValue(undefined as never);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

async function createPlugin(options: UserOptions = {}) {
  const plugins = await storybookTest({ configDir: CONFIG_DIR, ...options });
  return plugins.find((p) => p.name === 'vite-plugin-storybook-test')!;
}

/** Runs the plugin's `config` hook the way Vitest does, and returns the config it contributes. */
async function runConfigHook(plugin: Plugin, invokingRoot: string) {
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

async function getPluginConfig(invokingRoot: string, options: UserOptions = {}) {
  return runConfigHook(await createPlugin(options), invokingRoot);
}

/**
 * Runs the plugin's `configureVitest` hook against a Vitest whose project carries the `include`
 * the `config` hook contributed, and returns what the plugin can reach from there.
 */
async function runConfigureVitestHook(plugin: Plugin, include: string[], watch = true) {
  const watcher = { emit: vi.fn() };
  const onClose = vi.fn();
  const context = {
    vitest: {
      config: { watch, coverage: { exclude: [] }, browser: undefined, reporters: [] },
      vite: { watcher },
      onClose,
    },
    project: { config: { include } },
    injectTestProjects: vi.fn(),
  } as unknown as Parameters<NonNullable<Plugin['configureVitest']>>[0];

  await plugin.configureVitest!(context);

  const onStoryFileChanged = vi.mocked(watchStorySpecifiers).mock.calls[0]?.[2];
  return { watcher, onClose, onStoryFileChanged };
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

  it('leaves out index entries that do not come from the story globs', async () => {
    mockIndex(
      storyEntry(BUTTON_STORIES, 'Primary', ['dev', 'test']),
      storyEntry('/repo/apps/storybook/src/Generated.tsx', 'Primary', ['dev', 'test'])
    );

    const config = await getPluginConfig(PACKAGE_ROOT);

    expect(config.test.include).toEqual(['stories/Button.stories.tsx']);
  });

  it('escapes glob characters in story file paths', async () => {
    mockIndex(
      storyEntry('/repo/apps/storybook/stories/(marketing)/Hero.stories.tsx', 'Primary', [
        'dev',
        'test',
      ])
    );

    const config = await getPluginConfig(PACKAGE_ROOT);

    expect(config.test.include).toEqual(['stories/\\(marketing\\)/Hero.stories.tsx']);
  });

  it('falls back to the story globs when the stories cannot be indexed', async () => {
    vi.mocked(StoryIndexGenerator.prototype.getIndex).mockRejectedValue(
      new Error('Duplicate stories')
    );

    const config = await getPluginConfig(PACKAGE_ROOT);

    expect(config.test.include).toEqual(['stories/**/*.stories.tsx']);
  });
});

describe('story file selection in watch mode', () => {
  it('only watches the story files in watch mode', async () => {
    const plugin = await createPlugin();
    const config = await runConfigHook(plugin, PACKAGE_ROOT);

    await runConfigureVitestHook(plugin, config.test.include as string[], false);

    expect(watchStorySpecifiers).not.toHaveBeenCalled();
  });

  it('adds a story file to the test files once it gains a matching story', async () => {
    mockIndex(
      storyEntry(BUTTON_STORIES, 'Primary', ['dev', 'test']),
      storyEntry(HEADER_STORIES, 'LoggedIn', ['dev'])
    );
    const plugin = await createPlugin();
    const include = (await runConfigHook(plugin, PACKAGE_ROOT)).test.include as string[];
    const { watcher, onStoryFileChanged } = await runConfigureVitestHook(plugin, include);

    mockIndex(
      storyEntry(BUTTON_STORIES, 'Primary', ['dev', 'test']),
      storyEntry(HEADER_STORIES, 'LoggedIn', ['dev', 'test'])
    );
    onStoryFileChanged(importPath(HEADER_STORIES), false);

    await vi.waitFor(() =>
      expect(include).toEqual(['stories/Button.stories.tsx', 'stories/Header.stories.tsx'])
    );
    // Vitest handled the original file event before the index was refreshed, so the file is
    // announced again, as an added file, now that it is a test file.
    expect(watcher.emit).toHaveBeenCalledWith('add', HEADER_STORIES);
  });

  it('does not announce a changed story file that already was a test file', async () => {
    const plugin = await createPlugin();
    const include = (await runConfigHook(plugin, PACKAGE_ROOT)).test.include as string[];
    const { watcher, onStoryFileChanged } = await runConfigureVitestHook(plugin, include);

    onStoryFileChanged(importPath(BUTTON_STORIES), false);

    await vi.waitFor(() => expect(StoryIndexGenerator.prototype.getIndex).toHaveBeenCalledTimes(2));
    expect(include).toEqual(['stories/Button.stories.tsx', 'stories/Header.stories.tsx']);
    expect(watcher.emit).not.toHaveBeenCalled();
  });

  it('drops a story file from the test files once it loses its last matching story', async () => {
    const plugin = await createPlugin();
    const include = (await runConfigHook(plugin, PACKAGE_ROOT)).test.include as string[];
    const { watcher, onStoryFileChanged } = await runConfigureVitestHook(plugin, include);

    mockIndex(
      storyEntry(BUTTON_STORIES, 'Primary', ['dev', 'test']),
      storyEntry(HEADER_STORIES, 'LoggedIn', ['dev'])
    );
    onStoryFileChanged(importPath(HEADER_STORIES), false);

    await vi.waitFor(() => expect(include).toEqual(['stories/Button.stories.tsx']));
    expect(watcher.emit).not.toHaveBeenCalled();
  });

  it('drops a removed story file from the test files without announcing it', async () => {
    const plugin = await createPlugin();
    const include = (await runConfigHook(plugin, PACKAGE_ROOT)).test.include as string[];
    const { watcher, onStoryFileChanged } = await runConfigureVitestHook(plugin, include);

    mockIndex(storyEntry(BUTTON_STORIES, 'Primary', ['dev', 'test']));
    onStoryFileChanged(importPath(HEADER_STORIES), true);

    await vi.waitFor(() => expect(include).toEqual(['stories/Button.stories.tsx']));
    expect(watcher.emit).not.toHaveBeenCalled();
  });

  it('stops watching the story files when Vitest closes', async () => {
    const plugin = await createPlugin();
    const include = (await runConfigHook(plugin, PACKAGE_ROOT)).test.include as string[];
    const { onClose } = await runConfigureVitestHook(plugin, include);

    expect(onClose).toHaveBeenCalledWith(stopWatching);
  });
});
