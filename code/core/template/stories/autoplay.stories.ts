import type { PlayFunctionContext } from 'storybook/internal/types';

import { global as globalThis } from '@storybook/global';

import { expect, within } from 'storybook/test';

export default {
  component: globalThis.__TEMPLATE_COMPONENTS__.Pre,
  decorators: [
    (storyFn: any, context: any) => {
      return storyFn({ args: { text: `Autoplay: ${context.globals?.storyAutoplay ?? 'default'}` } });
    },
  ],
  tags: ['!vitest'],
};

/**
 * This story has storyAutoplay set to 'always' via globals.
 * The play function should always run regardless of the global setting.
 */
export const AlwaysAutoplay = {
  globals: {
    storyAutoplay: 'always',
  },
  play: async ({ canvasElement }: PlayFunctionContext<any>) => {
    const canvas = within(canvasElement);
    const pre = canvas.getByTestId('pre');
    // Mark the element so E2E tests can verify the play function ran
    pre.setAttribute('data-played', 'true');
    await expect(pre).toHaveAttribute('data-played', 'true');
  },
};

/**
 * This story has storyAutoplay set to 'never' via globals.
 * The play function should never run.
 */
export const NeverAutoplay = {
  globals: {
    storyAutoplay: 'never',
  },
  play: async ({ canvasElement }: PlayFunctionContext<any>) => {
    const canvas = within(canvasElement);
    const pre = canvas.getByTestId('pre');
    // Mark the element so E2E tests can verify the play function ran
    pre.setAttribute('data-played', 'true');
    await expect(pre).toHaveAttribute('data-played', 'true');
  },
};
