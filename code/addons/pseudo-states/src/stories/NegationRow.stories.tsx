import type { Meta, StoryObj } from '@storybook/react-vite';

import { NegationRow } from './NegationRow.tsx';

const meta = {
  title: 'NegationRow',
  component: NegationRow,
} satisfies Meta<typeof NegationRow>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Hover: Story = {
  parameters: { pseudo: { hover: true } },
};
