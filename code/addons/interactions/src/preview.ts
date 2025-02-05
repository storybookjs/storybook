import type { PlayFunction, StepLabel, StepRunner, StoryContext } from 'storybook/internal/types';

import { instrument } from '@storybook/instrumenter';
// This makes sure that storybook test loaders are always loaded when addon-interactions is used
// For 9.0 we want to merge storybook/test and addon-interactions into one addon.
import '@storybook/test';

import type { InteractionsParameters } from './types';

export const runStep = instrument(
  {
    // It seems like the label is unused, but the instrumenter has access to it
    // The context will be bounded later in StoryRender, so that the user can write just:
    // await step("label", (context) => {
    //   // labeled step
    // });
    step: (label: StepLabel, play: PlayFunction, context: StoryContext) => play(context),
  },
  { intercept: true }
  // perhaps csf types need to be updated? StepRunner expects Promise<void> and not Promise<void> | void
).step as StepRunner;

export const parameters: InteractionsParameters['test'] = {
  throwPlayFunctionExceptions: false,
};
