import { ViteModuleLoaderPathError } from 'storybook/internal/server-errors';
import type { Options } from 'storybook/internal/types';

import { isAbsolute, normalize } from 'pathe';

/** The module specifier of the `experimental_moduleLoader` preset, with an absolute path normalized. */
export async function getModuleLoader(options: Options): Promise<string | undefined> {
  const moduleLoader = await options.presets.apply<string | undefined>('experimental_moduleLoader');
  if (!moduleLoader) {
    return undefined;
  }
  if (isAbsolute(moduleLoader)) {
    return normalize(moduleLoader);
  }
  // The generated modules import the loader, so a relative path would resolve against them
  if (moduleLoader.startsWith('.')) {
    throw new ViteModuleLoaderPathError({ moduleLoader });
  }
  return moduleLoader;
}
