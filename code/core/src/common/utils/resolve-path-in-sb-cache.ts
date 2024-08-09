import path from 'node:path';

import findCacheDirectory from 'find-cache-dir';

/**
 * Get the path of the file or directory with input name inside the Storybook cache directory:
 *  - `node_modules/.cache/storybook/{directoryName}` in a Node.js project or npm package
 *  - `.cache/storybook/{directoryName}` otherwise
 *
 * @param fileOrDirectoryName {string} Name of the file or directory
 * @return {string} Absolute path to the file or directory
 */
export function resolvePathInStorybookCache(fileOrDirectoryName: string, sub = 'default'): string {
  let cacheDirectory = findCacheDirectory({ name: 'storybook' });
  cacheDirectory ||= path.join(process.cwd(), '.cache', 'storybook');

  return path.join(cacheDirectory, sub, fileOrDirectoryName);
}
