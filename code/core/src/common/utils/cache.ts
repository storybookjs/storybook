import { createFileSystemCache } from './file-cache';
import { resolvePathInStorybookCache } from './resolve-path-in-sb-cache';

export const cache = createFileSystemCache({
  basePath: resolvePathInStorybookCache('dev-server'),
  ns: 'storybook', // Optional. A grouping namespace for items.
});
