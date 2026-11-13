import type { Stats } from 'node:fs';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { normalizeStoriesEntry } from 'storybook/internal/common';
import { logger } from 'storybook/internal/node-logger';

import { watch } from 'chokidar';
import { resolve } from 'pathe';

import { watchStorySpecifiers } from './watch-story-specifiers.ts';

vi.mock('chokidar');
vi.mock('storybook/internal/node-logger');

describe('watchStorySpecifiers', () => {
  const workingDir = join(__dirname, '__mockdata__');
  const options = {
    configDir: join(workingDir, '.storybook'),
    workingDir,
  };
  const abspath = (filename: string) => join(workingDir, filename);

  let listeners: Record<string, (argument: unknown) => void>;
  let close: () => void;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.mocked(logger.warn).mockClear();
    listeners = {};
    const watcher = {
      on: vi.fn((event: string, listener: (argument: unknown) => void) => {
        listeners[event] = listener;
        return watcher;
      }),
      close: vi.fn(),
    };
    vi.mocked(watch).mockReset();
    vi.mocked(watch).mockReturnValue(watcher as unknown as ReturnType<typeof watch>);
  });

  afterEach(() => {
    close?.();
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  const emit = (event: 'add' | 'change' | 'unlink', filename: string) =>
    listeners[event](abspath(filename));

  // Helper to flush the batched events queue
  const flushEvents = async () => {
    await vi.runAllTimersAsync();
  };

  it('watches the directory of each specifier once', () => {
    const specifiers = [
      '../src/**/*.stories.@(ts|js)',
      '../src/**/*.mdx',
      '../src/nested/Button.mdx',
    ].map((entry) => normalizeStoriesEntry(entry, options));

    close = watchStorySpecifiers(specifiers, { workingDir }, vi.fn());

    expect(vi.mocked(watch).mock.calls[0][0]).toEqual([
      // pathe's resolve() produces POSIX-normalized (forward-slash) paths on Windows,
      // matching the implementation's own resolution of the specifier directories
      resolve(workingDir, 'src'),
      resolve(workingDir, 'src/nested'),
    ]);
  });

  it('watches story files only', () => {
    const specifier = normalizeStoriesEntry('../src/**/*.stories.@(ts|js)', options);

    close = watchStorySpecifiers([specifier], { workingDir }, vi.fn());

    const ignored = vi.mocked(watch).mock.calls[0][1]?.ignored as (
      path: string,
      stats?: Stats
    ) => boolean;
    const file = { isFile: () => true } as Stats;
    const directory = { isFile: () => false } as Stats;

    expect(ignored(abspath('src/nested/Button.stories.ts'), file)).toBe(false);
    expect(ignored(abspath('src/nested/Button.ts'), file)).toBe(true);
    expect(ignored(abspath('src/nested/Button.ts'))).toBe(false);
    expect(ignored(abspath('src/nested'), directory)).toBe(false);
    expect(ignored(abspath('src/node_modules'), directory)).toBe(true);
    expect(ignored(abspath('src/node_modules/pkg/Button.stories.ts'), file)).toBe(true);
    expect(ignored(abspath('src/.git'), directory)).toBe(true);
  });

  it('passes on added, changed and removed story files', async () => {
    const specifier = normalizeStoriesEntry('../src/**/*.stories.@(ts|js)', options);
    const onInvalidate = vi.fn();
    close = watchStorySpecifiers([specifier], { workingDir }, onInvalidate);

    emit('add', 'src/nested/New.stories.ts');
    await flushEvents();
    expect(onInvalidate).toHaveBeenLastCalledWith(`./src/nested/New.stories.ts`, false);

    emit('change', 'src/nested/Button.stories.ts');
    await flushEvents();
    expect(onInvalidate).toHaveBeenLastCalledWith(`./src/nested/Button.stories.ts`, false);

    emit('unlink', 'src/nested/Button.stories.ts');
    await flushEvents();
    expect(onInvalidate).toHaveBeenLastCalledWith(`./src/nested/Button.stories.ts`, true);

    expect(onInvalidate).toHaveBeenCalledTimes(3);
  });

  it('does not pass on a path that matches no specifier', async () => {
    const specifier = normalizeStoriesEntry('../src/**/*.stories.@(ts|js)', options);
    const onInvalidate = vi.fn();
    close = watchStorySpecifiers([specifier], { workingDir }, onInvalidate);

    emit('change', 'src/nested/Button.ts');
    emit('unlink', 'src/nested/Button.ts');
    await flushEvents();

    expect(onInvalidate).not.toHaveBeenCalled();
  });

  it('passes on the last event of a file within one batch', async () => {
    const specifier = normalizeStoriesEntry('../src/**/*.stories.@(ts|js)', options);
    const onInvalidate = vi.fn();
    close = watchStorySpecifiers([specifier], { workingDir }, onInvalidate);

    emit('unlink', 'src/nested/Button.stories.ts');
    emit('add', 'src/nested/Button.stories.ts');
    emit('change', 'src/nested/Button.stories.ts');
    emit('add', 'src/nested/Gone.stories.ts');
    emit('unlink', 'src/nested/Gone.stories.ts');
    await flushEvents();

    expect(onInvalidate.mock.calls).toEqual([
      [`./src/nested/Button.stories.ts`, false],
      [`./src/nested/Gone.stories.ts`, true],
    ]);
  });

  it('multiplexes between two specifiers on the same directory', async () => {
    const globSpecifier = normalizeStoriesEntry('../src/**/*.stories.@(ts|js)', options);
    const fileSpecifier = normalizeStoriesEntry('../src/nested/Button.mdx', options);
    const onInvalidate = vi.fn();
    close = watchStorySpecifiers([globSpecifier, fileSpecifier], { workingDir }, onInvalidate);

    emit('change', 'src/nested/Button.stories.ts');
    emit('change', 'src/nested/Button.mdx');
    emit('change', 'src/nested/Other.mdx');
    await flushEvents();

    expect(onInvalidate.mock.calls).toEqual([
      [`./src/nested/Button.stories.ts`, false],
      [`./src/nested/Button.mdx`, false],
    ]);
  });

  it('gives a story file in a dot directory a path that starts with ./', async () => {
    const specifier = normalizeStoriesEntry('./*.mdx', options);
    const onInvalidate = vi.fn();
    close = watchStorySpecifiers([specifier], { workingDir }, onInvalidate);

    emit('change', '.storybook/Intro.mdx');
    await flushEvents();

    expect(onInvalidate.mock.calls).toEqual([[`./.storybook/Intro.mdx`, false]]);
  });

  it('gives a story file outside the working directory a path that starts with ../', async () => {
    const specifier = normalizeStoriesEntry('../../outside/*.stories.ts', options);
    const onInvalidate = vi.fn();
    close = watchStorySpecifiers([specifier], { workingDir }, onInvalidate);

    emit('change', '../outside/Button.stories.ts');
    await flushEvents();

    expect(onInvalidate.mock.calls).toEqual([[`../outside/Button.stories.ts`, false]]);
  });

  it.each([
    { value: 'true', expected: { backend: 'polling', pollingInterval: 5007 } },
    { value: '500', expected: { backend: 'polling', pollingInterval: 500 } },
    { value: 'Infinity', expected: { backend: 'polling', pollingInterval: 5007 } },
  ])('polls when WATCHPACK_POLLING is $value', ({ value, expected }) => {
    vi.stubEnv('WATCHPACK_POLLING', value);
    const specifier = normalizeStoriesEntry('../src/**/*.stories.@(ts|js)', options);

    close = watchStorySpecifiers([specifier], { workingDir }, vi.fn());

    expect(vi.mocked(watch).mock.calls[0][1]).toMatchObject(expected);
  });

  it.each(['false', '0', ''])('does not poll when WATCHPACK_POLLING is "%s"', (value) => {
    vi.stubEnv('WATCHPACK_POLLING', value);
    const specifier = normalizeStoriesEntry('../src/**/*.stories.@(ts|js)', options);

    close = watchStorySpecifiers([specifier], { workingDir }, vi.fn());

    expect(vi.mocked(watch).mock.calls[0][1]).not.toHaveProperty('backend');
  });

  it('warns once when the watcher reports errors', () => {
    const specifier = normalizeStoriesEntry('../src/**/*.stories.@(ts|js)', options);
    close = watchStorySpecifiers([specifier], { workingDir }, vi.fn());

    listeners.error(new Error('ENOSPC: System limit for number of file watchers reached'));
    listeners.error(new Error('ENOSPC: System limit for number of file watchers reached'));

    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('ENOSPC'));
  });
});
