import { expect, fn, userEvent, within } from '@storybook/test';

import Forms from './Forms.svelte';

export default {
  title: 'stories/sveltekit/modules/forms',
  component: Forms,
  tags: ['autodocs'],
};

const enhance = fn();

export const Enhance = {
  async play({ canvasElement }) {
    const canvas = within(canvasElement);
    const button = canvas.getByRole('button');
    await userEvent.click(button);
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
