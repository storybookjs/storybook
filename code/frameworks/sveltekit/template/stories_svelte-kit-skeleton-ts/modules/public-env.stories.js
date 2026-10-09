import { expect, within } from 'storybook/test';

import PublicEnv from './PublicEnv.svelte';

export default {
  title: 'stories/frameworks/sveltekit/modules/public-env',
  component: PublicEnv,
};

export const Static = {
  async play({ canvasElement }) {
    const canvas = within(canvasElement);
    await expect(canvas.getByTestId('static-public')).toHaveTextContent('static public value');
  },
};
