import type { Options } from 'storybook/internal/types';

export async function getFrameworkBuilderOptions(options: Options) {
  const framework = await options.presets.apply('framework');

  return typeof framework === 'string' ? {} : framework.options.builder || {};
}
