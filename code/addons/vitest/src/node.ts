import { fileURLToPath } from 'node:url';

import { defineAddon } from '@storybook/core';
import type { Options } from '@storybook/core/internal/types';
// Types only: the product declares the `server:*` hooks this addon handles.
import type {} from 'storybook/internal/instance';

import { wireAiScoringChannels } from './node/ai-scoring.ts';
import { wireTestServerChannel } from './node/server-channel.ts';
import { registerTestServices } from './node/services.ts';
import { createTestRunnerRuntime } from './node/test-run-responder.ts';
import { withCoverageStaticDir } from './node/static-dirs.ts';

/** Configure crash reporting for the test runner. */
export type VitestOptions = Pick<Options, 'enableCrashReports'>;

export default defineAddon<VitestOptions | void>((input) => {
  const options = input || {};
  return {
    meta: { name: '@storybook/addon-vitest' },
    manager: fileURLToPath(import.meta.resolve('@storybook/addon-vitest/manager')),
    setup(storybook): void {
      const runtime = createTestRunnerRuntime(storybook);
      storybook.hook('core:services:register', () =>
        registerTestServices(storybook, storybook.hasAddon('@storybook/addon-a11y'), runtime)
      );
      storybook.hook('server:channel:ready', (channel) => {
        wireAiScoringChannels(storybook, channel);
        return wireTestServerChannel(storybook, channel, options, runtime);
      });
      storybook.hook('core:instance:close', () => runtime.close());
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
