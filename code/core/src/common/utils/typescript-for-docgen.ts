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

/** The `typescript` dependency that `storybook init` and upgrades add to projects without one. */
export const TYPESCRIPT_FOR_DOCGEN_PACKAGE = 'typescript@^6';

/** Return whether a TypeScript version has the compiler API (`ts.*`) that docgen is built on. */
export const hasTypeScriptCompilerApi = (version: string) => Number(version.split('.')[0]) < 7;

const isModuleNotFound = (error: unknown) =>
  error instanceof Error &&
  'code' in error &&
  (error.code === 'ERR_MODULE_NOT_FOUND' || error.code === 'MODULE_NOT_FOUND');

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
  options: Pick<Options, 'configDir'>
): Promise<boolean> {
  const error = getTypeScriptForDocgenError(resolve);
  if (error && !(await isDocgenServerDisabledInMainConfig(options))) {
    once.warn(error.message);
  }
  return !error;
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
    if (isModuleNotFound(cause)) {
      throw new TypeScriptMissingForDocgenError({ cause });
    }
    throw cause;
  }
  if (!hasTypeScriptCompilerApi(typescript.version)) {
    throw new TypeScriptWithoutCompilerApiError({ version: typescript.version });
  }
  return typescript;
}
