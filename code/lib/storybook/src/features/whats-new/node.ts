import '../../storybook/server/hooks.ts';

import { defineAddon } from '@storybook/core/internal/deep/instance/addons';

import { initializeWhatsNew, type OptionsWithRequiredCache } from './whats-new.ts';

/** Serve the latest Storybook post and its notification settings to the manager. */
export default defineAddon(() => ({
  meta: { name: 'storybook/whats-new' },
  setup(storybook): void {
    storybook.hook('server:channel:ready', (channel, ctx) => {
      // Configuration hooks receive the instance's options, including the CLI cache.
      initializeWhatsNew(channel, { ...ctx } as OptionsWithRequiredCache);
    });
  },
}));
