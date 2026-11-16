import { fileURLToPath } from 'node:url';

import { isTypeScriptReadyForDocgen } from 'storybook/internal/common';
import type { ImportParser } from 'storybook/internal/core-server';
import type { Indexer, Options, PresetProperty } from 'storybook/internal/types';

export { experimental_docgenProvider, experimental_manifests } from './docgen/preset.ts';
export { experimental_storyDocsProvider } from './docgen/story-docs-provider.ts';

// Default for `features.docgenServer`; a project without a usable `typescript` keeps builder docgen.
export const isDocgenProviderEnabled = (_existing: unknown, options: Options) =>
  isTypeScriptReadyForDocgen((specifier) => import.meta.resolve(specifier), options);

export const features: PresetProperty<'features'> = async (existing) => ({
  ...existing,
  componentsManifest: true,
});

export const previewAnnotations: PresetProperty<'previewAnnotations'> = async (
  input = [],
  options
) => {
  const docsEnabled = Object.keys(await options.presets.apply('docs', {}, options)).length > 0;
  const result: string[] = [];

  return result
    .concat(input)
    .concat([fileURLToPath(import.meta.resolve('@storybook/svelte/entry-preview'))])
    .concat(
      docsEnabled
        ? [fileURLToPath(import.meta.resolve('@storybook/svelte/entry-preview-docs'))]
        : []
    );
};

export const experimental_importParsers = async (
  input: ImportParser[] = []
): Promise<ImportParser[]> => {
  const { svelteImportParser } = await import('./parsers/index.ts');
  return [...input, svelteImportParser];
};

export const experimental_indexers = async (
  existingIndexers: Indexer[] | undefined
): Promise<Indexer[]> => {
  const { createIndexer } = await import('./svelte-csf/indexer/index.ts');

  return [createIndexer(), ...(existingIndexers ?? [])];
};
