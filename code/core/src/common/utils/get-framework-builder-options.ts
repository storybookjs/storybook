import type { Options } from 'storybook/internal/types';

export async function getFrameworkBuilderOptions(
  options: Options
): Promise<Record<string, unknown>> {
  const framework = await options.presets.apply('framework', {}, options);

  if (typeof framework === 'string') {
    return {};
  }

  return framework.options?.builder ?? {};
}
