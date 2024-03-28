import type { StoryObj } from '@storybook/preact';
import type { ComponentProps } from 'preact';
import { Typed } from './Typed';

export default {
  component: Typed,
};

export const Default: StoryObj<ComponentProps<typeof Typed>> = {
  args: { name: 'John Doe' },
};
