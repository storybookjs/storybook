import path, { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { getProjectRoot } from 'storybook/internal/common';
import type { ArgTypes } from 'storybook/internal/csf';
import type { Options, PresetProperty } from 'storybook/internal/types';

import { resolvePackageDir } from '../../../core/src/shared/utils/module';
import { extractArgTypesFromDocgen } from './componentManifest/reactDocgen/extractReactDocgenInfo';
import { extractArgTypesFromDocgenTypescript } from './componentManifest/reactDocgen/extractReactTypescriptDocgenInfo';
import type {
  GetArgTypesDataOptions,
  ReactDocgenConfig,
} from './componentManifest/reactDocgen/utils';

type TypescriptOptionsWithDocgen = {
  reactDocgen?: ReactDocgenConfig;
  reactDocgenTypescriptOptions?: Record<string, unknown>;
};

interface InternalGetArgTypesDataOptions extends GetArgTypesDataOptions {
  presets?: Options['presets'];
}

export const addons: PresetProperty<'addons'> = [
  import.meta.resolve('@storybook/react-dom-shim/preset'),
];

export { manifests as experimental_manifests } from './componentManifest/generator';

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

export async function internal_getArgTypesData(
  _input: unknown,
  options: InternalGetArgTypesDataOptions
): Promise<ArgTypes | null> {
  const { componentFilePath, componentExportName, presets } = (options ??
    {}) as InternalGetArgTypesDataOptions;

  if (!componentFilePath) {
    return null;
  }

  // Get typescript options from presets to determine which docgen to use
  let typescriptOptions: TypescriptOptionsWithDocgen = {};
  if (presets) {
    try {
      const appliedOptions = await presets.apply('typescript', {});
      typescriptOptions = appliedOptions as TypescriptOptionsWithDocgen;
    } catch {
      // If typescript preset is not available, use defaults
    }
  }

  const { reactDocgen = 'react-docgen', reactDocgenTypescriptOptions } = typescriptOptions;

  // If docgen is disabled, return null
  if (reactDocgen === false) {
    return null;
  }

  const resolvedFilePath = path.isAbsolute(componentFilePath)
    ? componentFilePath
    : join(getProjectRoot(), componentFilePath);

  // Choose the appropriate extractor based on the reactDocgen option
  let argTypesData;
  if (reactDocgen === 'react-docgen-typescript') {
    argTypesData = await extractArgTypesFromDocgenTypescript({
      componentFilePath: resolvedFilePath,
      componentExportName,
      reactDocgenTypescriptOptions,
    });
  } else {
    // Default to 'react-docgen'
    argTypesData = extractArgTypesFromDocgen({
      componentFilePath: resolvedFilePath,
      componentExportName,
    });
  }

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
