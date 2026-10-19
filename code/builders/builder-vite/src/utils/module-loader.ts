import type { Options } from 'storybook/internal/types';

import { isAbsolute, normalize } from 'pathe';

/** The module specifier of the `experimental_moduleLoader` preset, with an absolute path normalized. */
export async function getModuleLoader(options: Options): Promise<string | undefined> {
  const moduleLoader = await options.presets.apply<string | undefined>('experimental_moduleLoader');
  return moduleLoader && isAbsolute(moduleLoader) ? normalize(moduleLoader) : moduleLoader;
}
