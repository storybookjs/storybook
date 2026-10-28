import './server/hooks.ts';
import '@storybook/manager/internal/deep/builder-manager/hooks';

import { createStorybook as createInstance } from '@storybook/core';
import type { CreateStorybookInput, Storybook } from '@storybook/core';
import { builtInAddons } from '../features/index.ts';
import { legacyAdapter } from './compat/legacy-adapter.ts';
import { commonPlugin } from './server/common.ts';

export * from '@storybook/core/internal/instance';

/** Load and configure one isolated headless Storybook. */
export function createStorybook(input: CreateStorybookInput): Promise<Storybook> {
  return createInstance(input, {
    builtInAddons,
    async setupPlugin(plugin, storybook) {
      if (plugin.manager && !builtInAddons.some((addon) => addon === plugin)) {
        const entry = plugin.manager;
        storybook.hook('manager:entries:collect', () => [entry]);
      }
      await plugin.setup(storybook);
    },
    common: commonPlugin,
    legacy: legacyAdapter,
  });
}
