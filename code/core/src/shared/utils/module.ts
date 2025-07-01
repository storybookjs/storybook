import { createRequire, register } from 'node:module';
import { win32 } from 'node:path/win32';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { dirname, join } from 'pathe';

/**
 * This is just an alias for import.meta.resolve. It makes it possible to mock it in Vitest with
 * module-mocking, as Vitest currently does not support import.meta.resolve in tests.
 *
 * @see https://github.com/vitest-dev/vitest/issues/6953
 */
export const importMetaResolve = import.meta.resolve;

/** Resolves the directory of a given package, by resolving its package.json file. */
export const resolvePackageDir = (
  pkg: Parameters<ImportMeta['resolve']>[0],
  parent?: Parameters<ImportMeta['resolve']>[0]
) => {
  return dirname(fileURLToPath(import.meta.resolve(join(pkg, 'package.json'), parent)));
};

let isTypescriptLoaderRegistered = false;

/**
 * Dynamically imports a module with TypeScript support, falling back to require if necessary.
 *
 * @example Import a TypeScript preset
 *
 * ```ts
 * const preset = await importModule('./my-preset.ts');
 * // Returns the default export or the entire module
 * ```
 *
 * @example Import a JavaScript addon
 *
 * ```ts
 * const addon = await importModule('@storybook/addon-essentials');
 * // Returns the default export or the entire module
 * ```
 */
export async function importModule(path: string) {
  if (!isTypescriptLoaderRegistered) {
    const typescriptLoaderUrl = import.meta.resolve('storybook/internal/bin/loader');
    register(typescriptLoaderUrl, import.meta.url);
    isTypescriptLoaderRegistered = true;
  }

  let mod;
  try {
    const resolvedPath = win32.isAbsolute(path) ? pathToFileURL(path).href : path;
    mod = await import(resolvedPath);
  } catch (e) {
    // fallback to require to support older behavior
    const require = createRequire(import.meta.url);
    mod = require(path);
  }
  return mod.default ?? mod;
}
