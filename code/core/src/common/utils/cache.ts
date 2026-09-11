import { createFileSystemCache } from './file-cache.ts';
import { resolvePathInStorybookCache } from './resolve-path-in-sb-cache.ts';

export const cache = createFileSystemCache({
  basePath: resolvePathInStorybookCache('dev-server'),
  ns: 'storybook', // Optional. A grouping namespace for items.
});
