import type { Meta, StoryObj } from '@storybook/react-vite';

import { EmptyExample } from './EmptyExample.tsx';

const meta = {
  title: 'examples/Stories block parameters',
  component: EmptyExample,
  tags: ['autodocs'],
  parameters: {
    docs: {
      stories: {
        title: 'Configured stories',
        includePrimaryStory: false,
        forceInitialArgs: false,
      },
    },
  },
} satisfies Meta<typeof EmptyExample>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Primary: Story = {};
export const Secondary: Story = {};
export const Tertiary: Story = {};
