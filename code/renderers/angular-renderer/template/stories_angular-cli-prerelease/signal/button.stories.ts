import { Meta, StoryObj } from '@storybook/angular';
import { fn } from '@storybook/test';

import SignalButtonComponent from './button.component';

// More on how to set up stories at: https://storybook.js.org/docs/writing-stories
const meta: Meta<SignalButtonComponent> = {
  component: SignalButtonComponent,
  tags: ['autodocs'],
  argTypes: {
    backgroundColor: {
      control: 'color',
    },
    // The following argTypes are necessary,
    // because Compodoc does not support Angular's new input and output signals yet
    primary: {
      type: 'boolean',
    },
    size: {
      control: {
        type: 'radio',
      },
      options: ['small', 'medium'],
    },
    label: {
      type: 'string',
    },
  },
  // Use `fn` to spy on the onClick arg, which will appear in the actions panel once invoked: https://storybook.js.org/docs/essentials/actions#action-args
  args: {
    onClick: fn(),
    primary: false,
    size: 'medium',
  },
};

export default meta;
type Story = StoryObj<SignalButtonComponent>;

// More on writing stories with args: https://storybook.js.org/docs/writing-stories/args
export const Primary: Story = {
  args: {
    primary: true,
    label: 'Button',
  },
};

export const Secondary: Story = {
  args: {
    label: 'Button',
  },
};

export const Medium: Story = {
  args: {
    size: 'medium',
    label: 'Button',
  },
};

export const Small: Story = {
  args: {
    size: 'small',
    label: 'Button',
  },
};
