import { isAbsolute, relative, resolve } from 'node:path';

import { stripAbsNodeModulesPath } from 'storybook/internal/common';
import type { PreviewAnnotation } from 'storybook/internal/types';

import slash from 'slash';

/**
 * Preview annotations can take several forms, and vite needs them to be a bit more restrained.
 *
 * For node_modules, we want bare imports (so vite can process them), and for files in the user's
 * source, we want URLs absolute relative to project root.
 */
export function processPreviewAnnotation(path: PreviewAnnotation | undefined, projectRoot: string) {
  // If entry is an object, take the first, which is the
  // bare (non-absolute) specifier.
  // This is so that webpack can use an absolute path, and
  // continue supporting super-addons in pnp/pnpm without
  // requiring them to re-export their sub-addons as we do
  // in addon-essentials.
  if (typeof path === 'object') {
    return path.bare;
  }

  // This should not occur, since we use `.filter(Boolean)` prior to
  // calling this function, but this makes typescript happy
  if (!path) {
    throw new Error('Could not determine path for previewAnnotation');
  }

  // For addon dependencies that use require.resolve(), we need to convert to a bare path
  // so that vite will process it as a dependency (cjs -> esm, etc).
  // TODO: Evaluate if searching for node_modules in a yarn pnp environment is correct
  if (path.includes('node_modules')) {
    return stripAbsNodeModulesPath(path);
  }

  // resolve absolute paths relative to project root
  const relativePath = isAbsolute(path) ? slash(relative(projectRoot, path)) : path;

  // resolve relative paths into absolute urls
  // note: this only works if vite's projectRoot === cwd.
  if (relativePath.startsWith('./')) {
    return slash(relativePath.replace(/^\.\//, '/'));
  }

  // If something is outside of root, convert to absolute.  Uncommon?
  if (relativePath.startsWith('../')) {
    return slash(resolve(projectRoot, relativePath));
  }

  // At this point, it must be relative to the root but not start with a ./ or ../
  return slash(`/${relativePath}`);
}
