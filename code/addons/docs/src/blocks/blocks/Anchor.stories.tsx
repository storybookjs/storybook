import type { Meta, StoryObj } from '@storybook/react-vite';

import { Anchor } from './Anchor';

const meta = {
  component: Anchor,
  parameters: {
    layout: 'fullscreen',
    docsStyles: true,
  },
} satisfies Meta<typeof Anchor>;

export default meta;

export const Default: StoryObj<typeof meta> = {
  args: {
    children: 'This is an anchor for storyId: "default"',
    storyId: 'default',
  },
};
