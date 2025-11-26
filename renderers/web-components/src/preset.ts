import { fileURLToPath } from 'node:url';

import type { PresetProperty } from 'storybook/internal/types';

export const previewAnnotations: PresetProperty<'previewAnnotations'> = async (
  input = [],
  options
) => {
  const docsEnabled = Object.keys(await options.presets.apply('docs', {}, options)).length > 0;
  const result: string[] = [];

  return result
    .concat(input)
    .concat([
      fileURLToPath(import.meta.resolve('@storybook/web-components/entry-preview')),
      fileURLToPath(import.meta.resolve('@storybook/web-components/entry-preview-argtypes')),
    ])
    .concat(
      docsEnabled
        ? [fileURLToPath(import.meta.resolve('@storybook/web-components/entry-preview-docs'))]
        : []
    );
};
