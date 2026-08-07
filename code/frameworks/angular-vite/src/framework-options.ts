import type { Preset } from 'storybook/internal/types';

import type { FrameworkOptions } from './types.ts';

/**
 * Reads `framework.options` from the resolved presets.
 *
 * `framework` is either the framework's package name or `{ name, options }`, and only the latter
 * carries options. `presets.apply` is untyped, so the shape is asserted here rather than at each
 * use.
 */
export const readFrameworkOptions = async (options?: {
  presets?: { apply: (key: string, fallback?: unknown) => Promise<unknown> };
}): Promise<FrameworkOptions> => {
  const framework = (await options?.presets?.apply('framework')) as Preset | undefined;
  return typeof framework === 'string' ? {} : (framework?.options ?? {});
};
