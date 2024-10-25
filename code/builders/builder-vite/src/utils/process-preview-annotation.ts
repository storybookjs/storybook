import { resolve } from 'node:path';

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
    return path.absolute;
  }

  if (!path) {
    return;
  }

  if (path.startsWith('.')) {
    const resolved = slash(resolve(path));
    return resolved;
  }

  return path;
}
