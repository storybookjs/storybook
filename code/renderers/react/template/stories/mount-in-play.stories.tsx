import type { FC } from 'react';
import React from 'react';
import type { StoryObj } from '@storybook/react';

const Button: FC<{ label?: string; disabled?: boolean }> = (props) => {
  return <button disabled={props.disabled}>{props.label}</button>;
};

export default {
  component: Button,
};

export const Basic: StoryObj<typeof Button> = {
  args: {
    disabled: true,
  },
  async play({ mount, args }) {
    await mount(<Button {...args} label={'set in play'} />);
  },
};
