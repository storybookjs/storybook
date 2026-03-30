import { fileURLToPath } from 'node:url';

import type { PresetProperty } from 'storybook/internal/types';

/**
 * Creates a `previewAnnotations` preset function for a renderer package.
 *
 * @param packageName - The renderer package name (e.g. `'@storybook/vue3'`)
 * @param extraEntries - Additional entry points to include before the docs entry (e.g. `['entry-preview-argtypes']`)
 */
export function createPreviewAnnotations(
  packageName: string,
  extraEntries: string[] = []
): PresetProperty<'previewAnnotations'> {
  return async (input = [], options) => {
    const docsEnabled = Object.keys(await options.presets.apply('docs', {}, options)).length > 0;

    return (input as string[])
      .concat([fileURLToPath(import.meta.resolve(`${packageName}/entry-preview`))])
      .concat(
        extraEntries.map((entry) => fileURLToPath(import.meta.resolve(`${packageName}/${entry}`)))
      )
      .concat(
        docsEnabled ? [fileURLToPath(import.meta.resolve(`${packageName}/entry-preview-docs`))] : []
      );
  };
}
