import { createRequire, register } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { dirname, join } from 'pathe';

/**
 * Resolves a module path using import.meta.resolve and optionally appends a custom suffix.
 *
 * This is particularly useful for resolving Storybook internal modules and their associated assets
 * or configuration files.
 *
 * @example Resolve the package.json of the 'storybook' package
 *
 * ```ts
 * const packageJsonPath = resolveModule({ pkg: 'storybook' });
 * // Returns: '/path/to/node_modules/storybook/package.json'
 * ```
 *
 * @example Resolve a specific export from the storybook package
 *
 * ```ts
 * const managerPath = resolveModule({ pkg: 'storybook', exportPath: 'manager-api' });
 * // Returns: '/path/to/node_modules/storybook/dist/manager-api.js'
 * ```
 *
 * @example Resolve a package and append a custom suffix to its directory. This is useful for
 * getting paths to modules not exported by the package.
 *
 * ```ts
 * const presetPath = resolveModule({
 *   pkg: 'storybook',
 *   customSuffix: 'dist/core-server/presets/common-preset.js',
 * });
 * // Returns: '/path/to/node_modules/storybook/dist/core-server/presets/common-preset.js'
 * ```
 *
 * @example Resolve with parent context for relative module resolution
 *
 * ```ts
 * const relativePath = resolveModule({
 *   pkg: '@storybook/addon-a11y',
 *   parent: import.meta.url,
 * });
 * // Returns: '/path/to/node_modules/@storybook/addon-a11y/dist/index.js'
 * ```
 *
 * @example Resolve Storybook internal assets
 *
 * ```ts
 * const assetsPath = resolveModule({
 *   pkg: 'storybook',
 *   exportPath: 'package.json',
 *   customSuffix: 'assets/browser',
 * });
 * // Returns: '/path/to/node_modules/storybook/assets/browser'
 * ```
 *
 * @param {Object} options - Configuration options for module resolution
 * @param {string} options.pkg - The package/module name to resolve (e.g., 'storybook',
 *   'builder-vite')
 * @param {string} [options.parent] - Optional parent module for relative resolution context
 * @param {string} [options.exportPath='package.json'] - The export path within the package to
 *   resolve. Set to '' to resolve the '.' export of the package. Default is `'package.json'`
 * @param {string} [options.customSuffix] - Optional custom suffix to append to the resolved
 *   directory path
 * @returns {string} The resolved file system path, with custom suffix appended if provided
 */
export const resolveModule = ({
  pkg,
  parent,
  exportPath = 'package.json',
  customSuffix,
}: {
  pkg: Parameters<ImportMeta['resolve']>[0];
  parent?: Parameters<ImportMeta['resolve']>[0];
  exportPath?: string;
  customSuffix?: string;
}) => {
  const modulePath = join(pkg, exportPath);

  const resolvedPath = fileURLToPath(import.meta.resolve(modulePath, parent));
  if (customSuffix === undefined) {
    return resolvedPath;
  }
  return join(dirname(resolvedPath), customSuffix);
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
    const typescriptLoaderPath = resolveModule({
      pkg: 'storybook',
      exportPath: 'internal/loader',
    });
    register(typescriptLoaderPath, import.meta.url);
    isTypescriptLoaderRegistered = true;
  }

  let mod;

  try {
    const resolvedPath = path.startsWith('file:') ? path : pathToFileURL(path).href;
    mod = await import(resolvedPath);
  } catch (e) {
    mod = createRequire(import.meta.url)(path);
  }

  return mod.default ?? mod;
}
