import type { Path } from '@storybook/core/types';

import Watchpack from 'watchpack';

// copied from './watch-story-specifiers.ts'
/** Watch the `.storybook` dir for changes */
export function watchConfig(
  configDir: Path,
  onInvalidate: (path: Path, removed: boolean) => Promise<void>
) {
  const wp = new Watchpack({
    followSymlinks: false,
    ignored: ['**/.git', '**/node_modules'],
  });

  wp.watch({
    directories: [configDir],
  });
  wp.on('change', async (filePath: Path, mtime: Date, explanation: string) => {
    const removed = !mtime;
    await onInvalidate(filePath, removed);
  });
  wp.on('remove', async (filePath: Path, explanation: string) => {
    await onInvalidate(filePath, true);
  });

  return () => wp.close();
}
