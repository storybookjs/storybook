import type { Path } from 'storybook/internal/types';

import { watchFiles } from './watch-files.ts';

/** Watch the `.storybook` dir for changes */
export function watchConfig(
  configDir: Path,
  onInvalidate: (path: Path, removed: boolean) => Promise<void>
) {
  return watchFiles([configDir], (path, removed) => void onInvalidate(path, removed));
}
