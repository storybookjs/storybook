import { fileURLToPath } from 'node:url';

import type { PresetPropertyFn } from 'storybook/internal/types';

export function createPreviewAnnotations(
  packageName: string,
  extraEntries: string[] = []
): PresetPropertyFn<'previewAnnotations'> {
  return async (input = [], options) => {
    const docsEnabled = Object.keys(await options.presets.apply('docs', {}, options)).length > 0;
    const result: string[] = [];

    return result
      .concat(input)
      .concat(extraEntries.map((e) => fileURLToPath(import.meta.resolve(e))))
      .concat([fileURLToPath(import.meta.resolve(`${packageName}/entry-preview`))])
      .concat(
        docsEnabled ? [fileURLToPath(import.meta.resolve(`${packageName}/entry-preview-docs`))] : []
      );
  };
}
