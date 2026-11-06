import { fileURLToPath } from 'node:url';

import { isTypeScriptReadyForDocgen } from 'storybook/internal/common';
import type { Options, PresetProperty } from 'storybook/internal/types';

import { resolveManifestPaths } from './docgen/component-docgen/config/resolve-manifest-paths.ts';
import type { WebComponentsFrameworkOptions } from './types.ts';

export { experimental_docgenProvider, experimental_manifests } from './docgen/preset.ts';
export { experimental_storyDocsProvider } from './docgen/story-docs-preset.ts';
// Default for `features.docgenServer`. A Custom Elements Manifest needs no `typescript`; without one,
// a project without a usable `typescript` keeps builder docgen.
export const isDocgenProviderEnabled = async (_existing: unknown, options: Options) => {
  const frameworkOptions =
    (await options.presets.apply<WebComponentsFrameworkOptions | null | undefined>(
      'frameworkOptions'
    )) ?? {};
  return (
    resolveManifestPaths(options.configDir, frameworkOptions).length > 0 ||
    (await isTypeScriptReadyForDocgen((specifier) => import.meta.resolve(specifier), options))
  );
};

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
