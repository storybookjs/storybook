import type { PreviewAnnotation } from 'storybook/internal/types';

import { isAbsolute, normalize, resolve } from 'pathe';

/** Preview annotations can take several forms, so we normalize them here to absolute file paths. */
export function processPreviewAnnotation(path: PreviewAnnotation, projectRoot: string) {
  // If entry is an object, take the absolute specifier.
  // This absolute specifier is automatically made for addons here:
  // https://github.com/storybookjs/storybook/blob/ac6e73b9d8ce31dd9acc80999c8d7c22a111f3cc/code/core/src/common/presets.ts#L161-L171
  if (typeof path === 'object') {
    // TODO: Remove this once the new version of Nuxt is released that removes this workaround:
    // https://github.com/nuxt-modules/storybook/blob/a2eec6e898386f76c74826842e8e007b185c3d35/packages/storybook-addon/src/preset.ts#L279-L306
    if (path.bare != null && path.absolute === '') {
      return path.bare;
    }
    return path.absolute;
  }

  // If it's already an absolute path, return it.
  if (isAbsolute(path)) {
    return normalize(path);
  }
  // resolve relative paths, relative to project root
  return normalize(resolve(projectRoot, path));
}
