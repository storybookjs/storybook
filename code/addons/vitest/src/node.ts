import { fileURLToPath } from 'node:url';

import { defineAddon } from '@storybook/core';
import type { Options } from '@storybook/core/internal/types';
// Types only: the product declares the `server:*` hooks this addon handles.
import type {} from 'storybook/internal/instance';

import { wireTestServerChannel } from './node/server-channel.ts';
import { registerTestServices } from './node/services.ts';
import { withCoverageStaticDir } from './node/static-dirs.ts';

/** Configure crash reporting for the test runner. */
export type VitestOptions = Pick<Options, 'enableCrashReports'>;

export default defineAddon<VitestOptions | void>((input) => {
  const options = input || {};
  return {
    meta: { name: '@storybook/addon-vitest' },
    manager: fileURLToPath(import.meta.resolve('@storybook/addon-vitest/manager')),
    setup(storybook): void {
      storybook.hook('core:services:register', () =>
        registerTestServices(storybook, storybook.hasPlugin('@storybook/addon-a11y'))
      );
      storybook.hook('server:channel:ready', (channel) =>
        wireTestServerChannel(storybook, channel, options)
      );
      storybook.hook(
        'core:static-dirs:collect',
        (value, ctx) =>
          withCoverageStaticDir(
            value,
            ctx?.configType ?? (storybook.mode === 'build' ? 'PRODUCTION' : 'DEVELOPMENT')
          ),
        'reduce'
      );
    },
  };
});
