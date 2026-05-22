import { fileURLToPath } from 'node:url';

import type { ImportParser } from 'storybook/internal/core-server';
import type { PresetProperty } from 'storybook/internal/types';

export const previewAnnotations: PresetProperty<'previewAnnotations'> = async (
  input = [],
  options
) => {
  const docsEnabled = Object.keys(await options.presets.apply('docs', {}, options)).length > 0;
  const result: string[] = [];

  return result
    .concat(input)
    .concat([fileURLToPath(import.meta.resolve('@storybook/vue3/entry-preview'))])
    .concat(
      docsEnabled ? [fileURLToPath(import.meta.resolve('@storybook/vue3/entry-preview-docs'))] : []
    );
};

export const experimental_importParsers = async (
  input: ImportParser[] = []
): Promise<ImportParser[]> => {
  const { vueImportParser } = await import('./parsers/index.ts');
  return [...input, vueImportParser];
};
