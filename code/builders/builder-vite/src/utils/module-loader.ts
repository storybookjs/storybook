import { fileURLToPath } from 'node:url';

import { ViteModuleLoaderPathError } from 'storybook/internal/server-errors';
import type { Options } from 'storybook/internal/types';

import { isAbsolute, normalize } from 'pathe';

/**
 * The module specifier of the `experimental_moduleLoader` preset: an absolute path (normalized, also
 * from a `file:` URL) or a package specifier.
 */
export async function getModuleLoader(options: Options): Promise<string | undefined> {
  const moduleLoader = await options.presets.apply<unknown>('experimental_moduleLoader');
  if (moduleLoader === undefined || moduleLoader === null || moduleLoader === '') {
    return undefined;
  }
  if (
    moduleLoader instanceof URL ||
    (typeof moduleLoader === 'string' && moduleLoader.startsWith('file:'))
  ) {
    return normalize(fileURLToPath(moduleLoader));
  }
  // The generated modules import the loader, so a relative path would resolve against them
  if (typeof moduleLoader !== 'string' || moduleLoader.startsWith('.')) {
    throw new ViteModuleLoaderPathError({ moduleLoader: String(moduleLoader) });
  }
  return isAbsolute(moduleLoader) ? normalize(moduleLoader) : moduleLoader;
}
