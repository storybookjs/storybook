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
  if (!path) {
    return;
  }

  if (path.startsWith('.')) {
    const resolved = slash(resolve(path));
    return resolved;
  }

  return path;
}
