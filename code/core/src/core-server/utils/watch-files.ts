import { logger } from 'storybook/internal/node-logger';
import type { Path } from 'storybook/internal/types';

import { type FSWatcher, watch } from 'chokidar';

const IGNORED_DIRECTORIES = /(^|[/\\])(\.git|node_modules)([/\\]|$)/;

// What watchpack used when the variable asked for polling without an interval
const DEFAULT_POLLING_INTERVAL = 5007;

// webpack's file watcher polls when this variable is set, and people who need polling set it for both
const pollingOptions = () => {
  const { WATCHPACK_POLLING: polling } = process.env;
  if (!polling || polling === 'false' || polling === '0') {
    return {};
  }
  const interval = Number(polling);
  return {
    backend: 'polling' as const,
    pollingInterval:
      Number.isFinite(interval) && interval > 0 ? interval : DEFAULT_POLLING_INTERVAL,
  };
};

const messageOf = (error: unknown) => (error instanceof Error ? error.message : String(error));

/**
 * Report the files below `paths` that `isWatched` accepts when they are added, changed or removed,
 * without reporting the ones that exist
 */
export function watchFiles(
  paths: Path[],
  onChange: (path: Path, removed: boolean) => void,
  isWatched: (path: Path) => boolean = () => true
) {
  let watcher: FSWatcher;
  try {
    watcher = watch(paths, {
      ...pollingOptions(),
      ignoreInitial: true,
      followSymlinks: false,
      ignorePermissionErrors: true,
      // Chokidar would hold every removal for 100 ms to see whether the file comes back
      atomic: false,
      // Chokidar asks about each path twice, first without its stats, and only a file can be told apart
      ignored: (path, stats) =>
        IGNORED_DIRECTORIES.test(path) || (!!stats?.isFile() && !isWatched(path)),
    });
  } catch (error) {
    // Chokidar reads CHOKIDAR_INTERVAL itself, and throws when that is not a positive number
    logger.warn(
      `Unable to watch files for changes, check the CHOKIDAR_INTERVAL environment variable: ${messageOf(error)}`
    );
    return async () => {};
  }

  let warned = false;
  // An emitter without an error listener throws, which would take the dev server down
  watcher.on('error', (error) => {
    if (!warned) {
      warned = true;
      logger.warn(`Unable to watch some files for changes: ${messageOf(error)}`);
    }
  });
  watcher.on('add', (path) => onChange(path, false));
  watcher.on('change', (path) => onChange(path, false));
  watcher.on('unlink', (path) => onChange(path, true));

  return () => watcher.close();
}
