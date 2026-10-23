import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { once } from 'storybook/internal/node-logger';
import type { Options } from 'storybook/internal/types';
import { SupportedRenderer } from 'storybook/internal/types';

import {
  TypeScriptMissingForDocgenError,
  TypeScriptWithoutCompilerApiError,
} from '../../server-errors.ts';
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

/** Return whether a TypeScript version has the compiler API (`ts.*`) that most docgen is built on. */
export const hasTypeScriptCompilerApi = (version: string) =>
  getTypeScriptDocgenApi(version) === 'compiler';

const isModuleNotFound = (error: unknown) =>
  error instanceof Error &&
  'code' in error &&
  (error.code === 'ERR_MODULE_NOT_FOUND' || error.code === 'MODULE_NOT_FOUND');

const unusableVersionError = (version: string, apis: readonly TypeScriptDocgenApi[]) => {
  const api = getTypeScriptDocgenApi(version);
  return api && apis.includes(api)
    ? undefined
    : new TypeScriptWithoutCompilerApiError({ version, apis });
};

/**
 * Check whether `typescript` resolves to a version with an API that docgen can run on.
 *
 * `resolve` must resolve from the calling package, for example
 * `(specifier) => import.meta.resolve(specifier)`, because strict package managers only expose
 * `typescript` to the packages that declare it. `apis` lists the APIs the caller supports; the
 * default is the compiler API alone.
 */
export function getTypeScriptForDocgenError(
  resolve: (specifier: string) => string,
  { apis = COMPILER_API_ONLY }: { apis?: readonly TypeScriptDocgenApi[] } = {}
): TypeScriptMissingForDocgenError | TypeScriptWithoutCompilerApiError | undefined {
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
 * warning.
 */
export async function isTypeScriptReadyForDocgen(
  resolve: (specifier: string) => string,
  options: Pick<Options, 'configDir'>,
  { apis }: { apis?: readonly TypeScriptDocgenApi[] } = {}
): Promise<boolean> {
  const error = getTypeScriptForDocgenError(resolve, { apis });
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
 * compiler importer runs first and decides which API to load.
 *
 * @throws {TypeScriptMissingForDocgenError} When `typescript` cannot be resolved.
 * @throws {TypeScriptWithoutCompilerApiError} When `typescript` is TypeScript 7.0.
 */
export async function loadTypeScriptForDocgen<CompilerApi extends { version: string }, NativeApi>({
  importCompilerApi,
  importNativeApi,
}: {
  importCompilerApi: () => Promise<CompilerApi & { default?: CompilerApi }>;
  importNativeApi: () => Promise<NativeApi>;
}): Promise<LoadedTypeScriptForDocgen<CompilerApi, NativeApi>> {
  const apis: readonly TypeScriptDocgenApi[] = ['compiler', 'native'];
  const typescript = await importTypeScript(importCompilerApi, apis);
  const error = unusableVersionError(typescript.version, apis);
  if (error) {
    throw error;
  }
  return getTypeScriptDocgenApi(typescript.version) === 'native'
    ? { api: 'native', typescript: await importNativeApi() }
    : { api: 'compiler', typescript };
}
