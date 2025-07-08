import type { PresetProperty } from 'storybook/internal/types';

import { resolvePackageDir } from '../../../core/src/shared/utils/module';

export const addons: PresetProperty<'addons'> = [
  import.meta.resolve('@storybook/react-dom-shim/preset'),
];

export const previewAnnotations: PresetProperty<'previewAnnotations'> = async (
  input = [],
  options
) => {
  const docsConfig = await options.presets.apply('docs', {}, options);
  const features = await options.presets.apply('features', {}, options);
  const docsEnabled = Object.keys(docsConfig).length > 0;
  const result: string[] = [];

  return result
    .concat(input)
    .concat([import.meta.resolve('@storybook/react/entry-preview')])
    .concat([import.meta.resolve('@storybook/react/entry-preview-argtypes')])
    .concat(docsEnabled ? [import.meta.resolve('@storybook/react/entry-preview-docs')] : [])
    .concat(
      features?.experimentalRSC ? [import.meta.resolve('@storybook/react/entry-preview-rsc')] : []
    );
};

/**
 * Try to resolve react and react-dom from the root node_modules of the project addon-docs uses this
 * to alias react and react-dom to the project's version when possible If the user doesn't have an
 * explicit dependency on react this will return the existing values Which will be the versions
 * shipped with addon-docs
 *
 * We do the exact same thing in the common preset, but that will fail in Yarn PnP because
 *
 * Storybook/internal/core-server doesn't have a peer dependency on react This will make
 *
 * @storybook/react projects work in Yarn PnP
 */
export const resolvedReact = async (existing: any) => {
  try {
    return {
      ...existing,
      react: resolvePackageDir('react'),
      reactDom: resolvePackageDir('react-dom'),
    };
  } catch (e) {
    return existing;
  }
};
