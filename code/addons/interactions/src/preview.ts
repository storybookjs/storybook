import type { PlayFunction, PlayFunctionContext, StepLabel } from '@storybook/types';
import { instrument } from '@storybook/instrumenter';

export const { step: runStep } = instrument(
  {
    step: (label: StepLabel, play: PlayFunction, context: PlayFunctionContext<any>) =>
      play(context),
  },
  { intercept: true }
);

export const parameters = {
  throwPlayFunctionExceptions: false,
};
