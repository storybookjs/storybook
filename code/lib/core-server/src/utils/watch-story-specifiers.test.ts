import { describe, afterEach, it, expect, vi } from 'vitest';
import { normalizeStoriesEntry } from '@storybook/core-common';
import path from 'path';
import Watchpack from 'watchpack';

import { watchStorySpecifiers } from './watch-story-specifiers';

vi.mock('watchpack');

describe('watchStorySpecifiers', () => {
  const workingDir = path.join(__dirname, '__mockdata__');
  const options = {
    configDir: path.join(workingDir, '.storybook'),
    workingDir,
  };

  let close: () => void;
  afterEach(() => close?.());

  it('watches basic globs', async () => {
    const specifier = normalizeStoriesEntry('../src/**/*.stories.@(ts|js)', options);

    const onInvalidate = vi.fn();
    close = watchStorySpecifiers([specifier], { workingDir }, onInvalidate);

    expect(Watchpack).toHaveBeenCalledTimes(1);
    const watcher = Watchpack.mock.instances[0];
    expect(watcher.watch).toHaveBeenCalledWith({ directories: ['./src'] });

    expect(watcher.on).toHaveBeenCalledTimes(2);
    const onChange = watcher.on.mock.calls[0][1];
    const onRemove = watcher.on.mock.calls[1][1];

    // File changed, matching
    onInvalidate.mockClear();
    await onChange('src/nested/Button.stories.ts', 1234);
    expect(onInvalidate).toHaveBeenCalledWith(specifier, `./src/nested/Button.stories.ts`, false);

    // File changed, NOT matching
    onInvalidate.mockClear();
    await onChange('src/nested/Button.ts', 1234);
    expect(onInvalidate).not.toHaveBeenCalled();

    // File removed, matching
    onInvalidate.mockClear();
    await onRemove('src/nested/Button.stories.ts');
    expect(onInvalidate).toHaveBeenCalledWith(specifier, `./src/nested/Button.stories.ts`, true);

    // File removed, NOT matching
    onInvalidate.mockClear();
    await onRemove('src/nested/Button.ts');
    expect(onInvalidate).not.toHaveBeenCalled();

    // File moved out, matching
    onInvalidate.mockClear();
    await onChange('src/nested/Button.stories.ts', null);
    expect(onInvalidate).toHaveBeenCalledWith(specifier, `./src/nested/Button.stories.ts`, true);

    // File renamed, matching
    onInvalidate.mockClear();
    await onChange('src/nested/Button.stories.ts', null);
    await onChange('src/nested/Button-2.stories.ts', 1234);
    expect(onInvalidate).toHaveBeenCalledWith(specifier, `./src/nested/Button.stories.ts`, true);
    expect(onInvalidate).toHaveBeenCalledWith(specifier, `./src/nested/Button-2.stories.ts`, false);
  });

  it('scans directories when they are added', async () => {
    const specifier = normalizeStoriesEntry('../src/**/*.stories.@(ts|js)', options);

    const onInvalidate = vi.fn();
    close = watchStorySpecifiers([specifier], { workingDir }, onInvalidate);

    expect(Watchpack).toHaveBeenCalledTimes(1);
    const watcher = Watchpack.mock.instances[0];
    expect(watcher.watch).toHaveBeenCalledWith({ directories: ['./src'] });

    expect(watcher.on).toHaveBeenCalledTimes(2);
    const onChange = watcher.on.mock.calls[0][1];

    onInvalidate.mockClear();
    await onChange('src/nested', 1234);
    expect(onInvalidate).toHaveBeenCalledWith(specifier, `./src/nested/Button.stories.ts`, false);
  });

  it('watches single file globs', async () => {
    const specifier = normalizeStoriesEntry('../src/nested/Button.mdx', options);

    const onInvalidate = vi.fn();
    close = watchStorySpecifiers([specifier], { workingDir }, onInvalidate);

    expect(Watchpack).toHaveBeenCalledTimes(1);
    const watcher = Watchpack.mock.instances[0];
    expect(watcher.watch).toHaveBeenCalledWith({ directories: ['./src/nested'] });

    expect(watcher.on).toHaveBeenCalledTimes(2);
    const onChange = watcher.on.mock.calls[0][1];
    const onRemove = watcher.on.mock.calls[1][1];

    // File changed, matching
    onInvalidate.mockClear();
    await onChange('src/nested/Button.mdx', 1234);
    expect(onInvalidate).toHaveBeenCalledWith(specifier, `./src/nested/Button.mdx`, false);

    // File changed, NOT matching
    onInvalidate.mockClear();
    await onChange('src/nested/Button.tsx', 1234);
    expect(onInvalidate).not.toHaveBeenCalled();

    // File removed, matching
    onInvalidate.mockClear();
    await onRemove('src/nested/Button.mdx');
    expect(onInvalidate).toHaveBeenCalledWith(specifier, `./src/nested/Button.mdx`, true);

    // File removed, NOT matching
    onInvalidate.mockClear();
    await onRemove('src/nested/Button.tsx');
    expect(onInvalidate).not.toHaveBeenCalled();

    // File moved out, matching
    onInvalidate.mockClear();
    await onChange('src/nested/Button.mdx', null);
    expect(onInvalidate).toHaveBeenCalledWith(specifier, `./src/nested/Button.mdx`, true);
  });

  it('multiplexes between two specifiers on the same directory', async () => {
    const globSpecifier = normalizeStoriesEntry('../src/**/*.stories.@(ts|js)', options);
    const fileSpecifier = normalizeStoriesEntry('../src/nested/Button.mdx', options);

    const onInvalidate = vi.fn();
    close = watchStorySpecifiers([globSpecifier, fileSpecifier], { workingDir }, onInvalidate);

    expect(Watchpack).toHaveBeenCalledTimes(1);
    const watcher = Watchpack.mock.instances[0];
    expect(watcher.watch).toHaveBeenCalledWith({ directories: ['./src', './src/nested'] });

    expect(watcher.on).toHaveBeenCalledTimes(2);
    const onChange = watcher.on.mock.calls[0][1];

    onInvalidate.mockClear();
    await onChange('src/nested/Button.stories.ts', 1234);
    expect(onInvalidate).toHaveBeenCalledWith(
      globSpecifier,
      `./src/nested/Button.stories.ts`,
      false
    );

    onInvalidate.mockClear();
    await onChange('src/nested/Button.mdx', 1234);
    expect(onInvalidate).toHaveBeenCalledWith(fileSpecifier, `./src/nested/Button.mdx`, false);
  });
});
