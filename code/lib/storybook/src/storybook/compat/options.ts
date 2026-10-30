import { getFrameworkNameFromConfig } from '@storybook/core/internal/common';
import type { Options } from '@storybook/core/internal/types';

import { dedent } from '@storybook/core/internal/deep/utils/node-libs';

/**
 * @deprecated Read `framework.options.builder` or `core.builder.options` from the instance's
 *   `core:framework:extend` and `core:config:extend` hooks.
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

/** @deprecated Use `getFrameworkNameFromConfig(storybook.options.framework)`. */
export async function getFrameworkName(options: Options): Promise<string> {
  const framework = await options.presets.apply('framework', '', options);

  if (!framework) {
    throw new Error(dedent`
      You must specify a framework in '.storybook/main.js' config.

      https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#framework-field-mandatory
    `);
  }

  return getFrameworkNameFromConfig(framework)!;
}

/** @deprecated Read the renderer addon from `storybook.addons` (`kind: 'renderer'`). */
export async function getRendererName(options: Options): Promise<string> {
  const core = await options.presets.apply('core', {}, options);

  if (!core || !core.renderer) {
    // Some frameworks (Angular, Ember) have no renderer and serve as their own.
    return getFrameworkName(options);
  }

  return core.renderer;
}
