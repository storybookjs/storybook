import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { once } from 'storybook/internal/node-logger';
import type { Options } from 'storybook/internal/types';
import { SupportedRenderer } from 'storybook/internal/types';

import {
  TypeScriptMissingForDocgenError,
  TypeScriptWithoutCompilerApiError,
} from '../../server-errors.ts';
import { dirname, isAbsolute, join, resolve } from 'pathe';

import { loadMainConfig } from './load-main-config.ts';

/** Renderers whose docgen needs `typescript`, which they declare as a peer dependency. */
export const RENDERERS_WITH_TYPESCRIPT_DOCGEN: readonly SupportedRenderer[] = [
  SupportedRenderer.REACT,
  SupportedRenderer.SVELTE,
  SupportedRenderer.VUE3,
  SupportedRenderer.WEB_COMPONENTS,
];

/**
 * The API a `typescript` package offers docgen.
 *
 * - `compiler`: the in-process compiler API (`ts.createProgram`, `ts.TypeChecker`) of TypeScript 5.9
 *   and 6.
 * - `native`: the API of TypeScript 7.1 and newer (`typescript/sync`, `typescript/ast`), which drives
 *   the native compiler in a child process.
 *
 * TypeScript 7.0 offers neither.
 */
export type TypeScriptDocgenApi = 'compiler' | 'native';

const COMPILER_API_ONLY: readonly TypeScriptDocgenApi[] = ['compiler'];

const DOCGEN_APIS_BY_RENDERER: Partial<Record<SupportedRenderer, readonly TypeScriptDocgenApi[]>> =
  {
    [SupportedRenderer.REACT]: ['compiler', 'native'],
  };

/** Return the TypeScript APIs that a renderer's docgen can run on. */
export const typeScriptDocgenApisFor = (
  renderer: SupportedRenderer
): readonly TypeScriptDocgenApi[] => DOCGEN_APIS_BY_RENDERER[renderer] ?? COMPILER_API_ONLY;

/** Return the `typescript` dependency to add to a project without one, for the given APIs. */
export const typeScriptPackageForDocgen = (
  apis: readonly TypeScriptDocgenApi[] = COMPILER_API_ONLY
) => (apis.includes('native') ? 'typescript@^7.1' : 'typescript@^6');

/** Return which API a TypeScript version offers docgen, or `undefined` for TypeScript 7.0. */
export const getTypeScriptDocgenApi = (version: string): TypeScriptDocgenApi | undefined => {
  const [major, minor] = version.split('.').map(Number);
  if (major < 7) {
    return 'compiler';
  }
  return major === 7 && minor === 0 ? undefined : 'native';
};

/** Return whether a TypeScript version offers one of the given docgen APIs. */
export const isTypeScriptUsableForDocgen = (
  version: string,
  apis: readonly TypeScriptDocgenApi[] = COMPILER_API_ONLY
) => {
  const api = getTypeScriptDocgenApi(version);
  return api !== undefined && apis.includes(api);
};

/** The main config's `typescript.docgenSpecifier`, with the directory it resolves from. */
export interface TypeScriptSpecifierForDocgen {
  specifier: string;
  configDir: string;
}

/** Return the main config's `typescript.docgenSpecifier`, or `undefined` when it is not set. */
export async function getTypeScriptSpecifierForDocgen({
  configDir,
  presets,
}: Pick<Options, 'configDir' | 'presets'>): Promise<TypeScriptSpecifierForDocgen | undefined> {
  const { docgenSpecifier } = (await presets.apply('typescript', {})) ?? {};
  return docgenSpecifier ? { specifier: docgenSpecifier, configDir } : undefined;
}

// Resolved as if the main config imported it, which is where a user writes the specifier.
const packageDirOf = ({ specifier, configDir }: TypeScriptSpecifierForDocgen) => {
  if (specifier.startsWith('file:')) {
    return fileURLToPath(specifier);
  }
  if (isAbsolute(specifier) || specifier.startsWith('.')) {
    return resolve(configDir, specifier);
  }
  const require = createRequire(join(configDir, 'main.js'));
  return dirname(require.resolve(`${specifier}/package.json`));
};

/**
 * Read the TypeScript package a `docgenSpecifier` names, and import its entry points.
 *
 * A path is not a package specifier, so Node would not apply the package's `exports` to
 * `<path>/sync`; the entry points are read from its package.json instead, for every specifier.
 *
 * @throws {TypeScriptMissingForDocgenError} When the specifier names no package.
 */
export function readTypeScriptPackageForDocgen(
  typeScriptSpecifier: TypeScriptSpecifierForDocgen,
  apis: readonly TypeScriptDocgenApi[] = COMPILER_API_ONLY
): { version: string; importEntry: (subpath: string) => Promise<unknown> } {
  let packageDir: string;
  let packageJson: { version?: unknown; main?: string; exports?: Record<string, unknown> };
  try {
    packageDir = packageDirOf(typeScriptSpecifier);
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
  return {
    version,
    importEntry: async (subpath) => {
      const entry = exports ? exports[subpath] : subpath === '.' ? (main ?? 'index.js') : undefined;
      if (typeof entry !== 'string') {
        throw new Error(
          `TypeScript ${version} at ${packageDir} has no "${subpath}" entry point that Storybook can import`
        );
      }
      return import(pathToFileURL(join(packageDir, entry)).href);
    },
  };
}

const isModuleNotFound = (error: unknown) =>
  error instanceof Error &&
  'code' in error &&
  (error.code === 'ERR_MODULE_NOT_FOUND' || error.code === 'MODULE_NOT_FOUND');

const unusableVersionError = (
  version: string,
  apis: readonly TypeScriptDocgenApi[],
  specifier?: string
) =>
  isTypeScriptUsableForDocgen(version, apis)
    ? undefined
    : new TypeScriptWithoutCompilerApiError({ version, apis, specifier });

/**
 * Check whether `typescript` resolves to a version with an API that docgen can run on.
 *
 * `resolve` must resolve from the calling package, for example
 * `(specifier) => import.meta.resolve(specifier)`, because strict package managers only expose
 * `typescript` to the packages that declare it. `apis` lists the APIs the caller supports; the
 * default is the compiler API alone. With `typeScriptSpecifier`, the package it names is checked
 * instead of `typescript`.
 */
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

/**
 * Return whether the project's main config sets `features.docgenServer: false`.
 *
 * The `features` default already turns the docgen server off when `typescript` is unusable, so
 * only the main config tells a deliberate opt-out apart from that default.
 */
export async function isDocgenServerDisabledInMainConfig({
  configDir,
}: Pick<Options, 'configDir'>): Promise<boolean> {
  try {
    const { features } = await loadMainConfig({ configDir });
    return typeof features === 'object' && features.docgenServer === false;
  } catch {
    return false;
  }
}

/**
 * Return whether the docgen server can run, and warn once with the fix when it cannot.
 *
 * Use it as a renderer's `isDocgenProviderEnabled` preset, so a project without a usable
 * `typescript` keeps builder docgen. A project that sets `features.docgenServer: false` gets no
 * warning. Docgen that runs on the native API loads the package `typescript.docgenSpecifier` names,
 * so that package is checked instead of `typescript` when the option is set.
 */
export async function isTypeScriptReadyForDocgen(
  resolve: (specifier: string) => string,
  options: Pick<Options, 'configDir' | 'presets'>,
  { apis }: { apis?: readonly TypeScriptDocgenApi[] } = {}
): Promise<boolean> {
  const typeScriptSpecifier = apis?.includes('native')
    ? await getTypeScriptSpecifierForDocgen(options)
    : undefined;
  const error = getTypeScriptForDocgenError(resolve, { apis, typeScriptSpecifier });
  if (error && !(await isDocgenServerDisabledInMainConfig(options))) {
    once.warn(error.message);
  }
  return !error;
}

const importTypeScript = async <TypeScript>(
  importer: () => Promise<TypeScript & { default?: TypeScript }>,
  apis: readonly TypeScriptDocgenApi[]
): Promise<TypeScript> => {
  try {
    const imported = await importer();
    return imported.default ?? imported;
  } catch (cause) {
    if (isModuleNotFound(cause)) {
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

export type LoadedTypeScriptForDocgen<CompilerApi, NativeApi> =
  | { api: 'compiler'; typescript: CompilerApi }
  | { api: 'native'; typescript: NativeApi };

/**
 * Import `typescript` and load the API it offers docgen: the compiler API of TypeScript 5.9 and 6,
 * or the native API of TypeScript 7.1 and newer.
 *
 * Both importers must import from the calling package, so they resolve where that package declares
 * its `typescript` peer. The `typescript` main module of every version exports `version`, so the
 * compiler importer runs first and decides which API to load. Pass the `specifier` the importers
 * load from when it is not `typescript`, so the errors name it.
 *
 * @throws {TypeScriptMissingForDocgenError} When `typescript` cannot be resolved.
 * @throws {TypeScriptWithoutCompilerApiError} When `typescript` is TypeScript 7.0.
 */
export async function loadTypeScriptForDocgen<CompilerApi extends { version: string }, NativeApi>({
  importCompilerApi,
  importNativeApi,
  specifier,
}: {
  importCompilerApi: () => Promise<CompilerApi & { default?: CompilerApi }>;
  importNativeApi: () => Promise<NativeApi>;
  specifier?: string;
}): Promise<LoadedTypeScriptForDocgen<CompilerApi, NativeApi>> {
  const apis: readonly TypeScriptDocgenApi[] = ['compiler', 'native'];
  const typescript = await importTypeScript(importCompilerApi, apis);
  const error = unusableVersionError(typescript.version, apis, specifier);
  if (error) {
    throw error;
  }
  return getTypeScriptDocgenApi(typescript.version) === 'native'
    ? { api: 'native', typescript: await importNativeApi() }
    : { api: 'compiler', typescript };
}
