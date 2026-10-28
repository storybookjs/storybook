import { fileURLToPath } from 'node:url';

import { defineAddon } from '@storybook/core';
// Types only: the product declares the `server:*` hooks this addon handles.
import type {} from 'storybook/internal/instance';

import { forwardOnboardingTelemetry } from './node/server-channel.ts';

export default defineAddon(() => ({
  meta: { name: '@storybook/addon-onboarding' },
  manager: fileURLToPath(import.meta.resolve('@storybook/addon-onboarding/manager')),
  setup(storybook): void {
    storybook.hook('server:channel:ready', (channel) => {
      forwardOnboardingTelemetry(channel);
    });
  },
}));
