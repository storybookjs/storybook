import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { normalizeStoriesEntry } from 'storybook/internal/common';

import Watchpack from 'watchpack';

import { watchStorySpecifiers } from './watch-story-specifiers.ts';

vi.mock('watchpack');

describe('watchStorySpecifiers', () => {
  const workingDir = join(__dirname, '__mockdata__');
  const options = {
    configDir: join(workingDir, '.storybook'),
    workingDir,
  };
  const abspath = (filename: string) => join(workingDir, filename);

  let close: () => void;

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    close?.();
    vi.useRealTimers();
  });

  // Helper to flush the batched events queue
  const flushEvents = async () => {
    await vi.runAllTimersAsync();
  };

  it('watches basic globs', async () => {
    const specifier = normalizeStoriesEntry('../src/**/*.stories.@(ts|js)', options);

    const onInvalidate = vi.fn();
    close = watchStorySpecifiers([specifier], { workingDir }, onInvalidate);

    expect(Watchpack).toHaveBeenCalledTimes(1);
    const watcher = Watchpack.mock.instances[0];

    expect(watcher.on).toHaveBeenCalledTimes(2);
    const baseOnChange = watcher.on.mock.calls[0][1];
    const baseOnRemove = watcher.on.mock.calls[1][1];
    const onChange = (filename: string, ...args: any[]) => baseOnChange(abspath(filename), ...args);
    const onRemove = (filename: string, ...args: any[]) => baseOnRemove(abspath(filename), ...args);

    // File changed, matching
    onInvalidate.mockClear();
    onChange('src/nested/Button.stories.ts', 1234);
    await flushEvents();
    expect(onInvalidate).toHaveBeenCalledWith(`./src/nested/Button.stories.ts`, false);

    // File changed, NOT matching
    onInvalidate.mockClear();
    onChange('src/nested/Button.ts', 1234);
    await flushEvents();
    expect(onInvalidate).not.toHaveBeenCalled();

    // File removed, matching
    onInvalidate.mockClear();
    onRemove('src/nested/Button.stories.ts');
    await flushEvents();
    expect(onInvalidate).toHaveBeenCalledWith(`./src/nested/Button.stories.ts`, true);

    // File removed, NOT matching
    onInvalidate.mockClear();
    onRemove('src/nested/Button.ts');
    await flushEvents();
    expect(onInvalidate).not.toHaveBeenCalled();

    // File moved out, matching
    onInvalidate.mockClear();
    onChange('src/nested/Button.stories.ts', null);
    await flushEvents();
    expect(onInvalidate).toHaveBeenCalledWith(`./src/nested/Button.stories.ts`, true);

    // File renamed, matching
    onInvalidate.mockClear();
    onChange('src/nested/Button.stories.ts', null);
    onChange('src/nested/Button-2.stories.ts', 1234);
    await flushEvents();
    expect(onInvalidate).toHaveBeenCalledWith(`./src/nested/Button.stories.ts`, true);
    expect(onInvalidate).toHaveBeenCalledWith(`./src/nested/Button-2.stories.ts`, false);
  });

  it('scans directories when they are added', async () => {
    // This test uses real timers because globby performs actual filesystem I/O
    // that doesn't work well with fake timers
    vi.useRealTimers();

    const specifier = normalizeStoriesEntry('../src/**/*.stories.@(ts|js)', options);

    const onInvalidate = vi.fn();
    close = watchStorySpecifiers([specifier], { workingDir }, onInvalidate);

    expect(Watchpack).toHaveBeenCalledTimes(1);
    const watcher = Watchpack.mock.instances[0];

    expect(watcher.on).toHaveBeenCalledTimes(2);
    const baseOnChange = watcher.on.mock.calls[0][1];
    const onChange = (filename: string, ...args: any[]) => baseOnChange(abspath(filename), ...args);

    onInvalidate.mockClear();
    onChange('src/nested', 1234);
    // Wait for the batching timeout and globby to complete
    await vi.waitFor(() => {
      expect(onInvalidate).toHaveBeenCalledWith(`./src/nested/Button.stories.ts`, false);
    });
  });

  it('watches single file globs', async () => {
    const specifier = normalizeStoriesEntry('../src/nested/Button.mdx', options);

    const onInvalidate = vi.fn();
    close = watchStorySpecifiers([specifier], { workingDir }, onInvalidate);

    expect(Watchpack).toHaveBeenCalledTimes(1);
    const watcher = Watchpack.mock.instances[0];

    expect(watcher.on).toHaveBeenCalledTimes(2);
    const baseOnChange = watcher.on.mock.calls[0][1];
    const baseOnRemove = watcher.on.mock.calls[1][1];
    const onChange = (filename: string, ...args: any[]) => baseOnChange(abspath(filename), ...args);
    const onRemove = (filename: string, ...args: any[]) => baseOnRemove(abspath(filename), ...args);

    // File changed, matching
    onInvalidate.mockClear();
    onChange('src/nested/Button.mdx', 1234);
    await flushEvents();
    expect(onInvalidate).toHaveBeenCalledWith(`./src/nested/Button.mdx`, false);

    // File changed, NOT matching
    onInvalidate.mockClear();
    onChange('src/nested/Button.tsx', 1234);
    await flushEvents();
    expect(onInvalidate).not.toHaveBeenCalled();

    // File removed, matching
    onInvalidate.mockClear();
    onRemove('src/nested/Button.mdx');
    await flushEvents();
    expect(onInvalidate).toHaveBeenCalledWith(`./src/nested/Button.mdx`, true);

    // File removed, NOT matching
    onInvalidate.mockClear();
    onRemove('src/nested/Button.tsx');
    await flushEvents();
    expect(onInvalidate).not.toHaveBeenCalled();

    // File moved out, matching
    onInvalidate.mockClear();
    onChange('src/nested/Button.mdx', null);
    await flushEvents();
    expect(onInvalidate).toHaveBeenCalledWith(`./src/nested/Button.mdx`, true);
  });

  describe('rename detection', () => {
    it('pairs rename-explanation remove + add events into a renameHint', async () => {
      const specifier = normalizeStoriesEntry('../src/**/*.stories.@(ts|js)', options);

      const onInvalidate = vi.fn();
      close = watchStorySpecifiers([specifier], { workingDir }, onInvalidate);

      const watcher = Watchpack.mock.instances[0];
      const baseOnChange = watcher.on.mock.calls[0][1];
      const onChange = (filename: string, ...args: any[]) =>
        baseOnChange(abspath(filename), ...args);

      // Simulate Watchpack firing both halves of a rename within the batch window
      onChange('src/nested/Button.stories.ts', null, 'rename');
      onChange('src/nested/Button-2.stories.ts', 1234, 'rename');
      await flushEvents();

      expect(onInvalidate).toHaveBeenCalledWith(`./src/nested/Button.stories.ts`, true, {
        pairedWith: `./src/nested/Button-2.stories.ts`,
      });
      expect(onInvalidate).toHaveBeenCalledWith(`./src/nested/Button-2.stories.ts`, false);
    });

    it('produces no renameHint when multiple removals and additions arrive together', async () => {
      const specifier = normalizeStoriesEntry('../src/**/*.stories.@(ts|js)', options);

      const onInvalidate = vi.fn();
      close = watchStorySpecifiers([specifier], { workingDir }, onInvalidate);

      const watcher = Watchpack.mock.instances[0];
      const baseOnChange = watcher.on.mock.calls[0][1];
      const onChange = (filename: string, ...args: any[]) =>
        baseOnChange(abspath(filename), ...args);

      // Two rename pairs (folder rename) — ambiguous at this layer, defer disambiguation
      onChange('src/nested/Button.stories.ts', null, 'rename');
      onChange('src/nested/Other.stories.ts', null, 'rename');
      onChange('src/nested/Button-2.stories.ts', 1234, 'rename');
      onChange('src/nested/Other-2.stories.ts', 1234, 'rename');
      await flushEvents();

      // All four callbacks fire; multi-pair case is disambiguated later in index-json
      expect(onInvalidate).toHaveBeenCalledTimes(4);
      for (const call of onInvalidate.mock.calls) {
        expect(call[2]).toBeUndefined();
      }
    });

    it('does not emit a renameHint when the explanation is missing', async () => {
      const specifier = normalizeStoriesEntry('../src/**/*.stories.@(ts|js)', options);

      const onInvalidate = vi.fn();
      close = watchStorySpecifiers([specifier], { workingDir }, onInvalidate);

      const watcher = Watchpack.mock.instances[0];
      const baseOnChange = watcher.on.mock.calls[0][1];
      const onChange = (filename: string, ...args: any[]) =>
        baseOnChange(abspath(filename), ...args);

      // Legacy path: no explanation — existing behaviour must be unchanged
      onChange('src/nested/Button.stories.ts', null);
      onChange('src/nested/Button-2.stories.ts', 1234);
      await flushEvents();

      expect(onInvalidate).toHaveBeenCalledWith(`./src/nested/Button.stories.ts`, true);
      expect(onInvalidate).toHaveBeenCalledWith(`./src/nested/Button-2.stories.ts`, false);
    });
  });

  it('multiplexes between two specifiers on the same directory', async () => {
    const globSpecifier = normalizeStoriesEntry('../src/**/*.stories.@(ts|js)', options);
    const fileSpecifier = normalizeStoriesEntry('../src/nested/Button.mdx', options);

    const onInvalidate = vi.fn();
    close = watchStorySpecifiers([globSpecifier, fileSpecifier], { workingDir }, onInvalidate);

    expect(Watchpack).toHaveBeenCalledTimes(1);
    const watcher = Watchpack.mock.instances[0];

    expect(watcher.on).toHaveBeenCalledTimes(2);
    const baseOnChange = watcher.on.mock.calls[0][1];
    const onChange = (filename: string, ...args: any[]) => baseOnChange(abspath(filename), ...args);

    onInvalidate.mockClear();
    onChange('src/nested/Button.stories.ts', 1234);
    await flushEvents();
    expect(onInvalidate).toHaveBeenCalledWith(`./src/nested/Button.stories.ts`, false);

    onInvalidate.mockClear();
    onChange('src/nested/Button.mdx', 1234);
    await flushEvents();
    expect(onInvalidate).toHaveBeenCalledWith(`./src/nested/Button.mdx`, false);
  });
});
