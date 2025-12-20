import { fileURLToPath } from 'node:url';

import type { ArgTypes } from 'storybook/internal/csf';
import type { PresetProperty } from 'storybook/internal/types';

import { resolvePackageDir } from '../../../core/src/shared/utils/module';
import {
  type GetArgTypesDataOptions,
  extractArgTypesFromDocgen,
} from './componentManifest/reactDocgen/extractDocgenInfo';

export const addons: PresetProperty<'addons'> = [
  import.meta.resolve('@storybook/react-dom-shim/preset'),
];

export { componentManifestGenerator as experimental_componentManifestGenerator } from './componentManifest/generator';

export { enrichCsf as experimental_enrichCsf } from './enrichCsf';

export const previewAnnotations: PresetProperty<'previewAnnotations'> = async (
  input = [],
  options
) => {
  const [docsConfig, features] = await Promise.all([
    options.presets.apply('docs', {}, options),
    options.presets.apply('features', {}, options),
  ]);
  const docsEnabled = Object.keys(docsConfig).length > 0;
  const experimentalRSC = features?.experimentalRSC;
  const result: string[] = [];

  return result
    .concat(input)
    .concat([
      fileURLToPath(import.meta.resolve('@storybook/react/entry-preview')),
      fileURLToPath(import.meta.resolve('@storybook/react/entry-preview-argtypes')),
    ])
    .concat(
      docsEnabled ? [fileURLToPath(import.meta.resolve('@storybook/react/entry-preview-docs'))] : []
    )
    .concat(
      experimentalRSC
        ? [fileURLToPath(import.meta.resolve('@storybook/react/entry-preview-rsc'))]
        : []
    );
};

// TODO: Evaluate if this is correct after removing pnp compatibility code in SB11

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
  } catch {
    return existing;
  }
};

export async function experimental_getArgTypesData(
  _input: unknown,
  options: GetArgTypesDataOptions
): Promise<ArgTypes | null> {
  const { componentFilePath, componentExportName } = (options ?? {}) as GetArgTypesDataOptions;

  if (!componentFilePath) {
    return null;
  }

  const argTypesData = extractArgTypesFromDocgen({ componentFilePath, componentExportName });
  if (!argTypesData?.props) {
    return null;
  }

  const argTypes: ArgTypes = {};
  for (const [propName, propInfo] of Object.entries(argTypesData.props)) {
    argTypes[propName] = {
      name: propName,
      type: propInfo.required ? { ...propInfo.type, required: true } : propInfo.type,
    };
  }

  return argTypes;
}
