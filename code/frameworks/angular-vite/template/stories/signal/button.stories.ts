import preview from '#.storybook/preview';
import { fn } from 'storybook/test';

import SignalButtonComponent from './button.component';

// More on how to set up stories at: https://storybook.js.org/docs/writing-stories
const meta = preview.meta({
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
  // Use `fn` to spy on the onClick arg, which will appear in the actions panel once invoked: https://storybook.js.org/docs/essentials/actions#story-args
  args: {
    onClick: fn(),
    primary: false,
    size: 'medium',
  },
});

// More on writing stories with args: https://storybook.js.org/docs/writing-stories/args
export const Primary = meta.story({
  args: {
    primary: true,
    label: 'Button',
  },
});

export const Secondary = meta.story({
  args: {
    label: 'Button',
  },
});

export const Medium = meta.story({
  args: {
    size: 'medium',
    label: 'Button',
  },
});

export const Small = meta.story({
  args: {
    size: 'small',
    label: 'Button',
  },
});
