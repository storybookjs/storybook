import {
  checkBuilderDocgenPackages,
  getTypeScriptForDocgenError,
  isPackageInstalledInRange,
  typeScriptDocgenApisFor,
} from 'storybook/internal/common';
import { type Options, SupportedRenderer } from 'storybook/internal/types';

import type { ReactDocgenConfig } from './componentManifest/reactDocgen/utils.ts';

/**
 * Packages that only React's deprecated builder docgen (`features.docgenServer: false`) uses, with
 * the version range Storybook supports. `@storybook/react`, `@storybook/react-vite`,
 * `@storybook/preset-react-webpack` and the React frameworks declare them as optional peer
 * dependencies with these ranges, which a test checks.
 */
export const REACT_BUILDER_DOCGEN_PACKAGES = {
  'react-docgen': '^8.0.2',
  'react-docgen-typescript': '^2.2.2',
  '@joshwooding/vite-plugin-react-docgen-typescript': '^0.7.0 || ^0.8.0 || ^0.9.0',
  '@storybook/react-docgen-typescript-plugin': '1.0.6--canary.9.0c3f3b7.0',
} as const;

export type ReactBuilderDocgenPackage = keyof typeof REACT_BUILDER_DOCGEN_PACKAGES;

/**
 * Return the packages that builder docgen needs for a `typescript.reactDocgen` mode.
 *
 * `react-docgen-typescript` mode needs the builder plugin and `react-docgen-typescript` itself,
 * which `@storybook/react` loads for the components manifest. In that mode the `react-docgen` pass
 * over JavaScript files is optional.
 */
export function getReactBuilderDocgenPackages(
  reactDocgen: ReactDocgenConfig | undefined,
  builder: 'vite' | 'webpack'
): ReactBuilderDocgenPackage[] {
  if (reactDocgen === 'react-docgen') {
    return ['react-docgen'];
  }
  if (reactDocgen === 'react-docgen-typescript') {
    return [
      builder === 'vite'
        ? '@joshwooding/vite-plugin-react-docgen-typescript'
        : '@storybook/react-docgen-typescript-plugin',
      'react-docgen-typescript',
    ];
  }
  return [];
}

/** Return whether a builder docgen package resolves in a version Storybook supports. */
export const isReactBuilderDocgenPackageInstalled = (
  resolve: (specifier: string) => string,
  packageName: ReactBuilderDocgenPackage
) => isPackageInstalledInRange(resolve, packageName, REACT_BUILDER_DOCGEN_PACKAGES[packageName]);

/**
 * Decide which `typescript.reactDocgen` mode builder docgen runs in, check that its packages are
 * installed, and report it when they are not. Call it from a framework preset once builder docgen
 * is active.
 *
 * @returns The mode builder docgen runs in, or `undefined` when it must not run.
 * @throws {BuilderDocgenPackagesMissingError} When the main config sets `features.docgenServer:
 *   false` and packages are missing.
 */
export async function prepareReactBuilderDocgen({
  reactDocgen,
  builder,
  resolve,
  options,
}: {
  reactDocgen: Exclude<ReactDocgenConfig, false>;
  builder: 'vite' | 'webpack';
  /** Resolve from the framework package, which declares the packages as optional peers. */
  resolve: (specifier: string) => string;
  options: Pick<Options, 'configDir' | 'presets'>;
}): Promise<Exclude<ReactDocgenConfig, false> | undefined> {
  // react-docgen-typescript runs the TypeScript compiler API, so it falls back to react-docgen
  // without a usable `typescript`.
  const mode =
    reactDocgen === 'react-docgen-typescript' && getTypeScriptForDocgenError(resolve)
      ? 'react-docgen'
      : reactDocgen;
  const packages = getReactBuilderDocgenPackages(mode, builder);
  const missing = await checkBuilderDocgenPackages({
    packages: Object.fromEntries(
      packages.map((name) => [name, REACT_BUILDER_DOCGEN_PACKAGES[name]])
    ),
    resolve,
    options,
    builderDocgen: `typescript.reactDocgen: '${reactDocgen}'`,
    disableBuilderDocgen: 'typescript.reactDocgen: false',
    documentation:
      'https://storybook.js.org/docs/api/main-config/main-config-typescript#reactdocgen',
    note:
      mode !== reactDocgen
        ? '`react-docgen-typescript` needs the TypeScript compiler API, which your `typescript` package does not have, so builder docgen uses `react-docgen` instead.'
        : undefined,
    apis: typeScriptDocgenApisFor(SupportedRenderer.REACT),
  });
  return missing.length > 0 ? undefined : mode;
}
