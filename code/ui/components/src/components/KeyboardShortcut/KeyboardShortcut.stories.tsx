import type { Meta, StoryObj } from '@storybook/react';

import { KeyboardShortcut } from './KeyboardShortcut';

const meta: Meta<typeof KeyboardShortcut> = {
  title: 'KeyboardShortcut',
  component: KeyboardShortcut,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof KeyboardShortcut>;

export const Default: Story = {
  args: { label: '⌥ ↑' },
};
