import path, { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  getProjectRoot,
  getTypeScriptSpecifierForDocgen,
  isModuleNotFoundError,
  isTypeScriptReadyForDocgen,
  typeScriptDocgenApisFor,
} from 'storybook/internal/common';
import type { ArgTypes } from 'storybook/internal/csf';
import { logger } from 'storybook/internal/node-logger';
import { type Options, type PresetProperty, SupportedRenderer } from 'storybook/internal/types';

import { resolvePackageDir } from '../../../core/src/shared/utils/module.ts';
import { REACT_BUILDER_DOCGEN_PACKAGES } from './builder-docgen.ts';
import { aliasReactInWebpack, prependReactDedupePlugin } from './preview-react-alias.ts';
import type {
  GetArgTypesDataOptions,
  ReactDocgenConfig,
} from './componentManifest/reactDocgen/utils.ts';

type TypescriptOptionsWithDocgen = {
  reactDocgen?: ReactDocgenConfig;
  reactDocgenTypescriptOptions?: Record<string, unknown>;
};

interface InternalGetArgTypesDataOptions extends GetArgTypesDataOptions {
  presets?: Options['presets'];
  configDir?: string;
}

export { manifests as experimental_manifests } from './componentManifest/generator.ts';

export { enrichCsf as experimental_enrichCsf } from './enrichCsf.ts';

export { experimental_docgenProvider } from './docgen/preset.ts';

// Default for `features.docgenServer`; a project without a usable `typescript` keeps builder docgen,
// which needs the optional `react-docgen` package, unless `typescript.reactDocgen` turns it off
// (as `storybook build --test` does).
export const isDocgenProviderEnabled = async (_existing: unknown, options: Options) => {
  const { reactDocgen } =
    (await options.presets?.apply<TypescriptOptionsWithDocgen>('typescript', {})) ?? {};
  return isTypeScriptReadyForDocgen((specifier) => import.meta.resolve(specifier), options, {
    apis: typeScriptDocgenApisFor(SupportedRenderer.REACT),
    builderDocgenFallback:
      reactDocgen === false
        ? undefined
        : { packageName: 'react-docgen', range: REACT_BUILDER_DOCGEN_PACKAGES['react-docgen'] },
  });
};

export { experimental_storyDocsProvider } from './docgen/story-docs-preset.ts';

export const features: PresetProperty<'features'> = async (existing) => ({
  ...existing,
  componentsManifest: true,
});

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

/**
 * Resolve react and react-dom starting from this package. `@storybook/react` declares them as peer
 * dependencies, so every package manager links the project's React here, including pnpm's global
 * virtual store where the `storybook` package itself cannot see React. The preview alias below and
 * addon-docs both read this value.
 */
export const resolvedReact = async (existing: any) => {
  try {
    return {
      ...existing,
      react: resolvePackageDir('react', import.meta.url),
      reactDom: resolvePackageDir('react-dom', import.meta.url),
    };
  } catch {
    return existing;
  }
};

const readReactAliasTarget = async (options: Options) => {
  const resolved = (await options.presets.apply('resolvedReact', {})) as {
    react?: string;
    reactDom?: string;
  };
  if (!resolved?.react || !resolved.reactDom) {
    return null;
  }
  return { react: resolved.react, reactDom: resolved.reactDom };
};

export const viteFinal = async (config: { plugins?: unknown[] } = {}, options: Options) => {
  const target = await readReactAliasTarget(options);
  return target ? prependReactDedupePlugin(config, target) : config;
};

export async function webpack(
  config: {
    resolve?: {
      alias?: Record<string, string> | Array<{ name: string; alias: string }>;
    };
  } = {},
  options: Options
) {
  const target = await readReactAliasTarget(options);
  return target ? aliasReactInWebpack(config, target) : config;
}

export async function internal_getArgTypesData(
  _input: unknown,
  options: InternalGetArgTypesDataOptions
): Promise<ArgTypes | null> {
  const { componentFilePath, componentExportName, presets, configDir } = (options ??
    {}) as InternalGetArgTypesDataOptions;

  if (!componentFilePath) {
    return null;
  }

  const absoluteComponentFilePath = path.isAbsolute(componentFilePath)
    ? componentFilePath
    : join(getProjectRoot(), componentFilePath);

  // On the docgen server, infer arg types with its engine, so the optional builder docgen packages
  // are not needed. The docgen server ignores `typescript.reactDocgen`.
  const features = await presets?.apply('features', {});
  if (features?.docgenServer) {
    const { extractArgTypesFromComponentFile } =
      await import('./docgen/extractArgTypesFromComponentFile.ts');
    return extractArgTypesFromComponentFile({
      componentFilePath: absoluteComponentFilePath,
      componentExportName,
      typeScriptSpecifier:
        configDir && presets
          ? await getTypeScriptSpecifierForDocgen({ configDir, presets })
          : undefined,
    });
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

  // Builder docgen: choose the extractor based on the reactDocgen option. Both engines are optional
  // peer dependencies, so import them only here; without them there are no arg types to infer.
  let argTypesData;
  try {
    if (reactDocgen === 'react-docgen-typescript') {
      const { extractArgTypesFromDocgenTypescript } =
        await import('./componentManifest/reactDocgen/extractReactTypescriptDocgenInfo.ts');
      argTypesData = await extractArgTypesFromDocgenTypescript({
        componentFilePath: absoluteComponentFilePath,
        componentExportName,
        reactDocgenTypescriptOptions,
      });
    } else {
      // Default to 'react-docgen'
      const { extractArgTypesFromDocgen } =
        await import('./componentManifest/reactDocgen/extractReactDocgenInfo.ts');
      argTypesData = extractArgTypesFromDocgen({
        componentFilePath: absoluteComponentFilePath,
        componentExportName,
      });
    }
  } catch (error) {
    if (!isModuleNotFoundError(error)) {
      throw error;
    }
    logger.debug(`Skipping arg types inference, because ${reactDocgen} is not installed: ${error}`);
    return null;
  }

  return argTypesData;
}

export const optimizeViteDeps: string[] = [
  // The vitest project-annotations setup file imports this renderer's entry previews through a
  // virtual module, and those chunks import React by the bare specifier. In the observed failure
  // (react 19.3.1, vite 7.3.7, vitest 5.0.5, chromium browser mode) the dependency scan had not
  // registered plain `react`, so the browser loaded react's CJS index.js raw and module linking
  // failed with "The requested module 'react/index.js' does not provide an export named 'default'".
  // Projects only hit this when their stories use the automatic JSX runtime and never import
  // `react` by name; a story importing `react` (for `useState`, say) registers it in the scan
  // and masks the failure.
  'react',
  'react-dom/client',
  'react-dom/test-utils',
  'react/jsx-runtime',
];
