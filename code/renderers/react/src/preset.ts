import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { PresetProperty } from 'storybook/internal/types';

export const addons: PresetProperty<'addons'> = [
  fileURLToPath(import.meta.resolve('@storybook/react-dom-shim/dist/preset')),
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
    .concat([join(__dirname, 'entry-preview.js')])
    .concat(docsEnabled ? [join(__dirname, 'entry-preview-docs.js')] : [])
    .concat(features?.experimentalRSC ? [join(__dirname, 'entry-preview-rsc.js')] : []);
};

/**
 * Try to resolve react and react-dom from the root node_modules of the project addon-docs uses this
 * to alias react and react-dom to the project's version when possible If the user doesn't have an
 * explicit dependency on react this will return the existing values Which will be the versions
 * shipped with addon-docs
 *
 * We do the exact same thing in the common preset, but that will fail in Yarn PnP because
 *
 * @storybook/core-server doesn't have a peer dependency on react
 * This will make @storybook/react projects work in Yarn PnP
 */
export const resolvedReact = async (existing: any) => {
  try {
    return {
      ...existing,
      react: dirname(fileURLToPath(import.meta.resolve('react/package.json'))),
      reactDom: dirname(fileURLToPath(import.meta.resolve('react-dom/package.json'))),
    };
  } catch (e) {
    return existing;
  }
};
