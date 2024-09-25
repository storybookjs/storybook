import { beforeAll, vi, expect as vitestExpect } from 'vitest';

import { setProjectAnnotations } from '@storybook/react';
import { userEvent as storybookEvent, expect as storybookExpect } from '@storybook/test';

import * as coreAnnotations from '../addons/toolbars/template/stories/preview';
import * as componentAnnotations from '../core/template/stories/preview';
// register global components used in many stories
import '../renderers/react/template/components';
import * as projectAnnotations from './preview';

vi.spyOn(console, 'warn').mockImplementation((...args) => console.log(...args));

const annotations = setProjectAnnotations([
  // @ts-expect-error check type errors later
  projectAnnotations,
  // @ts-expect-error check type errors later
  componentAnnotations,
  coreAnnotations,
  {
    // experiment with injecting Vitest's interactivity API over our userEvent while tests run in browser mode
    // https://vitest.dev/guide/browser/interactivity-api.html
    loaders: async (context) => {
      // eslint-disable-next-line no-underscore-dangle
      if (globalThis.__vitest_browser__) {
        const vitest = await import('@vitest/browser/context');
        const { userEvent: browserEvent } = vitest;
        context.userEvent = browserEvent.setup();
        context.expect = vitestExpect;
      } else {
        context.userEvent = storybookEvent.setup();
        context.expect = storybookExpect;
      }
    },
  },
]);

beforeAll(annotations.beforeAll);
