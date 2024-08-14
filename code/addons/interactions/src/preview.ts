import type { PlayFunction, StepLabel, StoryContext } from 'storybook/internal/types';

import { instrument } from '@storybook/instrumenter';

export const { step: runStep } = instrument(
  {
    // It seems like the label is unused, but the instrumenter has access to it
    // The context will be bounded later in StoryRender, so that the user can write just:
    // await step("label", (context) => {
    //   // labeled step
    // });
    step: (label: StepLabel, play: PlayFunction, context: StoryContext) => play(context),
  },
  { intercept: true }
);

export const parameters = {
  throwPlayFunctionExceptions: false,
};
