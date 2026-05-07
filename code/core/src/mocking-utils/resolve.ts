import { realpathSync } from 'node:fs';
import { createRequire } from 'node:module';

import { ResolverFactory as OxcResolverFactory } from 'oxc-resolver';
import { dirname, isAbsolute, resolve } from 'pathe';

import { isModuleDirectory } from './extract.ts';

const require = createRequire(import.meta.url);

/**
 * Browser-condition resolver used for `sb.mock()` external module resolution.
 *
 * - `browser` wins ahead of `import` / `module` / `default` in `exports` maps via `conditionNames`
 * - the package.json `browser` field is honoured via `aliasFields`
 * - `mainFields` order picks `pkg.browser` first, then `pkg.module`, then `pkg.main` when no
 *   `exports` map is present
 */
const externalResolver = new OxcResolverFactory({
  conditionNames: ['browser', 'import', 'module', 'default'],
  mainFields: ['browser', 'module', 'main'],
  aliasFields: [['browser']],
  extensions: ['.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx', '.json', '.vue', '.svelte'],
});

/**
 * Resolves an external module path to its absolute path, preferring browser-targeted entries via
 * the `exports` map and the package.json `browser` field.
 *
 * @param path The raw module path from the `sb.mock()` call.
 * @param root The project's root directory.
 * @returns The absolute path to the module.
 */
export function resolveExternalModule(path: string, root: string) {
  const result = externalResolver.sync(root, path);
  if (result.path) {
    return result.path;
  }
  return require.resolve(path, { paths: [root] });
}

export function getIsExternal(path: string, importer: string) {
  try {
    return !isAbsolute(path) && isModuleDirectory(require.resolve(path, { paths: [importer] }));
  } catch (e) {
    return false;
  }
}

/**
 * Resolves a mock path to its absolute path and checks for a `__mocks__` redirect. This function
 * resolves modern ESM packages via the `exports` map with browser-first conditions.
 *
 * @param path The raw module path from the `sb.mock()` call.
 * @param root The project's root directory.
 * @param importer The absolute path of the file containing the mock call (the preview file).
 */
export function resolveMock(
  path: string,
  root: string,
  importer: string,
  findMockRedirect: (
    root: string,
    absolutePath: string,
    externalPath: string | null
  ) => string | null
) {
  const isExternal = getIsExternal(path, root);
  const externalPath = isExternal ? path : null;

  const absolutePath = isExternal
    ? resolveExternalModule(path, root)
    : require.resolve(path, { paths: [dirname(importer)] });

  const normalizedAbsolutePath = resolve(absolutePath);

  const redirectPath = findMockRedirect(root, normalizedAbsolutePath, externalPath);

  return {
    absolutePath: normalizedAbsolutePath,
    redirectPath, // will be null if no __mocks__ file is found
  };
}

/**
 * External mean not absolute, and not relative
 *
 * We use `require.resolve` here, because import.meta.resolve needs a experimental node flag
 * (`--experimental-import-meta-resolve`) to be enabled to respect the context option.
 *
 * @param path - The path to the mock file
 * @param from - The root of the project, this should be an absolute path
 * @returns True if the mock path is external, false otherwise
 * @link https://nodejs.org/api/cli.html#--experimental-import-meta-resolve
 */
export function isExternal(path: string, from: string) {
  try {
    return !isAbsolute(path) && isModuleDirectory(require.resolve(path, { paths: [from] }));
  } catch (e) {
    return false;
  }
}

/**
 * Normalizes a file path for comparison, resolving symlinks if possible. Falls back to the original
 * path if resolution fails.
 */
export function getRealPath(path: string, preserveSymlinks: boolean): string {
  try {
    return preserveSymlinks ? realpathSync(path) : path;
  } catch {
    return path;
  }
}

/**
 * This is a wrapper around `require.resolve` that tries to resolve the path with different file
 * extensions.
 *
 * @param path - The path to the mock file
 * @param from - The root of the project, this should be an absolute path
 * @returns The resolved path
 */
export function resolveWithExtensions(path: string, from: string) {
  const extensions = ['.js', '.ts', '.tsx', '.mjs', '.cjs', '.svelte', '.vue'];

  for (const extension of extensions) {
    try {
      return require.resolve(path + extension, { paths: [from] });
    } catch (e) {
      continue;
    }
  }

  return require.resolve(path, { paths: [from] });
}
