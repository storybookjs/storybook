import { join } from 'node:path';

import type { PresetProperty } from 'storybook/internal/types';

export const previewAnnotations: PresetProperty<'previewAnnotations'> = async (
  input = [],
  options
) => {
  const docsEnabled = Object.keys(await options.presets.apply('docs', {}, options)).length > 0;
  const result: string[] = [];

  return result
    .concat(input)
    .concat([join(__dirname, 'entry-preview.js')])
    .concat(docsEnabled ? [join(__dirname, 'entry-preview-docs.js')] : []);
};

/**
 * Alias react and react-dom to preact/compat similar to the preact vite preset
 * https://github.com/preactjs/preset-vite/blob/main/src/index.ts#L238-L239
 */
export const resolvedReact = async (existing: any) => {
  try {
    return {
      ...existing,
      react: 'preact/compat',
      reactDom: 'preact/compat',
    };
  } catch (e) {
    return existing;
  }
};
