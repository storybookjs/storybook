import { instrument } from 'storybook/internal/instrumenter';
import type { PlayFunction, StepLabel, StoryContext } from 'storybook/internal/types';

import { definePreview } from 'storybook/preview-api';

const { step } = instrument(
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

export default () =>
  definePreview({
    parameters: {
      throwPlayFunctionExceptions: false,
    },
    runStep: step,
  });
