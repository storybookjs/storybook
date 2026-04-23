import type { Options } from 'storybook/internal/types';

/**
 * Builder options can be specified in `core.builder.options` or `framework.options.builder`.
 * Preference is given here to `framework.options.builder` if both are specified.
 */
export async function getBuilderOptions<T extends Record<string, any>>(
  options: Options
): Promise<T | Record<string, never>> {
  const framework = await options.presets.apply('framework', {}, options);

  if (typeof framework !== 'string' && framework?.options?.builder) {
    return framework.options.builder;
  }

  const { builder } = await options.presets.apply('core', {}, options);

  if (typeof builder !== 'string' && builder?.options) {
    return builder.options as T;
  }

  return {};
}

/**
 * Extracts builder options from an already-resolved framework value.
 * Handles both string framework names (no options) and object framework configs.
 */
export function extractBuilderOptions(
  framework: string | Record<string, any>
): Record<string, any> {
  if (typeof framework === 'string' || !framework?.options?.builder) {
    return {};
  }
  return framework.options.builder;
}
