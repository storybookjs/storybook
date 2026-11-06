import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
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
import { dirname, isAbsolute, join, resolve } from 'pathe';

import {
  type BuilderDocgenPackages,
  getAddDevDependenciesCommand,
  getResolvedPackageVersion,
  isModuleNotFoundError,
  isPackageInstalledInRange,
} from './builder-docgen-packages.ts';
import { loadMainConfig } from './load-main-config.ts';
import { isTypeScript71Stable } from './typescript-7-1-stable.ts';

/** Renderers whose docgen needs `typescript`, which they declare as a peer dependency. */
export const RENDERERS_WITH_TYPESCRIPT_DOCGEN: readonly SupportedRenderer[] = [
  SupportedRenderer.REACT,
  SupportedRenderer.SVELTE,
  SupportedRenderer.VUE3,
  SupportedRenderer.WEB_COMPONENTS,
];

export type TypeScriptDocgenApi = 'compiler' | 'native';

const COMPILER_API_ONLY: readonly TypeScriptDocgenApi[] = ['compiler'];

const DOCGEN_APIS_BY_RENDERER: Partial<Record<SupportedRenderer, readonly TypeScriptDocgenApi[]>> =
  {
    [SupportedRenderer.REACT]: ['compiler', 'native'],
    [SupportedRenderer.ANGULAR]: COMPILER_API_ONLY,
  };

export const recommendedTypeScriptDocgenApis = (
  renderer: SupportedRenderer
): readonly TypeScriptDocgenApi[] => DOCGEN_APIS_BY_RENDERER[renderer] ?? COMPILER_API_ONLY;

export const typeScriptPackageForDocgen = (
  apis: readonly TypeScriptDocgenApi[] = COMPILER_API_ONLY
) => (apis.includes('native') && isTypeScript71Stable() ? 'typescript@^7.1' : 'typescript@^6');

export const getTypeScriptUpgradeForDocgen = (
  apis: readonly TypeScriptDocgenApi[],
  packageJson: { dependencies?: Partial<Record<string, string>> }
): { dependency: string; type: 'dependencies' | 'devDependencies' } | undefined =>
  apis.includes('native') && isTypeScript71Stable()
    ? {
        dependency: typeScriptPackageForDocgen(apis),
        type: packageJson.dependencies?.typescript ? 'dependencies' : 'devDependencies',
      }
    : undefined;

export const getTypeScriptDocgenApi = (version: string): TypeScriptDocgenApi | undefined => {
  const [major, minor] = version.split('.').map(Number);
  if (major < 7) {
    return 'compiler';
  }
  return major === 7 && minor === 0 ? undefined : 'native';
};

export const isTypeScriptUsableForDocgen = (
  version: string,
  apis: readonly TypeScriptDocgenApi[] = COMPILER_API_ONLY
) => {
  const api = getTypeScriptDocgenApi(version);
  return api !== undefined && apis.includes(api);
};

export interface TypeScriptSpecifierForDocgen {
  specifier: string;
  configDir: string;
}

export async function getTypeScriptSpecifierForDocgen({
  configDir,
  presets,
}: Pick<Options, 'configDir' | 'presets'>): Promise<TypeScriptSpecifierForDocgen | undefined> {
  const { docgenSpecifier } = (await presets.apply('typescript', {})) ?? {};
  return docgenSpecifier ? { specifier: docgenSpecifier, configDir } : undefined;
}

const resolvePackageDirLikeMainConfig = ({
  specifier,
  configDir,
}: TypeScriptSpecifierForDocgen) => {
  if (specifier.startsWith('file:')) {
    return fileURLToPath(specifier);
  }
  if (isAbsolute(specifier) || specifier.startsWith('.')) {
    return resolve(configDir, specifier);
  }
  const require = createRequire(join(configDir, 'main.js'));
  return dirname(require.resolve(`${specifier}/package.json`));
};

export interface TypeScriptPackageForDocgen {
  version: string;
  packageDir: string;
  main?: string;
  exports?: Record<string, unknown>;
}

export function readTypeScriptPackageForDocgen(
  typeScriptSpecifier: TypeScriptSpecifierForDocgen,
  apis: readonly TypeScriptDocgenApi[] = COMPILER_API_ONLY
): TypeScriptPackageForDocgen {
  let packageDir: string;
  let packageJson: { version?: unknown; main?: string; exports?: Record<string, unknown> };
  try {
    packageDir = resolvePackageDirLikeMainConfig(typeScriptSpecifier);
    packageJson = JSON.parse(readFileSync(join(packageDir, 'package.json'), 'utf-8'));
  } catch (cause) {
    throw new TypeScriptMissingForDocgenError({
      cause,
      apis,
      specifier: typeScriptSpecifier.specifier,
    });
  }
  if (typeof packageJson.version !== 'string') {
    throw new TypeScriptMissingForDocgenError({ apis, specifier: typeScriptSpecifier.specifier });
  }
  const { version, main, exports } = packageJson;
  return { version, packageDir, main, exports };
}

const unusableVersionError = (
  version: string,
  apis: readonly TypeScriptDocgenApi[],
  specifier?: string
) =>
  isTypeScriptUsableForDocgen(version, apis)
    ? undefined
    : new TypeScriptWithoutCompilerApiError({ version, apis, specifier });

// `resolve` must resolve from the calling package, for example
// `(specifier) => import.meta.resolve(specifier)`, because strict package managers only expose
// `typescript` to the packages that declare it.
export function getTypeScriptForDocgenError(
  resolve: (specifier: string) => string,
  {
    apis = COMPILER_API_ONLY,
    typeScriptSpecifier,
  }: {
    apis?: readonly TypeScriptDocgenApi[];
    typeScriptSpecifier?: TypeScriptSpecifierForDocgen;
  } = {}
): TypeScriptMissingForDocgenError | TypeScriptWithoutCompilerApiError | undefined {
  if (typeScriptSpecifier) {
    try {
      const { version } = readTypeScriptPackageForDocgen(typeScriptSpecifier, apis);
      return unusableVersionError(version, apis, typeScriptSpecifier.specifier);
    } catch (error) {
      return error as TypeScriptMissingForDocgenError;
    }
  }
  let version: unknown;
  try {
    const packageJsonPath = fileURLToPath(resolve('typescript/package.json'));
    ({ version } = JSON.parse(readFileSync(packageJsonPath, 'utf-8')));
  } catch (cause) {
    return new TypeScriptMissingForDocgenError({ cause, apis });
  }
  if (typeof version !== 'string') {
    return new TypeScriptMissingForDocgenError({ apis });
  }
  return unusableVersionError(version, apis);
}

async function getDocgenTypeScriptError(
  resolve: (specifier: string) => string,
  options: Pick<Options, 'configDir' | 'presets'>,
  apis: readonly TypeScriptDocgenApi[] | undefined
) {
  const typeScriptSpecifier = apis?.includes('native')
    ? await getTypeScriptSpecifierForDocgen(options)
    : undefined;
  return {
    error: getTypeScriptForDocgenError(resolve, { apis, typeScriptSpecifier }),
    specifier: typeScriptSpecifier?.specifier,
  };
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
  options: Pick<Options, 'configDir' | 'presets'>,
  {
    apis,
    builderDocgenFallback: fallbackPackage,
  }: {
    apis?: readonly TypeScriptDocgenApi[];
    /** The package builder docgen needs, with its supported range, such as React's `react-docgen`. */
    builderDocgenFallback?: { packageName: string; range: string };
  } = {}
): Promise<boolean> {
  const { error } = await getDocgenTypeScriptError(resolve, options, apis);
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

const importTypeScript = async <TypeScript>(
  importer: () => Promise<TypeScript & { default?: TypeScript }>,
  apis: readonly TypeScriptDocgenApi[]
): Promise<TypeScript> => {
  try {
    const imported = await importer();
    return imported.default ?? imported;
  } catch (cause) {
    if (isModuleNotFoundError(cause)) {
      throw new TypeScriptMissingForDocgenError({ cause, apis });
    }
    throw cause;
  }
};

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
  importTypeScriptModule: () => Promise<TypeScript & { default?: TypeScript }>
): Promise<TypeScript> {
  const typescript = await importTypeScript(importTypeScriptModule, COMPILER_API_ONLY);
  const error = unusableVersionError(typescript.version, COMPILER_API_ONLY);
  if (error) {
    throw error;
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
  note,
  apis,
}: {
  packages: BuilderDocgenPackages;
  /** Resolve from the package that declares the packages as optional peers. */
  resolve: (specifier: string) => string;
  options: Pick<Options, 'configDir' | 'presets'>;
  /** The main config option that selects builder docgen, e.g. `typescript.reactDocgen: 'react-docgen'`. */
  builderDocgen: string;
  /** The main config option that turns builder docgen off, e.g. `typescript.reactDocgen: false`. */
  disableBuilderDocgen: string;
  documentation: string;
  /** A renderer-specific explanation for the error, if any. */
  note?: string;
  apis?: readonly TypeScriptDocgenApi[];
}): Promise<string[]> {
  const missing = Object.keys(packages).filter(
    (name) => !isPackageInstalledInRange(resolve, name, packages[name])
  );
  const docgenServerDisabledInMainConfig = await isDocgenServerDisabledInMainConfig(options);

  if (missing.length > 0) {
    const { error: typescriptError, specifier } = await getDocgenTypeScriptError(
      resolve,
      options,
      apis
    );
    const typescriptUsable = !typescriptError;
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
      note,
      packages: missing,
      installCommand: getAddDevDependenciesCommand(
        Object.fromEntries(missing.map((name) => [name, packages[name]]))
      ),
      docgenServerDisabledInMainConfig,
      typescriptUsable,
      apis,
      specifier,
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
