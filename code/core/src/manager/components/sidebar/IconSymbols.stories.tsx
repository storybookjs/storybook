import type { Meta, StoryObj } from '@storybook/react-vite';

import { IconSymbols } from './IconSymbols';

const meta = {
  component: IconSymbols,
  title: 'Sidebar/IconSymbols',
} satisfies Meta<typeof IconSymbols>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
