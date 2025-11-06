import { statSync } from 'node:fs';
import { createRequire, register } from 'node:module';
import { win32 } from 'node:path/win32';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { resolveModulePath } from 'exsolve';
import { dirname, join } from 'pathe';

/**
 * This is just an alias for import.meta.resolve. It makes it possible to mock it in Vitest with
 * module-mocking, as Vitest currently does not support import.meta.resolve in tests.
 *
 * @see https://github.com/vitest-dev/vitest/issues/6953
 */
export const importMetaResolve = (...args: Parameters<ImportMeta['resolve']>) => {
  if (typeof import.meta.resolve !== 'function' && process.env.VITEST === 'true') {
    // This should only ever happen in our internal Vitest unit tests. This specific warning is silenced globally in vitest-setup.ts.
    // If anyone sees this warning, it means that this function was used in Vitest, but not our Vitest.
    console.warn(
      "importMetaResolve from within Storybook is being used in a Vitest test, but it shouldn't be. Please report this at https://github.com/storybookjs/storybook/issues/new?template=bug_report.yml"
    );
    return pathToFileURL(args[0]).href;
  }
  return import.meta.resolve(...args);
};

/** Resolves the directory of a given package, by resolving its package.json file. */
export const resolvePackageDir = (
  pkg: Parameters<ImportMeta['resolve']>[0],
  parent?: Parameters<ImportMeta['resolve']>[0]
) => {
  try {
    return dirname(fileURLToPath(importMetaResolve(join(pkg, 'package.json'), parent)));
  } catch {
    return dirname(fileURLToPath(importMetaResolve(join(pkg, 'package.json'))));
  }
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
export async function importModule(
  path: string,
  { skipCache = false }: { skipCache?: boolean } = {}
) {
  if (!isTypescriptLoaderRegistered) {
    const typescriptLoaderUrl = importMetaResolve('storybook/internal/bin/loader');
    register(typescriptLoaderUrl, import.meta.url);
    isTypescriptLoaderRegistered = true;
  }

  let mod;
  try {
    const resolvedPath = win32.isAbsolute(path) ? pathToFileURL(path).href : path;
    // When applicable, add a hash to the import URL to bypass cache
    const importUrl = skipCache ? `${resolvedPath}?${Date.now()}` : resolvedPath;
    mod = await import(importUrl);
  } catch (importError) {
    try {
      // fallback to require to support older behavior
      // this is relevant for presets that are only available with the "require" condition in a package's export map
      const require = createRequire(import.meta.url);
      if (skipCache) {
        delete require.cache[require.resolve(path)];
      }
      mod = require(path);
    } catch (requireError) {
      /*
        If everything fails, throw the original import error, as the require error won't be helpful
        in Node 20 requireError will always be "Error [ERR_REQUIRE_CYCLE_MODULE]: Cannot require() ES Module"
        in Node 22 requireError will always be "Error [ERR_INTERNAL_ASSERTION]: Unexpected module status 5. Cannot require() ES Module"
      */
      throw importError;
    }
  }
  return mod.default ?? mod;
}

/**
 * Safely resolves a module specifier to its absolute file path.
 *
 * Attempts to resolve the given module specifier by trying different file extensions until a valid
 * file is found. Returns undefined if the module cannot be resolved.
 *
 * Optionally pass in a list of file extensions to try, defaulting to `.mjs`, `.js`, and `.cjs`.
 *
 * @example
 *
 * ```typescript
 * // Resolve a relative module
 * const path = safeResolveModule({
 *   specifier: './utils',
 *   parent: import.meta.url,
 * });
 *
 * // Resolve with custom extensions
 * const path = safeResolveModule({
 *   specifier: './config',
 *   extensions: ['.json', '.js'],
 * });
 * ```
 */
export const safeResolveModule = ({
  specifier,
  parent,
  extensions = ['.mjs', '.js', '.cjs'],
}: {
  specifier: string;
  parent?: string;
  extensions?: string[];
}) => {
  try {
    const resolvedPath = resolveModulePath(specifier, {
      from: parent,
      extensions: [''].concat(extensions),
    });
    if (statSync(resolvedPath).isFile()) {
      return resolvedPath;
    }
  } catch (e: any) {}
};
