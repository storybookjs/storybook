import type { Options } from 'storybook/internal/types';

export async function getFrameworkBuilderOptions(options: Options) {
  const framework = await options.presets.apply('framework');

  if (typeof framework === 'string') {
    return {};
  }

  return framework.options?.builder ?? {};
}
