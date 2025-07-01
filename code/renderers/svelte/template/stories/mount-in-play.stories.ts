import type { StoryObj } from '@storybook/svelte';

import Button from './Button.svelte';

export default {
  component: Button,
};

export const Basic: StoryObj = {
  args: {
    disabled: true,
  },
  async play({ mount, args }) {
    await mount(Button, { props: { ...args, label: 'set in play' } });
  },
};
