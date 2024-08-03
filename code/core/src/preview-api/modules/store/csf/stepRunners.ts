import type { Renderer, StepRunner } from '@storybook/core/types';

/**
 * Compose step runners to create a single step runner that applies each step runner in order.
 *
 * A step runner is a function that takes a defined step: `step('label', () => { ... })`
 * and runs it. The prototypical example is from `@storybook/addon-interactions` where the
 * step runner will decorate all instrumented code inside the step with information about the
 * label.
 *
 * In theory it is possible to have more than one addon that wants to run steps; they can be
 * composed together in a similar fashion to decorators. In some ways step runners are like
 * decorators except it is not intended that they change the context or the play function.
 *
 * The basic implementation of a step runner is `async (label, play, context) => play(context)`
 *  -- in fact this is what `composeStepRunners([])` will do.
 *
 * @param stepRunners an array of StepRunner
 * @returns a StepRunner that is the composition of the arguments
 */
export function composeStepRunners<TRenderer extends Renderer>(
  stepRunners: StepRunner<TRenderer>[]
): StepRunner<TRenderer> {
  return async (label, play, playContext) => {
    const composedPlay = stepRunners.reduceRight<() => Promise<void>>(
      (innerPlay, stepRunner) => async () => stepRunner(label, innerPlay, playContext),
      async () => play(playContext)
    );
    await composedPlay();
  };
}
