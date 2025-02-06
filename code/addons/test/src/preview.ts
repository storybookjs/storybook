import type {
  LoaderFunction,
  PlayFunction,
  StepLabel,
  StoryContext,
} from 'storybook/internal/types';

import { instrument } from '@storybook/instrumenter';
// This makes sure that storybook test loaders are always loaded when addon-interactions is used
// For 9.0 we want to merge storybook/test and addon-interactions into one addon.
import { userEvent } from '@storybook/test';

export const { step: runStep } = instrument(
  {
    // It seems like the label is unused, but the instrumenter has access to it
    // The context will be bounded later in StoryRender, so that the user can write just:
    // await step("label", (context) => {
    //   // labeled step
    // });
    step: async (label: StepLabel, play: PlayFunction, context: StoryContext) => play(context),
  },
  { intercept: true }
);

export const parameters = {
  throwPlayFunctionExceptions: false,
};

export const loaders: LoaderFunction = async (context) => {
  if (context.parameters.test?.dangerouslyUseInteractivityApi) {
    // eslint-disable-next-line no-underscore-dangle
    if (globalThis.__vitest_browser__) {
      const vitest = await import('@vitest/browser/context');
      const { userEvent: browserEvent } = vitest;
      // @ts-expect-error fix later
      context.userEvent = browserEvent.setup();
    } else {
      context.userEvent = userEvent.setup();
    }
  }
};
