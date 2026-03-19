import { join } from 'node:path';

import * as pkg from 'empathic/package';

import versions from '../versions';

/**
 * Get the path of the file or directory with input name inside the Storybook cache directory:
 *
 * - `node_modules/.cache/storybook/{version}/{directoryName}` in a Node.js project or npm package
 * - `.cache/storybook/{version}/{directoryName}` otherwise
 *
 * The cache directory includes the Storybook version to ensure that upgrading Storybook
 * automatically invalidates the cache, preventing stale cache issues.
 *
 * @param fileOrDirectoryName {string} Name of the file or directory
 * @param sub {string} Optional subdirectory name (defaults to 'default')
 * @returns {string} Absolute path to the file or directory
 */
export function resolvePathInStorybookCache(fileOrDirectoryName: string, sub = 'default'): string {
  let cacheDirectory = pkg.cache('storybook');
  cacheDirectory ||= join(process.cwd(), 'node_modules', '.cache', 'storybook');

  // Include the storybook version in the cache path to automatically invalidate
  // cache when upgrading to a new version
  const version = versions.storybook || 'unknown';

  return join(cacheDirectory, version, sub, fileOrDirectoryName);
}
