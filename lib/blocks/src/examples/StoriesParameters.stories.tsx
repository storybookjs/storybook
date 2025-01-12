import type { Meta, StoryObj } from '@storybook/react';

import { EmptyExample } from './EmptyExample';

const meta = {
  title: 'examples/Stories for the Stories and Primary Block',
  component: EmptyExample,
} satisfies Meta<typeof EmptyExample>;
export default meta;

type Story = StoryObj<typeof meta>;

export const WithoutToolbar: Story = {
  parameters: { docs: { canvas: { withToolbar: false } } },
};

export const WithToolbar: Story = {
  parameters: { docs: { canvas: { withToolbar: true } } },
};
export const ThirdStory: Story = {};
