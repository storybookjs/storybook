import type { Options } from 'storybook/internal/types';

import type { FrameworkOptions } from '../types.ts';

export async function resolveDocgenContext(options: Options) {
  const [frameworkOptions, features] = await Promise.all([
    options.presets.apply<FrameworkOptions | null>('frameworkOptions'),
    options.presets.apply('features', {}),
  ]);

  return {
    docgen: frameworkOptions?.docgen !== false,
    docgenServerActive: features?.docgenServer === true,
  };
}
