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
    .concat(['@storybook/svelte/entry-preview'])
    .concat(docsEnabled ? ['@storybook/svelte/entry-preview-docs'] : []);
};
