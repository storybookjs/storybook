import type { Meta, StoryObj } from '@storybook/react';
import { SimpleSizeTest } from './SimpleSizeTest';

const meta = {
  title: 'examples/Stories for the Story Block',
  component: SimpleSizeTest,
  // Stop *this* story from being stacked in Chromatic (we want the caller to stack though)
  parameters: { theme: 'default' },
} satisfies Meta<typeof SimpleSizeTest>;
export default meta;

type Story = StoryObj<typeof meta>;

export const NoParameters: Story = {};

export const Height: Story = { parameters: { docs: { story: { height: '600px' } } } };

export const InlineFalse: Story = { parameters: { docs: { story: { inline: false } } } };

export const InlineFalseWithIframeHeight: Story = {
  parameters: { docs: { story: { inline: false, iframeHeight: '300px' } } },
};

export const InlineFalseWithHeight: Story = {
  parameters: { docs: { story: { inline: false, height: '300px' } } },
};
