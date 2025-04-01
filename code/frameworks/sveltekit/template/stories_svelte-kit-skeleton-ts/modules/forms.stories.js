import { expect, fn, within } from 'storybook/test';

import Forms from './Forms.svelte';

export default {
  component: Forms,
};

const enhance = fn();

export const Enhance = {
  async play({ canvasElement }) {
    const canvas = within(canvasElement);
    const button = canvas.getByText('enhance');
    button.click();
    expect(enhance).toHaveBeenCalled();
  },
  parameters: {
    sveltekit_experimental: {
      forms: {
        enhance,
      },
    },
  },
};
