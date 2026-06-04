import { vi, expect as vitestExpect } from 'vitest';

import { setProjectAnnotations } from '@storybook/react';

import { userEvent as storybookEvent, expect as storybookExpect } from 'storybook/test';
import { Channel, getChannel, setChannel } from 'storybook/internal/channels';

import '../core/src/shared/utils/toHaveLiveRegion.ts';

// Preview side-effect modules (e.g. background-service) register open services at import time.
// Vitest may evaluate this setup file before the addon setup-file runs, so ensure a channel exists.
if (!getChannel()) {
  setChannel(new Channel({}));
}

import preview from './preview.tsx';

vi.spyOn(console, 'warn').mockImplementation((...args) => console.log(...args));

setProjectAnnotations([
  preview.composed,
  {
    // experiment with injecting Vitest's interactivity API over our userEvent while tests run in browser mode
    // https://vitest.dev/guide/browser/interactivity-api.html
    loaders: async (context) => {
      if (globalThis.__vitest_browser__) {
        const vitest = await import('vitest/browser');
        const { userEvent: browserEvent } = vitest;
        // Unfortunately the types of userEvent don't match so we cast it
        context.userEvent = (browserEvent as unknown as typeof storybookEvent).setup();
        context.expect = vitestExpect;
      } else {
        context.userEvent = storybookEvent.setup();
        context.expect = storybookExpect;
      }
    },
  },
]);
