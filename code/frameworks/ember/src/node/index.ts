import {
  defineFramework,
  defineMain as coreDefineMain,
  type RendererAddon,
  type StorybookConfig as InstanceConfig,
} from '@storybook/core';
import { getPreviewModuleIds } from '@storybook/core/internal/preview-page';

import { webpack } from '@storybook/builder-webpack5/node';

import { pickEmberOptions, withEmberBabel, withEmberRule } from '../compiler.ts';
import type { EmberFrameworkOptions, StorybookConfig as EmberConfig } from '../types.ts';
import { emberRenderer } from './renderer.ts';

export type { EmberFrameworkOptions };

/** Configure Ember with native addons or preset entries. */
export type StorybookConfig = Omit<EmberConfig, 'addons'> & Pick<InstanceConfig, 'addons'>;

/** Compose the Ember renderer with an isolated Webpack builder. */
export const ember = defineFramework<
  '@storybook/ember',
  EmberFrameworkOptions | void,
  RendererAddon
>((input) => {
  const options = input || {};
  return {
    meta: { name: '@storybook/ember' },
    builder: webpack(options.builder),
    renderer: emberRenderer(),
    setup(storybook): void {
      storybook.hook('core:framework:extend', () => ({ name: '@storybook/ember', options }));
      storybook.hook('core:framework-options:extend', () => ({ ...options }));
      storybook.hook(
        'builder:babel:extend',
        (config) =>
          withEmberBabel(
            config,
            pickEmberOptions(options, storybook.options.main as EmberConfig)
          ) as Record<string, unknown>
      );
      storybook.hook('builder:webpack:extend', async (config) =>
        withEmberRule(config, {
          babelOptions: await storybook.callHook('builder:babel:extend', {}),
          typescriptOptions: await storybook.callHook('core:typescript:extend', {}),
          previewModuleIds: getPreviewModuleIds('webpack', storybook.workingDir),
        })
      );
    },
  };
});

export default ember;

/** @deprecated Import defineMain from 'storybook'. */
export const defineMain: typeof coreDefineMain = coreDefineMain;
