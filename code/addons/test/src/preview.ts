import type { PlayFunction, StepLabel, StoryContext } from 'storybook/internal/types';

import { instrument } from '@storybook/instrumenter';
// This makes sure that storybook test loaders are always loaded when addon-interactions is used
// For 9.0 we want to merge storybook/test and addon-interactions into one addon.
import '@storybook/test';

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

export const initialGlobals = {
  interactionsDemoMode: null as any,
};

export const beforeEach = () => {
  return () => {
    // remove demo mode cursor
    document.getElementById('sb-demo-cursor')?.remove();
  };
};
