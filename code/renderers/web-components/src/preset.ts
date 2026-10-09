import { fileURLToPath } from 'node:url';

import type { PresetProperty } from 'storybook/internal/types';

export { experimental_docgenProvider, experimental_manifests } from './docgen/preset.ts';
export { experimental_storyDocsProvider } from './docgen/story-docs-preset.ts';
// Turns `features.docgenServer` on by default; read through `presets.apply('isDocgenProviderEnabled')`
// so the default never has to call the provider, which itself reads `features`.
export const isDocgenProviderEnabled = true;

export const previewAnnotations: PresetProperty<'previewAnnotations'> = async (
  input = [],
  options
) => {
  const docsEnabled =
    Object.keys((await options.presets.apply('docs', {}, options)) ?? {}).length > 0;
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
