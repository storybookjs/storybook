import { fn } from 'storybook/test';

import Button from './Button.gjs';

// More on how to set up stories at: https://storybook.js.org/docs/writing-stories
export default {
  title: 'Example/Button',
  component: Button,
  argTypes: {
    backgroundColor: { control: 'color' },
    label: { control: 'text' },
    onClick: { action: 'onClick' },
    primary: { control: 'boolean' },
    size: {
      control: { type: 'select' },
      options: ['small', 'medium', 'large'],
    },
  },
  // Use `fn` to spy on the onClick arg, which will appear in the actions panel once invoked: https://storybook.js.org/docs/essentials/actions#story-args
  args: { onClick: fn() },
};

export const Primary = {
  args: {
    label: 'Button',
    primary: true,
    size: 'medium',
  },
};

export const Secondary = {
  args: {
    label: 'Buttons',
    primary: false,
    size: 'large',
  },
};
