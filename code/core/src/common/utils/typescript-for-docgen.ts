import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { once } from 'storybook/internal/node-logger';
import type { Options } from 'storybook/internal/types';
import { SupportedRenderer } from 'storybook/internal/types';

import {
  type BuilderDocgenFallback,
  BuilderDocgenPackagesMissingError,
  TypeScriptMissingForDocgenError,
  TypeScriptWithoutCompilerApiError,
} from '../../server-errors.ts';
import {
  type BuilderDocgenPackages,
  getAddDevDependenciesCommand,
  getResolvedPackageVersion,
  isModuleNotFoundError,
  isPackageInstalledInRange,
} from './builder-docgen-packages.ts';
import { loadMainConfig } from './load-main-config.ts';

/** Renderers whose docgen needs `typescript`, which they declare as a peer dependency. */
export const RENDERERS_WITH_TYPESCRIPT_DOCGEN: readonly SupportedRenderer[] = [
  SupportedRenderer.REACT,
  SupportedRenderer.SVELTE,
  SupportedRenderer.VUE3,
  SupportedRenderer.WEB_COMPONENTS,
];

/** The `typescript` dependency that `storybook init` and upgrades add to projects without one. */
export const TYPESCRIPT_FOR_DOCGEN_PACKAGE = 'typescript@^6';

/** Return whether a TypeScript version has the compiler API (`ts.*`) that docgen is built on. */
export const hasTypeScriptCompilerApi = (version: string) => Number(version.split('.')[0]) < 7;

/**
 * Check whether `typescript` resolves to a version with the compiler API that docgen needs.
 *
 * `resolve` must resolve from the calling package, for example
 * `(specifier) => import.meta.resolve(specifier)`, because strict package managers only expose
 * `typescript` to the packages that declare it.
 */
export function getTypeScriptForDocgenError(
  resolve: (specifier: string) => string
): TypeScriptMissingForDocgenError | TypeScriptWithoutCompilerApiError | undefined {
  let version: unknown;
  try {
    const packageJsonPath = fileURLToPath(resolve('typescript/package.json'));
    ({ version } = JSON.parse(readFileSync(packageJsonPath, 'utf-8')));
  } catch (cause) {
    return new TypeScriptMissingForDocgenError({ cause });
  }
  if (typeof version !== 'string') {
    return new TypeScriptMissingForDocgenError();
  }
  return hasTypeScriptCompilerApi(version)
    ? undefined
    : new TypeScriptWithoutCompilerApiError({ version });
}

/**
 * Describe the builder docgen package a renderer falls back to without a usable `typescript`, so
 * the TypeScript warning can say whether docgen still runs.
 */
function getBuilderDocgenFallback(
  resolve: (specifier: string) => string,
  { packageName, range }: { packageName: string; range: string }
): BuilderDocgenFallback {
  return { packageName, installed: isPackageInstalledInRange(resolve, packageName, range) };
}

/** Return the `features.docgenServer` value the project's main config sets, if any. */
async function getDocgenServerInMainConfig({
  configDir,
}: Pick<Options, 'configDir'>): Promise<boolean | undefined> {
  try {
    const { features } = await loadMainConfig({ configDir });
    return typeof features === 'object' && typeof features.docgenServer === 'boolean'
      ? features.docgenServer
      : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Return whether the project's main config sets `features.docgenServer: false`.
 *
 * The `features` default already turns the docgen server off when `typescript` is unusable, so
 * only the main config tells a deliberate opt-out apart from that default.
 */
export async function isDocgenServerDisabledInMainConfig(
  options: Pick<Options, 'configDir'>
): Promise<boolean> {
  return (await getDocgenServerInMainConfig(options)) === false;
}

/**
 * Return whether the docgen server can run, and warn once with the fix when it cannot.
 *
 * Use it as a renderer's `isDocgenProviderEnabled` preset, so a project without a usable
 * `typescript` keeps builder docgen. A project that sets `features.docgenServer: false` gets no
 * warning.
 *
 * Pass `builderDocgenFallback` when builder docgen needs an optional package, such as React's
 * `react-docgen`. The warning then says whether docgen still runs. It does not suggest installing
 * the package: the way forward is the docgen server.
 */
export async function isTypeScriptReadyForDocgen(
  resolve: (specifier: string) => string,
  options: Pick<Options, 'configDir'>,
  {
    builderDocgenFallback: fallbackPackage,
  }: {
    /** The package builder docgen needs, with its supported range, such as React's `react-docgen`. */
    builderDocgenFallback?: { packageName: string; range: string };
  } = {}
): Promise<boolean> {
  const error = getTypeScriptForDocgenError(resolve);
  if (!error) {
    return true;
  }
  const docgenServer = await getDocgenServerInMainConfig(options);
  if (docgenServer === false) {
    return false;
  }
  // With `docgenServer: true` in the main config, builder docgen does not run as a fallback.
  const builderDocgenFallback =
    fallbackPackage && docgenServer !== true
      ? getBuilderDocgenFallback(resolve, fallbackPackage)
      : undefined;
  const warning = !builderDocgenFallback
    ? error
    : error instanceof TypeScriptWithoutCompilerApiError
      ? new TypeScriptWithoutCompilerApiError({ ...error.data, builderDocgenFallback })
      : new TypeScriptMissingForDocgenError({ ...error.data, builderDocgenFallback });
  once.warn(warning.message);
  return false;
}

/**
 * Import `typescript` and check that it has the compiler API that docgen needs.
 *
 * Pass `() => import('typescript')` from the calling package, so the import resolves where that
 * package declares its `typescript` peer.
 *
 * @throws {TypeScriptMissingForDocgenError} When `typescript` cannot be resolved.
 * @throws {TypeScriptWithoutCompilerApiError} When `typescript` is TypeScript 7 or newer.
 */
export async function loadTypeScriptCompilerApi<TypeScript extends { version: string }>(
  importTypeScript: () => Promise<TypeScript & { default?: TypeScript }>
): Promise<TypeScript> {
  let typescript: TypeScript;
  try {
    const imported = await importTypeScript();
    typescript = imported.default ?? imported;
  } catch (cause) {
    if (isModuleNotFoundError(cause)) {
      throw new TypeScriptMissingForDocgenError({ cause });
    }
    throw cause;
  }
  if (!hasTypeScriptCompilerApi(typescript.version)) {
    throw new TypeScriptWithoutCompilerApiError({ version: typescript.version });
  }
  return typescript;
}

/**
 * Check that the packages builder docgen needs are installed, and report it once when they are not.
 *
 * Call it from a renderer once builder docgen is active, with the packages its mode needs. It
 * reports one thing per cause:
 *
 * - The main config sets `features.docgenServer: false`, so the user chose builder docgen: it throws
 *   a {@link BuilderDocgenPackagesMissingError} when packages are missing, so Storybook does not start
 *   with a configuration it cannot honor. Otherwise it warns about the deprecation.
 * - `typescript` is unusable, so the docgen server is off by default: nothing, because the
 *   `isDocgenProviderEnabled` preset already warned about it.
 * - Anything else that turned the docgen server off: a {@link BuilderDocgenPackagesMissingError}
 *   warning when packages are missing.
 *
 * @returns The packages that do not resolve in a supported version. Builder docgen must not run
 *   when this is non-empty.
 * @throws {BuilderDocgenPackagesMissingError} When the main config sets `docgenServer: false` and
 *   packages are missing.
 */
export async function checkBuilderDocgenPackages({
  packages,
  resolve,
  options,
  builderDocgen,
  disableBuilderDocgen,
  documentation,
  getNote,
}: {
  packages: BuilderDocgenPackages;
  /** Resolve from the package that declares the packages as optional peers. */
  resolve: (specifier: string) => string;
  options: Pick<Options, 'configDir'>;
  /** The main config option that selects builder docgen, e.g. `typescript.reactDocgen: 'react-docgen'`. */
  builderDocgen: string;
  /** The main config option that turns builder docgen off, e.g. `typescript.reactDocgen: false`. */
  disableBuilderDocgen: string;
  documentation: string;
  /** A renderer-specific explanation for the error, if any. */
  getNote?: (context: { typescriptUsable: boolean }) => string | undefined;
}): Promise<string[]> {
  const missing = Object.keys(packages).filter(
    (name) => !isPackageInstalledInRange(resolve, name, packages[name])
  );
  const docgenServerDisabledInMainConfig = await isDocgenServerDisabledInMainConfig(options);

  if (missing.length > 0) {
    const typescriptUsable = !getTypeScriptForDocgenError(resolve);
    if (!docgenServerDisabledInMainConfig && !typescriptUsable) {
      // The `isDocgenProviderEnabled` preset already warned about the unusable `typescript`.
      return missing;
    }
    const foundVersions = Object.fromEntries(
      missing.flatMap((name) => {
        const version = getResolvedPackageVersion(resolve, name);
        return version ? [[name, version]] : [];
      })
    );
    const error = new BuilderDocgenPackagesMissingError({
      builderDocgen,
      disableBuilderDocgen,
      documentation,
      note: getNote?.({ typescriptUsable }),
      packages: missing,
      installCommand: getAddDevDependenciesCommand(
        Object.fromEntries(missing.map((name) => [name, packages[name]]))
      ),
      docgenServerDisabledInMainConfig,
      typescriptUsable,
      foundVersions,
    });
    if (docgenServerDisabledInMainConfig) {
      throw error;
    }
    once.warn(error.message);
    return missing;
  }

  if (docgenServerDisabledInMainConfig) {
    once.warn(
      `Builder docgen (\`${builderDocgen}\`) is deprecated and will be removed in Storybook 12. ` +
        `It runs because your Storybook main config sets \`features.docgenServer: false\`. Remove that setting to use server-side docgen.`
    );
  }
  return missing;
}
