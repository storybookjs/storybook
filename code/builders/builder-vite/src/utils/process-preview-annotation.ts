import type { PreviewAnnotation } from 'storybook/internal/types';

import { isAbsolute, normalize, resolve } from 'pathe';

/** Preview annotations can take several forms, so we normalize them here to absolute file paths. */
export function processPreviewAnnotation(path: PreviewAnnotation, projectRoot: string) {
  // If entry is an object, take the absolute specifier.
  // This is so that webpack can use an absolute path, and
  // continue supporting super-addons in pnp/pnpm without
  // requiring them to re-export their sub-addons as we do
  // in addon-essentials.
  if (typeof path === 'object') {
    console.log(
      'Deprecated: Preview annotations should be strings, not objects. Use the `absolute` property instead.'
    );
    return path.absolute;
  }

  // If it's already an absolute path, return it.
  if (isAbsolute(path)) {
    return normalize(path);
  }
  // resolve relative paths, relative to project root
  return normalize(resolve(projectRoot, path));
}
